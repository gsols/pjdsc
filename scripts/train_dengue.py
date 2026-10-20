"""Train leakage-safe weekly dengue forecasts for NCR and Quezon City.

Run from repo root:
    pip install -r services/engine/requirements.txt
    python scripts/train_dengue.py "/path/to/Dengue_Environmental Vars_Dataset.xlsx"

Outputs services/engine/models/{ncr,quezon_city}.joblib and
services/engine/models/validation_report.json.
These are historical/backtest models, not live 2026 case surveillance.
"""
import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "services/engine/models"
LAGS = (1, 2, 3, 4, 8, 12, 52)
WEATHER_LAGS = (1, 2, 4)
AREAS = {
    "QUEZON_CITY": dict(sheet="QC Data", case="DC_QC",
                       weather=["RF_NASA", "Temp_ERA5-Land", "RH_ERA5-Land"]),
    "NCR": dict(sheet="Regional Data", case="DC_DOH",
                weather=["RF_HDX", "Temp_ERA5-Land", "SH_ERA5-Land"]),
}

def load_series(source: Path, area: str):
    spec = AREAS[area]
    df = pd.read_excel(source, sheet_name=spec["sheet"])
    if area == "NCR":
        df = df.loc[df["REGION"].astype(str).str.upper().str.strip() == "NCR"].copy()
        # Keep source flags in report; no silent removal of suspect case values.
    df = df.sort_values(["YR", "WN"]).reset_index(drop=True)
    if df.empty or df.duplicated(["YR", "WN"]).any():
        raise ValueError(f"{area}: missing or duplicate area-week data")
    df["cases"] = pd.to_numeric(df[spec["case"]], errors="coerce")
    if df["cases"].isna().any() or (df["cases"] < 0).any():
        raise ValueError(f"{area}: missing or negative case counts; inspect source flags")
    for w in spec["weather"]:
        df[w] = pd.to_numeric(df[w], errors="coerce")
    if area == "NCR":
        print("NCR flag counts:", {
            c: df[c].value_counts(dropna=False).to_dict()
            for c in ("FLAG_DEKADAL_APPROX", "FLAG_PLAUSIBILITY") if c in df.columns
        })
    # Reindex on real ISO-week dates: prevents the 2019-to-2022 gap in NCR 
    # from being treated as adjacent weeks (and leaking invalid lag relationships).
    dates = pd.to_datetime([__import__("datetime").date.fromisocalendar(int(y),int(w),1)
                            for y,w in zip(df["YR"],df["WN"])])
    df.index = pd.DatetimeIndex(dates)
    df = df.reindex(pd.date_range(df.index.min(), df.index.max(), freq="W-MON"))\n    df["YR"] = df.index.isocalendar().year.astype(int).to_numpy()\n    df["WN"] = df.index.isocalendar().week.astype(int).to_numpy()
    return df, spec

def features(df, weather):
    x = pd.DataFrame(index=df.index)
    week = df["WN"].astype(float)
    x["week_sin"] = np.sin(2 * np.pi * week / 52.18)
    x["week_cos"] = np.cos(2 * np.pi * week / 52.18)
    x["year"] = df["YR"].astype(float)
    for lag in LAGS:
        x[f"cases_lag_{lag}"] = df["cases"].shift(lag)
    x["cases_prev4_mean"] = df["cases"].shift(1).rolling(4).mean()
    for name in weather:
        for lag in WEATHER_LAGS:
            x[f"{name}_lag_{lag}"] = df[name].shift(lag)
    # No current-week cases, contemporaneous weather, or future data in features.
    return x

def train_area(source, area):
    df, spec = load_series(source, area)
    x = features(df, spec["weather"])
    eligible = x.dropna().index.intersection(df.index[df["cases"].notna()])
    if len(eligible) < 140:
        raise ValueError(f"{area}: insufficient complete lagged rows ({len(eligible)})")
    # 2024-2025 are strictly out-of-time holdout years; do not shuffle.
    test_idx = eligible[df.loc[eligible, "YR"] >= 2024]
    train_idx = eligible[df.loc[eligible, "YR"] < 2024]
    if len(test_idx) < 30 or len(train_idx) < 100:
        raise ValueError(f"{area}: 2024+ holdout or training period too short")
    model = HistGradientBoostingRegressor(loss="poisson", max_iter=160,
                max_leaf_nodes=12, min_samples_leaf=15, learning_rate=.04,
                l2_regularization=5.0, random_state=42)
    model.fit(x.loc[train_idx], df.loc[train_idx, "cases"])
    predicted = np.maximum(0, model.predict(x.loc[test_idx]))
    actual = df.loc[test_idx, "cases"].to_numpy()
    baseline = df["cases"].shift(52).loc[test_idx].to_numpy()
    baseline_mae = float(mean_absolute_error(actual, baseline))
    model_mae = float(mean_absolute_error(actual, predicted))
    report = {
        "area":area, "source_last_week": {"year":int(df.iloc[-1]["YR"]),
                        "week":int(df.iloc[-1]["WN"])},
        "rows_total":len(df), "train_rows":len(train_idx), "test_rows":len(test_idx),
        "holdout_years":sorted(df.loc[test_idx, "YR"].astype(int).unique().tolist()),
        "model_mae":round(model_mae,2),
        "seasonal_naive_mae":round(baseline_mae,2),
        "better_than_seasonal_naive":bool(model_mae < baseline_mae),
        "validation_type":"out-of-time one-week-ahead (observed preceding weeks)",
        "four_week_recursive_performance_evaluated":False,
        "caution":"Not a validated four-week prospective forecast. Source data ends in 2025.",
    }
    # Refit on the full historical series only after scoring the held-out model.
    model.fit(x.loc[eligible], df.loc[eligible, "cases"])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    observed = df.loc[df["cases"].notna(), ["YR","WN","cases",*spec["weather"]]]
    joblib.dump({
        "model":model, "weather":spec["weather"], "case_column":spec["case"],
        "history":observed.to_dict(orient="records"),
        "feature_names":x.columns.tolist(), "validation":report
    }, OUTPUT / f"{area.lower()}.joblib")
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    a=parser.parse_args()
    reports=[train_area(a.workbook,area) for area in AREAS]
    (OUTPUT/"validation_report.json").write_text(json.dumps(reports,indent=2)+"\n")
    web_output = ROOT / "apps/web/public/data/forecast-validation.json"
    web_output.parent.mkdir(parents=True, exist_ok=True)
    web_output.write_text(json.dumps(reports,indent=2)+"\n")
    for report in reports:
        print(json.dumps(report,indent=2))
    print("Models saved. Compare MAE against seasonal naive before presentation.")
if __name__=="__main__":
    main()

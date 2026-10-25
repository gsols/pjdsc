"""Future seasonal case projection without unavailable current case/weather lags.

Boosted trees are compared with a seasonal baseline using past-only folds. Future
weather comes from labeled historical analogs, never measured future weather.
"""
import math

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from xgboost import XGBRegressor
from .source_calendar import source_week, day_schedule

WEATHER = ["RF_NASA", "Temp_ERA5-Land", "RH_ERA5-Land"]
LAGS = [1, 2, 4]
PROFILES = {"typical": ("RF_NASA", .5), "wetter": ("RF_NASA", .8), "drier": ("RF_NASA", .2), "hotter": ("Temp_ERA5-Land", .8)}
VERSION = "qc-seasonal-xgboost-calendar-v3"
XGBOOST_CANDIDATES = {
    "weather_all_years": {"weather": True, "halfLifeYears": None},
    "season_only_all_years": {"weather": False, "halfLifeYears": None},
    "weather_recent_weight": {"weather": True, "halfLifeYears": 4},
    "season_only_recent_weight": {"weather": False, "halfLifeYears": 4},
}


def seasonal_features(week):
    phase = 2 * np.pi * (np.asarray(week, dtype=float) - 1) / 52
    return np.column_stack([np.sin(phase), np.cos(phase), np.sin(2 * phase), np.cos(2 * phase)])


def train_engine(history):
    data = history.sort_index().copy()
    matrix = seasonal_features(data.WN.to_numpy())
    for column in WEATHER:
        for lag in LAGS:
            matrix = np.column_stack([matrix, data[column].shift(lag).to_numpy()])
    valid = np.isfinite(matrix).all(axis=1) & data.DC_QC.notna().to_numpy()
    if int(valid.sum()) < 104:
        raise ValueError("Two source years of finite seasonal training rows required")
    model = HistGradientBoostingRegressor(loss="poisson", max_iter=120, max_leaf_nodes=8,
        min_samples_leaf=20, learning_rate=.04, l2_regularization=5, random_state=42)
    model.fit(matrix[valid], data.DC_QC.to_numpy()[valid])
    candidates = {}
    for name, config in XGBOOST_CANDIDATES.items():
        xgboost = XGBRegressor(objective="count:poisson", tree_method="hist", n_estimators=160,
            max_depth=3, min_child_weight=20, learning_rate=.04, reg_lambda=5,
            subsample=.9, colsample_bytree=1, random_state=42, n_jobs=2)
        weights = None if config["halfLifeYears"] is None else np.power(.5,
            (data.index.max() - data.index.to_numpy()[valid]) / (52 * config["halfLifeYears"]))
        xgboost.fit(matrix[valid] if config["weather"] else matrix[valid, :4],
                    data.DC_QC.to_numpy()[valid], sample_weight=weights)
        candidates[name] = xgboost
    return {"model": model, "xgboostModel": candidates["weather_all_years"],
        "xgboostCandidates": candidates, "xgboostVariant": "weather_all_years",
        "history": data, "lastTrainingBlock": int(data.index.max()), "trainingRows": int(valid.sum())}


def weather_analog(history, week, profile="typical"):
    if profile not in PROFILES:
        raise ValueError("Unknown historical weather profile")
    delta = abs(history.WN - week)
    pool = history.loc[np.minimum(delta, 52 - delta) <= 2].dropna(subset=WEATHER)
    if pool.empty:
        raise ValueError("Missing historical weather analog support")
    column, quantile = PROFILES[profile]
    pool = pool.sort_values([column, "YR", "WN"], kind="stable")
    return pool.iloc[round((len(pool) - 1) * quantile)]


def predict_weeks(engine, weeks, profile="typical", target_year=None):
    history = engine["history"]
    x = seasonal_features(weeks)
    analogs = {(week, lag): weather_analog(history, (int(week) - lag - 1) % 52 + 1, profile)
               for week in set(weeks) for lag in LAGS}
    for column in WEATHER:
        for lag in LAGS:
            x = np.column_stack([x, [float(analogs[(w, lag)][column]) for w in weeks]])
    boosted = np.maximum(0, engine["model"].predict(x)).tolist()
    candidates = {name: np.maximum(0, model.predict(x if XGBOOST_CANDIDATES[name]["weather"] else x[:, :4])).tolist()
                  for name, model in engine["xgboostCandidates"].items()}
    xgboost = candidates[engine["xgboostVariant"]]
    baseline = []
    for week in weeks:
        delta = abs(history.WN - week)
        baseline.append(float(history.loc[np.minimum(delta, 52 - delta) <= 2, "DC_QC"].mean()))
    if any(not math.isfinite(v) or v < 0 for v in [*boosted, *xgboost, *baseline]):
        raise ValueError("Invalid seasonal case estimate")
    return {"seasonal_xgboost": xgboost, "seasonal_boosted_trees": boosted, "seasonal_baseline": baseline,
            **{"xgboost_" + name: values for name, values in candidates.items()}}


def residual_paths(records, target_week, selected_model, cutoff_block, length=4):
    lookup = {r["block"]: r for r in records if r["block"] <= cutoff_block}
    paths = []
    for block, record in sorted(lookup.items()):
        week = block % 52 + 1
        if min(abs(week - target_week), 52 - abs(week - target_week)) > 4:
            continue
        if all(block + h in lookup for h in range(length)) and len({lookup[block + h].get("lastTrainingBlock") for h in range(length)}) == 1:
            paths.append({"originBlock": block - 1, "lastTargetBlock": block + length - 1,
                "residuals": [lookup[block + h]["observed"] - lookup[block + h][selected_model] for h in range(length)]})
    if len(paths) < 20:
        raise ValueError("Insufficient completed seasonal calibration paths")
    return paths


def project_days(engine, start, profile, selected_model):
    schedule = day_schedule(start, 28)
    dates = [day for day, _, _ in schedule]
    weeks = [source_week(d) for d in dates]
    values = predict_weeks(engine, weeks, profile)[selected_model]
    return [{"date": day.isoformat(), "sourceWeekAssumption": week, "sourceBlockDays": divisor, "meanCases": value / divisor}
            for (day, _, divisor), week, value in zip(schedule, weeks, values)]


def daily_residual_paths(records, start, selected_model, cutoff_block, length=28):
    schedule = day_schedule(start, length)
    first_block = schedule[0][1]
    offsets = [(block - first_block, divisor) for _, block, divisor in schedule]
    paths = residual_paths(records, source_week(start), selected_model, cutoff_block,
                           length=max(i for i, _ in offsets) + 1)
    return paths, [{"lastTargetBlock": p["lastTargetBlock"],
        "errors": [p["residuals"][i] / divisor for i, divisor in offsets]} for p in paths]

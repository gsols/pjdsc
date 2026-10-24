"""Past-only annual barangay burden forecasting; never weekly hotspot observations."""
import math

import numpy as np
from xgboost import XGBRegressor

VERSION = "qc-barangay-xgboost-two-year-v1"
TOP_COUNT = 10


def annual_features(record, cutoff):
    values = [record.get(f"DC_{cutoff - lag}") for lag in range(5)]
    known = [float(v) for v in values if v is not None]
    if any(not math.isfinite(v) or v < 0 for v in known):
        raise ValueError("Invalid past annual barangay evidence")
    if not known:
        raise ValueError("Insufficient past annual barangay evidence")
    # Missing annual values remain NaN, explicitly handled by XGBoost, not zero.
    return [float(v) if v is not None else np.nan for v in values] + [
        float(np.mean(known)), float(np.std(known)), known[0], len(known),
        *[float(v is None) for v in values],
    ]


def train_annual_model(records, cutoff):
    x, y, last_labels = [], [], []
    # A two-year lead preserves the declared extra full-year publication lag.
    for target in range(2014, cutoff + 1):
        for record in records:
            actual = record.get(f"DC_{target}")
            if actual is None:
                continue
            if not math.isfinite(actual) or actual < 0:
                raise ValueError("Invalid annual training label")
            try:
                features = annual_features(record, target - 2)
            except ValueError as error:
                if str(error).startswith("Insufficient past"):
                    continue
                raise
            x.append(features); y.append(actual); last_labels.append(target)
    if len(y) < 200:
        raise ValueError("Insufficient past-only annual training rows")
    model = XGBRegressor(objective="count:poisson", tree_method="hist", n_estimators=140,
        max_depth=3, min_child_weight=20, learning_rate=.04, reg_lambda=8,
        subsample=1, colsample_bytree=1, random_state=42, n_jobs=2)
    model.fit(np.asarray(x, dtype=float), np.asarray(y, dtype=float))
    return model, {"trainingRows": len(y), "lastTrainingLabelYear": max(last_labels),
                   "trainingFeatureRule": "Each target year uses only annual features through target minus two"}


def predict_annual_burden(model, records, cutoff):
    values = model.predict(np.asarray([annual_features(record, cutoff) for record in records], dtype=float))
    if any(not math.isfinite(float(v)) or v < 0 for v in values) or sum(values) <= 0:
        raise ValueError("Invalid annual burden predictions; no uniform fallback")
    total = sum(float(v) for v in values)
    rows = [{"barangayId": record["ADM4_PCODE"], "predictedAnnualCases": float(value),
             "weight": float(value) / total, "measurementKind": "forecast"} for record, value in zip(records, values)]
    rows.sort(key=lambda row: (-row["predictedAnnualCases"], row["barangayId"]))
    for rank, row in enumerate(rows, 1):
        row["burdenRank"] = rank
        row["isHighBurdenCandidate"] = rank <= TOP_COUNT and row["predictedAnnualCases"] > 0
    return rows


def evaluate_annual(rows, records, target, cutoff):
    known = {r["ADM4_PCODE"]: r for r in records if r.get(f"DC_{target}") is not None}
    if not known:
        return []
    observed = {ident: float(r[f"DC_{target}"]) for ident, r in known.items()}
    predictions = {"xgboost": {r["barangayId"]: r["predictedAnnualCases"] for r in rows},
                   "last_known_annual": {}, "past_five_year_mean": {}}
    for ident, record in known.items():
        features = annual_features(record, cutoff)
        predictions["last_known_annual"][ident] = features[7]
        predictions["past_five_year_mean"][ident] = features[5]
    actual_top = set(sorted(observed, key=lambda ident: (-observed[ident], ident))[:TOP_COUNT])
    scores = []
    for name, predicted in predictions.items():
        errors = [predicted[ident] - actual for ident, actual in observed.items()]
        top = set(sorted(observed, key=lambda ident: (-predicted[ident], ident))[:TOP_COUNT])
        scores.append({"targetYear": target, "featureCutoffYear": cutoff, "model": name,
            "n": len(observed), "maeAnnualCases": float(np.mean(np.abs(errors))),
            "rmseAnnualCases": float(np.sqrt(np.mean(np.square(errors)))),
            "top10Overlap": len(actual_top & top), "topCount": TOP_COUNT,
            "evaluation": "Annual reported burden among matched observed-target barangays; not weekly outbreak detection"})
    return scores

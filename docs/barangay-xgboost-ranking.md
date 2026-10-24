# XGBoost annual barangay burden ranking

Implemented 2026-10-25 following the user's correction that positive demand in
every barangay must not mark every barangay as a hotspot.

The original workspace used the latest complete observed annual shares to allocate
QC cases. Its XGBoost model forecast QC-wide seasonal cases only. The active
workspace now additionally uses a separate XGBoost annual barangay-burden regressor.

## Definition and limits

The orange markers identify the **ten highest predicted annual case burdens**.
This is a predeclared research ranking of high-burden candidates, not a statistical
spatial-cluster test, population-adjusted incidence rate or confirmed weekly outbreak.
All other barangays remain neutral and unmarked, even when they have positive
projected demand or are selected for inspection. Hospital markers are separate.

Annual predictions are normalized into shares for dated QC weekly/daily case
forecasts. Total QC demand is conserved; case and bed calculations still include
all 142 barangays. Spatial-model uncertainty is not included in the city case ranges.
For future windows the ranking remains dated to the forecast issue year, rather
than pretending that annual labels exist for every requested future month/year.

## Source and timing

The immutable audited QC annual CSV has 142 barangays and 2010–2025 case columns,
including null observations. `DC_Mean` is excluded because it can summarize future
years. No patient admissions, microclimate or population data are invented.

Under the existing additional-full-year publication-lag assumption, issue year Y
uses source labels/features only through Y−2. Training examples for annual target T
use features only through T−2; training labels do not exceed the issue cutoff.
Features are the last five annual counts, known-history mean/standard deviation,
latest known count, count of available years and missingness flags. Missing labels
are excluded and missing past features remain NaN, not observed zeros.

The pooled `XGBRegressor(count:poisson, tree_method=hist)` uses a fixed seed, depth,
regularization and bounded threads, with no tuning on evaluation years. The
requested XGBoost model is compared against last-known annual counts and a past
five-year mean on matched observed targets.

## Retrospective evidence

| Target year | Model | Annual-case MAE | Observed top-ten locations recovered |
|---|---|---:|---:|
| 2024 | XGBoost | 29.25 | 6/10 |
| 2024 | Last known annual | 35.22 | 7/10 |
| 2024 | Past five-year mean | 29.15 | 7/10 |
| 2025 | XGBoost | 44.34 | 7/10 |
| 2025 | Last known annual | 50.76 | 7/10 |
| 2025 | Past five-year mean | 48.03 | 8/10 |

Both years have 142 observed target barangays. Earlier incomplete targets use only
matched observed rows and never replace null labels with zero. These are annual
retrospective comparisons, not prospective weekly-hotspot validation. The baseline
can outperform XGBoost on the ranking metric; no superiority claim is justified.

## Artifacts and reproduction

```powershell
python scripts/train_qc_barangay.py
python -m pytest -q services/engine/tests/test_barangay_xgboost.py
```

Outputs under `data/processed/upri_noah/` are `qc-barangay-xgboost.json`, its
`qc-barangay-xgboost-manifest.json` and the ignored local model dictionary
`qc-barangay-xgboost-model.joblib`. The manifest records original source hashes,
model/output hashes, transform/code hashes and software versions. Code and JSON use
pinned LF bytes. Loading fails closed on mismatch with a typed
`BARANGAY_RANKING_UNAVAILABLE` error; there is no historical-share fallback.

Context schema 1.2 includes `hotspotRanking`, per-barangay annual predictions/ranks
and membership. Saved scenarios include the spatial artifact checksum. Original
observed annual counts remain separately labeled and nullable. Older legacy radial
stress-test APIs retain their explicit historical-share assumptions.

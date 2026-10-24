# Historical and future simulation workspaces

User extension recorded 2026-10-24 21:19:03 +08:00 (Asia/Manila).

The left sidebar at `/outbreak-response` (also reached from `/simulate`) has
Historical replay and Future surge forecast tabs. Each retains its own controls.
Both support whole-day horizons from 1 through 28, with 2/7/12/14/28 shortcuts.
The future tab defaults to the current QC date, accepts later dates through 2035,
and provides a month picker for seasonal planning, such as January 2027. Backend
validation derives the exclusive end from start plus horizon and rejects past dates,
untrusted case arrays, facility registers, NCR scope and unsupported live mode.

## Future seasonal engine

The current bed-demand percentage is expected dengue bed demand / scenario-assumed
dengue slots × 100. It is calculated before diversions, can exceed 100%, and is
null if no dengue slots are assumed. It is distinct from assumed patient-choice
shares and post-placement modeled occupancy. Nearby cards and the right sidebar
show the ratio explicitly; it never represents verified current bed availability.

### Current v2 update — XGBoost, 2026-10-25

The current future case model is `seasonal_xgboost` using pinned XGBoost 3.1.3,
`XGBRegressor`, `count:poisson`, CPU `hist`, fixed seed and bounded threads. The
official [Python API reference](https://xgboost.readthedocs.io/en/release_3.1.0/python/python_api.html)
documents the estimator. It uses the same audited QC data, past-only features,
training-only weather analogs and 2018–2025 expanding year folds. Raw files are
unchanged. Historical replay retains its previously audited environmental runs.

XGBoost is an explicit user choice, not the calibration winner. Pre-2024 MAE is
65.15 for XGBoost, 64.28 for original boosting and 65.88 for the seasonal baseline.
2024/2025 XGBoost MAE is 79.06/112.94 versus baseline 74.43/110.75. Experimental
80%-target range coverage is 76.92%/55.77%. Report/manifest record the comparison,
requested model, software and source/code hashes. There is no superiority claim.

Required beds are **not a directly trained XGBoost occupancy model**: no observed
admissions, LOS or census labels are available. XGBoost supplies conditional future
cases, then configured admission fraction/delay/LOS produces bed-demand curves.
The workspace defaults to equal arrival shares across the nearest three assumed
eligible hospitals; a nearest-only comparator remains available. Per-place/hospital
outputs show baseline and surge demand, expected admissions, additional required
staffing and finite-capacity shortfall. Staffed supply/vacancy remains unknown.
Extra surge staffing compares whole-bed requirements with the no-added-surge
counterfactual on the same day; it does not round a fractional difference into an
extra bed when baseline rounding already covers that demand. Reported peak extra
staffing is the largest such daily increment, which need not equal the difference
between two peaks occurring on different days.
This supersedes the original v1 implementation description below.

### Original v1 implementation and evaluation history

`scripts/train_qc_seasonal.py` checks the original audit/source hashes first. It
preserves the workbook and trains on QC `YR`/`WN` observations from 2010–2025.
The original v1 compared an existing scikit-learn histogram gradient boosting
Poisson model with a within-season historical mean. V2 additionally requires XGBoost.
Features comprise seasonal harmonics and lag-1/2/4 rainfall, temperature and
humidity. Future inputs use labeled historical weather analogs selected from
past within-season rows; they are assumptions, not operational weather forecasts.
The saved run records the exact source analog year, week and raw values for
each target-week/lag feature. Current-case lags are omitted because current cases
are unavailable. QC and NCR remain separate forecasting scopes.

Expanding year holdouts cover 2018–2025. Selection is frozen using calibration
MAE on 2018–2023 before evaluation on 2024–2025. Boosting was selected (64.28 vs
65.88 cases/week calibration MAE). However, the baseline performs better on both
later held-out years: selected-model MAE 83.34/118.74 versus baseline
74.43/110.75 in 2024/2025. Selected-model experimental 80%-target range coverage
is 75%/53.85%. The UI exposes these results; no superiority or prospective
accuracy claim is justified. Ranges use completed pre-2024 season-matched
residual paths and are experimental, including for alternative weather profiles.

The final approved model is refit through 2025. `/v1/future-simulation` creates a
new curve for the requested season; it does not relabel the last historical
forecast. Requested days map to Jan-1-based 52 source blocks, explicitly an
assumption because source calendar metadata remain unresolved. Daily values
are weekly predictions divided by seven, not weekly barangay observations.
Optional surge onset, ramp and 1–10x multiplier scale that seasonal curve.
Fixed prior annual barangay weights allocate QC totals without claiming a
calibrated transmission process or localized measured climate.

## Bed-demand forecast

For interval cases `C[t]`, admission fraction `q`, delay `D` and length of stay
`L`, required dengue beds at snapshot `t` are the sum of `q*C[k-D]` for the most
recent `L` arrival intervals. Admissions before the window are zero by explicit
assumption. Staffing requirements round expected bed demand up to whole beds.
This unconstrained need can exceed assumed supported capacity. The existing
cohort/placement engine separately reports supported census, holding, discharges
and unresolved demand under finite normal/surge resources.

Low/high case paths produce bed-demand sensitivity curves with the same fixed
admission fraction, LOS, delay and capacities. These are not validated hospital
occupancy confidence intervals. The UI shows daily demand, peak staffing, peak
additional beds and per-hospital nearest-catchment demand before diversions.
Nearest catchments use provisional points and polygon representative points,
not actual observed admissions or clinical referral routes. Network staffing
shortfall does not prove geographic shortfalls can be resolved without transfer;
per-hospital demand and placement/overflow remain available separately.

The only active hospital inventory is the 46-record PhilHealth QC layer.
Accredited beds are source metadata; eligibility, operational capacity and actual
occupancy remain unknown. Editable scenario capacities are explicit assumptions.
No real vacancies or bed forecast performance are inferred from accreditation.

## Reproduction and provenance

```powershell
$env:OMP_NUM_THREADS='2'
$env:LOKY_MAX_CPU_COUNT='2'
python scripts/train_qc_seasonal.py
python -m pytest -q
python scripts/smoke_qc_workspace.py --web-url http://127.0.0.1:3000
```

The seasonal manifest records original source URLs/commit IDs/checksums,
transformation and training code hashes, model/report checksums, cutoff and
software versions. Model loading fails closed on source, code, software or hash
mismatch. Saved forecast runs include exact daily inputs and residual evidence;
saved movies include the forecast/model hashes, bed-engine code, assumptions,
timestamp and content hash. Model binaries and scenario results are local ignored
artifacts, regenerated from audited raw files. See `docs/SESSION_HANDOFF.md` for
the current verification checkpoint and `docs/qc-simulation-workspace.md` for
historical workspace methods.

### Windows artifact validation repair (2026-10-24)

The prior seasonal manifest pinned a CRLF validation report while Git stored LF
bytes; Windows checkout also converted the two hash-pinned Python files to CRLF.
Both changes invalidated byte hashes without changing data or model behavior.
The training script now publishes JSON as explicit UTF-8/LF bytes with atomic
replacement, publishes the model atomically and writes the manifest last.
`.gitattributes` pins the training/domain code to LF. Rebuild with the command
above after an actual code/source/software change; validation remains strict and
never substitutes historical curves or another model. The regenerated model
reproduces the previous checksum and evaluation results.

`/readiness` includes `seasonalForecast.ready` and safe failure diagnostics.
Future workspace artifact failures return HTTP 503 with
`SEASONAL_ARTIFACTS_UNAVAILABLE`, the failed validation category and the rebuild
command. The reload button retries the active tab's current dates and controls.

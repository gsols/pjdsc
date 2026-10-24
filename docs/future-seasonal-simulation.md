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

`scripts/train_qc_seasonal.py` checks the original audit/source hashes first. It
preserves the workbook and trains on QC `YR`/`WN` observations from 2010–2025.
It compares an existing scikit-learn histogram gradient boosting Poisson model
with a within-season historical mean. No additional XGBoost dependency is needed.
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

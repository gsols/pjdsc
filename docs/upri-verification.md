# UPRI integration verification — 24 October 2026

## Cross-platform newline recovery

On 24 October 2026, a macOS checkout failed `/v1/qc-simulation` with 503 because
Git had stored LF versions of files whose manifests pinned CRLF bytes. Eleven
files were affected: two raw text sources, seven processed JSON artifacts and
the public QC annual table and barangay geometry. In every case, changing only
line endings reproduced the existing SHA-256 exactly. Those original bytes were
restored without changing data values, forecast results, expected hashes, source
metadata or model configuration. No training or source download was required.

`.gitattributes` now disables Git text conversion for UPRI sources, references,
processed artifacts and the three public UPRI-derived JSON/GeoJSON files. Git
clean filtering was checked with `core.autocrlf=false`, `input` and `true`.
All 17 pinned input/output files match their unchanged fingerprints.

Executed after recovery: Python compilation and all **36 Python tests** passed;
the running engine returned **200** for `GET /v1/qc-simulation`. Regression checks
cover all processed manifest outputs and reject both newline-only and
numeric-value mutations of a synthetic source fixture. Runtime verification
still hashes exact bytes and fails closed on mismatches. This repair does not
resolve the scientific/operational limitations recorded below.

The **13 frontend tests** and running frontend/engine HTTP smoke also passed,
including 7/14/28-day windows, all 142 barangays and 46 hospitals, same-input
allocation comparison and rejection of non-QC simulation scope.

## Earlier integration verification

The later animated simulation extension passes **26 Python tests, 9 Node tests,
a clean production build and the running web/engine HTTP smoke**. See
[movie verification and methods](simulation-movie.md) and the timestamped
[request log](change-request-log.md). The table below records the earlier
UPRI integration checks and their original counts; it is retained as audit history.

Executed against the supplied raw data and pinned upstream reference report:

| Check | Result |
|---|---|
| Six raw files vs pinned upstream Git blobs | Exact matches; unchanged SHA-256s |
| Separate official validation report | Retrieved, pinned and reviewed; stale schema discrepancies recorded |
| Python compilation | Passed |
| Python tests | 20 passed, including invalid schema, missing observations, feature/label leakage, annual cutoff, conservation, overflow, direct API body limits and QC/NCR scope guards |
| Locked frontend install | Passed using `npm.cmd ci --no-audit --no-fund` |
| Frontend lint | Passed |
| TypeScript | Passed |
| Node tests | 7 passed, including annual null/schema handling, BFF body limits, blocked engine, error forwarding and inventory integrity |
| Production build | Passed; `/research` and `/api/research/[...path]` generated |
| Actual built web + running engine HTTP smoke | Passed: 142 annual rows/polygons, QC/NCR runs, modeled spatial conservation, days 0/7/14/28, persisted scenario retrieval, NCR rejection, legacy guard |
| Browser interaction / visual QA | Not performed: Browser skill found no connected browser |
| Original R validation rerun | Not performed: R unavailable; Python checks are separate, not equivalent to the full environmental workflow |

Twenty tests include a synthetic 135-arrival flow fixture: 100 normal placements,
30 supported surge placements, 5 unstaffed holding; 130% normal staffed occupancy,
100% supported occupancy, 135% on-site headcount relative to normal. These are
test assumptions, not observed patients or hospital capacity.

New model evidence uses eight predeclared expanding quarterly origins per area
and 1–4 source-block horizons, with matched persistence/seasonal/cases/weather
comparisons. At QC horizon 1, cases-only MAE is approximately 50.80 versus 45.50
for persistence; at horizon 4, approximately 125.20 versus 96.25. This small
retrospective comparison does not support a consistent model superiority claim.
Per-horizon RMSE, high-count metrics, sample sizes and predictions are in
`data/processed/upri_noah/backtest.json`. Predictive interval coverage is null,
not a claimed calibrated estimate. Annual share holdouts are separate from
weekly forecasting and are returned by `/v1/research-evidence`.

Exact calendar dating, historical publication latency, clinical eligibility,
staffed capacity, observed admissions and calibrated hospital uncertainty remain
unresolved. All replay capacities are explicitly hypothetical, with relative
days and the 2026 PhilHealth registry used as a planning network. No optimizer
or dedicated outbreak lab is implemented by this integration.

Reproduction and a three-minute walkthrough are in the repository README.
Run `python scripts/smoke_upri.py --web-url http://127.0.0.1:3001` after starting
the engine on port 8001 and the built frontend on 3001 with
`ENGINE_BASE_URL=http://127.0.0.1:8001`.

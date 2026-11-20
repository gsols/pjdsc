# Render frontend and engine connection

The Next.js frontend and FastAPI engine run as separate services. The frontend
uses its server-only `ENGINE_BASE_URL` to contact the engine. Set it in the
frontend service's Render environment to `https://surgewise.onrender.com`, then
redeploy the frontend. Do not append `/v1`, `/health` or `/docs`, or add `NEXT_PUBLIC_`.
Free engines require their public URL: they cannot receive private-network
traffic. The frontend must run as a Next.js web service to serve its API routes.

Render's [free-service documentation](https://render.com/docs/free) states that
free web services sleep after 15 minutes without inbound traffic and take about
one minute to wake on a request. An environment variable only supplies an address;
an actual request is needed to wake the engine. Previously `/` redirected to a
static-data dashboard that never contacted the engine. Only simulation/research
pages ran the wake-up checks.

## Automatic wake-up

The shared root layout now mounts `EngineStartup`, which checks
`/api/engine/health` immediately when any page opens, including `/dashboard`.
A connection notice clears on success; failures offer a retry button without
blocking the hospital dashboard. Simulation/research requests still check
liveness themselves, since the engine may sleep again after a long visit.
This server route contacts the configured engine's
`/health`, with an eight-second request timeout and no caching. The browser
retries liveness checks at three-second intervals after each failed attempt, for
at most two minutes total, including request time. It displays connection/startup
status while waiting. No engine URL is exposed to the browser.

Once the engine answers `{"status":"ok"}`, the requested forecast/data fetch or
simulation proceeds. Simulation POSTs are sent once, never automatically replayed
after errors. Existing research request timeouts and data/model validation remain
in effect. A live process is not evidence that forecasts, model artifacts or
hospital assumptions are ready; those endpoints still return their own errors.

Pending requests stop on workspace changes or unmount. Timeout and configuration
failures show an error; the QC simulation workspace retains its reload action.
Polling stops after success or failure. This is on-demand startup handling, not
a periodic keep-alive service. Slow/crashing or suspended services can still fail.

## Deployment and verification

Deploy these frontend changes with the correct `ENGINE_BASE_URL`. No engine
source change is required for wake-up; its existing `/health` endpoint is used.
If configuring the engine from this repository, leave Render's Root Directory
blank so `services` imports and shared approved data paths remain accessible:

```sh
# Engine build command, from repository root
pip install -r services/engine/requirements.txt && python scripts/train_qc_seasonal.py && python scripts/train_qc_barangay.py
# Engine start command, from repository root
python -m uvicorn services.engine.main:app --host 0.0.0.0 --port $PORT
```

See Render's [FastAPI deployment guide](https://render.com/docs/deploy-fastapi).
For the frontend, use Root Directory `apps/web`, build `npm ci && npm run build`,
and start `npm start -- --hostname 0.0.0.0 --port $PORT`.

Both trained `.joblib` files are intentionally excluded from Git. Installing
Python dependencies alone does **not** prepare a working forecasting deployment.
The two training commands above generate models and matching manifests in the
same installed Python environment used at runtime. All audited raw/reference
inputs and processed prerequisites must be present. Keep generated model files
in the deployment image; do not train at each request or service startup.
Setting `OMP_NUM_THREADS=2` and `LOKY_MAX_CPU_COUNT=2` on the engine limits worker
parallelism, but available memory/build resources still need verification.

For local Next.js, create `apps/web/.env.local` using `.env.example`, set the
desired engine URL there and restart Next.js. A `.env` in this repository's root
or only on the Python service does not configure the `apps/web` Next.js service.

Use these endpoints to distinguish the failure:

| Endpoint | Meaning |
| --- | --- |
| Frontend `/api/engine/health` returns `{"status":"ok"}` | The deployed frontend read its configuration and successfully contacted the engine. |
| Frontend returns `ENGINE_NOT_CONFIGURED` | Missing/invalid `ENGINE_BASE_URL` on that frontend service. |
| Frontend returns `ENGINE_STARTING` | The configured engine has not returned valid health JSON yet; it may be waking, unreachable or failing. |
| Frontend health is 404 or returns frontend HTML | The deployed frontend lacks the API route, is stale, or is hosted as a static site. |
| Engine `/readiness` reports workspace flags false | Inspect model/source blockers; waking alone cannot repair them. |

`/readiness` deliberately keeps its top-level `ready` false because operational
data/calendar limitations remain. Check `qcWorkspaceReady`, `futureWorkspaceReady`,
`seasonalForecast` and `barangayRanking` for the research workspaces instead.

To verify a cold start, leave the free engine idle for at least 15 minutes, then
open `/` without opening its engine URL first. Expect the dashboard's connection
notice and requests to `/api/engine/health` in the browser Network panel. Then
open `/outbreak-response` and expect the workspace or an actionable model/data
error. `/api/engine/health` diagnoses connectivity; engine `/readiness`
diagnoses available artifacts. Health success alone does not certify simulations.

An engine service on a paid compute instance avoids free-tier idle sleep; see
the free-service documentation. The automatic wake-up flow accommodates sleep
while preserving the possible startup wait.

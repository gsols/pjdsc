# Render frontend and engine connection

The Next.js frontend and FastAPI engine run as separate services. The frontend
uses its server-only `ENGINE_BASE_URL` to contact the engine. Set it in the
frontend service's Render environment to the actual engine base URL, for example
`https://YOUR-ACTUAL-ENGINE.onrender.com`, then redeploy the frontend. Do not use
the placeholder literally, append `/v1` or `/docs`, or add `NEXT_PUBLIC_`.
Free engines require their public URL: they cannot receive private-network
traffic. The frontend must run as a Next.js web service to serve its API routes.

Render's [free-service documentation](https://render.com/docs/free) states that
free web services sleep after 15 minutes without inbound traffic and take about
one minute to wake on a request. Opening the frontend alone does not start the
engine. Previously a single research request timed out after 20 seconds, leaving
users to open the engine URL separately and reload the frontend.

## Automatic wake-up

Opening the QC simulation workspace or loading engine data in `/research` now
checks `/api/engine/health`. This server route contacts the configured engine's
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
# Engine build command (additional audited model/data preparation is separate)
pip install -r services/engine/requirements.txt
# Engine start command, from repository root
python -m uvicorn services.engine.main:app --host 0.0.0.0 --port $PORT
```

See Render's [FastAPI deployment guide](https://render.com/docs/deploy-fastapi).
For the frontend, use Root Directory `apps/web`, build `npm ci && npm run build`,
and start `npm start -- --hostname 0.0.0.0 --port $PORT`.

To verify a cold start, leave the free engine idle for at least 15 minutes, then
open `/outbreak-response` without opening its engine URL first. Expect the
connection/startup status and then the normal workspace or an actionable model/
data error. `/api/engine/health` diagnoses connectivity; engine `/readiness`
diagnoses available artifacts. Health success alone does not certify simulations.

An engine service on a paid compute instance avoids free-tier idle sleep; see
the free-service documentation. The automatic wake-up flow accommodates sleep
while preserving the possible startup wait.

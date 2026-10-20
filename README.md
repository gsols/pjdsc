# PJDSC — NCR Dengue Intelligence

Map-first prototype for NCR/Quezon City dengue forecasting, hospital-demand simulation and LGU decision support.

## Current status

**Milestone 1 scaffold.** Next.js/MapLibre dashboard and FastAPI service skeleton are added. Geographic boundaries, DOH hospitals and trained forecasts are **not yet imported**. Simulations are blocked until valid inputs exist. No fabricated patient or bed data are shipped.

## Web application

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000/dashboard.

## Python engine

```bash
cd services/engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Project layout

- `apps/web`: Next.js / MapLibre UI and API routes
- `services/engine`: Python/FastAPI service stub
- `docs/data-sources.md`: source verification and import contract
- `apps/web/public/data/facilities.json`: empty array awaiting verified DOH facility records

## Next actions

1. Import licensed, verified NCR polygons as `apps/web/public/data/ncr-cities.geojson` and normalize `properties.area_id`.
2. Import DOH NCR hospital coordinates and capacity data.
3. Train/evaluate dated QC/NCR forecasts; then connect simulation outputs.
4. Implement and test daily occupancy math, facility allocation, and LGU guidance rules.

**Not real-time surveillance or hospital vacancy tracking.** Original dengue observations end in 2025.

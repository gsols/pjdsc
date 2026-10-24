# Data source and ingestion contract

## NCR city/municipality polygons

Obtain a licensed, verified NCR city/municipality GeoJSON (all 16 cities and Pateros).
Suggested upstream: https://github.com/faeldon/philippines-json-maps
Use the documented source attribution and verify geographic validity/PSGC mapping. Save a filtered FeatureCollection as `apps/web/public/data/ncr-cities.geojson`.

Each feature must expose a normalized `properties.area_id` such as `QUEZON_CITY`, `MAKATI`, or `PATEROS`. The app deliberately does not use fabricated NCR geometry.

## Hospital facilities

Source: DOH National Health Facility Registry. Verify hospital eligibility, coordinates and authorized bed counts individually.
Store `apps/web/public/data/facilities.json` as an array satisfying `apps/web/lib/types.ts`. It begins empty. Missing bed counts must remain null.

## Cases and meteorology

The available NCR regional and dedicated Quezon City weekly dengue and environmental observations are historical, ending in 2025. Preserve the original file and provenance; do not imply a live 2026 dengue forecast.
Forecast runs must be dated and evaluated with chronological backtesting before they become accessible to simulations.

## Simulation

A real simulator requires case trajectory + verified operational capacity or clearly labeled occupancy assumptions. Its API is currently guarded rather than substituting made-up inputs.

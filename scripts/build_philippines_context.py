"""Publish geometry-only Philippines context from the audited UPRI split archive."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

import geopandas as gpd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from services.engine.upri_data import verify_sources, sha256


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "data/reference/DC_Regional-Brgy.gpkg")
    parser.add_argument("--output", type=Path, default=ROOT / "apps/web/public/data/philippines-context.geojson")
    args = parser.parse_args()
    sources = verify_sources()
    audit = json.loads((ROOT / "data/processed/upri_noah/geometry-audit.json").read_text())
    if sha256(args.input) != audit["extractedSha256"]:
        raise ValueError("GeoPackage differs from audited split-archive extraction")
    frame = gpd.read_file(args.input, layer="PH_REGIONS")
    if len(frame) != 17 or frame.crs.to_epsg() != 32651 or not frame.is_valid.all():
        raise ValueError("Regional geometry incomplete/invalid")
    # Display-only 100 m topology-preserving simplification. No surveillance values.
    frame = frame[["ADM1_EN", "ADM1_PCODE", "geometry"]].copy()
    frame.geometry = frame.geometry.simplify(100, preserve_topology=True)
    frame = frame.to_crs(4326)
    if not frame.is_valid.all():
        raise ValueError("Invalid simplified context geometry")
    args.output.write_text(frame.to_json(), encoding="utf-8")
    manifest = {"schemaVersion": "1.0", "role": "GEOGRAPHIC_CONTEXT_ONLY_NOT_SIMULATION_COVERAGE", "coverage": "Philippines regional polygons; simulation remains QC only",
        "sources": sources, "sourceGpkgSha256": sha256(args.input), "sourceLayer": "PH_REGIONS",
        "transformedAt": datetime.now(timezone.utc).isoformat(), "sourceCrs": "EPSG:32651", "outputCrs": "EPSG:4326",
        "transformations": ["Drop all regional dengue attributes", "Simplify at 100 m preserving topology", "Reproject EPSG:4326"],
        "features": 17, "outputSha256": sha256(args.output), "codeSha256": sha256(__file__)}
    (ROOT / "data/processed/upri_noah/philippines-context-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("Published 17-region Philippines context; QC-only simulation scope unchanged.")


if __name__ == "__main__":
    main()

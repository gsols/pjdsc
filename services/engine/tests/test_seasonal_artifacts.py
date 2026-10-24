"""Regression coverage for missing/stale artifacts; no alternative model is allowed."""
import json
import shutil

from fastapi.testclient import TestClient
import pytest

from scripts.train_qc_seasonal import publish_json
from services.engine.main import app
from services.engine.repositories import seasonal_runs as repository


@pytest.mark.parametrize("fault,reason", [
    ("missing", "missing artifact"),
    ("model", "model checksum mismatch"),
    ("report", "validation report checksum mismatch"),
    ("code", "training code checksum mismatch"),
    ("software", "software mismatch"),
    ("source", "source mismatch"),
])
def test_seasonal_failure_is_actionable_and_does_not_break_historical(monkeypatch, tmp_path, fault, reason):
    for name in ["qc-seasonal-model.joblib", "qc-seasonal-validation.json", "qc-seasonal-manifest.json"]:
        shutil.copyfile(repository.FOLDER / name, tmp_path / name)
    manifest_path = tmp_path / "qc-seasonal-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    if fault == "missing":
        (tmp_path / "qc-seasonal-model.joblib").unlink()
    elif fault in {"model", "report"}:
        manifest["modelSha256" if fault == "model" else "validationSha256"] = "0" * 64
    elif fault == "code":
        manifest["codeHashes"][next(iter(manifest["codeHashes"]))] = "0" * 64
    elif fault == "software":
        manifest["software"]["sklearn"] = "unapproved-version"
    else:
        manifest["sources"] = {}
    publish_json(manifest_path, manifest)
    monkeypatch.setattr(repository, "FOLDER", tmp_path)
    with pytest.raises(repository.SeasonalArtifactError, match=reason):
        repository.approved_model()
    client = TestClient(app)
    response = client.get("/v1/future-simulation")
    assert response.status_code == 503
    detail = response.json()["detail"]
    assert detail["code"] == "SEASONAL_ARTIFACTS_UNAVAILABLE"
    assert reason in detail["message"]
    assert "python scripts/train_qc_seasonal.py" in detail["message"]
    readiness = client.get("/readiness").json()
    assert readiness["seasonalForecast"]["ready"] is False
    assert readiness["historicalSourceBlockReplayReady"] is True


def test_generated_json_uses_exact_lf_bytes_and_atomic_replace(tmp_path):
    path = tmp_path / "report.json"
    publish_json(path, {"measurementKind": "forecast"})
    assert path.read_bytes() == b'{\n  "measurementKind": "forecast"\n}\n'
    publish_json(path, {"replacement": True})
    assert json.loads(path.read_bytes()) == {"replacement": True}
    assert list(tmp_path.iterdir()) == [path]

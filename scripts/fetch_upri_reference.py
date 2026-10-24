"""Fetch reference metadata/report only; never write into data/raw."""
import hashlib
import json
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
REPO = "pelitro-rcw/dengue-environmental-dataset"
COMMIT = "02926278d570db8950da368d44db544ae0097615"


def main():
    folder = ROOT / "data/reference/upri_noah"
    folder.mkdir(exist_ok=True)
    with urlopen(f"https://api.github.com/repos/{REPO}/git/trees/{COMMIT}?recursive=1", timeout=30) as response:
        tree = json.load(response)
    entries = {item["path"]: item for item in tree["tree"]}
    sources = []
    for path in sorted((ROOT / "data/raw/upri_noah").iterdir()):
        raw = path.read_bytes()
        blob = hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()
        matched = entries.get(path.name, {}).get("sha") == blob
        sources.append({"path": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(raw).hexdigest(),
                        "sourceUrl": f"https://github.com/{REPO}/blob/{COMMIT}/{quote(path.name)}",
                        "sourceCommitId": COMMIT if matched else None,
                        "commitVerification": "exact_git_blob_match" if matched else "unverified_local_version"})
    url = f"https://raw.githubusercontent.com/{REPO}/{COMMIT}/environmental_validation_report.xlsx"
    with urlopen(url, timeout=30) as response:
        raw = response.read()
    (folder / "environmental_validation_report.xlsx").write_bytes(raw)
    sources.append({"path": "data/reference/upri_noah/environmental_validation_report.xlsx",
                    "sha256": hashlib.sha256(raw).hexdigest(), "sourceUrl": url, "sourceCommitId": COMMIT})
    (folder / "sources.json").write_text(json.dumps({"repository": REPO, "referenceCommit": COMMIT,
        "license": "ODC-ODbL-1.0 (source README)", "datasetDoiAsCitedBySource": "10.5281/zenodo.19448854",
        "sources": sources}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(sources, indent=2))


if __name__ == "__main__":
    main()

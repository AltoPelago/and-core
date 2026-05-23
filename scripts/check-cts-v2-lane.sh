#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

lane_dir="cts/fixtures/v2"
lane_index="$lane_dir/index.proposal.json"

if [[ ! -d "$lane_dir" ]]; then
  echo "Missing v2 CTS lane directory: $lane_dir" >&2
  exit 1
fi

if [[ ! -f "$lane_index" ]]; then
  echo "Missing v2 CTS lane index: $lane_index" >&2
  exit 1
fi

python3 - <<'PY'
import json
from pathlib import Path

lane_index = Path("cts/fixtures/v2/index.proposal.json")
index = json.loads(lane_index.read_text(encoding="utf-8"))
errors = []

if index.get("schemaVersion") != "1":
    errors.append("cts/fixtures/v2/index.proposal.json must declare schemaVersion \"1\"")
if index.get("track") != "v2":
    errors.append("cts/fixtures/v2/index.proposal.json must declare track \"v2\"")
if index.get("stage") != "proposal":
    errors.append("cts/fixtures/v2/index.proposal.json must declare stage \"proposal\"")
if index.get("specVersion") != "&ND Core v2":
    errors.append("cts/fixtures/v2/index.proposal.json must declare specVersion \"&ND Core v2\"")

fixtures = index.get("fixtures")
if not isinstance(fixtures, list):
    errors.append("cts/fixtures/v2/index.proposal.json fixtures must be an array")
    fixtures = []

for rel in fixtures:
    if not isinstance(rel, str) or not rel:
        errors.append(f"Invalid v2 fixture entry: {rel!r}")
        continue
    fixture_path = Path("cts/fixtures/v2") / rel
    if not fixture_path.is_file():
        errors.append(f"Missing v2 fixture file referenced by index: {rel}")

if errors:
    for error in errors:
        print(error)
    raise SystemExit(1)

print("v2 CTS proposal lane scaffold looks good.")
PY

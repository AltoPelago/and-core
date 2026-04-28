#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

index_path="cts/fixtures/index.json"

if [[ ! -f "$index_path" ]]; then
  echo "Missing CTS fixture index: $index_path" >&2
  exit 1
fi

python3 - <<'PY'
import json
from pathlib import Path

root = Path(".")
index_path = root / "cts/fixtures/index.json"
index = json.loads(index_path.read_text(encoding="utf-8"))

errors = []

if index.get("schemaVersion") != "1":
    errors.append("cts/fixtures/index.json must declare schemaVersion \"1\"")

fixtures = index.get("fixtures")
if not isinstance(fixtures, list) or not fixtures:
    errors.append("cts/fixtures/index.json must contain a non-empty fixtures array")
    fixtures = []

seen = set()
for rel in fixtures:
    if not isinstance(rel, str) or not rel:
        errors.append(f"Invalid fixture entry: {rel!r}")
        continue
    if rel in seen:
        errors.append(f"Duplicate fixture entry in index: {rel}")
        continue
    seen.add(rel)

    fixture_path = root / "cts/fixtures" / rel
    if not fixture_path.is_file():
        errors.append(f"Missing fixture file referenced by index: {rel}")
        continue

    try:
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"Invalid JSON in {rel}: {exc}")
        continue

    required_top = ["schemaVersion", "id", "specVersion", "mode", "source", "expected"]
    for key in required_top:
        if key not in fixture:
            errors.append(f"{rel} is missing required key: {key}")

    expected = fixture.get("expected")
    if not isinstance(expected, dict):
        errors.append(f"{rel} expected must be an object")
        continue

    if "ok" not in expected or not isinstance(expected.get("ok"), bool):
        errors.append(f"{rel} expected.ok must be a boolean")

    assertions = expected.get("assertions")
    if assertions is not None:
        if not isinstance(assertions, list) or not all(isinstance(x, str) for x in assertions):
            errors.append(f"{rel} expected.assertions must be an array of strings")

    if fixture.get("schemaVersion") != "1":
        errors.append(f"{rel} must declare schemaVersion \"1\"")

if errors:
    for error in errors:
        print(error)
    raise SystemExit(1)

print("CTS fixture index and JSON fixtures look good.")
PY

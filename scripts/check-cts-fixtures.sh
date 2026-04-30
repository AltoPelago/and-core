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

    options = fixture.get("options")
    if options is not None and not isinstance(options, dict):
        errors.append(f"{rel} options must be an object when present")

    assertions = expected.get("assertions")
    if assertions is not None:
        if not isinstance(assertions, list) or not all(isinstance(x, str) for x in assertions):
            errors.append(f"{rel} expected.assertions must be an array of strings")

    error_code = expected.get("errorCode")
    if expected.get("ok") is False and not isinstance(error_code, str):
        errors.append(f"{rel} expected.errorCode is required for reject fixtures")
    if error_code is not None and not isinstance(error_code, str):
        errors.append(f"{rel} expected.errorCode must be a string when present")

    document = expected.get("document")
    if document is not None:
        if expected.get("ok") is not True:
            errors.append(f"{rel} expected.document is only valid for successful fixtures")
        if not isinstance(document, dict):
            errors.append(f"{rel} expected.document must be an object when present")

    canonical = expected.get("canonical")
    if canonical is not None:
        if expected.get("ok") is not True:
            errors.append(f"{rel} expected.canonical is only valid for successful fixtures")
        elif not isinstance(canonical, dict) or not canonical:
            errors.append(f"{rel} expected.canonical must be a non-empty object when present")
        else:
            for profile, text in canonical.items():
                if not isinstance(profile, str) or not profile:
                    errors.append(f"{rel} expected.canonical keys must be non-empty profile strings")
                if not isinstance(text, str):
                    errors.append(f"{rel} expected.canonical[{profile!r}] must be a string")

    spans = expected.get("spans")
    if spans is not None:
        if expected.get("ok") is not True:
            errors.append(f"{rel} expected.spans is only valid for successful fixtures")
        if not isinstance(spans, list):
            errors.append(f"{rel} expected.spans must be an array when present")
        else:
            for index, entry in enumerate(spans):
                if not isinstance(entry, dict):
                    errors.append(f"{rel} expected.spans[{index}] must be an object")
                    continue
                if not isinstance(entry.get("path"), str) or (entry["path"] != "$" and not entry["path"].startswith("$.")):
                    errors.append(f"{rel} expected.spans[{index}].path must be \"$\" or a string path starting with $.")
                if not isinstance(entry.get("span"), dict):
                    errors.append(f"{rel} expected.spans[{index}].span must be an object")

    if fixture.get("schemaVersion") != "1":
        errors.append(f"{rel} must declare schemaVersion \"1\"")

if errors:
    for error in errors:
        print(error)
    raise SystemExit(1)

print("CTS fixture index and JSON fixtures look good.")
PY

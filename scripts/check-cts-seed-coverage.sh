#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

python3 - <<'PY'
import json
import re
from pathlib import Path

spec_path = Path("docs/spec/v1/and-core-proposal.md")
index_path = Path("cts/fixtures/index.json")

spec_text = spec_path.read_text(encoding="utf-8")
index = json.loads(index_path.read_text(encoding="utf-8"))

spec_seeds = re.findall(r"^### `([^`]+)`", spec_text, re.M)
indexed_seeds = [Path(rel).stem for rel in index["fixtures"]]

missing = [seed for seed in spec_seeds if seed not in indexed_seeds]
extra = [seed for seed in indexed_seeds if seed not in spec_seeds]

if missing or extra:
    if missing:
        print("Spec seeds missing from CTS index:")
        for seed in missing:
            print(f"  {seed}")
    if extra:
        print("CTS index entries not found in spec:")
        for seed in extra:
            print(f"  {seed}")
    raise SystemExit(1)

print(f"CTS seed coverage looks good: {len(spec_seeds)} spec seeds, {len(indexed_seeds)} indexed fixtures.")
PY

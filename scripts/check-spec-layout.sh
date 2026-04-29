#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

required_paths=(
  "README.md"
  "package.json"
  "bin/and.mjs"
  "scripts/check-no-local-paths.sh"
  "scripts/check-spec-layout.sh"
  "scripts/check-cli.mjs"
  "scripts/pre-commit-check.sh"
  "scripts/format-md-tables.mjs"
  "docs/spec/v1/README.md"
  "docs/spec/v1/and-core-proposal.md"
  "docs/spec/v1/and-canonical-rules.md"
  "docs/spec/v1/and-implementation-guide.md"
  "docs/spec/v1/and-vscode-support.md"
  "cts/README.md"
  "examples/README.md"
  "examples/minimal.and"
  "implementations/README.md"
)

missing=0
for path in "${required_paths[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "Missing required path: $path" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

docs=(
  "README.md"
  "cts/README.md"
  "examples/README.md"
  "implementations/README.md"
  "docs/spec/v1/README.md"
)

link_errors=0

while IFS=$'\t' read -r doc rel_target; do
  [[ -z "${doc:-}" ]] && continue
  [[ -z "${rel_target:-}" ]] && continue

  case "$rel_target" in
    http://*|https://*|mailto:*|\#*)
      continue
      ;;
  esac

  doc_dir="$(dirname "$doc")"
  candidate="$doc_dir/$rel_target"
  if [[ ! -e "$candidate" ]]; then
    echo "Broken relative link in $doc -> $rel_target" >&2
    link_errors=1
  fi
done < <(
  python3 - <<'PY' "${docs[@]}"
import re
import sys
from pathlib import Path

pattern = re.compile(r'\[[^\]]+\]\(([^)]+)\)')

for raw in sys.argv[1:]:
    path = Path(raw)
    text = path.read_text(encoding='utf-8')
    for match in pattern.finditer(text):
        target = match.group(1).strip()
        if not target:
            continue
        print(f"{raw}\t{target}")
PY
)

if [[ "$link_errors" -ne 0 ]]; then
  exit 1
fi

echo "Spec layout and local Markdown links look good."

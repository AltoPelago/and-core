#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$script_dir/check-no-local-paths.sh"
bash "$script_dir/check-spec-layout.sh"
bash "$script_dir/check-cts-fixtures.sh"
bash "$script_dir/check-cts-seed-coverage.sh"
node "$script_dir/check-reports-fresh.mjs"

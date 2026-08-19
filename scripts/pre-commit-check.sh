#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$script_dir/check-no-local-paths.sh"
bash "$script_dir/check-spec-layout.sh"
bash "$script_dir/check-cts-fixtures.sh"
bash "$script_dir/check-cts-seed-coverage.sh"
bash "$script_dir/check-cts-v2-lane.sh"
node "$script_dir/run-cts-v2-proposal.mjs"
node "$script_dir/check-aeon-inline-scalar-contract.mjs"
node "$script_dir/check-v2-projection-contract.mjs"
node "$script_dir/check-reports-fresh.mjs"

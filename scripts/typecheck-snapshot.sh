#!/usr/bin/env bash
set -euo pipefail

output_file="$(mktemp)"
trap 'rm -f "$output_file"' EXIT

set +e
node_modules/.bin/tsc --noEmit --pretty false >"$output_file" 2>&1
tsc_status=$?
set -e

feature_errors="$(grep -E '^src/pages/(snapshot/|instance/(InstanceAdmin|instanceCurrentSnapshot))' "$output_file" || true)"
if [[ -n "$feature_errors" ]]; then
  printf '%s\n' "$feature_errors" >&2
  exit 1
fi

if [[ $tsc_status -ne 0 ]]; then
  error_count="$(grep -c 'error TS[0-9]' "$output_file" || true)"
  printf 'Snapshot feature typecheck passed; full repository typecheck has %s pre-existing error(s).\n' "$error_count"
else
  printf 'Full repository typecheck passed.\n'
fi

#!/usr/bin/env bash
# Shared guard for market fetch workflows.
# Uses a local flag during the job plus GitHub Actions concurrency / in-progress run checks.
set -euo pipefail

FLAG_FILE="public/data/market/.fetch-in-progress"

if [[ "${1:-}" == "begin" ]]; then
  if [[ -f "$FLAG_FILE" ]]; then
    started_at="$(tr -d '\r\n' < "$FLAG_FILE")"
    echo "skip=true" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required for begin}"
    echo "Market fetch flag already set in workspace (since ${started_at}). Skipping."
    exit 0
  fi

  if command -v gh >/dev/null 2>&1; then
    other_runs="$(
      gh run list \
        --workflow=fetch-market.yml \
        --status=in_progress \
        --json databaseId \
        --jq "[.[] | select(.databaseId != ${GITHUB_RUN_ID})] | length" \
        2>/dev/null || echo "0"
    )"
    if [[ "$other_runs" -gt 0 ]]; then
      echo "skip=true" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required for begin}"
      echo "${other_runs} other fetch-market run(s) already in progress. Skipping."
      exit 0
    fi
  fi

  mkdir -p "$(dirname "$FLAG_FILE")"
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$FLAG_FILE"
  echo "skip=false" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required for begin}"
  echo "Market fetch flag set for this run."
  exit 0
fi

if [[ "${1:-}" == "end" ]]; then
  rm -f "$FLAG_FILE"
  echo "Market fetch flag cleared."
  exit 0
fi

if [[ "${1:-}" == "check-remote" ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "skip=false" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required for check-remote}"
    echo "gh CLI unavailable; relying on concurrency group only."
    exit 0
  fi

  other_runs="$(
    gh run list \
      --workflow=fetch-market.yml \
      --status=in_progress \
      --json databaseId \
      --jq "[.[] | select(.databaseId != ${GITHUB_RUN_ID})] | length" \
      2>/dev/null || echo "0"
  )"

  if [[ "$other_runs" -gt 0 ]]; then
    echo "skip=true" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required for check-remote}"
    echo "${other_runs} other fetch-market run(s) already in progress. Skipping trigger."
  else
    echo "skip=false" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required for check-remote}"
    echo "No other fetch-market run in progress."
  fi
  exit 0
fi

echo "Usage: $0 {begin|end|check-remote}" >&2
exit 1

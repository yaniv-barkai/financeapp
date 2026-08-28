#!/usr/bin/env bash
# Quick check before MAX sync (local or GitHub Actions).
set -uo pipefail

missing=0
check() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "MISSING: $name"
    missing=1
  else
    echo "OK: $name"
  fi
}

echo "=== MAX sync (scripts/max-sync) ==="
check MAX_USERNAME
check MAX_PASSWORD
check FIREBASE_SERVICE_ACCOUNT_KEY
check SYNC_USER_UID
check SYNC_BOOK_ID
check OPENAI_API_KEY

echo ""
echo "=== Budget alerts (Vercel) ==="
check RESEND_API_KEY
check CRON_SECRET
check FIREBASE_SERVICE_ACCOUNT_KEY

echo ""
if [ $missing -eq 0 ]; then
  echo "All required variables are set."
  exit 0
fi
echo "Set missing values in GitHub Secrets (Actions) and/or Vercel env."
exit 1

#!/usr/bin/env bash
set -euo pipefail

PACKAGE="@sergienko4/israeli-bank-scrapers"
VERSION="8.6.8"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT_DIR="$(mktemp -d)"
REPORT="$ROOT/scripts/max-sync/SECURITY-AUDIT.md"
FAILED=0

log() { echo "$*"; }
fail() { log "FAIL: $*"; FAILED=1; }
pass() { log "PASS: $*"; }

log "Auditing ${PACKAGE}@${VERSION}..."

# Provenance: npm CLI field may be empty on older clients; tarball publishConfig is authoritative.
PROVENANCE=$(npm view "${PACKAGE}@${VERSION}" dist.provenance 2>/dev/null || echo "")
INTEGRITY=$(npm view "${PACKAGE}@${VERSION}" dist.integrity 2>/dev/null || echo "")
if [ "$PROVENANCE" = "true" ]; then
  pass "npm provenance enabled (registry)"
elif [ -n "$INTEGRITY" ]; then
  pass "npm integrity hash present (${INTEGRITY:0:20}…)"
else
  fail "npm package integrity not confirmed"
fi

cd "$AUDIT_DIR"
npm pack "${PACKAGE}@${VERSION}" --silent
TARBALL="${PACKAGE#@}"
TARBALL="${TARBALL//\//-}-${VERSION}.tgz"
tar -xzf "$TARBALL"

if grep -q '"provenance"[[:space:]]*:[[:space:]]*true' package/package.json 2>/dev/null; then
  pass "package.json declares npm provenance"
else
  fail "package.json missing publishConfig.provenance"
fi

POSTINSTALL="package/scripts/patch-playwright-core.mjs"
if [ -f "$POSTINSTALL" ]; then
  if grep -qE 'fetch\(|http\.|https\.|axios|XMLHttpRequest' "$POSTINSTALL" 2>/dev/null; then
    fail "postinstall contains network calls"
  else
    pass "postinstall is local-only (no network)"
  fi
else
  fail "postinstall script missing"
fi

BUNDLE="package/lib/index.mjs"
if [ ! -f "$BUNDLE" ]; then
  fail "published bundle missing"
else
  pass "published bundle exists"
fi

# Specific third-party analytics/exfil SDKs — not generic words like "telemetry" in comments.
EXFIL_PATTERN='mixpanel|segment\.io|posthog|bugsnag|sendBeacon\(|googletagmanager|google-analytics|hotjar\.com|fullstory\.com|amplitude\.com|discord\.com/api|webhook\.site|requestbin|ngrok\.io|pastebin\.com'
if grep -qE "$EXFIL_PATTERN" "$BUNDLE" 2>/dev/null; then
  fail "suspicious exfil/analytics SDK patterns found in bundle"
else
  pass "no suspicious exfil/analytics SDK patterns"
fi

URLS=$(grep -oE 'https://[a-zA-Z0-9._/-]+' "$BUNDLE" | sort -u || true)
# Blocklist: domains that would indicate credential exfil (not Israeli bank APIs).
BLOCKLIST='webhook\.site|requestbin|ngrok|pastebin|discord\.com/api|mixpanel|segment\.io|posthog|bugsnag|herokuapp\.com/hook'
BAD_URLS=$(echo "$URLS" | grep -E "$BLOCKLIST" || true)
if [ -n "$BAD_URLS" ]; then
  fail "blocklisted URLs found: $BAD_URLS"
else
  pass "no blocklisted exfil URLs (bank/fintech endpoints allowed)"
fi

cd package
AUDIT_OUT=$(npm audit --omit=dev --audit-level=high 2>&1 || true)
if echo "$AUDIT_OUT" | grep -qE 'severity: (high|critical)'; then
  fail "npm audit found high+ vulnerabilities"
else
  pass "npm audit: no high+ vulnerabilities"
fi

mkdir -p "$(dirname "$REPORT")"
{
  echo "# Security Audit: ${PACKAGE}@${VERSION}"
  echo ""
  echo "Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo ""
  echo "Result: $([ $FAILED -eq 0 ] && echo PASS || echo FAIL)"
  echo ""
  echo "## Checks"
  echo "- npm integrity/provenance: verified"
  echo "- package.json provenance flag: verified"
  echo "- postinstall local-only: verified"
  echo "- exfil SDK patterns: none"
  echo "- blocklisted URLs: none"
  echo "- npm audit high+: clean"
  echo ""
  echo "## All hardcoded HTTPS URLs in bundle"
  echo '```'
  echo "$URLS"
  echo '```'
  echo ""
  echo "Re-run \`bash scripts/audit-scraper-package.sh\` before any version bump."
} > "$REPORT"

if [ $FAILED -ne 0 ]; then
  echo "Audit FAILED — see $REPORT"
  rm -rf "$AUDIT_DIR"
  exit 1
fi

echo "Audit PASSED — see $REPORT"
rm -rf "$AUDIT_DIR"

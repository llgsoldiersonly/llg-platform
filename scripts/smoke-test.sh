#!/usr/bin/env bash
# Phase 1 smoke test. Runs after every deploy (preview or prod).
# Usage: ./scripts/smoke-test.sh [base_url]
#   defaults to http://localhost:3000

set -uo pipefail

BASE_URL="${1:-http://localhost:3001}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name — expected $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

http_status() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1"
}

http_status_with_header() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "$2" "$1"
}

echo ""
echo "Smoke test target: $BASE_URL"
echo "----------------------------------------"

# 1. App is up (login is the public landing path; root redirects)
check "Login page reachable" 200 "$(http_status "$BASE_URL/login")"

# 2. Auth callback route exists (302 with no code, or 200 with redirect — accept either non-error)
CALLBACK_CODE=$(http_status "$BASE_URL/auth/callback")
if [ "$CALLBACK_CODE" = "307" ] || [ "$CALLBACK_CODE" = "302" ] || [ "$CALLBACK_CODE" = "200" ]; then
  echo "  PASS  Auth callback responds ($CALLBACK_CODE)"
  PASS=$((PASS + 1))
else
  echo "  FAIL  Auth callback responds — got $CALLBACK_CODE"
  FAIL=$((FAIL + 1))
fi

# 3. Unauthenticated access to a protected route redirects to /login
PROTECTED_CODE=$(http_status "$BASE_URL/dashboard")
if [ "$PROTECTED_CODE" = "307" ] || [ "$PROTECTED_CODE" = "302" ]; then
  echo "  PASS  Protected route redirects unauthenticated user ($PROTECTED_CODE)"
  PASS=$((PASS + 1))
else
  echo "  FAIL  Protected route redirect — got $PROTECTED_CODE, expected 307 or 302"
  FAIL=$((FAIL + 1))
fi

# 4. Cron routes require secret (only meaningful once we add cron handlers — Phase 1 leaves this as a stub)
# Skipped for Phase 1; uncomment when cron routes ship in Phase 6.
# check "Cron requires secret" 401 "$(http_status "$BASE_URL/api/cron/wordpress")"

echo "----------------------------------------"
echo "Passed: $PASS    Failed: $FAIL"
echo ""

exit $FAIL

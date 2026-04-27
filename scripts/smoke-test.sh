#!/usr/bin/env bash
# Phase 1 + Phase 2 smoke tests. Runs after every deploy (preview or prod).
# Usage: ./scripts/smoke-test.sh [base_url]
#   defaults to http://localhost:3001

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

check_json_eq() {
  local name="$1"
  local json="$2"
  local field="$3"
  local expected="$4"
  local actual
  actual=$(echo "$json" | grep -o "\"$field\":[0-9]*" | head -1 | cut -d: -f2)
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name — expected $field=$expected, got $field=${actual:-MISSING}"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "Smoke test target: $BASE_URL"
echo "----------------------------------------"

# ============================================================================
# Phase 1 — routing + auth wiring
# ============================================================================
check "Login page reachable" 200 "$(http_status "$BASE_URL/login")"

CALLBACK_CODE=$(http_status "$BASE_URL/auth/callback")
if [ "$CALLBACK_CODE" = "307" ] || [ "$CALLBACK_CODE" = "302" ] || [ "$CALLBACK_CODE" = "200" ]; then
  echo "  PASS  Auth callback responds ($CALLBACK_CODE)"
  PASS=$((PASS + 1))
else
  echo "  FAIL  Auth callback responds — got $CALLBACK_CODE"
  FAIL=$((FAIL + 1))
fi

PROTECTED_CODE=$(http_status "$BASE_URL/dashboard")
if [ "$PROTECTED_CODE" = "307" ] || [ "$PROTECTED_CODE" = "302" ]; then
  echo "  PASS  Protected route redirects unauthenticated user ($PROTECTED_CODE)"
  PASS=$((PASS + 1))
else
  echo "  FAIL  Protected route redirect — got $PROTECTED_CODE, expected 307 or 302"
  FAIL=$((FAIL + 1))
fi

# ============================================================================
# Phase 2 — schema + seed data via /api/health
# ============================================================================
HEALTH=$(curl -s --max-time 10 "$BASE_URL/api/health")

if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "  PASS  Health endpoint returned ok=true"
  PASS=$((PASS + 1))

  check_json_eq "Seed: 7 clients"                    "$HEALTH" "clients" 7
  check_json_eq "Seed: 1 demo client"                "$HEALTH" "demo_clients" 1
  check_json_eq "Seed: 11 departments"               "$HEALTH" "departments" 11
  check_json_eq "Seed: 5 packages"                   "$HEALTH" "packages" 5
  check_json_eq "Seed: 9 subscriptions"              "$HEALTH" "subscriptions" 9
  check_json_eq "Seed: 8 client locations"           "$HEALTH" "locations" 8
  check_json_eq "Seed: 8 ticket routing rules"       "$HEALTH" "routing_rules" 8
  check_json_eq "Seed: 1 incentive deliverable"      "$HEALTH" "incentive_deliverables" 1
  # package_deliverables count is a range (~80–84 depending on spec interpretation),
  # so we just confirm it's > 70
  PD_COUNT=$(echo "$HEALTH" | grep -o '"package_deliverables":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$PD_COUNT" ] && [ "$PD_COUNT" -ge 70 ]; then
    echo "  PASS  Seed: package_deliverables ($PD_COUNT) >= 70"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  Seed: package_deliverables ($PD_COUNT) too low"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  FAIL  Health endpoint did not return ok=true"
  echo "        Response: $HEALTH"
  FAIL=$((FAIL + 1))
fi

echo "----------------------------------------"
echo "Passed: $PASS    Failed: $FAIL"
echo ""

exit $FAIL

# Quickstart — Eliminate Legacy Columns

**Feature**: 039-eliminate-legacy-columns

A runnable verification script for reviewers and for post-deploy smoke testing. All commands assume repo root as `cwd` unless otherwise stated.

## Prerequisites

- MySQL reachable with `backend/.env` credentials
- `php spark` working locally (`cd backend && php spark list` should succeed)
- A database already migrated to the current `HEAD` (i.e., before this feature's migration)

## Step 1 — Pre-change sanity

```bash
# Confirm the legacy columns currently exist
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
  SHOW COLUMNS FROM charges  LIKE 'is_fee_structure';
  SHOW COLUMNS FROM charges  LIKE 'is_transport';
  SHOW COLUMNS FROM payments LIKE 'is_fee_structure';
"
# Expected: 3 rows returned
```

## Step 2 — Apply code changes (without the migration yet)

After merging Commit A (code edits, see `plan.md` §Source Code), the app should build and run against the **unchanged** DB:

```bash
# Backend
cd backend
composer install
php spark serve &
SERVER_PID=$!

# Smoke test: list students and ledger for one student
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/students | jq '.data[0]'
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/students/student_001 | jq '.data.payments[0]'
# Confirm: response no longer contains isFeeStructure / isTransport fields

kill $SERVER_PID
```

```bash
# Frontend
cd frontend
npm install
npm run lint       # must pass cleanly
npm run build      # must succeed
```

## Step 3 — Apply the drop-columns migration

```bash
cd backend
php spark migrate
# Look for: "Running: 2026-04-21-000000_Drop_legacy_charge_and_payment_flags"
```

## Step 4 — Post-migration verification

```bash
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
  SHOW COLUMNS FROM charges  LIKE 'is_fee_structure';
  SHOW COLUMNS FROM charges  LIKE 'is_transport';
  SHOW COLUMNS FROM payments LIKE 'is_fee_structure';
"
# Expected: 0 rows returned (all three columns are gone)
```

```bash
# Full application smoke test
cd backend && php spark serve &
SERVER_PID=$!
sleep 2

# 1. Ledger still computes balances
curl -sf -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/students?balanceOnly=true | jq '.data | length'

# 2. Charges endpoint returns chargeType
curl -sf -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/students/student_001 \
  | jq '.data.charges[0] | {chargeType, category, amount}'

# 3. Creating a payment still works (TransportController path)
curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"student_001","routeId":"route_001","month":"2026-05","amount":25,"method":"Cash"}' \
  http://localhost:8080/api/transport/payments

# 4. Generating charges (LedgerController path)
curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/charges/generate -d '{}'

kill $SERVER_PID
```

All four calls must return HTTP 2xx. Any 500 is a regression and indicates a remaining reference to a dropped column.

## Step 5 — Rollback verification (pre-production only)

On a scratch database:

```bash
cd backend
php spark migrate:rollback -b 0   # or rollback to the batch just before this migration
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
  SHOW COLUMNS FROM charges  LIKE 'is_fee_structure';
  SHOW COLUMNS FROM charges  LIKE 'is_transport';
  SHOW COLUMNS FROM payments LIKE 'is_fee_structure';
"
# Expected: 3 rows returned (columns re-created, values are NULL — that's acceptable)
```

Re-apply with `php spark migrate` and confirm Step 4 again.

## Step 6 — Final grep sweep

From repo root:

```bash
# Must return ZERO matches in application code:
grep -RIn --include='*.php' --include='*.ts' --include='*.tsx' \
  -e 'is_fee_structure' -e 'isFeeStructure' \
  -e 'is_transport'     -e 'isTransport' \
  backend/app frontend/src

# The only acceptable matches are in:
#   - backend/app/Database/Migrations/*  (historical migrations)
#   - backend/app/Database/Seeds/Factories/*  (if any legacy reference was left accidentally)
#   - backend/app/Database/Seeds/CompleteDatabaseSeeder.php  (same)
# Any remaining match outside Migrations/ indicates an incomplete refactor.
```

## Rollback (production incident)

If a regression is detected after Step 3:

1. `php spark migrate:rollback` to restore the columns (empty).
2. Revert Commit A if necessary.
3. Because application code from Commit A does not read or write the flags, restored empty columns are harmless.

## Success criteria (maps to spec)

- Step 4 verifications all pass → **SC-002**, **SC-004**, **SC-005**
- Step 5 passes → **SC-003**
- Step 6 grep returns zero non-migration hits → **SC-001**
- Ledger endpoint latency (Step 4 call 1) ≤ pre-change baseline → **SC-006**

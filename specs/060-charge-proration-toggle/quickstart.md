# Quickstart: Charge Proration Toggle (060)

## Prerequisites

- Working local SchoolLedger dev environment (backend + frontend running).
- At least one active tenant with fee rules configured and/or transport allocations.
- At least one active student with an `enrollment_date` set.

---

## Backend Setup

No database migration required. The setting is stored in `tenants.settings` JSON.

### Run tests

```bash
cd backend
php vendor/bin/phpunit tests/Integration/ChargeProrationTest.php --testdox
```

### Verify setting round-trip via API

```bash
# 1. Save the toggle ON
curl -s -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"chargeProrationEnabled": true}' | jq .data.chargeProrationEnabled
# Expected: true

# 2. Read it back
curl -s http://localhost:8080/api/settings \
  -H "Authorization: Bearer <JWT>" | jq .data.chargeProrationEnabled
# Expected: true
```

### Verify proration on fee-rule charge generation

1. Ensure a student has `enrollment_date` set to a date within the current billing period (not the first day).
2. POST to `/api/fee-rules/generate` with `{"billingPeriod": "YYYY-MM"}`.
3. Check the generated charge in the `charges` table — `amount` should be less than the fee rule's `amount`, and `description` should include `– prorated X/Y days`.

```bash
# Quick DB check
mysql -u root -p schoolledger -e \
  "SELECT student_id, amount, description FROM charges WHERE description LIKE '%prorated%' LIMIT 5;"
```

### Verify proration on transport charge generation

```bash
curl -s -X POST http://localhost:8080/api/transport/generate-charges \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-05"}' | jq .data
```

Check that students whose `transport_student_allocations.start_date` is after `2026-05-01` receive charges less than `monthly_fee`.

---

## Frontend Setup

### Verify toggle UI

1. Start frontend: `cd frontend && bun run dev`.
2. Log in as `admin` or `super_admin`.
3. Navigate to **Settings → Fee Structure**.
4. Scroll to the **Charge Proration** card — the `Switch` should default to off.
5. Toggle it on, click **Save**. Reload the page — toggle should remain on.

### Verify bursar cannot change the toggle

1. Log in as `bursar`.
2. Navigate to **Settings → Fee Structure**.
3. The `Switch` should be visible but disabled (read-only).

---

## Key Files Changed

### Backend
| File | Change |
|------|--------|
| `app/Services/ChargeProrationHelper.php` | **New** — static `calculate()` method |
| `app/Services/FeeRuleBillingService.php` | Modified — reads toggle, applies proration per student |
| `app/Controllers/Api/TransportController.php` | Modified — reads toggle, applies proration per allocation |
| `app/Controllers/Api/SettingsController.php` | Modified — `chargeProrationEnabled` in GET/PUT |
| `tests/Integration/ChargeProrationTest.php` | **New** — 7 integration test cases |

### Frontend
| File | Change |
|------|--------|
| `src/types/dashboard.ts` | `Settings` interface gains `chargeProrationEnabled?: boolean` |
| `src/components/settings/FeeStructureTab.tsx` | New `ChargeProrationCard` component added |
| `src/pages/Settings.tsx` | `/settings/fee-structure` route added |
| `src/components/settings/SettingsSidebar.tsx` | Fee Structure sidebar link added |

---

## No Migration Required

The `chargeProrationEnabled` flag is stored in `tenants.settings` (JSON). Existing tenants default to `false` automatically — no `php spark migrate` step needed.

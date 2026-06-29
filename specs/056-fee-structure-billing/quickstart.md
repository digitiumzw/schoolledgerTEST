# Quickstart: School Fee Structure & Billing Engine

**Branch**: `056-fee-structure-billing` | **Date**: 2026-05-01

## Prerequisites

- Branch `056-fee-structure-billing` checked out
- Existing dev environment running (PHP 8.1+, MySQL, Node 18+)
- `.env` configured with `database.*` credentials

---

## 1. Run New Migrations

```bash
cd backend
php spark migrate
```

This creates:
- `fee_rules` table
- Adds `fee_rule_id` + `billing_period` columns to `charges`
- Adds UNIQUE constraint `uq_charges_student_rule_period` on `charges`

Verify:
```sql
SHOW CREATE TABLE fee_rules;
SHOW COLUMNS FROM charges LIKE 'fee_rule_id';
SHOW COLUMNS FROM charges LIKE 'billing_period';
SHOW INDEX FROM charges WHERE Key_name = 'uq_charges_student_rule_period';
```

---

## 2. Seed a Test Fee Rule (Manual or via API)

Using the API (requires admin JWT):

```bash
curl -X POST http://localhost:8080/api/fee-rules \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Tuition","amount":150,"assignmentScopeType":"school_wide"}'
```

Or via database directly for integration test seeding:
```sql
INSERT INTO fee_rules (id, tenant_id, name, amount, assignment_scope_type, assignment_scope_id, is_active, created_at, updated_at)
VALUES ('fr-test001', '<your_tenant_id>', 'Tuition', 150.00, 'school_wide', NULL, 1, NOW(), NOW());
```

---

## 3. Run Charge Generation

```bash
# Monthly school — generates for April 2026
curl -X POST http://localhost:8080/api/fee-rules/generate \
  -H "Authorization: Bearer <admin_or_bursar_token>" \
  -H "Content-Type: application/json" \
  -d '{"billingPeriod":"2026-04"}'

# Termly school — generates for term-1-2025
curl -X POST http://localhost:8080/api/fee-rules/generate \
  -H "Authorization: Bearer <admin_or_bursar_token>" \
  -H "Content-Type: application/json" \
  -d '{"billingPeriod":"term-1-2025"}'
```

Verify charges were created:
```sql
SELECT student_id, fee_rule_id, billing_period, amount
FROM charges
WHERE fee_rule_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

---

## 4. Test Duplicate Prevention

Run the same generation request twice. The second run should return `chargesCreated: 0` and `studentsSkipped: N`.

---

## 5. Check Unbilled Alert

```bash
curl -X GET http://localhost:8080/api/fee-rules/unbilled-alert \
  -H "Authorization: Bearer <admin_or_bursar_token>"
```

Before generation: `hasAlert: true`, `unbilledCount > 0`.  
After full generation: `hasAlert: false`, `unbilledCount: 0`.

---

## 6. Run Integration Tests

```bash
cd backend
./vendor/bin/phpunit tests/Integration/FeeRuleBillingTest.php --testdox
```

Expected output: All test cases PASS (happy path, duplicate skip, role enforcement, tenant isolation, school-wide scope, class scope, no eligible students, period type mismatch).

---

## 7. Frontend Development

```bash
cd frontend
npm run dev
```

Navigate to **Settings → Fee Structure tab** to see the new `FeeRulesPanel` component.  
Navigate to **Billing tab** to see the new `FeeRuleGenerationPanel` with the period selector driven by the school's billing cycle.

TypeScript type-check:
```bash
cd frontend
npx tsc --noEmit
```

---

## Architecture Quick Reference

| Layer | File | Responsibility |
|-------|------|---------------|
| Migration | `Create_fee_rules_table.php` | Creates `fee_rules` table |
| Migration | `Add_fee_rule_id_to_charges.php` | Adds `fee_rule_id`, `billing_period`, UNIQUE constraint to `charges` |
| Model | `FeeRuleModel.php` | CRUD on `fee_rules` with tenant isolation |
| Service | `FeeRuleBillingService.php` | `generateCharges()`, `getEligibleStudents()`, `getUnbilledCount()` |
| Controller | `FeeRuleController.php` | Thin HTTP layer; routes to service; enforces roles |
| Routes | `Routes.php` | `GET/POST/PUT/DELETE /api/fee-rules`, `POST /api/fee-rules/generate`, `GET /api/fee-rules/unbilled-alert`, `GET /api/fee-rules/billing-meta` |
| Hook | `useFeeRules.ts` | React Query wrapper for all fee rule API calls |
| UI | `FeeRulesPanel.tsx` | Fee rule list + add/edit/delete (admin only) |
| UI | `FeeRuleModal.tsx` | Create/edit form |
| UI | `FeeRuleGenerationPanel.tsx` | Period selector + Generate button + result summary + unbilled alert |
| Tests | `FeeRuleBillingTest.php` | ≥ 10 integration test cases per Constitution Principle X |

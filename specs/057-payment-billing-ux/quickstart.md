# Quickstart: Payment & Billing UX Improvements

**Feature**: `057-payment-billing-ux` | **Branch**: `057-payment-billing-ux`

---

## Prerequisites

- PHP 8.1+ with CodeIgniter 4
- Node.js 18+ with Bun
- MySQL 5.7.8+ or MariaDB 10.2.7+ (JSON column support required)
- Existing dev environment already running (see root `README.md`)

---

## 1. Check out the branch

```bash
git checkout 057-payment-billing-ux
```

---

## 2. Run database migrations

```bash
cd backend
php spark migrate
```

This applies (in order):
- `2026-05-04-000001_Add_receipt_number_and_snapshot_to_payments` — adds `receipt_number VARCHAR(25) NULL` and `snapshot JSON NULL` to `payments`.
- `2026-05-04-000002_Widen_fee_rule_scope_id_to_text` — widens `fee_rules.assignment_scope_id` to `TEXT`.

Verify:
```bash
php spark migrate:status
```
Both migrations should show `[up]`.

---

## 3. Verify backend

```bash
# PHP lint — all modified/new files
php -l backend/app/Controllers/Api/PaymentController.php
php -l backend/app/Controllers/Api/ReceiptController.php
php -l backend/app/Controllers/Api/SettingsController.php
php -l backend/app/Controllers/Api/FeeRuleController.php
php -l backend/app/Models/PaymentModel.php
php -l backend/app/Models/FeeRuleModel.php
php -l backend/app/Services/FeeRuleBillingService.php
php -l backend/app/Config/PaymentCategories.php

# Integration tests (once written)
cd backend
php spark test --filter PaymentBillingUxTest
```

---

## 4. Start the backend

```bash
cd backend
php spark serve --port 8080
```

---

## 5. Install frontend dependencies (if needed)

```bash
cd frontend
bun install
```

---

## 6. Start the frontend

```bash
cd frontend
bun run dev
```

---

## 7. Smoke test checklist

### US1 — Ungenerated charges alert
- [ ] Navigate to the Payments page with at least one fee rule that has unbilled students.
- [ ] Banner appears with the billing period and unbilled count.
- [ ] Click "Generate Charges" — navigates to the Fee Rules settings tab.
- [ ] After generating, banner disappears on next page load.

### US2 — Multi-class fee rule scope
- [ ] Open Settings → Fee Rules → New Rule.
- [ ] Select scope type "Class" — the class field allows multiple selections.
- [ ] Save the rule. The scope column in the fee rules table shows all selected class names (not IDs).
- [ ] Edit the rule — previously selected classes are pre-checked.

### US3 — System payment categories
- [ ] Open Settings → Payment Categories.
- [ ] `Fees`, `Transport`, `Transport + Fees` appear at the top with a lock/badge indicator.
- [ ] Edit and Delete buttons are disabled for these three rows.
- [ ] Attempting `DELETE /api/settings/payment-categories/__fees` via API tool returns 403/404.
- [ ] User-defined categories can still be added, edited, and deleted normally.

### US4 — Receipt number
- [ ] Record a new payment.
- [ ] The payment row shows a receipt number in format `YYYY.MM.DD.HHmmss.X`.
- [ ] Navigate to the receipt URL (`/receipts/:paymentId`) — receipt number is displayed.
- [ ] Legacy payments (no `receipt_number`) display the payment ID as fallback.

### US5 — Payment snapshot
- [ ] Record a payment for a student in class "Form 3A". Note the receipt number.
- [ ] Rename the class to "Form 3B" in Settings.
- [ ] Retrieve the payment receipt — class name shows "Form 3A" (snapshot preserved).
- [ ] The payment record in the student ledger shows snapshotted class name.

---

## 8. Key files modified by this feature

### Backend
| File | Change |
|---|---|
| `app/Database/Migrations/2026-05-04-000001_*` | New migration |
| `app/Database/Migrations/2026-05-04-000002_*` | New migration |
| `app/Controllers/Api/PaymentController.php` | Receipt number + snapshot generation |
| `app/Controllers/Api/ReceiptController.php` | Prefer snapshot for class name |
| `app/Controllers/Api/SettingsController.php` | System category injection + guards |
| `app/Controllers/Api/FeeRuleController.php` | Multi-class `assignmentScopeId` array support |
| `app/Models/PaymentModel.php` | `allowedFields` + `formatForApi` update |
| `app/Models/FeeRuleModel.php` | `buildScopeLabel` prefix + `decodeScopeId` |
| `app/Services/FeeRuleBillingService.php` | Multi-class `getEligibleStudents` branch |
| `app/Config/PaymentCategories.php` | New — system categories constant |
| `tests/Integration/PaymentBillingUxTest.php` | New — integration tests |

### Frontend
| File | Change |
|---|---|
| `src/api/api.ts` | `FeeRule`, `FeeRuleInput`, `Payment`, `PaymentSnapshot` types |
| `src/components/modals/RecordPaymentModal.tsx` | Remove hard-coded `TRANSPORT_CATEGORIES`; use API-supplied system categories |
| `src/components/modals/FeeRuleModal.tsx` | Multi-select class picker |
| `src/components/settings/FeeRulesPanel.tsx` | Scope column: resolve class names from local list |
| `src/components/settings/PaymentCategoriesTab.tsx` | Lock/badge for system categories |
| `src/pages/Payments.tsx` (or equivalent) | Unbilled charges alert banner |
| `src/constants/paymentCategories.ts` | New — system categories constant |

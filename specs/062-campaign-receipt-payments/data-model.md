# Data Model: Campaign Receipt & Payments Integration

**Feature**: 062-campaign-receipt-payments  
**Date**: 2026-05-05

> **No new database tables.** All required columns already exist. This document describes the existing schema fields used by this feature, the snapshot shape being introduced, and the state transitions that govern campaign student records.

---

## Existing Tables Used

### `payments`

| Column | Type | Added by | Purpose in this feature |
|--------|------|----------|------------------------|
| `id` | VARCHAR(36) PK | original | Primary key |
| `tenant_id` | VARCHAR(36) | original | Tenant isolation |
| `student_id` | VARCHAR(36) | original | Owner student |
| `amount` | DECIMAL(10,2) | original | Payment amount |
| `date` | DATE | original | Payment date |
| `method` | VARCHAR(50) | original | Payment method |
| `category` | VARCHAR(100) | original | Set to campaign name at insert time |
| `fee_campaign_id` | VARCHAR(36) NULL | feature 059 | FK to `fee_campaigns.id`; non-null = campaign payment; excluded from ledger |
| `receipt_number` | VARCHAR(25) NULL | feature 057 | Unique receipt identifier per tenant |
| `snapshot` | JSON NULL | feature 057 | **Gap being filled**: currently NULL for campaign payments |
| `balance_after_payment` | DECIMAL(10,2) NULL | feature 057 | Left NULL for campaign payments (not a ledger balance) |
| `is_general_payment` | TINYINT(1) | feature 061 | Left 0/NULL for campaign payments |

**Change required**: `FeeCampaignService::recordPayment()` must populate `snapshot` at insert time. No migration needed.

---

### `campaign_students`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) PK | |
| `tenant_id` | VARCHAR(36) | |
| `fee_campaign_id` | VARCHAR(36) | FK to `fee_campaigns.id` |
| `student_id` | VARCHAR(36) | FK to `students.id` |
| `expected_amount` | DECIMAL(10,2) | Campaign's required amount, copied at enrollment |
| `paid_amount` | DECIMAL(10,2) | Running total; updated atomically with payment insert |
| `status` | ENUM | `unpaid` / `partially_paid` / `fully_paid` |

**No changes.** Manual `addStudent` path creates rows with `paid_amount = 0, status = 'unpaid'` using this exact schema.

---

### `fee_campaigns`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) PK | |
| `tenant_id` | VARCHAR(36) | |
| `name` | VARCHAR(200) | Used as `payments.category` and in snapshot `campaignName` |
| `amount` | DECIMAL(10,2) | Per-student expected amount |
| `status` | ENUM | `active` / `closed` |

**No changes.** `campaign.name` and `campaign.amount` are read during payment recording and embedded in the snapshot.

---

## Snapshot JSON Shape

The `snapshot` column stores an immutable JSON object at the moment of payment recording. Field names use camelCase to match the existing snapshot format from feature 057.

```json
{
  "studentName":    "Jane Doe",
  "className":      "Grade 7A",
  "campaignName":   "Grade 7 Exam Fee",
  "expectedAmount": 50.00,
  "paidBefore":     0.00,
  "amountPaid":     30.00,
  "remainingAfter": 20.00,
  "paymentMethod":  "Cash",
  "paymentDate":    "2026-05-05"
}
```

| Field | Source | Description |
|-------|--------|-------------|
| `studentName` | `students.first_name + last_name` (live at payment time) | Frozen student name for receipt accuracy |
| `className` | `classes.name` via `students.class_id` (live at payment time) | Frozen class name |
| `campaignName` | `fee_campaigns.name` | Campaign name; also the receipt's source label |
| `expectedAmount` | `campaign_students.expected_amount` | The full amount owed |
| `paidBefore` | `campaign_students.paid_amount` (before update) | Paid total before this payment |
| `amountPaid` | `data['amount']` | This payment's amount |
| `remainingAfter` | `expected - (paidBefore + amountPaid)` | Remaining balance after this payment |
| `paymentMethod` | `data['method']` | Payment method |
| `paymentDate` | `data['date']` or today | Payment date |

---

## State Transitions: `campaign_students.status`

```
          [addStudent]
               │
               ▼
           ┌──────┐
           │unpaid│  paid_amount = 0
           └──┬───┘
              │  recordPayment(amount < remaining)
              ▼
      ┌──────────────┐
      │partially_paid│  0 < paid_amount < expected_amount
      └──────┬───────┘
             │  recordPayment(amount = remaining)
             ▼
        ┌──────────┐
        │fully_paid│  paid_amount = expected_amount
        └──────────┘
             │
             ╳  (no further payments allowed — 400 overpayment guard)
```

---

## Validation Rules

| Rule | Where enforced |
|------|----------------|
| `amount > 0` | `FeeCampaignService::recordPayment()` line 143 |
| `amount ≤ remaining` | `FeeCampaignService::recordPayment()` line 140 |
| `status ≠ fully_paid` before payment | `FeeCampaignService::recordPayment()` line 134 |
| Campaign must be `active` | `FeeCampaignService::recordPayment()` line 125 and `addStudent()` line 217 |
| Student must belong to same tenant | `FeeCampaignService::addStudent()` line 221 |
| No duplicate `(fee_campaign_id, student_id)` | `FeeCampaignService::addStudent()` line 230 + UNIQUE DB constraint |
| Snapshot + payment insert atomic | `transStart / transComplete` wrapping |

---

## No Migration Required

All columns (`payments.snapshot`, `payments.receipt_number`, `payments.fee_campaign_id`) already exist in the live schema. The only code change is populating `snapshot` in `FeeCampaignService::recordPayment()`.

# Data Model: Fee Campaign

**Feature**: 059-fee-campaign  
**Date**: 2026-05-04

## New Tables

### `fee_campaigns`

Represents an event-based fee collection initiative.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | VARCHAR(50) | PK | Prefixed ID (e.g., `fc_1714834200_a1b2c3d4`) |
| `tenant_id` | VARCHAR(50) | NOT NULL, FK → tenants(id), INDEX | Tenant isolation |
| `name` | VARCHAR(255) | NOT NULL | Campaign display name (e.g., "Grade 7 Exam Fee") |
| `description` | TEXT | NULL | Optional long description |
| `target_scope_type` | VARCHAR(20) | NOT NULL | `school_wide` or `class` |
| `target_scope_id` | TEXT | NULL | Class ID(s). NULL for school_wide. JSON array for multi-class (e.g., `["cls_1","cls_2"]`) |
| `amount` | DECIMAL(10,2) | NOT NULL | Required amount per student |
| `due_date` | DATE | NULL | Optional due date |
| `status` | VARCHAR(10) | NOT NULL, DEFAULT 'active' | `active` or `closed` |
| `created_by` | VARCHAR(50) | NULL | User ID who created the campaign |
| `created_at` | DATETIME | NOT NULL | Auto-managed by CI4 |
| `updated_at` | DATETIME | NOT NULL | Auto-managed by CI4 |

**Indexes**:
- `idx_fc_tenant_id` on (`tenant_id`)
- `uq_fc_tenant_name` UNIQUE on (`tenant_id`, `name`) — enforces FR-003

**Validation rules**:
- `name` required, max 255 chars, unique per tenant
- `amount` required, > 0, max 1,000,000
- `target_scope_type` must be one of: `school_wide`, `class`
- `status` must be one of: `active`, `closed`

---

### `campaign_students`

Tracks each student's individual payment progress within a campaign.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | VARCHAR(50) | PK | Prefixed ID (e.g., `cs_1714834200_a1b2c3d4`) |
| `tenant_id` | VARCHAR(50) | NOT NULL, FK → tenants(id), INDEX | Tenant isolation |
| `fee_campaign_id` | VARCHAR(50) | NOT NULL, FK → fee_campaigns(id), INDEX | Parent campaign |
| `student_id` | VARCHAR(50) | NOT NULL, FK → students(id), INDEX | Assigned student |
| `expected_amount` | DECIMAL(10,2) | NOT NULL | Amount the student is expected to pay |
| `paid_amount` | DECIMAL(10,2) | NOT NULL, DEFAULT 0.00 | Total paid so far |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'unpaid' | `unpaid`, `partially_paid`, `fully_paid` |
| `created_at` | DATETIME | NOT NULL | Auto-managed by CI4 |
| `updated_at` | DATETIME | NOT NULL | Auto-managed by CI4 |

**Indexes**:
- `idx_cs_tenant_id` on (`tenant_id`)
- `idx_cs_campaign_id` on (`fee_campaign_id`)
- `idx_cs_student_id` on (`student_id`)
- `uq_cs_campaign_student` UNIQUE on (`fee_campaign_id`, `student_id`) — prevents duplicate assignment

**Derived fields** (computed, not stored):
- `remaining_amount` = `expected_amount` - `paid_amount`

**Status transitions**:
- `unpaid` → `partially_paid` (when 0 < paid < expected after payment)
- `unpaid` → `fully_paid` (when paid = expected after payment)
- `partially_paid` → `fully_paid` (when paid = expected after payment)

**Validation rules**:
- `paid_amount` must never exceed `expected_amount` (enforced at service level, FR-010)

---

## Modified Tables

### `payments` (additive change)

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `fee_campaign_id` | VARCHAR(50) | NULL, FK → fee_campaigns(id), INDEX | References the campaign this payment is allocated to. NULL for standard (non-campaign) payments. |

**Migration notes**:
- Add column with DEFAULT NULL (backward-compatible — all existing rows remain NULL)
- Add index `idx_pay_fee_campaign_id` on (`fee_campaign_id`)
- No NOT NULL constraint — column is optional

**Impact on existing code**:
- `PaymentModel::$allowedFields` — add `fee_campaign_id`
- `PaymentModel::formatForApi()` — add `feeCampaignId` to output
- `LedgerService::getStudentBalance()` — add `WHERE fee_campaign_id IS NULL` to fee payment queries (research R5)

---

## Entity Relationships

```
tenants (1) ──── (N) fee_campaigns
fee_campaigns (1) ──── (N) campaign_students
students (1) ──── (N) campaign_students
fee_campaigns (1) ──── (N) payments  (via fee_campaign_id FK)
```

- A tenant can have many campaigns.
- A campaign has many student records.
- A student can belong to many campaigns (independent records per campaign).
- A campaign can have many payments linked to it (one per student per payment event).
- Payments linked to a campaign are excluded from the standard ledger balance.

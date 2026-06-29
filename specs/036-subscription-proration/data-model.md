# Data Model: Subscription Proration

**Feature**: 036-subscription-proration  
**Created**: 2026-04-16

## Overview

This document defines the data entities required for subscription proration. The proration system extends the existing subscription infrastructure with credit tracking and calculation audit capabilities.

## Existing Entities (Reused)

### subscription_plans
| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) | Primary key (UUID) |
| name | VARCHAR(100) | Plan name (e.g., "Basic", "Pro") |
| max_students | INT | Student limit (NULL for unlimited) |
| monthly_price_cents | INT | Monthly price in cents |
| annual_price_cents | INT | Annual price in cents |
| currency | VARCHAR(3) | ISO currency code (e.g., "USD") |
| sort_order | INT | Display/priority order |
| is_active | TINYINT | Whether plan is available |

### school_subscriptions
| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) | Primary key (UUID) |
| tenant_id | VARCHAR(36) | FK to tenants |
| plan_id | VARCHAR(36) | FK to subscription_plans |
| billing_cycle | ENUM('monthly','annual') | Billing interval |
| status | ENUM('pending','active','expired','cancelled','superseded') | Subscription state |
| starts_at | DATETIME | Subscription start |
| expires_at | DATETIME | Subscription end (NULL for pending) |
| amount_paid_cents | INT | Amount paid for this period |
| currency | VARCHAR(3) | ISO currency code |
| activated_at | DATETIME | When activated |

### subscription_transactions
| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) | Primary key (UUID) |
| tenant_id | VARCHAR(36) | FK to tenants |
| subscription_id | VARCHAR(36) | FK to school_subscriptions |
| our_reference | VARCHAR(50) | Internal reference |
| paynow_reference | VARCHAR(50) | Payment gateway reference |
| amount_cents | INT | Transaction amount |
| currency | VARCHAR(3) | ISO currency code |
| status | ENUM('initiated','paid','failed','cancelled') | Payment status |
| initiated_at | DATETIME | When initiated |
| completed_at | DATETIME | When completed |

## New Entities

### proration_calculations

Stores audit trail of all proration calculations for transparency and support.

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) | Primary key (UUID) |
| tenant_id | VARCHAR(36) | FK to tenants - **indexed** |
| original_subscription_id | VARCHAR(36) | FK to school_subscriptions (old plan) |
| new_subscription_id | VARCHAR(36) | FK to school_subscriptions (new plan) - nullable until confirmed |
| original_plan_id | VARCHAR(36) | FK to subscription_plans |
| new_plan_id | VARCHAR(36) | FK to subscription_plans |
| billing_cycle | ENUM('monthly','annual') | Billing interval |
| cycle_start_date | DATE | Original cycle start |
| cycle_end_date | DATE | Original cycle end |
| days_in_cycle | INT | Total days in billing period |
| days_remaining | INT | Days remaining when upgrade initiated |
| original_plan_price_cents | INT | Full price of original plan |
| new_plan_price_cents | INT | Full price of new plan |
| unused_value_credit_cents | INT | Calculated credit for unused time |
| prorated_charge_cents | INT | Calculated charge for remaining time on new plan |
| net_amount_cents | INT | Net charge (may be negative for downgrades) |
| calculation_formula | TEXT | Formula used (for audit) |
| status | ENUM('calculated','confirmed','cancelled','failed') | Calculation state |
| created_at | DATETIME | When calculated |
| confirmed_at | DATETIME | When user confirmed |
| cancelled_at | DATETIME | If cancelled |

**Indexes**:
- PRIMARY: id
- tenant_id + created_at (for tenant-scoped queries)
- original_subscription_id (for lookup by original subscription)

### subscription_credits

Tracks credit balances from downgrades or other proration scenarios.

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) | Primary key (UUID) |
| tenant_id | VARCHAR(36) | FK to tenants - **indexed** |
| proration_calculation_id | VARCHAR(36) | FK to proration_calculations - nullable |
| subscription_id | VARCHAR(36) | FK to school_subscriptions that generated credit |
| initial_amount_cents | INT | Original credit amount |
| remaining_amount_cents | INT | Current remaining balance |
| currency | VARCHAR(3) | ISO currency code |
| reason | ENUM('downgrade_proration','upgrade_discount','manual_adjustment') | Credit origin |
| status | ENUM('active','fully_used','expired','refunded') | Credit state |
| expires_at | DATETIME | Expiration date (NULL for no expiry) |
| created_at | DATETIME | When credit created |
| updated_at | DATETIME | Last modification |

**Indexes**:
- PRIMARY: id
- tenant_id + status (for active credit lookups)
- subscription_id (for lookup by originating subscription)

### credit_applications

Links credits to transactions where they were applied.

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) | Primary key (UUID) |
| credit_id | VARCHAR(36) | FK to subscription_credits |
| transaction_id | VARCHAR(36) | FK to subscription_transactions |
| amount_applied_cents | INT | Amount of credit used |
| applied_at | DATETIME | When applied |

## Entity Relationships

```
school_subscriptions ||--o{ proration_calculations : "generates"
subscription_plans ||--o{ school_subscriptions : "defines"
school_subscriptions ||--o{ subscription_credits : "may generate"
proration_calculations ||--o{ subscription_credits : "may create"
subscription_credits ||--o{ credit_applications : "applied via"
credit_applications ||--o{ subscription_transactions : "to transaction"
```

## Calculation Formula

The proration calculation follows this formula (stored in `calculation_formula`):

```
Daily Rate (Original) = original_plan_price_cents / days_in_cycle
Unused Value Credit   = Daily Rate (Original) * days_remaining
                      = (original_plan_price_cents / days_in_cycle) * days_remaining

Daily Rate (New)      = new_plan_price_cents / days_in_cycle  
Prorated Charge       = Daily Rate (New) * days_remaining
                      = (new_plan_price_cents / days_in_cycle) * days_remaining

Net Amount            = Prorated Charge - Unused Value Credit
```

**Rounding**: All intermediate calculations use integer cents. Division uses standard rounding (0.5 rounds up).

## Migration Files Required

1. **2026-04-16-100000_Create_proration_calculations_table.php**
2. **2026-04-16-100001_Create_subscription_credits_table.php**
3. **2026-04-16-100002_Create_credit_applications_table.php**

## Validation Rules

1. `days_remaining` must be >= 0 and <= `days_in_cycle`
2. `net_amount_cents` may be negative (indicating net credit to customer)
3. All amounts stored in cents (integer) to avoid floating-point errors
4. `tenant_id` must be present on all new entities (per Constitution I)

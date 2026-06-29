# Data Model: Finance Control Center

**Branch**: `080-finance-control-center`  
**Date**: 2026-05-21

## Overview

No new database tables are required for this feature. The finance control center is built from existing subscription, invoice, payment, and tenant records with backend-prepared summaries and chart buckets.

---

## Existing Data Sources

### `subscription_invoices`

| Field | Meaning |
|-------|---------|
| `id` | Invoice identifier |
| `tenant_id` | Owning school/tenant |
| `transaction_id` | Linked payment transaction, if available |
| `amount_cents` | Invoice amount in cents |
| `issued_at` | Invoice issue timestamp |
| `pdf_path` | Generated invoice file path |

### `subscription_payment_transactions`

| Field | Meaning |
|-------|---------|
| `id` | Payment transaction identifier |
| `subscription_id` | Related subscription |
| `tenant_id` | Owning school/tenant |
| `amount_cents` | Transaction amount in cents |
| `status` | Payment outcome such as initiated, completed, or failed |
| `created_at` | Transaction timestamp |

### `school_subscriptions`

| Field | Meaning |
|-------|---------|
| `id` | Subscription identifier |
| `tenant_id` | Owning school/tenant |
| `plan_id` | Current subscription plan |
| `billing_cycle` | Monthly or annual billing cadence |
| `status` | Subscription lifecycle status |
| `starts_at` | Start timestamp |
| `expires_at` | Expiration timestamp |
| `cancelled_at` | Cancellation timestamp |

### `subscription_plans`

| Field | Meaning |
|-------|---------|
| `id` | Plan identifier |
| `name` | Plan display name |
| `max_students` | Capacity limit for the plan |
| `monthly_price_cents` | Monthly price in cents |
| `annual_price_cents` | Annual price in cents |
| `currency` | Plan currency |

### `tenants`

| Field | Meaning |
|-------|---------|
| `id` | Tenant identifier |
| `name` | School name |
| `email` | Contact email |
| `status` | Tenant lifecycle status |

---

## Derived View Models

### Finance Summary Snapshot

Represents the top-level KPI area on the page.

| Field | Meaning |
|-------|---------|
| `totalRevenue` | Total recognized revenue for the current scope |
| `pendingAmount` | Amount awaiting completion or settlement |
| `failedAmount` | Amount tied to failed payment activity |
| `invoiceCount` | Number of invoices in scope |
| `mrr` | Monthly recurring revenue |
| `failedPaymentsCount` | Count of subscriptions with latest payment failure |
| `renewalsDueCount` | Count of active subscriptions expiring soon |
| `monthlyChurnCount` | Count of cancellations in the current month |
| `growthRate` | Period-over-period revenue growth |

### Finance Trend Bucket

Represents the chart series rendered on the page.

| Field | Meaning |
|-------|---------|
| `month` | Month label used for chart axis |
| `value` | Revenue or other charted metric for that month |
| `comparisonValue` | Optional prior-period reference value |
| `deltaPercent` | Optional change percentage |

### Finance Filter Context

Represents the currently selected report scope.

| Field | Meaning |
|-------|---------|
| `from` | Start date of the report window |
| `to` | End date of the report window |
| `status` | Invoice or payment status filter |
| `tenantId` | Optional tenant scope when supported by the platform view |
| `exportFormat` | Current export target such as CSV or report download |

### Operational Finance Item

Represents one row or alert card in the operational section.

| Field | Meaning |
|-------|---------|
| `type` | Overdue invoice, recent transaction, payout summary, revenue breakdown, or payment health alert |
| `title` | Short label shown to the user |
| `amount` | Relevant monetary value, if any |
| `status` | Semantic state such as positive, warning, neutral, or critical |
| `date` | Relevant timestamp or date |
| `reference` | Human-readable identifier for drill-down |

### Export Artifact

Represents a downloadable output from the finance page.

| Field | Meaning |
|-------|---------|
| `filename` | Downloaded file name |
| `format` | CSV or report |
| `filterContext` | Filters used to generate the file |
| `rowCount` | Number of records included |
| `generatedAt` | Time the export was created |

---

## Relationships

- A tenant can have many invoices, subscriptions, payments, and operational finance items.
- A subscription can have many payment transactions.
- A payment transaction can be linked to one invoice snapshot and may contribute to summary metrics.
- A filter context determines which summary snapshot, trend buckets, and operational items are returned together.
- An export artifact is generated from the same filter context as the visible dashboard.

---

## Validation Rules

- All finance summaries must remain tenant-scoped when tenant data is involved.
- Summary values and chart buckets must be derived from the same reporting window.
- Exported data must match the currently selected filter context.
- Currency values must be normalized before display so whole numbers and decimals remain readable.
- Status labels must map to a bounded set of semantic states so the UI can color-code them consistently.

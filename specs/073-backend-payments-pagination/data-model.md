# Data Model: Backend Payments Pagination

**Feature**: 073-backend-payments-pagination  
**Date**: 2026-05-13

## Entity: PaymentQuery

Represents a user's requested payment-history view.

### Fields

- `page`: Positive integer page number. Defaults to 1.
- `limit`: Positive integer page size, bounded by a backend maximum.
- `search`: Optional text term applied across supported payment/student fields.
- `method`: Optional payment method filter.
- `category`: Optional payment category filter, including uncategorized support where existing UI exposes it.
- `classId`: Optional class filter for student-linked payments.
- `studentId`: Optional student filter for student-specific payment history.
- `dateFrom`: Optional inclusive start date.
- `dateTo`: Optional inclusive end date.
- `month`: Optional month filter retained for existing payments UI compatibility.
- `year`: Optional year filter retained for existing payments UI compatibility.
- `paymentType`: Optional classification filter where required by existing UI, such as system, general, campaign, or grouped payments.
- `sortBy`: Optional allowlisted sort field.
- `sortOrder`: Optional `asc` or `desc` direction.

### Validation Rules

- `page` must be at least 1.
- `limit` must be at least 1 and must not exceed the backend maximum.
- `month` must be 1-12 when supplied.
- `year` must be a valid positive year when supplied.
- `dateFrom` and `dateTo` must be valid dates when supplied.
- `dateFrom` must not be after `dateTo`.
- `sortBy` must be allowlisted.
- `sortOrder` must be `asc` or `desc`.
- Tenant scope must come from authenticated user context, not query input.

## Entity: PaymentRecord

Represents a payment row returned to a payment-history consumer.

### Fields

- `id`: Payment identifier.
- `tenantId`: Tenant identifier included for existing response compatibility.
- `studentId`: Linked student identifier.
- `amount`: Payment amount.
- `date`: Payment date.
- `method`: Payment method.
- `description`: Payment description.
- `category`: Payment category.
- `receiptNumber`: Human-readable receipt reference.
- `feeCampaignId`: Optional linked fee campaign identifier.
- `isGeneralPayment`: Whether the payment is a non-ledger general payment.
- `paymentGroupId`: Optional multi-category group identifier.
- `balanceAfterPayment`: Optional balance snapshot after payment.
- `student`: Optional backend-prepared student display data.

### Relationships

- Belongs to one tenant.
- Belongs to one student.
- May belong to one fee campaign.
- May belong to one grouped payment.
- Student display data may include class display data.

### Validation Rules

- Returned records must be tenant-scoped.
- Returned records must respect role authorization.
- Related student/class display fields must be prepared by backend joins or bounded batch loading, not frontend lookup against full student lists.

## Entity: PaymentResultPage

Represents the processed response for a payment-history request.

### Fields

- `data`: Array of `PaymentRecord` rows for the requested page only.
- `pagination.page`: Current page.
- `pagination.limit`: Requested page size after backend bounds are applied.
- `pagination.total`: Total matching records across the full filtered dataset.
- `pagination.totalPages`: Total number of pages.
- `summary`: Backend-computed `PaymentSummary` for the full filtered dataset.
- `filters`: Optional normalized filter metadata returned for UI display/debugging.

### Validation Rules

- `data.length` must not exceed `pagination.limit`.
- `summary` must use the same tenant scope and filters as `data` and `pagination.total`.
- Empty results must return `data: []` and zero-valued summaries.

## Entity: PaymentSummary

Represents backend-computed metrics aligned to a payment query.

### Fields

- `totalAmount`: Sum of matching payment amounts.
- `totalCount`: Count of matching payments.
- `totalThisMonth`: Existing current-month total where required by the payments page.
- `paymentsToday`: Existing today's payment count where required by the payments page.
- `totalOutstanding`: Existing outstanding balance metric, derived from ledger source records.
- `byMethod`: Optional breakdown by payment method.
- `byCategory`: Optional breakdown by payment category.
- `latestPaymentDate`: Optional most recent matching payment date.
- `daysSinceLastPayment`: Optional derived metric for student payment history.

### Validation Rules

- Must not be computed from visible page rows unless the metric is explicitly page-only.
- Must follow existing ledger and payment classification rules.
- Must exclude or include general payments, campaign payments, and system categories according to existing business rules for each metric.

## Entity: PaymentHistoryContext

Represents related features that consume payment history.

### Contexts

- Main payments table.
- Student payment history modal.
- Receipt/detail views.
- Reconciliation views that list or summarize payments.
- Student fee statement payment history where applicable.

### Rules

- Contexts displaying payment history must request processed backend pages.
- Contexts requiring a single receipt or detail must request only that detail.
- Contexts must not fetch full tenant or full student payment history for local sorting, pagination, or summary calculations.

## Index Candidates for Implementation Review

Implementation should inspect current schema before adding new migrations. Candidate access patterns include:

- Tenant + date descending payment history.
- Tenant + student + date payment history.
- Tenant + method/category + date filters.
- Tenant + receipt number search/detail lookup.
- Tenant + payment group lookup.
- Student tenant/class joins for class filters and student display fields.

Any missing database support must be added through new migrations only.

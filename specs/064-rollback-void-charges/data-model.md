# Data Model: Roll Back or Void Generated Charges

## Generated Charge Batch

Represents one charge generation event for a tenant and charge source.

### Fields

- **id**: Unique batch identifier.
- **tenant_id**: School tenant that owns the batch; always sourced from JWT context in API operations.
- **charge_type**: Source classification for rollback. Allowed values for this feature: `fee_structure`, `transport`.
- **period_key**: Billing period identifier used for duplicate detection and display, such as a term ID or `YYYY-MM` month.
- **period_label**: Human-readable label used in confirmations, such as `TERM-2-2026` or `TERM-2-JUNE-2026`.
- **status**: Batch lifecycle state. Allowed values: `completed`, `voided`.
- **total_charges**: Count of charges generated in the batch.
- **total_amount**: Sum of generated charge amounts in the batch.
- **generated_by**: User who generated the charges.
- **generated_at**: Timestamp when generation completed.
- **voided_by**: User who reversed the batch, if voided.
- **voided_at**: Timestamp when the batch was reversed, if voided.
- **void_reason**: Optional administrator reason for the reversal.

### Relationships

- One Generated Charge Batch has many Charges.
- One Generated Charge Batch may have one Charge Reversal once voided.
- Generated Charge Batch belongs to one tenant.

### Validation Rules

- `tenant_id` is required and must match the authenticated user's tenant.
- `charge_type` must be one of `fee_structure` or `transport`.
- Only the latest non-voided batch for a tenant and charge type can transition to `voided`.
- A batch cannot transition from `voided` back to `completed`.

### State Transitions

```text
completed -> voided
```

## Charge

Represents a student billing item produced by fee rule or transport generation.

### Fields Relevant to This Feature

- **id**: Unique charge identifier.
- **tenant_id**: School tenant that owns the charge.
- **student_id**: Student being charged.
- **charge_type**: `fee_structure` for fee rule charges, `transport` for transport charges.
- **amount**: Charge amount.
- **description**: Canonical generated label.
- **billing_run_id** or **generation_batch_id**: Batch association used for latest-batch rollback.
- **billing_period**: Period used by fee rule generation.
- **academic_session**: Existing transport month identifier where transport generation uses `YYYY-MM`.
- **term_id**: Term association when available.
- **route_id**: Transport route association for transport charges.
- **fee_rule_id**: Fee rule association for fee rule charges.
- **status**: Existing collection status.
- **voided_at**: Non-null when the charge is no longer collectible.
- **voided_by**: User who voided the charge.
- **deleted_at**: Soft-delete marker; not the primary reversal mechanism.

### Validation Rules

- New fee rule charges must use `TERM-{termNumber}-{year} Fee Rules Charges` as the base description.
- New transport charges must use `TERM-{termNumber}-{monthName}-{year} Transport Charges` as the base description.
- Voided charges must be excluded from outstanding balance calculations.
- Payment records related to a charge must not be deleted during charge reversal.

## Charge Reversal

Represents the audit event produced when a latest generated batch is voided.

### Fields

- **id**: Unique reversal identifier.
- **tenant_id**: School tenant that owns the reversal.
- **batch_id**: Generated Charge Batch that was reversed.
- **charge_type**: `fee_structure` or `transport`.
- **period_label**: Label displayed and audited for the reversed period.
- **charge_count**: Number of charges voided.
- **total_amount**: Total amount voided.
- **affected_student_count**: Number of distinct students affected.
- **reason**: Optional administrator-provided reason.
- **created_by**: User who performed the reversal.
- **created_at**: Reversal timestamp.

### Relationships

- One Charge Reversal belongs to one Generated Charge Batch.
- One Charge Reversal belongs to one tenant.

### Validation Rules

- Only one Charge Reversal may exist for a Generated Charge Batch.
- Reversal totals must match the charges voided in the same transaction.

## Student Balance

Represents the calculated financial position for a student.

### Rules

- Balance remains derived from source records at query time.
- Active charges include only charges with `deleted_at IS NULL` and `voided_at IS NULL`.
- Voiding a charge decreases the student's active charges by the voided amount.
- Payments remain visible and traceable after charge reversal.

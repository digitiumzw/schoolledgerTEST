# Research: Roll Back or Void Generated Charges

## Decision: Use soft voiding, not hard deletion, for rollback

**Rationale**: The existing ledger already excludes charges where `voided_at` is not null and the constitution requires financial ledger integrity. Soft voiding keeps historical records visible, preserves payment history, and allows reports to distinguish active from reversed charges.

**Alternatives considered**:

- Hard delete generated charges: rejected because it removes financial history and conflicts with audit needs.
- Soft delete via `deleted_at`: rejected as the primary reversal mechanism because `voided_at` already exists for financial voiding semantics and is clearer for audits.
- Negative adjustment charges: rejected as the default because it complicates outstanding balance reporting; may be needed only if implementation discovers payment allocation constraints that prevent simple voiding.

## Decision: Track latest generated batches separately by charge type

**Rationale**: The feature requires fee rule and transport charges to be reversed independently. Existing data already classifies charges with `charge_type` values such as `fee_structure` and `transport`, and `billing_runs` already exists with voiding fields. The plan should use or complete batch tracking so the latest non-reversed batch can be identified by `tenant_id` and charge type.

**Alternatives considered**:

- Determine latest charges by `date_generated` only: rejected because multiple batches may share a date and cannot be reliably reversed as one generation event.
- Add separate transport and fee rollback tables: rejected because it duplicates billing run concepts already present.
- Use `generation_batch_id` only: possible fallback, but `billing_runs` gives richer status, totals, and audit fields.

## Decision: Add a shared backend service for latest-batch summary and rollback execution

**Rationale**: Fee rule and transport rollback rules are nearly identical except for charge type and period labels. A shared service reduces duplication, keeps tenant filtering consistent, and centralizes transaction handling.

**Alternatives considered**:

- Implement rollback directly in both controllers: rejected due to duplicated ledger-sensitive logic.
- Implement rollback only in frontend: rejected because frontend must not own business logic and cannot enforce tenant isolation.

## Decision: Expose separate REST endpoints for fee rule and transport rollback surfaces

**Rationale**: The user experience and feature requirement treat the two charge types independently. Separate endpoints avoid ambiguous request bodies and make authorization/testing straightforward.

**Alternatives considered**:

- Single endpoint with `chargeType` body parameter: viable, but separate resource paths are clearer and align with existing `/fee-rules/*` and `/transport/*` route groups.
- Reuse DELETE on charge collections: rejected because the operation is not a generic delete; it is a financial void of the latest generated batch.

## Decision: Generate descriptive labels in backend generation flows

**Rationale**: Descriptions must be consistent across ledgers and reports. Backend-owned formatting guarantees all API consumers receive the same label and prevents UI-only labeling gaps.

**Alternatives considered**:

- Format labels in frontend only: rejected because reports/API consumers would still see inconsistent raw descriptions.
- Append labels to existing route/rule names: rejected as the required examples specify a canonical label format.

## Decision: Preserve payment records and block or clearly summarize risky reversals

**Rationale**: Payments in the current system are separate records and balances are computed from source records. Reversal must not delete payments. If charges in the latest batch have related payment activity, the implementation must either void charges while preserving payments or present a blocked/partial summary according to final payment-allocation behavior.

**Alternatives considered**:

- Refuse every rollback when any payment exists: safe but too restrictive for legitimate correction workflows.
- Always void paid charges without warning: rejected because administrators need visibility into balance impact.

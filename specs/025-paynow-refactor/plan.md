# Implementation Plan: Refactor Paynow Integration

**Branch**: `025-paynow-refactor` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-paynow-refactor/spec.md`

## Summary

Fix three confirmed bugs and one code-quality issue in the existing Paynow payment integration used for subscription billing. The changes are confined to two backend files: `PaynowService.php` and `SubscriptionController.php`. No schema changes, no frontend changes, no new dependencies.

**Bugs addressed**:
- **B-1**: `verifyHash` accepts a `$receivedHash` parameter that is never actually used in the hash comparison — the SDK reads `$post['hash']` internally, making the parameter misleading.
- **B-2**: `paynow_reference` (Paynow's own transaction ID) is never stored from webhook callbacks, breaking reconciliation.
- **B-3**: `initiate()` accepts a `$currency` parameter that the Paynow PHP SDK ignores — decorative dead parameter.
- **B-4** (minor): `paynow_hash_verified` and `webhook_payload` are written for any hash-valid callback regardless of status — behaviour is intentional for debugging but should be documented.

## Technical Context

**Language/Version**: PHP 8.1+
**Primary Dependencies**: CodeIgniter 4, `paynow/php-sdk` (already installed in `backend/vendor/`)
**Storage**: MySQL — `subscription_payment_transactions` table (no schema changes needed)
**Testing**: Manual HTTP testing via curl / Postman; hash simulation via PHP snippet in quickstart.md
**Target Platform**: Linux server (local dev via `php spark serve`)
**Project Type**: Web service (REST API backend)
**Performance Goals**: Standard web response time; no throughput concern for this change
**Constraints**: Webhook endpoint must remain public (no JWT); hash verification is the only security boundary
**Scale/Scope**: Two files modified, four targeted bug fixes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| **I. Multi-Tenant Isolation** | Webhook is public by design; lookup by `our_reference` (unique index) is safe. Storing `paynow_reference` does not expose cross-tenant data. The `getAllForTenant` query already filters by `tenant_id`. | ✅ Pass |
| **II. API-First Separation** | Changes are backend-only. No frontend logic added. API response shapes are unchanged. | ✅ Pass |
| **III. JWT Auth & RBAC** | Only the webhook endpoint is public — this is pre-existing and intentional (Paynow cannot attach a JWT). All other subscription endpoints remain JWT-protected with role guards. | ✅ Pass |
| **IV. Immutable Migrations** | No schema changes. Existing migration `2026-04-10-120000` is not touched. | ✅ Pass |
| **V. Financial Ledger Integrity** | No ledger (charges/payments) queries touched. Subscription activation logic is unchanged. | ✅ Pass |

**Post-design re-check**: All principles remain satisfied after Phase 1 design. No exceptions required.

## Project Structure

### Documentation (this feature)

```text
specs/025-paynow-refactor/
├── plan.md              ← this file
├── spec.md              ← feature specification
├── research.md          ← Phase 0: bug inventory, SDK analysis, constitution check
├── data-model.md        ← Phase 1: entity fields, state machine, data flow
├── quickstart.md        ← Phase 1: local dev & webhook simulation guide
├── contracts/
│   └── api-contracts.md ← Phase 1: method signatures before/after, endpoint shapes
└── checklists/
    └── requirements.md  ← spec quality validation
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   └── SubscriptionController.php   ← Bug B-2: store paynow_reference; update verifyHash call
│   └── Services/
│       └── PaynowService.php            ← Bug B-1, B-3: fix signatures
└── vendor/paynow/php-sdk/               ← read-only; do not modify
```

**Structure Decision**: Single backend web service (Option 2 in template). Frontend is unaffected.

## Complexity Tracking

No constitution violations. No complexity tracking required.

---

## Phase 0 Outputs

- [research.md](./research.md) — Bug inventory (B-1 through B-4), SDK hash analysis, constitution compliance table, confirmed no schema or frontend changes needed.

## Phase 1 Outputs

- [data-model.md](./data-model.md) — `subscription_payment_transactions` field reference, state machine, corrected webhook data flow.
- [contracts/api-contracts.md](./contracts/api-contracts.md) — Before/after method signatures for `PaynowService`, endpoint shapes, hash algorithm documentation.
- [quickstart.md](./quickstart.md) — Local dev setup, sandbox flow, webhook simulation with hash generation snippet.

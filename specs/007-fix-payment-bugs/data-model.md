# Data Model: Fix Payment Module Bugs

**Feature**: Fix Payment Module Bugs  
**Branch**: `007-fix-payment-bugs`  
**Date**: April 6, 2026

## Overview

This bug fix does not introduce new entities or modify the existing data model. This document describes the existing Payment entity structure for reference and clarifies how the bug fixes interact with the data layer.

## Existing Entities

### Payment

**Description**: Represents a financial transaction where money is received from a student or guardian for school fees or other charges.

**Database Table**: `payments`

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY, NOT NULL | UUID identifier for the payment |
| `tenant_id` | VARCHAR(36) | NOT NULL, FOREIGN KEY | References the school/tenant this payment belongs to |
| `student_id` | VARCHAR(36) | NOT NULL, FOREIGN KEY | References the student who made the payment |
| `amount` | DECIMAL(10,2) | NOT NULL | Payment amount in the school's currency |
| `date` | DATE | NOT NULL | Date the payment was received |
| `method` | VARCHAR(50) | NOT NULL | Payment method (Cash, EcoCash, Bank Transfer, etc.) |
| `description` | TEXT | NULLABLE | Optional description or notes about the payment |
| `category` | VARCHAR(100) | NULLABLE | Payment category (Tuition, Registration, Sports, etc.) |
| `month` | INT | NULLABLE | Month number (1-12) derived from date field |
| `route_id` | VARCHAR(36) | NULLABLE, FOREIGN KEY | If payment is for transport, references the route |
| `is_fee_structure` | TINYINT(1) | NULLABLE | Flag indicating if payment applies to fee structure charges |
| `created_at` | DATETIME | NOT NULL | Timestamp when record was created |
| `updated_at` | DATETIME | NOT NULL | Timestamp when record was last updated |

**Relationships**:
- Belongs to one `Student` (via `student_id`)
- Belongs to one `Tenant` (via `tenant_id`)
- Optionally belongs to one `Route` (via `route_id`) for transport payments

**Validation Rules** (from PaymentController):
- `amount` must be numeric and greater than 0
- `amount` must not exceed MAX_PAYMENT_AMOUNT (1,000,000)
- `method` must be one of: Cash, EcoCash, Bank Transfer, ZIPIT, Swipe, Cheque, Other
- `date` must be in YYYY-MM-DD format and valid
- `student_id` must reference an existing student in the same tenant
- `tenant_id` must match the authenticated user's tenant (from JWT)

**State Transitions**: None - payments are immutable once created (soft-delete only)

## Data Access Patterns

### PaymentModel Methods

**Affected by Bug Fixes**:

1. **`formatForApi(array $payment): array`**
   - **Current Bug**: Accesses `$payment['month']` directly, causing undefined array key error
   - **Fix**: Use derived `$monthDerived` value instead
   - **Input**: Raw database record as associative array
   - **Output**: Formatted array with camelCase keys for API response

2. **`find($id)`**
   - **Current Bug**: Returns null when record not found, but caller doesn't check
   - **Fix**: Add null-checking in PaymentController after calling this method
   - **Input**: Payment ID (UUID string)
   - **Output**: Payment record array or null if not found

**Not Affected**:

- `getByTenant(string $tenantId): array` - Returns all payments for a tenant
- `getByStudent(string $studentId, string $tenantId): array` - Returns payments for a student
- `getRecent(string $tenantId, int $limit): array` - Returns recent payments
- `getTotalByStudentAndDateRange(...)` - Calculates payment totals

### PaymentController Methods

**Affected by Bug Fixes**:

1. **`create()`**
   - **Current Bug**: Doesn't check if `find()` returns null before calling `formatForApi()`
   - **Fix**: Add null-checking and error handling
   - **Flow**: Insert payment → Commit transaction → Find payment → Check null → Format → Return

**Not Affected**:

- `index()` - List all payments
- `show($id)` - Get single payment
- `recent()` - Get recent payments
- `byStudent($studentId)` - Get payments by student
- `withStudents()` - Get payments with student data joined

## Data Integrity Constraints

### Multi-Tenant Isolation

**Enforcement**: All payment queries MUST filter by `tenant_id` from JWT payload

**Implementation**: 
- `BaseApiController::getTenantId()` extracts tenant_id from decoded JWT
- All PaymentController methods use this value to scope queries
- PaymentModel methods accept `$tenantId` parameter for filtering

**Bug Fix Impact**: No changes to tenant isolation - all existing filters remain in place

### Transaction Atomicity

**Current Implementation**:
```php
$db->transBegin();
try {
    $this->paymentModel->insert($paymentData);
    $this->updateChargeStatuses($db, $tenantId, $studentId);
    $db->transCommit();
} catch (\Throwable $e) {
    $db->transRollback();
    return $this->serverError('Failed to record payment');
}
```

**Bug Fix Impact**: 
- The `find()` call happens AFTER `transCommit()`, so the record should be visible
- However, defensive null-checking is still needed in case of database issues
- No changes to transaction boundaries

### Ledger Balance Calculation

**Formula**: `Student Balance = SUM(charges.amount) - SUM(payments.amount)`

**Implementation**: Computed at query time, never cached

**Bug Fix Impact**: No changes to balance calculation logic - only fixing payment record retrieval

## Month Field Derivation

### Current Behavior (Buggy)

**Database**: `month` field may be NULL for legacy records

**Code**: 
```php
// Lines 122-125: Derives month but doesn't use it
$monthDerived = null;
if (!empty($payment['date'])) {
    $monthDerived = date('n', strtotime($payment['date']));
}

// Line 136: Tries to access database field directly (BUG)
'month' => $payment['month'],  // Undefined array key error
```

### Fixed Behavior

**Database**: `month` field remains NULLABLE (no schema change)

**Code**:
```php
// Lines 122-125: Derives month from date
$monthDerived = null;
if (!empty($payment['date'])) {
    $monthDerived = date('n', strtotime($payment['date']));
}

// Line 136: Uses derived value (FIX)
'month' => $monthDerived,  // Always derived from date
```

**Rationale**: 
- Ensures consistency - month always matches the date
- Handles legacy records where month is NULL
- No migration needed - derivation happens at runtime

## API Response Format

### Payment Object (formatForApi output)

```json
{
  "id": "p_abc123...",
  "tenantId": "t_xyz789...",
  "studentId": "s_def456...",
  "amount": 150.00,
  "date": "2026-04-06",
  "method": "Cash",
  "description": "Term 1 Tuition",
  "category": "Tuition",
  "month": 4,
  "routeId": null
}
```

**Changes from Bug Fix**:
- `month` field is now always populated (derived from date)
- Previously could be null or cause undefined array key error

## Edge Cases

### Null/Invalid Date Field

**Scenario**: Payment record has null or invalid date

**Current Behavior**: `strtotime()` returns false, `date('n', false)` returns current month (incorrect)

**Fixed Behavior**: 
```php
$monthDerived = null;
if (!empty($payment['date'])) {
    $timestamp = strtotime($payment['date']);
    $monthDerived = $timestamp !== false ? date('n', $timestamp) : null;
}
```

**Note**: This additional safety check should be added to prevent incorrect month derivation

### Payment Insert Failure

**Scenario**: Database insert fails within transaction

**Current Behavior**: Transaction rolls back, error returned to client

**Fixed Behavior**: Same - no changes to error handling for insert failures

### Payment Not Found After Insert

**Scenario**: `find()` returns null immediately after successful insert

**Current Behavior**: Null passed to `formatForApi()`, causing TypeError

**Fixed Behavior**: Null check added, error logged, user-friendly message returned

## Performance Considerations

### Month Derivation Cost

**Operation**: `date('n', strtotime($payment['date']))`

**Cost**: O(1) - simple string parsing and formatting

**Frequency**: Once per payment record in API response

**Impact**: Negligible - adds microseconds per record

### Null Checking Cost

**Operation**: `if (!$saved) { ... }`

**Cost**: O(1) - simple boolean check

**Impact**: Negligible - single comparison operation

## Summary

This bug fix maintains the existing data model without any schema changes. The fixes are purely at the application layer:

1. **Null-safety**: Add defensive checks when retrieving payment records
2. **Month derivation**: Use the already-computed derived value instead of database field
3. **Error handling**: Improve error messages and logging for debugging

No migrations, no new tables, no new fields - just safer data access patterns.

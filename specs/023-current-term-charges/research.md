# Research: Current Term Charge Generation

**Date**: 2026-04-10
**Feature**: Current Term Charge Generation with Academic Calendar Validation

## Research Scope

This feature builds heavily on existing SchoolLedger infrastructure. Minimal research required as the domain (academic calendars, charge generation) is already well-established in the codebase.

## Findings

### Existing Infrastructure (No Unknowns)

1. **Academic Calendar Storage**
   - Location: `tenants.academic_calendar` JSON column
   - Structure: `{ terms: [{id, name, start, end}], schoolOpen, disableAttendanceWhenClosed }`
   - Access: `SettingsController::getCalendarFromTenant()`

2. **Charge Generation**
   - Location: `LedgerController::generateTermCharges()`
   - Already accepts `termId` parameter and validates basic requirements
   - Uses database transactions for atomicity

3. **Current Date Access**
   - PHP: `date('Y-m-d')` used throughout codebase
   - MySQL: `CURDATE()` available in queries

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Service Class Pattern** | Extract validation logic to `AcademicCalendarService` to keep controllers thin and enable unit testing |
| **Validation Before Transaction** | All calendar/term validations occur before DB transaction begins, avoiding unnecessary DB load |
| **JSON Column for Calendar** | Existing schema sufficient; no migration needed. Validation logic in PHP layer. |
| **Error Response Format** | Extend existing `BaseApiController::error()` pattern with structured error codes |

### No External Dependencies Required

- All validation can be implemented with existing PHP standard library
- Date comparison: `strtotime()` or `DateTime` objects
- No new packages or external services needed

## Conclusion

Feature is ready for design phase. No blocking unknowns identified.

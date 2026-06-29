# Data Model: Backend Data Optimization

**Feature**: 074-backend-data-optimization  
**Date**: 2026-05-14

## Overview

This feature does not introduce a new business aggregate. It introduces backend-prepared read models for existing SchoolLedger data so the frontend receives bounded, authoritative rows, pagination metadata, filter metadata, sort metadata, and summary metrics.

## Entities

### Backend Prepared List Response

Represents any backend-prepared list, register, or report response consumed by the frontend.

**Fields**:

- `rows` or domain-specific row key: Bounded list of display-ready records for the requested page.
- `pagination.page`: Current page number.
- `pagination.limit`: Requested and applied page size.
- `pagination.total`: Total matching records across the applied filters.
- `pagination.totalPages`: Total available pages.
- `filters`: Normalized filters applied by the backend.
- `sort.sortBy`: Applied sort field.
- `sort.sortOrder`: Applied sort direction.
- `summary`: Backend-calculated metrics for the same filter scope.

**Validation rules**:

- `page` must be at least 1.
- `limit` must be bounded by endpoint-specific maximums.
- `sortBy` must be allowlisted per endpoint.
- `sortOrder` must be `asc` or `desc`.
- All filter fields must be validated before query execution.

**Relationships**:

- Wraps one of the domain view row types below.

### Student Directory View

Represents the Student page's backend-prepared directory response.

**Fields**:

- `students`: Paginated student rows.
- `classes`: Optional lookup metadata for filter/dropdown rendering.
- `stats.totalStudents`: Count matching current filter scope.
- `stats.studentsWithOutstandingBalance`: Backend ledger-derived count.
- `stats.totalFeesOwed`: Backend ledger-derived amount.
- `stats.bursaryCoveragePercentage`: Backend-derived percentage if shown.
- `stats.studentsOnFinancialAid`: Backend-derived count if shown.
- `stats.statusCounts`: Backend-derived status breakdown.
- `pagination`: Backend Prepared List Response pagination metadata.
- `filters`: Applied class, status, search, and balance-only filters.
- `sort`: Applied student sort metadata.

**Validation rules**:

- `classId` must refer to a tenant-owned class when provided.
- `status` must be `all` or an allowed student status.
- `balanceOnly` must be boolean.
- Financial summaries must use source charges, payments, and approved adjustments according to existing ledger rules.

**Relationships**:

- Reads students, classes, enrollments, charges, payments, and ledger adjustments.
- Must preserve current enrollment and class display compatibility.

### Staff Attendance View

Represents staff attendance records and report rows.

**Fields**:

- `records`: Paginated attendance records with staff display name and computed fields.
- `summary`: Record/report totals such as present, absent, late, on leave, early departure, half day, working days, attendance rate, and overtime totals.
- `pagination`: Metadata for records view.
- `filters`: Applied staff, department, status, date range, search, and report filters.
- `sort`: Applied sort metadata.

**Validation rules**:

- Date ranges must be valid and `startDate <= endDate`.
- Status filters must be allowlisted attendance statuses.
- Staff and department filters must be tenant-owned.
- Working-day and leave calculations must be backend authoritative.

**Relationships**:

- Reads staff, staff attendance records, department data, leave records, and tenant working-hour settings.

### Class Directory View

Represents backend-prepared Classes page data.

**Fields**:

- `classes`: Paginated class rows.
- `summary.totalStudents`: Total active students in the filtered class scope.
- `summary.totalCapacity`: Total filtered active capacity.
- `summary.avgFill`: Backend-derived fill percentage.
- `summary.graduatingCount`: Backend-derived final-class count.
- `pagination`: Metadata for class directory.
- `filters`: Applied active/archive tab, search, academic year/session, and teacher filters.
- `sort`: Applied class sort metadata.

**Validation rules**:

- Archive/status filter must be allowlisted.
- Teacher filter must be tenant-owned when provided.
- Search must be bounded and sanitized.
- Summary metrics must be calculated over the same filter scope as the rows unless explicitly documented.

**Relationships**:

- Reads classes, staff/teachers, enrollments, students, and class migration/session metadata.

### Class Roster View

Represents backend-prepared students within a class.

**Fields**:

- `class`: Display metadata for the class.
- `students`: Paginated roster rows.
- `summary.studentCount`: Total matching roster records.
- `summary.capacity`: Class capacity.
- `summary.availableSeats`: Capacity minus active enrolled count.
- `pagination`: Roster pagination metadata.
- `filters`: Applied search, status, academic year/session filters.
- `sort`: Applied roster sort metadata.

**Validation rules**:

- Class must exist in the tenant scope.
- Search and status filters must be validated.
- Pagination must be bounded.

**Relationships**:

- Reads classes, students, enrollments, and current class-instance/session data where applicable.

### Class Attendance Register View

Represents backend-prepared class attendance data.

**Fields**:

- `register`: Paginated or bounded effective attendance rows for class/date/session scope.
- `summary.present`: Count of effective present records.
- `summary.absent`: Count of effective absent records.
- `summary.late`: Count of effective late records.
- `summary.excused`: Count if supported by existing statuses.
- `summary.totalStudents`: Total expected students in the class scope.
- `summary.attendanceRate`: Backend-derived rate.
- `summary.corrections`: Count or indicator of superseded/corrected records.
- `filters`: Applied class, class instance, date, session, status, and search filters.
- `pagination`: Metadata when row counts exceed a single bounded response.

**Validation rules**:

- Class or class instance must be tenant-owned.
- Date must be valid and must not violate existing future-date rules.
- Status filters must be allowlisted.
- Effective rows must respect superseded/correction logic.

**Relationships**:

- Reads student class attendance events, students, enrollments, classes, class instances, and active session data.

### Payment History View

Represents backend-prepared related payment history.

**Fields**:

- `student`: Student identity and backend-derived current balance summary.
- `data`: Paginated payment rows.
- `summary.totalPaid`: Backend-derived total matching the payment scope.
- `summary.totalThisTerm`: Backend-derived term-scoped total.
- `summary.latestPaymentDate`: Backend-derived latest date.
- `summary.latestPaymentAmount`: Backend-derived latest amount.
- `summary.daysSinceLastPayment`: Backend-derived recency metric.
- `pagination`: Payment history pagination metadata.
- `filters`: Applied category, method, date range, term, and search filters.
- `sort`: Applied payment sort metadata.

**Validation rules**:

- Student must exist in tenant scope.
- Payment category and method filters must be allowlisted.
- Financial summaries must preserve ledger/non-ledger/campaign classification rules.
- Page size must be bounded.

**Relationships**:

- Reads students, payments, payment categories, classes, enrollments, charges, terms, and ledger source records as required for summaries.

## State Transitions

No new persistent state transitions are introduced. Existing mutations, such as attendance submission, attendance correction, class archive/unarchive, and payment recording, must invalidate or refresh affected backend-prepared views where caching is used.

## Index and Performance Candidates

Potential new index candidates to evaluate during implementation:

- Student directory filters: tenant, status, class/current enrollment, searchable name/admission fields.
- Class directory filters: tenant, archived status, teacher, class name.
- Staff attendance filters: tenant, date, status, staff, staff name join path.
- Class attendance filters: tenant, class/class instance, attendance date, effective flag, student.
- Payment history filters: tenant, student, date, category, method, campaign/general flags.

Indexes must be added only through new migrations and justified by query shape or timing evidence.

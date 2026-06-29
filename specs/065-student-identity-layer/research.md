# Research: Student Identity Layer

## Decision 1: Keep `students` as the stable identity record

**Decision**: Preserve the existing `students` table as the central identity anchor and keep related academic, transport, and financial activity in separate records that reference the student.

**Rationale**: The existing system already has strong student-linked records: `enrollments`, `transport_student_allocations`, `charges`, `payments`, `ledger_adjustments`, `student_status_history`, and fee campaign records. Replacing the student table would create unnecessary migration risk. Treating `students` as the stable identity entity aligns with the feature goal while preserving current module integrations.

**Alternatives considered**:
- Create a new `student_identities` table and migrate all modules to it. Rejected because it duplicates the current student identity concept and creates high-risk foreign key migration work.
- Continue using `students` as a mutable standalone profile. Rejected because it does not preserve historical truth for class, transport, financial, or personal/contact changes.

## Decision 2: Treat `students.class_id` and `students.current_enrollment_id` as derived compatibility fields

**Decision**: Keep existing current-class snapshot fields for backward compatibility and list performance, but source academic history from `enrollments` and synchronize snapshots from the active enrollment.

**Rationale**: Current code already uses `EnrollmentModel`, `current_enrollment_id`, and `StudentSnapshotService`. This pattern supports a stable identity layer without breaking existing list views or profile screens. It also avoids expensive joins in every current-student listing while keeping enrollment records as the historical source of truth.

**Alternatives considered**:
- Remove `class_id` from `students`. Rejected because many current queries and UI paths rely on it and removal would require a broad breaking migration.
- Continue updating `students.class_id` directly as the only class source. Rejected because it loses historical class placement context.

## Decision 3: Add profile history for mutable personal/contact changes

**Decision**: Add a `student_profile_history` record type to capture changes to mutable personal and contact fields, including old value, new value, effective date, reason, and changed-by user.

**Rationale**: Academic placement, status, transport, charges, and payments already have source/history records. Address/contact changes are the main gap identified by the spec. A generic field-change history supports address, email, guardian, and similar changes without adding a separate history table for every field.

**Alternatives considered**:
- Add only `student_address_history`. Rejected because the spec refers to address as an example, and other mutable contact fields have similar historical value.
- Store a full profile snapshot for every update. Rejected because it increases storage and makes field-level audit/reporting harder than necessary.

## Decision 4: Use a backend `StudentIdentityService` for consolidated identity/timeline assembly

**Decision**: Add a backend service responsible for validating tenant-scoped student identity access, assembling profile history, and producing a chronological timeline from enrollment, status, profile-history, transport, charge, and payment records.

**Rationale**: The existing `StudentController::getProfile()` already aggregates related records, but identity/timeline logic would become too large if added directly to the controller. A service keeps controller methods thin, makes tenant validation reusable, and prevents frontend business logic duplication.

**Alternatives considered**:
- Assemble timeline in the frontend from multiple API calls. Rejected because it duplicates business rules in the SPA and increases request coordination complexity.
- Add timeline queries directly to `StudentController`. Rejected because the controller is already large and this feature benefits from a focused service boundary.

## Decision 5: Expose a period-filtered student timeline REST contract

**Decision**: Provide a consolidated timeline endpoint with optional date/academic-year filters and typed event categories.

**Rationale**: The spec requires reconstructing a student's journey for selected dates, terms, or academic years. A period-filtered timeline lets reports and profile views ask the backend for a bounded, tenant-scoped history without loading all records indefinitely.

**Alternatives considered**:
- Only enhance `/students/{id}/profile`. Rejected because profile is current-state oriented and could become too heavy.
- Only keep separate module-specific history endpoints. Rejected because reporting and user review need a unified chronology.

## Decision 6: Preserve ledger source-of-truth rules

**Decision**: Student identity/timeline views will read charges, payments, and ledger adjustments but will not introduce stored student balances or update balance snapshots.

**Rationale**: The constitution requires balances to be computed from source records. Recent ledger work already centralizes eligible charge/payment filtering. Timeline display should not alter ledger semantics.

**Alternatives considered**:
- Store timeline balance snapshots in student identity records. Rejected because it risks source-of-truth conflicts with ledger calculations.

## Decision 7: Conflict handling for overlapping active records

**Decision**: Academic and transport operations must prevent or flag ambiguous overlaps, relying on existing active-enrollment rules and transport unique-active constraints, with explicit 409-style conflict responses for new identity-layer workflows.

**Rationale**: The feature requires users to understand and resolve history conflicts rather than silently overwriting records. Transport already has a one-active-assignment constraint. Enrollment workflows should continue to close prior active enrollments before creating new active placements.

**Alternatives considered**:
- Allow overlaps and resolve by latest-created record. Rejected because it creates ambiguous historical reconstruction.

## Decision 8: Post-implementation validation through curl

**Decision**: Validate new endpoints and changed workflows using curl after implementation, covering happy path, validation/conflict paths, role restrictions, and tenant isolation.

**Rationale**: Constitution Principle X requires endpoint-level curl validation after implementation. This feature touches tenant-owned student data and must prove tenant isolation externally.

**Alternatives considered**:
- Rely only on internal test frameworks. Rejected because the constitution mandates curl endpoint verification.

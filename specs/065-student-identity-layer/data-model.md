# Data Model: Student Identity Layer

## Overview

The Students module becomes the central identity layer by keeping one stable `Student` record and linking all academic, administrative, transport, and financial activity through related records. Existing source records remain authoritative where they already exist. This feature adds profile-history coverage for mutable personal/contact changes and introduces a consolidated timeline view over related records.

## Entity: Student

**Purpose**: Stable learner identity record used by all modules.

**Existing/source fields**:
- `id`: Stable student identifier.
- `tenant_id`: School/tenant owner.
- `first_name`, `last_name`: Core identity names.
- `admission_number`: Tenant-scoped admission identifier.
- `gender`, `date_of_birth`, `national_id`, `photo_url`: Personal identity details.
- `email`, `address`: Current contact details.
- `guardian_*`, `guardian2_*`: Current guardian/contact details.
- `enrollment_date`: Initial enrollment/admission date.
- `status`: Current lifecycle status.
- `class_id`: Current class snapshot derived from active enrollment for compatibility.
- `current_enrollment_id`: Current enrollment snapshot pointer.
- `bursary_status`, `bursary_percentage`, `bursary_reason`: Current bursary profile information.
- `created_at`, `updated_at`: Record timestamps.

**Relationships**:
- Has many `EnrollmentRecord` rows.
- Has many `StudentStatusHistory` rows.
- Has many `StudentProfileHistory` rows.
- Has many `TransportAssignment` rows.
- Has many `Charge` rows.
- Has many `Payment` rows.
- Has many reporting/timeline events derived from linked records.

**Validation rules**:
- `tenant_id` must come from JWT context for all create/read/update operations.
- `admission_number` must be unique within a tenant.
- Routine academic placement changes must not directly overwrite historical enrollment source records.
- Current snapshot fields may be synchronized from source records but must not be treated as the historical source of truth.

## Entity: EnrollmentRecord

**Purpose**: Academic placement history linking a student to a class/session/year.

**Existing/source fields**:
- `id`
- `tenant_id`
- `student_id`
- `class_id`
- `class_instance_id`
- `academic_session`
- `status`: active, promoted, repeated, graduated, transferred, dropped out.
- `enrollment_date`
- `completion_date`
- `remarks`

**Relationships**:
- Belongs to `Student`.
- Belongs to class/class instance.
- Feeds student current-class snapshots and student timeline events.

**Validation rules**:
- Student and class/class instance must belong to the same tenant.
- At most one current active placement should exist for a student in an effective period.
- Promotions/transfers complete the prior active enrollment before creating a new active enrollment.

**State transitions**:
- `active` → `promoted`
- `active` → `repeated`
- `active` → `transferred`
- `active` → `graduated`
- `active` → `dropped_out`
- New `active` record may follow promotion/repeat/transfer where applicable.

## Entity: StudentStatusHistory

**Purpose**: Immutable lifecycle status audit trail.

**Existing/source fields**:
- `id`
- `tenant_id`
- `student_id`
- `previous_status`
- `new_status`
- `effective_date`
- `reason`
- `changed_by_user_id`
- `created_at`

**Relationships**:
- Belongs to `Student`.
- May trigger transport deallocation when status changes from active to non-active.

**Validation rules**:
- Status values must be from the supported student lifecycle set.
- `effective_date` and `reason` are required for explicit status changes.
- Only authorized roles may perform status changes.

## Entity: StudentProfileHistory

**Purpose**: Field-level history for mutable student profile/contact details.

**New fields**:
- `id`: History record identifier.
- `tenant_id`: School/tenant owner.
- `student_id`: Referenced student.
- `field_name`: Changed profile field, such as `address`, `email`, `guardian_phone`, `guardian_name`, `guardian2_phone`, or other approved mutable field.
- `previous_value`: Value before the change, nullable for initially blank fields.
- `new_value`: Value after the change, nullable where a value is removed.
- `change_type`: `correction` or `historical_change`.
- `effective_date`: Date the new value became true.
- `reason`: Required explanation for the change.
- `changed_by_user_id`: User who made the change.
- `created_at`: Audit timestamp.

**Relationships**:
- Belongs to `Student`.
- Belongs to user who changed the field where available.
- Feeds student timeline events.

**Validation rules**:
- Student must exist in the authenticated tenant.
- `field_name` must be in an approved mutable-profile field list.
- `change_type` must distinguish data correction from real-world historical change.
- `effective_date` and `reason` are required.
- No history record is created when submitted value equals current value.
- Core immutable identifiers should not be changed through this history flow unless explicitly allowed by a correction workflow.

**State transitions**:
- Current value updated after history record is created.
- Prior value remains preserved in history.

## Entity: TransportAssignment

**Purpose**: Transport service usage history.

**Existing/source fields**:
- `id`
- `tenant_id`
- `student_id`
- `route_id`
- `stop_id`
- `direction`
- `academic_year`
- `start_date`
- `end_date`
- `status`
- `notes`
- `created_at`, `updated_at`

**Relationships**:
- Belongs to `Student`.
- Belongs to route/stop.
- Feeds transport history and student timeline events.

**Validation rules**:
- Student, route, and stop must belong to the authenticated tenant.
- A student may have at most one active assignment at a time.
- Inactive assignments remain available as history.

## Entity: Charge

**Purpose**: Student financial obligation source record.

**Existing/source fields**:
- `id`
- `tenant_id`
- `student_id`
- `amount`
- `category`
- `charge_type`
- `status`
- `date_generated`
- `due_date`
- `description`
- Related billing/run fields where applicable.

**Relationships**:
- Belongs to `Student`.
- May belong to fee rule, transport month, term, or billing run.
- Feeds ledger balance and timeline events.

**Validation rules**:
- Must reference a valid tenant-scoped student.
- Ledger balance remains computed from charges/payments/adjustments; no student balance snapshot is introduced.

## Entity: Payment

**Purpose**: Student financial settlement source record.

**Existing/source fields**:
- `id`
- `tenant_id`
- `student_id`
- `amount`
- `date`
- `method`
- `category`
- `receipt_number`
- `snapshot`
- Payment grouping/campaign/general-payment fields where applicable.

**Relationships**:
- Belongs to `Student`.
- May relate to receipt, payment category, campaign, transport, or grouped payment records.
- Feeds ledger balance and timeline events.

**Validation rules**:
- Must reference a valid tenant-scoped student.
- Campaign/general-payment and ledger eligibility rules remain unchanged.

## Entity: StudentTimelineEvent

**Purpose**: Read-only consolidated view model representing a chronological student journey.

**Derived fields**:
- `id`: Stable event identifier or source record identifier with type prefix.
- `student_id`
- `tenant_id`
- `event_type`: `profile_change`, `status_change`, `enrollment`, `transport_assignment`, `charge`, `payment`, `ledger_adjustment`.
- `event_date`: Effective or transaction date.
- `title`: Human-readable event title.
- `summary`: Short event description.
- `source_type`: Source entity type.
- `source_id`: Source record ID.
- `metadata`: Type-specific display details.

**Relationships**:
- Derived from student-linked records.
- Does not replace source records.

**Validation/query rules**:
- Must be tenant-scoped through the student and each source record.
- Supports date range and academic-year/period filters.
- Results should be ordered consistently by event date and source creation timestamp.

## Invariants

- The student ID is the stable identity key across modules.
- Tenant isolation applies to every source and derived record.
- Academic history is reconstructed from enrollment records, not from `students.class_id` alone.
- Transport history is reconstructed from allocation records, not from route snapshots alone.
- Financial history is reconstructed from charges, payments, adjustments, and related source records, not from mutable balance fields.
- Profile/contact changes that represent real-world changes are recorded in profile history before current values are updated.
- Data corrections are distinguished from historical changes for audit clarity.

# Data Model: Recent Activity Scope Isolation

No schema changes (migrations) are required for this feature. The feature synthesizes data from existing tables.

## Source Entities for Tenant Activity Feed

All queries against these tables **MUST** be filtered by `tenant_id` from the JWT session.

### 1. Payments (`payments`)
- **Key fields**: `id`, `amount`, `date` / `created_at`, `method`, `category`, `student_id`
- **Joins**: `students` for name
- **Event mapping**:
  - `type`: 'payment'
  - `description`: 'Payment received'
  - `timestamp`: `date`

### 2. Enrollments (`enrollments`)
- **Key fields**: `id`, `enrollment_date`, `student_id`, `class_id`
- **Joins**: `students` for name, `classes` for name
- **Event mapping**:
  - `type`: 'enrollment'
  - `description`: 'Student enrolled'
  - `timestamp`: `enrollment_date`

### 3. Student Status History (`student_status_history`)
- **Key fields**: `id`, `status`, `reason`, `created_at`, `student_id`
- **Joins**: `students` for name
- **Event mapping**:
  - `type`: 'status_change'
  - `description`: 'Student status changed to {status}'
  - `timestamp`: `created_at`

### 4. Leave Requests (`leave_requests`)
- **Key fields**: `id`, `status`, `leave_type`, `updated_at`, `staff_id`
- **Joins**: `staff` for name
- **Event mapping**:
  - `type`: 'leave'
  - `description`: 'Leave request {status}'
  - `timestamp`: `updated_at`

## Source Entities for Platform Activity Feed

### Platform Audit (`platform_audit`)
- **Key fields**: `id`, `action`, `created_at`, `actor_name`
- **Filtering**: `action LIKE 'platform.%'`
- **Event mapping**:
  - `type`: mapped via `actionIconMap` client-side
  - `description`: action label
  - `timestamp`: `created_at`

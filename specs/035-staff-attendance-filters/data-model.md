# Data Model: Staff Attendance Filtering and Alerts

**Feature**: 035-staff-attendance-filters  
**Date**: April 16, 2026

## Entity Definitions

### Staff (Existing - Reference)

Represents an employee in the system.

| Field | Type | Description |
|-------|------|-------------|
| id | INT (PK) | Unique identifier |
| tenant_id | INT (FK) | Multi-tenant isolation field |
| first_name | VARCHAR | Staff first name |
| last_name | VARCHAR | Staff last name |
| email | VARCHAR | Contact email |
| department | VARCHAR | Department assignment |
| status | ENUM('active', 'inactive') | Employment status |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

**Relationships**:
- One Staff → Many Attendance Records

---

### Attendance Record (Extended)

Captures a single day's attendance for a staff member.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | INT (PK) | Unique identifier | Auto-increment |
| tenant_id | INT (FK) | Multi-tenant isolation | Required, indexed |
| staff_id | INT (FK) | Reference to Staff | Required, indexed |
| date | DATE | Attendance date | Required, indexed |
| check_in_time | TIME | When staff checked in | Nullable |
| check_out_time | TIME | When staff checked out | Nullable |
| status | ENUM | Attendance status | Values: present, absent, excused |
| comment | TEXT | Optional explanation | Nullable, max 500 chars |
| created_at | TIMESTAMP | Record creation | Auto-set |
| updated_at | TIMESTAMP | Last update | Auto-update |

**New Field**: `comment` (TEXT, nullable) - Added via migration to store optional notes when marking absent/excused.

**Validation Rules**:
- `tenant_id` must match JWT tenant
- `date` cannot be in the future
- `comment` required when `status = 'excused'` (configurable)
- Max comment length: 500 characters

**State Transitions**:
```
null → present (via check-in)
null → absent (via admin confirmation)
null → excused (via admin confirmation with comment)
present → absent (admin override)
absent → excused (admin correction)
excused → absent (admin correction)
```

**Relationships**:
- Many Attendance Records → One Staff

---

## Query Patterns

### Monthly Filtered Summary
```sql
SELECT 
    s.id as staff_id,
    s.first_name,
    s.last_name,
    s.department,
    COUNT(a.id) as total_days,
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
    SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_days
FROM staff s
LEFT JOIN attendance a ON s.id = a.staff_id 
    AND a.tenant_id = s.tenant_id
    AND a.date >= :start_date 
    AND a.date <= :end_date
WHERE s.tenant_id = :tenant_id
    AND s.status = 'active'
GROUP BY s.id, s.first_name, s.last_name, s.department
```

### Today's Attendance with Unchecked Detection
```sql
SELECT 
    s.id as staff_id,
    s.first_name,
    s.last_name,
    s.department,
    a.id as attendance_id,
    a.check_in_time,
    a.check_out_time,
    a.status,
    a.comment
FROM staff s
LEFT JOIN attendance a ON s.id = a.staff_id 
    AND a.tenant_id = s.tenant_id
    AND a.date = CURRENT_DATE
WHERE s.tenant_id = :tenant_id
    AND s.status = 'active'
ORDER BY s.department, s.last_name
```

### Update Status with Comment
```sql
-- Insert new attendance record if doesn't exist
INSERT INTO attendance (tenant_id, staff_id, date, status, comment, created_at, updated_at)
VALUES (:tenant_id, :staff_id, CURRENT_DATE, :status, :comment, NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    status = :status,
    comment = :comment,
    updated_at = NOW();
```

## Index Strategy

| Table | Columns | Type | Purpose |
|-------|---------|------|---------|
| attendance | tenant_id, date | Composite | Month filtering queries |
| attendance | tenant_id, staff_id, date | Composite | Staff's monthly attendance lookup |
| attendance | tenant_id, date, status | Composite | Summary aggregation by status |
| staff | tenant_id, status | Composite | Active staff filtering |

## Data Integrity

1. **Multi-tenancy**: All queries must include `tenant_id` filter
2. **Referential**: Attendance records require valid staff_id within same tenant
3. **Temporal**: Date values stored in UTC, displayed in configured timezone
4. **Audit**: created_at/updated_at track all changes; comment provides business context

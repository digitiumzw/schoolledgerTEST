# Data Model: Driver Kiosk View-Only Access

**Feature**: 055-driver-kiosk-viewonly  
**Date**: 2026-04-30  
**Status**: Using Existing Schema (No Migrations Required)

## Overview

This feature leverages the existing transport schema created in migrations:
- `2026-02-01-000000_Redesign_transport_tables.php`
- `2026-04-28-100000_Create_transport_master_tables.php`
- `2026-04-28-100001_Create_transport_period_allocation_tables.php`

No new database migrations are required. All data is queried from existing tables.

## Entity Relationship Diagram

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  staff          │     │ transport_route_     │     │ transport_      │
│  (Driver)       │◄────┤ periods              ├────►│ vehicles        │
│                 │     │ (Assignment Link)    │     │ (Bus)           │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
        │
        │ employs           ┌─────────────────┐
        └──────────────────►│ transport_routes│
                            │ (Route Info)    │
                            └─────────────────┘
                                    │
                                    │ has_many
                                    ▼
                            ┌─────────────────┐
                            │ transport_stops │
                            │ (Sequence)    │
                            └─────────────────┘
                                    │
                                    │ assigned_to
                                    ▼
┌─────────────────┐     ┌──────────────────────────┐
│  students       │◄────┤ transport_student_alloc  │
│                 │     │ ations (with stop_id)    │
└─────────────────┘     └──────────────────────────┘

┌─────────────────┐     ┌──────────────────────────┐
│  charges        │     │  payments                │
│  (Transport     │◄────┤  (Student Payments)      │
│   fees)         │     │                          │
└─────────────────┘     └──────────────────────────┘
```

## Tables Used

### 1. staff (Driver Identification)

**Purpose**: Driver authentication via Employee ID.

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | Primary key, links to transport_route_periods.driver_id via staff_id |
| tenant_id | VARCHAR(50) | Multi-tenant isolation |
| employee_id | VARCHAR(20) | **Kiosk login credential** (e.g., EMP0001) |
| first_name | VARCHAR(100) | Driver name display |
| last_name | VARCHAR(100) | Driver name display |
| employment_status | ENUM | Must be 'active' for kiosk access |

**Indexes**: `tenant_id`, `employee_id` (unique per tenant)

---

### 2. transport_vehicles (Bus Information)

**Purpose**: Vehicle details displayed to driver.

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | Primary key |
| tenant_id | VARCHAR(50) | Multi-tenant isolation |
| name | VARCHAR(100) | Vehicle display name |
| reg_number | VARCHAR(50) | Registration number |
| type | ENUM('bus','minibus','van','other') | Vehicle type |
| capacity | INT | Seating capacity |
| status | ENUM('active','inactive') | Only active vehicles shown |

**Indexes**: `tenant_id`

---

### 3. transport_routes (Route Information)

**Purpose**: Route header information.

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | Primary key |
| tenant_id | VARCHAR(50) | Multi-tenant isolation |
| route_name | VARCHAR(200) | Display name |
| vehicle | VARCHAR(100) | Legacy vehicle name (prefer transport_vehicles) |
| driver_name | VARCHAR(100) | Legacy driver name |
| driver_staff_id | VARCHAR(50) | **FK to staff.id** - Driver assignment |
| monthly_fee | DECIMAL(10,2) | Route fee amount |
| status | ENUM('active','inactive') | Only active routes shown |

**Indexes**: `tenant_id`, `driver_staff_id`

---

### 4. transport_stops (Route Stops)

**Purpose**: Stops in sequence order for each route.

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | Primary key |
| tenant_id | VARCHAR(50) | Multi-tenant isolation |
| route_id | VARCHAR(50) | **FK to transport_routes.id** |
| name | VARCHAR(200) | Stop display name |
| pickup_time | VARCHAR(10) | Estimated arrival time (e.g., "07:30") |
| order_position | SMALLINT | **Sequence order** (0, 1, 2, ...) |

**Indexes**: `route_id`, `order_position` (composite for sequence queries)

---

### 5. transport_route_periods (Driver-Vehicle-Route Assignment)

**Purpose**: Time-bound assignment of driver + vehicle to route for an academic year.

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | Primary key |
| tenant_id | VARCHAR(50) | Multi-tenant isolation |
| route_id | VARCHAR(50) | **FK to transport_routes.id** |
| vehicle_id | VARCHAR(50) | **FK to transport_vehicles.id** |
| driver_id | VARCHAR(50) | **FK to transport_drivers.id** OR staff.id |
| academic_year | VARCHAR(20) | e.g., "2025-2026" |
| start_date | DATE | Period validity start |
| end_date | DATE | Period validity end |
| status | ENUM('active','inactive') | Only active periods considered |

**Indexes**: `route_id`, `academic_year`, `status` (composite)

**Note**: `transport_drivers.staff_id` links to `staff.id`, allowing driver lookup.

---

### 6. transport_student_allocations (Student Assignments)

**Purpose**: Links students to routes and specific stops.

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | Primary key |
| tenant_id | VARCHAR(50) | Multi-tenant isolation |
| student_id | VARCHAR(50) | **FK to students.id** |
| route_id | VARCHAR(50) | **FK to transport_routes.id** |
| stop_id | VARCHAR(50) | **FK to transport_stops.id** (pickup/drop-off) |
| direction | ENUM('both','inbound','outbound') | Trip direction |
| academic_year | VARCHAR(20) | Allocation period |
| start_date | DATE | Validity start |
| end_date | DATE | Validity end |
| status | ENUM('active','inactive') | Only 'active' shown in kiosk |
| notes | TEXT | Special instructions |

**Indexes**: `student_id`, `route_id`, `academic_year`, `status`

**Constraint**: Unique index on (tenant_id, student_id, is_active) prevents duplicate active assignments.

---

### 7. students (Student Information)

**Purpose**: Student demographic information for roster display.

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | Primary key |
| tenant_id | VARCHAR(50) | Multi-tenant isolation |
| first_name | VARCHAR(100) | Display name |
| last_name | VARCHAR(100) | Display name |
| status | ENUM('active','withdrawn','suspended','graduated') | Only 'active' shown |

**Indexes**: `tenant_id`, `status`

---

### 8. charges + payments (Payment Status)

**Purpose**: Determine if student has paid transport fees.

**charges** (Transport fees):
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | Primary key |
| tenant_id | VARCHAR(50) | Multi-tenant isolation |
| student_id | VARCHAR(50) | FK to students |
| amount | DECIMAL(10,2) | Charge amount |
| charge_type | ENUM | 'transport' for transport fees |
| term_id | VARCHAR(50) | Billing period identifier |
| academic_year | VARCHAR(20) | e.g., "2025-2026" |

**payments** (Student payments):
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | Primary key |
| tenant_id | VARCHAR(50) | Multi-tenant isolation |
| student_id | VARCHAR(50) | FK to students |
| amount | DECIMAL(10,2) | Payment amount |
| charge_id | VARCHAR(50) | FK to charges (nullable) |

**Payment Status Logic**:
```sql
-- Student has paid if: SUM(payments) >= SUM(charges for transport)
-- For current term/academic_year
```

## Query Patterns

### 1. Get Driver's Assigned Bus and Routes

```sql
-- Resolve tenant from kiosk_code
-- Get staff record by employee_id
-- Get active route periods for this driver
-- Join with vehicles and routes

SELECT 
    v.id AS vehicle_id,
    v.name AS vehicle_name,
    v.reg_number,
    v.capacity,
    r.id AS route_id,
    r.route_name,
    rp.academic_year
FROM transport_route_periods rp
JOIN transport_vehicles v ON v.id = rp.vehicle_id
JOIN transport_routes r ON r.id = rp.route_id
WHERE rp.driver_id = (SELECT id FROM transport_drivers WHERE staff_id = ?)
  AND rp.tenant_id = ?
  AND rp.status = 'active'
  AND rp.academic_year = (SELECT current_academic_year FROM settings WHERE tenant_id = ?)
```

### 2. Get Route Stops in Sequence

```sql
SELECT 
    s.id,
    s.name,
    s.pickup_time,
    s.order_position
FROM transport_stops s
WHERE s.route_id = ?
  AND s.tenant_id = ?
ORDER BY s.order_position ASC
```

### 3. Get Students with Stop Information

```sql
SELECT 
    s.id AS student_id,
    s.first_name,
    s.last_name,
    ts.name AS stop_name,
    ta.direction,
    ta.notes
FROM transport_student_allocations ta
JOIN students s ON s.id = ta.student_id
LEFT JOIN transport_stops ts ON ts.id = ta.stop_id
WHERE ta.route_id = ?
  AND ta.tenant_id = ?
  AND ta.status = 'active'
  AND s.status = 'active'
  AND ta.academic_year = ?
ORDER BY s.last_name, s.first_name
```

### 4. Check Student Payment Status

```sql
-- For a given student and current academic year/term:
SELECT 
    COALESCE(SUM(c.amount), 0) AS total_charges,
    COALESCE(SUM(p.amount), 0) AS total_payments
FROM (
    SELECT amount 
    FROM charges 
    WHERE student_id = ? 
      AND tenant_id = ? 
      AND charge_type = 'transport'
      AND academic_year = ?
) c
LEFT JOIN (
    SELECT amount 
    FROM payments 
    WHERE student_id = ? 
      AND tenant_id = ?
) p ON 1=1

-- Paid if: total_payments >= total_charges
```

## Validation Rules

1. **Driver Access**: 
   - staff.employment_status = 'active'
   - staff.employee_id must match input exactly

2. **Route Visibility**:
   - transport_routes.status = 'active'
   - transport_route_periods.status = 'active'
   - transport_route_periods.driver_id matches driver

3. **Student Visibility**:
   - students.status = 'active' (not withdrawn/suspended)
   - transport_student_allocations.status = 'active'
   - transport_student_allocations.route_id matches requested route

4. **Payment Status**:
   - Calculate per student for current academic year
   - Paid = total payments >= total transport charges
   - Unpaid = total payments < total transport charges OR no payment record

## Notes

- All queries MUST include `tenant_id` filtering per Constitution Principle I
- No schema changes required - using existing tables and indexes
- Payment calculation follows existing ledger pattern (Principle V)
- Kiosk uses existing kiosk_code resolution pattern (same as StudentKioskController)

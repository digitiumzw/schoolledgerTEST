# Quickstart: Driver Kiosk View-Only Access

**Feature**: 055-driver-kiosk-viewonly  
**Branch**: `055-driver-kiosk-viewonly`  
**Status**: Ready for Implementation

---

## Prerequisites

- PHP 8.1+ with MySQL extensions
- Node.js 18+ with Bun or npm
- Existing SchoolLedger development environment
- Driver kiosk already enabled (kiosk_code configured in tenant settings)

---

## Development Setup

### 1. Switch to Feature Branch

```bash
cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger
git checkout -b 055-driver-kiosk-viewonly
```

### 2. Backend Dependencies

No new PHP dependencies required. Using existing:
- CodeIgniter 4
- Existing database schema (no migrations needed)

### 3. Frontend Dependencies

No new npm packages required. Using existing:
- React 18
- TanStack Query (server state)
- Lucide React (icons)
- shadcn/ui components

---

## Data Setup (Test Data)

### Step 1: Ensure Transport Schema Exists

```bash
# Run existing migrations if not already applied
php spark migrate
```

**Required tables already exist:**
- `transport_vehicles` - Bus information
- `transport_routes` - Route definitions
- `transport_stops` - Stop sequences
- `transport_drivers` - Driver records
- `transport_route_periods` - Driver-vehicle-route assignments
- `transport_student_allocations` - Student assignments

### Step 2: Create Test Driver with Employee ID

```sql
-- Ensure staff member exists with Employee ID
INSERT INTO staff (id, tenant_id, first_name, last_name, employee_id, employment_status)
VALUES ('staff_001', 'your-tenant-id', 'John', 'Driver', 'EMP0001', 'active');

-- Create transport driver record linked to staff
INSERT INTO transport_drivers (id, tenant_id, staff_id, name, status)
VALUES ('driver_001', 'your-tenant-id', 'staff_001', 'John Driver', 'active');
```

### Step 3: Create Test Vehicle, Route, and Assignment

```sql
-- Create a bus
INSERT INTO transport_vehicles (id, tenant_id, name, reg_number, type, capacity, status)
VALUES ('veh_001', 'your-tenant-id', 'Bus Alpha', 'ABC-123-GP', 'bus', 60, 'active');

-- Create a route with driver assignment
INSERT INTO transport_routes (id, tenant_id, route_name, driver_staff_id, status)
VALUES ('route_001', 'your-tenant-id', 'North Route', 'staff_001', 'active');

-- Create stops in sequence
INSERT INTO transport_stops (id, tenant_id, route_id, name, pickup_time, order_position)
VALUES 
  ('stop_001', 'your-tenant-id', 'route_001', 'Main Gate', '07:30', 0),
  ('stop_002', 'your-tenant-id', 'route_001', 'Shopping Center', '07:45', 1),
  ('stop_003', 'your-tenant-id', 'route_001', 'Library', '08:00', 2);

-- Create route period (assigns driver + vehicle to route for academic year)
INSERT INTO transport_route_periods (id, tenant_id, route_id, vehicle_id, driver_id, academic_year, status)
VALUES ('period_001', 'your-tenant-id', 'route_001', 'veh_001', 'driver_001', '2025-2026', 'active');
```

### Step 4: Create Test Student Assignments

```sql
-- Ensure test students exist
INSERT INTO students (id, tenant_id, first_name, last_name, status)
VALUES 
  ('stu_001', 'your-tenant-id', 'Alice', 'Student', 'active'),
  ('stu_002', 'your-tenant-id', 'Bob', 'Pupil', 'active');

-- Assign students to route with stops
INSERT INTO transport_student_allocations (id, tenant_id, student_id, route_id, stop_id, direction, academic_year, status)
VALUES 
  ('alloc_001', 'your-tenant-id', 'stu_001', 'route_001', 'stop_001', 'both', '2025-2026', 'active'),
  ('alloc_002', 'your-tenant-id', 'stu_002', 'route_001', 'stop_002', 'inbound', '2025-2026', 'active');
```

### Step 5: Create Test Payment Records

```sql
-- Add transport charge for student
INSERT INTO charges (id, tenant_id, student_id, amount, charge_type, academic_year, description)
VALUES ('charge_001', 'your-tenant-id', 'stu_001', 500.00, 'transport', '2025-2026', 'Term 1 Transport');

-- Add full payment (paid student)
INSERT INTO payments (id, tenant_id, student_id, amount, payment_date, academic_year)
VALUES ('pay_001', 'your-tenant-id', 'stu_001', 500.00, '2025-01-15', '2025-2026');

-- Add transport charge for second student (unpaid)
INSERT INTO charges (id, tenant_id, student_id, amount, charge_type, academic_year, description)
VALUES ('charge_002', 'your-tenant-id', 'stu_002', 500.00, 'transport', '2025-2026', 'Term 1 Transport');
```

### Step 6: Enable Driver Kiosk Mode

```sql
-- Add kiosk_code and driverKioskModeEnabled to tenant settings
UPDATE tenants 
SET settings = JSON_SET(
  COALESCE(settings, '{}'),
  '$.kiosk_code', 'KIOSK12345',
  '$.driverKioskModeEnabled', true
)
WHERE id = 'your-tenant-id';
```

---

## Testing the Kiosk

### 1. Start Development Servers

**Backend:**
```bash
cd backend
php spark serve
```

**Frontend:**
```bash
cd frontend
bun run dev
```

### 2. Access Kiosk URL

Navigate to:
```
http://localhost:5173/kiosk/driver/KIOSK12345
```

Or with your kiosk code:
```
http://localhost:5173/kiosk/driver/{YOUR_KIOSK_CODE}
```

### 3. Login with Employee ID

Enter test Employee ID: `EMP0001`

### 4. Expected Behavior

1. **Login Screen**: Enter Employee ID → Continue
2. **Routes Screen**: See assigned bus (Bus Alpha) and route list
3. **Route Detail**: Click route → See stops in sequence
4. **Roster Screen**: See students with their assigned stops
5. **Paid Filter**: Toggle "Show paid only" to filter students

---

## API Testing with curl

### Validate Driver

```bash
curl -X POST http://localhost:8080/api/kiosk/driver/validate \
  -H "Content-Type: application/json" \
  -d '{
    "kiosk_code": "KIOSK12345",
    "employee_id": "EMP0001"
  }'
```

### Get Roster (All Students)

```bash
curl "http://localhost:8080/api/kiosk/driver/routes/KIOSK12345?employee_id=EMP0001&route_id=route_001"
```

### Get Roster (Paid Only)

```bash
curl "http://localhost:8080/api/kiosk/driver/routes/KIOSK12345?employee_id=EMP0001&route_id=route_001&paid_only=true"
```

---

## Running Tests

### Backend Integration Tests

```bash
cd backend
php vendor/bin/phpunit tests/integration/DriverKioskTest.php
```

### Frontend Type Check

```bash
cd frontend
bun run type-check
```

### Frontend Lint

```bash
cd frontend
bun run lint
```

---

## Implementation Checklist

### Backend
- [ ] Extend `DriverKioskController::validateDriver()` to return bus info
- [ ] Extend `DriverKioskController::roster()` to include stops
- [ ] Add `paid_only` filter parameter to roster endpoint
- [ ] Create `DriverKioskService` with payment status logic
- [ ] Add integration tests in `tests/integration/DriverKioskTest.php`

### Frontend
- [ ] Update API interfaces in `src/api/api.ts`
- [ ] Add bus display to `DriverKioskPage.tsx`
- [ ] Add stops sequence display
- [ ] Add student stop information
- [ ] Add "Paid Only" toggle filter
- [ ] Update payment status badges

---

## Troubleshooting

### "Employee ID not recognized"
- Verify `employee_id` exists in `staff` table
- Check `employment_status` = 'active'
- Ensure `tenant_id` matches kiosk_code tenant

### "Kiosk not found"
- Verify `kiosk_code` exists in tenant settings JSON
- Check `driverKioskModeEnabled` = true in settings

### "Access denied" for route
- Verify `transport_routes.driver_staff_id` matches staff.id
- Check route status = 'active'
- Verify driver has active `transport_route_periods` record

### No stops showing
- Check `transport_stops.route_id` matches route
- Verify `order_position` values are set (0, 1, 2...)

### Payment status incorrect
- Verify `charges.charge_type` = 'transport'
- Check `charges.academic_year` matches current year
- Ensure `payments.student_id` matches student

---

## References

- **Spec**: [spec.md](../spec.md)
- **Data Model**: [data-model.md](../data-model.md)
- **API Contract**: [contracts/driver-kiosk.md](../contracts/driver-kiosk.md)
- **Payment Contract**: [contracts/payment-status.md](../contracts/payment-status.md)
- **Existing Controller**: `backend/app/Controllers/Api/DriverKioskController.php`
- **Existing Page**: `frontend/src/pages/DriverKioskPage.tsx`

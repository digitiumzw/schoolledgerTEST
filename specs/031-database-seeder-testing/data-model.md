# Data Model: Database Seeder

**Feature**: Database Seeder for Platform Testing  
**Date**: 2026-04-14

## Entity Definitions

### 1. SeedConfiguration

Configuration entity that controls seeding behavior.

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `tenantCount` | int | Number of tenants to create (default: 1) |
| `usersPerTenant` | int | Users per tenant (default: 4) |
| `staffPerTenant` | int | Staff members per tenant (default: 8) |
| `classesPerTenant` | int | Classes per tenant (default: 5) |
| `studentsPerClass` | int | Students per class (default: 10) |
| `chargesPerStudent` | int | Charges per student (default: 2) |
| `paymentsPerStudent` | int | Payments per student (default: 1) |
| `transportRoutesPerTenant` | int | Transport routes (default: 2) |
| `attendanceDays` | int | Days of attendance history (default: 30) |
| `mode` | string | "fresh" (truncate) or "append" (default: "fresh") |
| `scenario` | string | Predefined scenario name (optional) |
| `batchSize` | int | Records per batch insert (default: 100) |
| `excludedEntities` | array | Entity types to skip (optional) |
| `includedEntities` | array | Only seed these entities (optional) |

### 2. FactoryContext

Shared context passed between factories during seeding.

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `tenantId` | string | Current tenant ID |
| `classIds` | array | Created class IDs for student assignment |
| `staffIds` | array | Created staff IDs for teacher assignment |
| `studentIds` | array | Created student IDs for charges/payments |
| `routeIds` | array | Created transport route IDs |
| `faker` | Faker | Faker instance with locale |
| `sequence` | int | Global sequence counter for unique values |

### 3. GeneratedEntity (Abstract)

Base structure for all generated entities.

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID-style unique identifier |
| `tenantId` | string | Parent tenant ID |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

### 4. TenantSeed (extends GeneratedEntity)

Represents a generated tenant/school.

**Additional Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `schoolName` | string | Generated school name |
| `settings` | object | School settings JSON |
| `feeStructure` | object | Fee structure JSON |
| `paymentCategories` | array | Payment category definitions |
| `academicCalendar` | object | Academic calendar JSON |

### 5. UserSeed (extends GeneratedEntity)

Represents a generated user account.

**Additional Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `role` | string | super_admin, admin, bursar, teacher |
| `email` | string | Unique email address |
| `password` | string | Hashed password |
| `name` | string | Full name |
| `status` | string | active, inactive |

### 6. StaffSeed (extends GeneratedEntity)

Represents a generated staff member.

**Additional Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `email` | string | Unique email |
| `phone` | string | Zimbabwean format phone |
| `position` | string | Job position |
| `department` | string | Department |
| `isTeaching` | bool | Teaching staff flag |
| `employeeId` | string | EMPNNNN format |
| `hireDate` | string | Date string |
| `dateOfBirth` | string | Date string |
| `employmentStatus` | string | active, inactive, on_leave |
| `nextOfKin` | object | Next of kin details |

### 7. ClassSeed (extends GeneratedEntity)

Represents a generated class/grade.

**Additional Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Class name (e.g., "7A") |
| `gradeLevelId` | string | Reference to grade level |
| `stream` | string | Class stream (A, B, etc.) |
| `teacherId` | string | Assigned teacher ID |
| `capacity` | int | Max students |
| `nextClassId` | string | Next class in promotion chain |
| `isFinalClass` | bool | Graduation class flag |

### 8. StudentSeed (extends GeneratedEntity)

Represents a generated student.

**Additional Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `admissionNumber` | string | YYYY/NNN format |
| `classId` | string | Assigned class |
| `dateOfBirth` | string | DOB |
| `email` | string | Optional email |
| `address` | string | Address |
| `guardianName` | string | Primary guardian name |
| `guardianPhone` | string | Guardian phone |
| `guardianEmail` | string | Guardian email |
| `guardianRelationship` | string | Relationship |
| `enrollmentDate` | string | Enrollment date |
| `status` | string | active, inactive, graduated, transferred, dropped_out |
| `bursaryStatus` | string | none, partial, full |
| `bursaryPercentage` | int | 0-100 |
| `bursaryReason` | string | Reason for bursary |

### 9. ChargeSeed (extends GeneratedEntity)

Represents a generated charge/fee.

**Additional Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `studentId` | string | Student reference |
| `amount` | float | Charge amount |
| `category` | string | Fee category |
| `chargeType` | string | fee_structure, transport, other |
| `status` | string | pending, partial, paid, overdue |
| `dateGenerated` | string | Generation date |
| `dueDate` | string | Due date |
| `academicYear` | string | Academic year |
| `description` | string | Charge description |

### 10. PaymentSeed (extends GeneratedEntity)

Represents a generated payment.

**Additional Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `studentId` | string | Student reference |
| `amount` | float | Payment amount |
| `date` | string | Payment date |
| `method` | string | Cash, Bank Transfer, Mobile Money, etc. |
| `category` | string | Payment category |
| `description` | string | Payment description |

### 11. TransportRouteSeed (extends GeneratedEntity)

Represents a generated transport route.

**Additional Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `routeName` | string | Route name |
| `pickupPoints` | array | JSON array of stops |
| `vehicle` | string | Vehicle identifier |
| `driverName` | string | Driver name |
| `monthlyFee` | float | Monthly transport fee |
| `status` | string | active, inactive |

### 12. AttendanceSeed (extends GeneratedEntity)

Represents a generated attendance record.

**Additional Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `personId` | string | Staff or student ID |
| `personType` | string | staff, student |
| `date` | string | Attendance date |
| `status` | string | present, absent, late, on_leave, half_day |
| `notes` | string | Optional notes |

## Entity Relationships

```
Tenant (1)
  ├── Users (N)
  ├── Staff (N)
  ├── GradeLevels (N)
  ├── Classes (N) ───────┐
  │   └── teacherId ───┼──> Staff
  │   └── nextClassId ─┼──> Class (self-reference)
  ├── Students (N) ────┤
  │   └── classId ─────┘
  ├── TransportRoutes (N)
  ├── Charges (N) ───────┐
  │   └── studentId ─────┼──> Student
  ├── Payments (N) ──────┤
  │   └── studentId ─────┤
  ├── LedgerAdjustments (N) ─┤
  │   └── studentId ─────┤
  ├── TransportAssignments (N) ─┤
  │   ├── studentId ─────┤
  │   └── routeId ───────┼──> TransportRoute
  └── Attendance (N) ────┘
      └── personId ──────> Staff or Student
```

## Validation Rules

### TenantSeed
- `schoolName`: Required, 3-100 characters
- `settings`: Valid JSON structure

### UserSeed
- `email`: Valid email format, unique per tenant
- `role`: One of [super_admin, admin, bursar, teacher]
- `status`: One of [active, inactive]
- `password`: Min 8 characters (before hashing)

### StaffSeed
- `employeeId`: Unique per tenant, EMPNNNN format
- `email`: Valid email, unique
- `hireDate`: Not in future
- `employmentStatus`: One of [active, inactive, on_leave]

### StudentSeed
- `admissionNumber`: Unique per tenant, YYYY/NNN format
- `classId`: Must reference existing class in same tenant
- `status`: One of [active, inactive, graduated, transferred, dropped_out]
- `bursaryStatus`: One of [none, partial, full]
- `bursaryPercentage`: 0-100 if bursaryStatus != none

### ChargeSeed
- `amount`: Positive number
- `studentId`: Must reference existing student
- `status`: One of [pending, partial, paid, overdue]

### PaymentSeed
- `amount`: Positive number
- `studentId`: Must reference existing student
- `date`: Not in future

## Data Generation Patterns

### Realistic Distributions

**Student Status Distribution**:
- 75% active
- 10% inactive
- 5% graduated
- 5% transferred
- 5% dropped_out

**Bursary Distribution**:
- 70% none
- 20% partial (percentage: 25-75%)
- 10% full (100%)

**Staff Teaching Distribution**:
- 60% teaching staff
- 40% non-teaching (admin, support)

**Payment Status Distribution**:
- 40% fully paid
- 35% partially paid
- 25% pending/overdue

**Charge Categories**:
- Tuition (60%)
- Development Levy (20%)
- Sports Fee (10%)
- Computer Levy (10%)

### Date Patterns

**Enrollment Dates**:
- 80%: Current academic year
- 15%: Previous academic year
- 5%: 2+ years ago

**Payment Dates**:
- Distributed across current term
- 70% within first month of term
- 30% spread across term

**Due Dates**:
- Typically 30 days after charge generation
- Some overdue (10%) for testing

## Factory Interface Contract

Each factory implements:

```php
interface EntityFactoryInterface
{
    /**
     * Generate a single entity instance
     */
    public function make(FactoryContext $context): GeneratedEntity;
    
    /**
     * Generate multiple entities and persist to database
     */
    public function createMany(FactoryContext $context, int $count): array;
    
    /**
     * Get factory priority (determines creation order)
     */
    public function getPriority(): int;
}
```

Priority Order:
1. Tenant (10)
2. GradeLevel (20)
3. User (30)
4. Staff (40)
5. Class (50)
6. TransportRoute (60)
7. Student (70)
8. Charge (80)
9. Payment (90)
10. LedgerAdjustment (100)
11. TransportAssignment (110)
12. Attendance (120)

# CLI Schema: Database Seeder Command

**Feature**: Database Seeder for Platform Testing  
**Interface**: CLI via CodeIgniter 4 Spark Command  
**Command**: `php spark db:seed:platform`

## Command Signature

```
db:seed:platform [options]
```

## Options

### Volume Configuration

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--tenants` | `-t` | int | 1 | Number of tenants to create |
| `--users-per-tenant` | | int | 4 | Users per tenant |
| `--staff-per-tenant` | | int | 8 | Staff members per tenant |
| `--classes-per-tenant` | | int | 5 | Classes per tenant |
| `--students-per-class` | `-s` | int | 10 | Students per class |
| `--charges-per-student` | | int | 2 | Charges per student |
| `--payments-per-student` | | int | 1 | Payments per student |
| `--transport-routes` | | int | 2 | Transport routes per tenant |
| `--attendance-days` | | int | 30 | Days of attendance history |

### Mode Configuration

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--fresh` | `-f` | bool | false | Truncate all tables before seeding |
| `--append` | `-a` | bool | false | Append to existing data (default if no flag) |

### Entity Filtering

| Option | Type | Description |
|--------|------|-------------|
| `--only` | string | Comma-separated list of entities to seed (e.g., "tenants,students,charges") |
| `--skip` | string | Comma-separated list of entities to skip (e.g., "transport,attendance") |

### Scenario Selection

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--scenario` | string | "default" | Predefined scenario name: default, mixed-financial, attendance-variations, class-promotion-chain |

### Performance Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--batch-size` | int | 100 | Records per batch insert |
| `--no-progress` | bool | false | Disable progress bar output |

## Usage Examples

### Basic Usage - Fresh Seed with Defaults

```bash
php spark db:seed:platform --fresh
```

Creates 1 tenant with:
- 4 users
- 8 staff members
- 5 classes
- 50 students (10 per class)
- 100 charges (2 per student)
- 50 payments (1 per student)
- 2 transport routes
- 30 days of attendance

### Large Dataset for Performance Testing

```bash
php spark db:seed:platform \
  --fresh \
  --tenants=5 \
  --classes-per-tenant=10 \
  --students-per-class=20 \
  --batch-size=200
```

Creates 5 tenants with 1000 total students (50 per tenant).

### Specific Scenario - Mixed Financial States

```bash
php spark db:seed:platform \
  --fresh \
  --scenario=mixed-financial \
  --students-per-class=50
```

Creates students with diverse financial states for testing payment flows.

### Append Mode - Add More Students

```bash
php spark db:seed:platform \
  --append \
  --only=students,charges,payments \
  --students-per-class=5
```

Adds 25 more students to existing classes (assuming 5 classes exist).

### Skip Transport and Attendance

```bash
php spark db:seed:platform \
  --fresh \
  --skip=transport,attendance
```

Creates all entities except transport routes and attendance records.

### Only Students and Financial Data

```bash
php spark db:seed:platform \
  --fresh \
  --only=tenants,classes,students,charges,payments
```

Minimal seed with just financial test data.

## Output Format

### Success Output

```
SchoolLedger Platform Database Seeder
=====================================

Configuration:
  Mode: fresh
  Tenants: 1
  Classes per tenant: 5
  Students per class: 10
  Scenario: default

Generating data...
  ✓ Tenants: 1 created
  ✓ Grade Levels: 5 created
  ✓ Users: 4 created
  ✓ Staff: 8 created
  ✓ Classes: 5 created
  ✓ Transport Routes: 2 created
  ✓ Students: 50 created
  ✓ Charges: 100 created
  ✓ Payments: 50 created
  ✓ Attendance: 450 records created

Summary:
  Total entities created: 675
  Time elapsed: 8.4 seconds
  Memory used: 42 MB

✓ Seeding completed successfully!

Test Accounts:
  super_admin: superadmin@greenwood.co.zw / password123
  admin: admin@greenwood.co.zw / password123
  bursar: bursar@greenwood.co.zw / password123
  teacher: teacher@greenwood.co.zw / password123
```

### Error Output

```
ERROR: Cannot run seeder in production environment.
Use --force-production to override (not recommended).

ERROR: Invalid scenario 'unknown-scenario'.
Valid scenarios: default, mixed-financial, attendance-variations, class-promotion-chain

ERROR: Cannot create students without classes.
Either run full seed or ensure classes exist in database.

ERROR: Configuration conflict: --fresh and --append cannot both be specified.
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid configuration |
| 3 | Production environment blocked |
| 4 | Database error |
| 5 | Partial failure (some entities failed) |

## Configuration File Support

### JSON Config File

Create `app/Config/seeder-config.json`:

```json
{
  "defaults": {
    "tenants": 1,
    "usersPerTenant": 4,
    "staffPerTenant": 8,
    "classesPerTenant": 5,
    "studentsPerClass": 10,
    "batchSize": 100
  },
  "scenarios": {
    "performance-test": {
      "tenants": 5,
      "classesPerTenant": 20,
      "studentsPerClass": 50,
      "batchSize": 500
    },
    "minimal": {
      "tenants": 1,
      "usersPerTenant": 1,
      "staffPerTenant": 2,
      "classesPerTenant": 2,
      "studentsPerClass": 5,
      "skip": ["transport", "attendance"]
    }
  },
  "faker": {
    "locale": "en_ZW",
    "seed": null
  }
}
```

### Using Config File

```bash
# Uses defaults from config file
php spark db:seed:platform --fresh

# Override specific values
php spark db:seed:platform --fresh --tenants=3

# Use custom scenario from config
php spark db:seed:platform --scenario=performance-test
```

## Predefined Scenarios

### 1. default
Standard balanced dataset with realistic distributions.

### 2. mixed-financial
Creates students with diverse financial states:
- 20% fully paid
- 30% partially paid  
- 30% outstanding balance
- 10% overdue charges
- 10% write-offs/adjustments

### 3. attendance-variations
Creates varied attendance patterns:
- Staff: present (70%), absent (10%), late (10%), on_leave (10%)
- Students: present (85%), absent (10%), late (5%)
- Half-day tracking enabled

### 4. class-promotion-chain
Creates complete promotion chains:
- Grade 7 → Grade 8 → Grade 9 → Grade 10 → Grade 11
- Proper next_class_id relationships
- Grade 11 marked as is_final_class
- Students distributed across all grades

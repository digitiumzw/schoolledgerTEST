# Quickstart Guide: Database Seeder

**Feature**: Database Seeder for Platform Testing  
**Prerequisites**: PHP 8.1+, MySQL, Composer dependencies installed

## Installation

### 1. Install Faker Dependency

```bash
cd backend
composer require fakerphp/faker --dev
```

### 2. Verify Configuration

Ensure database credentials in `backend/.env` are correct:

```env
CI_ENVIRONMENT = development
database.default.hostname = localhost
database.default.database = schoolledger
database.default.username = root
database.default.password = your_password
database.default.DBDriver = MySQLi
```

### 3. Run Migrations (if needed)

```bash
php spark migrate
```

## Basic Usage

### Fresh Seed with Defaults

Create a complete test dataset (truncates existing data):

```bash
php spark db:seed:platform --fresh
```

This creates:
- 1 tenant (Greenwood Academy)
- 4 users (super_admin, admin, bursar, teacher)
- 8 staff members
- 5 classes (Grade 7A through Grade 11A)
- 50 students (10 per class)
- 100 charges (2 per student)
- 50 payments (1 per student)
- 2 transport routes
- 30 days of attendance records

### Login with Test Accounts

After seeding, use these accounts to test:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@greenwood.co.zw | password123 |
| Admin | admin@greenwood.co.zw | password123 |
| Bursar | bursar@greenwood.co.zw | password123 |
| Teacher | teacher@greenwood.co.zw | password123 |

## Common Scenarios

### Performance Testing

Generate large dataset for load testing:

```bash
php spark db:seed:platform \
  --fresh \
  --tenants=1 \
  --classes-per-tenant=100 \
  --students-per-class=200 \
  --batch-size=2000
```

This creates 5 tenants with 1000 total students.

### Financial Edge Cases

Test payment workflows with varied financial states:

```bash
php spark db:seed:platform \
  --fresh \
  --scenario=mixed-financial \
  --students-per-class=30
```

Creates students with:
- Outstanding balances
- Partial payments
- Overdue charges
- Bursary recipients

### Minimal Seed (Fast)

Quick seed for basic testing:

```bash
php spark db:seed:platform \
  --fresh \
  --skip=transport,attendance \
  --students-per-class=5
```

### Add More Data

Append to existing seed:

```bash
php spark db:seed:platform \
  --append \
  --only=students,charges \
  --students-per-class=5
```

## Advanced Configuration

### Custom Config File

Create `backend/app/Config/Seeder.php`:

```php
<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

class Seeder extends BaseConfig
{
    public array $defaults = [
        'tenants' => 1,
        'usersPerTenant' => 4,
        'staffPerTenant' => 8,
        'classesPerTenant' => 5,
        'studentsPerClass' => 10,
        'batchSize' => 100,
    ];
    
    public string $fakerLocale = 'en_ZW';
    
    public array $passwords = [
        'super_admin' => 'super123',
        'admin' => 'admin123',
        'bursar' => 'bursar123',
        'teacher' => 'teacher123',
    ];
}
```

### Environment-Specific Seeding

Development only (blocked in production by default):

```bash
# Development - works automatically
php spark db:seed:platform --fresh

# To override production block (dangerous!)
php spark db:seed:platform --fresh --force-production
```

## Verification

### Check Generated Data

```sql
-- Count students per class
SELECT c.name, COUNT(s.id) as student_count
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
GROUP BY c.id;

-- Check financial data
SELECT 
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_charges,
    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_charges
FROM charges;

-- Verify balance calculations
SELECT 
    s.admission_number,
    COALESCE(SUM(c.amount), 0) - COALESCE(SUM(p.amount), 0) as balance
FROM students s
LEFT JOIN charges c ON c.student_id = s.id
LEFT JOIN payments p ON p.student_id = s.id
GROUP BY s.id
LIMIT 10;
```

### Run Tests

```bash
# Run seeder-specific tests
php spark test tests/Database/Seeds/

# Run full test suite
php spark test
```

## Troubleshooting

### Memory Exhaustion

If seeding large datasets runs out of memory:

```bash
# Increase batch size (fewer queries, more memory per batch)
php spark db:seed:platform --fresh --batch-size=500

# Or reduce overall dataset size
php spark db:seed:platform --fresh --tenants=2 --classes-per-tenant=5
```

### Foreign Key Errors

Usually means existing data conflicts:

```bash
# Clear all data and start fresh
php spark db:seed:platform --fresh

# Or manually truncate tables
php spark db:table --truncate students
php spark db:table --truncate charges
# ... etc
```

### Unique Constraint Violations

If you see "Duplicate entry" errors:

```bash
# Use fresh mode to clear existing data
php spark db:seed:platform --fresh

# Or append mode to add to existing
php spark db:seed:platform --append
```

### Slow Seeding

For faster seeding:

```bash
# Disable foreign key checks during seeding (automatic)
# Use larger batch sizes
php spark db:seed:platform --fresh --batch-size=500

# Skip heavy entities
php spark db:seed:platform --fresh --skip=attendance
```

## Development Workflow

### 1. Reset Before Testing

```bash
# Quick reset to known state
php spark db:seed:platform --fresh
```

### 2. Test Specific Features

```bash
# Test payment workflows
php spark db:seed:platform --fresh --scenario=mixed-financial

# Test attendance features  
php spark db:seed:platform --fresh --scenario=attendance-variations

# Test class promotion
php spark db:seed:platform --fresh --scenario=class-promotion-chain
```

### 3. CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Seed Test Database
  run: |
    cd backend
    php spark migrate
    php spark db:seed:platform --fresh --tenants=1 --students-per-class=5
    
- name: Run Tests
  run: |
    cd backend
    php spark test
```

## Next Steps

- Review the [specification](spec.md) for detailed requirements
- Check the [CLI schema](contracts/cli-schema.md) for all command options
- See [data model](data-model.md) for entity definitions
- Read [research findings](research.md) for implementation details

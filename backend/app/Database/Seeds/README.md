# SchoolLedger Platform Database Seeder

A configurable, factory-based database seeder for development, testing, and demonstration purposes.

## Architecture

```
app/Commands/
└── SeedDatabaseCommand.php        # CLI entry point (php spark db:seed:platform)

app/Database/Seeds/
├── DatabaseSeeder.php             # Main orchestrator
├── EntityFactoryInterface.php     # Contract for all factories
├── AbstractFactory.php            # (not here - in Factories/)
├── FactoryContext.php             # Shared state passed between factories
├── UniqueValueGenerator.php       # Handles uniqueness (emails, IDs, admission numbers)
├── ScenarioRegistry.php           # Lookup registry for named scenarios
├── Factories/
│   ├── AbstractFactory.php        # Base class with batch insert & helpers
│   ├── TenantFactory.php          # Priority 10: Creates schools/tenants
│   ├── GradeLevelFactory.php      # Priority 20: Grade 7–11
│   ├── UserFactory.php            # Priority 30: Admin users per tenant
│   ├── StaffFactory.php           # Priority 40: Teaching and admin staff
│   ├── ClassFactory.php           # Priority 50: Classes with promotion chain
│   ├── TransportRouteFactory.php  # Priority 60: Bus routes
│   ├── StudentFactory.php         # Priority 70: Students linked to classes
│   ├── ChargeFactory.php          # Priority 80: Fee charges per student
│   ├── PaymentFactory.php         # Priority 90: Payments per student
│   ├── TransportAssignmentFactory.php  # Priority 110: Assigns students to routes
│   ├── AttendanceFactory.php      # Priority 120: 30-day attendance history
│   └── Providers/
│       └── ZimbabweanProvider.php # Custom Faker provider (names, phones, addresses)
└── Scenarios/
    ├── AbstractScenario.php       # Base class for scenarios
    ├── DefaultScenario.php        # Standard balanced distribution
    ├── MixedFinancialScenario.php # Varied financial states
    ├── AttendanceVariationsScenario.php  # Extended attendance (60 days)
    └── ClassPromotionChainScenario.php   # Complete 5-class promotion chain
```

## Usage

### Basic Usage

```bash
# Quick start with defaults (1 tenant, 5 classes, 10 students/class)
php spark db:seed:platform --fresh

# Custom volumes
php spark db:seed:platform --fresh --tenants=2 --classes-per-tenant=5 --students-per-class=20

# Append to existing data (no truncation)
php spark db:seed:platform --append --tenants=1
```

### Option Reference

| Option | Default | Description |
|--------|---------|-------------|
| `--fresh` | default | Truncate all tables before seeding |
| `--append` | - | Skip truncation, append to existing data |
| `--tenants=N` | 1 | Number of tenant schools to create |
| `--users-per-tenant=N` | 4 | Users per tenant (super_admin, admin, bursar, teacher) |
| `--staff-per-tenant=N` | 8 | Staff members per tenant |
| `--classes-per-tenant=N` | 5 | Classes per tenant |
| `--students-per-class=N` | 10 | Students distributed per class |
| `--charges-per-student=N` | 2 | Fee charges per student |
| `--payments-per-student=N` | 1 | Payments per student |
| `--transport-routes=N` | 2 | Transport routes per tenant |
| `--attendance-days=N` | 30 | Days of attendance history |
| `--scenario=NAME` | - | Use a predefined scenario |
| `--only=a,b,c` | - | Only seed these entity types |
| `--skip=a,b,c` | - | Skip these entity types |
| `--batch-size=N` | 100 | Records per batch insert |
| `--list-scenarios` | - | Show available scenarios |

### Scenarios

```bash
# List all available scenarios
php spark db:seed:platform --list-scenarios

# Mixed financial states (varied paid/overdue/partial)
php spark db:seed:platform --fresh --scenario=mixed-financial

# Extended attendance records (60 days)
php spark db:seed:platform --fresh --scenario=attendance-variations

# Complete promotion chain (Grade 7→11)
php spark db:seed:platform --fresh --scenario=class-promotion-chain
```

### Selective Seeding

```bash
# Only create tenants and users
php spark db:seed:platform --fresh --only=tenants,users

# Skip attendance records (much faster)
php spark db:seed:platform --fresh --skip=attendance
```

## Adding a New Factory

1. Create `app/Database/Seeds/Factories/MyEntityFactory.php`:

```php
namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;

class MyEntityFactory extends AbstractFactory
{
    public function getPriority(): int
    {
        return 95; // Between Payment (90) and TransportAssignment (110)
    }

    protected function tableName(): string
    {
        return 'my_entities';
    }

    public function make(FactoryContext $context): array
    {
        return [
            'id'         => $this->generateId('me'),
            'tenant_id'  => $context->tenantId,
            // ... other fields
            'created_at' => $this->now(),
            'updated_at' => $this->now(),
        ];
    }
}
```

2. Register it in `DatabaseSeeder.php` by instantiating it and calling `createMany()`.

## Adding a Custom Scenario

1. Create `app/Database/Seeds/Scenarios/MyScenario.php`:

```php
namespace App\Database\Seeds\Scenarios;

class MyScenario extends AbstractScenario
{
    public function name(): string { return 'my-scenario'; }
    public function description(): string { return 'My custom scenario'; }

    public function configure(array &$config): void
    {
        $config['studentsPerClass'] = 50;
        $config['chargesPerStudent'] = 6;
    }
}
```

2. Register it in `ScenarioRegistry.php`:

```php
$this->register(new MyScenario());
```

3. Use it:

```bash
php spark db:seed:platform --fresh --scenario=my-scenario
```

## Troubleshooting

**Unique constraint errors** (emails, employee IDs):
- These are globally unique — the seeder handles them automatically via `UniqueValueGenerator`
- If you see duplicates, truncate first with `--fresh`

**Memory issues on large datasets**:
- Reduce `--batch-size` (default 100) if needed
- The seeder targets <256MB peak usage

**Schema changes**:
- If migrations are added, verify factory field lists match the new schema
- Run `php spark migrate` before seeding

**Production safety**:
- The seeder blocks in `production` environment by default
- Override with `--force-production` (use with extreme caution)

# Research: Database Seeder Implementation

**Feature**: Database Seeder for Platform Testing  
**Date**: 2026-04-14

## Unknowns Researched

### 1. Faker Library for PHP

**Decision**: Use FakerPHP (fakerphp/faker)

**Rationale**:
- Most popular and maintained PHP fake data library (5M+ downloads)
- Already has locale support including `en_ZW` for Zimbabwean data
- Extensible with custom providers for domain-specific data
- Works seamlessly with CodeIgniter 4
- Supports unique value generation with retry logic

**Alternatives Considered**:
- **chancephp/chance**: Smaller library, less community support
- **Custom implementation**: Would require significant effort for realistic data patterns
- **Using existing CompleteDatabaseSeeder patterns**: Static data only, not configurable

### 2. Seeder Architecture Pattern

**Decision**: Factory Pattern + Scenario Pattern + Command Pattern

**Rationale**:
- **Factory Pattern**: Each entity type has its own factory class responsible for generating realistic data
- **Scenario Pattern**: Predefined scenarios encapsulate complex multi-entity configurations
- **Command Pattern**: CLI integration via CodeIgniter 4's spark command system
- This architecture mirrors Laravel's seeding approach which is well-documented and tested

**Structure**:
```
Commands/SeedDatabaseCommand.php       # CLI entry point
Seeds/DatabaseSeeder.php               # Main orchestrator
Seeds/Factories/*Factory.php           # Entity-specific factories  
Seeds/Scenarios/*Scenario.php          # Predefined test scenarios
```

### 3. Configuration Management

**Decision**: Multi-layer configuration (defaults < config file < CLI arguments)

**Rationale**:
- CodeIgniter 4 supports Config classes for defaults
- CLI arguments via spark provide override capability
- JSON config file support for complex scenario definitions

**Priority**: CLI args > Config/Seeder.php > Factory defaults

### 4. Batch Processing for Large Datasets

**Decision**: Process entities in configurable batches (default 100 records per batch)

**Rationale**:
- Prevents memory exhaustion on large datasets (10,000+ students)
- Allows progress reporting during long operations
- MySQL can handle large INSERT batches efficiently
- Rollback is easier per-batch than per-record

**Implementation**:
```php
foreach (array_chunk($records, $batchSize) as $batch) {
    $this->db->table('students')->insertBatch($batch);
    $progressBar->advance(count($batch));
}
```

### 5. Unique Value Handling

**Decision**: Use Faker's `unique()` modifier with retry logic and fallback to sequenced values

**Rationale**:
- Emails, admission numbers, and employee IDs must be unique
- Faker's unique() handles most cases automatically
- For high-volume seeding, fall back to deterministic sequenced values
- Retry with incremented sequence if collision detected

**Example Pattern**:
```php
// Primary: Faker unique
$email = $faker->unique()->safeEmail();

// Fallback for high volumes
if (collisionDetected) {
    $email = "student{$sequence}@test.edu";
}
```

### 6. Referential Integrity Strategy

**Decision**: Generate in dependency order with ID tracking

**Generation Order**:
1. Tenants (no dependencies)
2. Grade Levels (tenant only)
3. Users (tenant only)
4. Staff (tenant only)
5. Classes (tenant, grade level, teacher)
6. Students (tenant, class)
7. Transport Routes (tenant)
8. Charges (tenant, student)
9. Payments (tenant, student)
10. Ledger Adjustments (tenant, student)
11. Transport Assignments (tenant, student, route)
12. Attendance Records (tenant, staff/student)

**ID Tracking**: Each factory returns created IDs for downstream factories

### 7. Zimbabwean Context Data

**Decision**: Custom Faker provider with Zimbabwean locale data

**Data Categories**:
- **Names**: Common Zimbabwean names (Shona, Ndebele, English)
- **Schools**: "Primary School", "High School" suffixes; locations like Harare, Bulawayo
- **Addresses**: Harare suburbs, street naming patterns
- **Phones**: +263 format (077, 078, 071 prefixes)
- **Positions**: Headmaster, Deputy, Teacher, Bursar, etc.

**Implementation**: Extend Faker with custom Provider class in `app/Database/Seeds/Factories/Providers/ZimbabweanProvider.php`

## Best Practices Applied

### 1. CodeIgniter 4 Seeding Conventions
- Extend `CodeIgniter\Database\Seeder` base class
- Use `insertBatch()` for performance
- Leverage existing models for data formatting
- Respect `allowedFields` for security

### 2. Test Data Realism
- Use weighted distributions (80% active students, 20% various other statuses)
- Generate correlated data (higher grades = higher fees)
- Create realistic date ranges (enrollment dates in past, not future)
- Include edge cases (empty optional fields, max-length strings)

### 3. Performance Optimization
- Batch inserts (100-500 records per batch)
- Disable foreign key checks during seeding
- Use transactions for rollback capability
- Progress bars for user feedback

### 4. Maintainability
- Factory methods are pure functions (same input = same output pattern)
- Scenarios are composable (can combine multiple scenarios)
- Clear separation between data generation and persistence
- Extensive PHPDoc for IDE support

## Integration Points

### 1. Existing Seeders
- Keep `CompleteDatabaseSeeder.php` for backward compatibility
- New seeder can call existing seeder as one of the scenarios
- Both can coexist; migrate documentation to favor new seeder

### 2. Model Validation
- Use existing models' `formatFromApi()` for data normalization
- Respect validation rules defined in models
- Leverage model methods like `generateAdmissionNumber()`

### 3. CLI Integration
- Register command in `app/Config/Commands.php`
- Command: `php spark db:seed:platform`
- Arguments: `--tenants=3 --students-per-class=20 --fresh`

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Unique constraint violations | Use Faker unique() + sequence fallback |
| Memory exhaustion | Batch processing with configurable batch size |
| Foreign key errors | Strict generation order with ID tracking |
| Password hashing | Use existing UserModel->authenticate() pattern |
| Schema drift | Document seeder as requiring migration sync |
| Production data contamination | Add explicit "--production-guard" check that blocks production environment seeding |

## Decisions Summary

| Area | Decision |
|------|----------|
| Fake Data Library | FakerPHP with custom Zimbabwean provider |
| Architecture | Factory + Scenario + Command patterns |
| Configuration | Config class + CLI arguments |
| Performance | Batch processing (100-500 records/batch) |
| Unique Values | Faker unique() with sequence fallback |
| Integrity | Dependency-ordered generation with ID tracking |
| Safety | Production environment blocking |

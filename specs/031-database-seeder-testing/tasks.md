# Implementation Tasks: Database Seeder for Platform Testing

**Feature**: Database Seeder for Platform Testing  
**Branch**: `031-database-seeder-testing`  
**Generated**: 2026-04-14

## Overview

This task list implements a comprehensive, configurable database seeder for the SchoolLedger platform. The seeder generates realistic test data using factory patterns, supports multiple scenarios, and integrates with CodeIgniter 4's CLI (spark) system.

### User Story Dependencies

```
Phase 3: US1 (Configurable Data Generation) [P1] - MVP
         │
         ├─ Can be implemented and tested independently
         │
Phase 4: US2 (Realistic Data Factories) [P2]
         │
         ├─ Depends on: Base factory classes from Phase 2
         │
Phase 5: US3 (Edge Case Scenarios) [P3]
         │
         └─ Depends on: All factories from US2
```

**MVP Scope**: Complete Phase 1-3 (Setup, Foundational, US1) to deliver a working configurable seeder. US2 and US3 can follow incrementally.

---

## Phase 1: Setup

**Goal**: Install dependencies and prepare project structure

### Tasks

- [ ] T001 Install FakerPHP dependency via Composer
  - **File**: `backend/composer.json`
  - **Action**: Run `composer require fakerphp/faker --dev` in backend directory
  - **Verify**: `composer show fakerphp/faker` returns package info

- [ ] T002 Create factory directory structure
  - **Files**: 
    - `backend/app/Database/Seeds/Factories/` (directory)
    - `backend/app/Database/Seeds/Scenarios/` (directory)
    - `backend/app/Database/Seeds/Factories/Providers/` (directory)
    - `backend/app/Commands/` (directory, may exist)
  - **Action**: Create directory structure per implementation plan

- [ ] T003 Create test directory structure
  - **Files**:
    - `backend/tests/Database/Seeds/` (directory)
    - `backend/tests/Database/Seeds/Factories/` (directory)
  - **Action**: Create test directory structure for seeder tests

---

## Phase 2: Foundational Infrastructure

**Goal**: Build base classes and configuration that all user stories depend on

### Tasks

- [ ] T004 [P] Create Seeder configuration class
  - **File**: `backend/app/Config/Seeder.php`
  - **Action**: Define default values for all seeder parameters (tenant count, users per tenant, batch size, etc.)
  - **Config Keys**: `defaults`, `fakerLocale`, `passwords`, `batchSize`

- [ ] T005 [P] Create FactoryContext class for shared state
  - **File**: `backend/app/Database/Seeds/FactoryContext.php`
  - **Properties**: `$tenantId`, `$classIds[]`, `$staffIds[]`, `$studentIds[]`, `$routeIds[]`, `$faker`, `$sequence`
  - **Methods**: Constructor, getter/setter methods for tracking created entity IDs

- [ ] T006 [P] Create EntityFactoryInterface
  - **File**: `backend/app/Database/Seeds/EntityFactoryInterface.php`
  - **Methods**: `make(FactoryContext $context): array`, `createMany(FactoryContext $context, int $count): array`, `getPriority(): int`
  - **Purpose**: Contract that all factories must implement

- [ ] T007 [P] Create AbstractFactory base class
  - **File**: `backend/app/Database/Seeds/Factories/AbstractFactory.php`
  - **Extends**: CodeIgniter Database Seeder
  - **Implements**: EntityFactoryInterface
  - **Features**: Batch insert support, progress tracking, unique value collision handling

- [ ] T008 [P] Create Zimbabwean Faker Provider
  - **File**: `backend/app/Database/Seeds/Factories/Providers/ZimbabweanProvider.php`
  - **Data**: Local names (Shona, Ndebele), Harare suburbs, school naming patterns, +263 phone formats
  - **Methods**: `schoolName()`, `zimbabweanName()`, `zimbabweanPhone()`, `harareAddress()`, `schoolPosition()`

- [ ] T009 Create unique value generator utility
  - **File**: `backend/app/Database/Seeds/UniqueValueGenerator.php`
  - **Purpose**: Handle email, admission number, employee ID uniqueness with retry logic
  - **Methods**: `generateEmail()`, `generateAdmissionNumber()`, `generateEmployeeId()` with collision detection

---

## Phase 3: User Story 1 - Configurable Data Generation

**Story**: As a developer, I want to run a configurable database seeder to quickly set up test environments  
**Priority**: P1 (MVP)  
**Independent Test**: Run `php spark db:seed:platform --fresh --tenants=1 --classes-per-tenant=2 --students-per-class=5` and verify correct counts in database

### Tasks

- [ ] T010 [US1] Create main CLI command class
  - **File**: `backend/app/Commands/SeedDatabaseCommand.php`
  - **Extends**: CodeIgniter CLI Command
  - **Features**: 
    - Parse all CLI arguments (`--tenants`, `--students-per-class`, `--fresh`, `--append`, `--only`, `--skip`)
    - Validate configuration combinations
    - Production environment guard
    - Progress output display
  - **Command**: `php spark db:seed:platform`

- [ ] T011 [US1] [P] Create TenantFactory
  - **File**: `backend/app/Database/Seeds/Factories/TenantFactory.php`
  - **Extends**: AbstractFactory
  - **Priority**: 10 (first)
  - **Output**: Tenant with settings, fee structure, payment categories, academic calendar
  - **Dependencies**: None (root entity)

- [ ] T012 [US1] [P] Create UserFactory
  - **File**: `backend/app/Database/Seeds/Factories/UserFactory.php`
  - **Extends**: AbstractFactory
  - **Priority**: 30
  - **Output**: Users per tenant with roles (super_admin, admin, bursar, teacher)
  - **Dependencies**: Tenant (via FactoryContext)
  - **Note**: Passwords hashed using existing UserModel pattern

- [ ] T013 [US1] [P] Create StaffFactory (basic version)
  - **File**: `backend/app/Database/Seeds/Factories/StaffFactory.php`
  - **Extends**: AbstractFactory
  - **Priority**: 40
  - **Output**: Staff members with basic fields (no Zimbabwean-specific data yet)
  - **Dependencies**: Tenant
  - **Note**: Use sequenced employee IDs (EMP0001, etc.)

- [ ] T014 [US1] [P] Create ClassFactory
  - **File**: `backend/app/Database/Seeds/Factories/ClassFactory.php`
  - **Extends**: AbstractFactory
  - **Priority**: 50
  - **Output**: Classes with grade levels, capacity, teacher assignment
  - **Dependencies**: Tenant, Staff (for teacher_id)

- [ ] T015 [US1] [P] Create StudentFactory (basic version)
  - **File**: `backend/app/Database/Seeds/Factories/StudentFactory.php`
  - **Extends**: AbstractFactory
  - **Priority**: 70
  - **Output**: Students linked to classes, basic fields only
  - **Dependencies**: Tenant, Class
  - **Note**: Use existing StudentModel admission number generation

- [ ] T016 [US1] [P] Create ChargeFactory
  - **File**: `backend/app/Database/Seeds/Factories/ChargeFactory.php`
  - **Extends**: AbstractFactory
  - **Priority**: 80
  - **Output**: Charges for students (tuition, levies)
  - **Dependencies**: Tenant, Student
  - **Note**: Generate fees based on tenant's fee structure

- [ ] T017 [US1] [P] Create PaymentFactory
  - **File**: `backend/app/Database/Seeds/Factories/PaymentFactory.php`
  - **Extends**: AbstractFactory
  - **Priority**: 90
  - **Output**: Payments for students (partial, full payments)
  - **Dependencies**: Tenant, Student
  - **Note**: Ensure payment amounts don't exceed total charges

- [ ] T018 [US1] Create main DatabaseSeeder orchestrator
  - **File**: `backend/app/Database/Seeds/DatabaseSeeder.php`
  - **Extends**: CodeIgniter Seeder
  - **Features**:
    - Orchestrates all factories in priority order
    - Handles batch processing configuration
    - Supports `--only` and `--skip` filtering
    - Manages fresh vs append mode (truncate tables)
    - Tracks and reports progress
    - Calculates and reports statistics
  - **Output Format**: Summary table with counts and timing

- [ ] T019 [US1] Implement entity filtering logic (--only, --skip)
  - **File**: `backend/app/Database/Seeds/DatabaseSeeder.php`
  - **Action**: Add methods to filter which factories run based on CLI arguments
  - **Validation**: Prevent invalid combinations (e.g., cannot seed students without classes)

- [ ] T020 [US1] Implement fresh vs append mode
  - **File**: `backend/app/Database/Seeds/DatabaseSeeder.php`
  - **Action**: 
    - `--fresh`: Truncate all seeded tables before starting
    - `--append`: Skip truncation, append to existing (check for conflicts)
  - **Tables to truncate**: tenants, users, staff, classes, grade_levels, students, charges, payments, ledger_adjustments, transport_routes, transport_assignments, student_attendance, staff_attendance, enrollments, billing_runs

- [ ] T021 [US1] Add production environment guard
  - **File**: `backend/app/Commands/SeedDatabaseCommand.php`
  - **Action**: Check `CI_ENVIRONMENT` config; if 'production', require `--force-production` flag or exit with error

- [ ] T022 [US1] Test basic seeder execution
  - **Test**: Run `php spark db:seed:platform --fresh --tenants=1 --classes-per-tenant=2 --students-per-class=5`
  - **Verify**: 
    - 1 tenant created
    - 4 users per tenant
    - 2 classes per tenant
    - 10 students total
    - Valid foreign key relationships
  - **Performance**: Should complete in <10 seconds

---

## Phase 4: User Story 2 - Realistic Data Factories

**Story**: As a developer, I want factory classes that generate realistic fake data so that test data looks authentic  
**Priority**: P2  
**Independent Test**: Generate 50 students and verify Zimbabwean names, YYYY/NNN admission numbers, +263 phone formats

### Tasks

- [ ] T023 [US2] Enhance TenantFactory with Zimbabwean school data
  - **File**: `backend/app/Database/Seeds/Factories/TenantFactory.php`
  - **Action**: Integrate ZimbabweanProvider for realistic school names and addresses
  - **Update**: Settings, fee structure, payment categories with realistic data

- [ ] T024 [US2] Enhance UserFactory with realistic names
  - **File**: `backend/app/Database/Seeds/Factories/UserFactory.php`
  - **Action**: Use ZimbabweanProvider for realistic full names matching roles

- [ ] T025 [US2] Enhance StaffFactory with Zimbabwean context
  - **File**: `backend/app/Database/Seeds/Factories/StaffFactory.php`
  - **Update Fields**:
    - `first_name`, `last_name`: Zimbabwean names
    - `phone`: +263 format (077, 078, 071 prefixes)
    - `address`: Harare suburbs (Borrowdale, Avondale, etc.)
    - `position`: Realistic roles (Mathematics Teacher, Deputy Head, Bursar, etc.)
    - `department`: Academic, Administration, Finance, Operations
    - `date_of_birth`: Ages appropriate for role
    - `next_of_kin`: Realistic guardian data
  - **Validation**: Employee IDs follow EMPNNNN format

- [ ] T026 [US2] Enhance ClassFactory with realistic naming
  - **File**: `backend/app/Database/Seeds/Factories/ClassFactory.php`
  - **Update**: Class names (7A, 8B, etc.) linked to grade levels
  - **Add**: Grade level factory if not existing

- [ ] T027 [US2] [P] Create GradeLevelFactory
  - **File**: `backend/app/Database/Seeds/Factories/GradeLevelFactory.php`
  - **Priority**: 20 (after Tenant, before Users)
  - **Output**: Grade 7 through Grade 11 with sort_order
  - **Dependencies**: Tenant

- [ ] T028 [US2] Enhance StudentFactory with Zimbabwean context
  - **File**: `backend/app/Database/Seeds/Factories/StudentFactory.php`
  - **Update Fields**:
    - `first_name`, `last_name`: Zimbabwean names (Shona, Ndebele patterns)
    - `admission_number`: YYYY/NNN format using StudentModel generation
    - `date_of_birth`: Ages 11-18 based on grade level
    - `guardian_name`, `guardian_phone`: Realistic guardian data
    - `guardian_email`: Valid email format
    - `address`: Harare address patterns
    - `enrollment_date`: Past dates in current academic year
    - `bursary_status`: Distribution (70% none, 20% partial, 10% full)
    - `bursary_percentage`: 0-100 based on bursary_status
    - `bursary_reason`: Realistic reasons for bursary recipients

- [ ] T029 [US2] Enhance ChargeFactory with realistic fee data
  - **File**: `backend/app/Database/Seeds/Factories/ChargeFactory.php`
  - **Update**: 
    - Categories: Tuition, Development Levy, Sports Fee, Computer Levy
    - Amounts: Based on tenant's fee_structure configuration
    - Due dates: 30 days after generation
    - Status distribution: 40% paid, 35% partial, 25% pending/overdue

- [ ] T030 [US2] Enhance PaymentFactory with realistic patterns
  - **File**: `backend/app/Database/Seeds/Factories/PaymentFactory.php`
  - **Update**:
    - Methods: Cash, Bank Transfer, Mobile Money (EcoCash, OneMoney)
    - Amounts: Realistic partial/full payments matching charge statuses
    - Dates: Distributed across current term
    - Descriptions: Realistic payment notes

- [ ] T031 [US2] [P] Create TransportRouteFactory
  - **File**: `backend/app/Database/Seeds/Factories/TransportRouteFactory.php`
  - **Priority**: 60
  - **Output**: Transport routes with realistic:
    - Route names ("Route A - City Centre", "Route B - Borrowdale")
    - Pickup points as JSON array
    - Vehicle identifiers (Bus GA-001)
    - Driver names and phones
    - Monthly fees ($50-80)
  - **Dependencies**: Tenant

- [ ] T032 [US2] [P] Create TransportAssignmentFactory
  - **File**: `backend/app/Database/Seeds/Factories/TransportAssignmentFactory.php`
  - **Priority**: 110
  - **Output**: 20-30% of students assigned to routes
  - **Dependencies**: Tenant, Student, TransportRoute

- [ ] T033 [US2] [P] Create AttendanceFactory
  - **File**: `backend/app/Database/Seeds/Factories/AttendanceFactory.php`
  - **Priority**: 120
  - **Output**: Attendance records for past 30 days
  - **Distribution**: Staff (70% present, 10% absent, 10% late, 10% on_leave), Students (85% present, 10% absent, 5% late)
  - **Dependencies**: Tenant, Staff, Student

- [ ] T034 [US2] Test realistic data generation
  - **Test**: Run seeder and sample generated data
  - **Verify**:
    - Student names are Zimbabwean (e.g., Tinashe, Rumbidzai, Moyo, Ndlovu)
    - Admission numbers match YYYY/NNN pattern
    - Phone numbers start with +263
    - Addresses contain Harare suburbs
    - Staff positions are realistic school roles
  - **Sample Size**: 100 students, 20 staff

---

## Phase 5: User Story 3 - Edge Case and Scenario Seeding

**Story**: As a QA engineer, I want predefined scenarios to efficiently test business logic edge cases  
**Priority**: P3  
**Independent Test**: Run `--scenario=mixed-financial` and verify diverse financial states exist

### Tasks

- [ ] T035 [US3] Create AbstractScenario base class
  - **File**: `backend/app/Database/Seeds/Scenarios/AbstractScenario.php`
  - **Features**: 
    - `configure(SeedConfiguration $config): void` - modify configuration
    - `apply(array $entities): void` - post-generation modifications
  - **Purpose**: Base class for all scenarios

- [ ] T036 [US3] Create DefaultScenario
  - **File**: `backend/app/Database/Seeds/Scenarios/DefaultScenario.php`
  - **Extends**: AbstractScenario
  - **Action**: Standard balanced distribution (what US1/US2 produce)
  - **Purpose**: Baseline scenario for comparison

- [ ] T037 [US3] Create MixedFinancialScenario
  - **File**: `backend/app/Database/Seeds/Scenarios/MixedFinancialScenario.php`
  - **Goal**: Create students with diverse financial states
  - **Distribution**:
    - 20% fully paid (all charges have matching payments)
    - 30% partially paid (some charges paid, some pending)
    - 30% outstanding balance (payments < charges)
    - 10% overdue (due_date < today, status = overdue)
    - 10% with write-offs/credit adjustments
  - **Implementation**: Override ChargeFactory and PaymentFactory parameters

- [ ] T038 [US3] Create AttendanceVariationsScenario
  - **File**: `backend/app/Database/Seeds/Scenarios/AttendanceVariationsScenario.php`
  - **Goal**: Varied attendance patterns for testing
  - **Distribution**:
    - Staff: present (60%), absent (15%), late (15%), on_leave (10%)
    - Students: present (80%), absent (15%), late (5%)
    - Include half-day records for some staff
  - **Date range**: Last 60 days for more data

- [ ] T039 [US3] Create ClassPromotionChainScenario
  - **File**: `backend/app/Database/Seeds/Scenarios/ClassPromotionChainScenario.php`
  - **Goal**: Complete promotion chain for graduation testing
  - **Features**:
    - Grade 7 → Grade 8 → Grade 9 → Grade 10 → Grade 11
    - Each class has proper `next_class_id` relationship
    - Grade 11 marked as `is_final_class = true`
    - Students distributed evenly across all grades
    - Some students marked for promotion testing

- [ ] T040 [US3] Integrate scenarios into CLI command
  - **File**: `backend/app/Commands/SeedDatabaseCommand.php`
  - **Update**: Add `--scenario` argument parsing
  - **Validation**: Check scenario name is valid
  - **Action**: Load scenario class and apply configuration overrides before seeding

- [ ] T041 [US3] Create scenario configuration system
  - **File**: `backend/app/Database/Seeds/ScenarioRegistry.php`
  - **Purpose**: Register and retrieve scenarios by name
  - **Methods**: `register()`, `get()`, `getAll()`, `exists()`

- [ ] T042 [US3] Test mixed-financial scenario
  - **Test**: `php spark db:seed:platform --fresh --scenario=mixed-financial`
  - **Verify**:
    - Query students with `SUM(charges) - SUM(payments)` to verify varied balances
    - Check for overdue charges (due_date < CURDATE())
    - Verify some students have ledger adjustments
  - **SQL Check**: `SELECT status, COUNT(*) FROM charges GROUP BY status`

- [ ] T043 [US3] Test attendance-variations scenario
  - **Test**: `php spark db:seed:platform --fresh --scenario=attendance-variations`
  - **Verify**:
    - Query attendance records for status distribution
    - Check for half-day status in staff_attendance
    - Verify date range covers 60 days

- [ ] T044 [US3] Test class-promotion-chain scenario
  - **Test**: `php spark db:seed:platform --fresh --scenario=class-promotion-chain`
  - **Verify**:
    - Classes have proper next_class_id chain
    - Grade 11 is_final_class = 1
    - Students exist in all 5 grades

---

## Phase 6: Polish and Cross-Cutting Concerns

**Goal**: Add tests, documentation, and final refinements

### Tasks

- [ ] T045 [P] Create AbstractFactory unit test
  - **File**: `backend/tests/Database/Seeds/Factories/AbstractFactoryTest.php`
  - **Tests**: Batch insert, unique value handling, progress tracking

- [ ] T046 [P] Create TenantFactory unit test
  - **File**: `backend/tests/Database/Seeds/Factories/TenantFactoryTest.php`
  - **Tests**: Generates valid tenant, settings JSON structure, unique school names

- [ ] T047 [P] Create StudentFactory unit test
  - **File**: `backend/tests/Database/Seeds/Factories/StudentFactoryTest.php`
  - **Tests**: Admission number format, Zimbabwean names, valid class_id reference, balance calculation

- [ ] T048 [P] Create DatabaseSeeder integration test
  - **File**: `backend/tests/Database/Seeds/DatabaseSeederTest.php`
  - **Tests**: Full seed execution, referential integrity, counts match configuration, fresh vs append modes

- [ ] T049 Create comprehensive README for seeders
  - **File**: `backend/app/Database/Seeds/README.md`
  - **Content**: 
    - Architecture overview (Factory, Scenario, Command patterns)
    - How to add new factories
    - How to create custom scenarios
    - CLI usage examples
    - Troubleshooting guide

- [ ] T050 Add progress bar visualization
  - **File**: `backend/app/Database/Seeds/DatabaseSeeder.php`
  - **Feature**: Visual progress bar during seeding for large datasets
  - **Library**: Use CodeIgniter CLI color/formatting utilities

- [ ] T051 Add timing and memory usage reporting
  - **File**: `backend/app/Database/Seeds/DatabaseSeeder.php`
  - **Output**: Show time elapsed and peak memory usage in summary

- [ ] T052 Validate balance calculation consistency
  - **Test**: SQL query to verify all student balances match formula
  - **Formula**: `balance = SUM(charges) + SUM(debit_adjustments) - SUM(payments) - SUM(credit_adjustments)`
  - **Requirement**: 100% of students must have mathematically correct balances

- [ ] T053 Final integration test - full large dataset
  - **Test**: `php spark db:seed:platform --fresh --tenants=5 --classes-per-tenant=10 --students-per-class=20`
  - **Verify**:
    - Completes in <60 seconds
    - 1000 students created
    - No memory exhaustion
    - All referential integrity constraints satisfied
  - **Performance**: Memory usage <256MB

---

## Dependencies Summary

### Task Execution Order

```
Phase 1 (Setup):
  T001 → T002 → T003

Phase 2 (Foundational) - Can run in parallel:
  T004, T005, T006, T007, T008, T009

Phase 3 (US1 - Configurable Generation):
  T010 → T011 → T012, T013, T014, T015, T016, T017 (parallel factories)
  → T018 → T019 → T020 → T021 → T022

Phase 4 (US2 - Realistic Data):
  T023, T024, T025, T026, T027, T028, T029, T030, T031, T032, T033 (parallel enhancements)
  → T034

Phase 5 (US3 - Scenarios):
  T035 → T036 → T037, T038, T039 (parallel scenarios)
  → T040 → T041 → T042, T043, T044 (parallel tests)

Phase 6 (Polish):
  T045, T046, T047, T048 (parallel tests)
  → T049 → T050 → T051 → T052 → T053
```

### Cross-Story Dependencies

| Story | Depends On | Notes |
|-------|------------|-------|
| US2 | US1 + Phase 2 | Factories need base implementation from US1 |
| US3 | US2 | Scenarios need realistic factories to be meaningful |

### Suggested Implementation Order

1. **Week 1**: Phase 1-3 (MVP delivery)
   - Setup infrastructure
   - Implement basic configurable seeder
   - Test: Can generate tenants, users, students, charges, payments

2. **Week 2**: Phase 4 (Realistic data)
   - Enhance factories with Zimbabwean context
   - Add transport and attendance
   - Test: Data looks authentic

3. **Week 3**: Phase 5-6 (Scenarios and polish)
   - Implement scenarios
   - Add tests
   - Performance validation
   - Documentation

---

## Success Criteria Validation

| Criterion | Task(s) | Validation Method |
|-----------|---------|-------------------|
| SC-001: Small dataset <10s | T022, T053 | Time command execution |
| SC-002: Large dataset <60s | T053 | Time command execution |
| SC-003: 100% referential integrity | T052 | SQL foreign key checks |
| SC-004: Balance calculation correct | T052 | SQL balance verification |
| SC-005: Model validation passes | T034, T042-044 | Model->validate() on generated data |

---

## Task Count Summary

| Phase | Tasks | Parallel Groups |
|-------|-------|-----------------|
| Phase 1: Setup | 3 | 1 group |
| Phase 2: Foundational | 6 | 6 parallel |
| Phase 3: US1 (P1) | 13 | 8 parallel factories |
| Phase 4: US2 (P2) | 12 | 8 parallel enhancements |
| Phase 5: US3 (P3) | 10 | 3 parallel scenarios + 3 parallel tests |
| Phase 6: Polish | 9 | 4 parallel tests |
| **Total** | **53 tasks** | **24 parallelizable** |

**Estimated Effort**: 
- MVP (Phase 1-3): ~40 hours
- Full Feature (All Phases): ~80 hours

# Feature Specification: Database Seeder for Platform Testing

**Feature Branch**: `031-database-seeder-testing`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: User description: "Create a database seeder for testing the platform functionality with configurable data generation, factory patterns, multi-tenant support, and edge case scenarios for comprehensive testing coverage."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Configurable Data Generation (Priority: P1)

As a developer or QA engineer, I want to run a database seeder that can generate configurable amounts of realistic test data (tenants, users, students, staff, classes, transactions) so that I can quickly set up test environments with varying data volumes for performance testing and feature validation.

**Why this priority**: This is the core functionality that enables all other testing scenarios. Without configurable data generation, testing different scales and scenarios would require manual database manipulation.

**Independent Test**: Can be tested by running the seeder command with different configuration options (e.g., `--students=100 --tenants=3`) and verifying the correct number of records are created in the database.

**Acceptance Scenarios**:

1. **Given** the seeder is configured with small dataset parameters (1 tenant, 5 classes, 50 students), **When** the seeder runs, **Then** the database contains exactly 1 tenant, 5 classes, and 50 students with valid relationships
2. **Given** the seeder is configured with large dataset parameters (5 tenants, 50 classes, 1000 students), **When** the seeder runs, **Then** all entities are created with correct foreign key relationships and the process completes within 60 seconds
3. **Given** the seeder supports entity configuration, **When** I specify `--skip-transport --skip-attendance`, **Then** the database contains no transport routes or attendance records while other entities are created normally

---

### User Story 2 - Realistic Data Factories (Priority: P2)

As a developer, I want factory classes that generate realistic fake data (names, addresses, phone numbers, school-specific data like admission numbers) so that test data looks authentic and helps identify UI/layout issues that might only appear with real-world data patterns.

**Why this priority**: Realistic data improves testing quality by surfacing issues (like truncated names, formatting problems) that synthetic data might not reveal. It also makes demos and manual testing more convincing.

**Independent Test**: Can be tested by generating a sample of 100 students and verifying that names follow realistic patterns (local names for Zimbabwean context), admission numbers follow the YYYY/NNN format, and phone numbers match local formats.

**Acceptance Scenarios**:

1. **Given** the student factory is invoked, **When** generating 50 students, **Then** all students have realistic Zimbabwean names, valid admission numbers in YYYY/NNN format, and properly formatted guardian contact information
2. **Given** the staff factory is invoked, **When** generating teaching and non-teaching staff, **Then** employee IDs follow the EMPNNNN format, positions match realistic school roles, and teaching staff have appropriate department assignments
3. **Given** the tenant/school factory is invoked, **When** generating multiple schools, **Then** each school has unique realistic names, addresses in Zimbabwean format, and appropriate fee structures based on school type

---

### User Story 3 - Edge Case and Scenario Seeding (Priority: P3)

As a QA engineer, I want predefined scenarios that create specific edge cases (students with outstanding balances, overdue payments, multiple transport route assignments, various bursary statuses, staff on leave) so that I can efficiently test business logic and edge case handling without manually creating complex data states.

**Why this priority**: Edge cases are critical for testing business logic robustness but are time-consuming to set up manually. Predefined scenarios accelerate regression testing and ensure consistent test conditions.

**Independent Test**: Can be tested by running the seeder with a specific scenario flag (e.g., `--scenario=overdue-payments`) and verifying that the resulting data contains the expected edge case conditions (students with overdue charges, appropriate status flags).

**Acceptance Scenarios**:

1. **Given** the "mixed-financial" scenario is selected, **When** the seeder runs, **Then** the database contains students with diverse financial states: fully paid, partially paid, outstanding balances, various bursary percentages, and written-off debts
2. **Given** the "attendance-variations" scenario is selected, **When** the seeder runs, **Then** the database contains staff and students with varied attendance patterns including present, absent, late, on-leave, and half-day statuses
3. **Given** the "class-promotion-chain" scenario is selected, **When** the seeder runs, **Then** classes are created with proper next_class_id relationships forming complete promotion chains from lowest to highest grade

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- **Empty Database**: Seeder must handle completely empty database (no existing tenants) and properly establish foreign key relationships
- **Existing Data Conflicts**: Seeder should provide options to truncate existing data (--fresh) or append to existing data (--append), with clear warnings about potential ID conflicts
- **Partial Seed Failure**: If seeding fails mid-process (e.g., after creating tenants but before students), the seeder should provide rollback capability or resume capability
- **Invalid Configuration**: Seeder must validate configuration parameters (e.g., cannot have students without classes) and provide clear error messages
- **Memory Exhaustion**: Large dataset generation (10,000+ students) must handle memory efficiently through batch processing
- **Duplicate Unique Values**: Factories must handle the case where randomly generated unique values (emails, admission numbers) collide and retry appropriately

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: The seeder MUST support configurable data volumes through command-line parameters (tenant count, users per tenant, classes per tenant, students per class, staff count)
- **FR-002**: The seeder MUST create all related entities with valid foreign key relationships (students linked to classes and tenants, charges linked to students, payments linked to charges)
- **FR-003**: The seeder MUST provide a "fresh" mode that truncates existing data before seeding and an "append" mode that adds to existing data
- **FR-004**: The seeder MUST generate realistic test data using factory classes with locale-appropriate fake data (Zimbabwean context: names, addresses, phone numbers, school naming conventions)
- **FR-005**: The seeder MUST support predefined scenarios for common testing needs (fresh school setup, mixed financial states, attendance patterns, graduation/promotion testing)
- **FR-006**: The seeder MUST validate configuration parameters and prevent impossible combinations (e.g., creating students without classes)
- **FR-007**: The seeder MUST generate unique identifiers for all entities using the platform's existing ID generation patterns (UUID-style for most entities, formatted for admission numbers and employee IDs)
- **FR-008**: The seeder MUST maintain data consistency for calculated fields (student balances reflect charges minus payments and adjustments)
- **FR-009**: The seeder MUST support selective entity seeding through include/exclude flags (--only=students,charges --skip=transport,attendance)
- **FR-010**: The seeder MUST provide progress output during execution for large datasets and summary statistics upon completion

### Key Entities

- **Tenant**: Represents a school/organization. Key attributes: id, settings (JSON with school name, address, fee structure, academic calendar), payment categories. Relationships: parent to all other entities.
- **User**: Represents login accounts for the platform. Key attributes: id, tenant_id, role (super_admin, admin, bursar, teacher), email, password, name, status. Relationships: belongs to tenant.
- **Staff**: Represents school employees. Key attributes: id, tenant_id, first_name, last_name, email, phone, position, department, is_teaching, employment_status, employee_id, hire_date, date_of_birth, next_of_kin information. Relationships: belongs to tenant, may be linked as teacher to classes.
- **Class/GradeLevel**: Represents academic classes and grade levels. Key attributes: id, tenant_id, name, grade_level_id, stream, teacher_id, capacity, next_class_id (for promotion chain), is_final_class. Relationships: belongs to tenant and grade level, has teacher, links to next class in promotion chain.
- **Student**: Represents enrolled students. Key attributes: id, tenant_id, first_name, last_name, admission_number, class_id, date_of_birth, email, address, guardian information (name, phone, email, relationship), enrollment_date, status, bursary_status, bursary_percentage. Relationships: belongs to tenant and class.
- **Charge**: Represents fees levied against students. Key attributes: id, tenant_id, student_id, amount, category, charge_type, status, date_generated, due_date, academic_year, term. Relationships: belongs to tenant and student.
- **Payment**: Represents payments made by students. Key attributes: id, tenant_id, student_id, amount, date, method, category, description. Relationships: belongs to tenant and student.
- **LedgerAdjustment**: Represents manual debit/credit adjustments. Key attributes: id, tenant_id, student_id, amount, adjustment_type (debit/credit), status, reason. Relationships: belongs to tenant and student.
- **TransportRoute**: Represents school transport routes. Key attributes: id, tenant_id, route_name, pickup_points, vehicle, driver_name, monthly_fee. Relationships: belongs to tenant.
- **TransportAssignment**: Links students to transport routes. Key attributes: id, tenant_id, student_id, route_id, status. Relationships: belongs to tenant, student, and route.
- **Attendance Records**: Staff and student attendance tracking. Key attributes: id, tenant_id, person_id, date, status, notes. Relationships: belongs to tenant.
- **Enrollment**: Tracks student enrollment history. Key attributes: id, tenant_id, student_id, class_id, academic_year, status. Relationships: belongs to tenant, student, and class.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Seeder can generate a complete small dataset (1 tenant, 5 classes, 50 students, 100 charges, 50 payments) in under 10 seconds
- **SC-002**: Seeder can generate a large dataset (5 tenants, 50 classes, 1000 students, 5000 charges, 3000 payments) in under 60 seconds without memory exhaustion
- **SC-003**: All generated data maintains 100% referential integrity - no orphaned records or invalid foreign key references
- **SC-004**: Student balance calculations are mathematically correct for 100% of generated students (balance = charges + debits - payments - credits)
- **SC-005**: Generated data passes all existing model validation rules without errors or warnings

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- Seeder is intended for development, testing, and demonstration environments only - not for production use
- The seeder will leverage existing CodeIgniter 4 framework conventions and database configuration
- Existing database migrations define the canonical schema; seeder must stay synchronized with migration changes
- Faker library (or equivalent) will be used for generating realistic fake data
- The seeder respects existing model validation rules and ID generation patterns from the codebase
- Multi-tenant data isolation is maintained - all generated entities are properly scoped to their tenant
- Default generated passwords will use a simple, documented value (e.g., "password123") suitable only for testing

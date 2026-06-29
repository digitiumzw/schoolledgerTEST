# Implementation Plan: Database Seeder for Platform Testing

**Branch**: `031-database-seeder-testing` | **Date**: 2026-04-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/031-database-seeder-testing/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Create a comprehensive, configurable database seeder for the SchoolLedger platform that generates realistic test data for development, testing, and demonstration purposes. The seeder will provide:

1. **Configurable Data Generation**: CLI-driven seeding with volume controls for tenants, users, students, staff, classes, charges, payments, and related entities
2. **Realistic Data Factories**: Zimbabwean-context fake data generation using Faker library with custom providers for local names, addresses, phone numbers, and school-specific data patterns
3. **Predefined Testing Scenarios**: Edge case scenarios including mixed financial states, attendance variations, and class promotion chains
4. **Multi-Tenant Support**: Proper tenant isolation with all generated data correctly scoped to respective tenants

The seeder integrates with CodeIgniter 4's existing seeding infrastructure while extending it with factory patterns and scenario-based configuration.

## Technical Context

**Language/Version**: PHP 8.1+  
**Primary Dependencies**: CodeIgniter 4, FakerPHP (fakerphp/faker), MySQL  
**Storage**: MySQL (existing database schema from migrations)  
**Testing**: PHPUnit (via CodeIgniter 4), existing test infrastructure  
**Target Platform**: Linux server / local development environments  
**Project Type**: CLI tool extending CodeIgniter 4 Seeder framework  
**Performance Goals**: 
- Small dataset (1 tenant, 50 students, 100 charges): <10 seconds
- Large dataset (5 tenants, 1000 students, 5000 charges): <60 seconds
- Memory usage: <256MB even for large datasets (batch processing)  
**Constraints**: 
- Must not exceed existing migration schema constraints
- Must maintain referential integrity across all foreign keys
- Must respect multi-tenant data isolation (tenant_id scoping)
- Passwords must be hashed using existing UserModel patterns
- Must handle unique constraint violations gracefully (emails, admission numbers, employee IDs)  
**Scale/Scope**: 
- Support up to 10,000 students per seeding operation
- Configurable tenant count (1-10 recommended for testing)
- Extensible architecture for future entity types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Multi-Tenant Data Isolation** | PASS | Seeder will generate tenant-scoped data; all entities include proper tenant_id assignment |
| **II. API-First Separation** | N/A | Seeder is a backend CLI tool; no API or frontend concerns |
| **III. JWT Authentication** | N/A | Seeder runs via CLI; authentication not applicable for seeding operation |
| **IV. Immutable Migrations** | PASS | Seeder uses existing migrations; no schema changes required |
| **V. Financial Ledger Integrity** | PASS | Seeder will maintain balance calculation consistency; charges and payments will be generated to match specified scenarios |

**Overall Gate Status**: **PASS** - All applicable principles are satisfied. No violations require justification.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
backend/
├── app/
│   ├── Commands/                    # CLI commands (spark integration)
│   │   └── SeedDatabaseCommand.php  # Main seeder command
│   ├── Database/
│   │   ├── Seeds/                   # Core seeders
│   │   │   ├── DatabaseSeeder.php         # Main orchestrating seeder
│   │   │   ├── Scenarios/           # Scenario-specific seeders
│   │   │   │   ├── MixedFinancialScenario.php
│   │   │   │   ├── AttendanceVariationsScenario.php
│   │   │   │   └── ClassPromotionChainScenario.php
│   │   │   └── Factories/           # Entity factories
│   │   │       ├── TenantFactory.php
│   │   │       ├── UserFactory.php
│   │   │       ├── StaffFactory.php
│   │   │       ├── ClassFactory.php
│   │   │       ├── StudentFactory.php
│   │   │       ├── ChargeFactory.php
│   │   │       ├── PaymentFactory.php
│   │   │       ├── TransportFactory.php
│   │   │       └── AttendanceFactory.php
│   │   └── Migrations/              # Existing (no changes needed)
│   ├── Models/                      # Existing models used by seeders
│   └── Config/
│       └── Seeder.php               # Seeder configuration
└── tests/
    └── Database/
        └── Seeds/                   # Seeder tests
            ├── DatabaseSeederTest.php
            └── Factories/
                └── *FactoryTest.php
```

**Structure Decision**: The project follows the existing CodeIgniter 4 backend structure. The seeder extends the built-in seeding infrastructure with a Commands/ entry point for CLI access, Factory classes for data generation, and Scenario classes for predefined test configurations. This aligns with the existing `CompleteDatabaseSeeder` pattern while adding configurability and factory patterns.

## Complexity Tracking

> **No violations - all Constitution principles satisfied**

**Post-Design Constitution Check (Phase 1)**:

| Principle | Status | Design Compliance |
|-----------|--------|-------------------|
| **I. Multi-Tenant Data Isolation** | PASS | FactoryContext passes tenant_id; all factories generate tenant-scoped data |
| **II. API-First Separation** | N/A | CLI tool, no API concerns |
| **III. JWT Authentication** | N/A | CLI tool, no auth concerns |
| **IV. Immutable Migrations** | PASS | No schema changes; uses existing migrations only |
| **V. Financial Ledger Integrity** | PASS | Charge/Payment factories respect balance calculation formula |

## Phase 1 Completion Summary

### Design Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| Research Document | `research.md` | Complete - All unknowns resolved |
| Data Model | `data-model.md` | Complete - All entities defined |
| CLI Contract | `contracts/cli-schema.md` | Complete - Full command specification |
| Quickstart Guide | `quickstart.md` | Complete - Developer onboarding |
| Agent Context | `.windsurf/rules/specify-rules.md` | Updated with new tech stack |

### Key Design Decisions

1. **Factory Pattern**: Each entity has its own factory class for maintainability
2. **FakerPHP**: Standard fake data library with custom Zimbabwean provider
3. **Batch Processing**: 100-500 records per batch for memory efficiency
4. **Scenario Pattern**: Predefined configurations for common test cases
5. **CLI Integration**: Spark command for consistent CodeIgniter 4 workflow

### Next Step

Run `/speckit.tasks` to generate actionable, dependency-ordered tasks for implementation.

### Artifacts Location

All planning artifacts are in:
```
specs/031-database-seeder-testing/
├── plan.md              # This file
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Developer guide
├── contracts/
│   └── cli-schema.md    # Phase 1: CLI specification
└── checklists/
    └── requirements.md  # Spec quality checklist
```

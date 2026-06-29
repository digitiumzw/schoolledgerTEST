# Feature Specification: Eliminate Legacy Columns

**Feature Branch**: `039-eliminate-legacy-columns`  
**Created**: April 20, 2026  
**Status**: Complete  
**Input**: User description: "Refactor the codebase to eliminate all legacy columns from both the system and the database schema, ensuring that any dependencies on those columns are properly updated or removed."

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

### User Story 1 - Clean Database Schema (Priority: P1)

As a system administrator, I want the database schema to be free of legacy columns so that the system remains maintainable and performant.

**Why this priority**: Legacy columns clutter the schema, increase storage requirements, and can cause confusion for developers. Removing them improves system clarity and reduces technical debt.

**Independent Test**: Run database schema inspection to verify no legacy columns remain in any table.

**Acceptance Scenarios**:

1. **Given** the database contains tables with legacy columns, **When** the migration runs, **Then** all identified legacy columns are removed from the schema
2. **Given** the legacy columns are removed, **When** querying the database, **Then** the application continues to function without errors

---

### User Story 2 - Clean Codebase Dependencies (Priority: P2)

As a developer, I want all code references to legacy columns removed so that the codebase remains clean and maintainable.

**Why this priority**: Code references to non-existent columns cause runtime errors and confusion. Cleaning these up ensures the codebase accurately reflects the database schema.

**Independent Test**: Search the codebase for any references to removed legacy columns and verify none exist.

**Acceptance Scenarios**:

1. **Given** the codebase contains references to legacy columns, **When** the refactoring is complete, **Then** no code references to removed columns remain
2. **Given** a legacy column is removed, **When** the application runs, **Then** no errors occur due to missing column references

---

### User Story 3 - Data Integrity Preservation (Priority: P3)

As a system administrator, I want to ensure that removing legacy columns does not affect existing valid data or system functionality.

**Why this priority**: Data integrity is critical. Legacy column removal must not compromise existing data or active features.

**Independent Test**: Verify all active features work correctly after legacy column removal and no data is lost.

**Acceptance Scenarios**:

1. **Given** legacy columns may have contained data, **When** columns are removed, **Then** any necessary data migration or preservation is handled appropriately
2. **Given** the system has active users, **When** legacy columns are removed, **Then** user workflows continue uninterrupted

---

### Edge Cases

- What happens when a legacy column has foreign key constraints?
- How does system handle rollback if migration fails mid-process?
- What if legacy columns are referenced by third-party integrations or reports?
- How to handle cases where legacy column names conflict with new feature requirements?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST identify all legacy columns in the database schema by analyzing existing migrations and model definitions
- **FR-002**: System MUST create database migrations to safely remove identified legacy columns
- **FR-003**: System MUST update all model definitions to remove references to legacy columns from `allowedFields` and query methods
- **FR-004**: System MUST update all controller methods that reference legacy columns
- **FR-005**: System MUST update API response formatting to exclude legacy column data
- **FR-006**: System MUST verify no frontend code references legacy column data structures
- **FR-007**: System MUST ensure migrations are reversible with proper `down()` methods
- **FR-008**: System MUST validate that no database queries fail due to missing column references after removal

### Key Entities *(include if feature involves data)*

- **Database Tables**: tenants, users, students, staff, classes, payments, charges, settings, and other application tables that may contain legacy columns
- **Migration Files**: PHP migration scripts that define schema changes for removing legacy columns
- **Model Classes**: CodeIgniter models that define allowed fields and database interactions
- **API Controllers**: Backend controllers that format responses and may reference legacy columns

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 100% of identified legacy columns are removed from the database schema
- **SC-002**: Zero runtime errors occur due to missing column references after deployment
- **SC-003**: All database migrations execute successfully in both `up()` and `down()` directions
- **SC-004**: All existing API endpoints continue to return valid responses without legacy column data
- **SC-005**: Frontend application builds and runs without errors related to legacy column references
- **SC-006**: Database query performance is maintained or improved after column removal

## Assumptions

- Legacy columns are defined as database columns that are no longer actively used by the application code but remain in the schema
- Historical data in legacy columns can be safely discarded or has already been migrated to alternative storage
- The system has comprehensive test coverage to verify functionality after column removal
- Database backups are available before running any destructive migrations
- All legacy columns can be identified through code analysis of existing migrations and model definitions
- No third-party integrations depend on the legacy columns being present
- The development team has access to both backend (PHP/CodeIgniter) and frontend (React/TypeScript) codebases

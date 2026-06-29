# Feature Specification: Onboarding Guided Tutorial

**Feature Branch**: `076-onboarding-guided-tutorial`  
**Created**: 2026-05-18  
**Status**: Draft  
**Input**: User description: "After onboarding, guide the user through the recommended setup flow in this order: Add Staff, Add Classes, Optionally add Students, Configure Fee Structure and Billing Settings. Update the onboarding process with the following changes: Remove the step where the user sets the fee structure during onboarding. Allow the user to set their phone number during onboarding. After the onboarding is completed: Show an in-app tutorial/walkthrough explaining each module in the system, what each module contains, and the purpose and functionality of each module. Additionally, every invited user should also receive an in-app tutorial the first time they log in. The tutorial should be role-aware and explain the modules/features relevant to that user's permissions and access level."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete streamlined school onboarding (Priority: P1)

A new school administrator completes the initial onboarding without being asked to configure fee structure during onboarding, can provide a phone number as part of the setup, and is then guided into the recommended post-onboarding setup flow.

**Why this priority**: This is the entry point for every new school and removes friction from initial setup while preserving the correct operational sequence after onboarding.

**Independent Test**: Can be tested by creating a new school account, completing onboarding with a phone number, confirming fee structure is not requested during onboarding, and verifying the next recommended action is Add Staff.

**Acceptance Scenarios**:

1. **Given** a new school administrator is completing onboarding, **When** they reach the onboarding details step, **Then** they can enter a phone number as part of onboarding.
2. **Given** a new school administrator is completing onboarding, **When** they progress through all onboarding steps, **Then** no onboarding step asks them to set fee structure or billing rules.
3. **Given** a new school administrator has completed onboarding, **When** they arrive in the application, **Then** the system presents the recommended setup flow starting with Add Staff.

---

### User Story 2 - Follow recommended setup flow after onboarding (Priority: P1)

After onboarding, the school administrator is guided through setup in the recommended order: Add Staff, Add Classes, optionally Add Students, then Configure Fee Structure and Billing Settings.

**Why this priority**: The recommended order helps schools configure prerequisite data before billing setup and avoids confusion from doing fee work too early.

**Independent Test**: Can be tested by completing onboarding and verifying the post-onboarding guide displays the required steps in order, allows the student step to be skipped, and directs the user to billing setup after the class/student stage.

**Acceptance Scenarios**:

1. **Given** onboarding has just been completed, **When** the post-onboarding setup guide appears, **Then** the steps are ordered as Add Staff, Add Classes, Add Students, Configure Fee Structure and Billing Settings.
2. **Given** the administrator reaches the Add Students step, **When** they choose to skip it, **Then** the guide marks the step as optional/skipped and proceeds to Configure Fee Structure and Billing Settings.
3. **Given** the administrator completes or skips a setup step, **When** they return to the dashboard, **Then** the guide reflects the current progress and next recommended step.

---

### User Story 3 - Learn system modules through an in-app walkthrough (Priority: P2)

After onboarding is completed, the administrator receives an in-app tutorial that explains each module in the system, what the module contains, and the purpose and functionality of the module.

**Why this priority**: Once the school exists, users need orientation across the full system to understand where tasks belong and how modules fit together.

**Independent Test**: Can be tested by completing onboarding and confirming a first-time walkthrough appears, explains all available modules, and can be completed without blocking normal use indefinitely.

**Acceptance Scenarios**:

1. **Given** a school administrator has completed onboarding for the first time, **When** they enter the application, **Then** an in-app walkthrough is offered or shown explaining available system modules.
2. **Given** a tutorial step is shown for a module, **When** the administrator views the step, **Then** it explains the module purpose, what it contains, and the main actions supported by that module.
3. **Given** the administrator finishes or dismisses the walkthrough, **When** they log in again, **Then** the same completed walkthrough is not automatically shown again unless restarted manually.

---

### User Story 4 - Invited users receive role-aware first-login tutorial (Priority: P2)

Every invited user receives an in-app tutorial the first time they log in, tailored to the modules and features relevant to their role, permissions, and access level.

**Why this priority**: Invited users often have narrower responsibilities than administrators, so tutorials must avoid exposing irrelevant or unauthorized features while still helping users understand their workspace.

**Independent Test**: Can be tested by inviting users with different roles, logging in as each user for the first time, and confirming each user sees a tutorial containing only modules/features they can access.

**Acceptance Scenarios**:

1. **Given** an invited user logs in for the first time, **When** their session starts, **Then** the system shows an in-app tutorial tailored to their role and permissions.
2. **Given** an invited user lacks access to a module, **When** their tutorial is generated or displayed, **Then** that module is not included as an available tutorial destination.
3. **Given** an invited user completes or dismisses their first-login tutorial, **When** they log in later, **Then** the tutorial is not automatically shown again unless restarted manually.

---

### Edge Cases

- If a school already has staff, classes, students, or billing settings before the guide is shown, the setup guide should reflect completed steps instead of forcing duplicate setup.
- If the administrator skips Add Students, the guide should still allow students to be added later and should not treat the overall setup as failed.
- If a user has multiple roles or custom permissions, the tutorial should include the union of modules they are allowed to access while excluding unauthorized areas.
- If a role has very limited access, the tutorial should still provide a meaningful orientation for the available pages/actions.
- If the user dismisses a tutorial before completion, the system should remember the dismissal state according to the product's tutorial policy and provide a way to restart it.
- If module availability changes after role or permission updates, future manually restarted tutorials should reflect the current access level.
- If phone number is omitted or invalid during onboarding, the system should clearly indicate whether it is optional or what valid format is required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The onboarding flow MUST remove any step that requires configuring fee structure, billing rules, or billing settings during initial onboarding.
- **FR-002**: The onboarding flow MUST allow the onboarding user to provide a phone number during onboarding.
- **FR-003**: The system MUST validate the onboarding phone number when provided and display clear guidance for invalid values.
- **FR-004**: After onboarding completes, the system MUST present a recommended setup guide in this order: Add Staff, Add Classes, Add Students, Configure Fee Structure and Billing Settings.
- **FR-005**: The Add Students step in the recommended setup guide MUST be optional and skippable.
- **FR-006**: The recommended setup guide MUST track and display progress for each setup step.
- **FR-007**: The recommended setup guide MUST identify the next recommended action based on completed, skipped, or already-existing setup data.
- **FR-008**: The system MUST provide clear navigation from each setup guide step to the relevant module or task area.
- **FR-009**: The system MUST show an in-app tutorial or walkthrough after onboarding completion for the onboarding administrator.
- **FR-010**: The administrator tutorial MUST explain each module available to the administrator, including what the module contains and the purpose/functionality of the module.
- **FR-011**: The system MUST show every invited user an in-app tutorial the first time they log in.
- **FR-012**: Invited user tutorials MUST be role-aware and permission-aware, showing only modules and features relevant to the user's allowed access.
- **FR-013**: Tutorial content MUST not present restricted modules or actions as available to users who lack permission for them.
- **FR-014**: The system MUST remember whether each user has completed or dismissed their first-login tutorial.
- **FR-015**: Users MUST be able to complete, skip, or dismiss the tutorial without permanently blocking access to the application.
- **FR-016**: Users SHOULD be able to restart the tutorial from an appropriate help, guidance, or account area after it has been completed or dismissed.
- **FR-017**: Tutorial state MUST be tracked per user, not only per school, so invited users receive their own first-login guidance.
- **FR-018**: Setup guide state MUST be tracked at the school or tenant level so setup progress is shared consistently for administrators of the same school.
- **FR-019**: The system MUST distinguish the post-onboarding recommended setup guide from the module tutorial so users understand both operational setup tasks and general system orientation.
- **FR-020**: Tutorial and setup guidance MUST use language understandable to non-technical school staff.

### Key Entities *(include if feature involves data)*

- **Onboarding Profile**: Captures school and initial user onboarding details, including the onboarding user's phone number when provided.
- **Setup Guide Step**: Represents a recommended post-onboarding task such as Add Staff, Add Classes, Add Students, or Configure Fee Structure and Billing Settings, including status and ordering.
- **Tutorial Definition**: Represents the explanatory walkthrough content for modules, including module name, purpose, contained features, and supported actions.
- **User Tutorial Progress**: Tracks each user's tutorial status, such as not started, in progress, completed, skipped, or dismissed.
- **Role/Permission Context**: Represents the user's access level used to determine which tutorial content is relevant and visible.
- **Invited User**: A user added by an administrator who should receive first-login role-aware guidance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of new administrators can complete initial onboarding without encountering fee structure or billing configuration prompts.
- **SC-002**: 90% of new administrators can identify the next recommended setup action within 10 seconds after onboarding completion.
- **SC-003**: At least 90% of completed onboarding sessions persist the provided phone number accurately when a valid phone number is entered.
- **SC-004**: 95% of administrators who complete onboarding are shown the setup guide with the required step order.
- **SC-005**: 95% of first-time invited user logins receive a tutorial containing only modules/features available to that user's role and permissions.
- **SC-006**: Users can complete or dismiss the tutorial in under 5 minutes without losing access to normal application navigation.
- **SC-007**: Support questions from new users about where to find core modules decrease after release, measured against the previous comparable onboarding period.
- **SC-008**: In usability testing, at least 80% of first-time users can explain the purpose of their relevant modules after completing the tutorial.

## Assumptions

- Existing roles and permissions are the source of truth for deciding which tutorial content a user may see.
- The onboarding administrator has access to all standard school setup modules unless restricted by the subscription or role configuration.
- Phone number collection is part of onboarding profile data; whether it is mandatory depends on existing product validation rules unless later clarified.
- The tutorial should be in-app and interactive enough to guide users through modules, but it does not need video content for the initial version.
- The recommended setup guide begins after onboarding completion and is separate from the initial onboarding form sequence.
- Existing invitation and login flows remain in place; this feature adds first-login guidance for invited users.

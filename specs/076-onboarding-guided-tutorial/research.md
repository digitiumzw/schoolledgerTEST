# Research: Onboarding Guided Tutorial

**Feature**: 076-onboarding-guided-tutorial  
**Date**: 2026-05-18

## Decision 1: Keep initial onboarding focused and move billing setup to post-onboarding guide

**Decision**: Remove `fee-structure` from the required onboarding wizard steps and make billing configuration the final step in a post-onboarding setup guide.

**Rationale**: Existing onboarding currently requires `fee-structure` in `OnboardingProgressModel::STEPS` and `REQUIRED_STEPS`, and `OnboardingPage.tsx` renders `StepFeeStructure` as the completion step. The feature explicitly asks to remove fee structure from onboarding while still guiding users to billing settings after staff/classes/students are in place. This preserves the user's requested order and prevents early billing configuration before prerequisite records exist.

**Alternatives considered**:

- Keep fee structure in onboarding but mark it optional: rejected because the requirement says remove the step where the user sets fee structure during onboarding.
- Hide fee structure only in the frontend: rejected because backend completion rules would still require it and create inconsistent behavior.

## Decision 2: Store onboarding phone number with the existing profile/contact data path

**Decision**: Add phone number to onboarding progress data and persist it to the existing user/contact settings profile surface, using validation consistent with other onboarding fields.

**Rationale**: Current onboarding already persists admin profile information to the user record and school contact details to tenant settings. Adding phone number through the same onboarding progress and persistence mechanism keeps the change small, auditable, and compatible with resume behavior.

**Alternatives considered**:

- Add a new standalone onboarding phone endpoint: rejected because phone number is a normal onboarding field and does not need a separate workflow.
- Store phone number only in step data: rejected because other parts of the system need a stable profile/contact source after onboarding.

## Decision 3: Model post-onboarding setup as tenant-level progress

**Decision**: Track recommended setup progress per tenant/school, not per onboarding admin, with step statuses for Add Staff, Add Classes, optional Add Students, and Configure Fee Structure and Billing Settings.

**Rationale**: The guide represents school setup state. Multiple administrators in the same school should see consistent progress, and existing data should mark steps complete where staff/classes/students/billing settings already exist.

**Alternatives considered**:

- Track setup guide progress per user: rejected because it could cause one admin to repeat setup already completed by another admin.
- Derive all setup state without persistence: rejected because optional/skipped state for Add Students and dismissed guide state need persistence.

## Decision 4: Model tutorial progress per user

**Decision**: Track tutorial completion/dismissal per user, with tutorial content generated from current role and permission context.

**Rationale**: The spec requires every invited user to receive a tutorial on first login. This must be independent of tenant-level onboarding and must survive future logins. Per-user progress also allows administrators and invited users to complete/dismiss tutorials independently.

**Alternatives considered**:

- Track tutorial completion at tenant level: rejected because invited users would not reliably receive their first-login tutorial.
- Use browser-only storage: rejected because users may switch devices/browsers and first-login guidance should be account-aware.

## Decision 5: Use backend-driven role-aware tutorial definitions with frontend presentation

**Decision**: Backend exposes available tutorial modules/steps filtered by authenticated user's role/permissions; frontend renders the walkthrough and navigation.

**Rationale**: Constitution requires backend role enforcement and prevents frontend-only authorization. The frontend can present a polished walkthrough, but the backend must not return restricted modules as available. This also centralizes tutorial definitions and keeps the content consistent across sessions.

**Alternatives considered**:

- Hard-code all tutorial content only in frontend: rejected because it risks showing restricted features and duplicates permission logic.
- Store fully custom tutorial content for every tenant in v1: rejected as unnecessary scope; static system module definitions filtered by role satisfy the requirement.

## Decision 6: Add REST resources for setup guide and tutorials

**Decision**: Add REST-style endpoints for setup guide state and tutorial progress/content under authenticated `/api` routes, using the standard JSON response envelope.

**Rationale**: The feature requires frontend/backend coordination and persistent state. REST contracts make the frontend flow testable, align with existing API conventions, and support curl validation after implementation.

**Alternatives considered**:

- Piggyback on `/api/onboarding/progress` for post-onboarding guide and tutorials: rejected because onboarding, setup guide, and module tutorial are distinct concepts with different scopes and lifecycles.

## Decision 7: Curl validation after implementation

**Decision**: Validate implemented endpoints via curl only after implementation is complete, covering happy paths, invalid input, unauthorized access, and tenant isolation.

**Rationale**: Constitution Principle X requires endpoint-level curl validation after implementation. This feature introduces tenant-scoped setup state and user-scoped tutorial state, so tenant isolation and role filtering must be validated externally.

**Alternatives considered**:

- Rely only on frontend manual testing: rejected because it would not validate API authorization and response contracts.

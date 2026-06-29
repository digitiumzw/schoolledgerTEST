# Data Model: Onboarding Guided Tutorial

**Feature**: 076-onboarding-guided-tutorial  
**Date**: 2026-05-18

## Existing Entities Updated

### OnboardingProgress

Tracks progress through the initial school admin onboarding wizard.

**Current purpose**: One row per onboarding admin user, with current step, completed steps, and saved step data.

**Required changes**:

- Remove `fee-structure` from initial onboarding step order.
- Remove `fee-structure` from required onboarding completion criteria.
- Keep password, profile, contact, work hours, and academic calendar as onboarding wizard steps unless later changed by implementation tasks.
- Persist phone number as part of onboarding profile/contact data.

**Fields impacted**:

- `current_step`: MUST never point to `fee-structure` for new onboarding flows after this feature.
- `completed_steps`: MUST not require `fee-structure` for onboarding completion.
- `step_data`: SHOULD retain submitted phone number in the relevant step payload for resume UX.

**Validation rules**:

- `step` must be one of the supported onboarding step identifiers.
- Phone number, when provided, must match accepted product phone format and length limits.
- Completion must fail only when required non-fee onboarding steps are missing.

**State transitions**:

```text
not_started -> password/profile/contact/work-hours/academic-calendar -> complete
```

`fee-structure` is no longer part of this transition.

### User

Represents an authenticated school user.

**Required changes**:

- Store onboarding phone number on the user profile if the product uses user-level phone numbers, or mirror it from onboarding data to the established user profile field.
- Tutorial progress is associated with this user.

**Validation rules**:

- User updates must remain tenant-safe and role-safe.
- Phone number must not overwrite unrelated profile data.

### Tenant

Represents the school/tenant.

**Required changes**:

- Tenant settings/contact data may store the onboarding phone number if the product treats it as school contact information.
- Tenant owns recommended setup guide progress.

**Validation rules**:

- All setup guide state reads/writes must be scoped to the JWT-derived tenant.

## New Entities

### SetupGuideProgress

Tenant-scoped record tracking the recommended post-onboarding setup flow.

**Fields**:

- `id`: Unique identifier.
- `tenant_id`: Tenant/school that owns this setup guide state.
- `current_step`: Current recommended setup step.
- `step_statuses`: Structured map/list of step identifiers to status values.
- `dismissed_at`: Optional timestamp when the guide is dismissed.
- `completed_at`: Optional timestamp when all required guide steps are complete.
- `created_at`: Creation timestamp.
- `updated_at`: Last update timestamp.

**Step identifiers**:

- `add-staff`
- `add-classes`
- `add-students`
- `configure-billing`

**Step status values**:

- `pending`: Step has not been completed or skipped.
- `active`: Step is the current recommended action.
- `completed`: Step is complete through user action or existing data detection.
- `skipped`: Step was intentionally skipped; only valid for optional steps.

**Relationships**:

- Belongs to `Tenant`.
- May be derived from Staff, Classes, Students, Fee Structure, and Billing Settings data.

**Validation rules**:

- `tenant_id` is required and must come from authenticated JWT context.
- Only known step identifiers are allowed.
- Only `add-students` may be skipped in v1.
- `current_step` must be one of the known step identifiers or null when complete.
- Completed/skipped steps must advance the next recommended action in the configured order.

**State transitions**:

```text
pending -> active -> completed
pending -> active -> skipped  (add-students only)
completed/skipped -> active next step
all required complete -> guide completed
active/pending/completed -> dismissed
```

**Derived completion checks**:

- `add-staff`: complete when the tenant has at least one relevant staff record or the user explicitly completes the step after navigating.
- `add-classes`: complete when the tenant has at least one class/class instance as defined by existing class setup rules.
- `add-students`: complete when the tenant has at least one student, or skipped when the administrator chooses to skip.
- `configure-billing`: complete when fee structure and billing settings meet existing product readiness rules.

### TutorialDefinition

System-defined module tutorial content used to explain available modules.

**Fields**:

- `module_key`: Stable identifier for the module.
- `module_name`: Display name.
- `summary`: Short purpose statement.
- `contains`: List of notable information, screens, or feature areas included in the module.
- `primary_actions`: List of key actions users can perform in the module.
- `route`: Optional destination path for the module.
- `required_roles`: Roles that may see the module by default.
- `required_permissions`: Optional permission keys required to see the module.
- `order`: Display order in the tutorial.
- `is_active`: Whether the definition is currently available.

**Relationships**:

- Filtered by `RolePermissionContext`.
- Rendered as `TutorialStep` content for `UserTutorialProgress`.

**Validation rules**:

- Module keys must be unique.
- Definitions must not include modules that are not available in the application.
- Restricted modules must declare role/permission requirements.

### UserTutorialProgress

Tracks each user's first-login tutorial state.

**Fields**:

- `id`: Unique identifier.
- `tenant_id`: Tenant context for school-side users.
- `user_id`: User who owns this tutorial progress.
- `status`: Tutorial status.
- `started_at`: Optional timestamp when tutorial first starts.
- `completed_at`: Optional timestamp when tutorial completes.
- `dismissed_at`: Optional timestamp when tutorial is dismissed/skipped.
- `last_seen_step`: Optional module key or step key last viewed.
- `seen_module_keys`: Optional list of module keys viewed by the user.
- `created_at`: Creation timestamp.
- `updated_at`: Last update timestamp.

**Status values**:

- `not_started`
- `in_progress`
- `completed`
- `dismissed`

**Relationships**:

- Belongs to `User`.
- Belongs to `Tenant` for school users.
- Uses filtered `TutorialDefinition` records for display.

**Validation rules**:

- `user_id` is required and must match the authenticated user unless an administrator endpoint is explicitly designed later.
- Progress updates can only reference module keys visible to the authenticated user.
- Completed or dismissed tutorials must not automatically show again on later login.
- Restarting the tutorial should reset status to `in_progress` without exposing unauthorized modules.

**State transitions**:

```text
not_started -> in_progress
not_started -> dismissed
in_progress -> completed
in_progress -> dismissed
completed -> in_progress  (manual restart)
dismissed -> in_progress  (manual restart)
```

### RolePermissionContext

Derived context used to filter tutorial content.

**Fields**:

- `user_id`: Authenticated user identifier.
- `tenant_id`: Authenticated tenant identifier where applicable.
- `role`: User role such as `admin`, `teacher`, `bursar`, or `super_admin`.
- `permissions`: Effective permissions for the user.
- `subscription_features`: Optional available feature set for the tenant.

**Relationships**:

- Derived from authenticated JWT user, user record, role rules, and tenant/subscription constraints.
- Filters `TutorialDefinition` before response.

**Validation rules**:

- Role and tenant values must come from trusted authenticated context.
- Frontend-visible tutorial content must already be filtered by backend authorization.

## Data Integrity Rules

- Setup guide progress is tenant-scoped and must not leak across tenants.
- Tutorial progress is per user and must not be shared across invited users.
- Role-aware tutorial content must be recalculated from current access when tutorial content is fetched or restarted.
- Initial onboarding completion must not require billing/fee structure data.
- Phone number persistence must be idempotent when a user resumes onboarding and resubmits the same step.

## Migration Considerations

- Add a new migration for setup guide progress and user tutorial progress persistence.
- Do not edit existing applied onboarding migrations.
- Existing `onboarding_progress` rows that contain `fee-structure` may remain for history/resume compatibility, but new completion rules must not require it.
- Existing tenants that already completed onboarding should become eligible for setup guide/tutorial state without requiring re-onboarding.

# Data Model: School Creation & Admin Onboarding

**Feature**: `043-school-creation-onboarding`  
**Date**: 2026-04-27

---

## Schema Changes Overview

| Change | Type | Migration File |
|--------|------|----------------|
| Add `pending` to `tenants.status` ENUM | ALTER | `2026-04-27-100000_Add_pending_status_to_tenants.php` |
| Add `is_temp_password`, `onboarding_complete` to `users` | ALTER | `2026-04-27-100001_Add_credential_flags_to_users.php` |
| Create `onboarding_progress` table | CREATE | `2026-04-27-100002_Create_onboarding_progress_table.php` |

---

## Existing Tables: Modified

### `tenants`

**Existing columns relevant to this feature** (no new columns — only ENUM extension):

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) | UUID, PK |
| `name` | VARCHAR(255) | School display name |
| `email` | VARCHAR(255) | Admin email (set at creation) |
| `subdomain` | VARCHAR(100) | Auto-generated from school name |
| `status` | ENUM | **Extended**: `['active','suspended','trialing','pending']` — `'pending'` added by migration |
| `settings` | JSON | School settings blob (schoolName, contactEmail, address, contactPhone, staffWorkHours, studentWorkHours, etc.) |
| `academic_calendar` | JSON | Term structure, schoolOpen flag |
| `fee_structure` | JSON | Default fees and class overrides |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**State transitions for `status`**:
```
[creation] → pending
[onboarding complete] → trialing   (trial subscription auto-enrolled)
[trial expires / upgrades] → active | suspended  (out of scope for this feature)
```

> **Note**: `trialing` is used post-activation because the school immediately enters a 3-month trial. `active` is reserved for paid subscriptions (existing convention per subscription billing overhaul).

---

### `users`

**New columns** (added by `2026-04-27-100001_Add_credential_flags_to_users.php`):

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `is_temp_password` | TINYINT(1) | `0` | Set to `1` when user is provisioned by `SchoolProvisioningService`. Set to `0` on first successful login regardless of password change. |
| `onboarding_complete` | TINYINT(1) | `0` | Set to `1` by `OnboardingController::complete()`. Controls dashboard access guard. |

**Existing columns relevant to this feature**:

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) | UUID, PK |
| `tenant_id` | VARCHAR(50) | FK → `tenants.id` |
| `role` | ENUM | `'admin'` for provisioned school admin |
| `email` | VARCHAR(255) | UNIQUE constraint — enforces duplicate-email prevention at DB level (race-condition safety, FR-004) |
| `password` | VARCHAR(255) | Bcrypt hash of temporary password at creation; updated if admin changes password during onboarding |
| `name` | VARCHAR(255) | Initially empty string; set by admin in Step 1 (admin profile) |
| `status` | ENUM | `'active'` — user is immediately active; tenant `pending` status controls access |

---

## New Table: `onboarding_progress`

**Migration**: `2026-04-27-100002_Create_onboarding_progress_table.php`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| `user_id` | VARCHAR(50) | NOT NULL, UNIQUE, FK → `users.id CASCADE` | One progress record per admin user |
| `tenant_id` | VARCHAR(50) | NOT NULL, FK → `tenants.id CASCADE` | Denormalised for efficient tenant-level queries |
| `current_step` | VARCHAR(50) | NOT NULL, DEFAULT `'password'` | Step identifier for resume: `password`, `profile`, `contact`, `work-hours`, `academic-calendar`, `fee-structure` |
| `completed_steps` | JSON | NOT NULL, DEFAULT `'[]'` | Array of completed step identifiers, e.g. `["password","profile"]` |
| `step_data` | JSON | NULL | Partial data saved mid-wizard (optional cache for resume UX) |
| `created_at` | DATETIME | NULL | |
| `updated_at` | DATETIME | NULL | |

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE KEY (`user_id`) — one row per admin
- KEY (`tenant_id`) — for platform-level queries

**Step identifier values** (ordered):

| Step ID | Description | Required |
|---------|-------------|----------|
| `password` | Optional password change prompt | No |
| `profile` | Admin full name | Yes |
| `contact` | School contact email, physical address | Yes |
| `work-hours` | Staff and student operating hours | Yes |
| `academic-calendar` | Term structure, school open flag | Yes |
| `fee-structure` | Default fees and class overrides | Yes |

---

## Existing Tables: Read-Only (no changes)

### `subscription_plans`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) | PK |
| `name` | VARCHAR(100) | |
| `max_students` | INT UNSIGNED NULL | `NULL` = unlimited students — used to identify the trial plan |
| `monthly_price_cents` | INT UNSIGNED | `0` for free/trial plan |
| `is_active` | TINYINT(1) | Must be `1` for the plan to be selectable |

**Query used at activation**: `SELECT id FROM subscription_plans WHERE max_students IS NULL AND is_active = 1 LIMIT 1`

---

### `school_subscriptions`

A new row is inserted here at onboarding completion by `SchoolProvisioningService::activateTenant()`:

| Field | Value at trial enrollment |
|-------|--------------------------|
| `id` | Generated UUID |
| `tenant_id` | The activated tenant's ID |
| `plan_id` | ID of the unlimited-students plan (from query above) |
| `billing_cycle` | `'monthly'` |
| `status` | `'active'` |
| `starts_at` | `NOW()` |
| `expires_at` | `DATE_ADD(NOW(), INTERVAL 3 MONTH)` |
| `amount_paid_cents` | `0` |
| `currency` | `'USD'` |
| `activated_at` | `NOW()` |

---

## Entity Relationships (this feature)

```
platform_users (1) ──── creates ────> tenants (1) ──── has ────> school_subscriptions (1)
                                          │
                                          └──── has ────> users (1) ──── has ────> onboarding_progress (1)
```

- One `platform_user` (super-admin) provisions one `tenant` + one `users` record per creation.
- One `tenant` gets one `school_subscriptions` record (trial) at activation.
- One `users` (admin) record has one `onboarding_progress` record.

---

## Validation Rules

### School Creation (platform side)

| Field | Rule |
|-------|------|
| `name` | Required, 1–255 chars, strip HTML |
| `email` | Required, valid email format, globally unique across `users.email` |

### Onboarding Steps (school side — each step validated independently)

| Step | Field | Rule |
|------|-------|------|
| `profile` | Admin full name | Required, 2–100 chars |
| `contact` | School contact email | Required, valid email format |
| `contact` | School physical address | Required, 5–500 chars |
| `work-hours` | Staff start/end time | Required, valid time (HH:MM), start < end |
| `work-hours` | Student start/end time | Required, valid time (HH:MM), start < end |
| `academic-calendar` | At least one term | Required, term name non-empty, start date < end date |
| `fee-structure` | At least one fee entry | Required, amount > 0 |

### Password Change (optional step)

| Field | Rule |
|-------|------|
| New password | Min 8 chars (matches existing policy in `Api\AuthController`) |
| Confirm password | Must match new password |

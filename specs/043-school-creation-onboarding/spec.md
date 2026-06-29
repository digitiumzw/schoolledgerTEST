# Feature Specification: School Creation & Admin Onboarding

**Feature Branch**: `043-school-creation-onboarding`  
**Created**: 2026-04-27  
**Status**: Draft  
**Input**: User description: "The feature allows a platform user to create a new school by entering only the school name and an admin's email address. The system then sends an email to the admin with login details, including a temporary password. Upon logging in, the admin is taken through a personalized onboarding flow where key details, such as the school name and email, are pre-filled. The admin then completes the account setup by providing the remaining required information. Once completed, the school is activated, and the admin gains access to the platform dashboard. Additionally, the school is automatically enrolled in a 3-month free trial with an unlimited number of students package."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Platform User Creates a New School (Priority: P1)

A super-admin (the highest-privilege platform role) opens the school creation interface, enters the new school's name and the designated admin's email address, and submits the form. The system validates the inputs, creates the school record, generates a temporary password for the admin account, and dispatches a welcome email containing the admin's login credentials.

**Why this priority**: This is the entry point for all downstream activity. Without school creation, no admin onboarding, activation, or trial enrollment can occur. It is the irreducible MVP slice.

**Independent Test**: Can be fully tested by submitting the creation form and verifying that the school record exists in the system and the admin receives a credential email — no onboarding or dashboard access is required to verify this outcome.

**Acceptance Scenarios**:

1. **Given** a super-admin is authenticated and on the school creation page, **When** they submit a valid school name and a well-formed admin email address, **Then** the system creates a school record in a pending/inactive state, creates an admin account linked to that school, generates a secure temporary password, and sends a welcome email to the provided admin address containing the login credentials.
2. **Given** a super-admin submits the creation form, **When** the provided admin email already exists in the system as an active admin of another school, **Then** the system rejects the submission and displays a clear error message without creating any records.
3. **Given** a super-admin submits the form, **When** either the school name is blank or the email address is invalid, **Then** the system displays inline validation errors and does not proceed with school creation.
4. **Given** a super-admin successfully creates a school record, **When** the system attempts to send the welcome email and the email service is unavailable, **Then** the school record is still persisted and the system retries email delivery or surfaces an alert to the platform user.

---

### User Story 2 - Admin Receives Credentials and Logs In (Priority: P2)

The newly designated admin receives a welcome email with their school name, login email, and temporary password. They open the login page, enter the provided credentials, and are authenticated into the platform.

**Why this priority**: This story enables the admin to enter the system and begin onboarding. Without successful credential delivery and login, the onboarding flow cannot start. It is the bridge between school creation and admin activation.

**Independent Test**: Can be fully tested by using the credentials from the welcome email to log in and verifying the admin is authenticated — the onboarding flow details are not required to confirm login works.

**Acceptance Scenarios**:

1. **Given** an admin has received a welcome email with temporary credentials, **When** they enter those credentials on the login page, **Then** the system authenticates them and redirects them to the onboarding flow.
2. **Given** an admin attempts to log in with the temporary password, **When** the credentials are incorrect, **Then** the system displays a clear authentication failure message without revealing whether the email or password is wrong.
3. **Given** an admin has already completed their first login, **When** they attempt to use the original temporary password again, **Then** the system rejects authentication because the temporary password has been invalidated.

---

### User Story 3 - Admin Completes Personalized Onboarding Setup (Priority: P3)

After logging in for the first time, the admin is directed through a structured, multi-step onboarding flow. Key details such as the school name and admin email are pre-populated. The admin reviews and confirms pre-filled data, then provides the remaining required information to complete the school profile.

**Why this priority**: Onboarding collects the data needed to fully activate the school. Pre-filling reduces friction and improves completion rates. It is essential but depends on P1 and P2 being in place.

**Independent Test**: Can be fully tested by navigating the onboarding steps as a newly created admin, verifying pre-filled fields are accurate, submitting all required information, and confirming the school status transitions to active.

**Acceptance Scenarios**:

1. **Given** an admin has just logged in for the first time, **When** they are redirected to the onboarding flow, **Then** they are first shown an optional prompt to set a new permanent password before any profile fields are presented.
2. **Given** an admin is shown the optional password change prompt, **When** they choose to skip it, **Then** the system proceeds to the next onboarding step without requiring a password change, and the admin can change their password later via account settings.
3. **Given** an admin is on the onboarding flow, **When** they attempt to proceed past a step without completing all required fields, **Then** the system highlights the missing fields and prevents navigation to the next step.
4. **Given** an admin completes all onboarding steps and submits, **When** all required information is valid, **Then** the system activates the school, enrolls it in the 3-month free trial with an unlimited-students package, and redirects the admin to the platform dashboard.
5. **Given** an admin has partially completed onboarding and closes the browser, **When** they log back in before completing onboarding, **Then** the system resumes the onboarding flow from where they left off rather than restarting from the beginning.

---

### User Story 4 - School Activated with Free Trial Enrollment (Priority: P4)

Upon successful onboarding completion, the system automatically transitions the school to an active state and applies a 3-month free trial subscription with an unlimited number of students package, without requiring the admin to select or confirm a plan.

**Why this priority**: Trial enrollment is automatic and invisible to the admin — it is a system-side action triggered by onboarding completion. It can be verified independently of UI flows.

**Independent Test**: Can be fully tested by completing onboarding and then inspecting the school's subscription record to confirm active status, correct trial plan (unlimited students), and a trial end date set to 3 months from activation.

**Acceptance Scenarios**:

1. **Given** an admin has completed all onboarding steps, **When** the system processes the final submission, **Then** the school status is set to active, a subscription record is created with the unlimited-students package, and the trial expiry date is set to exactly 3 months from the activation date.
2. **Given** the school is enrolled in the free trial, **When** the admin views the dashboard, **Then** they can see trial status information including the trial end date and the current package (unlimited students).
3. **Given** the school is in the active trial state, **When** the trial period expires without upgrade, **Then** the system transitions the school to an expired/restricted state (behavior at trial end is out of scope for this feature but must not break activation).

---

### Edge Cases

- What happens when the same admin email is submitted for two schools simultaneously (race condition)? → The data store enforces a unique constraint on admin email; the first request succeeds and the second receives an error with no partial records created.
- How does the system handle a school name that duplicates an existing school name?
- What happens if the admin dismisses or never completes the onboarding flow — does the school remain in a permanently pending state?
- How does the system behave if the admin attempts to access the dashboard directly via URL before completing onboarding?
- What happens if the welcome email is delivered but the admin never logs in — the temporary password does not expire on its own; a platform user must manually trigger a resend if needed.
- How does the system handle an invalid (deliverable-format but non-existent) email address for the admin?
- What happens to the trial start date if onboarding is completed significantly later than school creation?

## Requirements *(mandatory)*

### Functional Requirements

#### School Creation (Platform User)

- **FR-001**: The system MUST allow only an authenticated super-admin to create a new school by providing only a school name and an admin email address. All other roles MUST be denied access to the school creation function.
- **FR-002**: The system MUST validate that the school name is non-empty and does not exceed a reasonable character limit.
- **FR-003**: The system MUST validate that the admin email address is correctly formatted before accepting a school creation submission.
- **FR-004**: The system MUST reject school creation if the provided admin email is already registered as an active admin user for any school on the platform. Admin email uniqueness MUST be enforced at the data store level (unique constraint) so that concurrent duplicate submissions result in exactly one successful creation and one clear error response, with no partial records created.
- **FR-005**: The system MUST create the school record in a pending (inactive) state immediately upon successful creation.
- **FR-006**: The system MUST generate a secure temporary password for the newly created admin account at the time of school creation.
- **FR-007**: The system MUST send a welcome email to the admin's email address containing: the school name, the admin's login email, and the temporary password.
- **FR-008**: The system MUST persist the school record even if the welcome email delivery fails, and MUST provide a mechanism to retry or resend the welcome email.

#### Admin Authentication

- **FR-009**: The system MUST allow the admin to authenticate using the email and temporary password provided in the welcome email.
- **FR-010**: The temporary password does NOT expire based on time; it remains valid until the admin logs in for the first time. Upon first successful login, the system MUST invalidate the temporary password.
- **FR-011**: The system MUST provide the admin with a way to request a new temporary password if they lose access to the original welcome email (e.g., via a resend-credentials action triggered by a platform user).
- **FR-012**: The system MUST NOT disclose whether an authentication failure is due to an incorrect email or an incorrect password.
- **FR-013**: Upon first successful login, the system MUST redirect the admin to the onboarding flow rather than the main dashboard.
- **FR-013a**: At the start of the onboarding flow, the system MUST prompt the admin to set a new permanent password. This step is optional — the admin may choose to skip it and change their password later via account settings. The temporary password is considered invalidated upon first login regardless of whether the admin sets a new password during onboarding.

#### Admin Onboarding Flow

- **FR-014**: The system MUST present the admin with a structured onboarding flow upon first login, guiding them through completing the school profile.
- **FR-015**: The onboarding flow MUST pre-populate the school name and admin email fields with the values captured during school creation; these fields MUST be clearly indicated as pre-filled and not editable during onboarding.
- **FR-016**: The system MUST require the admin to provide all remaining mandatory school profile information before onboarding can be completed. The mandatory fields are: admin full name, school contact email address, school physical address, school work hours (operating hours), academic calendar information (e.g., term/semester structure and start dates), and fee structure details.
- **FR-017**: The system MUST prevent the admin from progressing to the next onboarding step while required fields on the current step are incomplete.
- **FR-018**: The system MUST save onboarding progress incrementally so that a returning admin resumes from their last completed step.
- **FR-019**: The system MUST block the admin from accessing the platform dashboard via direct URL navigation until onboarding is complete, redirecting them back to the onboarding flow.

#### School Activation & Trial Enrollment

- **FR-020**: Upon successful completion of onboarding, the system MUST transition the school status from pending to active.
- **FR-021**: The system MUST automatically enroll the newly activated school in a 3-month free trial subscription without requiring any action from the admin.
- **FR-022**: The trial subscription MUST apply the unlimited-students package for the full duration of the trial.
- **FR-023**: The trial expiry date MUST be calculated as exactly 3 calendar months from the date of school activation.
- **FR-024**: The system MUST display the admin's current trial status, package name, and trial end date on the dashboard after onboarding is complete.
- **FR-025**: Upon completing onboarding, the system MUST redirect the admin to the platform dashboard.

### Key Entities

- **School**: Represents an educational institution on the platform. Key attributes include name, status (pending/active/expired), creation date, activation date, contact email, physical address, work hours, and fee structure. A school belongs to exactly one tenant context and has one designated admin.
- **Admin User**: A user account with administrative privileges scoped to a single school. Holds the admin email, admin full name, credential state (temporary/permanent), and onboarding completion status.
- **Temporary Credential**: A use-limited (not time-limited) authentication credential issued to an admin at school creation. Tracks the generated password hash, issue timestamp, and a used/invalidated flag. The credential is invalidated on first successful login, not on a time basis. The admin is prompted (but not required) to set a new permanent password during onboarding.
- **Onboarding Progress**: Tracks which steps of the onboarding flow an admin has completed, enabling resume-on-return behaviour. Steps map to the mandatory field groups: (0) optional password change prompt, (1) admin profile, (2) school contact details, (3) work hours, (4) academic calendar, (5) fee structure.
- **Subscription / Trial**: Represents the school's billing plan. Attributes include plan type (unlimited students), trial start date, trial end date, and status (trial/active/expired). Created automatically at school activation.
- **Welcome Email**: A transactional notification sent to the admin at school creation containing school name, admin email, and temporary password.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A platform user can complete the school creation form (school name + admin email) and have the welcome email delivered to the admin within 60 seconds of form submission under normal conditions.
- **SC-002**: 95% of welcome emails are successfully delivered within 2 minutes of school creation under normal system load.
- **SC-003**: An admin receiving a welcome email can log in and reach the onboarding flow within 3 steps and under 2 minutes of starting the login process.
- **SC-004**: 85% or more of admins who log in for the first time complete the onboarding flow in a single session without abandoning.
- **SC-005**: 100% of schools that complete onboarding are automatically enrolled in the 3-month unlimited-students free trial with no manual intervention required.
- **SC-006**: The trial end date for every activated school is within a tolerance of ±1 day of exactly 3 calendar months from the activation timestamp.
- **SC-007**: Admins who partially complete onboarding and return can resume from their last saved step without re-entering previously provided data in 100% of cases.
- **SC-008**: No admin is able to access the dashboard before completing onboarding — 0% bypass rate via direct URL navigation.

## Clarifications

### Session 2026-04-27

- Q: Which fields must the admin provide during onboarding (beyond the pre-filled school name and email)? → A: Admin full name, school contact email, school physical address, work hours, academic calendar information, and fee structure.
- Q: How long should the temporary password remain valid before it expires? → A: No time-based expiry — the temporary password is invalidated only upon first successful login.
- Q: Which platform user roles are permitted to create a new school? → A: Super-admin only.
- Q: How should the system handle two simultaneous school creation requests using the same admin email (race condition)? → A: First-writer-wins via data store unique constraint; second request receives an error with no partial records created.
- Q: After the admin logs in with the temporary password, when must they set a new permanent password? → A: Prompted but optional during onboarding — admin may skip and change password later via account settings.

## Assumptions

- The platform already has a super-admin role capable of initiating school creation; this feature does not introduce a new authentication mechanism for platform users.
- The existing authentication system (email + password login) is reused for admin login; no SSO or OAuth is required for this feature.
- School names are not required to be globally unique on the platform (two schools may share the same name); uniqueness is enforced by school ID, not name.
- The 3-month duration is measured in calendar months (e.g., activation on April 27 → trial expires July 27), not as a fixed number of days.
- The unlimited-students package is a defined subscription tier already present in the billing model; this feature does not create a new tier.
- Email delivery relies on a platform-level transactional email service that is already integrated; this feature consumes that service rather than building one.
- Mobile responsiveness for the onboarding flow is in scope; a native mobile app is out of scope.
- Password complexity requirements for the generated temporary password follow the platform's existing password policy.
- Behaviour after the 3-month trial expires (e.g., downgrade, lockout, upgrade prompts) is out of scope for this feature.

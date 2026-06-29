# Feature Specification: Fix Frontend Bugs and UI Inconsistencies

**Feature Branch**: `022-fix-frontend-bugs-ui`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "i want you to hunt for bugs in the frontnd components and fix them. and also fix the ui incosistencies in the sytem"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable Error Feedback on Failed Operations (Priority: P1)

As a school administrator or teacher, when a page or action fails to load data, I want to see a clear, actionable error message rather than a blank screen or silent failure.

**Why this priority**: Silent failures cause users to believe data is missing when it is actually a network or server error. This leads to incorrect decisions (e.g., assuming a student has no payments). This is the most damaging class of defect in a financial system.

**Independent Test**: Open the Student Profile page while the server is offline. The user should see an error message with an option to retry, instead of a perpetually spinning loader.

**Acceptance Scenarios**:

1. **Given** the student profile page is loading, **When** the API request fails, **Then** the user sees an error notice with a retry option rather than an infinite loading spinner.
2. **Given** a teacher dashboard is open, **When** the class data or analytics request fails, **Then** the user sees a specific error message and the page does not silently fall back to empty data.
3. **Given** the payments page loads multiple data sources, **When** any one source fails, **Then** the user is told which data could not be loaded (e.g., "Payment categories unavailable") rather than a generic failure message.
4. **Given** any data fetch fails, **When** the user clicks Retry, **Then** the system reattempts the fetch without requiring a full page reload.

---

### User Story 2 - Data Safety: No Crashes from Missing or Null Data (Priority: P1)

As any system user, when I open pages or modals that display student or staff data, the application must not crash or freeze when optional data fields are absent.

**Why this priority**: Null reference crashes are invisible to users (blank or frozen screens) but prevent core workflows. A payment modal crashing because a student's enrollment is missing blocks bursar operations entirely.

**Independent Test**: Open the Record Payment modal for a student who has no current class enrollment. The modal should open normally and allow payment recording.

**Acceptance Scenarios**:

1. **Given** a student has no active class enrollment, **When** a bursar opens the Record Payment modal, **Then** the modal opens successfully and the class field is blank rather than crashing.
2. **Given** a student record has no secondary guardian on file, **When** the Student Form modal is opened for that student, **Then** the form loads without errors and the secondary guardian field is empty.
3. **Given** a staff member's hire date is missing, **When** the Staff Form modal opens, **Then** the form still loads and the date field appears blank.

---

### User Story 3 - Consistent and Predictable UI Appearance (Priority: P2)

As any system user, the interface should look and behave consistently across all pages so I can learn it once and apply that knowledge everywhere.

**Why this priority**: Inconsistent UI increases cognitive load and slows down daily tasks. Admins and bursars spend hours per day in this system — visual noise from inconsistent buttons, modals, and spacing degrades efficiency over time.

**Independent Test**: Compare the "Add Student", "Add Staff", and "Add Route" buttons on their respective pages. They should be visually identical in size, color, and position.

**Acceptance Scenarios**:

1. **Given** I am on any list page (Students, Staff, Classes, Transport), **When** I look at the primary action button, **Then** it uses the same visual style (color, size, weight) on every page.
2. **Given** I open any confirmation modal, **When** I compare it to other confirmation modals, **Then** the dialog width, button placement, and spacing follow the same pattern.
3. **Given** I navigate between different pages, **When** I observe section headings, **Then** they follow a consistent hierarchy (page title, section title, subsection title) with the same typography on every page.
4. **Given** I view a student's financial balance anywhere in the system, **When** I see positive and negative amounts, **Then** the color coding (e.g., green for credit, red for overdue) is the same on every screen.

---

### User Story 4 - Accurate Form Validation Before Submission (Priority: P2)

As a data entry user (admin, bursar, teacher), when I fill in a form incorrectly, I want to be told immediately with a clear message rather than having my submission silently fail or accept bad data.

**Why this priority**: Bad data in a school financial system (wrong phone numbers, invalid dates, future hire dates) creates downstream errors in reporting and communication.

**Independent Test**: Enter a hire date in the future on the Staff Form modal and attempt to save. The system should reject the entry with a clear message before sending anything to the server.

**Acceptance Scenarios**:

1. **Given** I enter a phone number in an unsupported format (e.g., with spaces or dashes), **When** I attempt to submit the form, **Then** the system normalizes or accepts common formats rather than rejecting valid numbers.
2. **Given** I enter a hire date that is in the future, **When** I attempt to submit, **Then** the form shows a validation error before submission.
3. **Given** I enter a date of birth that would make a staff member younger than 16 years old, **When** I attempt to submit, **Then** the system flags the implausible date for confirmation.

---

### Edge Cases

- What happens when a student's balance data is temporarily unavailable — does the payment modal still open?
- How does the system handle a page load when multiple API calls complete at different times — does partial data display correctly without crashing?
- What if a user navigates away from a page mid-load — does the abandoned fetch cause console errors?
- How does the system behave on very small screens where table and modal layouts may overlap?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a visible error state with a retry action whenever a data fetch fails on any page.
- **FR-002**: System MUST NOT crash or freeze when optional student or staff data fields (enrollment, guardian, hire date) are absent.
- **FR-003**: System MUST show which specific data source failed when multiple parallel API calls are made on a single page (e.g., Payments page).
- **FR-004**: All primary action buttons across list pages MUST use the same visual variant, size, and placement pattern.
- **FR-005**: All modal dialogs MUST follow a consistent width, padding, and footer button layout.
- **FR-006**: All pages MUST follow a consistent heading hierarchy (page title → section → subsection).
- **FR-007**: Financial balance indicators (positive, negative, zero) MUST use consistent color coding across all views.
- **FR-008**: Phone number validation MUST accept common formats (with dashes, spaces, parentheses) by normalizing before validation.
- **FR-009**: Date fields in staff and student forms MUST validate that hire dates are not in the future and dates of birth represent plausible ages.
- **FR-010**: Loading states MUST be displayed during all data fetches, including per-tab loads within multi-tab pages.

### Key Entities

- **Page**: A top-level routed view (e.g., Students, Payments, Dashboard) — all 20 pages are in scope.
- **Modal**: A dialog component overlaid on a page for add/edit/delete/confirm actions — 57 modals in scope.
- **Error State**: A UI element displayed when a fetch or operation fails, offering context and a retry path.
- **Loading State**: A UI element (skeleton, spinner) displayed while data is being fetched.
- **Form Field**: A user input within a modal or page form, subject to client-side validation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero pages in the system display a blank screen or infinite spinner when an API call fails — every failure shows a human-readable error message.
- **SC-002**: Zero runtime crashes occur when opening any modal for records that have missing optional fields (enrollment, guardian, hire date).
- **SC-003**: All 20 pages use identical styling for primary action buttons (variant, size, icon alignment).
- **SC-004**: All modal dialogs use a consistent maximum width and internal spacing pattern, with no more than one width standard across the system.
- **SC-005**: Financial balance colors are consistent in 100% of views where balance is displayed.
- **SC-006**: Phone number validation accepts inputs with spaces, dashes, and parentheses in addition to plain digits.
- **SC-007**: All form date fields reject clearly invalid values (future hire dates, implausible ages) before submission.

## Assumptions

- All bug fixes are limited to the frontend (`frontend/src/`); backend API behavior is assumed correct.
- The shadcn/ui component library and Tailwind CSS are the established design system — fixes will align to those, not introduce new design systems.
- Dark mode inconsistencies are acknowledged but lower priority; fixes will address light-mode consistency first.
- The currency display bug (`BalanceDisplay.tsx` hardcoding 'USD') is in scope as a UI bug but requires no backend changes.
- Mobile responsiveness fixes are included where the existing breakpoint patterns (`sm:`, `md:`) are already partially applied — new breakpoints will not be introduced.
- No new features will be added during this fix cycle; scope is strictly bug fixes and visual consistency.

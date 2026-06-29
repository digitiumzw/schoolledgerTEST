# Feature Specification: Kiosk Responsive Redesign

**Feature Branch**: `019-kiosk-responsive-redesign`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "Redesign the kiosk pages to make them fully responsive and user-friendly. Use large, easy-to-tap buttons suitable for kiosk or touch-screen use. Ensure the design follows and uses the existing system styling consistently."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Staff Member Signs In/Out at Staff Attendance Kiosk (Priority: P1)

A staff member walks up to the attendance kiosk (typically a wall-mounted tablet or touchscreen), types their Employee ID, and confirms their check-in or check-out. On the current design, the input and button are workable on desktop but the confirmation "Done" button is undersized for reliable one-tap dismissal on a touchscreen, and the layout does not adapt well to landscape tablet views used in kiosks.

**Why this priority**: Staff sign-in/out is the highest-frequency kiosk interaction. Every staff member uses it daily. Missed taps or layout issues at this step block the entire attendance workflow.

**Independent Test**: Can be tested end-to-end with: navigate to the staff kiosk URL → enter a valid Employee ID → verify the confirmation screen displays with a clearly tappable "Done" button → confirm auto-reset returns to idle.

**Acceptance Scenarios**:

1. **Given** the kiosk is displayed on a 10-inch portrait touchscreen, **When** a staff member taps the Employee ID input and types their ID, **Then** the input field is large enough to tap without precision and the keyboard does not obscure the Submit button.
2. **Given** the confirmation screen is shown after a successful sign-in, **When** the staff member taps "Done", **Then** the button is large enough to hit reliably with a single finger tap (minimum 48×48px touch target) and returns to the idle screen.
3. **Given** the kiosk is on a landscape 1280×800 display, **When** any kiosk screen is shown, **Then** the layout fills the viewport proportionally without horizontal scrollbars or collapsed content.

---

### User Story 2 — Teacher Marks Student Attendance on Student Kiosk (Priority: P2)

A teacher enters their Employee ID, selects their class from a list, and marks each student's attendance status (Present / Absent / Late / Excused). The current attendance marking step has critically small status buttons (`text-xs px-3 py-1.5`) that are impossible to tap accurately on a touchscreen, leading to repeated mis-taps and incorrect records.

**Why this priority**: The student attendance kiosk has the most complex interaction flow with the highest risk of touch usability failure — specifically the per-student status button row, which is tiny in the current design.

**Independent Test**: Can be tested by: navigate to student kiosk URL → enter a valid teacher ID → select a class → verify each student row's status buttons are large enough to tap without adjacent-button activation → submit and confirm the success screen.

**Acceptance Scenarios**:

1. **Given** the student list is displayed, **When** a teacher views a student row, **Then** each attendance status button (Present, Absent, Late, Excused) has a visible touch target of at least 44×44px and the active/selected state is clearly distinguishable at a glance.
2. **Given** a class has 30 students, **When** the teacher scrolls through the list, **Then** each student row is tall enough for comfortable touch interaction and student names are readable from arm's length (font size at least 16px equivalent).
3. **Given** the teacher is on the class selection screen, **When** they tap a class card, **Then** the entire card area is a tap target (not just the text) and provides visual feedback on press.
4. **Given** any step in the multi-step flow, **When** the teacher needs to go back, **Then** the Back navigation control is a prominently sized, clearly labeled button — not a small text link or icon-only button.

---

### User Story 3 — Driver Views Route Roster on Driver Kiosk (Priority: P3)

A driver enters their Employee ID, sees their assigned routes, selects one, and views the student roster. The current route cards are reasonably sized but the roster row height is minimal (`py-3`), the Back button is an icon-only 40×40px circle, and the layout is constrained to `max-w-md` regardless of screen width.

**Why this priority**: Route and roster viewing is read-heavy with fewer complex interactions than attendance marking. It is lower risk but still benefits from consistent, touch-friendly sizing and layout.

**Independent Test**: Can be tested by: navigate to driver kiosk URL → enter a valid driver ID → verify route cards are tall enough to tap easily → select a route → verify roster rows are comfortable to scan → verify the Back button is clearly tappable.

**Acceptance Scenarios**:

1. **Given** the routes list is displayed, **When** the driver views route cards, **Then** each card is at least 64px tall and the entire card area is a tap target.
2. **Given** the roster view is displayed, **When** the driver looks at student entries, **Then** each row is at least 52px tall and student names are clearly readable.
3. **Given** any screen in the driver kiosk, **When** the driver needs to navigate back, **Then** the Back button has both an icon and a text label and a tap target of at least 44×44px.

---

### Edge Cases

- What happens when the screen is very narrow (portrait phone, < 375px)? Buttons and status options must stack or wrap without overflowing or becoming invisible.
- What happens when a class has 50+ students? The scrollable list must remain responsive and sticky header/footer bars must not obscure content.
- How does the system handle a long school name that wraps on the idle screen? Text should wrap gracefully without pushing the ID entry form off-screen.
- What happens if a student's name is very long? The row must not collapse the status buttons off-screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All interactive elements across all three kiosk pages (Staff, Student, Driver) MUST have a minimum tap target size of 44×44px (per WCAG 2.5.5 guideline).
- **FR-002**: All primary action buttons (Submit, Continue, Done, Select Class, Select Route) MUST have a minimum height of 56px.
- **FR-003**: Attendance status buttons in the Student Kiosk per-student row (Present, Absent, Late, Excused) MUST be visually distinct, clearly labeled, and each have a minimum height of 44px and minimum width of 56px.
- **FR-004**: Back/navigation controls MUST be labeled with both an icon and visible text — not icon-only.
- **FR-005**: All kiosk pages MUST render correctly on viewport widths from 375px to 1920px without horizontal overflow or collapsed content.
- **FR-006**: All kiosk pages MUST render correctly in both portrait and landscape orientations on tablet-sized screens (768px–1280px wide).
- **FR-007**: The system MUST use the existing design system color palette and component conventions (gradient backgrounds, rounded-xl cards, shadcn/ui-consistent patterns) rather than introducing new visual styles.
- **FR-008**: Body text and labels on kiosk screens MUST be at minimum 16px equivalent, and heading text at minimum 20px equivalent, to ensure legibility from arm's length.
- **FR-009**: Error messages and status badges MUST be clearly visible and legible at all supported screen sizes.
- **FR-010**: The sticky header and footer bars on the Student Kiosk attendance screen MUST remain correctly positioned and not overlap content on any supported viewport size.

### Key Entities

- **Kiosk Screen**: A full-viewport page rendered for a specific kiosk type (Staff, Student, Driver), composed of a sequence of views (idle, selection, action, confirmation).
- **Touch Target**: The tappable/clickable area of an interactive element; must meet minimum size requirements independently of the visual label size.
- **Status Button**: One of four per-student attendance options (Present, Absent, Late, Excused) in the Student Kiosk attendance view.
- **Kiosk Card**: A selectable list item (class or route) presented as a full-width card with a tap target covering the entire card surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All interactive elements on kiosk pages have a measurable touch target of at least 44×44px — verifiable via browser developer tools on the rendered DOM.
- **SC-002**: A user can complete a full staff check-in flow (enter ID → confirmation → return to idle) in under 20 seconds on a touchscreen without mis-taps.
- **SC-003**: A teacher can mark attendance for a 30-student class (select class → mark all students → submit) with zero layout-related errors (mis-taps due to undersized buttons) in a single session.
- **SC-004**: All kiosk pages pass a visual review at 375px, 768px, 1024px, and 1280px viewport widths with no horizontal scroll, no content overflow, and no overlapping elements.
- **SC-005**: The visual design of all redesigned kiosk screens is consistent with the existing system styling — same color palette, corner radii, spacing scale, and typography — confirmed by visual comparison with the existing admin pages.

## Assumptions

- The redesign applies to the three existing kiosk page flows: Staff Attendance Kiosk (`KioskPage`), Student Attendance Kiosk (`StudentKioskPage`), and Driver Kiosk (`DriverKioskPage`), including all their sub-components.
- The backend APIs and data models are unchanged — this is a pure front-end layout and styling change.
- The existing Tailwind CSS utility classes and shadcn/ui component primitives are the tools available for the redesign; no new CSS libraries are introduced.
- Kiosk devices in the school environment are primarily tablets (10–13 inch) or wall-mounted touchscreens, used in both portrait and landscape orientation.
- Physical keyboard or barcode scanner input for Employee IDs remains supported — the redesign does not remove or replace these input methods.
- An on-screen virtual keyboard may appear on some kiosk devices; the layout must accommodate this without hiding the primary action button.
- Auto-reset timers (10-second countdown on confirmation screens, 2-minute idle timeout on Driver Kiosk) are preserved as-is.

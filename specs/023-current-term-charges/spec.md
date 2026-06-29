# Feature Specification: Current Term Charge Generation with Academic Calendar Validation

**Feature Branch**: `023-current-term-charges`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "Generate charges only for the current term with academic calendar validation, term sequence validation, and new year detection"

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

### User Story 1 - Generate Charges for Current Term Only (Priority: P1)

As a school administrator, I want to generate student charges only for the current academic term so that billing remains accurate and aligned with the active school calendar.

**Why this priority**: This is the core functionality that prevents billing errors and ensures financial records match the current academic period. Without this restriction, users could accidentally generate charges for wrong terms, causing reconciliation issues.

**Independent Test**: Can be tested by attempting to generate charges - the system automatically determines current term from today's date and only allows charge generation for that term.

**Acceptance Scenarios**:

1. **Given** today's date falls within Term 1 date range, **When** a user attempts to generate charges, **Then** the system automatically identifies Term 1 as current and blocks attempts to generate charges for Term 2 or Term 3
2. **Given** today's date falls within Term 2 date range, **When** a user attempts to generate charges for Term 1 or Term 3, **Then** the system displays an error message preventing the action

---

### User Story 2 - Validate Academic Calendar Completeness (Priority: P2)

As a school administrator, I want the system to verify that the academic calendar is fully configured before allowing charge generation so that charges are not created with incomplete or incorrect date information.

**Why this priority**: Prevents billing errors that would occur if charges are generated while term dates, holidays, or other calendar details are missing or incomplete.

**Independent Test**: Can be tested by attempting to generate charges with incomplete calendar data - the system should block the action and prompt for calendar completion.

**Acceptance Scenarios**:

1. **Given** the academic calendar has missing term dates or incomplete configuration, **When** a user attempts to generate charges, **Then** the system displays a blocking message requiring calendar completion first
2. **Given** the academic calendar is fully configured with all term dates and holidays, **When** a user attempts to generate charges, **Then** the system proceeds with charge generation

---

### User Story 3 - New Year Detection and Calendar Update Prompt (Priority: P2)

As a school administrator, I want the system to detect when a new academic year begins and prompt me to update the calendar before allowing any charge generation so that outdated calendar data does not cause billing errors.

**Why this priority**: Ensures smooth transition between academic years and prevents accidental use of previous year's calendar data for new charges.

**Independent Test**: Can be tested by simulating a date that crosses into a new academic year - the system should detect this and require calendar updates before proceeding.

**Acceptance Scenarios**:

1. **Given** the system date crosses into a new academic year and the calendar has not been updated, **When** a user attempts to access charge generation, **Then** the system displays a prominent prompt requiring academic calendar update first
2. **Given** the user has successfully updated the academic calendar for the new year, **When** they attempt to generate charges, **Then** the system allows the operation and uses the new calendar dates

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

1. **Mid-year term transition**: What happens when the current date falls exactly on a term boundary date? (Term end date inclusive or exclusive)
2. **Leap year handling**: How does the system handle February 29 dates in term calculations during leap years?
3. **Calendar gaps**: What happens if there are gaps between term dates (e.g., Term 1 ends but Term 2 hasn't started yet)? System should block charge generation during gaps
4. **Term date sequence validation failure**: If Term 1 end date is after Term 2 start date (indicating overlap), system must prevent calendar save and notify user
5. **Gap between terms**: System should allow gaps between Term 1 end and Term 2 start without triggering validation errors, but block charge generation if current date falls in a gap
6. **User attempts charge generation outside all term dates**: System must block when current date is before Term 1 start or after Term 3 end

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST determine the current term automatically by checking which term's date range contains today's date
- **FR-002**: System MUST restrict charge generation to only the currently active academic term (as determined by FR-001)
- **FR-003**: System MUST prevent users from generating charges for any term other than the current term
- **FR-004**: System MUST validate that the academic calendar is fully configured (all term dates set) before allowing charge generation
- **FR-005**: System MUST only allow charge generation on dates that fall within the current term's date range
- **FR-006**: System MUST enforce term date sequence consistency: Term 1 end date must be before or equal to Term 2 start date, and Term 2 end date must be before or equal to Term 3 start date (gaps allowed, overlaps prohibited)
- **FR-007**: System MUST validate term date sequences when saving academic calendar and reject invalid configurations
- **FR-008**: System MUST detect when the current date exceeds the end date of the last configured term (new year detection)
- **FR-009**: System MUST display a blocking prompt requiring academic calendar update when a new year is detected before allowing any charge generation
- **FR-010**: System MUST provide clear error messages explaining why charge generation is blocked (wrong term, incomplete calendar, outside term dates, new year detected)
- **FR-011**: System MUST implement absolute blocks with no override capability; users must resolve the underlying issue before proceeding

### Key Entities *(include if feature involves data)*

- **AcademicCalendar**: Represents the school year's schedule including term start/end dates and academic year boundaries. Key attributes: terms (array with id, name, start, end dates), academic year identifier.
- **Term**: Represents an academic period (Term 1, Term 2, Term 3) with defined start and end dates within the AcademicCalendar.
- **ChargeGenerationRequest**: Represents a user's request to generate charges for students. Key attributes: target term, generation date, status.
- **CurrentTermContext**: Represents the system's current operational term state. Key attributes: active term identifier, current date, calendar validity status.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 100% of charge generation attempts for non-current terms are blocked by the system
- **SC-002**: 100% of charge generation attempts with incomplete academic calendars are blocked with clear guidance
- **SC-003**: System correctly validates that charge generation date falls within the current term's date range
- **SC-004**: System correctly identifies new academic year transitions with 100% accuracy based on configured dates
- **SC-005**: Term date sequence validation catches 100% of invalid date configurations before calendar save
- **SC-006**: Users receive clear error messages explaining why charge generation is blocked in all restriction scenarios

## Clarifications

### Session 2026-04-10

- **Q: How should the system determine which term is "current"?** → A: Option A - Automatic by date range. System checks which term contains today's date based on academic calendar term start/end dates.
- **Q: How should "holiday periods" be defined and validated for blocking charge generation?** → A: Option A - No holidays defined. Holiday blocking is out of scope for this feature; system only validates against term dates.
- **Q: How should "new year detection" work to trigger the calendar update prompt?** → A: Option A - Date past last term. Trigger prompt when current date exceeds the end date of the last configured term.
- **Q: How should "term date sequence validation" handle gaps between terms?** → A: Option B - Gaps allowed, no overlap. Terms must be sequential without overlap, but gaps are permitted.
- **Q: Should the charge generation restrictions be absolute blocks or allow override with justification?** → A: Option A - Absolute blocks with no override capability. Users must resolve the underlying issue before proceeding.

## Assumptions

- Academic calendar uses a three-term system (Term 1, Term 2, Term 3) per academic year
- System has access to current date/time for validation purposes
- Academic calendar configuration interface exists and can be extended for validation
- Charge generation interface exists and can be modified to add restrictions
- Users with permission to generate charges are school administrators or finance staff
- New year detection is based on crossing the end date of the last configured academic year
- Term overlap is not permitted - each date belongs to exactly one term
- Gaps between terms are allowed (e.g., breaks between academic terms)
- Holiday period blocking is out of scope (FR-005 removed)

# Tasks: Current Term Charge Generation with Academic Calendar Validation

**Input**: Design documents from `/specs/023-current-term-charges/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are NOT included - not explicitly requested in feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/` (Controllers, Services, Models)
- **Frontend**: `frontend/src/` (API, hooks, components)

---

## Phase 1: Foundational (Core Service)

**Purpose**: Create the core validation service that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 Create `AcademicCalendarService.php` in `backend/app/Services/` with term detection and validation methods
- [X] T002 [P] Implement `getCurrentTerm(array $calendar, string $today)` method in `backend/app/Services/AcademicCalendarService.php`
- [X] T003 [P] Implement `validateCalendarCompleteness(array $calendar)` method in `backend/app/Services/AcademicCalendarService.php`
- [X] T004 [P] Implement `validateTermSequence(array $terms)` method in `backend/app/Services/AcademicCalendarService.php`
- [X] T005 [P] Implement `isNewYear(array $calendar, string $today)` method in `backend/app/Services/AcademicCalendarService.php`
- [X] T006 [P] Implement `canGenerateCharges(array $calendar, string $requestedTermId)` validation method in `backend/app/Services/AcademicCalendarService.php`
- [X] T007 Implement `ChargeGenerationValidationResult` response structure in `backend/app/Services/AcademicCalendarService.php`
- [X] T008 Define error code constants (`TERM_MISMATCH`, `CALENDAR_INCOMPLETE`, `OUTSIDE_TERM_DATES`, `NEW_YEAR_DETECTED`, `TERM_OVERLAP`) in `backend/app/Services/AcademicCalendarService.php`

**Checkpoint**: Foundation ready - AcademicCalendarService provides all validation methods needed by user stories

---

## Phase 2: User Story 1 - Generate Charges for Current Term Only (Priority: P1) 🎯 MVP

**Goal**: Restrict charge generation to only the current academic term (determined automatically by date range)

**Independent Test**: Attempt to generate charges for a non-current term (e.g., Term 2 when currently in Term 1) - system should block with `TERM_MISMATCH` error

### Backend Implementation

- [X] T009 [P] Add `calendar-status` endpoint in `backend/app/Controllers/Api/SettingsController.php` to expose current term and validation status
- [X] T010 Modify `generateTermCharges()` in `backend/app/Controllers/Api/LedgerController.php` to call `AcademicCalendarService::canGenerateCharges()` before transaction
- [X] T011 Add `TERM_MISMATCH` error response in `backend/app/Controllers/Api/LedgerController.php` when requested term doesn't match current term
- [X] T012 Add `OUTSIDE_TERM_DATES` error response in `backend/app/Controllers/Api/LedgerController.php` when current date is outside all term ranges

### Frontend Implementation

- [X] T013 [P] Add error code types (`TERM_MISMATCH`, `OUTSIDE_TERM_DATES`) to `frontend/src/api/api.ts`
- [X] T014 [P] Add `getCalendarStatus()` API call to `frontend/src/api/api.ts`
- [X] T015 Modify `useChargeGeneration.ts` hook to handle `TERM_MISMATCH` and `OUTSIDE_TERM_DATES` errors
- [X] T016 Modify `ChargeGenerationPanel.tsx` to display current term info and block non-current term selection
- [X] T017 Add error UI component in `ChargeGenerationPanel.tsx` for `TERM_MISMATCH` with current term details

**Checkpoint**: At this point, User Story 1 should be fully functional - charge generation blocked for wrong terms

---

## Phase 3: User Story 2 - Validate Academic Calendar Completeness (Priority: P2)

**Goal**: Block charge generation when academic calendar is incomplete or missing term dates

**Independent Test**: Clear term dates from calendar, attempt charge generation - system should block with `CALENDAR_INCOMPLETE` error

### Backend Implementation

- [X] T018 Modify `saveCalendar()` in `backend/app/Controllers/Api/SettingsController.php` to validate all terms have start/end dates before saving
- [X] T019 Add `CALENDAR_INCOMPLETE` error response in `backend/app/Controllers/Api/LedgerController.php` when calendar validation fails
- [X] T020 Update `calendar-status` endpoint to return `missingTerms` array when calendar is incomplete

### Frontend Implementation

- [X] T021 [P] Add `CALENDAR_INCOMPLETE` error code type to `frontend/src/api/api.ts`
- [X] T022 Modify `useChargeGeneration.ts` hook to handle `CALENDAR_INCOMPLETE` error
- [X] T023 Add error UI in `ChargeGenerationPanel.tsx` for `CALENDAR_INCOMPLETE` with "Configure Calendar" CTA button
- [X] T024 Modify calendar settings page to highlight missing term dates

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 4: User Story 3 - New Year Detection and Calendar Update Prompt (Priority: P2)

**Goal**: Detect when current date exceeds last term end date and prompt for calendar update

**Independent Test**: Set system date past last term end, attempt charge generation - system should block with `NEW_YEAR_DETECTED` error

### Backend Implementation

- [X] T025 Modify `generateTermCharges()` in `backend/app/Controllers/Api/LedgerController.php` to check `isNewYear()` before allowing charge generation
- [X] T026 Add `NEW_YEAR_DETECTED` error response in `backend/app/Controllers/Api/LedgerController.php` with action required message
- [X] T027 Update `calendar-status` endpoint to return `isNewYear: true` and `actionRequired` when new year detected

### Frontend Implementation

- [X] T028 [P] Add `NEW_YEAR_DETECTED` error code type to `frontend/src/api/api.ts`
- [X] T029 Modify `useChargeGeneration.ts` hook to handle `NEW_YEAR_DETECTED` error
- [X] T030 Add prominent banner in `ChargeGenerationPanel.tsx` for `NEW_YEAR_DETECTED` with link to calendar settings
- [X] T031 Add "Update Calendar" prompt in calendar settings page when `isNewYear` is true

**Checkpoint**: All user stories should now be independently functional

---

## Phase 5: Term Sequence Validation on Calendar Save

**Purpose**: Enforce term date sequence (no overlaps) when saving academic calendar

- [X] T032 Modify `saveCalendar()` in `backend/app/Controllers/Api/SettingsController.php` to call `validateTermSequence()` before saving
- [X] T033 Add `TERM_OVERLAP` error response in `backend/app/Controllers/Api/SettingsController.php` with specific overlap details
- [X] T034 Add overlap highlighting in calendar settings UI to show which term dates conflict

**Checkpoint**: Calendar save now validates term sequences and rejects overlapping dates

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T035 [P] Add error logging for all charge generation blocks in `backend/app/Controllers/Api/LedgerController.php`
- [X] T036 Add loading states in `ChargeGenerationPanel.tsx` while fetching calendar status
- [X] T037 [P] Verify all new endpoints filter by `tenant_id` per Constitution Principle I
- [ ] T038 [P] Run quickstart.md test scenarios and verify all pass
- [ ] T039 Update API documentation to reflect new error responses
- [ ] T040 Add error message localization support (if i18n exists)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies - can start immediately
  - **BLOCKS**: All user stories (US1, US2, US3)
- **User Stories (Phase 2-4)**: All depend on Foundational phase completion
  - Can proceed in parallel after Phase 1 (if staffed)
  - Or sequentially: US1 (P1) → US2 (P2) → US3 (P2)
- **Term Sequence Validation (Phase 5)**: Depends on US2 (calendar save)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Uses same AcademicCalendarService
- **User Story 3 (P2)**: Can start after Foundational - Uses same AcademicCalendarService

### Within Each User Story

- Backend API changes before frontend modifications
- Service methods before controller integration
- Error handling after core validation logic

### Parallel Opportunities

- All Phase 1 tasks marked [P] can run in parallel (different methods in same file)
- Once Phase 1 completes, all user stories can start in parallel (if team capacity allows)
- Frontend and backend work within a story can be parallel (with API contract agreement)
- Phase 6 polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Backend tasks (can run in sequence within backend):
Task: "Add calendar-status endpoint in backend/app/Controllers/Api/SettingsController.php"
Task: "Modify generateTermCharges() in backend/app/Controllers/Api/LedgerController.php"

# Frontend tasks (can run in parallel with backend once API contract agreed):
Task: "Add error code types to frontend/src/api/ledger.ts"
Task: "Modify useChargeGeneration.ts hook"
Task: "Modify ChargeGenerationDialog.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (AcademicCalendarService)
2. Complete Phase 2: User Story 1 (Current Term Only)
3. **STOP and VALIDATE**: Test User Story 1 independently using quickstart.md scenarios
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add Term Sequence Validation → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Developer A: Phase 1 (AcademicCalendarService) - FOUNDATION
2. Once Phase 1 complete:
   - Developer A: User Story 1 (Current Term)
   - Developer B: User Story 2 (Calendar Completeness)
   - Developer C: User Story 3 (New Year Detection)
3. Stories complete and integrate independently

---

## Task Summary

| Phase | Tasks | Purpose |
|-------|-------|---------|
| Foundational | 8 | AcademicCalendarService with all validation methods |
| US1 (P1) | 9 | Current term restriction |
| US2 (P2) | 6 | Calendar completeness validation |
| US3 (P2) | 6 | New year detection |
| Term Sequence | 3 | Calendar save validation |
| Polish | 6 | Error handling, logging, verification |
| **Total** | **38** | |

---

## Notes

- [P] tasks = different files/methods, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- All error responses follow existing `BaseApiController::error()` pattern
- All queries include `tenant_id` filtering per Constitution Principle I
- No schema changes required (existing `academic_calendar` JSON column)

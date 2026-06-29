# Tasks: Fix Class Promotion Logic to Use next_class_id

**Input**: Design documents from `specs/005-fix-class-promotion/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Tests**: Not requested in spec — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

*No setup tasks required — project structure is already in place on branch `005-fix-class-promotion`.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the `is_final_class` column to the database. This schema change must be applied before any model or controller changes can be tested.

**⚠️ CRITICAL**: No user story implementation can be verified until this phase is complete.

- [x] T001 Create migration file `backend/app/Database/Migrations/2026-04-06-100000_Add_is_final_class_to_classes.php` — add `is_final_class TINYINT(1) NOT NULL DEFAULT 0` after `next_class_id` column, with a `down()` that drops it (see data-model.md for exact field definition)
- [x] T002 [P] Update `backend/app/Database/Seeds/CompleteDatabaseSeeder.php` — in the Phase 2 chain-setup block (after the `UPDATE classes SET next_class_id` statements), add `$this->db->query("UPDATE classes SET is_final_class = 1 WHERE id = 'class_005'");` so the seeded graduation class is correctly flagged

**Checkpoint**: Run `php spark migrate` and confirm `SHOW COLUMNS FROM classes LIKE 'is_final_class'` returns one row. Seed and confirm `class_005.is_final_class = 1`.

---

## Phase 3: User Story 1 — Bulk Promotion Using next_class_id (Priority: P1) 🎯 MVP

**Goal**: The bulk promotion endpoint correctly promotes, graduates, or skips students based on `is_final_class` and `next_class_id`, never conflating unconfigured classes with graduation classes.

**Independent Test**: With the seeded data (class_005 as final, class_001–004 chained), call `POST /api/students/promote` and verify: promoted count = active students in class_001–004, graduated count = active students in class_005, skipped count = 0.

### Implementation

- [x] T003 [P] [US1] Update `backend/app/Models/ClassModel.php`:
  - Add `'is_final_class'` to `$allowedFields`
  - Add `'isFinalClass' => (bool)($class['is_final_class'] ?? false)` to `formatForApi()`
  - Add `'is_final_class' => isset($data['isFinalClass']) ? (int)(bool)$data['isFinalClass'] : 0` to `formatFromApi()`
  - Rewrite `isFinalClass()` to `return (bool)($class['is_final_class'] ?? false)` instead of `empty($class['next_class_id'])`

- [x] T004 [P] [US1] Update `backend/app/Controllers/Api/StudentController.php` — method `promoteStudent()` (single-student auto-promote, ~line 1519):
  - After the `if (!$newClassId)` block, check `$this->classModel->isFinalClass($student['class_id'])`
  - If true: call `$this->enrollmentModel->graduateStudent(...)` and return a success response (consistent with bulk endpoint)
  - If false and `getNextClass()` returns null: return the existing `'No next class available'` error

- [x] T005 [US1] Update `backend/app/Controllers/Api/StudentController.php` — method `promoteStudentsFromClass()` (~line 891):
  - In the `else` (no next class configured) branch, change the error message to: `"No next class configured for {$class['name']} — set next_class_id or mark the class as final to graduate students"` so admins know what action to take

**Checkpoint**: With seeded data, `POST /api/students/promote` must return `promoted ≥ 1, graduated ≥ 1, skipped = 0`. A class with neither `is_final_class` nor `next_class_id` must appear in `errors[]` with a clear message.

---

## Phase 4: User Story 2 — Admin Configures the Class Progression Chain (Priority: P2)

**Goal**: The chain-setup endpoint accepts and persists `isFinalClass`; setting `nextClassId` automatically clears `is_final_class`; the class list and edit modal expose the flag so admins can configure it from the UI.

**Independent Test**: `PUT /api/classes/class_005/next-class` with `{"nextClassId": null, "isFinalClass": true}` should respond with `isFinalClass: true`. Then `GET /api/classes/class_005` should return `isFinalClass: true`.

### Implementation

- [x] T006 [P] [US2] Update `backend/app/Controllers/Api/ClassController.php` — method `setNextClass()` (~line 548):
  - Read `$isFinalClass = (bool)($data['isFinalClass'] ?? false)` from the request body
  - Business rule: if `$nextClassId` is non-null, force `$isFinalClass = false`
  - After the existing cycle-detection block, update the record with both fields: call `$this->classModel->update($id, ['next_class_id' => $nextClassId, 'is_final_class' => (int)$isFinalClass])`
  - Replace the current `setNextClass()` call or call it first and follow with the `is_final_class` update (or combine into one `update()` call directly in the controller)
  - Return the updated class via `formatForApi()` (which now includes `isFinalClass` from T003)

- [x] T007 [P] [US2] Update `frontend/src/api/api.ts`:
  - In the function that calls `PUT /api/classes/{id}/next-class` (or the general class update that sets `nextClassId`), add `isFinalClass` to the request payload
  - Ensure the TypeScript type for the class object includes `isFinalClass: boolean`

- [x] T008 [US2] Update `frontend/src/components/modals/EditClassModal.tsx`:
  - Add `isFinalClass: z.boolean().default(false)` to the Zod form schema
  - Render a `<Checkbox>` labelled "Final class (graduation)" bound to `isFinalClass` field
  - Include `isFinalClass` in the submit payload sent to `api.ts`
  - When `isFinalClass` is checked, visually disable the "Next class" dropdown (or clear it) to enforce the invariant that a final class has no next class

**Checkpoint**: From the Classes page, edit `11A`, check "Final class (graduation)", save. Confirm the API returns `isFinalClass: true` and `nextClassId: null`.

---

## Phase 5: User Story 3 — Promotion Preview Reflects next_class_id Chain (Priority: P3)

**Goal**: Both preview endpoints surface `status` and `action` fields per class, letting admins see at a glance which classes will promote, graduate, or be skipped — using the same corrected `isFinalClass()` logic as the actual promotion.

**Independent Test**: `GET /api/classes/promotion-preview` should return `class_005` with `isFinalClass: true` and `class_001`–`class_004` with `isFinalClass: false` and correct `nextClass` populated (no changes needed to query logic — only response shape changes).

### Implementation

- [x] T009 [P] [US3] Update `backend/app/Controllers/Api/ClassController.php` — method `getPromotionPreview()` (~line 731):
  - Derive `$status` per class: `'final'` if `$isFinal`, `'promotable'` if `$nextClass !== null`, else `'unconfigured'`
  - Derive `$action` per class: `'graduate'` if final, `'promote'` if has next class, else `'skip'`
  - Add `'status' => $status` and `'action' => $action` to each entry in the `$preview[]` array

- [x] T010 [P] [US3] Update `backend/app/Controllers/Api/StudentController.php` — method `promotionPreview()` (~line 950):
  - Apply the same `status` / `action` derivation as T009 to each class entry in `$preview['classes'][]`
  - Ensure `isFinalClass` is also included in each class entry (currently not present in this endpoint's response)

**Checkpoint**: `GET /api/classes/promotion-preview` and `GET /api/students/promotion-preview` both return `class_005` with `status: "final"`, `action: "graduate"`; class_001–004 with `status: "promotable"`, `action: "promote"`; any unconfigured class with `status: "unconfigured"`, `action: "skip"`.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T011 Verify `MigrationPreviewModal` in `frontend/src/components/modals/MigrationPreviewModal.tsx` correctly handles the new `status`/`action` fields from T009/T010 — if the modal hard-codes graduation detection via `isFinalClass`, confirm it still works; if it re-derives from `nextClass === null`, update it to use `isFinalClass` from the response
- [x] T012 [P] Run the full quickstart.md verification sequence: migrate → seed → preview API → promote API → confirm counts; document any discrepancies

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. **Blocks all phases.**
- **Phase 3 (US1)**: Depends on Phase 2 completion (migration must be applied for `isFinalClass()` to read the new column).
- **Phase 4 (US2)**: Depends on T003 (ClassModel changes in Phase 3) for `formatForApi` to include `isFinalClass` in the `setNextClass` response. Backend tasks (T006) can start alongside Phase 3; frontend tasks (T007, T008) can start independently once the API contract is known.
- **Phase 5 (US3)**: Depends on T003 (corrected `isFinalClass()`) — preview endpoints delegate to the same model method.
- **Phase 6 (Polish)**: Depends on Phase 3–5 completion.

### User Story Dependencies

- **US1 (P1)**: Start after Phase 2. No dependency on US2 or US3.
- **US2 (P2)**: Backend (T006) can start after Phase 2 + T003. Frontend (T007, T008) can start after Phase 2 independently.
- **US3 (P3)**: Start after T003 (Phase 3). No dependency on US2.

### Within Each User Story

- T003 before T004/T005 (ClassModel fix enables correct behaviour in controller)
- T007 before T008 (api.ts type must be defined before the modal references it — or done in parallel if contract is already defined in contracts/api-changes.md)

---

## Parallel Example: Phase 3 (US1)

```text
# These three tasks touch different files and can run in parallel:
Task T003: backend/app/Models/ClassModel.php
Task T004: backend/app/Controllers/Api/StudentController.php (promoteStudent method)
Task T005: backend/app/Controllers/Api/StudentController.php (promoteStudentsFromClass method)

# Note: T004 and T005 are in the same file — assign to the same agent/developer
```

## Parallel Example: Phase 4 (US2)

```text
# T006 and T007 touch different files and can run in parallel:
Task T006: backend/app/Controllers/Api/ClassController.php
Task T007: frontend/src/api/api.ts

# T008 (EditClassModal.tsx) depends on T007 but can start once the interface is defined
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (migration + seeder)
2. Complete Phase 3: US1 (ClassModel fix + StudentController fixes)
3. **STOP and VALIDATE**: `POST /api/students/promote` returns correct promoted/graduated/skipped counts
4. Bulk promotion is now safe — unconfigured classes no longer accidentally graduate students

### Incremental Delivery

1. Phase 2 → Foundation ready
2. Phase 3 (US1) → Bulk promotion works correctly (MVP)
3. Phase 4 (US2) → Admins can configure final classes from the UI
4. Phase 5 (US3) → Preview accurately reflects what promotion will do
5. Phase 6 → Polish and verification

---

## Notes

- T003 is the single most critical task — `isFinalClass()` is called by every promotion and preview code path; fixing it propagates the correctness everywhere
- T004 (single-student endpoint) is a separate concern from T005 (bulk endpoint) — they share the same file but different methods; both should be done together
- T008 (EditClassModal) has the UX decision: when "Final class" is checked, the "Next class" dropdown should be disabled to prevent conflicting state — implement this as a `watch` on the `isFinalClass` field using React Hook Form
- The seeder fix (T002) must produce `is_final_class = 1` for `class_005` for integration testing to work correctly

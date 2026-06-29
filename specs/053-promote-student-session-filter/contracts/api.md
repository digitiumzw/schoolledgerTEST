# API Contracts: Promote Student – Session-Scoped Preview & Filtering

**Feature**: `053-promote-student-session-filter`  
**Date**: 2026-04-29

All contracts below describe **changes or clarifications** to existing endpoints. No new routes are added. Response envelope follows the established convention:
```json
{ "status": "success", "data": { ... }, "message": "..." }
```

---

## 1. GET /api/students/migration-preview

**Purpose**: Returns a summary of what would happen if bulk promotion were run now. Used by `MigrationPreviewModal`.

### Change

`migrations[].studentCount` and `summary.totalStudents / promotedCount / graduatedCount / repeatingCount` are now computed using only students whose `enrollment.academic_session = activeAcademicSession`. Students enrolled in any other session are excluded from all counts.

### Response Shape (unchanged, semantics tightened)

```json
{
  "status": "success",
  "data": {
    "academicSession": "2026/2027",
    "nextSession": "2027/2028",
    "migrations": [
      {
        "fromClass": "Grade 7A",
        "toClass": "Grade 8A",
        "studentCount": 12,
        "isGraduation": false,
        "isRepeating": false,
        "isNoNextClass": false
      }
    ],
    "summary": {
      "totalStudents": 48,
      "promotedCount": 40,
      "graduatedCount": 5,
      "repeatingCount": 3,
      "noNextClassCount": 0
    },
    "reconciliationNeeded": 0
  },
  "message": "..."
}
```

**Note**: `studentCount` in each migration row now reflects only the session-scoped cohort. A class whose students are all enrolled in a prior session will have `studentCount: 0` and will be omitted from the `migrations` array (existing empty-class skip logic is preserved).

---

## 2. GET /api/classes/promotion-preview

**Purpose**: Returns per-class breakdown with student lists. Used by `MigrationPreviewModal` (Class Breakdown section).

### Change

`studentsToPromote` and `students[]` now only include students whose `enrollment.academic_session = activeAcademicSession`. The `activeAcademicSession` is resolved server-side via `AcademicSessionService`.

### Response Shape (unchanged, semantics tightened)

```json
{
  "status": "success",
  "data": [
    {
      "class": {
        "id": "...",
        "name": "Grade 7A",
        "stream": null,
        "gradeLevel": { "id": "...", "name": "Grade 7", "sortOrder": 7 },
        "isFinalClass": false
      },
      "studentsToPromote": 12,
      "students": [
        { "id": "...", "firstName": "John", "lastName": "Doe", "willGraduate": false }
      ],
      "nextClass": { "id": "...", "name": "Grade 8A", "gradeLevel": { "name": "Grade 8" } },
      "isFinalClass": false,
      "status": "promotable",
      "action": "promote"
    }
  ]
}
```

---

## 3. POST /api/students/promote

**Purpose**: Executes bulk promotion for the active academic session.

### Change

When no `studentIds` array is provided (i.e. bulk promote all), the `preloadedStudents` snapshot is now built using the session-filtered query. Only students with `enrollment.academic_session = academicSession` are included in the batch.

When an explicit `studentIds` array is provided, each student is still promoted individually (existing behavior) — no session filter is applied to manual ID-based promotes, consistent with Decision 5 in `research.md`.

### Request Body (unchanged)

```json
{
  "academicSession": "2026/2027"
}
```

### Response Shape (unchanged)

```json
{
  "status": "success",
  "data": {
    "promoted": 40,
    "graduated": 5,
    "skipped": 0,
    "errors": [],
    "promotionDetails": [...],
    "academicSession": "2026/2027",
    "nextSession": "2027/2028"
  },
  "message": "Promoted 40 student(s), graduated 5 student(s)"
}
```

---

## 4. Frontend: MigrationPreviewModal Session Scope Banner

Not an API contract, but a UI contract consumed by the modal component.

### New UI Element

An `Alert` (info/default variant) rendered immediately inside `<AlertDialogContent>`, before the existing warning banners, whenever `preview.academicSession` is non-empty:

```
ℹ  Only students actively enrolled in 2026/2027 will be promoted to 2027/2028.
```

The existing `AlertDialogDescription` text is updated to remove the vague generic phrasing, since the banner makes it redundant.

### No-session state

When `preview.academicSession` is falsy the banner is replaced by the existing "No Active Session" destructive alert (no change to that logic).

# Data Model: Session Alert and Configuration

**Feature**: `052-session-alert-and-config`  
**Date**: 2026-04-29

## Overview

This feature introduces **no new data entities and no schema changes**. It only modifies how the existing `Settings.activeAcademicSession` field is surfaced and edited in the UI.

---

## Existing Entity: Settings (relevant fields)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `activeAcademicSession` | `string` | Yes | Active session in `YYYY/YYYY+1` format (e.g., `"2026/2027"`). `null` = not configured. |

**Source of truth**: Backend `settings` table, tenant-scoped.  
**API**: `GET /api/settings` returns the full settings object; `PUT /api/settings` persists updates.  
**Frontend type**: `Settings` interface in `src/types/dashboard.ts` — field already defined.

---

## Derived Value: Recommended Session

Not persisted. Computed in the frontend at render time:

```
recommendedSession = `${currentYear}/${currentYear + 1}`
```

Where `currentYear = new Date().getFullYear()`.

This value is always present in the `sessionOptions` array (the `offset = 0` entry), so it is always a valid selection.

---

## UI State (no new persistent state)

| Component | New local state | Purpose |
|-----------|----------------|---------|
| `GeneralSettingsTab` | `activeSessionValue: string` | Holds the dropdown selection before saving; initialises to `activeAcademicSession ?? recommendedSession` |
| `GeneralSettingsTab` | `savingSession: boolean` | Controls loading state on the Save Session button |
| `Classes` (inline widget) | `inlineSession: string` | Holds the inline dropdown selection; initialises to `activeAcademicSession ?? recommendedSession` |
| `Classes` (inline widget) | `savingInlineSession: boolean` | Controls loading state on the Set Session button |

`AcademicCalendarTab` already has `selectedSession` and `savingSession` — only the initialisation default changes.

---

## State Transitions

```
activeAcademicSession = null
  → UI shows "no session" alert + pre-filled dropdown (recommendedSession)
  → Admin selects/confirms value → clicks Save Session
  → PUT /api/settings called
  → On success: activeAcademicSession = selectedValue
  → ['settings'] query cache invalidated
  → Alert suppressed; Promote Students button enabled
```

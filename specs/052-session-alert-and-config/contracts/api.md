# Contracts: Session Alert and Configuration

**Feature**: `052-session-alert-and-config`  
**Date**: 2026-04-29

## Overview

This feature introduces **no new API endpoints**. All session persistence uses the existing settings endpoints.

---

## Existing Endpoint Used: Update Settings

**`PUT /api/settings`**

Used by all three surfaces (General Settings tab, Academic Calendar tab, Classes inline widget) to persist `activeAcademicSession`.

### Request

```http
PUT /api/settings
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "activeAcademicSession": "2026/2027"
}
```

To clear the session:

```json
{
  "activeAcademicSession": null
}
```

### Success Response

```json
{
  "status": "success",
  "data": { ...fullSettingsObject },
  "message": "Settings saved"
}
```

### Error Response

```json
{
  "status": "error",
  "message": "...",
  "errors": {}
}
```

---

## Existing Endpoint Used: Get Settings

**`GET /api/settings`**

Used by `useActiveSession` hook (query key `['settings']`) and by all three component `loadData` / `loadCalendar` functions to fetch the current `activeAcademicSession` value.

### Response

```json
{
  "status": "success",
  "data": {
    "tenantId": "...",
    "activeAcademicSession": "2026/2027",
    ...
  }
}
```

---

## Frontend Contract: Inline Session Selector (Classes page)

The inline widget is a self-contained piece of UI state within `Classes.tsx`. It:

1. Reads `activeAcademicSession` from the `useActiveSession` hook.
2. Maintains local `inlineSession` state (pre-filled with `activeAcademicSession ?? recommendedSession`).
3. On "Set Session" click: calls `api.saveSettings({ ...currentSettings, activeAcademicSession: inlineSession })`.
4. On success: calls `queryClient.invalidateQueries({ queryKey: ['settings'] })`.
5. The `useActiveSession` hook re-fetches, `activeSession` updates, alert unmounts, Promote Students button enables.

No props are passed between the alert and the rest of the page — the reactive update is driven entirely through the React Query cache.

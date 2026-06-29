# Quickstart: Session Alert and Configuration

**Feature**: `052-session-alert-and-config`  
**Date**: 2026-04-29

## What this feature changes

Three frontend files are modified. No backend changes, no new dependencies, no migrations.

---

## Files to Modify

### 1. `frontend/src/components/settings/GeneralSettingsTab.tsx`

**Changes**:
- Add `savingSession` state (`boolean`, default `false`).
- Add `activeSessionValue` state (`string`), initialised in `loadData()` to `settingsData.activeAcademicSession ?? recommendedSession`.
- Compute `recommendedSession` via `useMemo`: `` `${year}/${year + 1}` `` where `year = new Date().getFullYear()`.
- Add `handleSaveSession` async function (matches the pattern in `AcademicCalendarTab`):
  - Calls `api.saveSettings({ ...settings, activeAcademicSession: value === "__none__" ? null : value })`.
  - On success: invalidates `['settings']` query, updates local `settings` state, shows success toast.
- Replace the read-only `<Input disabled value={settings.activeAcademicSession ?? "Not set"} />` block with a `<Select>` (same options as `AcademicCalendarTab`) + "Save Session" `<Button>`.
- Add a "No session configured" `<Alert variant="destructive">` rendered when `!settings.activeAcademicSession` (and not yet saved in this session).
- Import `useQueryClient` from `@tanstack/react-query`.

### 2. `frontend/src/components/settings/AcademicCalendarTab.tsx`

**Changes**:
- Compute `recommendedSession` via `useMemo`: `` `${year}/${year + 1}` ``.
- In `loadCalendar()`, change the `setSelectedSession` fallback:
  ```diff
  - setSelectedSession(settingsData.activeAcademicSession ?? "__none__");
  + setSelectedSession(settingsData.activeAcademicSession ?? recommendedSession);
  ```
- No other changes to this file.

### 3. `frontend/src/pages/Classes.tsx`

**Changes**:
- Add `inlineSession` state (`string`), synchronised from `activeSession ?? recommendedSession` via `useEffect`.
- Add `savingInlineSession` state (`boolean`, default `false`).
- Compute `recommendedSession` and `sessionOptions` (same pattern as the settings tabs).
- Add `handleSetInlineSession` async function:
  - Fetches current settings (`api.getSettings()`).
  - Calls `api.saveSettings({ ...currentSettings, activeAcademicSession: inlineSession })`.
  - On success: invalidates `['settings']` query, shows success toast.
- Extend the existing "No active session" `<Alert>` body to include the inline `<Select>` + "Set Session" `<Button>` beneath the existing description text.
- Import `useQueryClient` from `@tanstack/react-query`, `Select*` from `@/components/ui/select`, `Label` from `@/components/ui/label`.

---

## Verification Steps

After implementation, verify these manual test cases:

| # | Steps | Expected |
|---|-------|----------|
| 1 | Log in as admin with no `activeAcademicSession` set. Open **Settings → General**. | Alert "No session configured" visible. Session dropdown pre-filled with `YYYY/YYYY+1`. |
| 2 | Accept the pre-filled session in General Settings and click "Save Session". | Success toast. Alert gone on reload. |
| 3 | Open **Settings → Academic Calendar**. Ensure session is null/cleared first. | Session dropdown shows `YYYY/YYYY+1` (not "— Not set"). |
| 4 | Open **Classes** page with no session set. | "No active session" alert visible with inline dropdown pre-filled `YYYY/YYYY+1` and "Set Session" button. |
| 5 | Use inline dropdown to set a session on Classes page and click "Set Session". | Alert disappears. "Promote Students" button becomes clickable. No page reload. |
| 6 | Set a session. Reload Classes page. | No "no session" alert. Session badge shows set value. |
| 7 | Open **Settings → General** with a session already set. | No "no session" alert. Dropdown shows saved value. |

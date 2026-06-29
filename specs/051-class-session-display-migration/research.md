# Research: Class Page Session Display & Migration Session Awareness (051)

**Phase 0 output for `/speckit.plan`**

---

## Question 1: Which API endpoint should supply the active session for the Classes page header?

**Decision**: Re-use `GET /api/settings` (already exists, already JWT-filtered, already called by `AppHeader`).

**Rationale**:
- `SettingsController::index()` calls `AcademicSessionService::getCurrentSession($tenantId)` and returns the result as `activeAcademicSession` in the response payload. This is confirmed in the codebase.
- `AppHeader` already calls `api.getSettings()` on every page load. React Query's cache means a second call from a `useActiveSession` hook on the same page will be served from cache — zero extra network requests.
- The alternative (`GET /api/class-migration/year-prefill` from spec 050) returns richer data (nextYear, availableYears, fallbackUsed, warning) but adds an extra route dependency. For a simple display badge, the settings endpoint is sufficient and simpler.

**Alternatives considered**:
- `GET /api/class-migration/year-prefill` — richer but heavier; reserved for the YearEndMigrationPanel where the extra data is needed.
- Deriving the session client-side from the academic calendar (`getCurrentTerm` util) — fragile, duplicates backend logic, produces a different value than what the promotion API actually uses.

---

## Question 2: Where does the migration preview already get its session values, and is it already correct?

**Decision**: The `MigrationPreview` interface in `MigrationPreviewModal.tsx` already declares `academicSession: string` and `nextSession: string`, populated from `GET /api/students/migration-preview`. The backend promotion logic uses `AcademicSessionService::getCurrentSession()` for the source and `getNextSession()` for the target. **These are already correct** — no backend change needed.

**Rationale**:
- The modal title already renders `{preview.academicSession} → {preview.nextSession}` (line 204 of `MigrationPreviewModal.tsx`).
- The `promoteStudents` API call accepts an optional `academicSession` parameter but the backend defaults to `AcademicSessionService::getCurrentSession()` when it is omitted — consistent with the displayed value.

**Alternatives considered**:
- Passing `academicSession` explicitly from the Classes page into `MigrationPreviewModal` — unnecessary if the backend already sources it correctly.

---

## Question 3: How should the new `useActiveSession` hook be structured?

**Decision**: TanStack React Query `useQuery` hook, query key `['settings']`, backed by `api.getSettings()`. Return `{ activeSession: string | null, isLoading: boolean, isError: boolean, isFallback: boolean }`.

**Rationale**:
- Mirrors the existing `useGradeLevels` hook pattern exactly (React Query, staleTime 5 min, simple return shape).
- Using `queryKey: ['settings']` ensures the cache is shared with any other component that calls `api.getSettings()` with the same key, avoiding duplicate requests.
- `isFallback` is derived client-side: if the raw `activeAcademicSession` field from the settings response is null/undefined but a session value was still returned (via the backend's `academicYear` fallback), we can detect this by checking whether `activeAcademicSession` was present in the raw payload. This feeds FR-009 (P3 configure affordance).

**Session value derivation (client-side)**:
```
rawSettings.activeAcademicSession  → present + valid  → use as-is, isFallback = false
rawSettings.activeAcademicSession  → absent/null      → isFallback = true, display whatever the backend returned
                                                          (backend already normalised it via AcademicSessionService)
```

**Alternatives considered**:
- Inline `useState` + `useEffect` in `Classes.tsx` — violates Principle VII (DRY, single responsibility); not reusable.
- Calling `api.getSettings()` directly without React Query — bypasses cache, can cause redundant network calls.

---

## Question 4: What is the correct visual treatment for the session badge on the Classes page?

**Decision**: A small `<Badge>` component (shadcn/ui) with a `Calendar` icon, placed in the existing header `<div>` alongside the page title. Skeleton while loading, `—` text on error.

**Rationale**:
- Consistent with existing badge usage throughout the Classes page (e.g., stream badges, capacity badges, archived badges).
- Small and non-intrusive — the badge communicates context without dominating the header.
- The `MigrationPreviewModal` already shows the session in its title for the migration flow, so the header badge is purely contextual.

**Loading/error states**:
- Loading: `<Skeleton className="h-5 w-28" />` inline with the subtitle text (matches existing skeleton pattern in the loading branch of `Classes.tsx`).
- Error: plain `<Badge variant="secondary">—</Badge>` with no icon; no toast (the failure is non-critical).

**P3 configure affordance** (if `isFallback = true`):
- Add a `title` tooltip to the badge: `"Session derived from legacy settings. Configure in Settings → General."` — no router navigation link required (keeps it simple and avoids coupling the Classes page to the settings route).

---

## Question 5: Does blocking migration when no session is configured require a backend change?

**Decision**: No. The `MigrationPreviewModal` already disables "Confirm Migration" when `reconciliationNeeded > 0`. The same pattern will be used: if `preview.academicSession` is absent or falsy in the preview response, disable the button and show an alert. The backend already returns a well-formed preview regardless — the guard is a UI-layer safety net.

**Rationale**:
- `AcademicSessionService::getCurrentSession()` always returns *something* (falls back to `date('Y')/date('Y')+1`), so a truly null session is only possible if the backend service itself errors. In that case the preview API call fails entirely, which the modal already handles (shows "Unable to Load Preview" fallback).
- The FR-008 guard is therefore belt-and-suspenders: if `preview.academicSession` resolves to empty string or undefined, disable confirm. In practice this path is unlikely but safe to guard.

---

## Summary of Decisions

| Decision | Chosen Approach |
|----------|----------------|
| Session data source for header badge | `GET /api/settings` → `activeAcademicSession` field via new `useActiveSession` hook |
| Session data source for migration modal | Already correct — `GET /api/students/migration-preview` → `academicSession` / `nextSession` fields |
| Hook structure | `useQuery(['settings'], api.getSettings)` — shared cache with AppHeader |
| Badge visual | shadcn `<Badge>` + `Calendar` icon in Classes page header; Skeleton while loading |
| Fallback detection | Client-side: `activeAcademicSession` field null/absent in settings response → `isFallback = true` |
| Migration block when no session | UI guard in `MigrationPreviewModal`: disable confirm if `preview.academicSession` falsy |
| Backend changes | **None required** |
| New files | `frontend/src/hooks/useActiveSession.ts` only |
| Modified files | `frontend/src/pages/Classes.tsx` (badge in header) |
| Verified files | `frontend/src/components/modals/MigrationPreviewModal.tsx` (already correct, no change needed) |

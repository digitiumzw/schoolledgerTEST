# Tasks: Platform Admin Schools Page Redo

**Input**: Design documents from `/specs/042-admin-schools-page/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api.md ✅ · quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.
**Tests**: Backend integration tests are included for the delete safeguard extension (Principle X requirement). No frontend test tasks — no automated frontend test runner is configured.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: Confirm working branch and verify all existing routes and endpoints respond correctly before touching any code.

- [ ] T001 Confirm working branch is `042-admin-schools-page` and all existing platform-admin endpoints are reachable (`GET /api/platform/tenants`, `POST /api/platform/tenants/:id/suspend`, `DELETE /api/platform/tenants/:id`)
- [ ] T002 [P] Confirm the existing `GET /api/platform/finance/invoices/:id/pdf` endpoint returns a PDF blob when called with a valid platform-admin JWT (no impersonation token)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend additions that multiple user stories depend on. Must be complete before Phase 3+.

**⚠️ CRITICAL**: US4 (delete safeguards) and US5 (invoice access) depend on backend changes in this phase.

- [ ] T003 Add `getTenantInvoices` API function in `frontend/src/api/platform.ts` — `GET /tenants/:id/invoices` with `params` query string support (status, dir, page, limit) — see contracts/api.md for exact signature
- [ ] T004 Add `GET tenants/(:segment)/invoices` route in `backend/app/Config/Routes.php` inside the `api/platform` group, registered **before** the existing `GET tenants/(:segment)` route to avoid shadowing: `$routes->get('tenants/(:segment)/invoices', 'TenantsController::tenantInvoices/$1');`

**Checkpoint**: New route registered and `getTenantInvoices` function available — user story phases can now proceed

---

## Phase 3: User Story 1 — Browse and search all schools (Priority: P1) 🎯 MVP

**Goal**: Schools list renders all tenants with correct columns, server-side search/filter works, no subdomain column present anywhere in the list view.

**Independent Test**: Open the Schools page → verify all tenants appear, search by name narrows results, subdomain column is absent from table headers and rows, pagination controls show correct totals.

### Implementation for User Story 1

- [ ] T005 [US1] Remove `subdomain` from the `index()` SELECT clause in `backend/app/Controllers/Platform/TenantsController.php` (line 23–28) — remove `t.subdomain` from the selected columns string so the field is not returned in the list response
- [ ] T006 [US1] Remove `recent_invoices` from the `Tenant` TypeScript type definition in `frontend/src/admin/pages/Schools.tsx` (line 34–50) — the billing tab will fetch invoices independently; update the type to remove the `recent_invoices?: any[]` field
- [ ] T007 [US1] Verify the Schools list table in `frontend/src/admin/pages/Schools.tsx` has no subdomain column header or cell — confirm no `subdomain` value is rendered in `TableHead` or `TableCell` elements in the list (lines 252–388); the list already has no subdomain column so this is a verification + removal of any residual references only

**Checkpoint**: Schools list shows all tenants with correct columns. Search and filter confirmed working (server-side, already implemented). No subdomain visible anywhere in the list.

---

## Phase 4: User Story 2 — View tenant profile without redundant information (Priority: P1)

**Goal**: Tenant detail sheet Profile tab has no subdomain row. All remaining fields are accurate.

**Independent Test**: Click any tenant row to open the detail sheet → navigate to Profile tab → confirm no "Subdomain" label or value appears → confirm all other fields (name, email, plan, status, join date) are populated from backend data.

### Implementation for User Story 2

- [ ] T008 [US2] Remove `subdomain` from the `show()` SELECT clause in `backend/app/Controllers/Platform/TenantsController.php` (lines 64–70) — remove `t.subdomain` from the selected columns string so the field is not returned in the detail response
- [ ] T009 [US2] Remove the `["Subdomain", selected.subdomain ?? "—"]` entry from the Profile tab row array in `frontend/src/admin/pages/Schools.tsx` (line 423) — this is the single rendered row that must be deleted
- [ ] T010 [US2] Remove `subdomain: string` from the `Tenant` type in `frontend/src/admin/pages/Schools.tsx` (line 38) now that neither the list nor the detail view renders it — keep `subdomain` out of the interface entirely since `createTenant` sends it as a form field directly without reading it from the type

**Checkpoint**: Profile tab opens for any tenant with no subdomain row. All other profile fields render correctly.

---

## Phase 5: User Story 3 — Suspend and reactivate a tenant reliably (Priority: P1)

**Goal**: Suspend and Reactivate actions execute without error, the detail sheet stays open with the updated status badge, and the list row reflects the new status after navigating back.

**Independent Test**: Suspend an active tenant from the Danger tab → sheet stays open → StatusBadge in sheet header changes to "Suspended" → Danger tab button label changes to "Reactivate" → close sheet → list row shows "Suspended" status → reactivate → sheet and list both reflect "Active".

### Implementation for User Story 3

- [ ] T011 [US3] Fix `suspendMut.onSuccess` in `frontend/src/admin/pages/Schools.tsx` (line 142) — replace `setSelected(null)` with an in-place status update: `setSelected((s) => s ? { ...s, status: 'suspended' } : s);` followed by `qc.invalidateQueries({ queryKey: ['platform-tenants'] });` and `toast.success('Tenant suspended');`
- [ ] T012 [US3] Fix `reactivateMut.onSuccess` in `frontend/src/admin/pages/Schools.tsx` (line 147) — same pattern: replace `setSelected(null)` with `setSelected((s) => s ? { ...s, status: 'active' } : s);` followed by list invalidation and success toast
- [ ] T013 [US3] Fix `suspendMut.onError` in `frontend/src/admin/pages/Schools.tsx` (line 143) — replace the generic `toast.error(e.message ?? "Failed")` with a descriptive message: `toast.error(e.message ?? 'Failed to suspend tenant — please try again')`
- [ ] T014 [US3] Fix `reactivateMut.onError` in `frontend/src/admin/pages/Schools.tsx` (line 149) — same: `toast.error(e.message ?? 'Failed to reactivate tenant — please try again')`
- [ ] T015 [US3] Remove the inline suspend/reactivate quick-action `DropdownMenuItem` calls from the row dropdown in `frontend/src/admin/pages/Schools.tsx` (lines 351–359) that call `reactivateMut.mutate(s.id)` / `suspendMut.mutate(s.id)` directly without confirmation — these bypass the Danger tab confirmation flow; replace them with `onClick={() => setSelected(s)` (open detail sheet) so all lifecycle actions go through the sheet

**Checkpoint**: Suspend an active tenant — sheet stays open, StatusBadge updates, list row reflects change on next render. Reactivate — same in reverse. Error toasts show descriptive messages.

---

## Phase 6: User Story 4 — Delete tenant with full safeguards (Priority: P2)

**Goal**: Backend delete refuses on any financial record (payments, charges, invoices, billing events). Frontend shows a multi-step name-confirmation dialog. Refused deletes are audit-logged.

**Independent Test**: Attempt to delete a tenant with subscription invoices → 409 received → dialog shows refusal message with suspension suggestion. Delete a clean tenant → type exact school name → confirm → tenant removed from list → audit log entry present for the deletion.

### Implementation for User Story 4

- [ ] T016 [US4] Extend the `delete()` method in `backend/app/Controllers/Platform/TenantsController.php` (lines 192–198) — add `subscription_invoices` and `billing_events` table checks alongside the existing `payments` and `charges` checks:
  ```php
  $hasInvoices = $db->table('subscription_invoices')->where('tenant_id', $id)->countAllResults() > 0;
  $hasEvents   = $db->table('billing_events')->where('tenant_id', $id)->countAllResults() > 0;
  if ($hasPayments || $hasCharges || $hasInvoices || $hasEvents) { ... }
  ```
- [ ] T017 [US4] Add audit log call for refused deletes in `backend/app/Controllers/Platform/TenantsController.php` — before the 409 return, add `AuditService::logFromRequest('platform.tenant.delete_refused', 'tenant', $id, ['name' => $tenant['name']]);` so all delete attempts (refused and succeeded) are logged per FR-036
- [ ] T018 [US4] Update the 409 error message in `backend/app/Controllers/Platform/TenantsController.php` to match the contract: `'Cannot delete tenant with existing financial records. Consider suspending this tenant instead.'` (currently missing the suspension guidance)
- [ ] T019 [US4] Add `deleteDialogOpen` (boolean) and `deleteConfirmName` (string) state variables to `frontend/src/admin/pages/Schools.tsx` — place alongside existing state declarations (lines 80–85)
- [ ] T020 [US4] Add `deleteError` (string | null) state variable to `frontend/src/admin/pages/Schools.tsx` for showing the 409 refusal message inline in the dialog
- [ ] T021 [US4] Update `deleteMut` in `frontend/src/admin/pages/Schools.tsx` (lines 152–156) — change `onSuccess` to also close the delete dialog and clear confirm name; change `onError` to check for 409 status and set `deleteError` with `e.response?.data?.message` (shown inline in dialog) rather than a toast for refusal errors; non-409 errors still show a `toast.error`
- [ ] T022 [US4] Replace the `confirm()` delete call in the row dropdown `DropdownMenuItem` in `frontend/src/admin/pages/Schools.tsx` (line 364) — change it to `onClick={() => { setSelected(s); setDeleteDialogOpen(true); }}` so delete always flows through the detail sheet's dialog
- [ ] T023 [US4] Replace the `confirm()` delete button in the Danger tab in `frontend/src/admin/pages/Schools.tsx` (lines 491–499) with a `Button` that sets `setDeleteDialogOpen(true)` and `setDeleteConfirmName('')` and `setDeleteError(null)` — the actual confirmation is handled by the new dialog
- [ ] T024 [US4] Add a controlled `Dialog` component for delete confirmation in `frontend/src/admin/pages/Schools.tsx` — rendered outside the Sheet, controlled by `deleteDialogOpen`. Dialog content: title "Delete [school name]?", description warning about irreversibility, an `Input` bound to `deleteConfirmName` with placeholder "Type the school name to confirm", a conditional error `Alert` showing `deleteError` when set (with a note to "Consider suspending instead"), and a confirm `Button` that is `disabled` when `deleteConfirmName !== selected?.name || deleteMut.isPending` — on click calls `deleteMut.mutate(selected.id)`

**Checkpoint**: Backend refuses delete for any tenant with payments, charges, invoices, or billing events with a 409. Frontend dialog requires exact name match. Refused deletes are audit-logged. Successful delete removes tenant from list.

---

## Phase 7: User Story 5 — View and download tenant invoices from Schools page (Priority: P2)

**Goal**: Billing tab shows the full invoice list for the selected tenant with status badges and a PDF download button per row. Download uses the platform-admin JWT directly.

**Independent Test**: Open detail sheet for a tenant with invoices → Billing tab → all invoices listed with invoice number, amount, status badge, date → click download on any row → browser downloads a PDF → no impersonation flow triggered.

### Implementation for User Story 7

- [ ] T025 [P] [US5] Create `frontend/src/admin/components/admin/TenantBillingTab.tsx` — new component accepting `tenantId: string` prop. Uses `useQuery` with key `['platform', 'tenant-invoices', tenantId, statusFilter]` calling `getTenantInvoices(tenantId, { status: statusFilter })`. Renders: a status filter `Select` (All / Paid / Pending / Failed / Refunded), a table with columns (Invoice #, Amount, Status, Date, Download), a `StatusBadge` for `payment_status`, a download `Button` per row with a `Download` icon, an empty state `<p>` when no invoices, and an error retry state when the query fails
- [ ] T026 [US5] Implement the download handler in `TenantBillingTab.tsx` — on click calls `downloadInvoicePdf(invoice.id)` from `platform.ts`, receives a Blob, creates an object URL with `URL.createObjectURL`, triggers a programmatic `<a>` click with `download="invoice-{invoice.invoice_number}.pdf"`, then revokes the URL. Wraps in try/catch: on error shows `toast.error('Failed to download invoice')`
- [ ] T027 [US5] Add `tenantInvoices` method to `backend/app/Controllers/Platform/TenantsController.php` — new public method `tenantInvoices($id = null)` that: checks `canManageTenants`, looks up the tenant (returns 404 if not found), uses `getPaginationParams(20, 100)`, queries `subscription_invoices si` joined with `subscription_payment_transactions spt` on `si.transaction_id`, selects `si.id, si.invoice_number, (si.amount_cents/100) AS amount, si.currency, si.issued_at, spt.status AS payment_status`, filters by `si.tenant_id = $id`, optionally filters by `spt.status` from query param, orders by `si.issued_at DESC` (or ASC per `dir` param), returns paginated response via `$this->success(...)` with `buildPaginationMeta`
- [ ] T028 [US5] Replace the static Billing tab content in `frontend/src/admin/pages/Schools.tsx` (lines 451–467) with `<TenantBillingTab tenantId={selected.id} />` — import `TenantBillingTab` at the top of `Schools.tsx`
- [ ] T029 [US5] Add integration test for `tenantInvoices()` endpoint in `backend/tests/Controllers/Platform/TenantsControllerTest.php` — test: (a) returns 200 with correct invoice fields and `payment_status` for a tenant with invoices; (b) returns 200 with empty array for a tenant with no invoices; (c) returns 404 for a non-existent tenant ID; (d) returns 403 for a Finance-role token (Finance role cannot call tenant management endpoints)

**Checkpoint**: Billing tab in detail sheet shows full invoice list with status badges. Download button fetches PDF using platform-admin JWT. Empty state shown for tenants with no invoices. Error toast shown on download failure.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Clean up residual issues and verify the complete feature end-to-end.

- [ ] T030 [P] Remove the `subdomain` field from the `Add school` dialog form validation in `frontend/src/admin/pages/Schools.tsx` (line 212) — the `disabled` condition currently includes `!form.subdomain`; since subdomain is still required by the backend `store()` method, keep the form field but evaluate whether to surface it or auto-generate it. If keeping the field, this task is a no-op (verified); if hiding it, remove the form field and the disabled condition guard
- [ ] T031 [P] Audit all `toast.error` calls in `frontend/src/admin/pages/Schools.tsx` that currently read `e.message ?? "Failed"` — replace with specific descriptive fallbacks: suspend → `'Failed to suspend tenant'`, reactivate → `'Failed to reactivate tenant'` (already done in T013/T014; this task verifies no other generic "Failed" toasts remain in the file)
- [ ] T032 Run the full quickstart.md verification checklist (`specs/042-admin-schools-page/quickstart.md`) covering all 5 gaps — check each item in the verification checklist and confirm all pass before closing the feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS US4 and US5 (new route + API function)
- **US1 (Phase 3)**: Can start after Phase 1; independent of Phase 2
- **US2 (Phase 4)**: Can start after Phase 1; independent of Phase 2 and US1
- **US3 (Phase 5)**: Can start after Phase 1; independent of Phase 2, US1, US2
- **US4 (Phase 6)**: Depends on Phase 2 completion (route registered); independent of US1–US3
- **US5 (Phase 7)**: Depends on Phase 2 completion (route + API function); independent of US1–US4
- **Polish (Phase 8)**: Depends on all US phases complete

### User Story Dependencies

- **US1, US2, US3**: All P1 — fully independent of each other, can start immediately after Phase 1
- **US4, US5**: Both P2 — depend on foundational route/API additions from Phase 2, independent of each other

### Within Each User Story

- Backend changes before frontend wiring (e.g., T027 before T028 for US5)
- State additions before mutation handlers (T019/T020 before T021 for US4)
- Component creation before integration (T025 before T028 for US5)

---

## Parallel Opportunities

### P1 stories (after Phase 1 complete):
```
US1 (T005–T007) ─┐
US2 (T008–T010) ─┤ all in parallel — different files, same backend controller section
US3 (T011–T015) ─┘
```

### P2 stories (after Phase 2 complete, P1 stories complete):
```
US4 backend (T016–T018) ─┐ parallel with each other
US5 backend (T027)       ─┘

US4 frontend (T019–T024) ─┐ after backend confirmed
US5 frontend (T025–T026)  ─┤ T025 [P] — TenantBillingTab can be built before backend is live
                           └─ T028 wires them together
```

---

## Implementation Strategy

### MVP First (P1 user stories only — US1, US2, US3)

1. Complete Phase 1: Setup
2. Complete Phase 3: US1 (list cleanup)
3. Complete Phase 4: US2 (profile cleanup)
4. Complete Phase 5: US3 (suspend/reactivate fix)
5. **STOP and VALIDATE**: All three P1 stories testable independently
6. Demo / deploy P1 improvements

### Full Delivery (add P2 stories)

6. Complete Phase 2: Foundational (new route + API function)
7. Complete Phase 6: US4 (delete safeguards) and Phase 7: US5 (invoice access) — can run in parallel
8. Complete Phase 8: Polish
9. Run complete quickstart.md verification checklist

---

## Notes

- [P] tasks have different target files or are fully independent — safe to run in parallel
- Backend controller changes (T005, T008, T016–T018, T027) all touch `TenantsController.php` — execute sequentially
- `Schools.tsx` changes across US1–US4 (T006–T007, T009–T010, T011–T015, T019–T024, T028) all touch the same file — execute sequentially within their phases but phases themselves are independent in intent
- `TenantBillingTab.tsx` (T025–T026) is a new file — fully parallel with `Schools.tsx` changes
- The `subdomain` field in the Add School form (T030) requires a product decision: keep it (backend requires it) or auto-generate it — resolve before implementing T030
- Commit after each checkpoint phase to preserve a clean rollback point

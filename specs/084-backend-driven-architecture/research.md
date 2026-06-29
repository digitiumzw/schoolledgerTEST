# Research: Backend-Driven Architecture (Feature 084)

## 1. Current State Audit

### 1.1 Staff Module

**Backend — `StaffController::index()`**
- Calls `StaffModel::getByTenant($tenantId)` which is `WHERE tenant_id = ?` with no filter, sort, or limit
- Returns ALL staff records for the tenant as a flat array
- No pagination metadata in response

**Frontend — `Staff.tsx`**
- Uses raw `useEffect + useState` (NOT React Query)
- Loads full staff list once on mount via `api.getStaff()`
- Applies `useMemo` local filter across search, department, teaching type, employment status
- Applies `Array.slice` for in-memory page splitting (`ITEMS_PER_PAGE = 10`)
- Page state resets via `useEffect` watching filter changes

**Decision**: Full backend migration required. `StaffController::index()` must accept and apply
all filter/sort/page/limit params server-side. `Staff.tsx` must be migrated to React Query.

---

### 1.2 Fee Campaigns Module

**Backend — `FeeCampaignController::index()`**
- Accepts `status` GET param; passes to `FeeCampaignModel::getByTenant($tenantId, $status)`
- Backend filter already exists ✅
- **N+1 issue**: `getSummary($c['id'], $tenantId)` is called inside a PHP `foreach` loop, issuing one separate SQL query per campaign
- No pagination or sorting

**Frontend — `FeeCampaigns.tsx` + `useFeeCampaigns` hook**
- Uses `useState + useCallback` (NOT React Query)
- On filter change, calls `loadCampaigns(status)` which re-fetches from backend — backend filter is used ✅
- BUT initial load always calls `loadCampaigns()` (all statuses), and the filtered view in JSX is `campaigns.filter((c) => c.status === statusFilter)` applied client-side before `loadCampaigns(status)` completes
- Renders progress percentage `Math.round((s.totalCollected / s.totalExpected) * 100)` in frontend — acceptable presentation calculation, not a business computation

**Decision**: Fix N+1 with a batch `getSummariesByCampaignIds()` query in `FeeCampaignModel`.
Eliminate the local `.filter()` call in `FeeCampaigns.tsx`. Migrate hook to React Query.
Add `page`, `limit`, `sortBy`, `sortOrder` params for future scale but no breaking changes.

---

### 1.3 Transport Module

**Backend — `TransportController::getRoutes()`**
- Accepts `search` GET param with `LIKE` on `route_name` ✅
- No pagination, no sorting params
- After fetching routes: runs two more queries (stops and active periods) via batch IN queries — no N+1 ✅

**Backend — `TransportVehicleController::index()`**
- Accepts `search` GET param ✅
- After fetch: runs one more query for allocation counts via batch IN — no N+1 ✅

**Backend — `TransportDriverController`** (inferred from pattern)
- Likely accepts `search` param ✅
- No pagination

**Frontend — `Transport.tsx`**
- Uses raw `useEffect + useCallback` (NOT React Query)
- Passes `debouncedSearchTerm` to backend ✅
- Sets `filteredRoutes = routes`, `filteredVehicles = vehicles`, `filteredDrivers = drivers` (no local filtering)
- No pagination UI; all results displayed at once

**Decision**: Add `page`, `limit`, `sortBy`, `sortOrder` params to routes, vehicles, drivers endpoints.
Return pagination metadata. Migrate `Transport.tsx` to React Query. Transport already has no N+1 — minimal backend changes needed.

---

### 1.4 Real-Time Polling

**Current React Query configuration** (from `App.tsx`):
```js
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,        // 2 min
      gcTime: 5 * 60 * 1000,           // 5 min
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {...}
    },
    mutations: { retry: false },
  },
});
```

No global `refetchInterval` is set. `refetchOnWindowFocus: true` means data refreshes when
tab regains focus — this is partial but not sufficient for real-time multi-user updates.

**Decision**: Add `refetchInterval: 30 * 1000` to global QueryClient defaults. This means every
active React Query query on a focused page will re-fetch every 30 seconds automatically.
Pages not yet on React Query (Staff, FeeCampaigns, Transport) will benefit once migrated.
The 2-minute `staleTime` must be reduced to avoid suppressing the polling refresh — set `staleTime: 0` 
when `refetchInterval` is active, OR reduce global staleTime to match the polling window.
**Chosen approach**: Keep `staleTime: 30_000` (match polling interval) so background refetches
are not suppressed by stale-time guard.

---

## 2. Architecture Decisions

### Decision 1: Staff paginated query pattern
- **Chosen**: New `getFiltered()` method on `StaffModel` using query builder with conditional
  `WHERE`, `LIKE`, `ORDER BY`, `LIMIT/OFFSET`, plus a `COUNT(*)` companion query for total.
- **Rationale**: Consistent with existing `StudentsOptimizedController` pattern (Feature 066/074).
  Keeps controller thin; model owns all query construction.
- **Alternative rejected**: Full-text search via MySQL FULLTEXT index — overkill for staff name search.

### Decision 2: Fee Campaign N+1 fix
- **Chosen**: Add `getSummariesByCampaignIds(array $ids, string $tenantId): array` to
  `FeeCampaignModel` using a single `GROUP BY fee_campaign_id` SQL query, returning a keyed map.
  `FeeCampaignController::index()` replaces the per-campaign `getSummary()` loop with one call.
- **Rationale**: Reduces N queries to 2 total (campaigns list + summaries batch). Mirrors
  existing `preloadLedgerBalancesForIds` pattern in `StudentModel`.
- **Alternative rejected**: Subquery in the campaigns query itself — harder to maintain and test.

### Decision 3: Transport pagination
- **Chosen**: Add `page`, `limit`, `sortBy`, `sortOrder` params to `TransportController::getRoutes()`,
  `TransportVehicleController::index()`, and `TransportDriverController::index()`. Apply LIMIT/OFFSET
  in each controller's query builder call before the stop/period enrichment queries (which use IN).
- **Rationale**: Stops/periods enrichment already uses batch IN queries — pagination does not break them.
  Only the primary row set shrinks; the IN query naturally covers only the paginated IDs.
- **Alternative rejected**: Separate dedicated transport query model — unnecessary abstraction for 3 small endpoints.

### Decision 4: React Query migration for Staff / FeeCampaigns / Transport
- **Chosen**: Replace `useEffect + useState` data-fetching with `useQuery` in each page.
  Custom hooks: `useStaff()`, `useFeeCampaignsList()`, `useTransportCatalogue()`.
- **Rationale**: React Query provides automatic `refetchInterval`, `placeholderData keepPreviousData`,
  `isLoading`/`isFetching` states, and `queryClient.invalidateQueries` after mutations — all needed
  for mutation loading states (Principle XII) and real-time polling (US4).
- **Alternative rejected**: Retaining manual polling via `setInterval` in `useEffect` — circumvents
  React Query caching, deduplication, and window-focus refetch.

### Decision 5: Global polling interval
- **Chosen**: Add `refetchInterval: 30_000` and reduce `staleTime` to `30_000` in global QueryClient
  defaults.
- **Rationale**: 30s keeps data fresh for multi-user school environments without excessive API load.
  staleTime must be ≤ refetchInterval to prevent the stale guard from skipping background fetches.
- **Alternative rejected**: Per-page override only — too fragmented, easy to miss new pages.

### Decision 6: Performance indexes for Staff table
- **Chosen**: New optional migration adding indexes on `staff(tenant_id, employment_status)` and
  `staff(tenant_id, department)` and `staff(tenant_id, is_teaching)` for the new filter queries.
- **Rationale**: Without indexes, department/employment_status filter adds a full table scan per
  tenant. Staff table can grow to hundreds of rows; composite indexes with tenant_id are efficient.
- **Alternative rejected**: No migration — acceptable at small scale but violates Principle XI which
  requires index evidence for high-volume endpoints.

### Decision 7: No new schema tables
- **Chosen**: No new database tables. All changes are query-layer and application-layer.
- **Rationale**: Feature 084 is a refactoring feature, not a data-model expansion. All required
  data already exists in `staff`, `fee_campaigns`, `campaign_students`, `transport_routes`,
  `transport_vehicles`, `transport_drivers` tables.

---

## 3. Integration Points

| Module | Backend changes | Frontend changes |
|--------|----------------|-----------------|
| Staff | `StaffModel::getFiltered()`, `StaffController::index()` refactored | `Staff.tsx` → React Query; new `useStaffQuery` hook |
| Fee Campaigns | `FeeCampaignModel::getSummariesByCampaignIds()`, `FeeCampaignController::index()` N+1 fix | `useFeeCampaigns` → React Query; remove local `.filter()` |
| Transport | Add `page`/`limit`/`sortBy`/`sortOrder` to 3 controllers | `Transport.tsx` → React Query; new `useTransportCatalogue` hook |
| All pages | — | `App.tsx`: add `refetchInterval: 30_000`, `staleTime: 30_000` to QueryClient defaults |
| Optional | New migration: staff filter indexes | — |

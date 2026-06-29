# Research: Subscriptions Operations Dashboard

**Branch**: `079-subscriptions-ops-dashboard`  
**Date**: 2026-05-21

## Decision 1: Where to add new KPI fields (failed_payments_count, renewals_due_count, monthly_churn_count)

**Decision**: Extend `FinanceController::summary()` — not the `DashboardController::kpis()`.

**Rationale**: `getFinanceSummary()` in `platform.ts` is already called from `Subscriptions.tsx` for MRR. Adding three more fields to the same endpoint avoids a new request and keeps financial/operational KPIs co-located. `DashboardController::kpis()` serves the platform _Dashboard_ page KPIs (total tenants, suspended tenants, etc.) — mixing subscription ops metrics there would muddy its purpose.

**Alternatives considered**:
- New dedicated endpoint `GET /api/platform/subscriptions/kpis` — rejected; over-engineering for 3 extra SQL counts, introduces unnecessary route.
- Add to `DashboardController::kpis()` — rejected; wrong semantic boundary; dashboard page already consumes this and doesn't need ops data.

**Implementation**: Three additional fields added to the `summary()` response:
```json
{
  "failed_payments_count": 3,
  "renewals_due_count": 7,
  "monthly_churn_count": 2
}
```
- `failed_payments_count`: `COUNT(DISTINCT ss.tenant_id)` where the subscription has status = `active` and its latest payment transaction has status = `failed`. Derived via a correlated subquery on `subscription_payment_transactions` joined to `school_subscriptions`.
- `renewals_due_count`: `COUNT(*)` from `school_subscriptions` where `status = 'active'` AND `expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)`.
- `monthly_churn_count`: `COUNT(*)` from `school_subscriptions` where `cancelled_at` is in the current calendar month (`YEAR(cancelled_at) = YEAR(NOW()) AND MONTH(cancelled_at) = MONTH(NOW())`).

---

## Decision 2: How to enrich subscription list rows with payment_status, max_students, and alerts

**Decision**: Extend `SubscriptionsController::index()` to LEFT JOIN `subscription_payment_transactions` (latest per subscription) and `subscription_plans.max_students`, and compute `alerts` array in PHP before return.

**Rationale**: The existing `index()` query already joins `subscription_plans` — adding `sp.max_students` to the SELECT is trivial. For `payment_status`, the latest transaction per subscription can be fetched in a single correlated subquery or a lateral join. The `alerts` array (e.g., `["payment_failed", "expiring_soon"]`) is cheapest to assemble in PHP from fields already selected, avoiding N+1 per-row queries.

**Alternatives considered**:
- Separate `/subscriptions/:id/payment-status` endpoint per row — rejected; N+1 anti-pattern (Principle XI).
- Materializing `payment_status` as a column on `school_subscriptions` — rejected; requires migration and introduces denormalization risk.

**Implementation strategy**: Add correlated subquery for latest transaction status:
```sql
(
  SELECT spt.status
  FROM subscription_payment_transactions spt
  WHERE spt.subscription_id = ss.id
  ORDER BY spt.created_at DESC
  LIMIT 1
) AS payment_status
```
Then in PHP, compute alerts array:
```php
$row['alerts'] = [];
if ($row['payment_status'] === 'failed') $row['alerts'][] = 'payment_failed';
if ($row['status'] === 'trialing' || $row['status'] === 'trial') $row['alerts'][] = 'trial_ending';
if ($row['expires_at'] && strtotime($row['expires_at']) <= strtotime('+30 days')) $row['alerts'][] = 'expiring_soon';
```

**Key finding**: `subscription_payment_transactions` table has a `subscription_id` foreign key column and `status` column (values: `initiated`, `failed`, `completed`). Verified from `FinanceController::invoices()` which joins it via `spt.id = si.transaction_id` — however this is invoice-level; the direct link may be `subscription_id` on the transactions table. Will confirm in implementation and fall back to invoice JOIN if needed.

---

## Decision 3: Server-side search and filter parameter strategy

**Decision**: Add five new optional `GET` query parameters to `SubscriptionsController::index()`: `q` (search by school name/email), `plan_id`, `billing_cycle`, `payment_status`, and `expiring_soon` (boolean). All applied as SQL `WHERE` clauses before `countAllResults()` and the paginated fetch.

**Rationale**: Pattern already established in `TenantsController::index()` which accepts `q`, `status`, and `plan` query params and applies them to the same query builder. Consistent with Principle XI — all filtering server-side.

**Search field**: Match on `t.name LIKE '%q%' OR t.email LIKE '%q%'` (school name and email). CodeIgniter's `like()` method is parameterized — no SQL injection risk.

**Filter `expiring_soon`**: When truthy, adds `WHERE ss.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)`.

**Filter `payment_status`**: Requires joining the payment transactions subquery. When this filter is active, the correlated subquery becomes a JOIN condition:
```sql
WHERE (SELECT status FROM subscription_payment_transactions WHERE subscription_id = ss.id ORDER BY created_at DESC LIMIT 1) = 'failed'
```

**Debounce**: Implemented frontend-only (no backend concern). A 400 ms `useDebounce` hook already exists in the tenant-facing app (`frontend/src/hooks/useDebounce.ts`) — the same pattern will be used in `Subscriptions.tsx`.

---

## Decision 4: Price formatting helper

**Decision**: Introduce a pure formatting function `formatPrice(cents: number, cycle: 'mo' | 'yr'): string` in `Subscriptions.tsx` (or a shared util). Logic:
- If `cents === 0` → `"Free"`
- Else → format `cents / 100` using `Number.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })` + `/mo` or `/yr`

This produces `$25/mo`, `$9.99/mo`, `$240/yr`, and `Free` as required.

**Alternatives considered**:
- Using `toFixed(2)` everywhere — rejected; produces `$25.00/mo`.
- Using `Intl.NumberFormat` with `style: 'currency'` — rejected; always shows 2 decimal places for USD by default without custom configuration.

---

## Decision 5: Sidebar active-state visual prominence

**Decision**: The `AppSidebar.tsx` uses `SidebarMenuButton` with `isActive` prop from shadcn/ui's sidebar component. The active state is rendered by the shadcn `SidebarMenuButton` using CSS data attributes (`data-active`). To make it more prominent, we add a custom class override: active items get `bg-sidebar-accent text-sidebar-accent-foreground font-semibold` with a left border accent (`border-l-2 border-primary`).

**Rationale**: The `isActive` logic is already correct — `currentPath.startsWith(path)`. The visual weight needs increasing. A left border accent + slightly stronger background and bold text is a standard ops-dashboard active-nav pattern that works within shadcn's sidebar primitives.

**Implementation**: Add `className` to `SidebarMenuButton` that applies stronger active styling via `cn()` and the `isActive` boolean.

---

## Decision 6: KPI card icon mapping

| KPI | Icon | Tone |
|-----|------|------|
| Active Schools | `Building2` (schools) | success (green) |
| MRR | `DollarSign` or `TrendingUp` | primary (blue) |
| Failed Payments | `AlertTriangle` | danger (red) |
| Renewals Due | `CalendarClock` or `RefreshCw` | warning (amber) |
| Monthly Churn | `TrendingDown` or `UserMinus` | danger/warning |
| Pricing Plans | `Layers` or `LayoutGrid` | info (teal) |

Using `Building2` (already imported in `AppSidebar.tsx`), and standard Lucide icons that already exist in the project.

---

## Decision 7: Row action menus on all statuses

**Decision**: Move the `DropdownMenu` outside the `s.status === 'active'` guard. Show the menu on all rows. Actions rendered conditionally based on status:
- All statuses: "Assign / Reassign Plan" (opens existing assign modal pre-populated with tenant)
- Active only: "Cancel subscription" (destructive)
- Expired/Cancelled/Superseded: "Re-activate" (opens assign modal)

**Rationale**: Currently non-active rows have no action affordance at all. Platform operators need to be able to re-assign cancelled or expired subscriptions without separately navigating to a different workflow.

**Implementation**: `DropdownMenu` rendered for every row. `canManageSubscriptions` role check applied server-side; frontend renders all actions but the cancel server call already guards roles.

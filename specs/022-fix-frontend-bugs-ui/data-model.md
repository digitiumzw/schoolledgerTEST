# Data Model: Fix Frontend Bugs and UI Inconsistencies

**Phase**: 1 — Design  
**Branch**: `022-fix-frontend-bugs-ui`  
**Date**: 2026-04-09

> **Note**: This feature has no new data entities or schema changes. The data model section documents the **UI state contracts** that must be consistently applied across all components.

---

## UI State Entity: ErrorState

Represents the shape of an in-page error condition, used by all pages with data fetches.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | Human-readable description of what failed |
| `onRetry` | `() => void` | Yes | Callback to re-trigger the failed fetch |
| `source` | `string` | No | Which data source failed (used on multi-fetch pages like Payments) |

**Rendering rule**: When `message` is non-null, display an `<Alert variant="destructive">` with the message and a `<Button variant="outline" size="sm">Retry</Button>`. The loading state and data state MUST be hidden when error is shown.

---

## UI State Entity: LoadingState

Represents the skeleton/spinner state shown while any fetch is in progress.

| Field | Type | Description |
|-------|------|-------------|
| `isLoading` | `boolean` | Derived from fetch status; controls visibility of skeleton |
| `scope` | `'page' \| 'tab' \| 'modal'` | Controls which skeleton variant is shown |

**Rendering rule**: Show a `<Skeleton>` block (shadcn/ui) matching the approximate shape of the content area. For tabs, each tab independently tracks its own loading state.

---

## UI State Entity: BalanceIndicator

Governs how financial balances are colored everywhere in the UI.

| Condition | Tailwind Classes | Meaning |
|-----------|-----------------|---------|
| `balance <= 0` | `text-green-600 dark:text-green-400` | Paid or credit |
| `balance > 0 && balance < (totalCharges * 0.5)` | `text-amber-600 dark:text-amber-400` | Partially paid |
| `balance >= (totalCharges * 0.5)` | `text-red-600 dark:text-red-400` | Significantly overdue |
| `balance === 0 && totalCharges === 0` | `text-muted-foreground` | No charges yet |

**Authority component**: `BalanceDisplay.tsx` is the single source of truth for this logic. All other components showing a balance MUST use `<BalanceDisplay>` rather than computing color classes inline.

---

## Component Contract: ButtonStandard

Defines the props standard for all `<Button>` usages.

| Context | `variant` | `size` | Notes |
|---------|-----------|--------|-------|
| Primary list-page action | *(default)* | *(default)* | "Add Student", "Add Staff", "Add Route" |
| Secondary / cancel | `"outline"` | *(default)* | In modal footers |
| Destructive | `"destructive"` | *(default)* | Delete confirmations |
| Table row icon action | `"ghost"` | `"icon"` | Edit/delete icons in table rows |
| Inline small action | `"outline"` or `"ghost"` | `"sm"` | "Add Stop" inside forms |

No `className` override for height/width on buttons. No `h-8 px-3` inline styles — use `size="sm"` instead.

---

## Component Contract: ModalStandard

Defines the structure and width for all `<Dialog>` components.

| Modal type | `className` on `DialogContent` | Example |
|------------|-------------------------------|---------|
| Simple single-column form | `max-w-lg` | RecordPaymentModal, DeleteConfirm |
| Multi-section / multi-tab form | `max-w-2xl` | StudentFormModal, StaffFormModal |
| Wide data display | `max-w-4xl` | PaymentHistoryModal (if needed) |

**Footer pattern** (all modals):
```tsx
<DialogFooter>
  <Button variant="outline" onClick={onClose}>Cancel</Button>
  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting ? 'Saving…' : 'Save'}
  </Button>
</DialogFooter>
```

Cancel is always left, Submit is always right. No custom flexbox layouts in modal footers.

---

## Component Contract: FormValidation

Defines Zod schema patterns for the three validated field types.

| Field | Zod pattern |
|-------|------------|
| Phone number | `.transform(v => v.replace(/[\s\-().]/g, '')).pipe(z.string().regex(/^\+?[0-9]{10,}$/))` |
| Hire date | `.refine(v => new Date(v) <= new Date(), { message: 'Cannot be in the future' })` |
| Date of birth (staff) | `.refine(v => { const age = (Date.now() - new Date(v).getTime()) / 31557600000; return age >= 16 && age <= 100; }, { message: 'Age must be between 16 and 100' })` |

---

## State Transitions: Page Error Recovery

```
LOADING → SUCCESS (data renders)
       ↘ ERROR (errorMessage set, loading hidden)
              → LOADING (user clicks Retry → retryCount incremented)
                     → SUCCESS
                     ↘ ERROR (message updated)
```

This applies to all pages with `useEffect` + Axios fetch patterns. React Query pages use the equivalent `isLoading → isSuccess / isError` state machine built into the hook.

# Frontend Contract: Subscription Proration UI

**Feature**: 036-subscription-proration  
**Framework**: React 18 + TypeScript + TailwindCSS + shadcn/ui

---

## Component: ProrationBreakdown

Displays proration calculation details before user confirms upgrade.

### Props Interface

```typescript
interface ProrationBreakdownProps {
  calculation: ProrationCalculation;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface ProrationCalculation {
  calculationId: string;
  originalPlan: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
  };
  newPlan: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
  };
  billingCycle: 'monthly' | 'annual';
  cycleDates: {
    startDate: string;  // ISO date
    endDate: string;
    daysInCycle: number;
    daysRemaining: number;
  };
  proration: {
    unusedValueCreditCents: number;
    proratedChargeCents: number;
    netAmountCents: number;
    isUpgrade: boolean;
    isDowngrade: boolean;
  };
  breakdown: {
    dailyRateOriginalCents: number;
    dailyRateNewCents: number;
    formula: string;
  };
}
```

### Visual Design

```
┌─────────────────────────────────────────────┐
│  Plan Change Summary                          │
├─────────────────────────────────────────────┤
│                                              │
│  Current Plan: Basic Plan ($100/mo)         │
│  New Plan: Pro Plan ($200/mo)               │
│                                              │
│  ─────────────────────────────────────────  │
│                                              │
│  Billing Cycle: Apr 1 - Apr 30 (30 days)    │
│  Days Remaining: 15 days                    │
│                                              │
│  ─────────────────────────────────────────  │
│                                              │
│  Credit for unused Basic Plan time:  -$50.00│
│  Charge for remaining Pro Plan time:  +$100.00│
│                                              │
│  ─────────────────────────────────────────  │
│  Net amount to charge today:           $50.00│
│                                              │
│  [Cancel]              [Confirm Upgrade]     │
│                                              │
└─────────────────────────────────────────────┘
```

### UX Requirements

1. **Currency Display**: Always show amounts in dollars.cents format (e.g., "$50.00")
2. **Negative Credits**: Downgrade credits shown as "Credit applied to account: $XX.XX"
3. **Zero Net**: If net is $0.00, display "No additional charge today"
4. **Formula Toggle**: Optional expand/collapse for "How is this calculated?"
5. **Loading State**: Show spinner during calculation fetch
6. **Error Handling**: Display error message inline with retry option

---

## Hook: useProration

Custom hook for proration calculation and upgrade initiation.

### Interface

```typescript
function useProration(): UseProrationReturn;

interface UseProrationReturn {
  // State
  calculation: ProrationCalculation | null;
  isLoading: boolean;
  error: ProrationError | null;
  
  // Actions
  calculateProration: (targetPlanId: string, billingCycle?: string) => Promise<void>;
  initiateUpgrade: (paymentMethod?: string) => Promise<UpgradeResult>;
  clearCalculation: () => void;
  
  // Derived
  canConfirm: boolean;
  isUpgrade: boolean;
  isDowngrade: boolean;
}

interface ProrationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface UpgradeResult {
  subscriptionId: string;
  transactionId: string;
  redirectUrl: string;
  ourReference: string;
}
```

### Usage Example

```tsx
function UpgradePage() {
  const { 
    calculation, 
    isLoading, 
    error, 
    calculateProration, 
    initiateUpgrade,
    clearCalculation 
  } = useProration();

  const handlePlanSelect = async (planId: string) => {
    await calculateProration(planId);
  };

  const handleConfirm = async () => {
    const result = await initiateUpgrade();
    window.location.href = result.redirectUrl;
  };

  if (isLoading) return <ProrationSkeleton />;
  if (error) return <ProrationError error={error} onRetry={clearCalculation} />;
  if (calculation) return <ProrationBreakdown calculation={calculation} onConfirm={handleConfirm} />;
  
  return <PlanSelector onSelect={handlePlanSelect} />;
}
```

---

## Hook: useCredits

Hook for checking and applying credit balance.

### Interface

```typescript
function useCredits(): UseCreditsReturn;

interface UseCreditsReturn {
  totalCreditsCents: number;
  credits: Credit[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

interface Credit {
  id: string;
  initialAmountCents: number;
  remainingAmountCents: number;
  reason: 'downgrade_proration' | 'upgrade_discount' | 'manual_adjustment';
  createdAt: string;
  expiresAt: string | null;
}
```

---

## API Integration

All API calls go through the centralized `subscriptionApi` module.

### subscriptionApi.ts

```typescript
export const subscriptionApi = {
  // Existing endpoints...
  
  // New proration endpoints
  calculateProration: (targetPlanId: string, billingCycle?: string) => 
    api.post<ProrationResponse>('/subscription/calculate-proration', { 
      targetPlanId, 
      billingCycle 
    }),
    
  initiateUpgrade: (calculationId: string, paymentMethod?: string) =>
    api.post<UpgradeResponse>('/subscription/upgrade-with-proration', {
      calculationId,
      paymentMethod
    }),
    
  getCredits: () =>
    api.get<CreditsResponse>('/subscription/credits'),
    
  getProrationHistory: (page?: number, perPage?: number) =>
    api.get<HistoryResponse>('/subscription/proration-history', {
      params: { page, perPage }
    })
};
```

---

## Route Integration

### New Routes

| Route | Component | Access |
|-------|-----------|--------|
| `/subscription/upgrade` | UpgradePage | admin, super_admin |
| `/subscription/upgrade/confirm` | ProrationConfirmation | admin, super_admin |
| `/subscription/credits` | CreditsPage | admin, super_admin, bursar |

### Existing Route Updates

`/subscription/plans` - Add "Change Plan" button that navigates to upgrade flow with pre-selected plan.

---

## State Management

### React Query Keys

```typescript
export const subscriptionKeys = {
  all: ['subscription'] as const,
  current: () => [...subscriptionKeys.all, 'current'] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  // New keys
  proration: (planId: string) => [...subscriptionKeys.all, 'proration', planId] as const,
  credits: () => [...subscriptionKeys.all, 'credits'] as const,
  prorationHistory: (page: number) => [...subscriptionKeys.all, 'proration-history', page] as const,
};
```

### Cache Invalidation

- After successful upgrade: Invalidate `subscriptionKeys.current()` and `subscriptionKeys.credits()`
- After credit applied: Invalidate `subscriptionKeys.credits()`

---

## Error Handling

### Error Display Components

```typescript
// DowngradeBlockedError.tsx
interface Props {
  studentCount: number;
  planLimit: number;
  onDismiss: () => void;
}

// CalculationExpiredError.tsx
interface Props {
  onRecalculate: () => void;
}

// PaymentFailedError.tsx
interface Props {
  onRetry: () => void;
  onCancel: () => void;
}
```

---

## Accessibility Requirements

1. All currency amounts read by screen readers with full words (e.g., "fifty dollars")
2. Focus trap in confirmation modal
3. Keyboard navigation for plan selection
4. Loading states announced via aria-live
5. Error messages linked to inputs via aria-describedby

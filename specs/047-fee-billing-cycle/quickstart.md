# Quickstart: Fee Structure Billing Cycle Configuration

**Branch**: `047-fee-billing-cycle` | **Date**: 2026-04-27

This guide describes how to implement, run, and verify the billing cycle feature end-to-end.

---

## Prerequisites

- Dev environment running (backend on CodeIgniter 4, frontend on Vite)
- Database migrations up to date: `php spark migrate`
- A seeded test tenant with an academic calendar and at least one active student

---

## Implementation Order

Work in this sequence to avoid breaking the running app mid-way:

### Step 1 — Backend: Tighten validation in `SettingsController`

**File**: `backend/app/Controllers/Api/SettingsController.php`  
**Change**: In `saveFeeStructure()`, update the valid types array:

```php
// BEFORE
$validStructureTypes = ['termly', 'monthly', 'annual'];

// AFTER
$validStructureTypes = ['termly', 'monthly'];
```

Test: `PUT /api/settings/fee-structure` with `structureType: "annual"` → expect HTTP 400.

---

### Step 2 — Backend: Add `calculateMonthlyInstallments()` helper to `LedgerController`

**File**: `backend/app/Controllers/Api/LedgerController.php`

Add a private method that, given a term's start date and end date strings plus a fee amount, returns an array of installment amounts:

```php
private function calculateMonthlyInstallments(
    string $termStart,
    string $termEnd,
    float $termFee
): array {
    [$sy, $sm] = array_map('intval', explode('-', substr($termStart, 0, 7)));
    [$ey, $em] = array_map('intval', explode('-', substr($termEnd,   0, 7)));

    $months = ($ey * 12 + $em) - ($sy * 12 + $sm) + 1;
    $months = max(1, $months);

    $termFeeCents = (int) round($termFee * 100);
    $baseCents    = intdiv($termFeeCents, $months);
    $lastCents    = $termFeeCents - ($baseCents * ($months - 1));

    $installments = [];
    $current      = new \DateTime($termStart);
    $current->modify('first day of this month');

    for ($i = 0; $i < $months; $i++) {
        $amount  = ($i === $months - 1) ? $lastCents / 100 : $baseCents / 100;
        $dueDate = $current->format('Y-m-01');
        $label   = $current->format('F Y'); // e.g., "January 2026"

        $installments[] = [
            'amount'  => $amount,
            'dueDate' => $dueDate,
            'label'   => $label,
        ];

        $current->modify('+1 month');
    }

    return $installments;
}
```

---

### Step 3 — Backend: Update `finalizeBilling()` to branch on billing cycle

**File**: `backend/app/Controllers/Api/LedgerController.php`  
**Method**: `finalizeBilling()`

After reading `$feeStructure` from the tenant, read the billing cycle:

```php
$billingCycle = $feeStructure['structureType'] ?? 'termly';
$termStart    = $termInfo['start'] ?? null;
$termEnd      = $termInfo['end']   ?? null;
```

Inside the per-student, per-fee loop, replace the current single-charge insert with:

```php
foreach ($defaultFees as $feeName => $defaultAmount) {
    $feeAmount = isset($studentOverrides[$feeName])
        ? (float) $studentOverrides[$feeName]
        : (float) $defaultAmount;

    $grossAmount = $feeAmount * $bursaryMultiplier;
    if ($grossAmount <= 0) continue;

    if ($billingCycle === 'monthly' && $termStart && $termEnd) {
        $installments = $this->calculateMonthlyInstallments($termStart, $termEnd, $grossAmount);
    } else {
        $installments = [[
            'amount'  => $grossAmount,
            'dueDate' => date('Y-m-d', strtotime('+30 days')),
            'label'   => $termName,
        ]];
    }

    foreach ($installments as $installment) {
        $chargeId = $this->generateId('c');
        $this->db->table('charges')->insert([
            'id'                  => $chargeId,
            'tenant_id'           => $tenantId,
            'student_id'          => $student['id'],
            'term_id'             => $termId,
            'academic_year'       => $academicYear,
            'billing_run_id'      => $billingRunId,
            'category'            => $feeName,
            'charge_type'         => 'fee_structure',
            'status'              => 'pending',
            'amount'              => $installment['amount'],
            'date_generated'      => date('Y-m-d'),
            'due_date'            => $installment['dueDate'],
            'academic_session'    => $academicYear,
            'term'                => $termName,
            'description'         => ($billingCycle === 'monthly')
                ? "{$feeName} – {$installment['label']}"
                : "{$feeName} - {$termName}",
            'generation_batch_id' => $billingRunId,
            'created_by'          => $user->id ?? 'system',
            'created_at'          => $now,
            'updated_at'          => $now,
        ]);
        $generatedCount++;
        $totalAmount += $installment['amount'];
    }
}
```

---

### Step 4 — Backend: Extend `getBillingPreview()` response

**File**: `backend/app/Controllers/Api/LedgerController.php`  
**Method**: `getBillingPreview()`

After computing `$defaultFeeTotal`, add:

```php
$billingCycle = $feeStructure['structureType'] ?? 'termly';
$installments = 1;
$installmentAmount = $defaultFeeTotal;

if ($billingCycle === 'monthly' && !empty($termInfo['start']) && !empty($termInfo['end'])) {
    [$sy, $sm] = array_map('intval', explode('-', substr($termInfo['start'], 0, 7)));
    [$ey, $em] = array_map('intval', explode('-', substr($termInfo['end'],   0, 7)));
    $installments = max(1, ($ey * 12 + $em) - ($sy * 12 + $sm) + 1);
    $installmentAmount = $defaultFeeTotal > 0
        ? (floor($defaultFeeTotal * 100 / $installments) / 100)
        : 0;
}
```

Then add to the `return $this->success([...])` array:

```php
'billingCycle'      => $billingCycle,
'installments'      => $installments,
'installmentAmount' => $installmentAmount,
```

---

### Step 5 — Frontend: Add billing cycle selector to `FeeStructureTab`

**File**: `frontend/src/hooks/useFeeStructure.ts`

The `structure` state already holds `structureType`. Add a setter:

```typescript
const updateBillingCycle = useCallback((cycle: 'termly' | 'monthly') => {
  if (!structure) return;
  setStructure({ ...structure, structureType: cycle });
}, [structure]);
```

Expose it in the return object and add it to `UseFeeStructureResult`.

**File**: `frontend/src/components/settings/FeeStructureTab.tsx`

Add a billing cycle selector above the `DefaultFeesEditor`. Use a `RadioGroup` or `Select` from shadcn/ui:

```tsx
<div className="space-y-2">
  <Label>Billing Cycle</Label>
  <p className="text-sm text-muted-foreground">
    How fees are charged to students each term.
  </p>
  <RadioGroup
    value={structure?.structureType ?? 'termly'}
    onValueChange={(v) => updateBillingCycle(v as 'termly' | 'monthly')}
    className="flex gap-6"
  >
    <div className="flex items-center gap-2">
      <RadioGroupItem value="termly" id="cycle-termly" />
      <Label htmlFor="cycle-termly">Termly — one charge per term</Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="monthly" id="cycle-monthly" />
      <Label htmlFor="cycle-monthly">Monthly — split across months in term</Label>
    </div>
  </RadioGroup>
</div>
```

**File**: `frontend/src/types/dashboard.ts`

Update `FeeStructure.structureType`:

```typescript
// BEFORE
structureType: 'termly' | 'monthly' | 'custom';

// AFTER
structureType: 'termly' | 'monthly';
```

---

### Step 6 — Frontend: Show billing cycle in `ChargeGenerationPanel`

**File**: `frontend/src/components/settings/ChargeGenerationPanel.tsx`

The panel already receives a `structure` prop. Add a billing cycle badge/note above the fee breakdown in the generate dialog:

```tsx
{structure && (
  <div className="text-sm text-muted-foreground">
    Billing cycle:{' '}
    <span className="font-medium text-foreground">
      {structure.structureType === 'monthly'
        ? `Monthly (installments per term)`
        : 'Termly'}
    </span>
  </div>
)}
```

The precise installment count comes from the billing preview API response — surface it when available via the `BillingPreview` type defined in the contracts.

---

### Step 7 — Integration Tests

**File**: `backend/tests/Controllers/Billing/BillingCycleTest.php`

Create a test class extending the project's `CIUnitTestCase + FeatureTestTrait` pattern (see `PlatformControllerTestCase` for the base pattern). Tests to include:

1. **Termly regression**: Generate charges with `structureType = "termly"` → expect 1 charge per student per fee category.
2. **Monthly happy path**: Generate with `structureType = "monthly"` for a 3-month term → expect 3 charges per student per fee category, correct amounts, correct due dates, correct descriptions.
3. **Monthly rounding**: Fee = $100, 3 months → charges of $33.33, $33.33, $33.34; sum = $100.00.
4. **Single-month term**: Term starts and ends in the same month → 1 installment = full fee.
5. **Duplicate prevention**: Generate twice → second call returns `alreadyGenerated: true`.
6. **Tenant isolation**: Tenant A charges are not visible to Tenant B.
7. **Invalid billing cycle**: `PUT /api/settings/fee-structure` with `structureType: "annual"` → 400.
8. **Bursary + monthly**: 50% bursary student in a 3-month term → each installment = half the base installment.

---

## Verification Checklist

After implementation, confirm:

- [ ] `GET /api/settings/fee-structure` returns `structureType: "monthly"` after saving
- [ ] `PUT /api/settings/fee-structure` with `structureType: "annual"` returns 400
- [ ] `GET /api/billing/preview?termId=...` includes `billingCycle`, `installments`, `installmentAmount`
- [ ] `POST /api/billing/finalize` under monthly mode inserts N×students×categories charge rows
- [ ] Sum of charge amounts per student per fee category = configured term fee (to the cent)
- [ ] Each monthly charge `due_date` is the 1st of its respective month
- [ ] Each monthly charge `description` contains the month name and year
- [ ] Voiding the billing run soft-deletes all installment charges
- [ ] Fee Structure settings page shows billing cycle selector, defaults to "Termly"
- [ ] Charge generation preview modal shows the billing cycle label
- [ ] All integration tests pass: `php spark test --filter BillingCycle`

# API Contract: Payment Status Check

**Feature**: 055-driver-kiosk-viewonly  
**Purpose**: Determine if a student has paid transport fees for the current billing period

## Overview

Payment status is calculated dynamically using the existing financial ledger tables (`charges` and `payments`). A student is considered "paid" if their total payments for transport charges in the current academic year are greater than or equal to the total transport charges assessed.

This follows the Constitution Principle V (Financial Ledger Integrity): balances are computed from source records, never cached.

---

## Payment Calculation Logic

### Algorithm

```php
function isTransportPaid(string $studentId, string $tenantId, string $academicYear): bool
{
    // Get all transport charges for student in academic year
    $totalCharges = $this->db->table('charges')
        ->where('student_id', $studentId)
        ->where('tenant_id', $tenantId)
        ->where('charge_type', 'transport')
        ->where('academic_year', $academicYear)
        ->selectSum('amount', 'total')
        ->get()
        ->getRow()
        ->total ?? 0;

    // Get all payments from student (optionally filtered by charge_id for transport)
    $totalPayments = $this->db->table('payments')
        ->where('student_id', $studentId)
        ->where('tenant_id', $tenantId)
        ->selectSum('amount', 'total')
        ->get()
        ->getRow()
        ->total ?? 0;

    return $totalPayments >= $totalCharges;
}
```

### Business Rules

1. **Transport Charges Only**: Only charges with `charge_type = 'transport'` are considered
2. **Current Academic Year**: Filtered by `academic_year` column matching current active year
3. **All Payments Count**: Student's total payments (not just transport-specific) count toward balance
4. **Zero Charge = Paid**: If no transport charges exist, student is considered paid (no fee assessed)
5. **Credit Carryover**: Any overpayment from previous terms counts toward current balance

### Edge Cases

| Scenario | Payment Status | Rationale |
|----------|---------------|-----------|
| No transport charges configured | `paid` | No fee assessed |
| Charges exist, no payments | `unpaid` | Outstanding balance |
| Partial payment (< 100%) | `unpaid` | Balance still owed |
| Full payment (100%) | `paid` | Balance settled |
| Overpayment (> 100%) | `paid` | Credit applied |
| Payment applied to different charge type | `paid` | Payments are fungible across student's account |

---

## Query Pattern

### Single Student Check

```sql
SELECT 
    s.id AS student_id,
    COALESCE(c.total_charges, 0) AS total_charges,
    COALESCE(p.total_payments, 0) AS total_payments,
    COALESCE(p.total_payments, 0) >= COALESCE(c.total_charges, 0) AS is_paid
FROM students s
LEFT JOIN (
    SELECT student_id, SUM(amount) AS total_charges
    FROM charges
    WHERE tenant_id = ?
      AND charge_type = 'transport'
      AND academic_year = ?
    GROUP BY student_id
) c ON c.student_id = s.id
LEFT JOIN (
    SELECT student_id, SUM(amount) AS total_payments
    FROM payments
    WHERE tenant_id = ?
    GROUP BY student_id
) p ON p.student_id = s.id
WHERE s.id = ?
  AND s.tenant_id = ?
```

### Bulk Check (Multiple Students)

```sql
SELECT 
    s.id AS student_id,
    COALESCE(c.total_charges, 0) AS total_charges,
    COALESCE(p.total_payments, 0) AS total_payments,
    COALESCE(p.total_payments, 0) >= COALESCE(c.total_charges, 0) AS is_paid
FROM students s
LEFT JOIN (
    SELECT student_id, SUM(amount) AS total_charges
    FROM charges
    WHERE tenant_id = ?
      AND charge_type = 'transport'
      AND academic_year = ?
    GROUP BY student_id
) c ON c.student_id = s.id
LEFT JOIN (
    SELECT student_id, SUM(amount) AS total_payments
    FROM payments
    WHERE tenant_id = ?
    GROUP BY student_id
) p ON p.student_id = s.id
WHERE s.id IN (?, ?, ?, ...)  -- Student IDs from roster
  AND s.tenant_id = ?
```

---

## Implementation in Driver Kiosk

### Service Method

```php
class DriverKioskService 
{
    /**
     * Get payment status for multiple students in bulk.
     * 
     * @param string[] $studentIds Array of student IDs
     * @param string $tenantId Tenant ID
     * @param string $academicYear Current academic year
     * @return array Map of student_id => 'paid'|'unpaid'
     */
    public function getStudentsPaymentStatus(
        array $studentIds,
        string $tenantId,
        string $academicYear
    ): array {
        if (empty($studentIds)) {
            return [];
        }

        // Get all transport charges for these students
        $charges = $this->db->table('charges')
            ->whereIn('student_id', $studentIds)
            ->where('tenant_id', $tenantId)
            ->where('charge_type', 'transport')
            ->where('academic_year', $academicYear)
            ->select('student_id, SUM(amount) as total')
            ->groupBy('student_id')
            ->get()
            ->getResultArray();

        $chargeMap = array_column($charges, 'total', 'student_id');

        // Get all payments from these students
        $payments = $this->db->table('payments')
            ->whereIn('student_id', $studentIds)
            ->where('tenant_id', $tenantId)
            ->select('student_id, SUM(amount) as total')
            ->groupBy('student_id')
            ->get()
            ->getResultArray();

        $paymentMap = array_column($payments, 'total', 'student_id');

        // Build result map
        $result = [];
        foreach ($studentIds as $studentId) {
            $charges = (float) ($chargeMap[$studentId] ?? 0);
            $payments = (float) ($paymentMap[$studentId] ?? 0);
            $result[$studentId] = $payments >= $charges ? 'paid' : 'unpaid';
        }

        return $result;
    }
}
```

### Integration with Roster Response

When `paid_only=true` query parameter is set:

1. Query all students for the route
2. Calculate payment status for each student
3. Filter to only `paid` students
4. Return filtered list

When `paid_only=false` (default):
1. Query all students for the route
2. Calculate payment status for each student
3. Include `paymentStatus` field in each student object
4. Return complete list with payment indicators

---

## Performance Considerations

### N+1 Prevention

Always use the **bulk query approach** rather than individual payment checks per student:

```php
// BAD - N+1 query problem
foreach ($students as $student) {
    $isPaid = checkPaymentStatus($student['id']); // Individual query per student
}

// GOOD - Bulk query
$paymentStatusMap = $service->getStudentsPaymentStatus(
    array_column($students, 'id'),
    $tenantId,
    $academicYear
);
foreach ($students as $student) {
    $isPaid = $paymentStatusMap[$student['id']] === 'paid';
}
```

### Index Usage

Ensure these indexes exist for optimal query performance:

```sql
-- On charges table
CREATE INDEX idx_charges_transport_lookup 
ON charges (tenant_id, charge_type, academic_year, student_id);

-- On payments table
CREATE INDEX idx_payments_student_lookup 
ON payments (tenant_id, student_id);
```

---

## Testing Scenarios

### Unit Test Cases

| Test Case | Setup | Expected Result |
|-----------|-------|-----------------|
| No charges | Student has no transport charges | `paid` |
| Fully paid | $100 charge, $100 payment | `paid` |
| Partially paid | $100 charge, $50 payment | `unpaid` |
| Overpaid | $100 charge, $150 payment | `paid` |
| Multiple charges | Two $50 charges, one $100 payment | `paid` |
| Cross-term payment | Current year charge, previous year payment | `unpaid` (payment filtered by academic_year) |

### Integration Test Cases

1. **Bulk calculation accuracy**: Verify 50 students' payment status calculated correctly in single query
2. **Tenant isolation**: Payments from other tenants don't affect calculation
3. **Route filter + payment filter**: `paid_only=true` correctly filters across multiple routes
4. **Empty roster**: No errors when route has no students

---

## Frontend Display Guidelines

### Paid Status Indicator

```tsx
// When paid_only=false, show status badge
<span className={student.paymentStatus === 'paid' 
  ? 'bg-green-100 text-green-800' 
  : 'bg-red-100 text-red-800'
}>
  {student.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
</span>
```

### Filter Toggle

```tsx
// Paid-only filter control
<Toggle 
  checked={paidOnly}
  onChange={setPaidOnly}
  label="Show paid students only"
/>

// Counter display
<p>{roster.paidCount} paid / {roster.totalCount} total</p>
```

---

## Compliance Notes

- **Principle I (Multi-Tenant)**: All payment queries filter by `tenant_id`
- **Principle V (Ledger Integrity)**: Payment status computed from source records, never cached
- **Principle X (Testing)**: Integration tests verify payment calculation accuracy and tenant isolation

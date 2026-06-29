# Quickstart: Fix Payment Module Bugs

**Feature**: Fix Payment Module Bugs  
**Branch**: `007-fix-payment-bugs`  
**Date**: April 6, 2026

## What This Fix Does

Resolves two critical bugs preventing payment operations:

1. **Null pointer exception** when recording payments - system crashes after saving payment
2. **Undefined array key "month"** when viewing payments - system crashes when displaying payment lists

## Quick Reference

### Files Modified

- `backend/app/Controllers/Api/PaymentController.php` - Add null check after payment insert (lines 140-147)
- `backend/app/Models/PaymentModel.php` - Use derived month value instead of database field (line 136)

### Testing Checklist

- [ ] Record a new payment via UI - should save without errors
- [ ] View Payments page - should load without crashes
- [ ] View student payment history - should display all payments with month values
- [ ] Check error logs - should show zero payment-related errors

## For Developers

### Setup

No special setup required - this is a bug fix to existing code.

```bash
# Ensure you're on the feature branch
git checkout 007-fix-payment-bugs

# Backend is already running
cd backend
php spark serve

# Frontend is already running
cd frontend
npm run dev
```

### Implementation Steps

#### Step 1: Fix PaymentController Null Check

**File**: `backend/app/Controllers/Api/PaymentController.php`

**Location**: Lines 140-142 (after transaction commit)

**Current Code**:
```php
$saved = $this->paymentModel->find($paymentId);
return $this->created($this->paymentModel->formatForApi($saved));
```

**Fixed Code**:
```php
$saved = $this->paymentModel->find($paymentId);
if (!$saved) {
    log_message('error', "[PaymentController::create] Payment inserted but not found: {$paymentId}");
    return $this->serverError('Payment was saved but could not be retrieved. Please refresh.');
}
return $this->created($this->paymentModel->formatForApi($saved));
```

#### Step 2: Fix PaymentModel Month Derivation

**File**: `backend/app/Models/PaymentModel.php`

**Location**: Line 136 in `formatForApi()` method

**Current Code**:
```php
return [
    'id' => $payment['id'],
    'tenantId' => $payment['tenant_id'],
    'studentId' => $payment['student_id'],
    'amount' => (float) $payment['amount'],
    'date' => $payment['date'],
    'method' => $payment['method'],
    'description' => $payment['description'] ?? '',
    'category' => $payment['category'],
    'month' => $payment['month'],  // ← BUG: Undefined array key
    'routeId' => $payment['route_id'],
];
```

**Fixed Code**:
```php
return [
    'id' => $payment['id'],
    'tenantId' => $payment['tenant_id'],
    'studentId' => $payment['student_id'],
    'amount' => (float) $payment['amount'],
    'date' => $payment['date'],
    'method' => $payment['method'],
    'description' => $payment['description'] ?? '',
    'category' => $payment['category'],
    'month' => $monthDerived,  // ← FIX: Use derived value from lines 122-125
    'routeId' => $payment['route_id'],
];
```

**Note**: The `$monthDerived` variable is already computed earlier in the method (lines 122-125), we just need to use it.

### Testing

#### Manual Test: Record Payment

1. Navigate to `http://localhost:8080/payments`
2. Click "Record Payment" button
3. Fill in form:
   - Student: Select any student
   - Amount: 100.00
   - Method: Cash
   - Date: Today
4. Click "Record Payment"
5. **Expected**: Success message, payment appears in list
6. **Previously**: TypeError crash

#### Manual Test: View Payments

1. Navigate to `http://localhost:8080/payments`
2. **Expected**: Payment list loads, all payments show month values
3. **Previously**: "Undefined array key 'month'" error

#### API Test: Create Payment

```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"1234"}' \
  | jq -r '.data.token')

# Create payment
curl -X POST http://localhost:8080/api/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "s_student_001",
    "amount": 150.00,
    "date": "2026-04-06",
    "method": "Cash",
    "description": "Test payment",
    "category": "Tuition"
  }'

# Expected: 201 Created with payment object
# Previously: 500 Internal Server Error
```

#### API Test: Get Recent Payments

```bash
curl -X GET http://localhost:8080/api/payments/recent \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array of payments with month field populated
# Previously: 500 error "Undefined array key 'month'"
```

### Verification

#### Check Error Logs

```bash
# View recent errors
tail -f backend/writable/logs/log-$(date +%Y-%m-%d).log

# Search for payment errors
grep -i "payment" backend/writable/logs/log-$(date +%Y-%m-%d).log | grep -i "error"

# Expected: No new payment-related errors after fix
```

#### Database Verification

```sql
-- Check for payments with null month field (legacy data)
SELECT id, date, month 
FROM payments 
WHERE month IS NULL 
LIMIT 10;

-- These should still display correctly in API responses
-- because month is derived from date field
```

## For QA/Testers

### Test Scenarios

#### Scenario 1: Record New Payment

**Steps**:
1. Login as bursar (bursar@greenwood.co.zw / 1234)
2. Go to Payments page
3. Click "Record Payment"
4. Select student "John Doe"
5. Enter amount: 200.00
6. Select method: EcoCash
7. Click "Record Payment"

**Expected Result**: 
- Success toast message appears
- Payment appears in the list immediately
- No errors in browser console
- No errors in server logs

#### Scenario 2: View Payment History

**Steps**:
1. Login as any user
2. Go to Payments page
3. Observe the payment list

**Expected Result**:
- All payments display correctly
- Month column shows values (1-12)
- No "undefined" or null values
- Page loads without errors

#### Scenario 3: View Student Payment History

**Steps**:
1. Go to Students page
2. Click on any student
3. Click "Payments" tab or "View History"

**Expected Result**:
- Student's payment history loads
- All payments show correct month values
- No errors or crashes

### Known Limitations

- This fix does not add new features
- Month values are derived at runtime, not stored in database
- Legacy payments with null month field will now show derived values

### Rollback Plan

If issues occur after deployment:

```bash
# Revert the changes
git checkout main -- backend/app/Controllers/Api/PaymentController.php
git checkout main -- backend/app/Models/PaymentModel.php

# Restart backend
cd backend
php spark serve
```

## For DevOps

### Deployment Steps

1. **Merge to main branch**
   ```bash
   git checkout main
   git merge 007-fix-payment-bugs
   ```

2. **Deploy backend** (no database migrations needed)
   ```bash
   cd backend
   composer install --no-dev
   # Restart PHP-FPM or web server
   ```

3. **No frontend changes** - frontend deployment not required

4. **Verify deployment**
   ```bash
   # Test payment creation endpoint
   curl -X POST https://production-url/api/payments \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"studentId":"...","amount":100,"date":"2026-04-06","method":"Cash"}'
   
   # Should return 201 Created, not 500 error
   ```

### Monitoring

**Metrics to watch**:
- Payment creation success rate (should be 100%)
- API error rate for `/api/payments/*` endpoints (should drop to 0)
- Response time for payment endpoints (should remain <500ms)

**Log alerts**:
- Alert on: "TypeError: App\Models\PaymentModel::formatForApi()"
- Alert on: "Undefined array key 'month'"
- Expected: Zero occurrences after deployment

### Database Impact

- **Schema changes**: None
- **Data migrations**: None
- **Indexes**: No changes
- **Downtime**: None required

## Summary

This is a low-risk bug fix with:
- ✅ No schema changes
- ✅ No data migrations
- ✅ No API contract changes
- ✅ No frontend changes
- ✅ Backward compatible with existing data
- ✅ Can be deployed without downtime

**Estimated implementation time**: 15 minutes  
**Estimated testing time**: 30 minutes  
**Risk level**: Low

# Quickstart: Subscription Proration

**Feature**: 036-subscription-proration  
**Setup Time**: ~15 minutes

---

## Prerequisites

- SchoolLedger backend running (PHP 8.1+, MySQL)
- SchoolLedger frontend running (Node.js 18+, React 18)
- Admin/super_admin role access
- Active subscription on current tenant

---

## 1. Database Setup

Run migrations to create proration tables:

```bash
cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend
php spark migrate
```

Verify migrations applied:
```bash
php spark migrate:status
```

Expected new migrations:
- `2026-04-16-100000_Create_proration_calculations_table`
- `2026-04-16-100001_Create_subscription_credits_table`
- `2026-04-16-100002_Create_credit_applications_table`

---

## 2. Backend Setup

### 2.1 Install ProrationService

Create `backend/app/Services/ProrationService.php` (see data-model.md for interface).

### 2.2 Add API Routes

Edit `backend/app/Config/Routes.php`, add within the `subscription` group:

```php
// Proration endpoints
$routes->post('calculate-proration', 'SubscriptionController::calculateProration');
$routes->post('upgrade-with-proration', 'SubscriptionController::upgradeWithProration');
$routes->get('credits', 'SubscriptionController::credits');
$routes->get('proration-history', 'SubscriptionController::prorationHistory');
```

### 2.3 Add Controller Methods

Edit `backend/app/Controllers/Api/SubscriptionController.php`:

```php
public function calculateProration() { /* ... */ }
public function upgradeWithProration() { /* ... */ }
public function credits() { /* ... */ }
public function prorationHistory() { /* ... */ }
```

---

## 3. Frontend Setup

### 3.1 Add API Client Methods

Edit `frontend/src/api/subscriptionApi.ts`:

```typescript
calculateProration: (targetPlanId: string, billingCycle?: string) =>
  api.post('/subscription/calculate-proration', { targetPlanId, billingCycle }),

initiateUpgrade: (calculationId: string, paymentMethod?: string) =>
  api.post('/subscription/upgrade-with-proration', { calculationId, paymentMethod }),

getCredits: () => api.get('/subscription/credits'),
```

### 3.2 Add React Query Hooks

Create `frontend/src/hooks/useProration.ts` (see frontend-contract.md).

### 3.3 Add ProrationBreakdown Component

Create `frontend/src/components/subscription/ProrationBreakdown.tsx`.

---

## 4. Testing the Flow

### 4.1 Calculate Proration

```bash
curl -X POST http://localhost:8080/api/subscription/calculate-proration \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "targetPlanId": "pro-plan-uuid",
    "billingCycle": "monthly"
  }'
```

Expected response includes:
- `unusedValueCreditCents`
- `proratedChargeCents`
- `netAmountCents`

### 4.2 Initiate Upgrade

```bash
curl -X POST http://localhost:8080/api/subscription/upgrade-with-proration \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "calculationId": "calc-uuid-from-step-1",
    "paymentMethod": "paynow"
  }'
```

Expected response includes:
- `redirectUrl` for payment
- `subscriptionId` and `transactionId`

---

## 5. Verification Checklist

- [ ] Database migrations applied successfully
- [ ] API routes return 200 for calculate-proration
- [ ] API routes return 201 for upgrade-with-proration
- [ ] Frontend displays proration breakdown
- [ ] Payment webhook activates new subscription
- [ ] Old subscription marked as `superseded`
- [ ] Billing event recorded as `plan_upgraded`
- [ ] Credit balance visible for downgrades

---

## 6. Common Issues

### "Calculation expired" error
Calculations expire after 30 minutes. Recalculate before confirming.

### "Downgrade blocked" error
Student count exceeds new plan limit. Reduce students or choose different plan.

### Credits not appearing
Check `subscription_credits` table has records with `tenant_id` matching JWT.

---

## 7. Next Steps

Run `/speckit.tasks` to generate implementation tasks for this feature.

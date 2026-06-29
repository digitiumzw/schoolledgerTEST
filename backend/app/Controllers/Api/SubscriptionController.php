<?php

namespace App\Controllers\Api;

use App\Models\SubscriptionPlanModel;
use App\Models\SchoolSubscriptionModel;
use App\Models\SubscriptionTransactionModel;
use App\Models\SubscriptionInvoiceModel;
use App\Models\BillingEventModel;
use App\Models\TenantModel;
use App\Models\UserModel;
use App\Models\ProrationCalculationModel;
use App\Models\SubscriptionCreditModel;
use App\Services\PaynowService;
use App\Services\InvoiceService;
use App\Services\BillingEventService;
use App\Services\ProrationService;
use App\Services\EmailService;
use App\Services\SubscriptionTransitionPolicy;

class SubscriptionController extends BaseApiController
{
    private SubscriptionPlanModel $planModel;
    private SchoolSubscriptionModel $subModel;
    private SubscriptionTransactionModel $txModel;
    private SubscriptionInvoiceModel $invoiceModel;
    private BillingEventModel $billingEventModel;
    private InvoiceService $invoiceService;
    private BillingEventService $billingEventService;
    private ProrationCalculationModel $prorationCalcModel;
    private SubscriptionCreditModel $creditModel;
    private ProrationService $prorationService;
    private SubscriptionTransitionPolicy $transitionPolicy;

    public function __construct()
    {
        $this->planModel            = new SubscriptionPlanModel();
        $this->subModel             = new SchoolSubscriptionModel();
        $this->txModel              = new SubscriptionTransactionModel();
        $this->invoiceModel         = new SubscriptionInvoiceModel();
        $this->billingEventModel    = new BillingEventModel();
        $this->invoiceService       = new InvoiceService();
        $this->billingEventService  = new BillingEventService();
        $this->prorationCalcModel   = new ProrationCalculationModel();
        $this->creditModel          = new SubscriptionCreditModel();
        $this->prorationService     = new ProrationService();
        $this->transitionPolicy     = new SubscriptionTransitionPolicy();
    }

    /**
     * GET /api/subscription/plans
     * Returns all active subscription plan definitions.
     */
    public function plans()
    {
        $plans = $this->planModel->getActivePlans();

        $formatted = array_map(fn($p) => [
            'id'                 => $p['id'],
            'name'               => $p['name'],
            'description'        => $p['description'],
            'maxStudents'        => $p['max_students'] !== null ? (int) $p['max_students'] : null,
            'monthlyPriceCents'  => (int) $p['monthly_price_cents'],
            'annualPriceCents'   => (int) $p['annual_price_cents'],
            'currency'           => $p['currency'],
            'sortOrder'          => (int) $p['sort_order'],
        ], $plans);

        return $this->success($formatted);
    }

    /**
     * GET /api/subscription/current
     * Returns the active subscription for the authenticated tenant.
     */
    public function current()
    {
        $tenantId = $this->getTenantId();

        $active = $this->subModel->getActiveForTenant($tenantId);

        $tenantModel  = new TenantModel();
        $studentCount = $tenantModel->getStudentCount($tenantId);

        $recommendedPlanId = $this->resolveRecommendedPlan($studentCount);

        $isExpired      = false;
        $isOverLimit    = false;
        $daysUntilExpiry = null;

        if ($active) {
            if ($active['expires_at'] !== null) {
                $expiresTs = strtotime($active['expires_at']);
                $now       = time();
                if ($expiresTs < $now) {
                    $isExpired = true;
                    // Sync the DB status so getActiveForTenant() and hasActiveSubscription()
                    // no longer return this subscription as active.
                    $nowStr = date('Y-m-d H:i:s');
                    $this->subModel->update($active['id'], ['status' => 'expired', 'updated_at' => $nowStr]);
                    $active['status'] = 'expired';
                } else {
                    $daysUntilExpiry = (int) ceil(($expiresTs - $now) / 86400);
                }
            }

            $plan = $this->planModel->getPlanById($active['plan_id']);
            if ($plan && $plan['max_students'] !== null && $studentCount >= (int) $plan['max_students']) {
                $isOverLimit = true;
            }
        }

        return $this->success([
            'subscription'      => $active ? $this->formatSubscription($active) : null,
            'studentCount'      => $studentCount,
            'recommendedPlanId' => $recommendedPlanId,
            'isExpired'         => $isExpired,
            'isOverLimit'       => $isOverLimit,
            'daysUntilExpiry'   => $daysUntilExpiry,
            'transitionPolicy'  => $this->transitionPolicy->transitionPolicy($active),
        ]);
    }

    /**
     * GET /api/subscription/history
     * Returns all subscription periods and payment transactions for the tenant.
     */
    public function history()
    {
        if ($guard = $this->requireRole('admin', 'super_admin', 'bursar')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();

        $subscriptions = $this->subModel->getAllForTenant($tenantId);
        $transactions  = $this->txModel->getAllForTenant($tenantId);

        $formattedSubs = array_map(fn($s) => $this->formatSubscription($s), $subscriptions);

        $formattedTx = array_map(fn($t) => [
            'id'               => $t['id'],
            'ourReference'     => $t['our_reference'],
            'paynowReference'  => $t['paynow_reference'],
            'amountCents'      => (int) $t['amount_cents'],
            'currency'         => $t['currency'],
            'status'           => $t['status'],
            'initiatedAt'      => $t['initiated_at'],
            'completedAt'      => $t['completed_at'],
            'proration'        => ($t['proration_credit_cents'] ?? null) !== null ? [
                'creditCents'    => (int) $t['proration_credit_cents'],
                'daysRemaining'  => (int) ($t['days_remaining'] ?? 0),
                'originalPlanId' => $t['original_plan_id'] ?? null,
            ] : null,
        ], $transactions);

        return $this->success([
            'subscriptions' => $formattedSubs,
            'transactions'  => $formattedTx,
        ]);
    }

    /**
     * POST /api/subscription/initiate
     * Initiates a paid subscription via Paynow.
     */
    public function initiate()
    {
        if ($guard = $this->requireRole('admin', 'super_admin')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $data     = $this->getRequestBody();

        $planId       = trim($data['planId']       ?? '');
        $billingCycle = trim($data['billingCycle']  ?? '');

        if ($planId === '') {
            return $this->error('Validation failed', 400, ['planId' => 'Plan ID is required.']);
        }
        if (!in_array($billingCycle, ['monthly', 'annual'], true)) {
            return $this->error('Validation failed', 400, ['billingCycle' => 'Billing cycle must be monthly or annual.']);
        }
        $plan = $this->planModel->getPlanById($planId);
        if (!$plan) {
            return $this->error('Validation failed', 400, ['planId' => 'Invalid plan selected.']);
        }

        // Enforce student capacity: block any plan whose max_students is below
        // the tenant's current active student count.
        if ($plan['max_students'] !== null) {
            $tenantModel  = new TenantModel();
            $studentCount = $tenantModel->getStudentCount($tenantId);
            if ($studentCount > (int) $plan['max_students']) {
                return $this->error(
                    'This plan does not support your current number of active students.',
                    422,
                    [
                        'plan_capacity_exceeded' => true,
                        'studentCount'           => $studentCount,
                        'planLimit'              => (int) $plan['max_students'],
                    ]
                );
            }
        }

        $activeSub = $this->subModel->getActiveForTenant($tenantId);
        if ($activeSub) {
            if ($activeSub['billing_cycle'] === 'annual' && $billingCycle === 'annual' && $planId !== $activeSub['plan_id']) {
                return $this->error(
                    'Annual plan changes must use proration.',
                    400,
                    ['proration' => 'Use calculate-proration and upgrade-with-proration to change annual plan tiers.']
                );
            }

            $transition = $this->transitionPolicy->canTransition($activeSub, $billingCycle);
            if (!$transition['allowed']) {
                $this->recordBlockedTransition($tenantId, $activeSub, $billingCycle);
                return $this->error($transition['message'], 422, $transition['errors']);
            }

            $currentPlan = $this->planModel->getPlanById($activeSub['plan_id']);
            if ($currentPlan) {
                $sort    = (int) $plan['sort_order'];
                $curSort = (int) $currentPlan['sort_order'];
                $isMonthlyToAnnual = $activeSub['billing_cycle'] === 'monthly' && $billingCycle === 'annual';

                // Upgrades must go through the proration flow to avoid charging full price
                // mid-cycle without applying a credit for unused days.
                if ($sort > $curSort && !$isMonthlyToAnnual) {
                    return $this->error(
                        'Validation failed',
                        400,
                        ['upgrade' => 'Use the upgrade-with-proration endpoint to upgrade your plan so unused days are credited.']
                    );
                }

            }
            // Renewal or valid downgrade — old subscription will be superseded when payment is confirmed
        }

        $amountCents = $billingCycle === 'annual'
            ? (int) $plan['annual_price_cents']
            : (int) $plan['monthly_price_cents'];

        $currency = env('SUBSCRIPTION_CURRENCY', 'USD');
        $ourRef   = 'SUB-' . $tenantId . '-' . time();
        $now      = date('Y-m-d H:i:s');

        // Cancel any stale pending subscriptions and their initiated transactions so
        // history stays clean and the user cannot double-pay for the same period.
        $this->txModel->cancelInitiatedForTenant($tenantId);
        $this->subModel->cancelPendingForTenant($tenantId);

        $subId = $this->generateUuid();
        $txId  = $this->generateUuid();

        $this->subModel->insert([
            'id'                => $subId,
            'tenant_id'         => $tenantId,
            'plan_id'           => $planId,
            'billing_cycle'     => $billingCycle,
            'status'            => 'pending',
            'starts_at'         => $now,
            'expires_at'        => null,
            'amount_paid_cents' => $amountCents,
            'currency'          => $currency,
        ]);

        $this->txModel->insert([
            'id'              => $txId,
            'tenant_id'       => $tenantId,
            'subscription_id' => $subId,
            'our_reference'   => $ourRef,
            'amount_cents'    => $amountCents,
            'currency'        => $currency,
            'status'          => 'initiated',
            'initiated_at'    => $now,
        ]);

        $paynow = new PaynowService();

        // Pass $txId so the service embeds it in the return URL. Paynow will append
        // it when redirecting back, giving the frontend the transaction ID it needs
        // to call the poll endpoint. Do NOT append txId to $redirectUrl here —
        // in production that is the Paynow payment page URL, not the return URL.
        $result = $paynow->initiate($ourRef, $amountCents, $txId);

        if (!$result['success']) {
            $this->txModel->update($txId, ['status' => 'failed', 'completed_at' => $now, 'updated_at' => $now]);
            $this->subModel->update($subId, ['status' => 'cancelled', 'cancelled_at' => $now, 'updated_at' => $now]);
            return $this->error('Payment gateway error. Please try again.', 422, ['gateway' => $result['error']]);
        }

        $this->txModel->update($txId, [
            'paynow_reference' => $result['paynowReference'],
            'paynow_poll_url'  => $result['pollUrl'],
            'updated_at'       => $now,
        ]);

        return $this->created([
            'subscriptionId' => $subId,
            'transactionId'  => $txId,
            'redirectUrl'    => $result['redirectUrl'],
            'ourReference'   => $ourRef,
        ], 'Payment initiated');
    }

    /**
     * POST /api/subscription/webhook  (PUBLIC — no JWT)
     * Receives Paynow payment status callbacks.
     */
    public function webhook()
    {
        $post = $this->request->getPost();

        $reference = $post['reference'] ?? '';
        $status    = $post['status']    ?? '';

        $paynow = new PaynowService();

        if (!$paynow->verifyHash($post)) {
            return $this->response->setStatusCode(400)->setBody('Invalid hash');
        }

        $tx = $this->txModel->findByOurReference($reference);
        if (!$tx) {
            return $this->response->setStatusCode(200)->setBody('Received');
        }

        if ($tx['status'] === 'paid') {
            return $this->response->setStatusCode(200)->setBody('Received');
        }

        $now = date('Y-m-d H:i:s');

        $this->txModel->update($tx['id'], [
            'paynow_status_raw'    => $status,
            'paynow_hash_verified' => 1,
            'webhook_payload'      => json_encode($post),
            'updated_at'           => $now,
        ]);

        if (strtolower($status) === 'paid') {
            $this->txModel->update($tx['id'], [
                'status'           => 'paid',
                'paynow_reference' => $post['paynowreference'] ?? null,
                'completed_at'     => $now,
                'updated_at'       => $now,
            ]);
            $tx = $this->txModel->find($tx['id']);

            $sub = $this->subModel->find($tx['subscription_id']);
            if ($sub) {
                $this->activateSubscription($sub, $tx, $now);
            }
        } elseif (in_array(strtolower($status), ['failed', 'cancelled'], true)) {
            $this->txModel->update($tx['id'], [
                'status'       => strtolower($status),
                'completed_at' => $now,
                'updated_at'   => $now,
            ]);
            if ($tx['subscription_id']) {
                $this->subModel->update($tx['subscription_id'], [
                    'status'       => 'cancelled',
                    'cancelled_at' => $now,
                    'updated_at'   => $now,
                ]);
                // Cancel any linked proration calculation so it cannot be re-used
                $calc = $this->prorationCalcModel
                    ->where('new_subscription_id', $tx['subscription_id'])
                    ->where('tenant_id', $tx['tenant_id'] ?? '')
                    ->first();
                if ($calc && $calc['status'] === 'confirmed') {
                    $this->prorationCalcModel->update($calc['id'], [
                        'status'       => 'failed',
                        'cancelled_at' => $now,
                    ]);
                }
                $this->billingEventService->record($tx['tenant_id'] ?? '', 'upgrade_failed', [
                    'subscription_id' => $tx['subscription_id'],
                    'transaction_id'  => $tx['id'],
                ]);
            }
        }

        return $this->response->setStatusCode(200)->setBody('Received');
    }

    /**
     * GET /api/subscription/poll/{transactionId}  (JWT-protected)
     * Polls Paynow for the current status of a transaction and activates
     * the subscription inline if payment is confirmed.
     */
    public function poll(string $transactionId)
    {
        $tenantId = $this->getTenantId();

        $tx = $this->txModel->find($transactionId);
        if (!$tx || $tx['tenant_id'] !== $tenantId) {
            return $this->notFound('Transaction not found');
        }

        // Short-circuit: if already in a terminal state, return cached result immediately
        // without making an outbound call to the Paynow gateway.
        if (in_array($tx['status'], ['paid', 'failed', 'cancelled'], true)) {
            return $this->success([
                'paid'               => $tx['status'] === 'paid',
                'paynowStatus'       => $tx['paynow_status_raw'] ?? $tx['status'],
                'subscriptionStatus' => $tx['status'] === 'paid' ? 'active' : $tx['status'],
            ]);
        }

        $pollUrl = $tx['paynow_poll_url'] ?? '';
        $paynow  = new PaynowService();

        // pollTransaction handles sandbox mode and empty pollUrl internally.
        $result = $paynow->pollTransaction($pollUrl);

        $now = date('Y-m-d H:i:s');
        $sub = $this->subModel->find($tx['subscription_id'] ?? '');

        if ($result['paid']) {
            // Payment confirmed — persist the terminal state and activate the subscription.
            $this->txModel->update($tx['id'], [
                'status'            => 'paid',
                'paynow_status_raw' => $result['status'],
                'paynow_reference'  => $result['reference'] ?: ($tx['paynow_reference'] ?? null),
                'completed_at'      => $now,
                'updated_at'        => $now,
            ]);
            $tx = $this->txModel->find($tx['id']);
            if ($sub) {
                $this->activateSubscription($sub, $tx, $now);
            }
        } elseif (in_array(strtolower($result['status'] ?? ''), ['cancelled', 'failed'], true)) {
            // Payment cancelled or failed — persist so future polls short-circuit
            // without making another outbound call to Paynow.
            $finalStatus = strtolower($result['status']);
            $this->txModel->update($tx['id'], [
                'status'            => $finalStatus,
                'paynow_status_raw' => $result['status'],
                'completed_at'      => $now,
                'updated_at'        => $now,
            ]);
            if ($sub) {
                $this->subModel->update($sub['id'], [
                    'status'       => 'cancelled',
                    'cancelled_at' => $now,
                    'updated_at'   => $now,
                ]);

                $calc = $this->prorationCalcModel
                    ->where('new_subscription_id', $sub['id'])
                    ->where('tenant_id', $tenantId)
                    ->first();
                if ($calc && $calc['status'] === 'confirmed') {
                    $this->prorationCalcModel->update($calc['id'], [
                        'status'       => 'failed',
                        'cancelled_at' => $now,
                    ]);
                }

                $this->billingEventService->record($tenantId, 'upgrade_failed', [
                    'subscription_id' => $sub['id'],
                    'transaction_id'  => $tx['id'],
                ]);
            }
        }

        $subStatus = $sub ? ($result['paid'] ? 'active' : $sub['status']) : 'unknown';

        return $this->success([
            'paid'               => $result['paid'],
            'paynowStatus'       => $result['status'],
            'subscriptionStatus' => $subStatus,
        ]);
    }

    /**
     * GET /api/subscription/invoices
     */
    public function invoices()
    {
        if ($guard = $this->requireRole('admin', 'super_admin', 'bursar')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $invoices = $this->invoiceModel->getForTenant($tenantId);

        $formatted = array_map(fn($inv) => [
            'id'            => $inv['id'],
            'invoiceNumber' => $inv['invoice_number'],
            'planName'      => $inv['plan_name'],
            'billingCycle'  => $inv['billing_cycle'],
            'amountCents'   => (int) $inv['amount_cents'],
            'currency'      => $inv['currency'],
            'issuedAt'      => $inv['issued_at'],
            'downloadUrl'   => '/api/subscription/invoices/' . $inv['id'] . '/download',
        ], $invoices);

        return $this->success(['invoices' => $formatted]);
    }

    /**
     * GET /api/subscription/invoices/{invoiceId}/download
     */
    public function downloadInvoice(string $invoiceId)
    {
        if ($guard = $this->requireRole('admin', 'super_admin', 'bursar')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $invoice  = $this->invoiceModel->find($invoiceId);

        if (!$invoice || $invoice['tenant_id'] !== $tenantId) {
            return $this->notFound('Invoice not found');
        }

        $pdfBytes = $this->invoiceService->generatePdf($invoice);
        $fileName = 'invoice-' . $invoice['invoice_number'] . '.pdf';

        return $this->response
            ->setHeader('Content-Type', 'application/pdf')
            ->setHeader('Content-Disposition', 'attachment; filename="' . $fileName . '"')
            ->setHeader('Content-Length', (string) strlen($pdfBytes))
            ->setBody($pdfBytes);
    }

    /**
     * GET /api/subscription/events
     */
    public function billingEvents()
    {
        if ($guard = $this->requireRole('admin', 'super_admin', 'bursar')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $page     = max(1, (int) ($this->request->getGet('page')    ?? 1));
        $perPage  = min(50, max(1, (int) ($this->request->getGet('perPage') ?? 20)));

        $result = $this->billingEventModel->getPaginatedForTenant($tenantId, $page, $perPage);

        $formatted = array_map(fn($e) => [
            'id'           => $e['id'],
            'eventType'    => $e['event_type'],
            'planName'     => $e['plan_name'],
            'billingCycle' => $e['billing_cycle'],
            'amountCents'  => $e['amount_cents'] !== null ? (int) $e['amount_cents'] : null,
            'currency'     => $e['currency'],
            'occurredAt'   => $e['occurred_at'],
        ], $result['events']);

        return $this->success([
            'events'  => $formatted,
            'total'   => $result['total'],
            'page'    => $page,
            'perPage' => $perPage,
        ]);
    }

    // ─── Proration endpoints ────────────────────────────────────────────────

    /**
     * POST /api/subscription/calculate-proration
     * Calculates proration for a potential plan change. Persists a calculation record.
     */
    public function calculateProration()
    {
        if ($guard = $this->requireRole('admin', 'super_admin')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $data     = $this->getRequestBody();

        $targetPlanId = trim($data['targetPlanId'] ?? '');
        if ($targetPlanId === '') {
            return $this->error('Validation failed', 400, ['targetPlanId' => 'Target plan ID is required.']);
        }

        $newPlan = $this->planModel->getPlanById($targetPlanId);
        if (!$newPlan) {
            return $this->error('Validation failed', 400, ['targetPlanId' => 'Invalid plan selected.']);
        }

        $activeSub = $this->subModel->getActiveForTenant($tenantId);
        if (!$activeSub) {
            return $this->error('No active subscription found.', 400, ['code' => 'NO_ACTIVE_SUBSCRIPTION']);
        }

        $originalPlan = $this->planModel->getPlanById($activeSub['plan_id']);
        if (!$originalPlan) {
            return $this->error('Original plan not found.', 400);
        }

        $billingCycle = trim($data['billingCycle'] ?? $activeSub['billing_cycle']);
        if (!in_array($billingCycle, ['monthly', 'annual'], true)) {
            return $this->error('Validation failed', 400, ['billingCycle' => 'Billing cycle must be monthly or annual.']);
        }

        $transition = $this->transitionPolicy->canTransition($activeSub, $billingCycle);
        if (!$transition['allowed']) {
            $this->recordBlockedTransition($tenantId, $activeSub, $billingCycle);
            return $this->error($transition['message'], 422, $transition['errors']);
        }

        // Check downgrade student count limit
        if ((int) $newPlan['sort_order'] < (int) $originalPlan['sort_order'] && $newPlan['max_students'] !== null) {
            $tenantModel  = new TenantModel();
            $studentCount = $tenantModel->getStudentCount($tenantId);
            if ($studentCount > (int) $newPlan['max_students']) {
                return $this->error('Downgrade blocked', 422, [
                    'downgradeBlocked' => true,
                    'studentCount'     => $studentCount,
                    'planLimit'        => (int) $newPlan['max_students'],
                ]);
            }
        }

        $proration    = $this->prorationService->calculateProration($activeSub, $originalPlan, $newPlan, $billingCycle);
        $calcId       = $this->generateUuid();
        $currency     = env('SUBSCRIPTION_CURRENCY', 'USD');

        $this->prorationService->saveCalculation(
            $calcId,
            $tenantId,
            $activeSub,
            $originalPlan,
            $newPlan,
            $billingCycle,
            $proration,
            $this->transitionPolicy->changeType($activeSub, $originalPlan, $newPlan, $billingCycle),
            SubscriptionTransitionPolicy::POLICY_CODE
        );

        return $this->success([
            'calculationId' => $calcId,
            'originalPlan'  => [
                'id'         => $originalPlan['id'],
                'name'       => $originalPlan['name'],
                'priceCents' => $proration['originalPlanPriceCents'],
                'currency'   => $currency,
            ],
            'newPlan' => [
                'id'         => $newPlan['id'],
                'name'       => $newPlan['name'],
                'priceCents' => $proration['newPlanPriceCents'],
                'currency'   => $currency,
            ],
            'billingCycle' => $billingCycle,
            'cycleDates'   => [
                'startDate'     => $proration['cycleStartDate'],
                'endDate'       => $proration['cycleEndDate'],
                'daysInCycle'   => $proration['daysInCycle'],
                'daysRemaining' => $proration['daysRemaining'],
            ],
            'proration' => [
                'unusedValueCreditCents' => $proration['unusedValueCreditCents'],
                'proratedChargeCents'    => $proration['proratedChargeCents'],
                'netAmountCents'         => $proration['netAmountCents'],
                'isUpgrade'              => $proration['isUpgrade'],
                'isDowngrade'            => $proration['isDowngrade'],
            ],
            'breakdown' => [
                'dailyRateOriginalCents' => $proration['dailyRateOriginalCents'],
                'dailyRateNewCents'      => $proration['dailyRateNewCents'],
                'formula'                => '(price / days) * remaining',
            ],
        ]);
    }

    /**
     * POST /api/subscription/upgrade-with-proration
     * Initiates a plan upgrade/downgrade with proration. Requires a valid calculationId.
     */
    public function upgradeWithProration()
    {
        if ($guard = $this->requireRole('admin', 'super_admin')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $data     = $this->getRequestBody();

        $calculationId = trim($data['calculationId'] ?? '');
        if ($calculationId === '') {
            return $this->error('Validation failed', 400, ['calculationId' => 'Calculation ID is required.']);
        }

        $calculation = $this->prorationCalcModel->findByTenant($calculationId, $tenantId);
        if (!$calculation) {
            return $this->notFound('Calculation not found.');
        }

        $activeSub = $this->subModel->getActiveForTenant($tenantId);
        if ($activeSub) {
            $transition = $this->transitionPolicy->canTransition($activeSub, $calculation['billing_cycle']);
            if (!$transition['allowed']) {
                $this->recordBlockedTransition($tenantId, $activeSub, $calculation['billing_cycle']);
                return $this->error($transition['message'], 422, $transition['errors']);
            }
        }

        // Check expiry (30-minute window)
        if ($this->prorationCalcModel->isExpired($calculation)) {
            return $this->error('Calculation expired. Please recalculate proration.', 409, [
                'code' => 'PRORATION_CALCULATION_EXPIRED',
            ]);
        }

        if ($calculation['status'] !== 'calculated') {
            return $this->error('Calculation is no longer valid.', 409);
        }

        $newPlan = $this->planModel->getPlanById($calculation['new_plan_id']);
        if (!$newPlan) {
            return $this->error('Plan not found.', 400, ['code' => 'PLAN_NOT_FOUND']);
        }

        $paymentMethod = strtolower(trim($data['paymentMethod'] ?? 'paynow'));

        $currency     = env('SUBSCRIPTION_CURRENCY', 'USD');
        $netCents     = (int) $calculation['net_amount_cents'];
        $amountCents  = max(0, $netCents);
        $ourRef       = 'SUB-' . $tenantId . '-' . time();
        $now          = date('Y-m-d H:i:s');

        // Cancel stale pending work
        $this->txModel->cancelInitiatedForTenant($tenantId);
        $this->subModel->cancelPendingForTenant($tenantId);
        $this->subModel->clearPendingChanges($tenantId);

        $subId = $this->generateUuid();
        $txId  = $this->generateUuid();

        // For upgrades, preserve the original billing cycle's end date so the user
        // keeps the same expiration date. cycle_end_date is stored as 'Y-m-d'; convert
        // to the full datetime format expected by activateSubscription.
        $preservedExpiresAt = null;
        if (!empty($calculation['cycle_end_date'])) {
            $preservedExpiresAt = date('Y-m-d H:i:s', strtotime($calculation['cycle_end_date']));
        }

        $this->subModel->insert([
            'id'                => $subId,
            'tenant_id'         => $tenantId,
            'plan_id'           => $calculation['new_plan_id'],
            'billing_cycle'     => $calculation['billing_cycle'],
            'status'            => 'pending',
            'starts_at'         => $now,
            'expires_at'        => $preservedExpiresAt,
            'amount_paid_cents' => $amountCents,
            'currency'          => $currency,
        ]);

        $this->txModel->insert([
            'id'              => $txId,
            'tenant_id'       => $tenantId,
            'subscription_id' => $subId,
            'our_reference'   => $ourRef,
            'amount_cents'    => $amountCents,
            'currency'        => $currency,
            'status'          => 'initiated',
            'initiated_at'    => $now,
        ]);

        // Link the calculation to the new subscription
        $this->prorationCalcModel->update($calculationId, [
            'new_subscription_id' => $subId,
            'status'              => 'confirmed',
            'confirmed_at'        => $now,
        ]);

        // Zero-amount or downgrade (negative net): activate immediately without Paynow.
        // Paynow does not support $0 payments and downgrades never require a charge.
        if ($amountCents === 0) {
            $this->txModel->update($txId, [
                'status'       => 'paid',
                'completed_at' => $now,
                'updated_at'   => $now,
            ]);
            $tx  = $this->txModel->find($txId);
            $sub = $this->subModel->find($subId);
            $this->activateSubscription($sub, $tx, $now);

            return $this->created([
                'subscriptionId'  => $subId,
                'transactionId'   => $txId,
                'redirectUrl'     => null,
                'ourReference'    => $ourRef,
                'activated'       => true,
                'prorationApplied' => [
                    'creditUsedCents'     => (int) $calculation['unused_value_credit_cents'],
                    'amountToChargeCents' => 0,
                ],
            ], 'Plan changed');
        }

        $paynow = new PaynowService();
        $result = $paynow->initiate($ourRef, $amountCents, $txId);

        if (!$result['success']) {
            $this->txModel->update($txId, ['status' => 'failed', 'completed_at' => $now, 'updated_at' => $now]);
            $this->subModel->update($subId, ['status' => 'cancelled', 'cancelled_at' => $now, 'updated_at' => $now]);
            $this->prorationCalcModel->update($calculationId, ['status' => 'failed']);
            return $this->error('Payment gateway error. Please try again.', 422, ['gateway' => $result['error']]);
        }

        $this->txModel->update($txId, [
            'paynow_reference' => $result['paynowReference'],
            'paynow_poll_url'  => $result['pollUrl'],
            'updated_at'       => $now,
        ]);

        return $this->created([
            'subscriptionId'  => $subId,
            'transactionId'   => $txId,
            'redirectUrl'     => $result['redirectUrl'],
            'ourReference'    => $ourRef,
            'activated'       => false,
            'prorationApplied' => [
                'creditUsedCents'     => (int) $calculation['unused_value_credit_cents'],
                'amountToChargeCents' => $amountCents,
            ],
        ], 'Upgrade initiated');
    }

    /**
     * GET /api/subscription/credits
     * Returns active credit balance for the tenant.
     */
    public function credits()
    {
        if ($guard = $this->requireRole('admin', 'super_admin', 'bursar')) {
            return $guard;
        }

        $tenantId     = $this->getTenantId();
        $credits      = $this->creditModel->getActiveForTenant($tenantId);
        $totalCents   = $this->creditModel->getTotalForTenant($tenantId);
        $currency     = env('SUBSCRIPTION_CURRENCY', 'USD');

        $formatted = array_map(fn($c) => [
            'id'                    => $c['id'],
            'initialAmountCents'    => (int) $c['initial_amount_cents'],
            'remainingAmountCents'  => (int) $c['remaining_amount_cents'],
            'reason'                => $c['reason'],
            'createdAt'             => $c['created_at'],
            'expiresAt'             => $c['expires_at'],
        ], $credits);

        return $this->success([
            'totalCreditsCents' => $totalCents,
            'currency'          => $currency,
            'credits'           => $formatted,
        ]);
    }

    /**
     * GET /api/subscription/proration-history
     * Returns paginated proration calculation history for the tenant.
     */
    public function prorationHistory()
    {
        if ($guard = $this->requireRole('admin', 'super_admin', 'bursar')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $page     = max(1, (int) ($this->request->getGet('page')    ?? 1));
        $perPage  = min(50, max(1, (int) ($this->request->getGet('perPage') ?? 20)));

        $result = $this->prorationCalcModel->getForTenant($tenantId, $page, $perPage);

        $formatted = array_map(function ($calc) {
            $originalPlan = $this->planModel->getPlanById($calc['original_plan_id']);
            $newPlan      = $this->planModel->getPlanById($calc['new_plan_id']);
            return [
                'id'               => $calc['id'],
                'originalPlanName' => $originalPlan['name'] ?? $calc['original_plan_id'],
                'newPlanName'      => $newPlan['name']      ?? $calc['new_plan_id'],
                'billingCycle'     => $calc['billing_cycle'],
                'changeType'       => $calc['change_type'] ?? null,
                'policyCode'       => $calc['policy_code'] ?? null,
                'netAmountCents'   => (int) $calc['net_amount_cents'],
                'status'           => $calc['status'],
                'createdAt'        => $calc['created_at'],
                'confirmedAt'      => $calc['confirmed_at'],
            ];
        }, $result['calculations']);

        return $this->success([
            'calculations' => $formatted,
            'total'        => $result['total'],
            'page'         => $page,
            'perPage'      => $perPage,
        ]);
    }

    // ─── Private helpers ────────────────────────────────────────────────────

    private function activateSubscription(array $sub, array $tx, string $now): void
    {
        // If the pending subscription already has an expiration date (set during upgrade
        // initiation to preserve the original billing cycle), use it. Otherwise compute
        // a full new period from activation time.
        if ($sub['expires_at'] !== null) {
            $expiresAt = $sub['expires_at'];
        } else {
            $expiresAt = $sub['billing_cycle'] === 'annual'
                ? date('Y-m-d H:i:s', strtotime('+12 months', strtotime($now)))
                : date('Y-m-d H:i:s', strtotime('+1 month',  strtotime($now)));
        }

        // Determine prior active plan before superseding (for event type)
        $priorActive = $this->subModel->getActiveForTenant($sub['tenant_id']);
        $priorPlan   = $priorActive ? $this->planModel->getPlanById($priorActive['plan_id']) : null;

        $this->subModel->deactivateAllForTenant($sub['tenant_id'], 'superseded');

        $this->subModel->update($sub['id'], [
            'status'       => 'active',
            'starts_at'    => $now,
            'expires_at'   => $expiresAt,
            'activated_at' => $now,
            'updated_at'   => $now,
        ]);

        $newPlan     = $this->planModel->getPlanById($sub['plan_id']);
        $newPlanName = $newPlan ? $newPlan['name'] : $sub['plan_id'];
        $tenantId    = $sub['tenant_id'];

        // Create invoice record (T026)
        $tenantModel  = new TenantModel();
        $tenantRow    = $tenantModel->find($tenantId);
        $settings     = json_decode($tenantRow['settings'] ?? '{}', true);
        $tenantName   = $settings['schoolName'] ?? $tenantId;
        $invoice      = $this->invoiceService->createInvoice($sub, $tx, $tenantName);

        // Determine and record billing event (T032)
        if (!$priorPlan) {
            $eventType = 'plan_activated';
        } elseif ($sub['plan_id'] === $priorPlan['id']) {
            $eventType = 'subscription_renewed';
        } elseif ((int) ($newPlan['sort_order'] ?? 0) > (int) $priorPlan['sort_order']) {
            $eventType = 'plan_upgraded';
        } else {
            $eventType = 'plan_downgraded';
        }

        $eventContext = [
            'plan_name'       => $newPlanName,
            'billing_cycle'   => $sub['billing_cycle'],
            'amount_cents'    => (int) $tx['amount_cents'],
            'currency'        => $tx['currency'],
            'subscription_id' => $sub['id'],
            'transaction_id'  => $tx['id'],
        ];

        $this->billingEventService->record($tenantId, 'payment_confirmed', $eventContext);
        $this->billingEventService->record($tenantId, $eventType, $eventContext);
        if ($priorActive && $priorActive['billing_cycle'] !== $sub['billing_cycle']) {
            $this->billingEventService->record($tenantId, 'billing_cycle_changed', $eventContext);
        }

        // Send subscription confirmation + invoice emails (non-fatal on failure)
        try {
            $userModel = new UserModel();
            $adminUser = $userModel->where('tenant_id', $tenantId)
                ->where('role', 'admin')
                ->orderBy('created_at', 'ASC')
                ->first();

            if ($adminUser && !empty($adminUser['email'])) {
                $emailService = new EmailService();
                $recipientName  = $adminUser['name'] ?? $adminUser['email'];
                $recipientEmail = $adminUser['email'];

                $emailService->sendSubscriptionConfirmation(
                    $recipientEmail,
                    $recipientName,
                    $recipientEmail,
                    $tenantName,
                    $newPlanName,
                    $sub['billing_cycle'],
                    (int) $tx['amount_cents'],
                    $tx['currency'],
                    date('d M Y', strtotime($now)),
                    date('d M Y', strtotime($expiresAt)),
                    $invoice['invoice_number']
                );

                $pdfBytes = $this->invoiceService->generatePdf($invoice);
                $emailService->sendInvoice(
                    $recipientEmail,
                    $recipientName,
                    $recipientEmail,
                    $invoice,
                    $pdfBytes
                );
            }
        } catch (\Throwable $e) {
            log_message('error', '[SubscriptionController::activateSubscription] Email failed: ' . $e->getMessage());
        }
    }

    private function recordBlockedTransition(string $tenantId, array $activeSub, string $targetBillingCycle): void
    {
        $this->billingEventService->record($tenantId, 'billing_cycle_change_blocked', [
            'billing_cycle'   => $targetBillingCycle,
            'subscription_id' => $activeSub['id'],
        ]);
    }

    private function formatSubscription(array $s): array
    {
        $plan = $this->planModel->find($s['plan_id']);
        return [
            'id'               => $s['id'],
            'planId'           => $s['plan_id'],
            'planName'         => $plan['name'] ?? $s['plan_id'],
            'billingCycle'     => $s['billing_cycle'],
            'status'           => $s['status'],
            'startsAt'         => $s['starts_at'],
            'expiresAt'        => $s['expires_at'],
            'amountPaidCents'  => (int) $s['amount_paid_cents'],
            'currency'         => $s['currency'],
            'activatedAt'      => $s['activated_at'],
            'pendingPlanId'    => $s['pending_plan_id'] ?? null,
            'pendingChangeEffectiveAt' => $s['pending_change_effective_at'] ?? null,
            'pendingChangeType' => $s['pending_change_type'] ?? null,
        ];
    }

    private function resolveRecommendedPlan(int $studentCount): string
    {
        // Always recommend the highest-tier plan (largest sort_order), regardless of student count.
        $topPlan = $this->planModel->where('is_active', 1)->orderBy('sort_order', 'DESC')->first();
        return $topPlan['id'] ?? '';
    }

    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}

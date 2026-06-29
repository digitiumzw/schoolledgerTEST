<?php

namespace App\Controllers\Platform;

use App\Libraries\AuditService;
use App\Models\SchoolSubscriptionModel;
use App\Models\SubscriptionPlanModel;
use App\Services\BillingEventService;
use App\Services\SubscriptionTransitionPolicy;

class SubscriptionsController extends BasePlatformController
{
    private SchoolSubscriptionModel $subModel;
    private SubscriptionPlanModel $planModel;
    private SubscriptionTransitionPolicy $transitionPolicy;

    public function __construct()
    {
        $this->subModel  = new SchoolSubscriptionModel();
        $this->planModel = new SubscriptionPlanModel();
        $this->transitionPolicy = new SubscriptionTransitionPolicy();
    }

    public function index()
    {
        [$page, $limit, $offset] = $this->getPaginationParams(25, 100);
        $db = \Config\Database::connect();

        $builder = $db->table('school_subscriptions ss')
            ->select('ss.*, t.name AS tenant_name, t.email AS tenant_email,
                      sp.name AS plan_name, sp.max_students,
                      (sp.monthly_price_cents / 100) AS monthly_price,
                      (sp.annual_price_cents  / 100) AS annual_price,
                      (SELECT spt.status FROM subscription_payment_transactions spt
                       WHERE spt.subscription_id = ss.id
                       ORDER BY spt.created_at DESC LIMIT 1) AS payment_status', false)
            ->join('tenants t', 't.id = ss.tenant_id', 'left')
            ->join('subscription_plans sp', 'sp.id = ss.plan_id', 'left');

        $status        = $this->request->getGet('status');
        $search        = $this->request->getGet('q');
        $planId        = $this->request->getGet('plan_id');
        $billingCycle  = $this->request->getGet('billing_cycle');
        $paymentStatus = $this->request->getGet('payment_status');
        $expiringSoon  = $this->request->getGet('expiring_soon');

        if ($status) {
            $builder->where('ss.status', $status);
        }
        if ($search) {
            $builder->groupStart()
                ->like('t.name', $search)
                ->orLike('t.email', $search)
                ->groupEnd();
        }
        if ($planId) {
            $builder->where('ss.plan_id', $planId);
        }
        if ($billingCycle) {
            $builder->where('ss.billing_cycle', $billingCycle);
        }
        if ($paymentStatus) {
            $builder->where(
                "(SELECT spt2.status FROM subscription_payment_transactions spt2 WHERE spt2.subscription_id = ss.id ORDER BY spt2.created_at DESC LIMIT 1) =",
                $paymentStatus
            );
        }
        if ($expiringSoon && $expiringSoon !== '0' && $expiringSoon !== 'false') {
            $builder->where('ss.expires_at IS NOT NULL')
                    ->where('ss.expires_at >=', date('Y-m-d H:i:s'))
                    ->where('ss.expires_at <=', date('Y-m-d H:i:s', strtotime('+30 days')));
        }

        $total = $builder->countAllResults(false);
        $subs  = $builder->orderBy('ss.created_at', 'DESC')->limit($limit, $offset)->get()->getResultArray();

        $now30 = strtotime('+30 days');
        $subs  = array_map(function ($row) use ($now30) {
            $alerts = [];
            if (($row['payment_status'] ?? null) === 'failed') {
                $alerts[] = 'payment_failed';
            }
            if ($row['status'] === 'active' && !empty($row['expires_at'])) {
                $expiresAt = strtotime($row['expires_at']);
                if ($expiresAt !== false && $expiresAt <= $now30) {
                    $alerts[] = 'expiring_soon';
                }
            }
            if (in_array($row['status'], ['trialing', 'trial'], true)) {
                $alerts[] = 'trial_ending';
            }
            $row['alerts'] = $alerts;
            return $row;
        }, $subs);

        $activeCount = (int) ($db->query(
            "SELECT COUNT(*) AS cnt FROM school_subscriptions WHERE status = 'active'"
        )->getRow()->cnt ?? 0);

        $meta = $this->buildPaginationMeta($total, $page, $limit);
        $meta['active_count'] = $activeCount;

        return $this->success($subs, 'OK', 200, $meta);
    }

    public function changePlan($id)
    {
        if (!$this->canManageSubscriptions($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $sub = $this->subModel->find($id);
        if (!$sub) {
            return $this->notFound('Subscription not found.');
        }

        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['plan_id']);
        if ($err) return $err;

        $newPlan = $this->planModel->find($body['plan_id']);
        if (!$newPlan) {
            return $this->notFound('Plan not found.');
        }

        if (($body['billing_cycle'] ?? $sub['billing_cycle']) === 'monthly') {
            $transition = $this->transitionPolicy->canTransition($sub, 'monthly');
            if (!$transition['allowed']) {
                (new BillingEventService())->record($sub['tenant_id'], 'billing_cycle_change_blocked', [
                    'billing_cycle'   => 'monthly',
                    'subscription_id' => $id,
                ]);
                return $this->error($transition['message'], 422, $transition['errors']);
            }
        }

        $oldPlanId = $sub['plan_id'];
        $plan = $this->planModel->find($body['plan_id']);
        $planName = $plan ? $plan['name'] : 'Unknown Plan';
        $this->subModel->update($id, ['plan_id' => $body['plan_id'], 'updated_at' => date('Y-m-d H:i:s')]);

        $db = \Config\Database::connect();
        $tenant = $db->table('tenants')->where('id', $sub['tenant_id'])->get()->getRowArray();
        $tenantName = $tenant ? $tenant['name'] : 'Unknown School';

        AuditService::logFromRequest('platform.subscription.change_plan', 'subscription', $id, [
            'from_plan_id' => $oldPlanId,
            'to_plan_id'   => $body['plan_id'],
            'tenant_id'    => $sub['tenant_id'],
            'plan_name'    => $planName,
        ], $tenantName);

        return $this->success($this->subModel->find($id), 'Plan changed');
    }

    public function cancel($id)
    {
        if (!$this->canManageSubscriptions($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $sub = $this->subModel->find($id);
        if (!$sub) {
            return $this->notFound('Subscription not found.');
        }

        $this->subModel->update($id, [
            'status'       => 'cancelled',
            'cancelled_at' => date('Y-m-d H:i:s'),
        ]);

        $db = \Config\Database::connect();
        $tenant = $db->table('tenants')->where('id', $sub['tenant_id'])->get()->getRowArray();
        $tenantName = $tenant ? $tenant['name'] : 'Unknown School';

        AuditService::logFromRequest('platform.subscription.cancel', 'subscription', $id, [
            'tenant_id' => $sub['tenant_id'],
        ], $tenantName);

        return $this->success(null, 'Subscription cancelled');
    }

    public function assign()
    {
        if (!$this->canManageSubscriptions($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['tenant_id', 'plan_id', 'starts_at', 'expires_at']);
        if ($err) return $err;

        $startsAt  = $body['starts_at'];
        $expiresAt = $body['expires_at'];

        if (!strtotime($startsAt) || !strtotime($expiresAt)) {
            return $this->error('Invalid date format for starts_at or expires_at.', 422);
        }

        if (strtotime($expiresAt) <= strtotime($startsAt)) {
            return $this->error('expires_at must be after starts_at.', 422);
        }

        $db     = \Config\Database::connect();
        $tenant = $db->table('tenants')->where('id', $body['tenant_id'])->get()->getRowArray();
        if (!$tenant) {
            return $this->notFound('Tenant not found.');
        }

        $plan = $this->planModel->find($body['plan_id']);
        if (!$plan) {
            return $this->notFound('Plan not found.');
        }

        $billingCycle = in_array($body['billing_cycle'] ?? '', ['monthly', 'annual'], true)
            ? $body['billing_cycle']
            : 'monthly';

        $tenantId = $body['tenant_id'];
        $now      = date('Y-m-d H:i:s');
        $activeSub = $this->subModel->getActiveForTenant($tenantId);
        $transition = $this->transitionPolicy->canTransition($activeSub, $billingCycle);
        if (!$transition['allowed']) {
            (new BillingEventService())->record($tenantId, 'billing_cycle_change_blocked', [
                'billing_cycle'   => $billingCycle,
                'subscription_id' => $activeSub['id'],
            ]);
            return $this->error($transition['message'], 422, $transition['errors']);
        }

        $this->subModel->deactivateAllForTenant($tenantId, 'superseded');

        $newId = $this->newUuid();
        $this->subModel->insert([
            'id'                => $newId,
            'tenant_id'         => $tenantId,
            'plan_id'           => $body['plan_id'],
            'billing_cycle'     => $billingCycle,
            'status'            => 'active',
            'starts_at'         => date('Y-m-d H:i:s', strtotime($startsAt)),
            'expires_at'        => date('Y-m-d H:i:s', strtotime($expiresAt)),
            'amount_paid_cents' => 0,
            'currency'          => 'USD',
            'activated_at'      => $now,
        ]);

        (new BillingEventService())->record($tenantId, 'plan_activated', [
            'plan_name'       => $plan['name'],
            'billing_cycle'   => $billingCycle,
            'subscription_id' => $newId,
        ]);

        AuditService::logFromRequest('platform.subscription.assign', 'subscription', $newId, [
            'tenant_id'    => $tenantId,
            'plan_id'      => $body['plan_id'],
            'billing_cycle' => $billingCycle,
            'starts_at'    => $startsAt,
            'expires_at'   => $expiresAt,
        ], $tenant['name']);

        return $this->success($this->subModel->find($newId), 'Subscription assigned', 201);
    }

    private function newUuid(): string
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

<?php

namespace App\Controllers\Platform;

use App\Libraries\AuditService;
use App\Models\SubscriptionPlanModel;

class PlansController extends BasePlatformController
{
    private SubscriptionPlanModel $planModel;

    public function __construct()
    {
        $this->planModel = new SubscriptionPlanModel();
    }

    public function index()
    {
        $db = \Config\Database::connect();

        $plans = $db->query("
            SELECT sp.*,
                   sp.monthly_price_cents / 100 AS monthly_price,
                   sp.annual_price_cents  / 100 AS annual_price,
                   COUNT(ss.id)                  AS subscriber_count
            FROM subscription_plans sp
            LEFT JOIN school_subscriptions ss ON ss.plan_id = sp.id AND ss.status = 'active'
            GROUP BY sp.id
            ORDER BY sp.monthly_price_cents ASC
        ")->getResultArray();

        return $this->success($plans);
    }

    public function show($id = null)
    {
        $plan = $this->planModel->find($id);
        if (!$plan) {
            return $this->notFound('Plan not found.');
        }

        $plan['monthly_price'] = $plan['monthly_price_cents'] / 100;
        $plan['annual_price']  = $plan['annual_price_cents']  / 100;

        return $this->success($plan);
    }

    public function store()
    {
        if (!$this->canManagePlans($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['id', 'name', 'monthly_price_cents']);
        if ($err) return $err;

        if ($this->planModel->find($body['id'])) {
            return $this->error('A plan with this ID already exists.', 409);
        }

        $monthlyCents = (int) $body['monthly_price_cents'];
        $discountPct  = isset($body['annual_discount_pct']) ? (float) $body['annual_discount_pct'] : 17.0;
        $annualCents  = (int) round($monthlyCents * 12 * (1 - $discountPct / 100));

        $this->planModel->insert([
            'id'                   => $this->sanitiseString($body['id']),
            'name'                 => $this->sanitiseString($body['name']),
            'description'          => $body['description'] ?? null,
            'max_students'         => isset($body['max_students']) ? (int) $body['max_students'] : null,
            'monthly_price_cents'  => $monthlyCents,
            'annual_price_cents'   => $annualCents,
            'annual_discount_pct'  => $discountPct,
            'currency'             => $body['currency'] ?? 'USD',
            'is_active'            => 1,
            'sort_order'           => (int) ($body['sort_order'] ?? 0),
        ]);

        AuditService::logFromRequest('platform.plan.create', 'plan', $body['id'], ['name' => $body['name']], $body['name']);

        $plan = $this->planModel->find($body['id']);
        $plan['monthly_price'] = $plan['monthly_price_cents'] / 100;
        $plan['annual_price']  = $plan['annual_price_cents']  / 100;

        return $this->created($plan, 'Plan created');
    }

    public function update($id = null)
    {
        if (!$this->canManagePlans($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $plan = $this->planModel->find($id);
        if (!$plan) {
            return $this->notFound('Plan not found.');
        }

        $body    = $this->getRequestBody();
        $updates = array_intersect_key($body, array_flip([
            'name', 'description', 'max_students',
            'monthly_price_cents', 'annual_discount_pct',
            'currency', 'is_active', 'sort_order',
        ]));

        // Ensure is_active is stored as integer 0 or 1
        if (array_key_exists('is_active', $updates)) {
            $updates['is_active'] = (int) $updates['is_active'] ? 1 : 0;
        }

        // Auto-calculate annual_price_cents from monthly price and discount
        $monthlyCents = isset($updates['monthly_price_cents'])
            ? (int) $updates['monthly_price_cents']
            : (int) $plan['monthly_price_cents'];
        $discountPct = isset($updates['annual_discount_pct'])
            ? (float) $updates['annual_discount_pct']
            : (float) ($plan['annual_discount_pct'] ?? 17.0);
        $updates['annual_price_cents'] = (int) round($monthlyCents * 12 * (1 - $discountPct / 100));

        $this->planModel->update($id, $updates);

        AuditService::logFromRequest('platform.plan.update', 'plan', $id, $updates, $plan['name']);

        $updated = $this->planModel->find($id);
        $updated['monthly_price'] = $updated['monthly_price_cents'] / 100;
        $updated['annual_price']  = $updated['annual_price_cents']  / 100;

        return $this->success($updated, 'Plan updated');
    }

    public function delete($id = null)
    {
        if (!$this->canManagePlans($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $plan = $this->planModel->find($id);
        if (!$plan) {
            return $this->notFound('Plan not found.');
        }

        $db = \Config\Database::connect();
        $subscribers = (int) $db->table('school_subscriptions')
            ->where('plan_id', $id)
            ->whereIn('status', ['active', 'trialing'])
            ->countAllResults();

        if ($subscribers > 0) {
            return $this->error("Cannot delete plan with {$subscribers} active subscriber(s). Retire it instead.", 409);
        }

        AuditService::logFromRequest('platform.plan.delete', 'plan', $id, ['name' => $plan['name']], $plan['name']);

        $this->planModel->delete($id);

        return $this->success(null, 'Plan deleted');
    }
}

<?php

namespace App\Controllers\Platform;

use App\Libraries\AuditService;
use App\Models\TenantModel;
use App\Services\SchoolProvisioningService;
use RuntimeException;

class TenantsController extends BasePlatformController
{
    private TenantModel $tenantModel;

    public function __construct()
    {
        $this->tenantModel = new TenantModel();
    }

    public function index()
    {
        [$page, $limit, $offset] = $this->getPaginationParams(25, 100);
        $db = \Config\Database::connect();

        $allowedSortKeys = ['name', 'student_count', 'created_at', 'monthly_price'];
        $sortBy  = $this->request->getGet('sortBy');
        $sortDir = strtoupper((string) ($this->request->getGet('sortDir') ?? 'DESC'));
        $sortBy  = in_array($sortBy, $allowedSortKeys, true) ? $sortBy : 'created_at';
        $sortDir = in_array($sortDir, ['ASC', 'DESC'], true) ? $sortDir : 'DESC';

        $builder = $db->table('tenants t')
            ->select('t.id, t.name, t.email, t.status, t.created_at, t.settings,
                      t.deleted_school_name, t.permanently_deleted_at,
                      ss.id AS subscription_id, ss.status AS subscription_status,
                      ss.billing_cycle, ss.expires_at,
                      sp.id AS plan_id, sp.name AS plan_name,
                      (sp.monthly_price_cents / 100) AS monthly_price,
                      (sp.annual_price_cents  / 100) AS annual_price,
                      COALESCE(sc.student_count, 0) AS student_count,
                      COALESCE(stc.staff_count, 0) AS staff_count', false)
            ->join('school_subscriptions ss', 'ss.tenant_id = t.id AND ss.status = \'active\'', 'left')
            ->join('subscription_plans sp', 'sp.id = ss.plan_id', 'left')
            ->join(
                '(SELECT tenant_id, COUNT(id) AS student_count FROM students GROUP BY tenant_id) sc',
                'sc.tenant_id = t.id',
                'left'
            )
            ->join(
                '(SELECT tenant_id, COUNT(id) AS staff_count FROM staff GROUP BY tenant_id) stc',
                'stc.tenant_id = t.id',
                'left'
            );

        $status = $this->request->getGet('status');
        $search = $this->request->getGet('q');
        $plan   = $this->request->getGet('plan');

        if ($status) {
            $builder->where('t.status', $status);
        }
        if ($search) {
            $builder->groupStart()
                ->like('t.name', $search)
                ->orLike('t.email', $search)
                ->groupEnd();
        }
        if ($plan) {
            $builder->where('sp.name', $plan);
        }

        $total   = $builder->countAllResults(false);
        $tenants = $builder->orderBy($sortBy, $sortDir)->limit($limit, $offset)->get()->getResultArray();

        // Batch-resolve fallback admin emails for tenants where t.email is NULL/empty,
        // avoiding an N+1 query inside the loop below.
        $missingEmailIds = array_values(array_filter(array_map(
            static fn (array $t) => trim((string) ($t['email'] ?? '')) === '' ? $t['id'] : null,
            $tenants
        )));
        $emailFallbacks = $this->batchAdminEmails($missingEmailIds);

        // Resolve display fields only — counts already come from JOIN subqueries above.
        foreach ($tenants as &$tenant) {
            $tenant['name']             = $this->resolveSchoolName($tenant);
            $tenant['email']            = $this->resolveAdminEmail($tenant, $emailFallbacks);
            $tenant['student_count']    = (int) ($tenant['student_count'] ?? 0);
            $tenant['staff_count']      = (int) ($tenant['staff_count'] ?? 0);
            $tenant['is_deleted']       = isset($tenant['permanently_deleted_at']) && $tenant['permanently_deleted_at'] !== null;
            $tenant['deleted_school_name'] = $tenant['deleted_school_name'] ?? null;
            unset($tenant['settings']);
        }

        return $this->success($tenants, 'OK', 200, $this->buildPaginationMeta($total, $page, $limit));
    }

    public function show($id = null)
    {
        $db     = \Config\Database::connect();
        $tenant = $db->table('tenants t')
            ->select('t.id, t.name, t.email, t.status, t.created_at, t.settings,
                      t.deleted_school_name, t.permanently_deleted_at,
                      ss.id AS subscription_id, ss.status AS subscription_status,
                      ss.billing_cycle, ss.starts_at, ss.expires_at, ss.activated_at,
                      sp.id AS plan_id, sp.name AS plan_name,
                      (sp.monthly_price_cents / 100) AS monthly_price,
                      (sp.annual_price_cents  / 100) AS annual_price', false)
            ->join('school_subscriptions ss', 'ss.tenant_id = t.id AND ss.status = \'active\'', 'left')
            ->join('subscription_plans sp', 'sp.id = ss.plan_id', 'left')
            ->where('t.id', $id)
            ->get()
            ->getRowArray();

        if (!$tenant) {
            return $this->notFound('Tenant not found.');
        }

        $tenant['name']  = $this->resolveSchoolName($tenant);
        $tenant['email'] = $this->resolveAdminEmail(
            $tenant,
            trim((string) ($tenant['email'] ?? '')) === '' ? $this->batchAdminEmails([$id]) : []
        );
        $tenant['student_count']    = (int) $db->table('students')->where('tenant_id', $id)->countAllResults();
        $tenant['staff_count']      = (int) $db->table('staff')->where('tenant_id', $id)->countAllResults();
        $tenant['is_deleted']       = isset($tenant['permanently_deleted_at']) && $tenant['permanently_deleted_at'] !== null;
        $tenant['deleted_school_name'] = $tenant['deleted_school_name'] ?? null;
        unset($tenant['settings']);

        // Recent invoices for this tenant
        $tenant['recent_invoices'] = $db->table('subscription_invoices')
            ->where('tenant_id', $id)
            ->orderBy('issued_at', 'DESC')
            ->limit(5)
            ->get()
            ->getResultArray();

        foreach ($tenant['recent_invoices'] as &$inv) {
            $inv['amount'] = (float) $inv['amount_cents'] / 100;
        }

        return $this->success($tenant);
    }

    public function store()
    {
        if (!$this->canManageTenants($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['name', 'email']);
        if ($err) return $err;

        $service = new SchoolProvisioningService();

        try {
            $result = $service->provision(
                $this->sanitiseString($body['name']),
                $this->sanitiseString($body['email'])
            );
        } catch (RuntimeException $e) {
            $code = $e->getCode() >= 400 ? $e->getCode() : 500;
            return $this->error($e->getMessage(), $code);
        }

        $payload = $result['tenant'];
        $payload['email_sent'] = $result['email_sent'];

        $message = $result['email_sent']
            ? 'School created successfully. Welcome email sent.'
            : 'School created successfully. Welcome email could not be delivered — use Resend Welcome to retry.';

        return $this->created($payload, $message);
    }

    /**
     * POST /api/platform/tenants/:id/resend-welcome
     *
     * Resend the welcome email (with a freshly generated temporary password)
     * to the admin of a school that is still in 'pending' status.
     */
    public function resendWelcome($id = null)
    {
        if (!$this->canManageTenants($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $service = new SchoolProvisioningService();

        try {
            $service->resendWelcome((string) $id);
        } catch (RuntimeException $e) {
            $code = $e->getCode() >= 400 ? $e->getCode() : 500;
            return $this->error($e->getMessage(), $code);
        }

        return $this->success(null, 'Welcome email resent successfully.');
    }

    public function suspend($id)
    {
        if (!$this->canSuspendTenant($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $tenant = $this->tenantModel->find($id);
        if (!$tenant) {
            return $this->notFound('Tenant not found.');
        }

        $this->tenantModel->update($id, ['status' => 'suspended']);

        AuditService::logFromRequest('platform.tenant.suspend', 'tenant', $id, [
            'previous_status' => $tenant['status'],
        ], $tenant['name']);

        return $this->success(null, 'Tenant suspended.');
    }

    public function reactivate($id)
    {
        if (!$this->canSuspendTenant($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $tenant = $this->tenantModel->find($id);
        if (!$tenant) {
            return $this->notFound('Tenant not found.');
        }

        $this->tenantModel->update($id, ['status' => 'active']);

        AuditService::logFromRequest('platform.tenant.reactivate', 'tenant', $id, [
            'previous_status' => $tenant['status'],
        ], $tenant['name']);

        return $this->success(null, 'Tenant reactivated.');
    }

    public function delete($id = null)
    {
        if (!$this->canDeleteTenants($this->getPlatformRole())) {
            return $this->forbidden('Only Owner role can delete tenants.');
        }

        $tenant = $this->tenantModel->find($id);
        if (!$tenant) {
            return $this->notFound('Tenant not found.');
        }

        $db          = \Config\Database::connect();
        $hasPayments = $db->table('payments')->where('tenant_id', $id)->countAllResults() > 0;
        $hasCharges  = $db->table('charges')->where('tenant_id', $id)->countAllResults() > 0;
        $hasInvoices = $db->table('subscription_invoices')->where('tenant_id', $id)->countAllResults() > 0;
        $hasEvents   = $db->table('billing_events')->where('tenant_id', $id)->countAllResults() > 0;

        if ($hasPayments || $hasCharges || $hasInvoices || $hasEvents) {
            AuditService::logFromRequest('platform.tenant.delete_refused', 'tenant', $id, [
                'name'                => $tenant['name'],
                'has_payments'        => $hasPayments,
                'has_charges'         => $hasCharges,
                'has_invoices'        => $hasInvoices,
                'has_billing_events'  => $hasEvents,
            ], $tenant['name']);
            return $this->error(
                'Cannot delete tenant with existing financial records. Consider suspending this tenant instead.',
                409
            );
        }

        AuditService::logFromRequest('platform.tenant.delete', 'tenant', $id, ['name' => $tenant['name']], $tenant['name']);

        $schoolName = $this->resolveSchoolName($tenant);
        $this->tenantModel->update($id, [
            'name'                    => '[Deleted]',
            'email'                   => null,
            'subdomain'               => null,
            'settings'                => '{}',
            'fee_structure'           => null,
            'academic_calendar'       => null,
            'payment_categories'      => null,
            'charge_generation_history' => '[]',
            'deletion_requested_at'   => null,
            'permanently_deleted_at'  => date('Y-m-d H:i:s'),
            'deleted_school_name'     => $schoolName,
            'status'                  => 'deleted',
        ]);

        return $this->success(null, 'Tenant tombstoned.');
    }

    /**
     * Resolve the school's display name with a defensive fallback chain:
     *   t.name (column) → settings.schoolName (JSON) → 'Unknown School'
     * This handles legacy/imported tenants where the top-level name column may be empty
     * while the schoolName was stored only in the settings JSON blob.
     */
    private function resolveSchoolName(array $tenant): string
    {
        // For deleted tenants, prefer the preserved deleted_school_name
        $deletedName = trim((string) ($tenant['deleted_school_name'] ?? ''));
        if ($deletedName !== '') {
            return $deletedName;
        }

        $name = trim((string) ($tenant['name'] ?? ''));
        if ($name !== '' && $name !== '[Deleted]') {
            return $name;
        }
        $settings = json_decode($tenant['settings'] ?? '{}', true) ?: [];
        $fromSettings = trim((string) ($settings['schoolName'] ?? ''));
        return $fromSettings !== '' ? $fromSettings : 'Unknown School';
    }

    /**
     * Resolve the tenant's admin email with a fallback chain:
     *   t.email (column) → first super_admin/admin user in users table → null
     * Required because legacy tenants and seeded fixtures may have t.email NULL
     * while still having an admin user in their users table.
     */
    private function resolveAdminEmail(array $tenant, array $fallbacks): ?string
    {
        $email = trim((string) ($tenant['email'] ?? ''));
        if ($email !== '') {
            return $email;
        }
        $fallback = $fallbacks[$tenant['id']] ?? null;
        return $fallback !== null && $fallback !== '' ? $fallback : null;
    }

    /**
     * Batch-fetch the first admin/super_admin email per tenant_id, using a single
     * query to avoid N+1. Returns ['tenant_id' => 'email', ...].
     */
    private function batchAdminEmails(array $tenantIds): array
    {
        if (empty($tenantIds)) {
            return [];
        }
        $db   = \Config\Database::connect();
        $rows = $db->table('users')
            ->select('tenant_id, MIN(email) AS admin_email', false)
            ->whereIn('tenant_id', $tenantIds)
            ->whereIn('role', ['super_admin', 'admin'])
            ->groupBy('tenant_id')
            ->get()
            ->getResultArray();
        $map = [];
        foreach ($rows as $r) {
            $map[$r['tenant_id']] = $r['admin_email'];
        }
        return $map;
    }

    /**
     * GET /api/platform/tenants/:id/invoices
     * Returns paginated invoice history for a single tenant, with payment status.
     * Used by the Schools page TenantBillingTab component.
     */
    public function tenantInvoices($id = null)
    {
        if (!$this->canManageTenants($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $tenant = $this->tenantModel->find($id);
        if (!$tenant) {
            return $this->notFound('Tenant not found.');
        }

        [$page, $limit, $offset] = $this->getPaginationParams(20, 100);
        $db = \Config\Database::connect();

        $builder = $db->table('subscription_invoices si')
            ->select('si.id, si.invoice_number,
                      (si.amount_cents / 100) AS amount,
                      si.currency, si.issued_at,
                      spt.status AS payment_status', false)
            ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left')
            ->where('si.tenant_id', $id);

        $status = $this->request->getGet('status');
        $dir    = strtoupper((string) $this->request->getGet('dir') ?: 'DESC');
        $dir    = in_array($dir, ['ASC', 'DESC'], true) ? $dir : 'DESC';

        if ($status) {
            $builder->where('spt.status', $status);
        }

        $total    = $builder->countAllResults(false);
        $invoices = $builder->orderBy('si.issued_at', $dir)
            ->limit($limit, $offset)
            ->get()
            ->getResultArray();

        return $this->success($invoices, 'OK', 200, $this->buildPaginationMeta($total, $page, $limit));
    }
}

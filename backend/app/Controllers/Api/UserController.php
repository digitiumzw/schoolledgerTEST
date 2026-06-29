<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Services\InvitationService;

class UserController extends BaseApiController
{
    protected UserModel $userModel;

    private const VALID_STATUSES = ['active', 'inactive'];
    private const MIN_PASSWORD_LENGTH = 8;

    public function initController(\CodeIgniter\HTTP\RequestInterface $request, \CodeIgniter\HTTP\ResponseInterface $response, \Psr\Log\LoggerInterface $logger)
    {
        parent::initController($request, $response, $logger);
        $this->userModel = new UserModel();
    }

    private function formatUserResponse(array $user): array
    {
        return [
            'id' => $user['id'],
            'tenantId' => $user['tenant_id'],
            'email' => $user['email'],
            'name' => $user['name'],
            'role' => $user['role'],
            'status' => $user['status'] ?? 'active',
            'createdDate' => $user['created_at'],
        ];
    }

    private function validateEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    private function validateRole(string $role): bool
    {
        return in_array($role, self::VALID_ROLES);
    }

    private function findUserOrFail(?string $id): ?array
    {
        if (!$id) {
            return null;
        }
        return $this->userModel->find($id);
    }

    public function index()
    {
        if ($guard = $this->requireRole('super_admin', 'admin')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $users = $this->userModel->getByTenant($tenantId);

        // School admins must not see super_admin accounts
        if (!$this->userHasRole('super_admin')) {
            $users = array_filter($users, fn($u) => $u['role'] !== 'super_admin');
            $users = array_values($users);
        }

        $formatted = array_map([$this, 'formatUserResponse'], $users);

        return $this->success($formatted);
    }

    public function show($id = null)
    {
        if ($guard = $this->requireRole('super_admin', 'admin')) {
            return $guard;
        }

        $user = $this->findUserOrFail($id);
        if (!$user) {
            return $this->notFound('User not found');
        }

        // School admins must not access super_admin accounts
        if (!$this->userHasRole('super_admin') && $user['role'] === 'super_admin') {
            return $this->forbidden('Access denied');
        }

        return $this->success($this->formatUserResponse($user));
    }

    /**
     * POST /api/users/invite
     *
     * Invite a new user. Creates a `pending` user account (no password set)
     * and dispatches an invitation email containing a 48-hour single-use
     * token. The invited user sets their own password via /api/auth/accept-invite.
     */
    public function invite()
    {
        if ($guard = $this->requireRole('super_admin', 'admin')) {
            return $guard;
        }

        // Rate-limit: 10 invitations per inviting user per minute
        $callerId  = $this->getCurrentUser()->id ?? 'anon';
        $throttler = service('throttler');
        if (!$throttler->check('invite_user_' . md5($callerId), 10, MINUTE)) {
            return $this->error('Too many invitations sent. Please wait a minute.', 429);
        }

        $data     = $this->getRequestBody();
        $tenantId = $this->getTenantId();

        if (empty($data['email'])) {
            return $this->error('Email is required', 400);
        }
        if (empty($data['name'])) {
            return $this->error('Name is required', 400);
        }
        if (!$this->validateEmail($data['email'])) {
            return $this->error('Invalid email format', 400);
        }

        $role = $data['role'] ?? 'admin';
        if (!$this->validateRole($role)) {
            return $this->error('Invalid role. Allowed: ' . implode(', ', self::VALID_ROLES), 400);
        }

        if (!$this->userHasRole('super_admin') && $role === 'super_admin') {
            return $this->forbidden('You cannot invite a Super Admin account');
        }
        if (!$this->userHasRole('super_admin') && !in_array($role, ['admin', 'bursar', 'hr'], true)) {
            return $this->error('Invalid role. Tenant accounts may only be admin, bursar, or hr.', 400);
        }

        // Enforce per-tenant cap against ACTIVE + INVITED accounts so bulk
        // invitations cannot bypass the limit.
        if (!$this->userHasRole('super_admin')) {
            $count = (int) $this->userModel
                ->where('tenant_id', $tenantId)
                ->whereIn('role', ['admin', 'bursar', 'hr'])
                ->whereIn('status', ['active', 'invited'])
                ->countAllResults();
            if ($count >= 5) {
                return $this->error('Tenant account limit reached (maximum 5)', 400);
            }
        }

        $email = strtolower(trim($data['email']));

        // Reject if any existing user (active or invited) already owns this email
        $existing = $this->userModel->findByEmail($email);
        if ($existing) {
            return $this->error('A user with this email already exists', 409);
        }

        $userData = [
            'id'                   => $this->generateId('u'),
            'tenant_id'            => $tenantId,
            'email'                => $email,
            'password'             => null,
            'name'                 => trim($data['name']),
            'role'                 => $role,
            'status'               => 'invited',
            // Invited users join a tenant whose onboarding has already been
            // completed by the school admin, so they must bypass the wizard
            // and land on the dashboard immediately after first login.
            'is_temp_password'     => 0,
            'onboarding_complete'  => 1,
        ];

        try {
            if (!$this->userModel->insert($userData)) {
                $errors = $this->userModel->errors();
                log_message('error', 'UserController::invite - Insert failed: ' . json_encode($errors));
                return $this->error('Failed to invite user: ' . implode(', ', $errors), 500);
            }
        } catch (\Exception $e) {
            log_message('error', 'UserController::invite - Exception: ' . $e->getMessage());
            return $this->error('Failed to invite user', 500);
        }

        // Issue invitation token and dispatch email
        try {
            (new InvitationService())->issue($tenantId, $callerId, $userData);
        } catch (\Throwable $e) {
            log_message('error', 'UserController::invite - Token issuance failed: ' . $e->getMessage());
            // Roll back the user record so the admin can retry cleanly
            $this->userModel->delete($userData['id']);
            return $this->error('Failed to send invitation. Please try again.', 500);
        }

        $userData['created_at'] = date('Y-m-d H:i:s');
        return $this->created($this->formatUserResponse($userData), 'Invitation sent to ' . $email);
    }

    /**
     * POST /api/users/{id}/resend-invite
     *
     * Resend an invitation for a user whose status is still `invited`.
     * Invalidates the previous token and issues a fresh email.
     */
    public function resendInvite($id = null)
    {
        if ($guard = $this->requireRole('super_admin', 'admin')) {
            return $guard;
        }

        $user = $this->findUserOrFail($id);
        if (!$user) {
            return $this->notFound('User not found');
        }

        // Tenant-isolation: school admins cannot resend across tenants
        if (!$this->userHasRole('super_admin') && $user['tenant_id'] !== $this->getTenantId()) {
            return $this->forbidden('Access denied');
        }

        // School admins cannot resend invitations to super_admin accounts
        if (!$this->userHasRole('super_admin') && $user['role'] === 'super_admin') {
            return $this->forbidden('Access denied');
        }

        if (($user['status'] ?? 'active') !== 'invited') {
            return $this->error('This user is not in an invited state.', 400);
        }

        $callerId = $this->getCurrentUser()->id ?? 'anon';

        try {
            (new InvitationService())->resend($user['tenant_id'], $callerId, $user);
        } catch (\Throwable $e) {
            log_message('error', 'UserController::resendInvite - Failed: ' . $e->getMessage());
            return $this->error('Failed to resend invitation', 500);
        }

        return $this->success(null, 'Invitation resent to ' . $user['email']);
    }

    public function update($id = null)
    {
        if ($guard = $this->requireRole('super_admin', 'admin')) {
            return $guard;
        }

        $user = $this->findUserOrFail($id);
        if (!$user) {
            return $this->notFound('User not found');
        }

        // School admins cannot edit super_admin accounts
        if (!$this->userHasRole('super_admin') && $user['role'] === 'super_admin') {
            return $this->forbidden('You cannot edit a Super Admin account');
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        // Validate email if provided
        if (isset($data['email']) && !empty($data['email'])) {
            if (!$this->validateEmail($data['email'])) {
                return $this->error('Invalid email format', 400);
            }
            // Check if email exists for another user
            $existingUser = $this->userModel->findByEmail($data['email']);
            if ($existingUser && $existingUser['id'] !== $id) {
                return $this->error('Email already in use by another user', 409);
            }
        }

        // Validate role if provided
        if (isset($data['role']) && !$this->validateRole($data['role'])) {
            return $this->error('Invalid role. Allowed: ' . implode(', ', self::VALID_ROLES), 400);
        }

        // ─── Protect Super Admin Role ───────────────────────────────
        // The role of a Super Admin account is immutable. No caller –
        // including another Super Admin or the Super Admin themself –
        // may modify it under any circumstances.
        if ($user['role'] === 'super_admin' && isset($data['role']) && $data['role'] !== 'super_admin') {
            return $this->error('The Super Admin role cannot be changed', 403);
        }

        // School admins cannot promote/assign super_admin role
        if (!$this->userHasRole('super_admin') && isset($data['role']) && $data['role'] === 'super_admin') {
            return $this->forbidden('You cannot assign the Super Admin role');
        }

        // ─── Prevent Self Role Change ──────────────────────────────
        // Users are not allowed to modify their own role to avoid
        // accidental lock-outs or privilege escalation/demotion.
        $currentUser = $this->getCurrentUser();
        if ($currentUser && $currentUser->id === $id && isset($data['role']) && $data['role'] !== $user['role']) {
            return $this->error('You cannot change your own role', 403);
        }

        $updateData = [
            'name' => isset($data['name']) ? trim($data['name']) : $user['name'],
            'role' => $data['role'] ?? $user['role'],
            'email' => isset($data['email']) ? strtolower(trim($data['email'])) : $user['email'],
        ];

        $this->userModel->update($id, $updateData);
        $updated = $this->userModel->find($id);
        
        return $this->success($this->formatUserResponse($updated), 'User updated successfully');
    }

    public function delete($id = null)
    {
        if ($guard = $this->requireRole('super_admin', 'admin')) {
            return $guard;
        }

        $user = $this->findUserOrFail($id);
        if (!$user) {
            return $this->notFound('User not found');
        }

        // Prevent deleting super_admin accounts - they are protected
        if ($user['role'] === 'super_admin') {
            return $this->error('Super Admin accounts cannot be deleted', 403);
        }

        // School admins cannot delete users outside their tenant
        if (!$this->userHasRole('super_admin') && $user['tenant_id'] !== $this->getTenantId()) {
            return $this->forbidden('Access denied');
        }

        // Prevent deleting the last admin
        if ($user['role'] === 'admin') {
            $adminCount = count($this->userModel
                ->where('tenant_id', $user['tenant_id'])
                ->where('role', 'admin')
                ->where('status', 'active')
                ->findAll());
            
            if ($adminCount <= 1) {
                return $this->error('Cannot delete the last admin user', 400);
            }
        }

        $this->userModel->delete($id);
        return $this->success(['success' => true, 'id' => $id], 'User deleted successfully');
    }

    public function toggleStatus($id = null)
    {
        if ($guard = $this->requireRole('super_admin', 'admin')) {
            return $guard;
        }

        $user = $this->findUserOrFail($id);
        if (!$user) {
            return $this->notFound('User not found');
        }

        // School admins cannot change status of super_admin accounts
        if (!$this->userHasRole('super_admin') && $user['role'] === 'super_admin') {
            return $this->forbidden('Access denied');
        }

        // Prevent deactivating super_admin accounts - they are protected
        if ($user['role'] === 'super_admin' && ($user['status'] ?? 'active') === 'active') {
            return $this->error('Super Admin accounts cannot be deactivated', 403);
        }

        // Prevent deactivating the last active admin
        if ($user['role'] === 'admin' && ($user['status'] ?? 'active') === 'active') {
            $activeAdminCount = count($this->userModel
                ->where('tenant_id', $user['tenant_id'])
                ->where('role', 'admin')
                ->where('status', 'active')
                ->findAll());
            
            if ($activeAdminCount <= 1) {
                return $this->error('Cannot deactivate the last active admin', 400);
            }
        }

        $newStatus = ($user['status'] ?? 'active') === 'active' ? 'inactive' : 'active';
        $this->userModel->update($id, ['status' => $newStatus]);
        
        return $this->success([
            'id' => $id, 
            'status' => $newStatus
        ], 'User status updated successfully');
    }

}

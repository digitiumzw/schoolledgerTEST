<?php

namespace App\Libraries;

trait PlatformPolicy
{
    protected function canManageTenants(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin'], true);
    }

    protected function canDeleteTenants(string $role): bool
    {
        return $role === 'Owner';
    }

    protected function canSuspendTenant(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Support'], true);
    }

    protected function canImpersonateTenant(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Support'], true);
    }

    protected function canManagePlans(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Finance'], true);
    }

    protected function canManageSubscriptions(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Finance'], true);
    }

    protected function canViewFinance(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Finance'], true);
    }

    protected function canExportFinance(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Finance'], true);
    }

    protected function canManageSettings(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin'], true);
    }

    protected function canManageTeam(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin'], true);
    }

    protected function canChangeTeamRole(string $role): bool
    {
        return $role === 'Owner';
    }

    protected function canDeactivateTeamMember(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin'], true);
    }

    protected function canViewAuditLog(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Finance', 'Support'], true);
    }

    protected function canManageOwnAccount(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Finance', 'Support'], true);
    }

    protected function canManageApiKeys(string $role): bool
    {
        return $role === 'Owner';
    }

    protected function canViewApiKeys(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin'], true);
    }

    protected function canImpersonate(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Support'], true);
    }

    protected function canViewAnalytics(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin', 'Finance', 'Support'], true);
    }

    protected function canManagePlatformSecurity(string $role): bool
    {
        return $role === 'Owner';
    }

    protected function canViewSystemErrors(string $role): bool
    {
        return in_array($role, ['Owner', 'Admin'], true);
    }

    protected function getPlatformUser(): ?object
    {
        return $this->request->platformUser ?? null;
    }

    protected function getPlatformRole(): ?string
    {
        return $this->getPlatformUser()?->platform_role ?? null;
    }

    protected function getPlatformUserId(): ?int
    {
        $id = $this->getPlatformUser()?->id ?? null;
        return $id !== null ? (int) $id : null;
    }

    protected function requirePlatformRole(string ...$roles): ?object
    {
        $role = $this->getPlatformRole();
        if ($role === null || !in_array($role, $roles, true)) {
            return $this->error('You do not have permission to perform this action', 403);
        }
        return null;
    }
}

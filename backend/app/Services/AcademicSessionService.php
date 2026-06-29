<?php

namespace App\Services;

use Config\Database;

/**
 * AcademicSessionService
 *
 * Single source of truth for "what academic session is currently active"
 * for a given tenant. Backed by tenants.settings.activeAcademicSession
 * (string in `YYYY/YYYY+1` format). All read paths that previously used
 * date('Y') . '/' . (date('Y')+1) should call getCurrentSession() instead.
 *
 * Format: always `YYYY/YYYY+1` where the second year is exactly one greater.
 */
class AcademicSessionService
{
    private const SESSION_REGEX = '/^(\d{4})\/(\d{4})$/';

    /**
     * Return the active academic session for a tenant, in `YYYY/YYYY+1` form.
     *
     * Resolution order:
     *  1. tenants.settings.activeAcademicSession  (canonical)
     *  2. tenants.settings.academicYear           (legacy: bare year, normalised)
     *  3. date('Y') / date('Y')+1                 (last-resort fallback)
     */
    public function getCurrentSession(string $tenantId): string
    {
        $settings = $this->loadSettings($tenantId);

        $session = $settings['activeAcademicSession'] ?? null;
        if (is_string($session) && $this->isValidSession($session)) {
            return $session;
        }

        $legacyYear = $settings['academicYear'] ?? null;
        if (is_string($legacyYear) && preg_match('/^(\d{4})$/', $legacyYear, $m)) {
            $start = (int) $m[1];
            return $start . '/' . ($start + 1);
        }

        $year = (int) date('Y');
        return $year . '/' . ($year + 1);
    }

    /**
     * Persist the active session for a tenant. Validates format.
     */
    public function setCurrentSession(string $tenantId, string $session): void
    {
        if (!$this->isValidSession($session)) {
            throw new \InvalidArgumentException("Session must be YYYY/YYYY+1 with consecutive years (got '{$session}')");
        }

        $db = Database::connect();
        $row = $db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        if (!$row) {
            throw new \RuntimeException("Tenant not found: {$tenantId}");
        }

        $settings = [];
        if (!empty($row['settings'])) {
            $decoded = json_decode($row['settings'], true);
            if (is_array($decoded)) {
                $settings = $decoded;
            }
        }
        $settings['activeAcademicSession'] = $session;

        $db->table('tenants')
            ->where('id', $tenantId)
            ->update([
                'settings'   => json_encode($settings),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    /**
     * Pure helper: given `YYYY/YYYY+1`, return the next session.
     */
    public function getNextSession(string $session): string
    {
        if (!$this->isValidSession($session)) {
            $year = (int) date('Y');
            return ($year + 1) . '/' . ($year + 2);
        }
        [$a, $b] = array_map('intval', explode('/', $session));
        return ($a + 1) . '/' . ($b + 1);
    }

    /**
     * Format check: `YYYY/YYYY+1` with consecutive years.
     */
    public function isValidSession(string $session): bool
    {
        if (!preg_match(self::SESSION_REGEX, $session, $m)) {
            return false;
        }
        return ((int) $m[2]) === ((int) $m[1]) + 1;
    }

    private function loadSettings(string $tenantId): array
    {
        $db  = Database::connect();
        $row = $db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        if (!$row || empty($row['settings'])) {
            return [];
        }
        $decoded = json_decode($row['settings'], true);
        return is_array($decoded) ? $decoded : [];
    }
}

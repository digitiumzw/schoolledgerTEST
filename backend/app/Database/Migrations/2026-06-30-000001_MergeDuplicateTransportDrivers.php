<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Merge duplicate transport_drivers records that share the same
 * (tenant_id, staff_id) into a single canonical row.
 *
 * Background:
 *  TransportDriverController::create() historically had no uniqueness
 *  check on staff_id, so repeated "Add Driver" calls for the same staff
 *  member created multiple transport_drivers rows.  This caused confusion
 *  in the driver kiosk and route-period assignment UI.
 *
 * What this migration does:
 *  1. For each (tenant_id, staff_id) group with > 1 driver row, picks the
 *     oldest row (by created_at) as the canonical record.
 *  2. Repoints all transport_route_periods.driver_id references from the
 *     duplicate rows to the canonical row.
 *  3. Deletes the duplicate rows.
 *
 * After this migration, the application-level uniqueness guard added to
 * TransportDriverController::create() prevents new duplicates.
 */
class MergeDuplicateTransportDrivers extends Migration
{
    public function up(): void
    {
        $db = $this->db;

        // Find all (tenant_id, staff_id) pairs that have more than one
        // transport_drivers row.
        $dupes = $db->query("
            SELECT tenant_id, staff_id, COUNT(*) AS cnt
            FROM transport_drivers
            WHERE staff_id IS NOT NULL
            GROUP BY tenant_id, staff_id
            HAVING COUNT(*) > 1
        ")->getResultArray();

        foreach ($dupes as $dupe) {
            $tenantId = $dupe['tenant_id'];
            $staffId  = $dupe['staff_id'];

            // Pick the canonical row: oldest by created_at, then lowest id
            // as a tiebreaker for deterministic ordering.
            $canonical = $db->table('transport_drivers')
                ->where('tenant_id', $tenantId)
                ->where('staff_id', $staffId)
                ->orderBy('created_at', 'ASC')
                ->orderBy('id', 'ASC')
                ->limit(1)
                ->get()
                ->getRowArray();

            if (!$canonical) {
                continue;
            }

            $canonicalId = $canonical['id'];

            // Find all duplicate rows (everything except the canonical).
            $duplicates = $db->table('transport_drivers')
                ->where('tenant_id', $tenantId)
                ->where('staff_id', $staffId)
                ->where('id !=', $canonicalId)
                ->get()
                ->getResultArray();

            $duplicateIds = array_column($duplicates, 'id');

            if (empty($duplicateIds)) {
                continue;
            }

            $escapedIds = implode("','", array_map(
                static fn($id) => $db->escapeString($id),
                $duplicateIds
            ));

            // Repoint transport_route_periods from duplicates to canonical.
            $db->query(
                "UPDATE transport_route_periods
                    SET driver_id = ?, updated_at = ?
                  WHERE driver_id IN ('{$escapedIds}')",
                [$canonicalId, date('Y-m-d H:i:s')]
            );

            // Delete the duplicate driver rows.
            $db->table('transport_drivers')
                ->whereIn('id', $duplicateIds)
                ->delete();
        }
    }

    public function down(): void
    {
        // This migration is destructive to duplicate rows and cannot be
        // reversed — the duplicate data has been merged and deleted.
    }
}

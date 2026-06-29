<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Deactivate all teacher and driver user accounts.
 *
 * These roles are no longer valid tenant account roles. Drivers access the
 * system via the driver kiosk (Employee ID), and teachers use the student
 * attendance kiosk. Neither role requires a login account.
 *
 * DOWN: No-op — irreversible. Restoring which accounts were previously active
 * is non-deterministic after the fact.
 */
class DeactivateTeacherDriverAccounts extends Migration
{
    public function up(): void
    {
        $this->db->query("UPDATE users SET status = 'inactive' WHERE role IN ('teacher', 'driver')");
    }

    public function down(): void
    {
        // Intentionally a no-op. This migration is irreversible: we cannot
        // know which teacher/driver accounts were active before deactivation.
    }
}

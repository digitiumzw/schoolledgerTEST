<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Extend the fee_rules.assignment_scope_type ENUM to include 'student'.
 *
 * The new scope lets a fee rule target specific named students rather than an
 * entire class or the whole school. The assignment_scope_id column (already
 * widened to TEXT by migration 2026-05-04-000002) stores a JSON array of
 * student IDs, matching the pattern used by multi-class rules.
 *
 * Idempotent: the ALTER is safe to re-run; MySQL is a no-op when the value
 * already exists in the ENUM.
 */
class Add_student_scope_to_fee_rules extends Migration
{
    public function up(): void
    {
        $this->db->query("
            ALTER TABLE fee_rules
            MODIFY COLUMN assignment_scope_type
                ENUM('school_wide','class','category','service','student')
                NOT NULL
        ");
    }

    public function down(): void
    {
        // Remove student-scoped rules before rolling back, otherwise MySQL
        // will reject the MODIFY due to existing out-of-range values.
        $this->db->query("DELETE FROM fee_rules WHERE assignment_scope_type = 'student'");

        $this->db->query("
            ALTER TABLE fee_rules
            MODIFY COLUMN assignment_scope_type
                ENUM('school_wide','class','category','service')
                NOT NULL
        ");
    }
}

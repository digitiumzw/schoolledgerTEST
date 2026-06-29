<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Widen fee_rules.assignment_scope_id from VARCHAR(50) to TEXT.
 *
 * Feature: 057-payment-billing-ux
 *
 * Multi-class fee rules (research.md §D2) store a JSON array of class IDs in
 * this column, which can exceed the original 50-character limit when a rule
 * targets multiple classes. TEXT is a superset of VARCHAR(50) so existing
 * single-class data is preserved unchanged.
 *
 * Storage convention for assignment_scope_id by scope type:
 *   school_wide: NULL
 *   class:       "cls_abc123" (single) OR '["cls_abc","cls_def"]' (JSON array)
 *   category:    "Tuition" (category key)
 *   service:     "transport" (service key)
 *
 * Idempotent: ALTER ... MODIFY is safe to re-run.
 */
class Widen_fee_rule_scope_id_to_text extends Migration
{
    public function up(): void
    {
        $this->db->query("
            ALTER TABLE fee_rules
            MODIFY COLUMN assignment_scope_id TEXT NULL
            COMMENT 'single class ID, JSON array of class IDs, category key, or service key. NULL when scope = school_wide'
        ");
    }

    public function down(): void
    {
        // Note: down-migration is lossy if any multi-class rules exist —
        // rows whose assignment_scope_id exceeds 50 characters will be
        // truncated by MySQL. Callers should deactivate/convert multi-class
        // rules before running down().
        $this->db->query("
            ALTER TABLE fee_rules
            MODIFY COLUMN assignment_scope_id VARCHAR(50) NULL
            COMMENT 'FK-by-value: class.id, category key, or service key. NULL when scope = school_wide.'
        ");
    }
}

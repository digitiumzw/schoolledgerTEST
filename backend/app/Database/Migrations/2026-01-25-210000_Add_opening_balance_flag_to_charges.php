<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add is_opening_balance flag to charges table
 * 
 * Opening balances represent money owed before the system went live.
 * They follow special rules:
 * - Not tied to any term billing run
 * - Not recalculated
 * - Not affected by fee changes
 * - Immutable, except through explicit adjustments
 */
class AddOpeningBalanceFlagToCharges extends Migration
{
    public function up()
    {
        // Add is_opening_balance column if it doesn't exist
        if (!$this->db->fieldExists('is_opening_balance', 'charges')) {
            $this->forge->addColumn('charges', [
                'is_opening_balance' => [
                    'type' => 'TINYINT',
                    'constraint' => 1,
                    'null' => true,
                    'default' => null,
                    'after' => 'is_fee_structure',
                    'comment' => '1 for opening balance charges (immutable, not tied to term)',
                ],
            ]);
        }

        // Add index for opening balance queries
        $indexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_opening_balance'")->getResultArray();
        if (empty($indexes)) {
            $this->db->query('CREATE INDEX idx_charges_opening_balance ON charges(tenant_id, is_opening_balance)');
        }
    }

    public function down()
    {
        // Drop index if it exists
        $indexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_opening_balance'")->getResultArray();
        if (!empty($indexes)) {
            $this->db->query('DROP INDEX idx_charges_opening_balance ON charges');
        }
        
        // Drop column if it exists
        if ($this->db->fieldExists('is_opening_balance', 'charges')) {
            $this->forge->dropColumn('charges', 'is_opening_balance');
        }
    }
}

<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add term_id column to charges table
 * 
 * This enables direct term-based queries instead of relying on date ranges
 * which is more accurate and performant for checking if charges exist for a term.
 */
class AddTermIdToCharges extends Migration
{
    public function up()
    {
        // Only add column if it doesn't exist
        if (!$this->db->fieldExists('term_id', 'charges')) {
            $this->forge->addColumn('charges', [
                'term_id' => [
                    'type' => 'VARCHAR',
                    'constraint' => 50,
                    'null' => true,
                    'after' => 'student_id',
                ],
            ]);
        }

        // Add indexes if they don't exist (check via SHOW INDEX)
        $indexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_term_id'")->getResultArray();
        if (empty($indexes)) {
            $this->db->query('CREATE INDEX idx_charges_term_id ON charges(term_id)');
        }

        $indexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_tenant_term'")->getResultArray();
        if (empty($indexes)) {
            $this->db->query('CREATE INDEX idx_charges_tenant_term ON charges(tenant_id, term_id)');
        }
    }

    public function down()
    {
        // Drop indexes if they exist
        $indexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_term_id'")->getResultArray();
        if (!empty($indexes)) {
            $this->db->query('DROP INDEX idx_charges_term_id ON charges');
        }

        $indexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_tenant_term'")->getResultArray();
        if (!empty($indexes)) {
            $this->db->query('DROP INDEX idx_charges_tenant_term ON charges');
        }
        
        // Drop column if it exists
        if ($this->db->fieldExists('term_id', 'charges')) {
            $this->forge->dropColumn('charges', 'term_id');
        }
    }
}

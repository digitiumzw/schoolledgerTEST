<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Improve Charges Schema
 * 
 * This migration enhances the charges table to follow standard billing schema patterns:
 * 1. Adds charge_type ENUM to replace is_fee_structure/is_transport booleans
 * 2. Adds status field for charge lifecycle tracking
 * 3. Adds due_date for payment reminders and aging reports
 * 4. Adds academic_session field for proper financial reporting
 * 5. Adds term field for term-based billing
 * 6. Adds performance indexes
 * 7. Adds foreign key constraints for data integrity
 */
class ImproveChargesSchema extends Migration
{
    public function up()
    {
        // Add new columns to charges table
        $this->forge->addColumn('charges', [
            'charge_type' => [
                'type' => 'ENUM',
                'constraint' => ['fee_structure', 'transport', 'other'],
                'default' => 'other',
                'after' => 'category',
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['pending', 'partial', 'paid', 'waived', 'cancelled'],
                'default' => 'pending',
                'after' => 'charge_type',
            ],
            'due_date' => [
                'type' => 'DATE',
                'null' => true,
                'after' => 'date_generated',
            ],
            'academic_session' => [
                'type' => 'VARCHAR',
                'constraint' => 20,
                'null' => true,
                'after' => 'due_date',
                'comment' => 'e.g., 2024/2025',
            ],
            'term' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
                'after' => 'academic_session',
                'comment' => 'Term name for reference',
            ],
        ]);

        // Migrate existing data: set charge_type based on is_fee_structure and is_transport
        $this->db->query("
            UPDATE charges 
            SET charge_type = CASE 
                WHEN is_transport = 1 OR is_transport = true THEN 'transport'
                WHEN is_fee_structure = 1 THEN 'fee_structure'
                ELSE 'other'
            END
        ");

        // Set default status to 'pending' for existing charges
        // (The column default handles this, but we ensure consistency)
        $this->db->query("UPDATE charges SET status = 'pending' WHERE status IS NULL OR status = ''");

        // Add indexes for better query performance
        $this->db->query("CREATE INDEX idx_charges_charge_type ON charges(charge_type)");
        $this->db->query("CREATE INDEX idx_charges_status ON charges(status)");
        $this->db->query("CREATE INDEX idx_charges_date_generated ON charges(date_generated)");
        $this->db->query("CREATE INDEX idx_charges_due_date ON charges(due_date)");
        $this->db->query("CREATE INDEX idx_charges_deleted_at ON charges(deleted_at)");
        $this->db->query("CREATE INDEX idx_charges_academic_session ON charges(academic_session)");

        // Add foreign key for route_id if it doesn't exist
        // Check if the constraint already exists before adding
        try {
            $this->db->query("
                ALTER TABLE charges 
                ADD CONSTRAINT fk_charges_route 
                FOREIGN KEY (route_id) REFERENCES transport_routes(id) 
                ON DELETE SET NULL ON UPDATE CASCADE
            ");
        } catch (\Exception $e) {
            // Constraint may already exist, ignore
        }

        // Add foreign key for created_by if it doesn't exist
        try {
            $this->db->query("
                ALTER TABLE charges 
                ADD CONSTRAINT fk_charges_created_by 
                FOREIGN KEY (created_by) REFERENCES users(id) 
                ON DELETE SET NULL ON UPDATE CASCADE
            ");
        } catch (\Exception $e) {
            // Constraint may already exist, ignore
        }
    }

    public function down()
    {
        // Remove foreign keys first
        try {
            $this->db->query("ALTER TABLE charges DROP FOREIGN KEY fk_charges_route");
        } catch (\Exception $e) {}
        
        try {
            $this->db->query("ALTER TABLE charges DROP FOREIGN KEY fk_charges_created_by");
        } catch (\Exception $e) {}

        // Remove indexes
        try {
            $this->db->query("DROP INDEX idx_charges_charge_type ON charges");
            $this->db->query("DROP INDEX idx_charges_status ON charges");
            $this->db->query("DROP INDEX idx_charges_date_generated ON charges");
            $this->db->query("DROP INDEX idx_charges_due_date ON charges");
            $this->db->query("DROP INDEX idx_charges_deleted_at ON charges");
            $this->db->query("DROP INDEX idx_charges_academic_session ON charges");
        } catch (\Exception $e) {}

        // Remove new columns
        $this->forge->dropColumn('charges', ['charge_type', 'status', 'due_date', 'academic_session', 'term']);
    }
}

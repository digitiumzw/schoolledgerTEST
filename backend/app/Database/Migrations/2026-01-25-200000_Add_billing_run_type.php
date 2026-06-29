<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add run_type to billing_runs table
 * 
 * Supports:
 * - primary: Initial term billing run (locked)
 * - supplementary: Additional billing for late enrollees
 */
class AddBillingRunType extends Migration
{
    public function up()
    {
        // Add run_type column if not exists
        if (!$this->db->fieldExists('run_type', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'run_type' => [
                    'type' => 'ENUM',
                    'constraint' => ['primary', 'supplementary'],
                    'default' => 'primary',
                    'after' => 'status',
                ],
            ]);
        }

        // Add parent_billing_run_id for supplementary runs to reference primary
        if (!$this->db->fieldExists('parent_billing_run_id', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'parent_billing_run_id' => [
                    'type' => 'VARCHAR',
                    'constraint' => 50,
                    'null' => true,
                    'after' => 'run_type',
                    'comment' => 'References the primary billing run for supplementary runs',
                ],
            ]);
        }

        // Add proration_type to track how late enrollment fees were calculated
        if (!$this->db->fieldExists('proration_type', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'proration_type' => [
                    'type' => 'ENUM',
                    'constraint' => ['full', 'prorated', 'manual'],
                    'default' => 'full',
                    'null' => true,
                    'after' => 'parent_billing_run_id',
                ],
            ]);
        }

        // Add is_late_enrollment flag to charges for easy filtering
        if (!$this->db->fieldExists('is_late_enrollment', 'charges')) {
            $this->forge->addColumn('charges', [
                'is_late_enrollment' => [
                    'type' => 'TINYINT',
                    'constraint' => 1,
                    'default' => 0,
                    'after' => 'is_fee_structure',
                ],
            ]);
        }

        // Add enrollment_date tracking to charges
        if (!$this->db->fieldExists('student_enrollment_date', 'charges')) {
            $this->forge->addColumn('charges', [
                'student_enrollment_date' => [
                    'type' => 'DATE',
                    'null' => true,
                    'after' => 'is_late_enrollment',
                    'comment' => 'Student enrollment date at time of charge generation',
                ],
            ]);
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('run_type', 'billing_runs')) {
            $this->forge->dropColumn('billing_runs', 'run_type');
        }
        if ($this->db->fieldExists('parent_billing_run_id', 'billing_runs')) {
            $this->forge->dropColumn('billing_runs', 'parent_billing_run_id');
        }
        if ($this->db->fieldExists('proration_type', 'billing_runs')) {
            $this->forge->dropColumn('billing_runs', 'proration_type');
        }
        if ($this->db->fieldExists('is_late_enrollment', 'charges')) {
            $this->forge->dropColumn('charges', 'is_late_enrollment');
        }
        if ($this->db->fieldExists('student_enrollment_date', 'charges')) {
            $this->forge->dropColumn('charges', 'student_enrollment_date');
        }
    }
}

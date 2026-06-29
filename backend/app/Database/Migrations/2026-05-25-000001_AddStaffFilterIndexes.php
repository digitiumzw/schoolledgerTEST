<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddStaffFilterIndexes extends Migration
{
    public function up()
    {
        $this->db->query('ALTER TABLE staff ADD INDEX idx_staff_tenant_status (tenant_id, employment_status)');
        $this->db->query('ALTER TABLE staff ADD INDEX idx_staff_tenant_dept (tenant_id, department)');
        $this->db->query('ALTER TABLE staff ADD INDEX idx_staff_tenant_teaching (tenant_id, is_teaching)');
        $this->db->query('ALTER TABLE staff ADD INDEX idx_staff_tenant_first (tenant_id, first_name)');
        $this->db->query('ALTER TABLE staff ADD INDEX idx_staff_tenant_last (tenant_id, last_name)');
    }

    public function down()
    {
        foreach ([
            'idx_staff_tenant_status',
            'idx_staff_tenant_dept',
            'idx_staff_tenant_teaching',
            'idx_staff_tenant_first',
            'idx_staff_tenant_last',
        ] as $index) {
            try {
                $this->db->query("ALTER TABLE staff DROP INDEX {$index}");
            } catch (\Throwable $e) {
            }
        }
    }
}

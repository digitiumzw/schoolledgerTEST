<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class FixEmployeeIdUniqueConstraint extends Migration
{
    public function up()
    {
        // Drop the global unique constraint — employee_id only needs to be unique per tenant
        $this->db->query('ALTER TABLE staff DROP INDEX employee_id');

        // Add composite unique index scoped to tenant
        $this->db->query('ALTER TABLE staff ADD UNIQUE KEY uq_tenant_employee_id (tenant_id, employee_id)');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE staff DROP INDEX uq_tenant_employee_id');
        $this->db->query('ALTER TABLE staff ADD UNIQUE KEY employee_id (employee_id)');
    }
}

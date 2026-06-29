<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPerformanceIndexes extends Migration
{
    public function up()
    {
        // Add composite index for students table to optimize class queries
        $this->db->query('ALTER TABLE students ADD INDEX idx_class_status (class_id, status)');
        
        // Add composite index for enrollments table to optimize student status queries
        $this->db->query('ALTER TABLE enrollments ADD INDEX idx_id_status (id, status)');
        
        // Add index for current_enrollment_id in students table for faster joins
        $this->db->query('ALTER TABLE students ADD INDEX idx_current_enrollment (current_enrollment_id)');
        
        // Add composite index for tenant_id in students table for multi-tenant queries
        $this->db->query('ALTER TABLE students ADD INDEX idx_tenant_status (tenant_id, status)');
    }

    public function down()
    {
        // Remove the indexes
        try {
            $this->db->query('ALTER TABLE students DROP INDEX idx_class_status');
        } catch (\Throwable $e) {
        }
        try {
            $this->db->query('ALTER TABLE enrollments DROP INDEX idx_id_status');
        } catch (\Throwable $e) {
        }
        try {
            $this->db->query('ALTER TABLE students DROP INDEX idx_current_enrollment');
        } catch (\Throwable $e) {
        }
        try {
            $this->db->query('ALTER TABLE students DROP INDEX idx_tenant_status');
        } catch (\Throwable $e) {
        }
    }
}

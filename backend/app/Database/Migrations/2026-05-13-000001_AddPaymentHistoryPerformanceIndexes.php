<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPaymentHistoryPerformanceIndexes extends Migration
{
    public function up(): void
    {
        $this->addIndexIfMissing('payments', 'idx_payments_tenant_date', 'CREATE INDEX idx_payments_tenant_date ON payments (tenant_id, date, created_at)');
        $this->addIndexIfMissing('payments', 'idx_payments_tenant_student_date', 'CREATE INDEX idx_payments_tenant_student_date ON payments (tenant_id, student_id, date, created_at)');
        $this->addIndexIfMissing('payments', 'idx_payments_tenant_method_date', 'CREATE INDEX idx_payments_tenant_method_date ON payments (tenant_id, method, date)');
        $this->addIndexIfMissing('payments', 'idx_payments_tenant_category_date', 'CREATE INDEX idx_payments_tenant_category_date ON payments (tenant_id, category, date)');
        $this->addIndexIfMissing('payments', 'idx_payments_tenant_receipt', 'CREATE INDEX idx_payments_tenant_receipt ON payments (tenant_id, receipt_number)');
        $this->addIndexIfMissing('students', 'idx_students_tenant_class_name', 'CREATE INDEX idx_students_tenant_class_name ON students (tenant_id, class_id, first_name, last_name)');
    }

    public function down(): void
    {
        $this->dropIndexIfExists('students', 'idx_students_tenant_class_name');
        $this->dropIndexIfExists('payments', 'idx_payments_tenant_receipt');
        $this->dropIndexIfExists('payments', 'idx_payments_tenant_category_date');
        $this->dropIndexIfExists('payments', 'idx_payments_tenant_method_date');
        $this->dropIndexIfExists('payments', 'idx_payments_tenant_student_date');
        $this->dropIndexIfExists('payments', 'idx_payments_tenant_date');
    }

    private function addIndexIfMissing(string $table, string $index, string $sql): void
    {
        $existing = $this->db->query("SHOW INDEX FROM {$table} WHERE Key_name = ?", [$index])->getResultArray();
        if (empty($existing)) {
            $this->db->query($sql);
        }
    }

    private function dropIndexIfExists(string $table, string $index): void
    {
        $existing = $this->db->query("SHOW INDEX FROM {$table} WHERE Key_name = ?", [$index])->getResultArray();
        if (!empty($existing)) {
            $this->db->query("DROP INDEX {$index} ON {$table}");
        }
    }
}

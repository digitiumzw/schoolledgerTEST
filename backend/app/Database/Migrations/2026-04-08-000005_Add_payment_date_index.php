<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add index on payments(tenant_id, date).
 *
 * Supports date-range filtering in report queries:
 * - LedgerService::getPaymentCollectionReport()
 * - PaymentController::termTotal() (after academic calendar fix)
 */
class Add_payment_date_index extends Migration
{
    public function up(): void
    {
        $this->forge->addKey(['tenant_id', 'date'], false, false, 'idx_payments_date');
        $this->forge->processIndexes('payments');
    }

    public function down(): void
    {
        $this->db->query('ALTER TABLE payments DROP INDEX idx_payments_date');
    }
}

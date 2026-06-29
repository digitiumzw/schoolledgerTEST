<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add composite index on charges(tenant_id, charge_type, status).
 *
 * This index supports FIFO allocation queries in LedgerService::allocatePaymentToCharges()
 * and charge-type-filtered balance queries in LedgerService::getStudentBalance().
 */
class Add_charge_type_indexes extends Migration
{
    public function up(): void
    {
        $exists = $this->db->query("
            SELECT COUNT(*) as cnt
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
              AND table_name = 'charges'
              AND index_name = 'idx_charges_charge_type'
        ")->getRow()->cnt;

        if (!$exists) {
            $this->forge->addKey(['tenant_id', 'charge_type', 'status'], false, false, 'idx_charges_charge_type');
            $this->forge->processIndexes('charges');
        }
    }

    public function down(): void
    {
        try {
            $this->db->query('ALTER TABLE charges DROP INDEX idx_charges_charge_type');
        } catch (\Throwable $e) {
        }
    }
}

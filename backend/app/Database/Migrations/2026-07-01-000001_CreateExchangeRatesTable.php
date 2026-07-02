<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Migration: Create exchange_rates table for multi-currency support (Feature 094).
 *
 * Stores historical, date-effective exchange rates per tenant per transaction currency.
 * Rate is expressed as "1 base currency = rate_to_base transaction currency" (research.md §5).
 * The composite index supports both the "rate for date" lookup
 * (ORDER BY effective_date DESC LIMIT 1) and the rate-history list view (FR-010).
 */
class CreateExchangeRatesTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'currency_code' => [
                'type'       => 'VARCHAR',
                'constraint' => 10,
                'null'       => false,
                'comment'    => 'Transaction currency code (never the base currency itself)',
            ],
            'rate_to_base' => [
                'type'       => 'DECIMAL',
                'constraint' => '18,6',
                'null'       => false,
                'comment'    => '1 base currency = rate_to_base currency_code',
            ],
            'effective_date' => [
                'type' => 'DATE',
                'null' => false,
            ],
            'created_by' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => true,
                'comment'    => 'User id who entered the rate',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->createTable('exchange_rates');

        // Composite index for date-range lookups and rate history listing
        $this->db->query(
            'CREATE INDEX idx_exchange_rates_lookup ON exchange_rates (tenant_id, currency_code, effective_date)'
        );

        // Unique constraint: one rate per (tenant, currency, date) — FR-008
        $this->db->query(
            'CREATE UNIQUE INDEX uq_exchange_rates_tenant_currency_date ON exchange_rates (tenant_id, currency_code, effective_date)'
        );
    }

    public function down(): void
    {
        $this->db->query('DROP INDEX uq_exchange_rates_tenant_currency_date ON exchange_rates');
        $this->db->query('DROP INDEX idx_exchange_rates_lookup ON exchange_rates');
        $this->forge->dropTable('exchange_rates');
    }
}

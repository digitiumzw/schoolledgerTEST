<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Migration: Add multi-currency provenance columns to charges and payments (Feature 094).
 *
 * All four columns are nullable. NULL means the transaction was recorded in the tenant's
 * base currency (equivalent to exchange_rate = 1.0, original_amount = amount).
 * The existing `amount` column is UNCHANGED in meaning — it always holds the base-currency
 * equivalent, so all existing LedgerService SUM(amount) queries continue to work correctly
 * without modification (research.md §4, data-model.md §3).
 */
class AddCurrencyFieldsToChargesAndPayments extends Migration
{
    private function addCurrencyColumns(string $table): void
    {
        if (!$this->db->fieldExists('currency_code', $table)) {
            $this->forge->addColumn($table, [
                'currency_code' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 10,
                    'null'       => true,
                    'default'    => null,
                    'comment'    => 'Transaction currency code; NULL = base currency',
                ],
            ]);
        }
        if (!$this->db->fieldExists('original_amount', $table)) {
            $this->forge->addColumn($table, [
                'original_amount' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '12,2',
                    'null'       => true,
                    'default'    => null,
                    'comment'    => 'Amount in currency_code; NULL when currency_code is NULL',
                ],
            ]);
        }
        if (!$this->db->fieldExists('exchange_rate', $table)) {
            $this->forge->addColumn($table, [
                'exchange_rate' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '18,6',
                    'null'       => true,
                    'default'    => null,
                    'comment'    => 'Rate applied at creation (immutable); NULL/1.0 for base currency',
                ],
            ]);
        }
        if (!$this->db->fieldExists('rate_manual_override', $table)) {
            $this->forge->addColumn($table, [
                'rate_manual_override' => [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'null'       => false,
                    'default'    => 0,
                    'comment'    => '1 = user manually overrode the auto-applied rate (FR-014)',
                ],
            ]);
        }
    }

    private function dropCurrencyColumns(string $table): void
    {
        if ($this->db->fieldExists('rate_manual_override', $table)) {
            $this->forge->dropColumn($table, 'rate_manual_override');
        }
        if ($this->db->fieldExists('exchange_rate', $table)) {
            $this->forge->dropColumn($table, 'exchange_rate');
        }
        if ($this->db->fieldExists('original_amount', $table)) {
            $this->forge->dropColumn($table, 'original_amount');
        }
        if ($this->db->fieldExists('currency_code', $table)) {
            $this->forge->dropColumn($table, 'currency_code');
        }
    }

    public function up(): void
    {
        $this->addCurrencyColumns('charges');
        $this->addCurrencyColumns('payments');
    }

    public function down(): void
    {
        $this->dropCurrencyColumns('payments');
        $this->dropCurrencyColumns('charges');
    }
}

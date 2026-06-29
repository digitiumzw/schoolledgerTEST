<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Migration: Add Reconciliation Tables
 * 
 * Creates tables for tracking financial adjustments, refunds, and audit logs
 * to support reconciliation features without mutating original records.
 */
class AddReconciliationTables extends Migration
{
    public function up()
    {
        // ============================================
        // LEDGER ADJUSTMENTS TABLE
        // ============================================
        // Stores all balance adjustments (credits/debits) for audit trail
        // Original charges/payments are NEVER mutated - only adjustments are added
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'student_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'adjustment_type' => [
                'type' => 'ENUM',
                'constraint' => ['credit', 'debit'],
                'comment' => 'credit = reduces balance (favor student), debit = increases balance (favor school)'
            ],
            'category' => [
                'type' => 'ENUM',
                'constraint' => ['correction', 'refund', 'write_off', 'fee_waiver', 'late_fee', 'penalty', 'discount', 'other'],
                'default' => 'correction',
            ],
            'amount' => [
                'type' => 'DECIMAL',
                'constraint' => '10,2',
            ],
            'reason' => [
                'type' => 'TEXT',
                'null' => false,
                'comment' => 'Required explanation for audit purposes'
            ],
            'reference_type' => [
                'type' => 'ENUM',
                'constraint' => ['charge', 'payment', 'none'],
                'default' => 'none',
                'comment' => 'Type of original transaction this adjustment relates to'
            ],
            'reference_id' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
                'null' => true,
                'comment' => 'ID of the original charge or payment being adjusted'
            ],
            'term_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'effective_date' => [
                'type' => 'DATE',
                'null' => false,
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['pending', 'approved', 'rejected', 'voided'],
                'default' => 'approved',
            ],
            'approved_by' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'approved_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'voided_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'voided_by' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'void_reason' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'created_by' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
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
        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'student_id']);
        $this->forge->addKey(['tenant_id', 'created_at']);
        $this->forge->addKey('reference_id');
        $this->forge->addKey('category');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('student_id', 'students', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('ledger_adjustments');

        // ============================================
        // REFUNDS TABLE
        // ============================================
        // Tracks refund transactions separately for clear financial reporting
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'student_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'refund_type' => [
                'type' => 'ENUM',
                'constraint' => ['full', 'partial'],
            ],
            'amount' => [
                'type' => 'DECIMAL',
                'constraint' => '10,2',
            ],
            'original_payment_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
                'comment' => 'Links to original payment being refunded'
            ],
            'original_charge_id' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
                'null' => true,
                'comment' => 'Links to original charge being refunded'
            ],
            'reason' => [
                'type' => 'TEXT',
                'null' => false,
            ],
            'refund_method' => [
                'type' => 'ENUM',
                'constraint' => ['cash', 'bank_transfer', 'check', 'credit_note', 'other'],
                'default' => 'credit_note',
            ],
            'reference_number' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
                'null' => true,
                'comment' => 'External reference (check number, transfer ID, etc.)'
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['pending', 'processed', 'completed', 'cancelled'],
                'default' => 'pending',
            ],
            'processed_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'processed_by' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'adjustment_id' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
                'null' => true,
                'comment' => 'Links to the ledger adjustment created for this refund'
            ],
            'created_by' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
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
        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'student_id']);
        $this->forge->addKey('original_payment_id');
        $this->forge->addKey('original_charge_id');
        $this->forge->addKey('status');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('student_id', 'students', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('refunds');

        // ============================================
        // RECONCILIATION AUDIT LOG
        // ============================================
        // Comprehensive audit trail for all financial actions
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'action_type' => [
                'type' => 'ENUM',
                'constraint' => [
                    'adjustment_created',
                    'adjustment_approved',
                    'adjustment_rejected',
                    'adjustment_voided',
                    'refund_initiated',
                    'refund_processed',
                    'refund_completed',
                    'refund_cancelled',
                    'balance_recalculated',
                    'charge_voided',
                    'payment_voided',
                    'manual_override'
                ],
            ],
            'entity_type' => [
                'type' => 'ENUM',
                'constraint' => ['adjustment', 'refund', 'charge', 'payment', 'student'],
            ],
            'entity_id' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'student_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'amount' => [
                'type' => 'DECIMAL',
                'constraint' => '10,2',
                'null' => true,
            ],
            'balance_before' => [
                'type' => 'DECIMAL',
                'constraint' => '10,2',
                'null' => true,
            ],
            'balance_after' => [
                'type' => 'DECIMAL',
                'constraint' => '10,2',
                'null' => true,
            ],
            'details' => [
                'type' => 'JSON',
                'null' => true,
                'comment' => 'Additional context stored as JSON'
            ],
            'ip_address' => [
                'type' => 'VARCHAR',
                'constraint' => 45,
                'null' => true,
            ],
            'user_agent' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'performed_by' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'performed_at' => [
                'type' => 'DATETIME',
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'performed_at']);
        $this->forge->addKey(['entity_type', 'entity_id']);
        $this->forge->addKey('student_id');
        $this->forge->addKey('action_type');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('reconciliation_audit_log');

        // Add indexes for common queries
        $this->db->query('CREATE INDEX idx_adjustments_date ON ledger_adjustments(effective_date)');
        $this->db->query('CREATE INDEX idx_audit_date ON reconciliation_audit_log(performed_at)');
    }

    public function down()
    {
        // Drop indexes first
        try {
            $this->db->query('DROP INDEX idx_adjustments_date ON ledger_adjustments');
        } catch (\Throwable $e) {
        }
        try {
            $this->db->query('DROP INDEX idx_audit_date ON reconciliation_audit_log');
        } catch (\Throwable $e) {
        }

        // Drop tables in reverse order
        $this->forge->dropTable('reconciliation_audit_log', true);
        $this->forge->dropTable('refunds', true);
        $this->forge->dropTable('ledger_adjustments', true);
    }
}

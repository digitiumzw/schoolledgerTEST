<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;

/**
 * ReconciliationController
 * 
 * Handles all reconciliation operations including:
 * - Balance adjustments (credits/debits)
 * - Refund processing (full/partial)
 * - Audit trail management
 * - Balance recalculation
 * 
 * Key principle: Original records are NEVER mutated. All corrections
 * are made through adjustment entries to preserve audit trail.
 */
class ReconciliationController extends BaseApiController
{
    protected $db;

    public function initController(\CodeIgniter\HTTP\RequestInterface $request, \CodeIgniter\HTTP\ResponseInterface $response, \Psr\Log\LoggerInterface $logger)
    {
        parent::initController($request, $response, $logger);
        $this->db = Config::connect();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADJUSTMENTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/reconciliation/adjustments
     * List all adjustments with optional filters
     */
    public function getAdjustments()
    {
        $tenantId = $this->getTenantId();
        $studentId = $this->request->getGet('studentId');
        $category = $this->request->getGet('category');
        $status = $this->request->getGet('status');
        $fromDate = $this->request->getGet('fromDate');
        $toDate = $this->request->getGet('toDate');

        $builder = $this->db->table('ledger_adjustments la')
            ->select('la.*, s.first_name, s.last_name, u.name as created_by_name')
            ->join('students s', 's.id = la.student_id', 'left')
            ->join('users u', 'u.id = la.created_by', 'left')
            ->where('la.tenant_id', $tenantId)
            ->orderBy('la.created_at', 'DESC');

        if ($studentId) {
            $builder->where('la.student_id', $studentId);
        }
        if ($category) {
            $builder->where('la.category', $category);
        }
        if ($status) {
            $builder->where('la.status', $status);
        }
        if ($fromDate) {
            $builder->where('la.effective_date >=', $fromDate);
        }
        if ($toDate) {
            $builder->where('la.effective_date <=', $toDate);
        }

        $adjustments = $builder->get()->getResultArray();

        $formatted = array_map(function($adj) {
            return [
                'id' => $adj['id'],
                'studentId' => $adj['student_id'],
                'studentName' => trim(($adj['first_name'] ?? '') . ' ' . ($adj['last_name'] ?? '')),
                'adjustmentType' => $adj['adjustment_type'],
                'category' => $adj['category'],
                'amount' => (float) $adj['amount'],
                'reason' => $adj['reason'],
                'referenceType' => $adj['reference_type'],
                'referenceId' => $adj['reference_id'],
                'termId' => $adj['term_id'],
                'effectiveDate' => $adj['effective_date'],
                'status' => $adj['status'],
                'approvedBy' => $adj['approved_by'],
                'approvedAt' => $adj['approved_at'],
                'createdBy' => $adj['created_by'],
                'createdByName' => $adj['created_by_name'],
                'createdAt' => $adj['created_at'],
            ];
        }, $adjustments);

        return $this->success($formatted);
    }

    /**
     * GET /api/reconciliation/adjustments/:id
     * Get single adjustment details
     */
    public function getAdjustment($id = null)
    {
        $tenantId = $this->getTenantId();

        $adjustment = $this->db->table('ledger_adjustments la')
            ->select('la.*, s.first_name, s.last_name, u.name as created_by_name')
            ->join('students s', 's.id = la.student_id', 'left')
            ->join('users u', 'u.id = la.created_by', 'left')
            ->where('la.id', $id)
            ->where('la.tenant_id', $tenantId)
            ->get()->getRow();

        if (!$adjustment) {
            return $this->notFound('Adjustment not found');
        }

        return $this->success([
            'id' => $adjustment->id,
            'studentId' => $adjustment->student_id,
            'studentName' => trim($adjustment->first_name . ' ' . $adjustment->last_name),
            'adjustmentType' => $adjustment->adjustment_type,
            'category' => $adjustment->category,
            'amount' => (float) $adjustment->amount,
            'reason' => $adjustment->reason,
            'referenceType' => $adjustment->reference_type,
            'referenceId' => $adjustment->reference_id,
            'termId' => $adjustment->term_id,
            'effectiveDate' => $adjustment->effective_date,
            'status' => $adjustment->status,
            'approvedBy' => $adjustment->approved_by,
            'approvedAt' => $adjustment->approved_at,
            'voidedAt' => $adjustment->voided_at,
            'voidedBy' => $adjustment->voided_by,
            'voidReason' => $adjustment->void_reason,
            'createdBy' => $adjustment->created_by,
            'createdByName' => $adjustment->created_by_name,
            'createdAt' => $adjustment->created_at,
        ]);
    }

    /**
     * POST /api/reconciliation/adjustments
     * Create a new balance adjustment
     */
    public function createAdjustment()
    {
        try {
            $tenantId = $this->getTenantId();
            $user = $this->getCurrentUser();
            $data = $this->request->getJSON(true) ?? $this->request->getPost();

            // Validate required fields
            if (empty($data['studentId'])) {
                return $this->error('Student ID is required', 400);
            }
            if (empty($data['adjustmentType']) || !in_array($data['adjustmentType'], ['credit', 'debit'])) {
                return $this->error('Valid adjustment type (credit/debit) is required', 400);
            }
            if (empty($data['amount']) || (float)$data['amount'] <= 0) {
                return $this->error('Valid positive amount is required', 400);
            }
            if (empty($data['reason'])) {
                return $this->error('Reason is required for audit purposes', 400);
            }
            if (empty($data['category'])) {
                return $this->error('Category is required', 400);
            }

            // Verify student exists
            $student = $this->db->table('students')
                ->where('id', $data['studentId'])
                ->where('tenant_id', $tenantId)
                ->get()->getRow();

            if (!$student) {
                return $this->error('Student not found', 404);
            }

            // Get balance before adjustment
            $balanceBefore = $this->calculateStudentBalance($data['studentId'], $tenantId);

            $now = date('Y-m-d H:i:s');
            $adjustmentId = $this->generateId('adj');

            $this->db->transStart();

            // Create adjustment record
            $adjustmentData = [
                'id' => $adjustmentId,
                'tenant_id' => $tenantId,
                'student_id' => $data['studentId'],
                'adjustment_type' => $data['adjustmentType'],
                'category' => $data['category'],
                'amount' => (float) $data['amount'],
                'reason' => $data['reason'],
                'reference_type' => $data['referenceType'] ?? 'none',
                'reference_id' => $data['referenceId'] ?? null,
                'term_id' => $data['termId'] ?? null,
                'effective_date' => $data['effectiveDate'] ?? date('Y-m-d'),
                'status' => 'approved', // Auto-approve for now
                'approved_by' => $user->id ?? 'system',
                'approved_at' => $now,
                'created_by' => $user->id ?? 'system',
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $this->db->table('ledger_adjustments')->insert($adjustmentData);

            $ledgerService = new \App\Services\LedgerService($this->db);
            $ledgerService->allocateAdjustmentsForStudent($data['studentId'], $tenantId);

            // Calculate new balance
            $balanceAfter = $this->calculateStudentBalance($data['studentId'], $tenantId);

            // Log the action
            $this->logAuditAction([
                'tenant_id' => $tenantId,
                'action_type' => 'adjustment_created',
                'entity_type' => 'adjustment',
                'entity_id' => $adjustmentId,
                'student_id' => $data['studentId'],
                'amount' => (float) $data['amount'],
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'details' => json_encode([
                    'adjustment_type' => $data['adjustmentType'],
                    'category' => $data['category'],
                    'reason' => $data['reason'],
                    'reference_type' => $data['referenceType'] ?? 'none',
                    'reference_id' => $data['referenceId'] ?? null,
                ]),
                'performed_by' => $user->id ?? 'system',
            ]);

            $this->db->transComplete();

            if ($this->db->transStatus() === false) {
                return $this->error('Failed to create adjustment', 500);
            }

            return $this->created([
                'id' => $adjustmentId,
                'balanceBefore' => $balanceBefore,
                'balanceAfter' => $balanceAfter,
                'message' => 'Adjustment created successfully',
            ]);

        } catch (\Exception $e) {
            log_message('error', 'Error creating adjustment: ' . $e->getMessage());
            return $this->error('Failed to create adjustment: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/reconciliation/adjustments/:id/void
     * Void an adjustment (reverse its effect)
     */
    public function voidAdjustment($id = null)
    {
        try {
            $tenantId = $this->getTenantId();
            $user = $this->getCurrentUser();
            $data = $this->request->getJSON(true) ?? $this->request->getPost();

            if (empty($data['reason'])) {
                return $this->error('Void reason is required', 400);
            }

            $adjustment = $this->db->table('ledger_adjustments')
                ->where('id', $id)
                ->where('tenant_id', $tenantId)
                ->get()->getRow();

            if (!$adjustment) {
                return $this->notFound('Adjustment not found');
            }

            if ($adjustment->status === 'voided') {
                return $this->error('Adjustment is already voided', 400);
            }

            $balanceBefore = $this->calculateStudentBalance($adjustment->student_id, $tenantId);

            $now = date('Y-m-d H:i:s');

            $this->db->transStart();

            // Void the adjustment
            $this->db->table('ledger_adjustments')
                ->where('id', $id)
                ->update([
                    'status' => 'voided',
                    'voided_at' => $now,
                    'voided_by' => $user->id ?? 'system',
                    'void_reason' => $data['reason'],
                    'updated_at' => $now,
                ]);

            $ledgerService = new \App\Services\LedgerService($this->db);
            $ledgerService->allocateAdjustmentsForStudent($adjustment->student_id, $tenantId);

            $balanceAfter = $this->calculateStudentBalance($adjustment->student_id, $tenantId);

            // Log the void action
            $this->logAuditAction([
                'tenant_id' => $tenantId,
                'action_type' => 'adjustment_voided',
                'entity_type' => 'adjustment',
                'entity_id' => $id,
                'student_id' => $adjustment->student_id,
                'amount' => (float) $adjustment->amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'details' => json_encode(['void_reason' => $data['reason']]),
                'performed_by' => $user->id ?? 'system',
            ]);

            $this->db->transComplete();

            if ($this->db->transStatus() === false) {
                return $this->error('Failed to void adjustment', 500);
            }

            return $this->success([
                'message' => 'Adjustment voided successfully',
                'balanceBefore' => $balanceBefore,
                'balanceAfter' => $balanceAfter,
            ]);

        } catch (\Exception $e) {
            log_message('error', 'Error voiding adjustment: ' . $e->getMessage());
            return $this->error('Failed to void adjustment: ' . $e->getMessage(), 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REFUNDS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/reconciliation/refunds
     * List all refunds with optional filters
     */
    public function getRefunds()
    {
        $tenantId = $this->getTenantId();
        $studentId = $this->request->getGet('studentId');
        $status = $this->request->getGet('status');

        $builder = $this->db->table('refunds r')
            ->select('r.*, s.first_name, s.last_name, u.name as created_by_name')
            ->join('students s', 's.id = r.student_id', 'left')
            ->join('users u', 'u.id = r.created_by', 'left')
            ->where('r.tenant_id', $tenantId)
            ->orderBy('r.created_at', 'DESC');

        if ($studentId) {
            $builder->where('r.student_id', $studentId);
        }
        if ($status) {
            $builder->where('r.status', $status);
        }

        $refunds = $builder->get()->getResultArray();

        $formatted = array_map(function($ref) {
            return [
                'id' => $ref['id'],
                'studentId' => $ref['student_id'],
                'studentName' => trim(($ref['first_name'] ?? '') . ' ' . ($ref['last_name'] ?? '')),
                'refundType' => $ref['refund_type'],
                'amount' => (float) $ref['amount'],
                'originalPaymentId' => $ref['original_payment_id'],
                'originalChargeId' => $ref['original_charge_id'],
                'reason' => $ref['reason'],
                'refundMethod' => $ref['refund_method'],
                'referenceNumber' => $ref['reference_number'],
                'status' => $ref['status'],
                'processedAt' => $ref['processed_at'],
                'processedBy' => $ref['processed_by'],
                'adjustmentId' => $ref['adjustment_id'],
                'createdBy' => $ref['created_by'],
                'createdByName' => $ref['created_by_name'],
                'createdAt' => $ref['created_at'],
            ];
        }, $refunds);

        return $this->success($formatted);
    }

    /**
     * POST /api/reconciliation/refunds
     * Create a new refund
     */
    public function createRefund()
    {
        try {
            $tenantId = $this->getTenantId();
            $user = $this->getCurrentUser();
            $data = $this->request->getJSON(true) ?? $this->request->getPost();

            // Validate required fields
            if (empty($data['studentId'])) {
                return $this->error('Student ID is required', 400);
            }
            if (empty($data['amount']) || (float)$data['amount'] <= 0) {
                return $this->error('Valid positive amount is required', 400);
            }
            if (empty($data['reason'])) {
                return $this->error('Reason is required', 400);
            }
            if (empty($data['refundType']) || !in_array($data['refundType'], ['full', 'partial'])) {
                return $this->error('Valid refund type (full/partial) is required', 400);
            }

            // Verify student exists
            $student = $this->db->table('students')
                ->where('id', $data['studentId'])
                ->where('tenant_id', $tenantId)
                ->get()->getRow();

            if (!$student) {
                return $this->error('Student not found', 404);
            }

            // If linked to a payment, validate it
            $originalPayment = null;
            if (!empty($data['originalPaymentId'])) {
                $originalPayment = $this->db->table('payments')
                    ->where('id', $data['originalPaymentId'])
                    ->where('tenant_id', $tenantId)
                    ->where('student_id', $data['studentId'])
                    ->get()->getRow();

                if (!$originalPayment) {
                    return $this->error('Original payment not found', 404);
                }

                // Check if refund amount doesn't exceed original payment
                $existingRefunds = $this->db->table('refunds')
                    ->selectSum('amount')
                    ->where('original_payment_id', $data['originalPaymentId'])
                    ->whereNotIn('status', ['cancelled'])
                    ->get()->getRow()->amount ?? 0;

                $maxRefundable = (float)$originalPayment->amount - (float)$existingRefunds;
                if ((float)$data['amount'] > $maxRefundable) {
                    return $this->error("Refund amount exceeds maximum refundable amount of {$maxRefundable}", 400);
                }
            }

            $balanceBefore = $this->calculateStudentBalance($data['studentId'], $tenantId);

            $now = date('Y-m-d H:i:s');
            $refundId = $this->generateId('ref');
            $adjustmentId = $this->generateId('adj');

            $this->db->transStart();

            // Create the refund record
            $refundData = [
                'id' => $refundId,
                'tenant_id' => $tenantId,
                'student_id' => $data['studentId'],
                'refund_type' => $data['refundType'],
                'amount' => (float) $data['amount'],
                'original_payment_id' => $data['originalPaymentId'] ?? null,
                'original_charge_id' => $data['originalChargeId'] ?? null,
                'reason' => $data['reason'],
                'refund_method' => $data['refundMethod'] ?? 'credit_note',
                'reference_number' => $data['referenceNumber'] ?? null,
                'status' => 'pending',
                'adjustment_id' => $adjustmentId,
                'created_by' => $user->id ?? 'system',
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $this->db->table('refunds')->insert($refundData);

            // Credit Note refunds credit the student (reduce their balance).
            // All other refund methods (cash, bank_transfer, check, other) debit the student
            // (increase their balance, representing money physically returned to them).
            $refundMethod = $data['refundMethod'] ?? 'credit_note';
            $adjustmentType = ($refundMethod === 'credit_note') ? 'credit' : 'debit';

            $adjustmentData = [
                'id' => $adjustmentId,
                'tenant_id' => $tenantId,
                'student_id' => $data['studentId'],
                'adjustment_type' => $adjustmentType,
                'category' => 'refund',
                'amount' => (float) $data['amount'],
                'reason' => "Refund: {$data['reason']}",
                'reference_type' => !empty($data['originalPaymentId']) ? 'payment' : (!empty($data['originalChargeId']) ? 'charge' : 'none'),
                'reference_id' => $data['originalPaymentId'] ?? $data['originalChargeId'] ?? null,
                'effective_date' => date('Y-m-d'),
                'status' => 'approved',
                'approved_by' => $user->id ?? 'system',
                'approved_at' => $now,
                'created_by' => $user->id ?? 'system',
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $this->db->table('ledger_adjustments')->insert($adjustmentData);

            // Note: We do NOT run allocation for refund adjustments.
            // Allocation is skipped so the balance change takes effect immediately
            // without being offset by prior payment credits or charge debits.

            $balanceAfter = $this->calculateStudentBalance($data['studentId'], $tenantId);

            // Log the refund initiation
            $this->logAuditAction([
                'tenant_id' => $tenantId,
                'action_type' => 'refund_initiated',
                'entity_type' => 'refund',
                'entity_id' => $refundId,
                'student_id' => $data['studentId'],
                'amount' => (float) $data['amount'],
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'details' => json_encode([
                    'refund_type' => $data['refundType'],
                    'reason' => $data['reason'],
                    'original_payment_id' => $data['originalPaymentId'] ?? null,
                    'original_charge_id' => $data['originalChargeId'] ?? null,
                    'adjustment_id' => $adjustmentId,
                ]),
                'performed_by' => $user->id ?? 'system',
            ]);

            $this->db->transComplete();

            if ($this->db->transStatus() === false) {
                return $this->error('Failed to create refund', 500);
            }

            return $this->created([
                'id' => $refundId,
                'adjustmentId' => $adjustmentId,
                'balanceBefore' => $balanceBefore,
                'balanceAfter' => $balanceAfter,
                'message' => 'Refund created successfully',
            ]);

        } catch (\Exception $e) {
            log_message('error', 'Error creating refund: ' . $e->getMessage());
            return $this->error('Failed to create refund: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /api/reconciliation/refunds/:id/process
     * Process a pending refund
     */
    public function processRefund($id = null)
    {
        try {
            $tenantId = $this->getTenantId();
            $user = $this->getCurrentUser();
            $data = $this->request->getJSON(true) ?? $this->request->getPost();

            $refund = $this->db->table('refunds')
                ->where('id', $id)
                ->where('tenant_id', $tenantId)
                ->get()->getRow();

            if (!$refund) {
                return $this->notFound('Refund not found');
            }

            if ($refund->status !== 'pending') {
                return $this->error('Only pending refunds can be processed', 400);
            }

            $now = date('Y-m-d H:i:s');

            $this->db->transStart();

            $this->db->table('refunds')
                ->where('id', $id)
                ->update([
                    'status' => 'processed',
                    'processed_at' => $now,
                    'processed_by' => $user->id ?? 'system',
                    'reference_number' => $data['referenceNumber'] ?? $refund->reference_number,
                    'updated_at' => $now,
                ]);

            // Log the processing
            $this->logAuditAction([
                'tenant_id' => $tenantId,
                'action_type' => 'refund_processed',
                'entity_type' => 'refund',
                'entity_id' => $id,
                'student_id' => $refund->student_id,
                'amount' => (float) $refund->amount,
                'details' => json_encode([
                    'reference_number' => $data['referenceNumber'] ?? $refund->reference_number,
                ]),
                'performed_by' => $user->id ?? 'system',
            ]);

            $this->db->transComplete();

            if ($this->db->transStatus() === false) {
                return $this->error('Failed to process refund', 500);
            }

            return $this->success(['message' => 'Refund processed successfully']);

        } catch (\Exception $e) {
            log_message('error', 'Error processing refund: ' . $e->getMessage());
            return $this->error('Failed to process refund: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /api/reconciliation/refunds/:id/complete
     * Mark a processed refund as completed
     */
    public function completeRefund($id = null)
    {
        try {
            $tenantId = $this->getTenantId();
            $user = $this->getCurrentUser();

            $refund = $this->db->table('refunds')
                ->where('id', $id)
                ->where('tenant_id', $tenantId)
                ->get()->getRow();

            if (!$refund) {
                return $this->notFound('Refund not found');
            }

            if (!in_array($refund->status, ['pending', 'processed'])) {
                return $this->error('Refund cannot be completed from current status', 400);
            }

            $now = date('Y-m-d H:i:s');

            $this->db->transStart();

            $this->db->table('refunds')
                ->where('id', $id)
                ->update([
                    'status' => 'completed',
                    'processed_at' => $refund->processed_at ?? $now,
                    'processed_by' => $refund->processed_by ?? $user->id ?? 'system',
                    'updated_at' => $now,
                ]);

            // Log completion
            $this->logAuditAction([
                'tenant_id' => $tenantId,
                'action_type' => 'refund_completed',
                'entity_type' => 'refund',
                'entity_id' => $id,
                'student_id' => $refund->student_id,
                'amount' => (float) $refund->amount,
                'performed_by' => $user->id ?? 'system',
            ]);

            $this->db->transComplete();

            if ($this->db->transStatus() === false) {
                return $this->error('Failed to complete refund', 500);
            }

            return $this->success(['message' => 'Refund completed successfully']);

        } catch (\Exception $e) {
            log_message('error', 'Error completing refund: ' . $e->getMessage());
            return $this->error('Failed to complete refund: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /api/reconciliation/refunds/:id/cancel
     * Cancel a refund
     */
    public function cancelRefund($id = null)
    {
        try {
            $tenantId = $this->getTenantId();
            $user = $this->getCurrentUser();
            $data = $this->request->getJSON(true) ?? $this->request->getPost();

            if (empty($data['reason'])) {
                return $this->error('Cancellation reason is required', 400);
            }

            $refund = $this->db->table('refunds')
                ->where('id', $id)
                ->where('tenant_id', $tenantId)
                ->get()->getRow();

            if (!$refund) {
                return $this->notFound('Refund not found');
            }

            if ($refund->status === 'completed') {
                return $this->error('Completed refunds cannot be cancelled. Create a reversal adjustment instead.', 400);
            }

            if ($refund->status === 'cancelled') {
                return $this->error('Refund is already cancelled', 400);
            }

            $balanceBefore = $this->calculateStudentBalance($refund->student_id, $tenantId);

            $now = date('Y-m-d H:i:s');

            $this->db->transStart();

            // Cancel the refund
            $this->db->table('refunds')
                ->where('id', $id)
                ->update([
                    'status' => 'cancelled',
                    'updated_at' => $now,
                ]);

            // Void the associated adjustment
            if ($refund->adjustment_id) {
                $this->db->table('ledger_adjustments')
                    ->where('id', $refund->adjustment_id)
                    ->update([
                        'status' => 'voided',
                        'voided_at' => $now,
                        'voided_by' => $user->id ?? 'system',
                        'void_reason' => 'Refund cancelled: ' . $data['reason'],
                        'updated_at' => $now,
                    ]);

                $ledgerService = new \App\Services\LedgerService($this->db);
                $ledgerService->allocateAdjustmentsForStudent($refund->student_id, $tenantId);
            }

            $balanceAfter = $this->calculateStudentBalance($refund->student_id, $tenantId);

            // Log cancellation
            $this->logAuditAction([
                'tenant_id' => $tenantId,
                'action_type' => 'refund_cancelled',
                'entity_type' => 'refund',
                'entity_id' => $id,
                'student_id' => $refund->student_id,
                'amount' => (float) $refund->amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'details' => json_encode(['reason' => $data['reason']]),
                'performed_by' => $user->id ?? 'system',
            ]);

            $this->db->transComplete();

            if ($this->db->transStatus() === false) {
                return $this->error('Failed to cancel refund', 500);
            }

            return $this->success([
                'message' => 'Refund cancelled successfully',
                'balanceBefore' => $balanceBefore,
                'balanceAfter' => $balanceAfter,
            ]);

        } catch (\Exception $e) {
            log_message('error', 'Error cancelling refund: ' . $e->getMessage());
            return $this->error('Failed to cancel refund: ' . $e->getMessage(), 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AUDIT TRAIL
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/reconciliation/audit-log
     * Get audit log entries with filters
     */
    public function getAuditLog()
    {
        $tenantId = $this->getTenantId();
        $studentId = $this->request->getGet('studentId');
        $actionType = $this->request->getGet('actionType');
        $entityType = $this->request->getGet('entityType');
        $fromDate = $this->request->getGet('fromDate');
        $toDate = $this->request->getGet('toDate');
        $limit = (int) ($this->request->getGet('limit') ?? 100);

        $builder = $this->db->table('reconciliation_audit_log ral')
            ->select('ral.*, u.name as performed_by_name')
            ->join('users u', 'u.id = ral.performed_by', 'left')
            ->where('ral.tenant_id', $tenantId)
            ->orderBy('ral.performed_at', 'DESC')
            ->limit($limit);

        if ($studentId) {
            $builder->where('ral.student_id', $studentId);
        }
        if ($actionType) {
            $builder->where('ral.action_type', $actionType);
        }
        if ($entityType) {
            $builder->where('ral.entity_type', $entityType);
        }
        if ($fromDate) {
            $builder->where('ral.performed_at >=', $fromDate . ' 00:00:00');
        }
        if ($toDate) {
            $builder->where('ral.performed_at <=', $toDate . ' 23:59:59');
        }

        $logs = $builder->get()->getResultArray();

        $formatted = array_map(function($log) {
            return [
                'id' => $log['id'],
                'actionType' => $log['action_type'],
                'entityType' => $log['entity_type'],
                'entityId' => $log['entity_id'],
                'studentId' => $log['student_id'],
                'amount' => $log['amount'] ? (float) $log['amount'] : null,
                'balanceBefore' => $log['balance_before'] ? (float) $log['balance_before'] : null,
                'balanceAfter' => $log['balance_after'] ? (float) $log['balance_after'] : null,
                'details' => $log['details'] ? json_decode($log['details'], true) : null,
                'ipAddress' => $log['ip_address'],
                'performedBy' => $log['performed_by'],
                'performedByName' => $log['performed_by_name'],
                'performedAt' => $log['performed_at'],
            ];
        }, $logs);

        return $this->success($formatted);
    }

    public function getVoidedChargeBatches()
    {
        $tenantId = $this->getTenantId();
        $chargeType = $this->request->getGet('chargeType');
        $limit = min(200, max(1, (int) ($this->request->getGet('limit') ?? 50)));

        $builder = $this->db->table('billing_runs br')
            ->select('br.*')
            ->where('br.tenant_id', $tenantId)
            ->where('br.status', 'voided')
            ->orderBy('br.voided_at', 'DESC')
            ->limit($limit);

        if ($chargeType && $this->db->fieldExists('charge_type', 'billing_runs')) {
            $builder->where('br.charge_type', $chargeType);
        }

        $runs = $builder->get()->getResultArray();
        $formatted = array_map(function (array $run) {
            return [
                'id' => $run['id'],
                'chargeType' => $run['charge_type'] ?? null,
                'periodKey' => $run['period_key'] ?? null,
                'periodLabel' => $run['period_label'] ?? null,
                'descriptionLabel' => $run['description_label'] ?? null,
                'chargeCount' => (int) ($run['total_charges'] ?? 0),
                'affectedStudentCount' => (int) ($run['total_students'] ?? 0),
                'totalAmount' => (float) ($run['total_amount'] ?? 0),
                'generatedBy' => $run['generated_by'] ?? $run['created_by'] ?? null,
                'generatedAt' => $run['generated_at'] ?? $run['created_at'] ?? null,
                'voidedBy' => $run['voided_by'] ?? null,
                'voidedAt' => $run['voided_at'] ?? null,
                'voidReason' => $run['void_reason'] ?? null,
                'voidDetails' => !empty($run['void_details']) ? json_decode($run['void_details'], true) : null,
            ];
        }, $runs);

        return $this->success($formatted, 'Voided charge batches retrieved');
    }

    /**
     * GET /api/reconciliation/student/:id/history
     * Get complete financial history for a student
     */
    public function getStudentHistory($studentId = null)
    {
        $tenantId = $this->getTenantId();

        // Get all transactions for this student
        $transactions = [];

        // Get charges
        $charges = $this->db->table('charges')
            ->select('id, category, amount, date_generated as date, description, is_opening_balance, voided_at, "charge" as transaction_type')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('deleted_at', null)
            ->get()->getResultArray();

        foreach ($charges as $charge) {
            $transactions[] = [
                'id' => $charge['id'],
                'type' => 'charge',
                'category' => $charge['category'],
                'amount' => (float) $charge['amount'],
                'date' => $charge['date'],
                'description' => $charge['description'],
                'isOpeningBalance' => (bool) $charge['is_opening_balance'],
                'isVoided' => !empty($charge['voided_at']),
                'effect' => 'debit', // Charges increase what student owes
            ];
        }

        // Get payments
        $payments = $this->db->table('payments')
            ->select('id, category, amount, date, description, "payment" as transaction_type')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->get()->getResultArray();

        foreach ($payments as $payment) {
            $transactions[] = [
                'id' => $payment['id'],
                'type' => 'payment',
                'category' => $payment['category'],
                'amount' => (float) $payment['amount'],
                'date' => $payment['date'],
                'description' => $payment['description'],
                'effect' => 'credit', // Payments reduce what student owes
            ];
        }

        // Get adjustments
        $adjustments = $this->db->table('ledger_adjustments')
            ->select('id, category, adjustment_type, amount, effective_date as date, reason as description, status, voided_at')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->get()->getResultArray();

        foreach ($adjustments as $adj) {
            $transactions[] = [
                'id' => $adj['id'],
                'type' => 'adjustment',
                'category' => $adj['category'],
                'adjustmentType' => $adj['adjustment_type'],
                'amount' => (float) $adj['amount'],
                'date' => $adj['date'],
                'description' => $adj['description'],
                'status' => $adj['status'],
                'isVoided' => $adj['status'] === 'voided',
                'effect' => $adj['adjustment_type'], // credit or debit
            ];
        }

        // Sort by date descending
        usort($transactions, function($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });

        // Calculate running balance
        $currentBalance = $this->calculateStudentBalance($studentId, $tenantId);

        return $this->success([
            'studentId' => $studentId,
            'currentBalance' => $currentBalance,
            'transactions' => $transactions,
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BALANCE CALCULATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/reconciliation/student/:id/balance
     * Get detailed balance breakdown for a student
     */
    public function getStudentBalanceDetail($studentId = null)
    {
        $tenantId = $this->getTenantId();

        $breakdown = (new \App\Services\LedgerService($this->db))->getStudentBalance($studentId, $tenantId);

        return $this->success([
            'studentId'        => $studentId,
            'totalCharges'     => $breakdown['totalCharges'],
            'totalPayments'    => $breakdown['totalPayments'],
            'creditAdjustments'=> $breakdown['creditAdjustments'],
            'debitAdjustments' => $breakdown['debitAdjustments'],
            'netAdjustments'   => $breakdown['debitAdjustments'] - $breakdown['creditAdjustments'],
            'balance'          => $breakdown['balance'],
        ]);
    }

    /**
     * POST /api/reconciliation/recalculate-balance
     * Recalculate and verify student balance (does not mutate data)
     */
    public function recalculateBalance()
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $studentId = $data['studentId'] ?? null;

        if (!$studentId) {
            return $this->error('Student ID is required', 400);
        }

        $calculatedBalance = $this->calculateStudentBalance($studentId, $tenantId);

        return $this->success([
            'studentId' => $studentId,
            'calculatedBalance' => $calculatedBalance,
            'message' => 'Balance recalculated successfully',
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUMMARY & REPORTING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/reconciliation/summary
     * Get reconciliation summary/dashboard data
     */
    public function getSummary()
    {
        $tenantId = $this->getTenantId();
        $fromDate = $this->request->getGet('fromDate') ?? date('Y-m-01');
        $toDate = $this->request->getGet('toDate') ?? date('Y-m-d');

        // Total adjustments by category
        $adjustmentsByCategory = $this->db->table('ledger_adjustments')
            ->select('category, adjustment_type, COUNT(*) as count, SUM(amount) as total')
            ->where('tenant_id', $tenantId)
            ->where('status', 'approved')
            ->where('effective_date >=', $fromDate)
            ->where('effective_date <=', $toDate)
            ->groupBy('category, adjustment_type')
            ->get()->getResultArray();

        // Total refunds by status
        $refundsByStatus = $this->db->table('refunds')
            ->select('status, COUNT(*) as count, SUM(amount) as total')
            ->where('tenant_id', $tenantId)
            ->where('created_at >=', $fromDate . ' 00:00:00')
            ->where('created_at <=', $toDate . ' 23:59:59')
            ->groupBy('status')
            ->get()->getResultArray();

        // Recent audit actions count
        $recentAuditCount = $this->db->table('reconciliation_audit_log')
            ->where('tenant_id', $tenantId)
            ->where('performed_at >=', $fromDate . ' 00:00:00')
            ->where('performed_at <=', $toDate . ' 23:59:59')
            ->countAllResults();

        // Pending items
        $pendingRefunds = $this->db->table('refunds')
            ->where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->countAllResults();

        return $this->success([
            'period' => [
                'from' => $fromDate,
                'to' => $toDate,
            ],
            'adjustmentsByCategory' => $adjustmentsByCategory,
            'refundsByStatus' => $refundsByStatus,
            'auditActionCount' => $recentAuditCount,
            'pendingRefunds' => $pendingRefunds,
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Calculate student balance including adjustments.
     * Delegates to LedgerService — single authoritative source of truth.
     */
    private function calculateStudentBalance(string $studentId, string $tenantId): float
    {
        return (new \App\Services\LedgerService($this->db))->getStudentBalance($studentId, $tenantId)['balance'];
    }

    /**
     * Log an audit action
     */
    private function logAuditAction(array $data): void
    {
        $logId = $this->generateId('audit');
        $now = date('Y-m-d H:i:s');

        $logData = [
            'id' => $logId,
            'tenant_id' => $data['tenant_id'],
            'action_type' => $data['action_type'],
            'entity_type' => $data['entity_type'],
            'entity_id' => $data['entity_id'],
            'student_id' => $data['student_id'] ?? null,
            'amount' => $data['amount'] ?? null,
            'balance_before' => $data['balance_before'] ?? null,
            'balance_after' => $data['balance_after'] ?? null,
            'details' => $data['details'] ?? null,
            'ip_address' => $this->request->getIPAddress(),
            'user_agent' => substr($this->request->getUserAgent()->getAgentString() ?? '', 0, 255),
            'performed_by' => $data['performed_by'],
            'performed_at' => $now,
        ];

        $this->db->table('reconciliation_audit_log')->insert($logData);
    }
}

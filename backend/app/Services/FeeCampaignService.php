<?php

namespace App\Services;

use App\Models\FeeCampaignModel;
use App\Models\CampaignStudentModel;
use App\Models\PaymentModel;

/**
 * FeeCampaignService — Business logic for fee campaign lifecycle.
 *
 * Architecture: Thin controller → this service → FeeCampaignModel + CampaignStudentModel.
 * All write operations that touch multiple tables run inside a transaction.
 */
class FeeCampaignService
{
    private $db;
    private FeeCampaignModel $campaignModel;
    private CampaignStudentModel $studentModel;

    public function __construct($db)
    {
        $this->db = $db;
        $this->campaignModel = new FeeCampaignModel();
        $this->studentModel  = new CampaignStudentModel();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // US1: Create & Auto-Assign
    // ──────────────────────────────────────────────────────────────────────────

    public function createCampaign(array $data, string $tenantId, string $userId): array
    {
        $campaignId = $this->generateId('fc_');
        $now        = date('Y-m-d H:i:s');

        $scopeId = $data['targetScopeId'] ?? null;
        if (is_array($scopeId)) {
            $scopeId = json_encode($scopeId);
        }

        $campaignRow = [
            'id'                => $campaignId,
            'tenant_id'         => $tenantId,
            'name'              => $data['name'],
            'description'       => $data['description'] ?? null,
            'target_scope_type' => $data['targetScopeType'],
            'target_scope_id'   => $scopeId,
            'amount'            => (float) $data['amount'],
            'due_date'          => $data['dueDate'] ?? null,
            'status'            => 'active',
            'created_by'        => $userId,
            'created_at'        => $now,
            'updated_at'        => $now,
        ];

        $this->db->transStart();

        try {
            $this->db->table('fee_campaigns')->insert($campaignRow);

            $students = $this->resolveEligibleStudents(
                $data['targetScopeType'],
                $data['targetScopeId'] ?? null,
                $tenantId
            );

            $assignedCount = 0;
            if (!empty($students)) {
                $batch = [];
                foreach ($students as $student) {
                    $batch[] = [
                        'id'              => $this->generateId('cs_'),
                        'tenant_id'       => $tenantId,
                        'fee_campaign_id' => $campaignId,
                        'student_id'      => $student['id'],
                        'expected_amount' => (float) $data['amount'],
                        'paid_amount'     => 0.00,
                        'status'          => 'unpaid',
                        'created_at'      => $now,
                        'updated_at'      => $now,
                    ];
                }
                $this->db->table('campaign_students')->insertBatch($batch);
                $assignedCount = count($batch);
            }

            $this->db->transComplete();
        } catch (\Throwable $e) {
            $this->db->transRollback();
            return ['error' => 'Transaction failed: ' . $e->getMessage(), 'status' => 500];
        }

        if ($this->db->transStatus() === false) {
            return ['error' => 'Transaction failed', 'status' => 500];
        }

        $campaign = $this->campaignModel->getByIdAndTenant($campaignId, $tenantId);

        return [
            'campaign'      => $this->campaignModel->formatForApi($campaign),
            'assignedCount' => $assignedCount,
        ];
    }

    public function resolveEligibleStudents(string $scopeType, $scopeId, string $tenantId): array
    {
        $builder = $this->db->table('students')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active');

        if ($scopeType === 'students') {
            if ($scopeId === null || $scopeId === '' || $scopeId === '[]') {
                return [];
            }
            $ids = is_array($scopeId) ? $scopeId : (json_decode($scopeId, true) ?: [$scopeId]);
            $ids = array_filter($ids);
            if (empty($ids)) {
                return [];
            }
            $builder->whereIn('id', array_values($ids));
        } elseif ($scopeType === 'class' && $scopeId !== null) {
            $ids = is_array($scopeId) ? $scopeId : (json_decode($scopeId, true) ?: [$scopeId]);
            $builder->whereIn('class_id', $ids);
        }

        return $builder->get()->getResultArray();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // US2: Record Payment
    // ──────────────────────────────────────────────────────────────────────────

    public function recordPayment(string $campaignId, array $data, string $tenantId): array
    {
        $campaign = $this->campaignModel->getByIdAndTenant($campaignId, $tenantId);
        if (!$campaign) {
            return ['error' => 'Campaign not found', 'status' => 404];
        }
        if ($campaign['status'] !== 'active') {
            return ['error' => 'Cannot record payment on a closed campaign', 'status' => 409];
        }

        $studentId = $data['studentId'];
        $csRecord  = $this->studentModel->getByCampaignAndStudent($campaignId, $studentId);
        if (!$csRecord) {
            return ['error' => 'Student is not assigned to this campaign', 'status' => 404];
        }
        if ($csRecord['status'] === 'fully_paid') {
            return ['error' => 'Student has already fully paid', 'status' => 400];
        }

        $amount    = (float) $data['amount'];
        $remaining = (float) $csRecord['expected_amount'] - (float) $csRecord['paid_amount'];
        if ($amount > $remaining) {
            return ['error' => 'Amount exceeds remaining balance of ' . number_format($remaining, 2), 'status' => 400];
        }
        if ($amount <= 0) {
            return ['error' => 'Amount must be greater than zero', 'status' => 400];
        }

        // Multi-currency resolution (Feature 094)
        $currencyCode = isset($data['currency']) ? trim($data['currency']) : null;
        $exchangeRateOverride = isset($data['exchangeRateOverride']) ? (float) $data['exchangeRateOverride'] : null;
        $currencyDetail = null;
        $paymentDate = $data['date'] ?? date('Y-m-d');

        if ($currencyCode && $currencyCode !== '') {
            $currencyService = new \App\Services\CurrencyService($this->db);
            try {
                $currencyDetail = $currencyService->resolveTransactionCurrency(
                    $tenantId,
                    $currencyCode,
                    $paymentDate,
                    $amount,
                    $exchangeRateOverride
                );
                // The base-currency amount becomes the authoritative `amount` for ledger purposes
                $amount = $currencyDetail['baseCurrencyAmount'];
            } catch (\InvalidArgumentException $e) {
                $code = (int) $e->getCode();
                return ['error' => $e->getMessage(), 'status' => $code > 0 ? $code : 400];
            } catch (\RuntimeException $e) {
                $code = (int) $e->getCode();
                return ['error' => $e->getMessage(), 'status' => $code > 0 ? $code : 422, 'requiresRate' => true];
            }
        }

        $now       = date('Y-m-d H:i:s');
        $paymentId = $this->generateId('pay_');
        $receiptNo = date('Y.m.d.His') . '.' . chr(random_int(65, 90));

        // Fetch student name and class for snapshot
        $studentRow = $this->db->table('students')
            ->select('students.first_name, students.last_name, classes.name as class_name')
            ->join('classes', 'classes.id = students.class_id', 'left')
            ->where('students.id', $studentId)
            ->get()->getRowArray();

        $paidBefore     = (float) $csRecord['paid_amount'];
        $remainingAfter = (float) $csRecord['expected_amount'] - $paidBefore - $amount;
        $snapshotJson   = json_encode([
            'studentName'    => trim(($studentRow['first_name'] ?? '') . ' ' . ($studentRow['last_name'] ?? '')),
            'className'      => $studentRow['class_name'] ?? '',
            'campaignName'   => $campaign['name'],
            'expectedAmount' => (float) $csRecord['expected_amount'],
            'paidBefore'     => $paidBefore,
            'amountPaid'     => $amount,
            'remainingAfter' => max(0.0, $remainingAfter),
            'paymentMethod'  => $data['method'] ?? 'Cash',
            'paymentDate'    => $data['date'] ?? date('Y-m-d'),
        ]);

        $this->db->transStart();

        try {
            // Insert into payments table (with fee_campaign_id — excluded from ledger)
            $this->db->table('payments')->insert([
                'id'              => $paymentId,
                'tenant_id'       => $tenantId,
                'student_id'      => $studentId,
                'amount'          => $amount,
                'date'            => $paymentDate,
                'method'          => $data['method'] ?? 'Cash',
                'description'     => $data['description'] ?? ('Campaign: ' . $campaign['name']),
                'category'        => $campaign['name'],
                'fee_campaign_id' => $campaignId,
                'receipt_number'  => $receiptNo,
                'snapshot'        => $snapshotJson,
                'created_at'      => $now,
                'updated_at'      => $now,
                'currency_code'      => $currencyDetail['currencyCode'] ?? null,
                'original_amount'    => $currencyDetail['originalAmount'] ?? null,
                'exchange_rate'      => $currencyDetail['exchangeRate'] ?? null,
                'rate_manual_override' => $currencyDetail['rateManualOverride'] ?? false,
            ]);

            // Update campaign_students paid_amount and status
            $newPaid   = (float) $csRecord['paid_amount'] + $amount;
            $newStatus = 'unpaid';
            if ($newPaid >= (float) $csRecord['expected_amount']) {
                $newStatus = 'fully_paid';
            } elseif ($newPaid > 0) {
                $newStatus = 'partially_paid';
            }

            $this->db->table('campaign_students')
                ->where('id', $csRecord['id'])
                ->update([
                    'paid_amount' => $newPaid,
                    'status'      => $newStatus,
                    'updated_at'  => $now,
                ]);

            $this->db->transComplete();
        } catch (\Throwable $e) {
            $this->db->transRollback();
            return ['error' => 'Payment transaction failed: ' . $e->getMessage(), 'status' => 500];
        }

        if ($this->db->transStatus() === false) {
            return ['error' => 'Transaction failed', 'status' => 500];
        }

        $updatedCs = $this->db->table('campaign_students')
            ->where('id', $csRecord['id'])
            ->get()->getRowArray();

        return [
            'payment'         => [
                'id'            => $paymentId,
                'amount'        => $amount,
                'receiptNumber' => $receiptNo,
            ],
            'campaignStudent' => $this->studentModel->formatForApi($updatedCs),
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // US4: Add / Remove Student
    // ──────────────────────────────────────────────────────────────────────────

    public function addStudent(string $campaignId, string $studentId, string $tenantId): array
    {
        $campaign = $this->campaignModel->getByIdAndTenant($campaignId, $tenantId);
        if (!$campaign) {
            return ['error' => 'Campaign not found', 'status' => 404];
        }
        if ($campaign['status'] !== 'active') {
            return ['error' => 'Cannot add students to a closed campaign', 'status' => 409];
        }

        // Verify student belongs to tenant
        $student = $this->db->table('students')
            ->where('id', $studentId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();
        if (!$student) {
            return ['error' => 'Student not found', 'status' => 404];
        }

        // Check for duplicate (UNIQUE constraint also catches race condition)
        $existing = $this->studentModel->getByCampaignAndStudent($campaignId, $studentId);
        if ($existing) {
            return ['error' => 'Student is already assigned to this campaign', 'status' => 400];
        }

        $now = date('Y-m-d H:i:s');
        $row = [
            'id'              => $this->generateId('cs_'),
            'tenant_id'       => $tenantId,
            'fee_campaign_id' => $campaignId,
            'student_id'      => $studentId,
            'expected_amount' => (float) $campaign['amount'],
            'paid_amount'     => 0.00,
            'status'          => 'unpaid',
            'created_at'      => $now,
            'updated_at'      => $now,
        ];

        $this->db->table('campaign_students')->insert($row);

        return ['campaignStudent' => $this->studentModel->formatForApi($row)];
    }

    public function removeStudent(string $campaignId, string $studentId, string $tenantId, bool $force = false): array
    {
        $campaign = $this->campaignModel->getByIdAndTenant($campaignId, $tenantId);
        if (!$campaign) {
            return ['error' => 'Campaign not found', 'status' => 404];
        }
        if ($campaign['status'] !== 'active') {
            return ['error' => 'Cannot remove students from a closed campaign', 'status' => 409];
        }

        $csRecord = $this->studentModel
            ->where('fee_campaign_id', $campaignId)
            ->where('student_id', $studentId)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$csRecord) {
            return ['error' => 'Student is not assigned to this campaign', 'status' => 404];
        }

        if ((float) $csRecord['paid_amount'] > 0 && !$force) {
            return [
                'error'  => 'Student has existing payments. Use force=true to remove anyway. Payment records will be preserved.',
                'status' => 409,
            ];
        }

        // Delete campaign_students row — payment records in payments table are preserved (audit integrity)
        $this->db->table('campaign_students')
            ->where('id', $csRecord['id'])
            ->delete();

        return ['removed' => true];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // US5: Close Campaign
    // ──────────────────────────────────────────────────────────────────────────

    public function closeCampaign(string $campaignId, string $tenantId, bool $force = false): array
    {
        $campaign = $this->campaignModel->getByIdAndTenant($campaignId, $tenantId);
        if (!$campaign) {
            return ['error' => 'Campaign not found', 'status' => 404];
        }
        if ($campaign['status'] !== 'active') {
            return ['error' => 'Campaign is already closed', 'status' => 409];
        }

        // Check for outstanding students
        $outstanding = $this->db->table('campaign_students')
            ->where('fee_campaign_id', $campaignId)
            ->where('tenant_id', $tenantId)
            ->where('status !=', 'fully_paid')
            ->countAllResults();

        if ($outstanding > 0 && !$force) {
            return [
                'error'       => $outstanding . ' student(s) have outstanding balances. Use force=true to close anyway.',
                'status'      => 409,
                'outstanding' => $outstanding,
            ];
        }

        $this->db->table('fee_campaigns')
            ->where('id', $campaignId)
            ->update([
                'status'     => 'closed',
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        $updated = $this->campaignModel->getByIdAndTenant($campaignId, $tenantId);
        return ['campaign' => $this->campaignModel->formatForApi($updated)];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // US6: Payment Reconciliation
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * List all payments for a campaign (both active and voided) with student info.
     */
    public function getCampaignPayments(string $campaignId, string $tenantId): array
    {
        $rows = $this->db->table('payments p')
            ->select('p.*, s.first_name, s.last_name, cl.name AS class_name')
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes cl', 'cl.id = s.class_id', 'left')
            ->where('p.fee_campaign_id', $campaignId)
            ->where('p.tenant_id', $tenantId)
            ->orderBy('p.date', 'DESC')
            ->orderBy('p.created_at', 'DESC')
            ->get()->getResultArray();

        return array_map(function (array $row) {
            $snap = $row['snapshot'] ? json_decode($row['snapshot'], true) : null;
            return [
                'id'            => $row['id'],
                'studentId'     => $row['student_id'],
                'studentName'   => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''))
                                    ?: ($snap['studentName'] ?? null),
                'className'     => $row['class_name'] ?? ($snap['className'] ?? null),
                'amount'        => (float) $row['amount'],
                'method'        => $row['method'],
                'date'          => $row['date'],
                'description'   => $row['description'],
                'receiptNumber' => $row['receipt_number'],
                'isVoided'      => !empty($row['voided_at']),
                'voidedAt'      => $row['voided_at'] ?? null,
                'voidReason'    => $row['void_reason'] ?? null,
                'voidedBy'      => $row['voided_by'] ?? null,
                'createdAt'     => $row['created_at'],
            ];
        }, $rows);
    }

    /**
     * Void a campaign payment and reverse the student's paid_amount.
     * Original payment row is preserved with voided_at set for audit trail.
     * An entry is written to ledger_adjustments for cross-system reconciliation.
     */
    public function voidCampaignPayment(
        string $campaignId,
        string $paymentId,
        string $tenantId,
        string $reason,
        string $userId
    ): array {
        $campaign = $this->campaignModel->getByIdAndTenant($campaignId, $tenantId);
        if (!$campaign) {
            return ['error' => 'Campaign not found', 'status' => 404];
        }

        $payment = $this->db->table('payments')
            ->where('id', $paymentId)
            ->where('fee_campaign_id', $campaignId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$payment) {
            return ['error' => 'Payment not found', 'status' => 404];
        }
        if (!empty($payment['voided_at'])) {
            return ['error' => 'Payment is already voided', 'status' => 409];
        }

        $csRecord = $this->studentModel->getByCampaignAndStudent($campaignId, $payment['student_id']);
        if (!$csRecord) {
            return ['error' => 'Campaign student record not found', 'status' => 404];
        }

        $amount   = (float) $payment['amount'];
        $now      = date('Y-m-d H:i:s');
        $newPaid  = max(0.0, (float) $csRecord['paid_amount'] - $amount);

        $newStatus = 'unpaid';
        if ($newPaid >= (float) $csRecord['expected_amount']) {
            $newStatus = 'fully_paid';
        } elseif ($newPaid > 0) {
            $newStatus = 'partially_paid';
        }

        $this->db->transStart();

        // Soft-void the payment row
        $this->db->table('payments')
            ->where('id', $paymentId)
            ->update([
                'voided_at'  => $now,
                'void_reason' => $reason,
                'voided_by'  => $userId,
                'updated_at' => $now,
            ]);

        // Reverse the campaign_students paid_amount
        $this->db->table('campaign_students')
            ->where('id', $csRecord['id'])
            ->update([
                'paid_amount' => $newPaid,
                'status'      => $newStatus,
                'updated_at'  => $now,
            ]);

        // Write audit entry to ledger_adjustments for cross-system trail
        $this->db->table('ledger_adjustments')->insert([
            'id'             => $this->generateId('adj_'),
            'tenant_id'      => $tenantId,
            'student_id'     => $payment['student_id'],
            'adjustment_type'=> 'debit',
            'category'       => 'correction',
            'amount'         => $amount,
            'reason'         => 'Campaign payment voided: ' . $reason
                                . ' (Campaign: ' . $campaign['name'] . ', Receipt: '
                                . ($payment['receipt_number'] ?? $paymentId) . ')',
            'reference_type' => 'payment',
            'reference_id'   => $paymentId,
            'effective_date' => date('Y-m-d'),
            'status'         => 'approved',
            'approved_by'    => $userId,
            'created_at'     => $now,
            'updated_at'     => $now,
        ]);

        $this->db->transComplete();

        if ($this->db->transStatus() === false) {
            return ['error' => 'Transaction failed', 'status' => 500];
        }

        return [
            'voided'    => true,
            'paymentId' => $paymentId,
            'amountReversed' => $amount,
            'newPaidAmount'  => $newPaid,
            'newStatus'      => $newStatus,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function generateId(string $prefix = ''): string
    {
        return $prefix . time() . '_' . bin2hex(random_bytes(4));
    }
}

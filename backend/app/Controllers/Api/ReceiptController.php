<?php

namespace App\Controllers\Api;

use App\Models\PaymentModel;
use App\Models\StudentModel;
use App\Models\TenantModel;

class ReceiptController extends BaseApiController
{
    // ──────────────────────────────────────────────────────────────
    // GET /api/receipts/:id  (public — no JWT required)
    // ──────────────────────────────────────────────────────────────
    public function show($paymentId = null)
    {
        if (!$paymentId) {
            return $this->notFound('Receipt not found');
        }

        $paymentModel = new PaymentModel();
        $payment = $paymentModel->where('id', $paymentId)->first();

        if (!$payment) {
            return $this->notFound('Receipt not found');
        }

        $studentModel = new StudentModel();
        $student = $studentModel
            ->select('students.*, c.name as class_name')
            ->join('classes c', 'c.id = students.class_id', 'left')
            ->where('students.id', $payment['student_id'])
            ->first();

        $tenantModel = new TenantModel();
        $tenant = $tenantModel->where('id', $payment['tenant_id'])->first();

        $schoolName = 'School';
        if ($tenant) {
            $settings   = json_decode($tenant['settings'] ?? '{}', true);
            $schoolName = $settings['schoolName'] ?? $schoolName;
        }

        // Use the balance that was snapshotted when the payment was recorded.
        // For legacy payments that predate this feature, compute an approximate
        // snapshot as: currentBalance + sum(amount of payments made after this
        // one for the same student).
        $formatted = $paymentModel->formatForApi($payment);

        // Feature 062: for campaign payments, use snapshot.remainingAfter as balance
        // instead of running the general ledger approximation (FR-010)
        $isCampaignPayment = !empty($payment['fee_campaign_id']);
        if ($isCampaignPayment) {
            $snapshot = $formatted['snapshot'] ?? null;
            $formatted['balanceAfterPayment'] = is_array($snapshot)
                ? (float) ($snapshot['remainingAfter'] ?? 0)
                : 0.0;
            $formatted['campaignName'] = is_array($snapshot)
                ? ($snapshot['campaignName'] ?? null)
                : null;
            $formatted['campaignExpectedAmount'] = is_array($snapshot)
                ? (float) ($snapshot['expectedAmount'] ?? 0)
                : 0.0;
            $formatted['campaignPaidBefore'] = is_array($snapshot)
                ? (float) ($snapshot['paidBefore'] ?? 0)
                : 0.0;
        }

        // Feature 061: multi-category grouped payment — build categoryLines from all
        // sibling rows sharing the same payment_group_id and receipt_number.
        $categoryLines = null;
        $groupId = $payment['payment_group_id'] ?? null;
        if ($groupId !== null) {
            $groupRows = $paymentModel
                ->where('payment_group_id', $groupId)
                ->where('tenant_id', $payment['tenant_id'])
                ->findAll();
            $categoryLines = array_map(fn($r) => [
                'category' => $r['category'],
                'amount'   => (float) $r['amount'],
            ], $groupRows);
            $formatted['categoryLines'] = $categoryLines;
            // Combine total for display (sum of all sibling rows)
            $formatted['amount'] = array_sum(array_column($groupRows, 'amount'));
        }

        $isGeneral = (bool) ($payment['is_general_payment'] ?? false);

        // Multi-category system payment: compute per-category balances from snapshot.
        // The DB stores the overall post-payment balances on every row in the group,
        // so we derive each category's remaining balance from the snapshot's before-
        // payment balances minus the amount allocated to that category.
        if (!$isGeneral && !empty($categoryLines)) {
            $snap = $formatted['snapshot'] ?? null;
            if (is_array($snap)) {
                $feeAllocated = 0.0;
                $transportAllocated = 0.0;
                foreach ($categoryLines as $line) {
                    $cat = $line['category'] ?? '';
                    $amt = (float) ($line['amount'] ?? 0);
                    if (in_array($cat, ['Fees', 'Transport + Fees'], true)) {
                        $feeAllocated += $amt;
                    }
                    if (in_array($cat, ['Transport', 'Transport Fee'], true)) {
                        $transportAllocated += $amt;
                    }
                }

                if (isset($snap['feeBalanceBefore'])) {
                    $formatted['feeBalanceAfterPayment'] = (float) $snap['feeBalanceBefore'] - $feeAllocated;
                }
                if (isset($snap['transportBalanceBefore'])) {
                    $formatted['transportBalanceAfterPayment'] = (float) $snap['transportBalanceBefore'] - $transportAllocated;
                }
                if (isset($snap['balanceBefore'])) {
                    $formatted['balanceAfterPayment'] = (float) $snap['balanceBefore'] - (float) $formatted['amount'];
                }
            }
        }

        // Feature 085: for voided payments with a snapshot, always derive balances
        // from the snapshot so the receipt shows the historical state at time of
        // payment — never recalculate from the current ledger.
        if ($formatted['isVoided'] && !$isGeneral) {
            $snap = $formatted['snapshot'] ?? null;
            if (is_array($snap)) {
                $snapAmount = (float) ($formatted['amount'] ?? 0);
                $cat = $formatted['category'] ?? '';
                $feeAmount = in_array($cat, ['Fees', 'Transport + Fees'], true) ? $snapAmount : 0.0;
                $transportAmount = in_array($cat, ['Transport', 'Transport Fee'], true) ? $snapAmount : 0.0;
                if (isset($snap['balanceBefore'])) {
                    $formatted['balanceAfterPayment'] = (float) $snap['balanceBefore'] - $snapAmount;
                }
                if (isset($snap['feeBalanceBefore'])) {
                    $formatted['feeBalanceAfterPayment'] = (float) $snap['feeBalanceBefore'] - $feeAmount;
                }
                if (isset($snap['transportBalanceBefore'])) {
                    $formatted['transportBalanceAfterPayment'] = (float) $snap['transportBalanceBefore'] - $transportAmount;
                }
            }
        }

        // For legacy payments without separate balance columns, compute both from ledger.
        // Skip campaign payments — their authoritative balance comes from the snapshot.
        if (($formatted['balanceAfterPayment'] === null || $formatted['feeBalanceAfterPayment'] === null) && !$isGeneral && !$isCampaignPayment) {
            $ledgerService   = new \App\Services\LedgerService(\Config\Database::connect());
            $ledger          = $ledgerService->getStudentBalance($payment['student_id'], $payment['tenant_id']);
            $currentBalance  = (float) ($ledger['balance'] ?? 0);
            $currentFeeBalance = (float) ($ledger['feeBalance'] ?? 0);
            $currentTransportBalance = (float) ($ledger['transportBalance'] ?? 0);

            $laterPayments = $paymentModel
                ->selectSum('amount')
                ->where('student_id', $payment['student_id'])
                ->where('tenant_id', $payment['tenant_id'])
                ->where('COALESCE(is_general_payment, 0)', 0)
                ->groupStart()
                    ->where('date >', $payment['date'])
                    ->orGroupStart()
                        ->where('date', $payment['date'])
                        ->where('id >', $payment['id'])
                    ->groupEnd()
                ->groupEnd()
                ->first();
            $laterTotal = (float) ($laterPayments['amount'] ?? 0);

            // Approximate: assume later payments split proportionally (best effort for legacy)
            $formatted['balanceAfterPayment'] = $currentBalance + $laterTotal;
            $formatted['feeBalanceAfterPayment'] = $currentFeeBalance + $laterTotal;
            $formatted['transportBalanceAfterPayment'] = $currentTransportBalance + $laterTotal;
        }

        // Feature 057 US5: prefer snapshot className so the receipt remains
        // accurate even if the student has since moved to a different class.
        $studentData = $student ? $studentModel->formatForApi($student) : null;
        $snapshot    = $formatted['snapshot'] ?? null;
        if ($studentData && is_array($snapshot) && !empty($snapshot['className'])) {
            $studentData['className'] = $snapshot['className'];
        }

        return $this->success([
            'payment' => $formatted,
            'student' => $studentData,
            'school'  => ['name' => $schoolName],
        ]);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/receipts/student/:studentId  (public — no JWT required)
    // Returns a paginated list of receipt summaries for a student.
    // ──────────────────────────────────────────────────────────────
    public function listByStudent($studentId = null)
    {
        if (!$studentId) {
            return $this->notFound('Student not found');
        }

        $studentModel = new StudentModel();
        $student = $studentModel
            ->select('students.*, c.name as class_name')
            ->join('classes c', 'c.id = students.class_id AND c.tenant_id = students.tenant_id', 'left')
            ->where('students.id', $studentId)
            ->first();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        $tenantId = $student['tenant_id'];

        $pagination = $this->normalisePaginationParams(20, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $paymentModel = new PaymentModel();
        $receipts = $paymentModel->getReceiptListForStudent(
            $studentId,
            $tenantId,
            $pagination['limit'],
            $pagination['offset']
        );
        $total = $paymentModel->getReceiptListCountForStudent($studentId, $tenantId);

        $studentData = $studentModel->formatForApi($student);

        return $this->success([
            'receipts'   => $receipts,
            'student'    => [
                'id'              => $studentData['id'],
                'firstName'       => $studentData['firstName'],
                'lastName'        => $studentData['lastName'],
                'admissionNumber' => $studentData['admissionNumber'] ?? null,
                'className'       => $studentData['className'] ?? null,
            ],
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
        ]);
    }
}

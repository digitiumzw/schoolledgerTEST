<?php

namespace App\Controllers\Api;

use App\Models\CampaignStudentModel;
use App\Models\PaymentModel;
use App\Models\StudentModel;
use App\Services\CurrencyService;

class PaymentController extends BaseApiController
{
    protected PaymentModel $paymentModel;
    protected StudentModel $studentModel;
    protected CampaignStudentModel $campaignStudentModel;
    protected CurrencyService $currencyService;

    private const VALID_METHODS     = ['Cash', 'EcoCash', 'OneMoney', 'Telecash', 'Bank Transfer', 'ZIPIT', 'Swipe', 'Cheque', 'Other'];
    private const MAX_PAYMENT_AMOUNT = 1_000_000; // sanity ceiling
    private const PAYMENT_SORT_FIELDS = ['date', 'amount', 'studentName', 'method', 'category', 'receiptNumber'];
    private const PAYMENT_TYPES = ['all', 'system', 'general', 'campaign', 'grouped'];

    public function __construct()
    {
        $this->paymentModel  = new PaymentModel();
        $this->studentModel  = new StudentModel();
        $this->campaignStudentModel = new CampaignStudentModel();
        $this->currencyService = new CurrencyService();
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/payments
    // ──────────────────────────────────────────────────────────────
    public function index()
    {
        $tenantId = $this->getTenantId();
        $payments  = $this->paymentModel->getByTenant($tenantId);
        return $this->success(array_map(fn($p) => $this->paymentModel->formatForApi($p), $payments));
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/payments/:id
    // ──────────────────────────────────────────────────────────────
    public function show($id = null)
    {
        $tenantId = $this->getTenantId();
        $payment  = $this->paymentModel
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$payment) {
            return $this->notFound('Payment not found');
        }
        return $this->success($this->paymentModel->formatForApi($payment));
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/payments/:id/void
    // ──────────────────────────────────────────────────────────────
    public function void($id = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);

        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;
        if (!$id) return $this->error('Payment ID is required', 400);

        $body   = $this->getRequestBody();
        $reason = $this->sanitiseString($body['reason'] ?? '');
        if (empty($reason)) {
            return $this->error('A reason is required to void a payment', 400);
        }

        $db = $this->paymentModel->db;
        $db->transBegin();

        try {
            // Look up the payment (tenant-scoped)
            $payment = $this->paymentModel
                ->where('id', $id)
                ->where('tenant_id', $tenantId)
                ->first();

            if (!$payment) {
                $db->transRollback();
                return $this->notFound('Payment not found');
            }

            if (!empty($payment['voided_at'])) {
                $db->transRollback();
                return $this->error('This payment has already been voided', 409);
            }

            $user   = $this->getCurrentUser();
            $userId = $user->id ?? 'system';
            $now    = date('Y-m-d H:i:s');

            // Determine rows to void: if grouped, void all siblings
            $paymentGroupId = $payment['payment_group_id'] ?? null;
            $receiptNumber  = $payment['receipt_number'] ?? null;
            $studentId      = $payment['student_id'];

            if ($paymentGroupId) {
                $db->table('payments')
                    ->where('tenant_id', $tenantId)
                    ->where('payment_group_id', $paymentGroupId)
                    ->where('voided_at', null)
                    ->update([
                        'voided_at'   => $now,
                        'void_reason' => $reason,
                        'voided_by'   => $userId,
                        'updated_at'  => $now,
                    ]);
            } else {
                $this->paymentModel->update($id, [
                    'voided_at'   => $now,
                    'void_reason' => $reason,
                    'voided_by'   => $userId,
                    'updated_at'  => $now,
                ]);
            }

            // Reverse campaign_students.paid_amount if this is a campaign payment
            $feeCampaignId = $payment['fee_campaign_id'] ?? null;
            if ($feeCampaignId) {
                $csRecord = $this->campaignStudentModel->getByCampaignAndStudent($feeCampaignId, $studentId);
                if ($csRecord) {
                    $amount  = (float) $payment['amount'];
                    $newPaid = max(0.0, (float) $csRecord['paid_amount'] - $amount);

                    $newStatus = 'unpaid';
                    $expected  = (float) $csRecord['expected_amount'];
                    if ($newPaid >= $expected) {
                        $newStatus = 'fully_paid';
                    } elseif ($newPaid > 0) {
                        $newStatus = 'partially_paid';
                    }

                    $db->table('campaign_students')
                        ->where('id', $csRecord['id'])
                        ->update([
                            'paid_amount' => $newPaid,
                            'status'      => $newStatus,
                            'updated_at'  => $now,
                        ]);
                }
            }

            // Re-calculate charge allocations and student balance
            $ledgerService = new \App\Services\LedgerService($db);
            $ledgerService->allocatePaymentToCharges($studentId, $tenantId, $db);
            $recalculated = $ledgerService->getStudentBalance($studentId, $tenantId);

            $db->transCommit();

            $groupedRowsVoided = $paymentGroupId
                ? (int) $db->table('payments')
                    ->where('tenant_id', $tenantId)
                    ->where('payment_group_id', $paymentGroupId)
                    ->where('voided_at', $now)
                    ->countAllResults()
                : 1;

            return $this->success([
                'paymentId'           => $id,
                'receiptNumber'       => $receiptNumber,
                'voidedAt'            => $now,
                'voidReason'          => $reason,
                'voidedBy'            => $userId,
                'studentId'           => $studentId,
                'recalculatedBalance' => $recalculated['balance'] ?? null,
                'groupedRowsVoided'   => $groupedRowsVoided,
            ], 'Receipt canceled and payment voided successfully.');
        } catch (\Exception $e) {
            $db->transRollback();
            log_message('error', 'Payment void failed: ' . $e->getMessage());
            return $this->error('Failed to void payment. Please try again.', 500);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/payments
    // ──────────────────────────────────────────────────────────────
    public function create()
    {
        $tenantId = $this->getTenantId();
        $data     = $this->getRequestBody();

        // ── Required field checks ──────────────────────────────────
        if ($err = $this->requireFields($data, ['studentId', 'amount'])) {
            return $err;
        }

        $studentId = $this->sanitiseString($data['studentId']);
        $amount    = $data['amount'];

        // ── Amount validation ──────────────────────────────────────
        if (!is_numeric($amount)) {
            return $this->error('Amount must be a valid number', 400);
        }
        $amount = (float) $amount;
        if ($amount <= 0) {
            return $this->error('Amount must be greater than zero', 400);
        }
        if ($amount > self::MAX_PAYMENT_AMOUNT) {
            return $this->error('Amount exceeds the allowed maximum', 400);
        }

        // ── Payment method validation ──────────────────────────────
        $method = $data['method'] ?? 'Cash';
        if (!in_array($method, self::VALID_METHODS, true)) {
            return $this->error(
                'Invalid payment method. Must be one of: ' . implode(', ', self::VALID_METHODS),
                400
            );
        }

        // ── Date validation ────────────────────────────────────────
        $date = $data['date'] ?? date('Y-m-d');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !strtotime($date)) {
            return $this->error('Invalid date format. Use YYYY-MM-DD', 400);
        }

        // ── Student ownership check ────────────────────────────────
        $student = $this->studentModel
            ->where('id', $studentId)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$student) {
            return $this->error('Student not found or does not belong to your organisation', 404);
        }

        // ── Multi-currency resolution (Feature 094) ────────────────
        $currencyCode = isset($data['currency']) ? $this->sanitiseString($data['currency']) : null;
        $exchangeRateOverride = isset($data['exchangeRateOverride']) ? (float) $data['exchangeRateOverride'] : null;
        $currencyDetail = null;

        if ($currencyCode && $currencyCode !== '') {
            try {
                $currencyDetail = $this->currencyService->resolveTransactionCurrency(
                    $tenantId,
                    $currencyCode,
                    $date,
                    $amount,
                    $exchangeRateOverride
                );
                // The base-currency amount becomes the authoritative `amount` for ledger purposes
                $amount = $currencyDetail['baseCurrencyAmount'];
            } catch (\InvalidArgumentException $e) {
                $code = (int) $e->getCode();
                return $this->error($e->getMessage(), $code > 0 ? $code : 400);
            } catch (\RuntimeException $e) {
                $code = (int) $e->getCode();
                return $this->error($e->getMessage(), $code > 0 ? $code : 422, ['requiresRate' => true]);
            }
        }

        // ── Multi-category path ────────────────────────────────────
        if (!empty($data['categories']) && is_array($data['categories'])) {
            $originalTotal = $currencyDetail ? (float) ($currencyDetail['originalAmount'] ?? $amount) : $amount;
            return $this->createMultiCategory($data, $student, $tenantId, $amount, $date, $method, $currencyDetail, $originalTotal);
        }

        // ── Single-category path ───────────────────────────────────
        $category = $this->sanitiseString($data['category'] ?? 'Fees');
        if ($category === '') {
            $category = 'Fees';
        }

        // ── Transport charge warning ───────────────────────────────
        $transportWarning = null;
        $transportCategories = ['transport', 'transport fee', 'transport + fees'];
        if (in_array(strtolower($category), $transportCategories, true)) {
            $_warnDb = \Config\Database::connect();
            $hasTransportCharges = $_warnDb->table('charges')
                ->where('student_id', $studentId)
                ->where('tenant_id', $tenantId)
                ->where('charge_type', 'transport')
                ->where('deleted_at IS NULL')
                ->where('voided_at IS NULL')
                ->countAllResults() > 0;
            if (!$hasTransportCharges) {
                $transportWarning = 'This student does not have any transport charges yet.';
            }
        }

        // Classify: server-side only — never accepted from client
        $isGeneralPayment = !\Config\PaymentCategories::isSystemName($category) ? 1 : 0;

        $paymentId     = $this->generateId('p');
        $receiptNumber = $this->generateReceiptNumber();
        $paymentData   = [
            'id'                 => $paymentId,
            'tenant_id'          => $tenantId,
            'student_id'         => $studentId,
            'amount'             => $amount,
            'date'               => $date,
            'method'             => $method,
            'description'        => $this->sanitiseString($data['description'] ?? ''),
            'category'           => $category,
            'route_id'           => $data['routeId'] ?? null,
            'receipt_number'     => $receiptNumber,
            'is_general_payment' => $isGeneralPayment,
            'payment_group_id'   => null,
            'currency_code'      => $currencyDetail['currencyCode'] ?? null,
            'original_amount'    => $currencyDetail['originalAmount'] ?? null,
            'exchange_rate'      => $currencyDetail['exchangeRate'] ?? null,
            'rate_manual_override' => $currencyDetail['rateManualOverride'] ?? false,
        ];

        $db = \Config\Database::connect();

        // ── Resolve class name for snapshot ────────────────────────
        $classNameForSnapshot = null;
        if (!empty($student['class_id'])) {
            $classRow = $db->table('classes')
                ->select('name')
                ->where('id', $student['class_id'])
                ->get()
                ->getRowArray();
            $classNameForSnapshot = $classRow['name'] ?? null;
        }

        // ── Atomic insert ──────────────────────────────────────────
        $db->transBegin();
        try {
            $this->paymentModel->insert($paymentData);

            if ($isGeneralPayment === 0) {
                // System-category: allocate to charges + capture balance snapshot
                $ledgerService       = new \App\Services\LedgerService($db);
                $ledgerService->allocatePaymentToCharges($studentId, $tenantId, $db);

                $ledger              = $ledgerService->getStudentBalance($studentId, $tenantId);
                $balanceAfterPayment = $ledger['balance'];
                $feeBalanceAfter     = $ledger['feeBalance'];
                $transportBalanceAfter = $ledger['transportBalance'];

                $snapshot = json_encode([
                    'studentName'   => trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
                    'className'     => $classNameForSnapshot ?? '',
                    'balanceBefore' => (float) ($balanceAfterPayment + $amount),
                    'feeBalanceBefore' => (float) ($feeBalanceAfter + $this->getCategoryFeeAmount($category, $amount)),
                    'transportBalanceBefore' => (float) ($transportBalanceAfter + $this->getCategoryTransportAmount($category, $amount)),
                    'paymentMethod' => $method,
                    'paymentDate'   => $date,
                    'amount'        => $amount,
                    'category'      => $category,
                ]);

                $this->paymentModel->set('balance_after_payment', $balanceAfterPayment)
                    ->set('fee_balance_after_payment', $feeBalanceAfter)
                    ->set('transport_balance_after_payment', $transportBalanceAfter)
                    ->set('snapshot', $snapshot)
                    ->where('id', $paymentId)
                    ->update();
            }
            if ($isGeneralPayment === 1) {
                $snapshot = json_encode([
                    'studentName'   => trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
                    'className'     => $classNameForSnapshot ?? '',
                    'paymentMethod' => $method,
                    'paymentDate'   => $date,
                    'amount'        => $amount,
                    'category'      => $category,
                ]);

                $this->paymentModel->set('snapshot', $snapshot)
                    ->where('id', $paymentId)
                    ->update();
            }
            // General payment: balance_after_payment stays NULL and no allocation

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', '[PaymentController::create] ' . $e->getMessage());
            return $this->serverError('Failed to record payment. Please try again.');
        }

        $saved = $this->paymentModel->find($paymentId);
        if (!$saved) {
            log_message('error', "[PaymentController::create] Payment inserted but not found: {$paymentId}");
            return $this->serverError('Payment was saved but could not be retrieved. Please refresh.');
        }
        $responseData = $this->paymentModel->formatForApi($saved);
        if ($transportWarning !== null) {
            $responseData['warning'] = $transportWarning;
        }
        return $this->created($responseData);
    }

    /**
     * Calculate the portion of a payment that applies to fee charges based on category.
     *
     * @param string $category Payment category name
     * @param float  $amount   Total payment amount
     * @return float Amount that applies to fee balance
     */
    private function getCategoryFeeAmount(string $category, float $amount): float
    {
        $feeCategories = ['Fees', 'Transport + Fees'];
        if (in_array($category, $feeCategories, true)) {
            return $amount;
        }
        return 0.0;
    }

    /**
     * Calculate the portion of a payment that applies to transport charges based on category.
     *
     * @param string $category Payment category name
     * @param float  $amount   Total payment amount
     * @return float Amount that applies to transport balance
     */
    private function getCategoryTransportAmount(string $category, float $amount): float
    {
        $transportCategories = ['Transport', 'Transport Fee'];
        if (in_array($category, $transportCategories, true)) {
            return $amount;
        }
        return 0.0;
    }

    // ──────────────────────────────────────────────────────────────
    // Multi-category payment helper (feature 061 US2)
    // ──────────────────────────────────────────────────────────────
    private function createMultiCategory(array $data, array $student, string $tenantId, float $totalAmount, string $date, string $method, ?array $currencyDetail = null, float $originalTotal = 0.0)
    {
        $categories = $data['categories'];
        $studentId  = $student['id'];

        if (empty($categories)) {
            return $this->error('Categories array must not be empty', 400);
        }

        // Validate allocations sum to total (compare against original currency amount when multi-currency)
        $validationTotal = $originalTotal > 0 ? $originalTotal : $totalAmount;
        $allocSum = array_sum(array_column($categories, 'amount'));
        if (abs($allocSum - $validationTotal) > 0.01) {
            return $this->error('Category allocations must sum to the total amount', 422);
        }

        // For multi-currency, compute proportional base-currency amount per category
        $conversionRatio = ($currencyDetail && $originalTotal > 0) ? $totalAmount / $originalTotal : 1.0;

        // Classify and guard against mixing
        $hasSystem  = false;
        $hasUserDef = false;
        foreach ($categories as $cat) {
            if (\Config\PaymentCategories::isSystemName($cat['categoryName'] ?? '')) {
                $hasSystem = true;
            } else {
                $hasUserDef = true;
            }
        }
        if ($hasSystem && $hasUserDef) {
            return $this->error('Cannot mix system and user-defined categories in one transaction', 422);
        }

        $isGeneralPayment = $hasUserDef ? 1 : 0;
        $groupId          = $this->generateId('grp');
        $receiptNumber    = $this->generateReceiptNumber();
        $description      = $this->sanitiseString($data['description'] ?? '');
        $now              = date('Y-m-d H:i:s');

        $db = \Config\Database::connect();
        $classNameForSnapshot = null;
        if (!empty($student['class_id'])) {
            $classRow = $db->table('classes')
                ->select('name')
                ->where('id', $student['class_id'])
                ->get()
                ->getRowArray();
            $classNameForSnapshot = $classRow['name'] ?? null;
        }

        $db->transBegin();
        try {
            $firstPaymentId = null;
            foreach ($categories as $cat) {
                $catName   = $this->sanitiseString($cat['categoryName'] ?? '');
                $catAmount = (float) ($cat['amount'] ?? 0);
                $baseCatAmount = round($catAmount * $conversionRatio, 2);
                $payId     = $this->generateId('p');
                if ($firstPaymentId === null) {
                    $firstPaymentId = $payId;
                }
                $this->paymentModel->insert([
                    'id'                 => $payId,
                    'tenant_id'          => $tenantId,
                    'student_id'         => $studentId,
                    'amount'             => $baseCatAmount,
                    'date'               => $date,
                    'method'             => $method,
                    'description'        => $description,
                    'category'           => $catName,
                    'receipt_number'     => $receiptNumber,
                    'is_general_payment' => $isGeneralPayment,
                    'payment_group_id'   => $groupId,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                    'currency_code'      => $currencyDetail['currencyCode'] ?? null,
                    'original_amount'    => $currencyDetail['originalAmount'] ?? null,
                    'exchange_rate'      => $currencyDetail['exchangeRate'] ?? null,
                    'rate_manual_override' => $currencyDetail['rateManualOverride'] ?? false,
                ]);
            }

            if ($isGeneralPayment === 0) {
                $ledgerService = new \App\Services\LedgerService($db);
                $ledgerService->allocatePaymentToCharges($studentId, $tenantId, $db);
                $ledger              = $ledgerService->getStudentBalance($studentId, $tenantId);
                $balanceAfterPayment = $ledger['balance'];
                $feeBalanceAfter     = $ledger['feeBalance'];
                $transportBalanceAfter = $ledger['transportBalance'];

                // Calculate fee and transport portions from the multi-category breakdown (base currency)
                $feeAmount = 0.0;
                $transportAmount = 0.0;
                foreach ($categories as $cat) {
                    $catName = $cat['categoryName'] ?? '';
                    $catAmount = (float) ($cat['amount'] ?? 0);
                    $baseCatAmount = round($catAmount * $conversionRatio, 2);
                    if (in_array($catName, ['Fees', 'Transport + Fees'], true)) {
                        $feeAmount += $baseCatAmount;
                    }
                    if (in_array($catName, ['Transport', 'Transport Fee'], true)) {
                        $transportAmount += $baseCatAmount;
                    }
                }

                $snapshot = json_encode([
                    'studentName'   => trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
                    'className'     => $classNameForSnapshot ?? '',
                    'balanceBefore' => (float) ($balanceAfterPayment + $feeAmount + $transportAmount),
                    'feeBalanceBefore' => (float) ($feeBalanceAfter + $feeAmount),
                    'transportBalanceBefore' => (float) ($transportBalanceAfter + $transportAmount),
                    'paymentMethod' => $method,
                    'paymentDate'   => $date,
                    'amount'        => $totalAmount,
                    'category'      => implode(', ', array_map(fn($cat) => $this->sanitiseString($cat['categoryName'] ?? ''), $categories)),
                ]);

                $this->paymentModel->set('balance_after_payment', $balanceAfterPayment)
                    ->set('fee_balance_after_payment', $feeBalanceAfter)
                    ->set('transport_balance_after_payment', $transportBalanceAfter)
                    ->set('snapshot', $snapshot)
                    ->where('payment_group_id', $groupId)
                    ->where('tenant_id', $tenantId)
                    ->update();
            } else {
                $snapshot = json_encode([
                    'studentName'   => trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
                    'className'     => $classNameForSnapshot ?? '',
                    'paymentMethod' => $method,
                    'paymentDate'   => $date,
                    'amount'        => $totalAmount,
                    'category'      => implode(', ', array_map(fn($cat) => $this->sanitiseString($cat['categoryName'] ?? ''), $categories)),
                ]);

                $this->paymentModel->set('snapshot', $snapshot)
                    ->where('payment_group_id', $groupId)
                    ->where('tenant_id', $tenantId)
                    ->update();
            }

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', '[PaymentController::createMultiCategory] ' . $e->getMessage());
            return $this->serverError('Failed to record payment. Please try again.');
        }

        $saved = $this->paymentModel->find($firstPaymentId);
        if (!$saved) {
            return $this->serverError('Payment was saved but could not be retrieved. Please refresh.');
        }
        return $this->created($this->paymentModel->formatForApi($saved));
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/payments/recent
    // ──────────────────────────────────────────────────────────────
    public function recent()
    {
        $tenantId = $this->getTenantId();
        $limit    = min(100, max(1, (int) ($this->request->getGet('limit') ?? 10)));
        $payments  = $this->paymentModel->getRecent($tenantId, $limit);
        return $this->success(array_map(fn($p) => $this->paymentModel->formatForApi($p), $payments));
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/payments/student/:studentId
    // ──────────────────────────────────────────────────────────────
    public function byStudent($studentId = null)
    {
        $tenantId = $this->getTenantId();

        $student = $this->studentModel
            ->select('students.*, classes.name AS class_name')
            ->join('classes', 'classes.id = students.class_id AND classes.tenant_id = students.tenant_id', 'left')
            ->where('students.id', $studentId)
            ->where('students.tenant_id', $tenantId)
            ->first();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        $query = $this->normalisePaymentHistoryQuery(15, 100, true);
        if (isset($query['error'])) {
            return $this->error($query['error'], 400);
        }

        [$termStart, $termEnd] = $this->resolveCurrentTermRange($tenantId);
        $history = $this->paymentModel->getStudentPaymentHistory(
            $tenantId,
            $studentId,
            $query['filters'],
            $query['limit'],
            $query['offset'],
            $termStart,
            $termEnd
        );

        $data = array_map(fn($p) => $this->paymentModel->formatForApi($p), $history['data']);
        $total = (int) ($history['pagination']['total'] ?? 0);
        $ledgerService = new \App\Services\LedgerService(\Config\Database::connect());
        $balance = $ledgerService->getStudentBalance($studentId, $tenantId);

        return $this->success([
            'student' => [
                'id' => $student['id'],
                'firstName' => $student['first_name'] ?? '',
                'lastName' => $student['last_name'] ?? '',
                'admissionNumber' => $student['admission_number'] ?? null,
                'classId' => $student['class_id'] ?? null,
                'className' => $student['class_name'] ?? null,
                'currentBalance' => (float) ($balance['balance'] ?? 0),
            ],
            'data' => $data,
            'pagination' => $this->buildPaginationMeta($total, $query['page'], $query['limit']),
            'summary' => $history['summary'],
            'filters' => $query['filters'],
        ]);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/payments/student/:studentId/term-total
    // ──────────────────────────────────────────────────────────────
    public function termTotal($studentId = null)
    {
        $tenantId = $this->getTenantId();

        // Verify student belongs to this tenant
        $student = $this->studentModel
            ->where('id', $studentId)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        $termId = $this->request->getGet('termId');

        // Determine date range from explicit termId or academic calendar
        $termStart = null;
        $termEnd   = null;
        $resolvedTermId = $termId;

        $tenant = \Config\Database::connect()
            ->table('tenants')
            ->where('id', $tenantId)
            ->get()->getRow();

        if ($tenant && isset($tenant->academic_calendar)) {
            $calendar = json_decode($tenant->academic_calendar, true);
            $terms    = $calendar['terms'] ?? [];
            $today    = date('Y-m-d');

            if ($termId) {
                // Use the explicitly supplied term
                foreach ($terms as $t) {
                    if ($t['id'] === $termId) {
                        $termStart = $t['start'];
                        $termEnd   = $t['end'];
                        break;
                    }
                }
            } else {
                // Find the term whose date range contains today
                foreach ($terms as $t) {
                    if ($today >= $t['start'] && $today <= $t['end']) {
                        $termStart      = $t['start'];
                        $termEnd        = $t['end'];
                        $resolvedTermId = $t['id'];
                        break;
                    }
                }
            }
        }

        if (!$termStart || !$termEnd) {
            // Fallback: calendar missing or term not found — use half-year heuristic
            $currentMonth = (int) date('m');
            $currentYear  = (int) date('Y');
            $termStart = $currentMonth <= 6 ? $currentYear . '-01-01' : $currentYear . '-07-01';
            $termEnd   = $currentMonth <= 6 ? $currentYear . '-06-30' : $currentYear . '-12-31';
        }

        $total = $this->paymentModel->getTotalByStudentAndDateRange($studentId, $termStart, $termEnd, $tenantId);
        return $this->success([
            'studentId' => $studentId,
            'termId'    => $resolvedTermId,
            'totalPaid' => $total,
            'total'     => $total, // keep legacy key for backward compat
        ]);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/payments/revenue-by-category
    // ──────────────────────────────────────────────────────────────
    public function revenueByCategory()
    {
        $tenantId = $this->getTenantId();
        return $this->success($this->paymentModel->getRevenueByCategory($tenantId));
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/payments/category-totals?dateFrom=&dateTo=
    // ──────────────────────────────────────────────────────────────
    public function categoryTotals()
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) {
            return $this->error('Unauthorized', 401);
        }

        $dateFrom = (string) ($this->request->getGet('dateFrom') ?? '');
        $dateTo   = (string) ($this->request->getGet('dateTo') ?? '');

        if ($dateFrom === '' || $dateTo === '') {
            return $this->error('Both dateFrom and dateTo are required. Use YYYY-MM-DD.', 400);
        }
        if (!$this->isValidDate($dateFrom)) {
            return $this->error('Invalid dateFrom value. Use YYYY-MM-DD.', 400);
        }
        if (!$this->isValidDate($dateTo)) {
            return $this->error('Invalid dateTo value. Use YYYY-MM-DD.', 400);
        }
        if ($dateFrom > $dateTo) {
            return $this->error('dateFrom must be before or equal to dateTo.', 400);
        }

        return $this->success($this->paymentModel->getCategoryTotals($tenantId, $dateFrom, $dateTo));
    }

    public function filterOptions()
    {
        $tenantId = $this->getTenantId();
        return $this->success($this->paymentModel->getFilterOptions($tenantId));
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/payments/with-students
    // ──────────────────────────────────────────────────────────────
    public function withStudents()
    {
        $tenantId = $this->getTenantId();

        $query = $this->normalisePaymentHistoryQuery(20, 100, false);
        if (isset($query['error'])) {
            return $this->error($query['error'], 400);
        }

        $payments = $this->paymentModel->getFilteredWithStudents($tenantId, $query['filters'], $query['limit'], $query['offset']);
        $total = $this->paymentModel->getFilteredCount($tenantId, $query['filters']);
        $summary = $this->paymentModel->getFilteredSummary($tenantId, $query['filters']);

        $result = array_map(function (array $payment): array {
            $row = $this->paymentModel->formatForApi($payment);
            $row['student'] = $payment['student_id_joined'] ? [
                'id' => $payment['student_id_joined'],
                'firstName' => $payment['student_first_name'] ?? '',
                'lastName' => $payment['student_last_name'] ?? '',
                'admissionNumber' => $payment['student_admission_number'] ?? null,
                'classId' => $payment['student_class_id'] ?? null,
                'className' => $payment['student_class_name'] ?? null,
            ] : null;
            return $row;
        }, $payments);

        return $this->success([
            'data' => $result,
            'pagination' => $this->buildPaginationMeta($total, $query['page'], $query['limit']),
            'summary' => $summary,
            'stats' => [
                'totalThisMonth' => $summary['totalThisMonth'],
                'paymentsToday' => $summary['paymentsToday'],
                'totalOutstanding' => $summary['totalOutstanding'],
            ],
            'filters' => $query['filters'],
        ]);
    }

    private function normalisePaymentHistoryQuery(int $defaultLimit, int $maxLimit, bool $studentScoped): array
    {
        $pageRaw = $this->request->getGet('page');
        $limitRaw = $this->request->getGet('limit');

        if ($pageRaw !== null && (!ctype_digit((string) $pageRaw) || (int) $pageRaw < 1)) {
            return ['error' => 'Invalid page value. Must be a positive integer.'];
        }

        if ($limitRaw !== null && (!ctype_digit((string) $limitRaw) || (int) $limitRaw < 1)) {
            return ['error' => 'Invalid limit value. Must be a positive integer.'];
        }

        $page = max(1, (int) ($pageRaw ?? 1));
        $limit = min($maxLimit, max(1, (int) ($limitRaw ?? $defaultLimit)));

        $month = $this->request->getGet('month');
        if ($month !== null && $month !== '' && $month !== 'all') {
            if (!ctype_digit((string) $month) || (int) $month < 1 || (int) $month > 12) {
                return ['error' => 'Invalid month value. Must be 1–12.'];
            }
            $month = (int) $month;
        } else {
            $month = null;
        }

        $year = $this->request->getGet('year');
        if ($year !== null && $year !== '' && $year !== 'all') {
            if (!ctype_digit((string) $year) || (int) $year < 1900 || (int) $year > 2200) {
                return ['error' => 'Invalid year value.'];
            }
            $year = (int) $year;
        } else {
            $year = null;
        }

        $dateFrom = $this->request->getGet('dateFrom');
        $dateTo = $this->request->getGet('dateTo');
        if ($dateFrom !== null && $dateFrom !== '' && !$this->isValidDate($dateFrom)) {
            return ['error' => 'Invalid dateFrom value. Use YYYY-MM-DD.'];
        }
        if ($dateTo !== null && $dateTo !== '' && !$this->isValidDate($dateTo)) {
            return ['error' => 'Invalid dateTo value. Use YYYY-MM-DD.'];
        }
        if ($dateFrom && $dateTo && $dateFrom > $dateTo) {
            return ['error' => 'dateFrom must be before or equal to dateTo.'];
        }

        $sortBy = (string) ($this->request->getGet('sortBy') ?? 'date');
        if (!in_array($sortBy, self::PAYMENT_SORT_FIELDS, true)) {
            return ['error' => 'Invalid sortBy value.'];
        }

        $sortOrder = strtolower((string) ($this->request->getGet('sortOrder') ?? 'desc'));
        if (!in_array($sortOrder, ['asc', 'desc'], true)) {
            return ['error' => 'Invalid sortOrder value. Must be asc or desc.'];
        }

        $paymentType = (string) ($this->request->getGet('paymentType') ?? 'all');
        if (!in_array($paymentType, self::PAYMENT_TYPES, true)) {
            return ['error' => 'Invalid paymentType value.'];
        }

        $includeVoided = $this->request->getGet('includeVoided');
        $includeVoided = $includeVoided === 'true' || $includeVoided === '1' || $includeVoided === 1;

        $filters = [
            'search' => $this->sanitiseString((string) ($this->request->getGet('search') ?? '')),
            'method' => $this->request->getGet('method') ?: null,
            'category' => $this->request->getGet('category'),
            'classId' => $studentScoped ? null : ($this->request->getGet('classId') ?: null),
            'month' => $month,
            'year' => $year,
            'dateFrom' => $dateFrom ?: null,
            'dateTo' => $dateTo ?: null,
            'paymentType' => $paymentType,
            'sortBy' => $sortBy,
            'sortOrder' => $sortOrder,
            'includeVoided' => $includeVoided,
        ];

        if ($filters['category'] === false || $filters['category'] === 'all') {
            $filters['category'] = null;
        }

        return [
            'page' => $page,
            'limit' => $limit,
            'offset' => ($page - 1) * $limit,
            'filters' => $filters,
        ];
    }

    private function isValidDate(string $value): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return false;
        }
        [$year, $month, $day] = array_map('intval', explode('-', $value));
        return checkdate($month, $day, $year);
    }

    private function resolveCurrentTermRange(string $tenantId): array
    {
        $tenant = \Config\Database::connect()
            ->table('tenants')
            ->where('id', $tenantId)
            ->get()
            ->getRow();

        if ($tenant && isset($tenant->academic_calendar)) {
            $calendar = json_decode($tenant->academic_calendar, true);
            $terms = $calendar['terms'] ?? [];
            $today = date('Y-m-d');
            foreach ($terms as $term) {
                if (($term['start'] ?? null) && ($term['end'] ?? null) && $today >= $term['start'] && $today <= $term['end']) {
                    return [$term['start'], $term['end']];
                }
            }
        }

        $currentMonth = (int) date('m');
        $currentYear = (int) date('Y');
        return $currentMonth <= 6
            ? [$currentYear . '-01-01', $currentYear . '-06-30']
            : [$currentYear . '-07-01', $currentYear . '-12-31'];
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/payments/report/pdf
    // ──────────────────────────────────────────────────────────────
    public function generateReportPdf()
    {
        if ($err = $this->requireRole('bursar', 'admin', 'super_admin')) {
            return $err;
        }

        $tenantId = $this->getTenantId();
        $termId   = $this->request->getGet('termId');
        $month    = $this->request->getGet('month');
        $year     = $this->request->getGet('year');
        $classId  = $this->request->getGet('classId');
        $method   = $this->request->getGet('method');
        $category = $this->request->getGet('category');
        $reportingCurrency = $this->request->getGet('reportingCurrency');

        if (empty($termId) && (empty($month) || empty($year))) {
            return $this->error('Either termId or both month and year are required.', 400);
        }

        $month = ($month !== null && $month !== '') ? (int) $month : null;
        $year  = ($year !== null && $year !== '')   ? (int) $year  : null;

        if ($month !== null && ($month < 1 || $month > 12)) {
            return $this->error('Invalid month. Must be between 1 and 12.', 400);
        }
        if ($year !== null && ($year < 1900 || $year > 2200)) {
            return $this->error('Invalid year.', 400);
        }

        $filters = [
            'termId'   => $termId   ?: null,
            'month'    => $month,
            'year'     => $year,
            'classId'  => $classId  ?: null,
            'method'   => $method   ?: null,
            'category' => $category ?: null,
            'reportingCurrency' => $reportingCurrency ?: null,
        ];

        try {
            $service = new \App\Services\FinancialReportService(\Config\Database::connect());
            $pdfBytes = $service->generateReport($tenantId, $filters);
        } catch (\RuntimeException $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'not found')) {
                return $this->notFound($msg);
            }
            return $this->error($msg, 400);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 400);
        } catch (\Throwable $e) {
            log_message('error', '[FinancialReport] ' . $e->getMessage());
            return $this->serverError('Failed to generate the financial report. Please try again.');
        }

        $periodLabel = preg_replace('/[^A-Za-z0-9\-]/', '-', $filters['termId'] ?? (($month ?? '') . '-' . ($year ?? '')));
        $filename    = 'financial-report-' . $periodLabel . '-' . date('Ymd') . '.pdf';

        return $this->response
            ->setStatusCode(200)
            ->setHeader('Content-Type', 'application/pdf')
            ->setHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->setHeader('Content-Length', (string) strlen($pdfBytes))
            ->setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
            ->setBody($pdfBytes);
    }

}

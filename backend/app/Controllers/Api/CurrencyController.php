<?php

namespace App\Controllers\Api;

use App\Models\ExchangeRateModel;
use App\Services\CurrencyService;
use CodeIgniter\Database\Config;

/**
 * CurrencyController — Multi-currency configuration and exchange rate management.
 *
 * Feature 094: Multi-Currency Financial System.
 *
 * Constitution compliance:
 *   I.   All queries filter by tenant_id from JWT (getTenantId()).
 *   III. JWTAuthFilter guards all routes; admin/bursar role checks on mutating endpoints.
 *   VI.  Uses BaseApiController::respondSuccess/respondError helpers; REST plural-noun paths.
 */
class CurrencyController extends BaseApiController
{
    private $db;
    private $currencyService;
    private $exchangeRateModel;

    public function __construct()
    {
        $this->db = Config::connect();
        $this->currencyService = new CurrencyService($this->db);
        $this->exchangeRateModel = new ExchangeRateModel();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/currencies — tenant currency configuration (all roles)
    // ──────────────────────────────────────────────────────────────────────────
    public function index()
    {
        $tenantId = $this->getTenantId();
        return $this->success([
            'baseCurrency' => $this->currencyService->getBaseCurrency($tenantId),
            'enabledCurrencies' => $this->currencyService->getEnabledCurrencies($tenantId),
            'supportedCurrencies' => CurrencyService::SUPPORTED_CURRENCIES,
            'baseCurrencyLocked' => $this->currencyService->isBaseCurrencyLocked($tenantId),
            'multiCurrencyEnabled' => $this->currencyService->isMultiCurrencyEnabled($tenantId),
        ]);
        // ──────────────────────────────────────────────────────────────────────────
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUT /api/currencies — update base currency / enabled currencies (admin only)
    // ──────────────────────────────────────────────────────────────────────────
    public function update($id = null)
    {
        if ($err = $this->requireRole('admin', 'super_admin')) {
            return $err;
        }

        $tenantId = $this->getTenantId();
        $data = $this->getRequestBody();

        $baseCurrency = $data['baseCurrency'] ?? null;
        $enabledCurrencies = $data['enabledCurrencies'] ?? null;
        $multiCurrencyEnabled = $data['multiCurrencyEnabled'] ?? null;

        try {
            $config = $this->currencyService->updateConfiguration($tenantId, $baseCurrency, $enabledCurrencies, $multiCurrencyEnabled !== null ? (bool) $multiCurrencyEnabled : null);
            return $this->success($config, 'Currency configuration updated');
        } catch (\InvalidArgumentException $e) {
            $code = (int) $e->getCode();
            return $this->error($e->getMessage(), $code > 0 ? $code : 400);
        } catch (\RuntimeException $e) {
            $code = (int) $e->getCode();
            if ($code === 409) {
                $currency = null;
                $dependentCount = 0;
                // Extract currency and count from message if possible
                if (preg_match('/currency (\w+): (\d+)/', $e->getMessage(), $m)) {
                    $currency = $m[1];
                    $dependentCount = (int) $m[2];
                }
                return $this->error($e->getMessage(), 409, [
                    'currency' => $currency,
                    'dependentCount' => $dependentCount,
                ]);
            }
            return $this->error($e->getMessage(), $code > 0 ? $code : 400);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/exchange-rates?currency=ZWL — list rate history (all roles)
    // ──────────────────────────────────────────────────────────────────────────
    public function listRates()
    {
        $tenantId = $this->getTenantId();
        $currency = $this->request->getGet('currency');

        if (!$currency) {
            return $this->error('currency query parameter is required', 400);
        }

        $rates = $this->exchangeRateModel->getForCurrency($tenantId, $currency);
        return $this->success(array_map(fn($r) => $this->exchangeRateModel->formatForApi($r), $rates));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/exchange-rates/lookup?currency=ZWL&date=2026-07-15 — resolve rate (all roles)
    // ──────────────────────────────────────────────────────────────────────────
    public function lookupRate()
    {
        $tenantId = $this->getTenantId();
        $currency = $this->request->getGet('currency');
        $date = $this->request->getGet('date');

        if (!$currency) {
            return $this->error('currency query parameter is required', 400);
        }
        if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $this->error('date query parameter is required (YYYY-MM-DD)', 400);
        }

        $rate = $this->exchangeRateModel->getRateForDate($tenantId, $currency, $date);
        return $this->success([
            'currencyCode' => $currency,
            'date' => $date,
            'rateToBase' => $rate ? (float) $rate['rate_to_base'] : null,
            'found' => $rate !== null,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/exchange-rates — create a new rate (admin/bursar)
    // ──────────────────────────────────────────────────────────────────────────
    public function createRate()
    {
        if ($err = $this->requireRole('admin', 'bursar', 'super_admin')) {
            return $err;
        }

        $tenantId = $this->getTenantId();
        $data = $this->getRequestBody();

        if ($missing = $this->requireFields($data, ['currency', 'rateToBase', 'effectiveDate'])) {
            return $missing;
        }

        $currency = $this->sanitiseString($data['currency']);
        $rateToBase = (float) $data['rateToBase'];
        $effectiveDate = $data['effectiveDate'];

        // Validate currency is enabled (FR-006)
        if (!$this->currencyService->isCurrencyEnabled($tenantId, $currency)) {
            return $this->error("{$currency} is not an enabled currency for this tenant", 400);
        }

        // Validate rate
        if ($rateToBase <= 0) {
            return $this->error('Exchange rate must be greater than zero', 400);
        }

        // Validate date format
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $effectiveDate) || !strtotime($effectiveDate)) {
            return $this->error('Invalid effective date format. Use YYYY-MM-DD', 400);
        }

        // Check for duplicate (FR-008)
        $existing = $this->exchangeRateModel->findDuplicate($tenantId, $currency, $effectiveDate);
        if ($existing) {
            return $this->error(
                "An exchange rate for {$currency} already exists for {$effectiveDate}. Update the existing rate instead.",
                409,
                ['existingRateId' => $existing['id']]
            );
        }

        $user = $this->getCurrentUser();
        $rateId = $this->generateId('xr');

        $this->exchangeRateModel->insert([
            'id' => $rateId,
            'tenant_id' => $tenantId,
            'currency_code' => $currency,
            'rate_to_base' => $rateToBase,
            'effective_date' => $effectiveDate,
            'created_by' => $user->userId ?? $user->id ?? null,
        ]);

        $rate = $this->exchangeRateModel->find($rateId);
        return $this->created($this->exchangeRateModel->formatForApi($rate), 'Exchange rate created');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUT /api/exchange-rates/{id} — update rate value (admin/bursar)
    // ──────────────────────────────────────────────────────────────────────────
    public function updateRate($id = null)
    {
        if ($err = $this->requireRole('admin', 'bursar', 'super_admin')) {
            return $err;
        }

        $tenantId = $this->getTenantId();
        if (!$id) {
            return $this->error('Exchange rate ID is required', 400);
        }

        $data = $this->getRequestBody();
        if (!isset($data['rateToBase'])) {
            return $this->error('rateToBase is required', 400);
        }

        $rateToBase = (float) $data['rateToBase'];
        if ($rateToBase <= 0) {
            return $this->error('Exchange rate must be greater than zero', 400);
        }

        // Find the rate (tenant-scoped)
        $rate = $this->exchangeRateModel
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$rate) {
            return $this->notFound('Exchange rate not found');
        }

        // Only rate_to_base is updatable; effective_date is immutable (FR-009)
        $this->exchangeRateModel->update($id, [
            'rate_to_base' => $rateToBase,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $updated = $this->exchangeRateModel->find($id);
        return $this->success($this->exchangeRateModel->formatForApi($updated), 'Exchange rate updated');
    }
}

<?php

namespace App\Services;

use App\Models\ExchangeRateModel;
use CodeIgniter\Database\Config;

/**
 * CurrencyService — Centralized multi-currency configuration and exchange rate resolution.
 *
 * Feature 094: Multi-Currency Financial System.
 *
 * Constitution compliance:
 *   I.  All queries filter by $tenantId (sourced from JWT, never from request body).
 *   II. All currency conversion and rate resolution logic lives here (not in controllers/frontend).
 *   V.  The base-currency `amount` on charges/payments is the authoritative ledger value;
 *       this service computes it once at transaction creation time and never recomputes
 *       it for existing transactions (FR-017 immutability).
 *   XI. ExchangeRateModel::getRateForDate uses the idx_exchange_rates_lookup composite
 *       index for O(log n) date-range lookups — at most one rate lookup per transaction,
 *       no N+1 patterns.
 *
 * Rate convention (research.md §5): rate_to_base is "1 base currency = rate_to_base
 * transaction currency". Conversion: baseCurrencyAmount = originalAmount / rate_to_base.
 */
class CurrencyService
{
    /** Supported currency codes (extendable via SettingsController::VALID_CURRENCIES). */
    public const SUPPORTED_CURRENCIES = [
        'USD', 'ZWL', 'ZAR', 'EUR', 'GBP',
        'ZMW', 'BWP', 'KES', 'NGN', 'MZN', 'GHS',
        'CNY', 'INR', 'AUD', 'CAD',
    ];

    private $db;
    private $exchangeRateModel;

    public function __construct($db = null)
    {
        $this->db = $db ?? Config::connect();
        $this->exchangeRateModel = new ExchangeRateModel();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TENANT CURRENCY CONFIGURATION
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the tenant's base currency.
     *
     * Always returns USD — it is the system-wide base currency and is not
     * configurable per tenant. All charges and payments store amounts in USD
     * as the base currency equivalent.
     */
    public function getBaseCurrency(string $tenantId): string
    {
        return 'USD';
    }

    /**
     * Check if multi-currency support is enabled for the tenant.
     *
     * When false, the tenant operates in single-currency (base-only) mode.
     * The stored enabledCurrencies list is preserved so re-enabling restores
     * the previously configured currencies instantly.
     *
     * Defaults to false (OFF) for backward compatibility.
     */
    public function isMultiCurrencyEnabled(string $tenantId): bool
    {
        $settings = $this->getTenantSettings($tenantId);
        return isset($settings['multiCurrencyEnabled']) && $settings['multiCurrencyEnabled'] === true;
    }

    /**
     * Get the tenant's enabled transaction currencies (always includes base currency).
     *
     * When multi-currency is disabled, returns only [baseCurrency] regardless
     * of the stored enabledCurrencies list (which is preserved for re-enable).
     *
     * @return string[]
     */
    public function getEnabledCurrencies(string $tenantId): array
    {
        $base = $this->getBaseCurrency($tenantId);

        // When multi-currency is off, only the base currency is available
        if (!$this->isMultiCurrencyEnabled($tenantId)) {
            return [$base];
        }

        $settings = $this->getTenantSettings($tenantId);
        $enabled = $settings['enabledCurrencies'] ?? [$base];
        // Ensure base currency is always present
        if (!in_array($base, $enabled, true)) {
            $enabled[] = $base;
        }
        return $enabled;
    }

    /**
     * Check if the base currency is locked (cannot be changed).
     *
     * Always returns true — USD is the system-wide default base currency
     * and is locked from tenant creation. Tenants can enable additional
     * transaction currencies but cannot change the base currency.
     */
    public function isBaseCurrencyLocked(string $tenantId): bool
    {
        return true;
    }

    /**
     * Check if a currency code is enabled for the tenant.
     */
    public function isCurrencyEnabled(string $tenantId, string $currencyCode): bool
    {
        return in_array($currencyCode, $this->getEnabledCurrencies($tenantId), true);
    }

    /**
     * Count dependent transactions for a currency code (charges + payments).
     *
     * Used by FR-003 to prevent disabling a currency that has existing transactions.
     */
    public function countDependentTransactions(string $tenantId, string $currencyCode): int
    {
        $chargeCount = $this->db->table('charges')
            ->where('tenant_id', $tenantId)
            ->where('currency_code', $currencyCode)
            ->where('deleted_at', null)
            ->countAllResults();
        $paymentCount = $this->db->table('payments')
            ->where('tenant_id', $tenantId)
            ->where('currency_code', $currencyCode)
            ->countAllResults();
        return $chargeCount + $paymentCount;
    }

    /**
     * Update the tenant's currency configuration (base + enabled list).
     *
     * @param string $tenantId
     * @param string|null $baseCurrency  New base currency (ignored if locked)
     * @param array|null $enabledCurrencies  New enabled currency list
     * @return array Updated configuration
     * @throws \InvalidArgumentException When base currency is locked and differs, or a currency to disable has dependents
     */
    public function updateConfiguration(string $tenantId, ?string $baseCurrency, ?array $enabledCurrencies, ?bool $multiCurrencyEnabled = null): array
    {
        $currentBase = $this->getBaseCurrency($tenantId);
        $currentEnabled = $this->getEnabledCurrencies($tenantId);

        // Validate base currency change
        if ($baseCurrency !== null && $baseCurrency !== $currentBase) {
            if ($this->isBaseCurrencyLocked($tenantId)) {
                throw new \InvalidArgumentException('Cannot change base currency after transactions have been recorded');
            }
            if (!in_array($baseCurrency, self::SUPPORTED_CURRENCIES, true)) {
                throw new \InvalidArgumentException('Unsupported base currency: ' . $baseCurrency);
            }
            $currentBase = $baseCurrency;
        }

        // Validate enabled currencies
        if ($enabledCurrencies !== null) {
            foreach ($enabledCurrencies as $code) {
                if (!in_array($code, self::SUPPORTED_CURRENCIES, true)) {
                    throw new \InvalidArgumentException('Unsupported currency code: ' . $code);
                }
            }
            // Base currency must always be in the enabled list
            if (!in_array($currentBase, $enabledCurrencies, true)) {
                $enabledCurrencies[] = $currentBase;
            }
            // Check for currencies being removed that have dependent transactions (FR-003)
            $removed = array_diff($currentEnabled, $enabledCurrencies);
            foreach ($removed as $code) {
                $dependentCount = $this->countDependentTransactions($tenantId, $code);
                if ($dependentCount > 0) {
                    throw new \RuntimeException(
                        "Cannot disable currency {$code}: {$dependentCount} existing transaction(s) use it",
                        409
                    );
                }
            }
            $currentEnabled = $enabledCurrencies;
        }

        // Persist enabled currencies and multi-currency toggle to tenants.settings JSON
        // (baseCurrency is not persisted — it is hardcoded to USD)
        $settings = $this->getTenantSettings($tenantId);
        $settings['enabledCurrencies'] = $currentEnabled;
        if ($multiCurrencyEnabled !== null) {
            $settings['multiCurrencyEnabled'] = $multiCurrencyEnabled;
        }
        $this->db->table('tenants')
            ->where('id', $tenantId)
            ->update([
                'settings' => json_encode($settings),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        // When multi-currency is off, report only base currency as enabled
        $effectiveEnabled = $this->isMultiCurrencyEnabled($tenantId)
            ? $currentEnabled
            : [$this->getBaseCurrency($tenantId)];

        return [
            'baseCurrency' => 'USD',
            'enabledCurrencies' => $effectiveEnabled,
            'supportedCurrencies' => self::SUPPORTED_CURRENCIES,
            'baseCurrencyLocked' => $this->isBaseCurrencyLocked($tenantId),
            'multiCurrencyEnabled' => $this->isMultiCurrencyEnabled($tenantId),
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // EXCHANGE RATE RESOLUTION
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Resolve the exchange rate for a given currency + date (research.md §3).
     *
     * @return array|null The rate row, or null if no rate exists on or before the date
     */
    public function getRateForDate(string $tenantId, string $currencyCode, string $date): ?array
    {
        return $this->exchangeRateModel->getRateForDate($tenantId, $currencyCode, $date);
    }

    /**
     * Resolve transaction currency details for a charge or payment.
     *
     * This is the single entry point used by ChargeController, PaymentController,
     * FeeRuleBillingService, TransportController, and FeeCampaignService to ensure
     * consistent currency resolution across all transaction types.
     *
     * @param string $tenantId
     * @param string|null $currencyCode  Transaction currency (null/empty = base currency)
     * @param string $date  Transaction date (Y-m-d)
     * @param float $originalAmount  Amount in the transaction currency
     * @param float|null $exchangeRateOverride  Manual override (FR-014); null = auto-resolve
     * @return array{currencyCode: string|null, originalAmount: float|null, exchangeRate: float|null, rateManualOverride: bool, baseCurrencyAmount: float}
     * @throws \InvalidArgumentException When currency is not enabled (FR-015)
     * @throws \RuntimeException When no exchange rate is resolvable (FR-016)
     */
    public function resolveTransactionCurrency(
        string $tenantId,
        ?string $currencyCode,
        string $date,
        float $originalAmount,
        ?float $exchangeRateOverride = null
    ): array {
        $baseCurrency = $this->getBaseCurrency($tenantId);

        // No currency specified or base currency → no conversion needed
        if ($currencyCode === null || $currencyCode === '' || $currencyCode === $baseCurrency) {
            return [
                'currencyCode' => null,
                'originalAmount' => null,
                'exchangeRate' => null,
                'rateManualOverride' => false,
                'baseCurrencyAmount' => $originalAmount,
            ];
        }

        // Validate currency is enabled (FR-015)
        if (!$this->isCurrencyEnabled($tenantId, $currencyCode)) {
            throw new \InvalidArgumentException(
                "{$currencyCode} is not an enabled currency for this tenant",
                400
            );
        }

        // Resolve exchange rate
        $rateManualOverride = false;
        if ($exchangeRateOverride !== null && $exchangeRateOverride > 0) {
            $rateToBase = (float) $exchangeRateOverride;
            $rateManualOverride = true;
        } else {
            $rateRow = $this->getRateForDate($tenantId, $currencyCode, $date);
            if ($rateRow === null) {
                throw new \RuntimeException(
                    "No exchange rate found for {$currencyCode} on or before {$date}. Please enter an exchange rate first.",
                    422
                );
            }
            $rateToBase = (float) $rateRow['rate_to_base'];
        }

        // Convert: baseCurrencyAmount = originalAmount / rateToBase (research.md §5)
        $baseCurrencyAmount = round($originalAmount / $rateToBase, 2);

        return [
            'currencyCode' => $currencyCode,
            'originalAmount' => $originalAmount,
            'exchangeRate' => $rateToBase,
            'rateManualOverride' => $rateManualOverride,
            'baseCurrencyAmount' => $baseCurrencyAmount,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Read the tenant's settings JSON as an associative array.
     */
    private function getTenantSettings(string $tenantId): array
    {
        $tenant = $this->db->table('tenants')
            ->where('id', $tenantId)
            ->get()
            ->getRowArray();
        if (!$tenant || empty($tenant['settings'])) {
            return [];
        }
        return json_decode($tenant['settings'], true) ?? [];
    }
}

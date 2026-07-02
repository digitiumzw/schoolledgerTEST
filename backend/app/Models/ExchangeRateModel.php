<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * ExchangeRateModel — Historical, date-effective exchange rates per tenant.
 *
 * Feature 094: Multi-currency support.
 * Constitution Principle I: All queries filter by tenant_id.
 *
 * Rate convention (research.md §5): rate_to_base is expressed as
 * "1 base currency = rate_to_base transaction currency".
 * Conversion from transaction currency to base currency:
 *   baseCurrencyAmount = originalAmount / rate_to_base
 */
class ExchangeRateModel extends Model
{
    protected $table = 'exchange_rates';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id', 'tenant_id', 'currency_code', 'rate_to_base',
        'effective_date', 'created_by', 'created_at', 'updated_at',
    ];
    protected $useTimestamps = true;

    /**
     * Get all exchange rates for a currency pair, ordered by effective_date ASC (FR-010).
     *
     * @param string $tenantId
     * @param string $currencyCode Transaction currency code
     * @return array
     */
    public function getForCurrency(string $tenantId, string $currencyCode): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('currency_code', $currencyCode)
            ->orderBy('effective_date', 'ASC')
            ->findAll();
    }

    /**
     * Resolve the applicable exchange rate for a given date (research.md §3).
     *
     * Returns the most recent rate whose effective_date is on or before the given date.
     * Uses the idx_exchange_rates_lookup composite index for O(log n) lookup.
     *
     * @param string $tenantId
     * @param string $currencyCode
     * @param string $date Y-m-d
     * @return array|null The rate row, or null if no rate exists on or before the date
     */
    public function getRateForDate(string $tenantId, string $currencyCode, string $date): ?array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('currency_code', $currencyCode)
            ->where('effective_date <=', $date)
            ->orderBy('effective_date', 'DESC')
            ->first();
    }

    /**
     * Find a duplicate rate for the same (tenant, currency, effective_date) — FR-008.
     *
     * @return array|null Existing rate row if a duplicate exists, null otherwise
     */
    public function findDuplicate(string $tenantId, string $currencyCode, string $effectiveDate): ?array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('currency_code', $currencyCode)
            ->where('effective_date', $effectiveDate)
            ->first();
    }

    /**
     * Format an exchange rate row for API response.
     */
    public function formatForApi(array $rate): array
    {
        return [
            'id'            => $rate['id'],
            'currencyCode'  => $rate['currency_code'],
            'rateToBase'    => (float) $rate['rate_to_base'],
            'effectiveDate' => $rate['effective_date'],
            'createdBy'     => $rate['created_by'] ?? null,
            'createdAt'     => $rate['created_at'] ?? null,
        ];
    }
}

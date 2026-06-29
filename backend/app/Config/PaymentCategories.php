<?php

namespace Config;

/**
 * PaymentCategories — System (hard-coded) payment categories.
 *
 * Feature: 057-payment-billing-ux (research.md §D3)
 *
 * Three system categories are always present in every tenant's payment
 * categories list. They act as bookkeeping tags only; the FIFO charge
 * allocation in LedgerService routes by route_id (not by category name).
 *
 *   __fees           "Fees"             Tag for fee-structure payments
 *   __transport      "Transport"        Tag for transport payments
 *   __transport_fees "Transport + Fees" Tag for combined payments
 *
 * These are injected by SettingsController::getPaymentCategories() at read
 * time and are not persisted in tenants.settings.payment_categories. Attempts
 * to create/update/delete a user-defined category with a name matching any of
 * these system names are rejected.
 * 
 * __transport_fees  is no longer needed ignore it
 */
class PaymentCategories
{
    /**
     * @var array<int, array{id: string, name: string, system: bool}>
     */
    public const SYSTEM_CATEGORIES = [
        [
            'id'     => '__fees',
            'name'   => 'Fees',
            'system' => true,
        ],
        [
            'id'     => '__transport',
            'name'   => 'Transport',
            'system' => true,
        ],
        // [
        //     'id'     => '__transport_fees',
        //     'name'   => 'Transport + Fees',
        //     'system' => true,
        // ],
        // Transport + Fees system category is no longer needed 
    ];

    /**
     * Return the lowercase-trimmed system category names for case-insensitive
     * comparison.
     *
     * @return string[]
     */
    public static function systemNamesLower(): array
    {
        $names = [];
        foreach (self::SYSTEM_CATEGORIES as $cat) {
            $names[] = strtolower(trim($cat['name']));
        }
        return $names;
    }

    /**
     * Check whether the given name matches a system category name
     * (case-insensitive, whitespace-trimmed).
     */
    public static function isSystemName(string $name): bool
    {
        return in_array(strtolower(trim($name)), self::systemNamesLower(), true);
    }
}

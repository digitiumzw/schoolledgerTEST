<?php

namespace App\Database\Seeds\Scenarios;

/**
 * MixedFinancialScenario
 *
 * Creates students with diverse financial states:
 * - 20% fully paid
 * - 30% partially paid
 * - 30% outstanding balance
 * - 10% overdue charges
 * - 10% with credit adjustments
 *
 * This is useful for testing the financial ledger UI, reports, and balance calculations.
 */
class MixedFinancialScenario extends AbstractScenario
{
    public function name(): string
    {
        return 'mixed-financial';
    }

    public function description(): string
    {
        return 'Diverse financial states: fully paid, partial, outstanding, overdue, and credit-adjusted students';
    }

    public function configure(array &$config): void
    {
        // More charges and payments to create varied ledger states
        $config['chargesPerStudent']  = 4;
        $config['paymentsPerStudent'] = 2;
    }
}

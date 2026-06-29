<?php

namespace App\Database\Seeds\Scenarios;

/**
 * DefaultScenario
 *
 * Standard balanced distribution (used when no --scenario is given).
 */
class DefaultScenario extends AbstractScenario
{
    public function name(): string
    {
        return 'default';
    }

    public function description(): string
    {
        return 'Standard balanced dataset: mixed financial states, typical attendance distribution';
    }

    public function configure(array &$config): void
    {
        // No overrides — use the config as-is
    }
}

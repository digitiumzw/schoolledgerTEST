<?php

namespace App\Database\Seeds\Scenarios;

/**
 * AbstractScenario
 *
 * Base class for predefined seeding scenarios.
 * Scenarios modify configuration before seeding begins.
 */
abstract class AbstractScenario
{
    /**
     * Modify the seeder configuration for this scenario.
     * Override specific config keys as needed.
     */
    abstract public function configure(array &$config): void;

    /**
     * Human-readable name for this scenario.
     */
    abstract public function name(): string;

    /**
     * Brief description of what this scenario produces.
     */
    abstract public function description(): string;
}

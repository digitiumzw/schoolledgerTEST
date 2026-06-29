<?php

namespace App\Database\Seeds;

use App\Database\Seeds\Scenarios\AbstractScenario;
use App\Database\Seeds\Scenarios\DefaultScenario;
use App\Database\Seeds\Scenarios\MixedFinancialScenario;
use App\Database\Seeds\Scenarios\AttendanceVariationsScenario;
use App\Database\Seeds\Scenarios\ClassPromotionChainScenario;

/**
 * ScenarioRegistry
 *
 * Register and retrieve predefined seeding scenarios by name.
 */
class ScenarioRegistry
{
    private array $scenarios = [];

    public function __construct()
    {
        $this->register(new DefaultScenario());
        $this->register(new MixedFinancialScenario());
        $this->register(new AttendanceVariationsScenario());
        $this->register(new ClassPromotionChainScenario());
    }

    public function register(AbstractScenario $scenario): void
    {
        $this->scenarios[$scenario->name()] = $scenario;
    }

    public function get(string $name): ?AbstractScenario
    {
        return $this->scenarios[$name] ?? null;
    }

    public function exists(string $name): bool
    {
        return isset($this->scenarios[$name]);
    }

    /**
     * Returns all registered scenario names.
     */
    public function getAll(): array
    {
        return $this->scenarios;
    }

    /**
     * Returns a list of [name => description] for display.
     */
    public function listScenarios(): array
    {
        $result = [];
        foreach ($this->scenarios as $name => $scenario) {
            $result[$name] = $scenario->description();
        }
        return $result;
    }
}

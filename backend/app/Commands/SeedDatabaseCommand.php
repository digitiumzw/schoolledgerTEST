<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Database\Seeds\DatabaseSeeder;
use App\Database\Seeds\ScenarioRegistry;

/**
 * SeedDatabaseCommand
 *
 * Spark CLI command for the configurable platform database seeder.
 *
 * Usage:
 *   php spark db:seed:platform [options]
 *
 * Options:
 *   --fresh                    Truncate all tables before seeding (default)
 *   --append                   Append to existing data (skip truncation)
 *   --tenants=N                Number of tenants to create (default: 1)
 *   --users-per-tenant=N       Users per tenant (default: 4)
 *   --staff-per-tenant=N       Staff per tenant (default: 8)
 *   --classes-per-tenant=N     Classes per tenant (default: 5)
 *   --students-per-class=N     Students per class (default: 10)
 *   --charges-per-student=N    Charges per student (default: 2)
 *   --payments-per-student=N   Payments per student (default: 1)
 *   --transport-routes=N       Transport routes per tenant (default: 2)
 *   --attendance-days=N        Days of attendance history (default: 30)
 *   --scenario=NAME            Predefined scenario name
 *   --only=a,b,c               Only seed these entity types
 *   --skip=a,b,c               Skip these entity types
 *   --batch-size=N             Records per batch insert (default: 100)
 *   --force-production         Allow running in production (dangerous!)
 *   --list-scenarios           List available scenarios and exit
 */
class SeedDatabaseCommand extends BaseCommand
{
    protected $group       = 'Database';
    protected $name        = 'db:seed:platform';
    protected $description = 'Configurable platform database seeder for development/testing';
    protected $usage       = 'db:seed:platform [options]';

    protected $options = [
        '--fresh'                  => 'Truncate all tables before seeding (default)',
        '--append'                 => 'Append to existing data',
        '--tenants'                => 'Number of tenants to create',
        '--users-per-tenant'       => 'Users per tenant',
        '--staff-per-tenant'       => 'Staff per tenant',
        '--classes-per-tenant'     => 'Classes per tenant',
        '--students-per-class'     => 'Students per class',
        '--charges-per-student'    => 'Charges per student',
        '--payments-per-student'   => 'Payments per student',
        '--transport-routes'       => 'Transport routes per tenant',
        '--attendance-days'        => 'Days of attendance history',
        '--scenario'               => 'Predefined scenario name',
        '--only'                   => 'Comma-separated list of entity types to seed',
        '--skip'                   => 'Comma-separated list of entity types to skip',
        '--batch-size'             => 'Records per batch insert',
        '--force-production'       => 'Allow seeding in production (use with caution)',
        '--list-scenarios'         => 'List all available scenarios and exit',
    ];

    public function run(array $params)
    {
        // Production guard
        $env = env('CI_ENVIRONMENT', 'production');
        if ($env === 'production' && !$this->hasFlag('force-production')) {
            CLI::error('');
            CLI::error('DANGER: This command is not safe to run in production!');
            CLI::error('If you really want to seed production data, use --force-production.');
            CLI::error('');
            return EXIT_ERROR;
        }

        // List scenarios mode
        if ($this->hasFlag('list-scenarios')) {
            $this->listScenarios();
            return EXIT_SUCCESS;
        }

        // Validate scenario if provided
        $scenario = $this->getOpt('scenario');
        if ($scenario) {
            $registry = new ScenarioRegistry();
            if (!$registry->exists($scenario)) {
                CLI::error("Unknown scenario: '{$scenario}'");
                CLI::write("Available scenarios:");
                foreach ($registry->listScenarios() as $name => $desc) {
                    CLI::write("  {$name}  -  {$desc}");
                }
                return EXIT_ERROR;
            }
        }

        // Determine mode
        $mode = 'fresh';
        if ($this->hasFlag('append')) {
            $mode = 'append';
        }

        // Build configuration from CLI options
        $config = [
            'mode'                     => $mode,
            'tenantCount'              => (int) ($this->getOpt('tenants') ?? 1),
            'usersPerTenant'           => (int) ($this->getOpt('users-per-tenant') ?? 4),
            'staffPerTenant'           => (int) ($this->getOpt('staff-per-tenant') ?? 8),
            'classesPerTenant'         => (int) ($this->getOpt('classes-per-tenant') ?? 5),
            'studentsPerClass'         => (int) ($this->getOpt('students-per-class') ?? 10),
            'chargesPerStudent'        => (int) ($this->getOpt('charges-per-student') ?? 2),
            'paymentsPerStudent'       => (int) ($this->getOpt('payments-per-student') ?? 1),
            'transportRoutesPerTenant' => (int) ($this->getOpt('transport-routes') ?? 2),
            'attendanceDays'           => (int) ($this->getOpt('attendance-days') ?? 30),
            'batchSize'                => (int) ($this->getOpt('batch-size') ?? 100),
            'scenario'                 => $scenario ?: null,
            'only'                     => $this->parseList($this->getOpt('only')),
            'skip'                     => $this->parseList($this->getOpt('skip')),
        ];

        // Validate --only / --skip combinations
        if (!empty($config['only']) && in_array('students', $config['only'], true)
            && !in_array('classes', $config['only'], true)) {
            CLI::error("Cannot seed 'students' without 'classes'. Add 'classes' to --only or remove 'students'.");
            return EXIT_ERROR;
        }

        // Run the seeder
        $seeder = new DatabaseSeeder(config('Database'), \Config\Database::connect());
        $seeder->configure($config);
        $seeder->run();

        return EXIT_SUCCESS;
    }

    /**
     * Get a CLI option, supporting both --option=value and --option value formats.
     * CI4's CLI::getOption() only supports the space-separated format natively.
     */
    private function getOpt(string $name): ?string
    {
        // CI4 standard: --option value
        $val = CLI::getOption($name);
        if ($val !== null) {
            return (string) $val;
        }

        // Extended: --option=value
        foreach ($_SERVER['argv'] ?? [] as $arg) {
            if (preg_match('/^--' . preg_quote($name, '/') . '=(.+)$/', $arg, $m)) {
                return $m[1];
            }
        }

        return null;
    }

    /**
     * Check if a boolean flag is set: --flag or --flag=true
     */
    private function hasFlag(string $name): bool
    {
        if (CLI::getOption($name) !== null) {
            return true;
        }
        foreach ($_SERVER['argv'] ?? [] as $arg) {
            if ($arg === "--{$name}" || str_starts_with($arg, "--{$name}=")) {
                return true;
            }
        }
        return false;
    }

    /**
     * Parse a comma-separated string into an array.
     */
    private function parseList(?string $value): array
    {
        if (empty($value)) {
            return [];
        }
        return array_filter(array_map('trim', explode(',', $value)));
    }

    /**
     * Print available scenarios.
     */
    private function listScenarios(): void
    {
        $registry = new ScenarioRegistry();
        CLI::write('');
        CLI::write('Available scenarios:', 'green');
        CLI::write(str_repeat('─', 60));
        foreach ($registry->listScenarios() as $name => $desc) {
            CLI::write(str_pad($name, 25) . $desc);
        }
        CLI::write('');
        CLI::write('Usage: php spark db:seed:platform --scenario=<name>');
        CLI::write('');
    }
}

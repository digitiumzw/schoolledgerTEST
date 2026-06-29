<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Database\Seeds\PlatformSeeder;

/**
 * SeedPlatformCommand
 *
 * Idempotent bootstrap command for the platform control panel.
 * Seeds the initial admin account, default settings, and subscription plans.
 *
 * Usage:
 *   php spark platform:seed
 *
 * Safe to run multiple times — existing records are never overwritten.
 */
class SeedPlatformCommand extends BaseCommand
{
    protected $group       = 'Platform';
    protected $name        = 'platform:seed';
    protected $description = 'Bootstrap platform admin account, default settings, and subscription plans';
    protected $usage       = 'platform:seed';

    public function run(array $params): int
    {
        $env = env('CI_ENVIRONMENT', 'production');

        if ($env === 'production') {
            CLI::write('');
            CLI::write('Running platform:seed in production.', 'yellow');
            CLI::write('This is idempotent and will not overwrite existing data.', 'yellow');
            CLI::write('');

            $confirm = CLI::prompt('Continue?', ['y', 'n']);
            if (strtolower($confirm) !== 'y') {
                CLI::write('Aborted.', 'red');
                return EXIT_ERROR;
            }
        }

        CLI::write('');
        CLI::write('School Ledger — Platform Bootstrap', 'green');
        CLI::write(str_repeat('─', 50));

        $db     = \Config\Database::connect();
        $seeder = new PlatformSeeder(\Config\Database::forge(), $db);
        $seeder->run();

        CLI::write(str_repeat('─', 50));
        CLI::write('');
        CLI::write('Platform seeding complete.', 'green');
        CLI::write('');
        CLI::write('  Login URL : ' . (env('SITE_URL') ?: env('app.baseURL', 'http://localhost:8081')) . '/platform-control-panel');
        CLI::write('  Email     : admin@schoolledger.io');
        CLI::write('  Password  : Admin@1234!  (change this immediately)');
        CLI::write('');

        return EXIT_SUCCESS;
    }
}

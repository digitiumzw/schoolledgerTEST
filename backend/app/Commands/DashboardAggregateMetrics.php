<?php

namespace App\Commands;

use App\Services\DashboardAggregationService;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class DashboardAggregateMetrics extends BaseCommand
{
    protected $group = 'Dashboard';
    protected $name = 'dashboard:aggregate-metrics';
    protected $description = 'Aggregate dashboard KPI metrics for all tenants or one tenant.';
    protected $usage = 'dashboard:aggregate-metrics [--tenant <id>] [--cleanup]';
    protected $options = [
        '--tenant' => 'Aggregate metrics for one tenant only',
        '--cleanup' => 'Delete expired dashboard metrics older than one day',
    ];

    public function run(array $params): void
    {
        $service = new DashboardAggregationService();
        $tenantId = CLI::getOption('tenant');
        $cleanup = CLI::getOption('cleanup') !== null;

        if ($tenantId) {
            $count = $service->aggregateTenant($tenantId);
            CLI::write("Aggregated {$count} dashboard metrics for tenant {$tenantId}", 'green');
        } else {
            $results = $service->aggregateAllTenants();
            foreach ($results as $id => $count) {
                CLI::write("Aggregated {$count} dashboard metrics for tenant {$id}", 'green');
            }
        }

        if ($cleanup) {
            $deleted = $service->cleanupExpired();
            CLI::write("Deleted {$deleted} expired dashboard metric rows", 'yellow');
        }
    }
}

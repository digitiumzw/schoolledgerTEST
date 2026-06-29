<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Services\PlanExpirationNotificationService;

/**
 * Check Expiring Subscriptions Command
 *
 * This command checks for subscriptions that are expiring within 7 days
 * and sends notification emails to the affected users.
 *
 * It should be run daily via cron job to ensure timely notifications.
 *
 * Usage:
 *   php spark subscriptions:check-expiring
 *   php spark subscriptions:check-expiring --days 7
 *   php spark subscriptions:check-expiring --dry-run
 */
class CheckExpiringSubscriptions extends BaseCommand
{
    /**
     * The Command's Group.
     *
     * @var string
     */
    protected $group = 'Subscriptions';

    /**
     * The Command's Name.
     *
     * @var string
     */
    protected $name = 'subscriptions:check-expiring';

    /**
     * The Command's Description.
     *
     * @var string
     */
    protected $description = 'Check for expiring subscriptions and send notifications';

    /**
     * The Command's Usage.
     *
     * @var string
     */
    protected $usage = 'subscriptions:check-expiring [options]';

    /**
     * The Command's Options.
     *
     * @var array
     */
    protected $options = [
        '--days' => 'Number of days before expiration to notify (default: 7)',
        '--dry-run' => 'Show what would be notified without actually sending',
    ];

    /**
     * Actually execute a command.
     *
     * @param array $params
     */
    public function run(array $params)
    {
        $days = CLI::getOption('days') ?? 7;
        $dryRun = CLI::getOption('dry-run') !== null;

        CLI::write('Subscription Expiration Check', 'green');
        CLI::write("=============================", 'green');
        CLI::write("Days threshold: {$days}", 'cyan');
        CLI::write("Dry run: " . ($dryRun ? 'YES' : 'NO'), 'cyan');
        CLI::write('');

        try {
            $service = new PlanExpirationNotificationService();
            
            if ($dryRun) {
                // In dry run mode, just show what would be processed
                $this->runDryRun($service, $days);
            } else {
                // Run the actual notification process
                $result = $service->processExpiringSubscriptions($days);
                
                CLI::write("Processed: {$result['processed']} subscriptions", 'cyan');
                CLI::write("Notified: {$result['notified']} subscriptions", 'green');
                
                if (!empty($result['errors'])) {
                    CLI::write("Errors: " . count($result['errors']), 'red');
                    foreach ($result['errors'] as $error) {
                        CLI::write("  - Subscription {$error['subscription_id']}: {$error['error']}", 'red');
                    }
                }
                
                // Log the completion
                $logMessage = "Subscription expiration check completed: {$result['notified']}/{$result['processed']} notified";
                log_message('info', $logMessage);
            }
            
        } catch (\Exception $e) {
            CLI::write("Error: " . $e->getMessage(), 'red');
            log_message('error', "Subscription expiration check failed: " . $e->getMessage());
            return;
        }
        
        CLI::write('');
        CLI::write("=============================", 'green');
        CLI::write('To set up automatic checks, add to crontab:', 'cyan');
        CLI::write('0 9 * * * /usr/bin/php /path/to/your/app/spark subscriptions:check-expiring', 'white');
        CLI::write('(Runs daily at 9:00 AM)', 'cyan');
    }

    /**
     * Run in dry-run mode to preview what would be processed.
     *
     * @param PlanExpirationNotificationService $service
     * @param int $days
     */
    private function runDryRun(PlanExpirationNotificationService $service, int $days): void
    {
        $model = new \App\Models\SchoolSubscriptionModel();
        $expiring = $model->findExpiringSubscriptions($days);
        
        if (empty($expiring)) {
            CLI::write("No subscriptions expiring within {$days} days found.", 'green');
            return;
        }
        
        CLI::write("Found " . count($expiring) . " subscriptions that would be notified:", 'yellow');
        
        foreach ($expiring as $sub) {
            $expiresAt = new \DateTime($sub['expires_at']);
            $now = new \DateTime();
            $daysRemaining = (int) $now->diff($expiresAt)->format('%r%a');
            $daysRemaining = abs($daysRemaining);
            
            CLI::write("  - Subscription {$sub['id']} (Tenant: {$sub['tenant_id']}) - expires in {$daysRemaining} days", 'cyan');
        }
    }
}

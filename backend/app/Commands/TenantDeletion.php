<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Services\TenantDeletionService;
use App\Services\TenantDeletionEmailService;

/**
 * Tenant Deletion Processing Command
 *
 * This command processes tenant account deletion requests:
 * 1. Sends reminder emails on Day 4 (3 days after request)
 * 2. Sends final reminder emails on Day 7 (6 days after request)
 * 3. Permanently deletes tenants whose 7-day grace period has expired
 *
 * It should be run daily via cron job to ensure timely processing.
 *
 * Usage:
 *   php spark tenants:process-deletion
 *   php spark tenants:process-deletion --dry-run
 */
class TenantDeletion extends BaseCommand
{
    /**
     * The Command's Group.
     *
     * @var string
     */
    protected $group = 'Tenants';

    /**
     * The Command's Name.
     *
     * @var string
     */
    protected $name = 'tenants:process-deletion';

    /**
     * The Command's Description.
     *
     * @var string
     */
    protected $description = 'Process tenant deletion requests and send reminder emails';

    /**
     * The Command's Usage.
     *
     * @var string
     */
    protected $usage = 'tenants:process-deletion [options]';

    /**
     * The Command's Options.
     *
     * @var array
     */
    protected $options = [
        '--dry-run' => 'Show what would be processed without actually deleting or sending emails',
    ];

    /**
     * @var TenantDeletionService
     */
    protected TenantDeletionService $deletionService;

    /**
     * @var TenantDeletionEmailService
     */
    protected TenantDeletionEmailService $emailService;

    /**
     * Actually execute a command.
     *
     * @param array $params
     */
    public function run(array $params)
    {
        $dryRun = CLI::getOption('dry-run') !== null;
        $startTime = microtime(true);

        CLI::write('Tenant Deletion Processing', 'green');
        CLI::write('===========================', 'green');
        CLI::write('Date: ' . date('Y-m-d H:i:s'), 'cyan');
        CLI::write('Dry run: ' . ($dryRun ? 'YES' : 'NO'), 'cyan');
        CLI::write('');

        $this->deletionService = new TenantDeletionService();
        $this->emailService = new TenantDeletionEmailService();

        // Track statistics
        $stats = [
            'day4Reminders' => 0,
            'day7Reminders' => 0,
            'tenantsDeleted' => 0,
            'totalRecordsRemoved' => 0,
            'errors' => [],
        ];

        try {
            // 1. Send Day 4 reminders (tenants that requested deletion 3 days ago)
            $this->sendDay4Reminders($stats, $dryRun);

            // 2. Send Day 7 final reminders (tenants that requested deletion 6 days ago)
            $this->sendDay7Reminders($stats, $dryRun);

            // 3. Process expired deletions (7+ days old)
            $this->processExpiredDeletions($stats, $dryRun);

        } catch (\Exception $e) {
            CLI::write('Error: ' . $e->getMessage(), 'red');
            log_message('error', 'Tenant deletion processing failed: ' . $e->getMessage());
        }

        $executionTime = round(microtime(true) - $startTime, 2);

        // Output summary
        CLI::write('');
        CLI::write('Reminder Emails Sent:', 'green');
        CLI::write("- Day 4 Reminders: {$stats['day4Reminders']} sent", 'cyan');
        CLI::write("- Day 7 Reminders: {$stats['day7Reminders']} sent", 'cyan');

        CLI::write('');
        CLI::write('Expired Deletions Processed:', 'green');

        if ($stats['tenantsDeleted'] === 0) {
            CLI::write('- No expired deletion requests found', 'cyan');
        } else {
            CLI::write("- {$stats['tenantsDeleted']} tenant(s) deleted", 'green');
            CLI::write("- {$stats['totalRecordsRemoved']} total records removed", 'cyan');
        }

        if (!empty($stats['errors'])) {
            CLI::write('');
            CLI::write('Errors encountered:', 'red');
            foreach ($stats['errors'] as $error) {
                CLI::write("  - {$error}", 'red');
            }
        }

        CLI::write('');
        CLI::write('Summary:', 'green');
        CLI::write("- Total tenants processed: {$stats['tenantsDeleted']}", 'cyan');
        CLI::write("- Total records removed: {$stats['totalRecordsRemoved']}", 'cyan');
        CLI::write("- Execution time: {$executionTime} seconds", 'cyan');

        CLI::write('');
        CLI::write('===========================', 'green');

        if (!$dryRun) {
            CLI::write('To set up automatic processing, add to crontab:', 'cyan');
            CLI::write('0 3 * * * cd /path/to/app && /usr/bin/php spark tenants:process-deletion', 'white');
            CLI::write('(Runs daily at 3:00 AM)', 'cyan');
        }

        // Log completion
        $logMessage = "Tenant deletion processing completed: {$stats['tenantsDeleted']} deleted, {$stats['day4Reminders']} day4, {$stats['day7Reminders']} day7";
        log_message('info', $logMessage);

        // Return error code if there were errors
        if (!empty($stats['errors'])) {
            return 1;
        }

        return 0;
    }

    /**
     * Send Day 4 reminder emails (deletion requested 3 days ago)
     *
     * @param array &$stats Statistics tracker
     * @param bool $dryRun Whether this is a dry run
     */
    private function sendDay4Reminders(array &$stats, bool $dryRun): void
    {
        $tenants = $this->deletionService->getDeletionsRequestedDaysAgo(3);

        if (empty($tenants)) {
            return;
        }

        CLI::write("Day 4 Reminders: Found " . count($tenants) . " tenant(s)", 'yellow');

        foreach ($tenants as $tenant) {
            $tenantName = $this->getTenantName($tenant);
            $remainingDays = 4;

            if ($dryRun) {
                CLI::write("  [DRY RUN] Would send Day 4 reminder to: {$tenantName}", 'cyan');
                $stats['day4Reminders']++;
                continue;
            }

            try {
                // Get admin email from tenant settings
                $settings = json_decode($tenant['settings'] ?? '{}', true);
                $adminEmail = $settings['contactEmail'] ?? $tenant['email'] ?? null;
                $adminName = $settings['adminName'] ?? 'Admin';

                if ($adminEmail) {
                    $this->emailService->sendDay4Reminder($adminEmail, $adminName, $tenantName, $remainingDays);
                    $stats['day4Reminders']++;
                    CLI::write("  Sent Day 4 reminder to: {$tenantName} ({$adminEmail})", 'green');
                } else {
                    CLI::write("  Warning: No admin email found for {$tenantName}", 'yellow');
                }
            } catch (\Exception $e) {
                $stats['errors'][] = "Day 4 reminder failed for {$tenantName}: " . $e->getMessage();
                CLI::write("  Error sending to {$tenantName}: " . $e->getMessage(), 'red');
            }
        }
    }

    /**
     * Send Day 7 final reminder emails (deletion requested 6 days ago)
     *
     * @param array &$stats Statistics tracker
     * @param bool $dryRun Whether this is a dry run
     */
    private function sendDay7Reminders(array &$stats, bool $dryRun): void
    {
        $tenants = $this->deletionService->getDeletionsRequestedDaysAgo(6);

        if (empty($tenants)) {
            return;
        }

        CLI::write("Day 7 Final Reminders: Found " . count($tenants) . " tenant(s)", 'yellow');

        foreach ($tenants as $tenant) {
            $tenantName = $this->getTenantName($tenant);
            $remainingDays = 1;

            if ($dryRun) {
                CLI::write("  [DRY RUN] Would send Day 7 reminder to: {$tenantName}", 'cyan');
                $stats['day7Reminders']++;
                continue;
            }

            try {
                // Get admin email from tenant settings
                $settings = json_decode($tenant['settings'] ?? '{}', true);
                $adminEmail = $settings['contactEmail'] ?? $tenant['email'] ?? null;
                $adminName = $settings['adminName'] ?? 'Admin';

                if ($adminEmail) {
                    $this->emailService->sendDay7Reminder($adminEmail, $adminName, $tenantName, $remainingDays);
                    $stats['day7Reminders']++;
                    CLI::write("  Sent Day 7 reminder to: {$tenantName} ({$adminEmail})", 'green');
                } else {
                    CLI::write("  Warning: No admin email found for {$tenantName}", 'yellow');
                }
            } catch (\Exception $e) {
                $stats['errors'][] = "Day 7 reminder failed for {$tenantName}: " . $e->getMessage();
                CLI::write("  Error sending to {$tenantName}: " . $e->getMessage(), 'red');
            }
        }
    }

    /**
     * Process expired deletion requests (7+ days old)
     *
     * @param array &$stats Statistics tracker
     * @param bool $dryRun Whether this is a dry run
     */
    private function processExpiredDeletions(array &$stats, bool $dryRun): void
    {
        $tenants = $this->deletionService->getExpiredDeletions();

        if (empty($tenants)) {
            return;
        }

        CLI::write("Expired Deletions: Found " . count($tenants) . " tenant(s)", 'yellow');

        foreach ($tenants as $tenant) {
            $tenantId = $tenant['id'];
            $tenantName = $this->getTenantName($tenant);

            if ($dryRun) {
                CLI::write("  [DRY RUN] Would delete: {$tenantName}", 'cyan');
                $stats['tenantsDeleted']++;
                continue;
            }

            try {
                CLI::write("  Deleting {$tenantName}...", 'cyan');

                $result = $this->deletionService->permanentlyDeleteTenant($tenantId);

                $stats['tenantsDeleted']++;
                $stats['totalRecordsRemoved'] += $result['totalRecords'];

                CLI::write("    - {$tenantName} DELETED", 'green');
                CLI::write("    - Users deleted: " . ($result['tablesDeleted']['users'] ?? 0), 'cyan');
                CLI::write("    - Students deleted: " . ($result['tablesDeleted']['students'] ?? 0), 'cyan');
                CLI::write("    - Classes deleted: " . ($result['tablesDeleted']['classes'] ?? 0), 'cyan');
                CLI::write("    - Records removed: {$result['totalRecords']} total", 'cyan');

                log_message('info', "Tenant {$tenantId} ({$tenantName}) permanently deleted. Records removed: {$result['totalRecords']}");

            } catch (\Exception $e) {
                $errorMsg = "Failed to delete {$tenantName}: " . $e->getMessage();
                $stats['errors'][] = $errorMsg;
                CLI::write("    - ERROR: " . $e->getMessage(), 'red');
                log_message('error', $errorMsg);

                // Continue processing other tenants even if one fails
                continue;
            }
        }
    }

    /**
     * Get tenant name from tenant data
     *
     * @param array $tenant Tenant data
     * @return string Tenant name
     */
    private function getTenantName(array $tenant): string
    {
        $settings = json_decode($tenant['settings'] ?? '{}', true);
        return $settings['schoolName'] ?? $tenant['name'] ?? 'Unknown School';
    }
}

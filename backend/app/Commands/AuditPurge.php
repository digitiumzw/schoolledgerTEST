<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Models\PlatformAudit;
use App\Models\SystemErrorLogModel;

/**
 * Audit & Error Log Purge Command
 *
 * Deletes platform_audit and system_error_logs records that are older than
 * the configured retention period (default: 365 days / 1 year) to prevent
 * unbounded storage growth from historical data.
 *
 * Usage:
 *   php spark audit:purge
 *   php spark audit:purge --days 180      (custom retention, e.g. 6 months)
 *   php spark audit:purge --dry-run       (preview count without deleting)
 *
 * Recommended cron schedule (once daily, off-peak hours):
 *   @cron: 0 2 * * * cd /path/to/app && php spark audit:purge >> /var/log/audit-purge.log 2>&1
 */
class AuditPurge extends BaseCommand
{
    protected $group       = 'Audit';
    protected $name        = 'audit:purge';
    protected $description = 'Delete platform audit logs and system error logs older than the configured retention period (default: 365 days)';
    protected $usage       = 'audit:purge [--days <n>] [--dry-run]';
    protected $options     = [
        '--days'    => 'Retention period in days (default: 365)',
        '--dry-run' => 'Preview the number of records that would be deleted without making changes',
    ];

    public function run(array $params): void
    {
        $dryRun        = CLI::getOption('dry-run') !== null;
        $retentionDays = (int) (CLI::getOption('days') ?? 365);

        if ($retentionDays < 1) {
            CLI::error('--days must be a positive integer.');
            return;
        }

        $cutoff = date('Y-m-d H:i:s', strtotime("-{$retentionDays} days"));

        CLI::write('Platform Audit & Error Log Purge', 'green');
        CLI::write('================================', 'green');
        CLI::write("Retention : {$retentionDays} days", 'cyan');
        CLI::write("Cutoff    : {$cutoff}", 'cyan');

        if ($dryRun) {
            CLI::write('[DRY RUN — no records will be deleted]', 'yellow');
        }

        $auditModel = new PlatformAudit();
        $errorModel = new SystemErrorLogModel();

        $auditEligible = (int) $auditModel->where('created_at <', $cutoff)->countAllResults();
        $errorEligible = (int) $errorModel->where('created_at <', $cutoff)->countAllResults();
        $totalEligible = $auditEligible + $errorEligible;

        CLI::write("Audit logs eligible : {$auditEligible} record(s)", 'white');
        CLI::write("Error logs eligible : {$errorEligible} record(s)", 'white');

        if ($totalEligible === 0) {
            CLI::write('Nothing to purge.', 'green');
            return;
        }

        if ($dryRun) {
            CLI::write("Dry run complete. {$totalEligible} record(s) would be deleted.", 'yellow');
            return;
        }

        $auditDeleted = $auditModel->purgeOldLogs($retentionDays);
        $errorDeleted = $errorModel->purgeOldLogs($retentionDays);

        CLI::write("Audit logs deleted  : {$auditDeleted} record(s).", 'green');
        CLI::write("Error logs deleted  : {$errorDeleted} record(s).", 'green');
        CLI::write('Purge complete.', 'green');
    }
}

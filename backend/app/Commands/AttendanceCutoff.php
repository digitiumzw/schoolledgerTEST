<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Services\AttendanceCutoffService;

/**
 * Attendance Cutoff Command
 *
 * Processes all tenants and marks eligible staff as ABSENT once the
 * staffWorkHours.endTime cutoff has passed. The feature is always-on;
 * no per-tenant opt-in is required.
 *
 * Processing logic per tenant:
 * 1. Skip if today is a weekend or configured holiday
 * 2. Skip if the current time has not yet reached staffWorkHours.endTime
 * 3. Skip if no staff member has checked in yet (prevents premature mass-absence)
 * 4. Skip if already processed today (idempotency)
 * 5. Mark all unchecked, non-leave staff as ABSENT with source='system'
 *
 * Usage:
 *   php spark attendance:cutoff
 *   php spark attendance:cutoff --tenant <tenant_id>   (single tenant)
 *   php spark attendance:cutoff --dry-run              (preview only)
 *
 * Recommended cron schedule (every 15 min, 9 AM - 5 PM, weekdays):
 *   @cron: *\/15 9-17 * * 1-5 cd /path/to/app && php spark attendance:cutoff
 */
class AttendanceCutoff extends BaseCommand
{
    protected $group       = 'Attendance';
    protected $name        = 'attendance:cutoff';
    protected $description = 'Automatically mark unchecked staff as absent after each tenant\'s staffWorkHours.endTime';
    protected $usage       = 'attendance:cutoff [--tenant <id>] [--dry-run]';
    protected $options     = [
        '--tenant'  => 'Process only the specified tenant ID',
        '--dry-run' => 'Preview what would be processed without making changes',
    ];

    public function run(array $params): void
    {
        $tenantFilter = CLI::getOption('tenant');
        $dryRun       = CLI::getOption('dry-run') !== null;

        CLI::write('Attendance Cutoff Processor', 'green');
        CLI::write('===========================', 'green');
        if ($dryRun) {
            CLI::write('[DRY RUN — no changes will be made]', 'yellow');
        }
        CLI::write('Started at: ' . date('Y-m-d H:i:s'), 'cyan');
        CLI::write('');

        $service = new AttendanceCutoffService();

        // Resolve list of tenants to process
        if ($tenantFilter) {
            $tenantIds = [$tenantFilter];
        } else {
            $tenantIds = $service->getEnabledTenantIds();
        }

        if (empty($tenantIds)) {
            CLI::write('No tenants found. Exiting.', 'yellow');
            log_message('info', '[AttendanceCutoff] No tenants found.');
            return;
        }

        $totalMarked   = 0;
        $totalSkipped  = 0;

        foreach ($tenantIds as $tenantId) {
            CLI::write("Processing tenant: {$tenantId}", 'white');

            $settings   = $service->getCutoffSettings($tenantId);
            $cutoffTime = $settings['cutoffTime'];
            $now        = new \DateTime();

            $today = $now->format('Y-m-d');

            if ($service->isWorkingDay($now) && $service->isHoliday($tenantId, $now)) {
                if ($service->isAlreadyProcessedToday($tenantId, $today)) {
                    CLI::write("  SKIP — holiday attendance already processed today", 'yellow');
                    log_message('info', "[AttendanceCutoff][{$tenantId}] Skipped: holiday attendance already processed");
                    $totalSkipped++;
                    continue;
                }

                $unchecked = $service->getUncheckedStaff($tenantId, $today);

                if (empty($unchecked)) {
                    CLI::write("  OK — holiday; all active staff already have attendance records", 'green');
                    log_message('info', "[AttendanceCutoff][{$tenantId}] Holiday: no unchecked staff found");
                    continue;
                }

                CLI::write("  Holiday — found " . count($unchecked) . " staff without check-in records: " . implode(', ', $unchecked), 'cyan');

                if ($dryRun) {
                    CLI::write("  DRY RUN — would mark " . count($unchecked) . " staff as excused", 'yellow');
                    log_message('info', "[AttendanceCutoff][{$tenantId}] DRY RUN: would mark " . count($unchecked) . " excused for holiday. IDs: " . implode(', ', $unchecked));
                    continue;
                }

                $marked = $service->markAsExcused($tenantId, $unchecked, $today);
                $totalMarked += $marked;

                CLI::write("  Marked {$marked} staff as excused for holiday", 'green');
                log_message('info', "[AttendanceCutoff][{$tenantId}] Marked {$marked} excused for holiday. IDs: " . implode(', ', $unchecked));
                continue;
            }

            if (!$service->isWorkingDay($now)) {
                $reason = 'today is a non-working day (' . $now->format('l') . ')';
                CLI::write("  SKIP — {$reason}", 'yellow');
                log_message('info', "[AttendanceCutoff][{$tenantId}] Skipped: {$reason}");
                $totalSkipped++;
                continue;
            }

            // Check if cutoff time has been reached
            $cutoffDt = \DateTime::createFromFormat('H:i', $cutoffTime);
            if ($cutoffDt === false) {
                CLI::write("  SKIP — invalid cutoff time configured: {$cutoffTime}", 'red');
                log_message('error', "[AttendanceCutoff][{$tenantId}] Invalid cutoff time: {$cutoffTime}");
                $totalSkipped++;
                continue;
            }
            // Set cutoff date to today for accurate comparison
            $cutoffDt->setDate((int) $now->format('Y'), (int) $now->format('m'), (int) $now->format('d'));

            if ($now < $cutoffDt) {
                CLI::write("  SKIP — current time " . $now->format('H:i') . " is before cutoff {$cutoffTime}", 'yellow');
                log_message('info', "[AttendanceCutoff][{$tenantId}] Skipped: before cutoff time {$cutoffTime}");
                $totalSkipped++;
                continue;
            }

            // Check for at least one check-in today
            if (!$service->hasAnyCheckInToday($tenantId)) {
                CLI::write("  SKIP — no staff have checked in yet today", 'yellow');
                log_message('info', "[AttendanceCutoff][{$tenantId}] Skipped: no check-ins yet");
                $totalSkipped++;
                continue;
            }

            // Idempotency check
            if ($service->isAlreadyProcessedToday($tenantId)) {
                CLI::write("  SKIP — already processed today (idempotency guard)", 'yellow');
                log_message('info', "[AttendanceCutoff][{$tenantId}] Skipped: already processed today");
                $totalSkipped++;
                continue;
            }

            // Get unchecked staff
            $unchecked = $service->getUncheckedStaff($tenantId);

            if (empty($unchecked)) {
                CLI::write("  OK — all staff already have attendance records", 'green');
                log_message('info', "[AttendanceCutoff][{$tenantId}] No unchecked staff found");
                continue;
            }

            CLI::write("  Found " . count($unchecked) . " unchecked staff: " . implode(', ', $unchecked), 'cyan');

            if ($dryRun) {
                CLI::write("  DRY RUN — would mark " . count($unchecked) . " staff as absent", 'yellow');
                log_message('info', "[AttendanceCutoff][{$tenantId}] DRY RUN: would mark " . count($unchecked) . " absent. IDs: " . implode(', ', $unchecked));
                continue;
            }

            $marked = $service->markAsAbsent($tenantId, $unchecked, $cutoffTime);
            $totalMarked += $marked;

            CLI::write("  Marked {$marked} staff as absent", 'green');
            log_message('info', "[AttendanceCutoff][{$tenantId}] Marked {$marked} absent at {$cutoffTime}. IDs: " . implode(', ', $unchecked));
        }

        CLI::write('');
        CLI::write('===========================', 'green');
        CLI::write("Completed at: " . date('Y-m-d H:i:s'), 'cyan');
        CLI::write("Total marked absent: {$totalMarked}", 'green');
        CLI::write("Total tenants skipped: {$totalSkipped}", 'yellow');

        log_message('info', "[AttendanceCutoff] Run complete. Marked: {$totalMarked}, Skipped: {$totalSkipped}");
    }
}

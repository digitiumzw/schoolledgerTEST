<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Services\QRCodeService;

/**
 * Refresh QR Codes Command
 * 
 * This command refreshes QR codes for staff members whose codes are expiring soon.
 * It should be run daily via cron job to ensure QR codes remain valid.
 * 
 * Usage:
 *   php spark refresh:qr-codes
 *   php spark refresh:qr-codes --days 30
 */
class RefreshQRCodes extends BaseCommand
{
    /**
     * The Command's Group.
     *
     * @var string
     */
    protected $group = 'Maintenance';

    /**
     * The Command's Name.
     *
     * @var string
     */
    protected $name = 'refresh:qr-codes';

    /**
     * The Command's Description.
     *
     * @var string
     */
    protected $description = 'Refresh expiring QR codes for staff members';

    /**
     * The Command's Usage.
     *
     * @var string
     */
    protected $usage = 'refresh:qr-codes [options]';

    /**
     * The Command's Options.
     *
     * @var array
     */
    protected $options = [
        '--days' => 'Number of days before expiration to refresh (default: 30)',
        '--tenant' => 'Specific tenant ID to process (default: all tenants)',
        '--dry-run' => 'Show what would be refreshed without actually doing it',
    ];

    /**
     * Actually execute a command.
     *
     * @param array $params
     */
    public function run(array $params)
    {
        $days = $params['days'] ?? CLI::getOption('days') ?? 30;
        $tenantId = CLI::getOption('tenant');
        $dryRun = CLI::getOption('dry-run') !== null;

        CLI::write('QR Code Refresh Task', 'green');
        CLI::write("==================", 'green');
        CLI::write("Days threshold: {$days}", 'cyan');
        CLI::write("Dry run: " . ($dryRun ? 'YES' : 'NO'), 'cyan');
        
        if ($tenantId) {
            CLI::write("Tenant ID: {$tenantId}", 'cyan');
        }
        
        CLI::write('');

        try {
            $qrService = new QRCodeService();
            $db = \Config\Database::connect();
            
            // Get tenants to process
            $tenantsQuery = $db->table('tenants');
            if ($tenantId) {
                $tenantsQuery->where('id', $tenantId);
            }
            $tenants = $tenantsQuery->get()->getResultArray();
            
            $totalRefreshed = 0;
            
            foreach ($tenants as $tenant) {
                CLI::write("Processing tenant: {$tenant['name']} (ID: {$tenant['id']})", 'yellow');
                
                // Check if tenant has QR secret configured
                $settings = json_decode($tenant['settings'] ?? '{}', true) ?? [];
                if (!isset($settings['qrCodeSecret'])) {
                    CLI::write("  - Skipping: QR secret not configured", 'red');
                    continue;
                }
                
                // Count staff with expiring QR codes
                $expiringCount = $db->table('staff')
                    ->where('tenant_id', $tenant['id'])
                    ->where('qr_code_expires <', date('Y-m-d H:i:s', strtotime("+{$days} days")))
                    ->where('qr_code_expires >', date('Y-m-d H:i:s'))
                    ->countAllResults();
                
                if ($expiringCount === 0) {
                    CLI::write("  - No QR codes expiring within {$days} days", 'green');
                    continue;
                }
                
                CLI::write("  - Found {$expiringCount} QR codes to refresh", 'yellow');
                
                if (!$dryRun) {
                    // Refresh the QR codes
                    $refreshed = $qrService->refreshAllTenantQRCodes($tenant['id']);
                    $totalRefreshed += $refreshed;
                    CLI::write("  - Refreshed {$refreshed} QR codes", 'green');
                } else {
                    $totalRefreshed += $expiringCount;
                    CLI::write("  - Would refresh {$expiringCount} QR codes (dry run)", 'yellow');
                }
            }
            
            CLI::write('');
            CLI::write("==================", 'green');
            
            if ($dryRun) {
                CLI::write("DRY RUN: Would refresh {$totalRefreshed} QR codes", 'yellow');
            } else {
                CLI::write("Successfully refreshed {$totalRefreshed} QR codes", 'green');
            }
            
            // Log the completion
            $logMessage = "QR Code refresh completed: {$totalRefreshed} codes refreshed" . 
                          ($dryRun ? ' (dry run)' : '');
            log_message('info', $logMessage);
            
        } catch (\Exception $e) {
            CLI::write("Error: " . $e->getMessage(), 'red');
            log_message('error', "QR Code refresh failed: " . $e->getMessage());
            return;
        }
        
        CLI::write('');
        CLI::write('To set up automatic refresh, add to crontab:', 'cyan');
        CLI::write('0 2 * * * /usr/bin/php /path/to/your/app/spark refresh:qr-codes', 'white');
    }
}

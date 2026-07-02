<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\Config;

/**
 * Removes the vestigial `defaultCurrency` key from all tenants.settings JSON blobs.
 *
 * Feature 094 superseded defaultCurrency with the proper baseCurrency + enabledCurrencies
 * architecture managed via /api/currencies. This migration cleans up orphaned JSON keys.
 */
class RemoveDefaultCurrencyFromSettings extends Migration
{
    public function up()
    {
        $db = Config::connect();
        $tenants = $db->table('tenants')->select('id, settings')->get()->getResultArray();

        foreach ($tenants as $tenant) {
            if (empty($tenant['settings'])) {
                continue;
            }

            $settings = json_decode($tenant['settings'], true);
            if (!is_array($settings) || !array_key_exists('defaultCurrency', $settings)) {
                continue;
            }

            unset($settings['defaultCurrency']);

            $db->table('tenants')
                ->where('id', $tenant['id'])
                ->update([
                    'settings'   => json_encode($settings),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
        }
    }

    public function down()
    {
        // No-op: defaultCurrency is no longer used by the application.
        // Re-adding the orphaned key would serve no purpose.
    }
}

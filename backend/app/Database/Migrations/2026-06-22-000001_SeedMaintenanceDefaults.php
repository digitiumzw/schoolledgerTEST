<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class SeedMaintenanceDefaults extends Migration
{
    public function up(): void
    {
        $defaults = [
            [
                'key'         => 'maintenance_mode',
                'value'       => 'false',
                'type'        => 'boolean',
                'description' => 'Whether maintenance mode is enabled (platform-wide)',
            ],
            [
                'key'         => 'maintenance_headline',
                'value'       => '"Platform Under Maintenance"',
                'type'        => 'string',
                'description' => 'Custom headline for the maintenance notice',
            ],
            [
                'key'         => 'maintenance_message',
                'value'       => '"The platform is currently under maintenance. Service will be restored shortly."',
                'type'        => 'string',
                'description' => 'Custom message body for the maintenance notice',
            ],
        ];

        foreach ($defaults as $setting) {
            $existing = $this->db->table('platform_settings')
                ->where('key', $setting['key'])
                ->get()
                ->getRow();

            if (!$existing) {
                $this->db->table('platform_settings')->insert(array_merge($setting, [
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]));
            }
        }
    }

    public function down(): void
    {
        $this->db->table('platform_settings')
            ->whereIn('key', ['maintenance_mode', 'maintenance_headline', 'maintenance_message'])
            ->delete();
    }
}

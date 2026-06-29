<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddStatusAndRecoveryToPlatformUsers extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('platform_users', [
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['Active', 'Invited', 'Deactivated'],
                'null'       => false,
                'default'    => 'Active',
                'after'      => 'platform_role',
            ],
            'two_factor_recovery_hash' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'default'    => null,
                'after'      => 'two_factor_secret',
            ],
        ]);
    }

    public function down(): void
    {
        $this->forge->dropColumn('platform_users', ['status', 'two_factor_recovery_hash']);
    }
}

<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddScopeToPasswordResetTokens extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('password_reset_tokens', [
            'scope' => [
                'type'       => 'VARCHAR',
                'constraint' => 16,
                'default'    => 'tenant',
                'after'      => 'email',
            ],
        ]);

        // Backfill: any existing rows are tenant resets
        $this->db->table('password_reset_tokens')
            ->where('scope IS NULL', null, false)
            ->update(['scope' => 'tenant']);
    }

    public function down(): void
    {
        $this->forge->dropColumn('password_reset_tokens', 'scope');
    }
}

<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add credential lifecycle flags to the users table.
 *
 *  - is_temp_password   : 1 when the user was provisioned with a system-generated
 *                         temporary password and has not yet logged in. Cleared
 *                         to 0 on first successful login (regardless of whether
 *                         the user changes their password during onboarding).
 *  - onboarding_complete: 1 once the school admin has finished the onboarding
 *                         wizard and the tenant is activated. Used as the
 *                         dashboard access guard.
 *
 * Feature: 043-school-creation-onboarding
 */
class AddCredentialFlagsToUsers extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('users', [
            'is_temp_password' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
                'after'      => 'password',
            ],
            'onboarding_complete' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
                'after'      => 'is_temp_password',
            ],
        ]);

        // Backfill: existing users have already completed onboarding implicitly,
        // since this feature did not previously exist. Mark them complete so
        // they are not redirected to the onboarding wizard on next login.
        $this->db->query("UPDATE `users` SET `onboarding_complete` = 1");
    }

    public function down(): void
    {
        $this->forge->dropColumn('users', ['is_temp_password', 'onboarding_complete']);
    }
}

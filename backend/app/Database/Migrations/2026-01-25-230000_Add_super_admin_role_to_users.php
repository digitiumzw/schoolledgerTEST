<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Migration to add super_admin role to users table
 * 
 * Super Admin has:
 * - Full access to EVERYTHING including User Accounts
 * - Protected from deactivation and deletion
 * - Exclusive access to User Accounts management
 */
class AddSuperAdminRoleToUsers extends Migration
{
    public function up()
    {
        // Modify the role column to include 'super_admin' option
        // Note: super_admin is added first as it's the highest privilege level
        $this->forge->modifyColumn('users', [
            'role' => [
                'type' => "ENUM('super_admin','admin','teacher','bursar')",
                'null' => false,
                'default' => 'teacher',
            ],
        ]);
    }

    public function down()
    {
        // Revert back to previous enum (note: this will fail if any users have super_admin role)
        $this->forge->modifyColumn('users', [
            'role' => [
                'type' => "ENUM('admin','teacher','bursar')",
                'null' => false,
                'default' => 'teacher',
            ],
        ]);
    }
}

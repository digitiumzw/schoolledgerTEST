<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add 'pending' to tenants.status ENUM.
 *
 * Provisioned schools start in 'pending' state until their admin completes the
 * onboarding wizard, at which point they transition to 'trialing'.
 *
 * Feature: 043-school-creation-onboarding
 */
class AddPendingStatusToTenants extends Migration
{
    public function up(): void
    {
        $this->db->query(
            "ALTER TABLE `tenants` "
            . "MODIFY COLUMN `status` ENUM('active','suspended','trialing','pending') "
            . "NOT NULL DEFAULT 'active'"
        );
    }

    public function down(): void
    {
        // Move any 'pending' tenants to 'suspended' before narrowing the ENUM
        // so existing rows do not violate the constraint.
        $this->db->query("UPDATE `tenants` SET `status` = 'suspended' WHERE `status` = 'pending'");

        $this->db->query(
            "ALTER TABLE `tenants` "
            . "MODIFY COLUMN `status` ENUM('active','suspended','trialing') "
            . "NOT NULL DEFAULT 'active'"
        );
    }
}

<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddInvitedStatusToUsers extends Migration
{
    public function up(): void
    {
        // Add 'invited' to the users.status ENUM and make password nullable
        // so invited users can exist before setting a password.
        $this->db->query(
            "ALTER TABLE users MODIFY COLUMN status ENUM('active','inactive','invited') NOT NULL DEFAULT 'active'"
        );

        $this->db->query(
            "ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL DEFAULT NULL"
        );
    }

    public function down(): void
    {
        // Reactivate invited users to 'inactive' before shrinking the enum
        $this->db->query(
            "UPDATE users SET status = 'inactive' WHERE status = 'invited'"
        );

        $this->db->query(
            "ALTER TABLE users MODIFY COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active'"
        );

        // Restore NOT NULL on password — backfill empty strings for any rows with NULL first
        $this->db->query("UPDATE users SET password = '' WHERE password IS NULL");
        $this->db->query(
            "ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL"
        );
    }
}

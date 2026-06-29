<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddHrRoleToUsers extends Migration
{
    public function up()
    {
        $this->db->query(
            "ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','admin','teacher','bursar','driver','hr') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'teacher'"
        );
    }

    public function down()
    {
        $this->db->query(
            "ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','admin','teacher','bursar','driver') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'teacher'"
        );
    }
}

<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddArchivedAtToClasses extends Migration
{
    public function up()
    {
        $this->forge->addColumn('classes', [
            'archived_at' => [
                'type' => 'DATETIME',
                'null' => true,
                'after' => 'updated_at'
            ]
        ]);

        // Add index for better performance
        $this->db->query('ALTER TABLE classes ADD INDEX idx_archived_at (archived_at)');
    }

    public function down()
    {
        $this->forge->dropColumn('classes', 'archived_at');
    }
}

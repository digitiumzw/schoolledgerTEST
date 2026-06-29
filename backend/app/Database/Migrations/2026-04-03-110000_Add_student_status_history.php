<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddStudentStatusHistory extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'student_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'previous_status' => [
                'type'       => 'ENUM',
                'constraint' => ['active', 'inactive', 'transferred', 'dropped_out', 'graduated'],
                'null'       => true,
                'default'    => null,
                'comment'    => 'NULL for the initial enrollment entry',
            ],
            'new_status' => [
                'type'       => 'ENUM',
                'constraint' => ['active', 'inactive', 'transferred', 'dropped_out', 'graduated'],
                'null'       => false,
            ],
            'effective_date' => [
                'type' => 'DATE',
                'null' => false,
            ],
            'reason' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'changed_by_user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'student_id']);
        $this->forge->addKey(['student_id', 'created_at']);

        $this->forge->createTable('student_status_history');

        // FK: cascade delete when student is removed
        $this->db->query("
            ALTER TABLE student_status_history
            ADD CONSTRAINT fk_ssh_student
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE
        ");
    }

    public function down(): void
    {
        $this->db->query("ALTER TABLE student_status_history DROP FOREIGN KEY fk_ssh_student");
        $this->forge->dropTable('student_status_history');
    }
}

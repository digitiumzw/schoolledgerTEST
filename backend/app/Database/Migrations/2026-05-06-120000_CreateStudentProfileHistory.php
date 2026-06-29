<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateStudentProfileHistory extends Migration
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
            'field_name' => [
                'type'       => 'VARCHAR',
                'constraint' => 80,
                'null'       => false,
            ],
            'previous_value' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'new_value' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'change_type' => [
                'type'       => 'ENUM',
                'constraint' => ['correction', 'historical_change'],
                'null'       => false,
            ],
            'effective_date' => [
                'type' => 'DATE',
                'null' => false,
            ],
            'reason' => [
                'type' => 'TEXT',
                'null' => false,
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
        $this->forge->addKey(['tenant_id', 'student_id', 'field_name']);
        $this->forge->addKey(['student_id', 'effective_date']);
        $this->forge->createTable('student_profile_history');

        $this->db->query(
            'ALTER TABLE student_profile_history
             ADD CONSTRAINT fk_sph_student
             FOREIGN KEY (student_id) REFERENCES students(id)
             ON DELETE CASCADE ON UPDATE CASCADE'
        );
    }

    public function down(): void
    {
        if ($this->db->tableExists('student_profile_history')) {
            $this->db->query('ALTER TABLE student_profile_history DROP FOREIGN KEY fk_sph_student');
            $this->forge->dropTable('student_profile_history');
        }
    }
}

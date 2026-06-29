<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateStudentAttendanceEvents extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => false,
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
            'class_instance_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
                'comment'    => 'FK to class_instances.id — binds event to class × academic year',
            ],
            'class_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
                'comment'    => 'Denormalised from class_instances.class_id for filter queries',
            ],
            'academic_session' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => false,
                'comment'    => 'Denormalised from class_instances.academic_year e.g. 2025/2026',
            ],
            'date' => [
                'type' => 'DATE',
                'null' => false,
            ],
            'period_key' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'comment'    => 'NULL = per-day mode; "P1"/"P2" etc = per-period mode',
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['present', 'absent', 'late', 'excused', 'half_day'],
                'null'       => false,
            ],
            'is_effective' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 1,
                'comment'    => '1 = current effective record; 0 = superseded by later correction',
            ],
            'submitted_by' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
                'comment'    => 'users.id from JWT — never supplied by client',
            ],
            'submitted_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'remarks' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'class_instance_id', 'date'], false, false, 'idx_sae_tenant_instance_date');
        $this->forge->addKey(['tenant_id', 'student_id', 'date'], false, false, 'idx_sae_tenant_student_date');
        $this->forge->addKey(['tenant_id', 'student_id', 'class_instance_id'], false, false, 'idx_sae_tenant_student_instance');
        $this->forge->addKey(['tenant_id', 'class_instance_id', 'date', 'is_effective'], false, false, 'idx_sae_effective');

        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE', 'fk_sae_tenant');
        $this->forge->addForeignKey('student_id', 'students', 'id', 'CASCADE', 'CASCADE', 'fk_sae_student');
        $this->forge->addForeignKey('class_instance_id', 'class_instances', 'id', 'CASCADE', 'CASCADE', 'fk_sae_class_instance');

        $this->forge->createTable('student_attendance_events');
    }

    public function down(): void
    {
        $this->forge->dropTable('student_attendance_events', true);
    }
}

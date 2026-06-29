<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CompleteDatabaseSchema extends Migration
{
    public function up()
    {
        // Tenants Table
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'name' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
            ],
            'charge_generation_history' => [
                'type' => 'JSON',
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('tenants');

        // Users Table
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'role' => [
                'type' => 'ENUM',
                'constraint' => ['admin', 'teacher', 'bursar'],
                'default' => 'teacher',
            ],
            'email' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
            ],
            'password' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
            ],
            'name' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['active', 'inactive'],
                'default' => 'active',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->addUniqueKey('email');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('users');

        // Classes Table
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'name' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'teacher_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'capacity' => [
                'type' => 'INT',
                'default' => 30,
            ],
            'next_class_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
                'comment' => 'Next class in promotion sequence'
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('next_class_id', 'classes', 'id', 'SET NULL', 'CASCADE');
        $this->forge->createTable('classes');

        // Staff Table
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'first_name' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'last_name' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'email' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
            ],
            'phone' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'position' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'department' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'is_teaching' => [
                'type' => 'BOOLEAN',
                'default' => false,
            ],
            'hire_date' => [
                'type' => 'DATE',
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['active', 'inactive', 'on_leave'],
                'default' => 'active',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('staff');

        // Students Table
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'first_name' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'last_name' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
            ],
            'class_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'current_enrollment_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
                'comment' => 'Reference to current enrollment record'
            ],
            'date_of_birth' => [
                'type' => 'DATE',
                'null' => true,
            ],
            'email' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'address' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'guardian_name' => [
                'type' => 'VARCHAR',
                'constraint' => 200,
            ],
            'guardian_phone' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'guardian_email' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'guardian_relationship' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'enrollment_date' => [
                'type' => 'DATE',
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['active', 'inactive', 'transferred', 'dropped_out', 'graduated'],
                'default' => 'active',
            ],
            'bursary_status' => [
                'type' => 'ENUM',
                'constraint' => ['full', 'partial', 'none'],
                'default' => 'none',
            ],
            'bursary_percentage' => [
                'type' => 'INT',
                'default' => 0,
            ],
            'bursary_reason' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->addKey('class_id');
        $this->forge->addKey('status');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('class_id', 'classes', 'id', 'CASCADE', 'SET NULL');
        $this->forge->createTable('students');

        // Enrollments Table - Tracks student class placements per academic session
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 36,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'student_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'class_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'academic_session' => [
                'type' => 'VARCHAR',
                'constraint' => 20,
                'comment' => 'e.g., 2024/2025'
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['PROMOTED', 'REPEATED', 'GRADUATED', 'ACTIVE', 'TRANSFERRED', 'DROPPED_OUT', 'INACTIVE'],
                'default' => 'ACTIVE',
                'comment' => 'Status of this enrollment record'
            ],
            'enrollment_date' => [
                'type' => 'DATE',
                'null' => false,
            ],
            'completion_date' => [
                'type' => 'DATE',
                'null' => true,
                'comment' => 'When this enrollment was completed (promotion/repetition/graduation)'
            ],
            'remarks' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'student_id']);
        $this->forge->addKey(['tenant_id', 'class_id']);
        $this->forge->addKey(['student_id', 'academic_session']);
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('student_id', 'students', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('class_id', 'classes', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('enrollments');

        // Payments table
        $this->forge->addField([
            'id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'student_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'amount' => ['type' => 'DECIMAL', 'constraint' => '10,2'],
            'date' => ['type' => 'DATE'],
            'method' => ['type' => 'VARCHAR', 'constraint' => 50],
            'description' => ['type' => 'TEXT', 'null' => true],
            'category' => ['type' => 'VARCHAR', 'constraint' => 50],
            'is_fee_structure' => [
                'type' => 'TINYINT',
                'constraint' => 1,
                'null' => true,
                'default' => null,
                'comment' => '1 for fee structure payments, NULL for other payments (transport, etc.)'
            ],
            'route_id' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'student_id']);
        $this->forge->createTable('payments');

        // Charges table
        $this->forge->addField([
            'id' => ['type' => 'VARCHAR', 'constraint' => 100],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'student_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'category' => ['type' => 'VARCHAR', 'constraint' => 100],
            'amount' => ['type' => 'DECIMAL', 'constraint' => '10,2'],
            'date_generated' => ['type' => 'DATE'],
            'description' => ['type' => 'TEXT', 'null' => true],
            'generation_batch_id' => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'created_by' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'is_fee_structure' => [
                'type' => 'TINYINT',
                'constraint' => 1,
                'null' => true,
                'default' => null,
                'comment' => '1 for fee structure charges, NULL for other charges'
            ],
            'is_transport' => [
                'type' => 'BOOLEAN',
                'default' => false
            ],
            'route_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true
            ],
            'deleted_at' => ['type' => 'DATETIME', 'null' => true],
            'deletion_reason' => ['type' => 'TEXT', 'null' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'student_id']);
        $this->forge->createTable('charges');

        // Student Attendance table
        $this->forge->addField([
            'id' => ['type' => 'VARCHAR', 'constraint' => 100],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'student_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'class_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'date' => ['type' => 'DATE'],
            'status' => ['type' => 'ENUM', 'constraint' => ['present', 'absent', 'late', 'excused'], 'default' => 'present'],
            'remarks' => ['type' => 'TEXT', 'null' => true],
            'recorded_by' => ['type' => 'VARCHAR', 'constraint' => 50],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['student_id', 'date']);
        $this->forge->addKey(['class_id', 'date']);
        $this->forge->createTable('student_attendance');

        // Transport Routes table
        $this->forge->addField([
            'id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'route_name' => ['type' => 'VARCHAR', 'constraint' => 200],
            'vehicle' => ['type' => 'VARCHAR', 'constraint' => 100],
            'driver_name' => ['type' => 'VARCHAR', 'constraint' => 100],
            'driver_phone' => ['type' => 'VARCHAR', 'constraint' => 50],
            'capacity' => ['type' => 'INT'],
            'fee' => ['type' => 'DECIMAL', 'constraint' => '10,2'],
            'status' => ['type' => 'ENUM', 'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->createTable('transport_routes');

        // Transport Assignments table
        $this->forge->addField([
            'id' => ['type' => 'VARCHAR', 'constraint' => 100],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'student_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'route_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'month' => ['type' => 'VARCHAR', 'constraint' => 10],
            'payment_id' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'access' => ['type' => 'BOOLEAN', 'default' => false],
            'assigned_date' => ['type' => 'DATE', 'null' => true],
            'end_date' => [
                'type' => 'DATE',
                'null' => true
            ],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['student_id', 'month']);
        $this->forge->addKey(['route_id', 'month']);
        $this->forge->createTable('transport_assignments');

        // Settings table
        $this->forge->addField([
            'id' => ['type' => 'INT', 'auto_increment' => true],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'school_name' => ['type' => 'VARCHAR', 'constraint' => 255],
            'contact_email' => ['type' => 'VARCHAR', 'constraint' => 255],
            'contact_phone' => ['type' => 'VARCHAR', 'constraint' => 50],
            'address' => ['type' => 'TEXT'],
            'default_currency' => ['type' => 'VARCHAR', 'constraint' => 10, 'default' => 'USD'],
            'timezone' => ['type' => 'VARCHAR', 'constraint' => 50, 'default' => 'Africa/Harare'],
            'academic_year' => ['type' => 'VARCHAR', 'constraint' => 10],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('tenant_id');
        $this->forge->createTable('settings');

        // Fee Structures table
        $this->forge->addField([
            'id' => ['type' => 'INT', 'auto_increment' => true],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'default_fees' => ['type' => 'JSON'],
            'class_overrides' => ['type' => 'JSON', 'null' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('tenant_id');
        $this->forge->createTable('fee_structures');

        // Payment Categories table
        $this->forge->addField([
            'id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'name' => ['type' => 'VARCHAR', 'constraint' => 100],
            'default_amount' => ['type' => 'DECIMAL', 'constraint' => '10,2', 'null' => true],
            'active' => ['type' => 'BOOLEAN', 'default' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->createTable('payment_categories');

        // Academic Calendars table
        $this->forge->addField([
            'id' => ['type' => 'INT', 'auto_increment' => true],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'terms' => ['type' => 'JSON'],
            'school_open' => ['type' => 'BOOLEAN', 'default' => true],
            'disable_attendance_when_closed' => ['type' => 'BOOLEAN', 'default' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('tenant_id');
        $this->forge->createTable('academic_calendars');


        // Add foreign key for current_enrollment_id in students
        $this->db->query("ALTER TABLE students ADD CONSTRAINT fk_students_current_enrollment FOREIGN KEY (current_enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL ON UPDATE CASCADE");

        // Add foreign key constraints with ON DELETE CASCADE for student-related tables
        $this->db->query("ALTER TABLE payments ADD CONSTRAINT payments_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE");
        $this->db->query("ALTER TABLE charges ADD CONSTRAINT charges_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE");
        $this->db->query("ALTER TABLE student_attendance ADD CONSTRAINT student_attendance_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE");
        $this->db->query("ALTER TABLE transport_assignments ADD CONSTRAINT transport_assignments_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE");
    }

    public function down()
    {
        // Drop foreign key constraints first
        try { $this->db->query("ALTER TABLE students DROP FOREIGN KEY fk_students_current_enrollment"); } catch (\Throwable $e) {}
        try { $this->db->query("ALTER TABLE payments DROP FOREIGN KEY payments_student_fk"); } catch (\Throwable $e) {}
        try { $this->db->query("ALTER TABLE charges DROP FOREIGN KEY charges_student_fk"); } catch (\Throwable $e) {}
        try { $this->db->query("ALTER TABLE student_attendance DROP FOREIGN KEY student_attendance_student_fk"); } catch (\Throwable $e) {}
        try { $this->db->query("ALTER TABLE transport_assignments DROP FOREIGN KEY transport_assignments_student_fk"); } catch (\Throwable $e) {}
        try { $this->db->query("ALTER TABLE classes DROP FOREIGN KEY classes_next_class_fk"); } catch (\Throwable $e) {}

        // Drop all tables
        $this->forge->dropTable('academic_calendars', true);
        $this->forge->dropTable('payment_categories', true);
        $this->forge->dropTable('fee_structures', true);
        $this->forge->dropTable('settings', true);
        $this->forge->dropTable('transport_assignments', true);
        $this->forge->dropTable('transport_routes', true);
        $this->forge->dropTable('student_attendance', true);
        $this->forge->dropTable('charges', true);
        $this->forge->dropTable('payments', true);
        $this->forge->dropTable('enrollments', true);
        $this->forge->dropTable('students', true);
        $this->forge->dropTable('staff', true);
        $this->forge->dropTable('classes', true);
        $this->forge->dropTable('users', true);
        $this->forge->dropTable('tenants', true);
    }
}

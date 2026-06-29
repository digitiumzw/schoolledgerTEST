<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddStudentStandardFields extends Migration
{
    public function up(): void
    {
        // Add admission_number (required for standard SMS compliance)
        $this->db->query("ALTER TABLE students ADD COLUMN admission_number VARCHAR(50) NOT NULL DEFAULT '' AFTER last_name");

        // Add gender
        $this->db->query("ALTER TABLE students ADD COLUMN gender ENUM('male','female','other') NULL AFTER admission_number");

        // Add national_id / birth certificate number
        $this->db->query("ALTER TABLE students ADD COLUMN national_id VARCHAR(100) NULL AFTER gender");

        // Add photo_url
        $this->db->query("ALTER TABLE students ADD COLUMN photo_url VARCHAR(500) NULL AFTER address");

        // Add second guardian fields
        $this->db->query("ALTER TABLE students ADD COLUMN guardian2_name VARCHAR(200) NULL AFTER guardian_relationship");
        $this->db->query("ALTER TABLE students ADD COLUMN guardian2_phone VARCHAR(50) NULL AFTER guardian2_name");
        $this->db->query("ALTER TABLE students ADD COLUMN guardian2_relationship VARCHAR(50) NULL AFTER guardian2_phone");

        // Enforce per-school uniqueness of admission number.
        // Note: existing rows all have DEFAULT '' so we backfill them first to avoid
        // the unique constraint failing on duplicate empty strings.
        $this->db->query("
            UPDATE students s
            JOIN (
                SELECT id, tenant_id,
                       CONCAT(YEAR(enrollment_date), '/', LPAD(ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY enrollment_date, id), 3, '0')) AS gen_num
                FROM students
                WHERE admission_number = ''
            ) backfill ON s.id = backfill.id
            SET s.admission_number = backfill.gen_num
        ");

        // Add unique index after backfill so no duplicates exist.
        $this->forge->addUniqueKey(['tenant_id', 'admission_number'], 'ux_students_tenant_admission');
        $this->db->query("ALTER TABLE students ADD UNIQUE INDEX ux_students_tenant_admission (tenant_id, admission_number)");

        // Index for gender-based filtering
        $this->db->query("ALTER TABLE students ADD INDEX idx_students_gender (gender)");
    }

    public function down(): void
    {
        $this->db->query("ALTER TABLE students DROP INDEX ux_students_tenant_admission");
        $this->db->query("ALTER TABLE students DROP INDEX idx_students_gender");
        $this->db->query("ALTER TABLE students DROP COLUMN guardian2_relationship");
        $this->db->query("ALTER TABLE students DROP COLUMN guardian2_phone");
        $this->db->query("ALTER TABLE students DROP COLUMN guardian2_name");
        $this->db->query("ALTER TABLE students DROP COLUMN photo_url");
        $this->db->query("ALTER TABLE students DROP COLUMN national_id");
        $this->db->query("ALTER TABLE students DROP COLUMN gender");
        $this->db->query("ALTER TABLE students DROP COLUMN admission_number");
    }
}

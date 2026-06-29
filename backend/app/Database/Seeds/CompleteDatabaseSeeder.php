<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

/**
 * CompleteDatabaseSeeder
 *
 * Creates a fully populated, realistic dataset for Greenwood Academy.
 *
 * Includes:
 *  - 1 tenant with complete settings, fee structure, payment categories, and academic calendar
 *  - 4 users (super_admin, admin, bursar, teacher)
 *  - 8 staff members (mix of teaching and administrative)
 *  - 5 classes (Grade 7A → Grade 11A promotion chain)
 *  - 20 students distributed across classes with varied financial statuses
 *  - Enrollments, charges, payments, transport, attendance, and leave data
 *
 * Default login credentials:
 *   superadmin@greenwood.co.zw / 1234
 *   admin@greenwood.co.zw      / 1234
 *   bursar@greenwood.edu       / 1234
 *   teacher@greenwood.edu      / 1234
 */
class CompleteDatabaseSeeder extends Seeder
{
    public function run()
    {
        // Disable foreign key checks for clean truncation
        $this->db->query('SET FOREIGN_KEY_CHECKS=0');

        // Clear all tables (child tables first)
        foreach ([
            'reconciliation_audit_log', 'ledger_adjustments', 'refunds',
            'transport_student_allocations', 'student_attendance', 'staff_attendance',
            'leave_requests', 'payments', 'charges', 'billing_runs',
            'enrollments', 'students', 'classes', 'transport_routes',
            'staff', 'users', 'tenants',
        ] as $table) {
            if ($this->db->tableExists($table)) {
                $this->db->table($table)->truncate();
            }
        }

        $now            = date('Y-m-d H:i:s');
        $today          = date('Y-m-d');
        $currentYear    = (int) date('Y');
        $prevYear       = $currentYear - 1;
        $academicSession = "{$prevYear}/{$currentYear}";
        $termId         = "T1_{$currentYear}";
        $billingRunId   = "billing_t1_{$currentYear}";
        $dueDate        = date('Y-m-d', mktime(0, 0, 0, 2, 10, $currentYear));

        // ─────────────────────────────────────────────────────────
        // 1. TENANT
        // ─────────────────────────────────────────────────────────
        $this->db->table('tenants')->insert([
            'id'                       => 'tenant_001',
            'charge_generation_history' => json_encode([]),
            'settings'                 => json_encode([
                'schoolName'     => 'Greenwood Academy',
                'contactEmail'   => 'info@greenwood.edu',
                'contactPhone'   => '+263 712 345 678',
                'address'        => '123 Education Drive, Harare, Zimbabwe',
                'defaultCurrency' => 'USD',
                'academicYear'   => (string) $currentYear,
                'staffWorkHours' => ['startTime' => '08:00', 'endTime' => '17:00'],
                'studentWorkHours' => ['startTime' => '08:00', 'endTime' => '15:30'],
            ]),
            'fee_structure'            => json_encode([
                'structureType'  => 'termly',
                'termsPerYear'   => 3,
                'academicYear'   => (string) $currentYear,
                'defaultFees'    => [
                    'Tuition'          => 250,
                    'Development Levy' => 50,
                    'Sports Fee'       => 30,
                    'Computer Levy'    => 25,
                ],
                'classOverrides' => [
                    'class_005' => ['Tuition' => 300],
                ],
            ]),
            'payment_categories'       => json_encode([
                ['id' => 'cat_tuition',   'name' => 'Tuition',           'defaultAmount' => 250.00, 'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
                ['id' => 'cat_devlevy',   'name' => 'Development Levy',  'defaultAmount' => 50.00,  'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
                ['id' => 'cat_sports',    'name' => 'Sports Fee',        'defaultAmount' => 30.00,  'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
                ['id' => 'cat_computer',  'name' => 'Computer Levy',     'defaultAmount' => 25.00,  'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
                ['id' => 'cat_transport', 'name' => 'Transport Fee',     'defaultAmount' => null,   'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
            ]),
            'academic_calendar'        => json_encode([
                'terms' => [
                    ['id' => "T1_{$currentYear}", 'name' => 'Term 1', 'start' => "{$currentYear}-01-10", 'end' => "{$currentYear}-04-05", 'displayLabel' => "Term 1 {$currentYear}"],
                    ['id' => "T2_{$currentYear}", 'name' => 'Term 2', 'start' => "{$currentYear}-05-01", 'end' => "{$currentYear}-07-25", 'displayLabel' => "Term 2 {$currentYear}"],
                    ['id' => "T3_{$currentYear}", 'name' => 'Term 3', 'start' => "{$currentYear}-08-10", 'end' => "{$currentYear}-11-20", 'displayLabel' => "Term 3 {$currentYear}"],
                ],
                'schoolOpen'                   => true,
                'disableAttendanceWhenClosed'  => true,
            ]),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        // ─────────────────────────────────────────────────────────
        // 2. USERS
        // ─────────────────────────────────────────────────────────
        $this->db->table('users')->insertBatch([
            ['id' => 'user_000', 'tenant_id' => 'tenant_001', 'role' => 'super_admin', 'email' => 'superadmin@greenwood.co.zw', 'password' => password_hash('1234', PASSWORD_DEFAULT), 'name' => 'System Administrator', 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'user_001', 'tenant_id' => 'tenant_001', 'role' => 'admin',       'email' => 'admin@greenwood.co.zw',      'password' => password_hash('1234', PASSWORD_DEFAULT), 'name' => 'Alice Johnson',         'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'user_002', 'tenant_id' => 'tenant_001', 'role' => 'bursar',      'email' => 'bursar@greenwood.edu',       'password' => password_hash('1234', PASSWORD_DEFAULT), 'name' => 'Sarah Williams',        'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'user_003', 'tenant_id' => 'tenant_001', 'role' => 'teacher',     'email' => 'teacher@greenwood.edu',      'password' => password_hash('1234', PASSWORD_DEFAULT), 'name' => 'Michael Smith',         'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ─────────────────────────────────────────────────────────
        // 3. STAFF
        // ─────────────────────────────────────────────────────────
        $this->db->table('staff')->insertBatch([
            [
                'id' => 'staff_001', 'tenant_id' => 'tenant_001',
                'first_name' => 'Michael', 'last_name' => 'Smith',
                'email' => 'm.smith@greenwood.edu', 'phone' => '+263771234567',
                'date_of_birth' => '1985-06-15', 'address' => '45 Avondale Road, Harare',
                'position' => 'Mathematics Teacher', 'department' => 'Academic',
                'is_teaching' => true, 'hire_date' => '2020-01-15',
                'employment_status' => 'active', 'employee_id' => 'EMP001',
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 'staff_002', 'tenant_id' => 'tenant_001',
                'first_name' => 'Jennifer', 'last_name' => 'Wilson',
                'email' => 'j.wilson@greenwood.edu', 'phone' => '+263771234568',
                'date_of_birth' => '1987-09-22', 'address' => '23 Samora Machel Ave, Harare',
                'position' => 'Science Teacher', 'department' => 'Academic',
                'is_teaching' => true, 'hire_date' => '2019-08-20',
                'employment_status' => 'active', 'employee_id' => 'EMP002',
                
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 'staff_003', 'tenant_id' => 'tenant_001',
                'first_name' => 'Robert', 'last_name' => 'Mubarak',
                'email' => 'r.mubarak@greenwood.edu', 'phone' => '+263771234569',
                'date_of_birth' => '1982-03-10', 'address' => '78 Borrowdale Road, Harare',
                'position' => 'English Teacher', 'department' => 'Academic',
                'is_teaching' => true, 'hire_date' => '2018-02-01',
                'employment_status' => 'active', 'employee_id' => 'EMP003',
                
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 'staff_004', 'tenant_id' => 'tenant_001',
                'first_name' => 'Tendai', 'last_name' => 'Moyo',
                'email' => 't.moyo@greenwood.edu', 'phone' => '+263771234570',
                'date_of_birth' => '1990-11-25', 'address' => '12 Msasa Park, Harare',
                'position' => 'History Teacher', 'department' => 'Academic',
                'is_teaching' => true, 'hire_date' => '2021-01-10',
                'employment_status' => 'active', 'employee_id' => 'EMP004',
                
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 'staff_005', 'tenant_id' => 'tenant_001',
                'first_name' => 'Grace', 'last_name' => 'Ndlovu',
                'email' => 'g.ndlovu@greenwood.edu', 'phone' => '+263771234571',
                'date_of_birth' => '1979-07-04', 'address' => '56 Glen Lorne, Harare',
                'position' => 'Deputy Head', 'department' => 'Administration',
                'is_teaching' => false, 'hire_date' => '2015-03-01',
                'employment_status' => 'active', 'employee_id' => 'EMP005',
                
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 'staff_006', 'tenant_id' => 'tenant_001',
                'first_name' => 'Patrick', 'last_name' => 'Chirwa',
                'email' => 'p.chirwa@greenwood.edu', 'phone' => '+263771234572',
                'date_of_birth' => '1988-05-18', 'address' => '34 Hatfield, Harare',
                'position' => 'ICT Teacher', 'department' => 'Academic',
                'is_teaching' => true, 'hire_date' => '2022-01-10',
                'employment_status' => 'active', 'employee_id' => 'EMP006',
                
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 'staff_007', 'tenant_id' => 'tenant_001',
                'first_name' => 'Sonia', 'last_name' => 'Dube',
                'email' => 's.dube@greenwood.edu', 'phone' => '+263771234573',
                'date_of_birth' => '1993-02-28', 'address' => '90 Westgate, Harare',
                'position' => 'Accounts Clerk', 'department' => 'Finance',
                'is_teaching' => false, 'hire_date' => '2023-03-01',
                'employment_status' => 'active', 'employee_id' => 'EMP007',
                
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 'staff_008', 'tenant_id' => 'tenant_001',
                'first_name' => 'Herbert', 'last_name' => 'Makoni',
                'email' => 'h.makoni@greenwood.edu', 'phone' => '+263771234574',
                'date_of_birth' => '1975-08-12', 'address' => '22 Kuwadzana, Harare',
                'position' => 'Security Officer', 'department' => 'Operations',
                'is_teaching' => false, 'hire_date' => '2010-06-01',
                'employment_status' => 'active', 'employee_id' => 'EMP008',
                
                'created_at' => $now, 'updated_at' => $now,
            ],
        ]);

        // ─────────────────────────────────────────────────────────
        // 3b. GRADE LEVELS
        // ─────────────────────────────────────────────────────────
        $this->db->table('grade_levels')->insertBatch([
            ['id' => 'gl_001', 'tenant_id' => 'tenant_001', 'name' => 'Grade 7',  'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'gl_002', 'tenant_id' => 'tenant_001', 'name' => 'Grade 8',  'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'gl_003', 'tenant_id' => 'tenant_001', 'name' => 'Grade 9',  'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'gl_004', 'tenant_id' => 'tenant_001', 'name' => 'Grade 10', 'sort_order' => 4, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'gl_005', 'tenant_id' => 'tenant_001', 'name' => 'Grade 11', 'sort_order' => 5, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ─────────────────────────────────────────────────────────
        // 4. CLASSES (Phase 1: without next_class_id)
        // ─────────────────────────────────────────────────────────
        $this->db->table('classes')->insertBatch([
            ['id' => 'class_001', 'tenant_id' => 'tenant_001', 'name' => '7A',  'grade_level_id' => 'gl_001', 'stream' => 'A', 'teacher_id' => 'staff_001', 'capacity' => 35, 'next_class_id' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'class_002', 'tenant_id' => 'tenant_001', 'name' => '8A',  'grade_level_id' => 'gl_002', 'stream' => 'A', 'teacher_id' => 'staff_002', 'capacity' => 35, 'next_class_id' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'class_003', 'tenant_id' => 'tenant_001', 'name' => '9A',  'grade_level_id' => 'gl_003', 'stream' => 'A', 'teacher_id' => 'staff_003', 'capacity' => 35, 'next_class_id' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'class_004', 'tenant_id' => 'tenant_001', 'name' => '10A', 'grade_level_id' => 'gl_004', 'stream' => 'A', 'teacher_id' => 'staff_004', 'capacity' => 30, 'next_class_id' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'class_005', 'tenant_id' => 'tenant_001', 'name' => '11A', 'grade_level_id' => 'gl_005', 'stream' => 'A', 'teacher_id' => 'staff_006', 'capacity' => 30, 'next_class_id' => null, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // Phase 2: Set promotion chain
        $this->db->query("UPDATE classes SET next_class_id = 'class_002' WHERE id = 'class_001'");
        $this->db->query("UPDATE classes SET next_class_id = 'class_003' WHERE id = 'class_002'");
        $this->db->query("UPDATE classes SET next_class_id = 'class_004' WHERE id = 'class_003'");
        $this->db->query("UPDATE classes SET next_class_id = 'class_005' WHERE id = 'class_004'");
        // class_005 has no next_class_id and is explicitly marked as the final/graduation class
        $this->db->query("UPDATE classes SET is_final_class = 1 WHERE id = 'class_005'");

        // ─────────────────────────────────────────────────────────
        // 5. TRANSPORT ROUTES
        // ─────────────────────────────────────────────────────────
        $this->db->table('transport_routes')->insertBatch([
            ['id' => 'route_001', 'tenant_id' => 'tenant_001', 'route_name' => 'Route A – City Centre', 'pickup_points' => '["Main Gate","City Square","Avenues Clinic","Samora Machel Ave"]', 'vehicle' => 'Bus GA-001', 'driver_name' => 'John Moyo',  'driver_phone' => '+263771234600', 'driver_user_id' => null, 'monthly_fee' => 50.00, 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'route_002', 'tenant_id' => 'tenant_001', 'route_name' => 'Route B – Borrowdale',  'pickup_points' => '["School Gate","Borrowdale Brooke","Borrowdale Village","Sam Levy\'s Village"]', 'vehicle' => 'Bus GA-002', 'driver_name' => 'Peter Ncube', 'driver_phone' => '+263771234601', 'driver_user_id' => null, 'monthly_fee' => 60.00, 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ─────────────────────────────────────────────────────────
        // 6. STUDENTS (20 students across 5 classes)
        // ─────────────────────────────────────────────────────────
        $students = [
            // Grade 7A (class_001) – 5 students
            ['id' => 'student_001', 'class_id' => 'class_001', 'first_name' => 'John',     'last_name' => 'Doe',       'dob' => '2012-03-15', 'guardian' => 'Jane Doe',      'gphone' => '+263771234800', 'gemail' => 'jane.doe@gmail.com',      'grel' => 'Mother',  'bursary' => 'none',    'bpct' => 0,   'date' => '2024-01-15'],
            ['id' => 'student_002', 'class_id' => 'class_001', 'first_name' => 'Jane',     'last_name' => 'Smith',     'dob' => '2012-07-22', 'guardian' => 'Peter Smith',   'gphone' => '+263771234801', 'gemail' => 'peter.smith@gmail.com',   'grel' => 'Father',  'bursary' => 'full',    'bpct' => 100, 'date' => '2024-01-15'],
            ['id' => 'student_003', 'class_id' => 'class_001', 'first_name' => 'Tinashe',  'last_name' => 'Mutasa',    'dob' => '2012-11-05', 'guardian' => 'Rudo Mutasa',   'gphone' => '+263771234802', 'gemail' => 'rudo.mutasa@gmail.com',   'grel' => 'Mother',  'bursary' => 'partial', 'bpct' => 50,  'date' => '2024-01-15'],
            ['id' => 'student_004', 'class_id' => 'class_001', 'first_name' => 'Chiedza',  'last_name' => 'Nyamande',  'dob' => '2012-04-18', 'guardian' => 'Felix Nyamande','gphone' => '+263771234803', 'gemail' => 'felix.n@gmail.com',       'grel' => 'Father',  'bursary' => 'none',    'bpct' => 0,   'date' => '2024-01-15'],
            ['id' => 'student_005', 'class_id' => 'class_001', 'first_name' => 'Rumbidzai','last_name' => 'Chikura',   'dob' => '2012-09-30', 'guardian' => 'Grace Chikura', 'gphone' => '+263771234804', 'gemail' => 'grace.c@gmail.com',       'grel' => 'Mother',  'bursary' => 'none',    'bpct' => 0,   'date' => '2024-01-15'],
            // Grade 8A (class_002) – 4 students
            ['id' => 'student_006', 'class_id' => 'class_002', 'first_name' => 'Michael',  'last_name' => 'Johnson',   'dob' => '2011-11-05', 'guardian' => 'Sarah Johnson', 'gphone' => '+263771234805', 'gemail' => 'sarah.j@gmail.com',       'grel' => 'Mother',  'bursary' => 'partial', 'bpct' => 30,  'date' => '2023-01-10'],
            ['id' => 'student_007', 'class_id' => 'class_002', 'first_name' => 'Blessing',  'last_name' => 'Mwangi',   'dob' => '2011-05-14', 'guardian' => 'James Mwangi',  'gphone' => '+263771234806', 'gemail' => 'james.m@gmail.com',       'grel' => 'Father',  'bursary' => 'none',    'bpct' => 0,   'date' => '2023-01-10'],
            ['id' => 'student_008', 'class_id' => 'class_002', 'first_name' => 'Tafadzwa', 'last_name' => 'Mhlanga',   'dob' => '2011-08-22', 'guardian' => 'Annah Mhlanga', 'gphone' => '+263771234807', 'gemail' => 'annah.m@gmail.com',       'grel' => 'Mother',  'bursary' => 'none',    'bpct' => 0,   'date' => '2023-01-10'],
            ['id' => 'student_009', 'class_id' => 'class_002', 'first_name' => 'Sandra',   'last_name' => 'Chimombe',  'dob' => '2011-01-17', 'guardian' => 'Thomas Chimombe','gphone' => '+263771234808', 'gemail' => 'thomas.c@gmail.com',     'grel' => 'Father',  'bursary' => 'full',    'bpct' => 100, 'date' => '2023-01-10'],
            // Grade 9A (class_003) – 4 students
            ['id' => 'student_010', 'class_id' => 'class_003', 'first_name' => 'Kudakwashe','last_name' => 'Sithole',  'dob' => '2010-06-25', 'guardian' => 'Beauty Sithole','gphone' => '+263771234809', 'gemail' => 'beauty.s@gmail.com',      'grel' => 'Mother',  'bursary' => 'none',    'bpct' => 0,   'date' => '2022-01-10'],
            ['id' => 'student_011', 'class_id' => 'class_003', 'first_name' => 'Farai',    'last_name' => 'Ncube',    'dob' => '2010-02-08', 'guardian' => 'Lungile Ncube', 'gphone' => '+263771234810', 'gemail' => 'lungile.n@gmail.com',     'grel' => 'Father',  'bursary' => 'none',    'bpct' => 0,   'date' => '2022-01-10'],
            ['id' => 'student_012', 'class_id' => 'class_003', 'first_name' => 'Simba',    'last_name' => 'Gumbo',    'dob' => '2010-10-13', 'guardian' => 'Tendai Gumbo',  'gphone' => '+263771234811', 'gemail' => 'tendai.g@gmail.com',      'grel' => 'Father',  'bursary' => 'partial', 'bpct' => 25,  'date' => '2022-01-10'],
            ['id' => 'student_013', 'class_id' => 'class_003', 'first_name' => 'Mavis',    'last_name' => 'Banda',    'dob' => '2010-07-19', 'guardian' => 'Victor Banda',  'gphone' => '+263771234812', 'gemail' => 'victor.b@gmail.com',      'grel' => 'Father',  'bursary' => 'none',    'bpct' => 0,   'date' => '2022-01-10'],
            // Grade 10A (class_004) – 4 students
            ['id' => 'student_014', 'class_id' => 'class_004', 'first_name' => 'Trevor',   'last_name' => 'Zimba',    'dob' => '2009-04-01', 'guardian' => 'Mercy Zimba',   'gphone' => '+263771234813', 'gemail' => 'mercy.z@gmail.com',       'grel' => 'Mother',  'bursary' => 'none',    'bpct' => 0,   'date' => '2021-01-10'],
            ['id' => 'student_015', 'class_id' => 'class_004', 'first_name' => 'Natasha',  'last_name' => 'Phiri',    'dob' => '2009-12-30', 'guardian' => 'Joseph Phiri',  'gphone' => '+263771234814', 'gemail' => 'joseph.p@gmail.com',      'grel' => 'Father',  'bursary' => 'none',    'bpct' => 0,   'date' => '2021-01-10'],
            ['id' => 'student_016', 'class_id' => 'class_004', 'first_name' => 'Dennis',   'last_name' => 'Mpofu',    'dob' => '2009-09-07', 'guardian' => 'Anna Mpofu',    'gphone' => '+263771234815', 'gemail' => 'anna.m@gmail.com',        'grel' => 'Mother',  'bursary' => 'full',    'bpct' => 100, 'date' => '2021-01-10'],
            ['id' => 'student_017', 'class_id' => 'class_004', 'first_name' => 'Lesley',   'last_name' => 'Musara',   'dob' => '2009-03-22', 'guardian' => 'David Musara',  'gphone' => '+263771234816', 'gemail' => 'david.mu@gmail.com',      'grel' => 'Father',  'bursary' => 'none',    'bpct' => 0,   'date' => '2021-01-10'],
            // Grade 11A (class_005) – 3 students
            ['id' => 'student_018', 'class_id' => 'class_005', 'first_name' => 'Primrose',  'last_name' => 'Dube',    'dob' => '2008-08-15', 'guardian' => 'Nothabo Dube',  'gphone' => '+263771234817', 'gemail' => 'nothabo.d@gmail.com',     'grel' => 'Mother',  'bursary' => 'none',    'bpct' => 0,   'date' => '2020-01-10'],
            ['id' => 'student_019', 'class_id' => 'class_005', 'first_name' => 'Takudzwa', 'last_name' => 'Chirinda', 'dob' => '2008-05-20', 'guardian' => 'Philip Chirinda','gphone' => '+263771234818', 'gemail' => 'philip.c@gmail.com',     'grel' => 'Father',  'bursary' => 'partial', 'bpct' => 50,  'date' => '2020-01-10'],
            ['id' => 'student_020', 'class_id' => 'class_005', 'first_name' => 'Patricia', 'last_name' => 'Mashava',  'dob' => '2008-11-11', 'guardian' => 'Joan Mashava',  'gphone' => '+263771234819', 'gemail' => 'joan.ma@gmail.com',       'grel' => 'Mother',  'bursary' => 'none',    'bpct' => 0,   'date' => '2020-01-10'],
        ];

        $bursaryReasonMap = [
            'full'    => 'Full financial hardship bursary',
            'partial' => 'Academic excellence partial bursary',
            'none'    => null,
        ];

        $studentRows = [];
        foreach ($students as $s) {
            $studentRows[] = [
                'id' => $s['id'], 'tenant_id' => 'tenant_001',
                'first_name' => $s['first_name'], 'last_name' => $s['last_name'],
                'class_id' => $s['class_id'], 'current_enrollment_id' => null,
                'date_of_birth' => $s['dob'], 'email' => null, 'address' => '123 Harare',
                'guardian_name' => $s['guardian'], 'guardian_phone' => $s['gphone'],
                'guardian_email' => $s['gemail'], 'guardian_relationship' => $s['grel'],
                'enrollment_date' => $s['date'], 'status' => 'active',
                'bursary_status' => $s['bursary'], 'bursary_percentage' => $s['bpct'],
                'bursary_reason' => $bursaryReasonMap[$s['bursary']],
                'created_at' => $now, 'updated_at' => $now,
            ];
        }
        $this->db->table('students')->insertBatch($studentRows);

        // ─────────────────────────────────────────────────────────
        // 7. ENROLLMENTS
        // ─────────────────────────────────────────────────────────
        $enrollmentRows = [];
        foreach ($students as $s) {
            $eid = "enrol_{$s['id']}";
            $enrollmentRows[] = [
                'id' => $eid, 'tenant_id' => 'tenant_001',
                'student_id' => $s['id'], 'class_id' => $s['class_id'],
                'academic_session' => $academicSession,
                'status' => 'ACTIVE',
                'enrollment_date' => $s['date'], 'completion_date' => null, 'remarks' => null,
                'created_at' => $now, 'updated_at' => $now,
            ];
        }
        $this->db->table('enrollments')->insertBatch($enrollmentRows);

        // Link enrollment IDs back to students
        foreach ($students as $s) {
            $this->db->query(
                "UPDATE students SET current_enrollment_id = 'enrol_{$s['id']}' WHERE id = '{$s['id']}'"
            );
        }

        // ─────────────────────────────────────────────────────────
        // 8. BILLING RUN
        // ─────────────────────────────────────────────────────────
        $this->db->table('billing_runs')->insert([
            'id'                 => $billingRunId,
            'tenant_id'          => 'tenant_001',
            'term_id'            => $termId,
            'academic_year'      => (string) $currentYear,
            'status'             => 'completed',
            'total_students'     => 17,  // 20 minus the 3 with 100% bursary
            'excluded_students'  => 3,
            'total_amount'       => 5950.00,
            'fee_breakdown'      => json_encode([
                ['className' => 'Grade 7A',  'feeName' => 'Tuition',          'count' => 3, 'amount' => 250, 'total' => 750],
                ['className' => 'Grade 7A',  'feeName' => 'Development Levy', 'count' => 3, 'amount' => 50,  'total' => 150],
                ['className' => 'Grade 11A', 'feeName' => 'Tuition',          'count' => 2, 'amount' => 300, 'total' => 600],
            ]),
            'confirmation_notes' => "Term 1 {$currentYear} billing completed",
            'confirmed_by'       => 'user_001',
            'confirmed_at'       => $now,
            'voided_by'          => null,
            'voided_at'          => null,
            'void_reason'        => null,
            'created_at'         => $now,
            'updated_at'         => $now,
        ]);

        // ─────────────────────────────────────────────────────────
        // 9. CHARGES (Term 1 for all non-100%-bursary students)
        // ─────────────────────────────────────────────────────────
        // Fee definitions per class
        $defaultFees = [
            'Tuition'          => 250,
            'Development Levy' => 50,
            'Sports Fee'       => 30,
            'Computer Levy'    => 25,
        ];
        $class005Fees = ['Tuition' => 300] + $defaultFees;

        $chargeRows = [];
        $chargeIdx  = 1;
        $termDate   = "{$currentYear}-01-10";

        foreach ($students as $s) {
            $multiplier = 1 - ($s['bpct'] / 100);
            if ($multiplier <= 0) continue; // 100% bursary — no charge

            $fees = ($s['class_id'] === 'class_005') ? $class005Fees : $defaultFees;

            foreach ($fees as $feeName => $feeBase) {
                $amount = round($feeBase * $multiplier, 2);
                if ($amount <= 0) continue;

                $chargeRows[] = [
                    'id'                  => sprintf('charge_%03d', $chargeIdx++),
                    'tenant_id'           => 'tenant_001',
                    'student_id'          => $s['id'],
                    'term_id'             => $termId,
                    'billing_run_id'      => $billingRunId,
                    'academic_year'       => (string) $currentYear,
                    'category'            => $feeName,
                    'charge_type'         => 'fee_structure',
                    'status'              => 'pending',
                    'amount'              => $amount,
                    'date_generated'      => $termDate,
                    'due_date'            => $dueDate,
                    'academic_session'    => $academicSession,
                    'term'                => 'Term 1',
                    'description'         => "{$feeName} – Term 1 {$currentYear}",
                    'generation_batch_id' => $billingRunId,
                    'created_by'          => 'user_001',
                    'route_id'            => null,
                    'deleted_at'          => null,
                    'deletion_reason'     => null,
                    'voided_at'           => null,
                    'voided_by'           => null,
                    'created_at'          => $now,
                    'updated_at'          => $now,
                ];
            }
        }

        // Transport charges for students using route_001
        $transportStudents = ['student_001', 'student_006', 'student_010', 'student_014', 'student_018'];
        foreach ($transportStudents as $sid) {
            $chargeRows[] = [
                'id'                  => sprintf('charge_%03d', $chargeIdx++),
                'tenant_id'           => 'tenant_001',
                'student_id'          => $sid,
                'term_id'             => null,
                'billing_run_id'      => null,
                'academic_year'       => (string) $currentYear,
                'category'            => 'Transport Fee',
                'charge_type'         => 'transport',
                'status'              => 'pending',
                'amount'              => 50.00,
                'date_generated'      => $termDate,
                'due_date'            => "{$currentYear}-01-31",
                'academic_session'    => $academicSession,
                'term'                => "{$currentYear}-01",
                'description'         => "Transport fee – January {$currentYear}",
                'generation_batch_id' => null,
                'created_by'          => 'user_001',
                'route_id'            => 'route_001',
                'deleted_at'          => null,
                'deletion_reason'     => null,
                'voided_at'           => null,
                'voided_by'           => null,
                'created_at'          => $now,
                'updated_at'          => $now,
            ];
        }

        // Insert in batches of 50
        foreach (array_chunk($chargeRows, 50) as $batch) {
            $this->db->table('charges')->insertBatch($batch);
        }

        // ─────────────────────────────────────────────────────────
        // 10. PAYMENTS (partial and full payments for several students)
        // ─────────────────────────────────────────────────────────
        $this->db->table('payments')->insertBatch([
            // student_001: paid Tuition + Dev Levy fully, Transport partially
            ['id' => 'pay_001', 'student_id' => 'student_001', 'tenant_id' => 'tenant_001', 'amount' => 250.00, 'date' => "{$currentYear}-01-20", 'method' => 'Cash',          'description' => 'Tuition Term 1',             'category' => 'Tuition',          'route_id' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'pay_002', 'student_id' => 'student_001', 'tenant_id' => 'tenant_001', 'amount' => 50.00,  'date' => "{$currentYear}-01-22", 'method' => 'EcoCash',       'description' => 'Development Levy Term 1',    'category' => 'Development Levy', 'route_id' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 'pay_003', 'student_id' => 'student_001', 'tenant_id' => 'tenant_001', 'amount' => 25.00,  'date' => "{$currentYear}-01-25", 'method' => 'Cash',          'description' => 'Transport partial Jan',      'category' => 'Transport Fee',    'route_id' => 'route_001', 'created_at' => $now, 'updated_at' => $now],
            // student_004: paid all fees
            ['id' => 'pay_004', 'student_id' => 'student_004', 'tenant_id' => 'tenant_001', 'amount' => 355.00, 'date' => "{$currentYear}-01-18", 'method' => 'Bank Transfer', 'description' => 'Full Term 1 payment',        'category' => 'Tuition',          'route_id' => null, 'created_at' => $now, 'updated_at' => $now],
            // student_005: partial
            ['id' => 'pay_005', 'student_id' => 'student_005', 'tenant_id' => 'tenant_001', 'amount' => 100.00, 'date' => "{$currentYear}-01-28", 'method' => 'EcoCash',       'description' => 'Partial tuition payment',    'category' => 'Tuition',          'route_id' => null, 'created_at' => $now, 'updated_at' => $now],
            // student_006: partial bursary – paid remainder
            ['id' => 'pay_006', 'student_id' => 'student_006', 'tenant_id' => 'tenant_001', 'amount' => 175.00, 'date' => "{$currentYear}-01-21", 'method' => 'Cash',          'description' => 'Tuition Term 1 (70%)',       'category' => 'Tuition',          'route_id' => null, 'created_at' => $now, 'updated_at' => $now],
            // student_010: paid all
            ['id' => 'pay_007', 'student_id' => 'student_010', 'tenant_id' => 'tenant_001', 'amount' => 355.00, 'date' => "{$currentYear}-01-15", 'method' => 'ZIPIT',         'description' => 'Full Term 1 payment',        'category' => 'Tuition',          'route_id' => null, 'created_at' => $now, 'updated_at' => $now],
            // student_018: paid full (Grade 11 tuition = 300)
            ['id' => 'pay_008', 'student_id' => 'student_018', 'tenant_id' => 'tenant_001', 'amount' => 405.00, 'date' => "{$currentYear}-01-12", 'method' => 'Bank Transfer', 'description' => 'Full Term 1 payment Grade 11','category' => 'Tuition',         'route_id' => null, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ─────────────────────────────────────────────────────────
        // 11. TRANSPORT ALLOCATIONS
        // ─────────────────────────────────────────────────────────
        $academicYear = $currentYear . '/' . ($currentYear + 1);
        $transportAllocations = [];
        foreach ($transportStudents as $idx => $sid) {
            $transportAllocations[] = [
                'id'            => "tsa_{$sid}",
                'tenant_id'     => 'tenant_001',
                'route_id'      => 'route_001',
                'student_id'    => $sid,
                'stop_id'       => null,
                'direction'     => 'both',
                'academic_year' => $academicYear,
                'start_date'    => "{$currentYear}-01-10",
                'end_date'      => null,
                'status'        => 'active',
                'notes'         => null,
                'created_at'    => $now,
                'updated_at'    => $now,
            ];
        }
        // Two students on route_002
        foreach (['student_007', 'student_011'] as $sid) {
            $transportAllocations[] = [
                'id'            => "tsa_{$sid}",
                'tenant_id'     => 'tenant_001',
                'route_id'      => 'route_002',
                'student_id'    => $sid,
                'stop_id'       => null,
                'direction'     => 'both',
                'academic_year' => $academicYear,
                'start_date'    => "{$currentYear}-01-10",
                'end_date'      => null,
                'status'        => 'active',
                'notes'         => null,
                'created_at'    => $now,
                'updated_at'    => $now,
            ];
        }
        $this->db->table('transport_student_allocations')->insertBatch($transportAllocations);

        // ─────────────────────────────────────────────────────────
        // 12. STUDENT ATTENDANCE (last 3 school days)
        // ─────────────────────────────────────────────────────────
        $classDays = [
            date('Y-m-d', strtotime('-3 weekdays')),
            date('Y-m-d', strtotime('-2 weekdays')),
            date('Y-m-d', strtotime('-1 weekdays')),
        ];
        $attendanceStatuses = ['present', 'present', 'present', 'present', 'absent', 'late', 'present', 'present'];
        $attRows = [];
        $attIdx  = 1;
        foreach ($classDays as $attDate) {
            foreach ($students as $idx => $s) {
                $status = $attendanceStatuses[$idx % count($attendanceStatuses)];
                $attRows[] = [
                    'id'          => sprintf('att_%04d', $attIdx++),
                    'tenant_id'   => 'tenant_001',
                    'student_id'  => $s['id'],
                    'class_id'    => $s['class_id'],
                    'date'        => $attDate,
                    'status'      => $status,
                    'remarks'     => $status === 'absent' ? 'No reason provided' : null,
                    'recorded_by' => 'user_003',
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ];
            }
        }
        foreach (array_chunk($attRows, 50) as $batch) {
            $this->db->table('student_attendance')->insertBatch($batch);
        }

        // ─────────────────────────────────────────────────────────
        // 13. STAFF ATTENDANCE (today and yesterday for teaching staff)
        // ─────────────────────────────────────────────────────────
        $teachingStaff   = ['staff_001', 'staff_002', 'staff_003', 'staff_004', 'staff_006'];
        $staffAttDates   = [date('Y-m-d', strtotime('-1 weekday')), $today];
        $staffAttRows    = [];
        $staffAttIdx     = 1;
        foreach ($staffAttDates as $sad) {
            foreach ($teachingStaff as $sid) {
                $late = ($sid === 'staff_003' && $sad === $today);
                $staffAttRows[] = [
                    'id'               => sprintf('satt_%04d', $staffAttIdx++),
                    'tenant_id'        => 'tenant_001',
                    'staff_id'         => $sid,
                    'date'             => $sad,
                    'check_in'         => $late ? '08:45:00' : '07:55:00',
                    'check_out'        => $sad === $today ? null : '17:05:00',
                    'status'           => $late ? 'late' : 'present',
                    'work_hours'       => $sad === $today ? null : 9.17,
                    'remarks'          => $late ? 'Traffic delay' : null,
                    'created_at'       => $now,
                    'updated_at'       => $now,
                ];
            }
        }
        $this->db->table('staff_attendance')->insertBatch($staffAttRows);

        // ─────────────────────────────────────────────────────────
        // 14. LEAVE REQUESTS
        // ─────────────────────────────────────────────────────────
        $this->db->table('leave_requests')->insertBatch([
            [
                'id'            => 'leave_001',
                'tenant_id'     => 'tenant_001',
                'staff_id'      => 'staff_002',
                'leave_type'    => 'annual',
                'start_date'    => date('Y-m-d', strtotime('+7 days')),
                'end_date'      => date('Y-m-d', strtotime('+9 days')),
                'days'          => 3,
                'reason'        => 'Annual leave – family holiday',
                'status'        => 'pending',
                'applied_date'  => date('Y-m-d'),
                'reviewed_by'   => null,
                'reviewed_date' => null,
                'review_notes'  => null,
                'created_at'    => $now,
                'updated_at'    => $now,
            ],
            [
                'id'            => 'leave_002',
                'tenant_id'     => 'tenant_001',
                'staff_id'      => 'staff_003',
                'leave_type'    => 'sick',
                'start_date'    => date('Y-m-d', strtotime('-14 days')),
                'end_date'      => date('Y-m-d', strtotime('-12 days')),
                'days'          => 3,
                'reason'        => 'Medical appointment',
                'status'        => 'approved',
                'applied_date'  => date('Y-m-d', strtotime('-15 days')),
                'reviewed_by'   => 'user_001',
                'reviewed_date' => date('Y-m-d', strtotime('-13 days')),
                'review_notes'  => 'Approved. Get well soon.',
                'created_at'    => date('Y-m-d H:i:s', strtotime('-15 days')),
                'updated_at'    => date('Y-m-d H:i:s', strtotime('-13 days')),
            ],
            [
                'id'            => 'leave_003',
                'tenant_id'     => 'tenant_001',
                'staff_id'      => 'staff_006',
                'leave_type'    => 'personal',
                'start_date'    => date('Y-m-d', strtotime('+14 days')),
                'end_date'      => date('Y-m-d', strtotime('+14 days')),
                'days'          => 1,
                'reason'        => 'Personal matter',
                'status'        => 'pending',
                'applied_date'  => date('Y-m-d'),
                'reviewed_by'   => null,
                'reviewed_date' => null,
                'review_notes'  => null,
                'created_at'    => $now,
                'updated_at'    => $now,
            ],
        ]);

        // Seed subscription plans (idempotent — skips existing rows)
        $this->call('SubscriptionPlanSeeder');

        // Re-enable foreign key checks
        $this->db->query('SET FOREIGN_KEY_CHECKS=1');

        echo "\n";
        echo "═══════════════════════════════════════════════════════════════\n";
        echo "  SCHOOLLEDGER – DATABASE SEEDED SUCCESSFULLY\n";
        echo "═══════════════════════════════════════════════════════════════\n";
        echo "\n";
        echo "  Tenant  : Greenwood Academy  (tenant_001)\n";
        echo "\n";
        echo "  LOGIN CREDENTIALS:\n";
        echo "  ─────────────────────────────────────────────────────────────\n";
        echo "  Super Admin : superadmin@greenwood.co.zw  / 1234\n";
        echo "  Admin       : admin@greenwood.co.zw       / 1234\n";
        echo "  Bursar      : bursar@greenwood.edu        / 1234\n";
        echo "  Teacher     : teacher@greenwood.edu       / 1234\n";
        echo "\n";
        echo "  DATA SUMMARY:\n";
        echo "  ─────────────────────────────────────────────────────────────\n";
        echo "  Staff            : 8  (6 teaching, 2 admin/ops)\n";
        echo "  Classes          : 5  (Grade 7A → Grade 11A, promotion chain set)\n";
        echo "  Students         : 20 (4 bursary: 3 full, 1 partial)\n";
        echo "  Enrollments      : 20\n";
        echo "  Transport Routes : 2  (Route A & B)\n";
        echo "  Transport Assign : 7  (all access=1 / active)\n";
        echo "  Billing Runs     : 1  (Term 1 {$currentYear}, completed)\n";
        echo sprintf("  Charges          : ~%d (fee_structure + transport)\n", count($chargeRows));
        echo "  Payments         : 8\n";
        echo "  Leave Requests   : 3  (2 pending, 1 approved)\n";
        echo "  Staff Attendance : " . count($staffAttRows) . " records\n";
        echo "  Student Att.     : " . count($attRows) . " records\n";
        echo "\n";
        echo "  FEE STRUCTURE:\n";
        echo "  ─────────────────────────────────────────────────────────────\n";
        echo "  Default : Tuition \$250, Dev Levy \$50, Sports \$30, Computer \$25\n";
        echo "  Grade 11 override: Tuition \$300\n";
        echo "\n";
        echo "  ACADEMIC CALENDAR ({$currentYear}):\n";
        echo "  ─────────────────────────────────────────────────────────────\n";
        echo "  Term 1: {$currentYear}-01-10 → {$currentYear}-04-05\n";
        echo "  Term 2: {$currentYear}-05-01 → {$currentYear}-07-25\n";
        echo "  Term 3: {$currentYear}-08-10 → {$currentYear}-11-20\n";
        echo "═══════════════════════════════════════════════════════════════\n\n";
    }
}

<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\CLI\CLI;
use App\Database\Seeds\FactoryContext;
use App\Database\Seeds\UniqueValueGenerator;
use App\Database\Seeds\Factories\TenantFactory;
use App\Database\Seeds\Factories\GradeLevelFactory;
use App\Database\Seeds\Factories\UserFactory;
use App\Database\Seeds\Factories\StaffFactory;
use App\Database\Seeds\Factories\ClassFactory;
use App\Database\Seeds\Factories\TransportRouteFactory;
use App\Database\Seeds\Factories\StudentFactory;
use App\Database\Seeds\Factories\ChargeFactory;
use App\Database\Seeds\Factories\PaymentFactory;
use App\Database\Seeds\Factories\TransportAssignmentFactory;
use App\Database\Seeds\Factories\AttendanceFactory;
use App\Database\Seeds\Factories\Providers\ZimbabweanProvider;
use Faker\Factory as FakerFactory;

/**
 * DatabaseSeeder
 *
 * Main orchestrating seeder. Coordinates all factories in priority order,
 * handles fresh vs. append mode, entity filtering, and progress reporting.
 *
 * Can be invoked via the SeedDatabaseCommand (php spark db:seed:platform)
 * or directly via CodeIgniter's seeder: php spark db:seed DatabaseSeeder
 */
class DatabaseSeeder extends Seeder
{
    /** Tables to truncate in --fresh mode (child tables first) */
    private const TRUNCATE_TABLES = [
        'transport_student_allocations',
        'student_attendance',
        'staff_attendance',
        'leave_requests',
        'payments',
        'charges',
        'billing_runs',
        'enrollments',
        'students',
        'classes',
        'transport_routes',
        'grade_levels',
        'staff',
        'users',
        'tenants',
    ];

    private array $seederConfig = [];
    private float $startTime;
    private int   $peakMemory = 0;

    /** Statistics accumulated during seeding */
    private array $stats = [
        'tenants'       => 0,
        'users'         => 0,
        'staff'         => 0,
        'grade_levels'  => 0,
        'classes'       => 0,
        'students'      => 0,
        'charges'       => 0,
        'payments'      => 0,
        'routes'        => 0,
        'assignments'   => 0,
        'attendance'    => 0,
    ];

    /**
     * Configure the seeder before running.
     */
    public function configure(array $config): self
    {
        $this->seederConfig = array_merge($this->defaultConfig(), $config);
        return $this;
    }

    private function defaultConfig(): array
    {
        return [
            'tenantCount'              => 1,
            'usersPerTenant'           => 4,
            'staffPerTenant'           => 8,
            'classesPerTenant'         => 5,
            'studentsPerClass'         => 10,
            'chargesPerStudent'        => 2,
            'paymentsPerStudent'       => 1,
            'transportRoutesPerTenant' => 2,
            'attendanceDays'           => 30,
            'mode'                     => 'fresh',
            'scenario'                 => null,
            'batchSize'                => 100,
            'only'                     => [],
            'skip'                     => [],
            'quiet'                    => false,
        ];
    }

    public function run()
    {
        if (empty($this->seederConfig)) {
            $this->seederConfig = $this->defaultConfig();
        }

        $this->startTime = microtime(true);

        $this->output('');
        $this->output('SchoolLedger Platform Database Seeder', 'green');
        $this->output(str_repeat('─', 50));

        // Apply scenario configuration overrides
        if (!empty($this->seederConfig['scenario'])) {
            $this->applyScenario($this->seederConfig['scenario']);
        }

        // Fresh mode: truncate all tables
        if ($this->seederConfig['mode'] === 'fresh') {
            $this->truncateTables();
        }

        // Bootstrap Faker with Zimbabwean provider
        $faker = FakerFactory::create('en_ZW');
        $faker->addProvider(new ZimbabweanProvider($faker));

        // Instantiate factories
        $batchSize             = (int) $this->seederConfig['batchSize'];
        $tenantFactory         = new TenantFactory($this->db, $batchSize);
        $gradeLevelFactory     = new GradeLevelFactory($this->db, $batchSize);
        $userFactory           = new UserFactory($this->db, $batchSize);
        $staffFactory          = new StaffFactory($this->db, $batchSize);
        $classFactory          = new ClassFactory($this->db, $batchSize);
        $transportRouteFactory = new TransportRouteFactory($this->db, $batchSize);
        $studentFactory        = new StudentFactory($this->db, $batchSize);
        $chargeFactory         = new ChargeFactory($this->db, $batchSize);
        $paymentFactory        = new PaymentFactory($this->db, $batchSize);
        $assignmentFactory     = new TransportAssignmentFactory($this->db, $batchSize);
        $attendanceFactory     = new AttendanceFactory($this->db, $batchSize, (int) $this->seederConfig['attendanceDays']);

        $tenantCount = (int) $this->seederConfig['tenantCount'];

        for ($t = 0; $t < $tenantCount; $t++) {
            $context              = new FactoryContext($faker);
            $context->sequence    = ($t * 10000) + 1;

            $this->output("\nSeeding tenant " . ($t + 1) . " of {$tenantCount}...", 'yellow');

            // Tenant
            if ($this->shouldRun('tenants')) {
                $this->output("  Creating tenant...");
                $tenantIds        = $tenantFactory->createMany($context, 1);
                $this->stats['tenants']++;
            }

            // Grade Levels
            if ($this->shouldRun('grade_levels')) {
                $this->output("  Creating grade levels...");
                $glIds            = $gradeLevelFactory->createMany($context, 5);
                $this->stats['grade_levels'] += count($glIds);
            }

            // Users
            if ($this->shouldRun('users')) {
                $count = (int) $this->seederConfig['usersPerTenant'];
                $this->output("  Creating {$count} users...");
                $userIds          = $userFactory->createMany($context, $count);
                $this->stats['users'] += count($userIds);
            }

            // Staff
            if ($this->shouldRun('staff')) {
                $count = (int) $this->seederConfig['staffPerTenant'];
                $this->output("  Creating {$count} staff members...");
                $staffIds         = $staffFactory->createMany($context, $count);
                $this->stats['staff'] += count($staffIds);
            }

            // Classes
            if ($this->shouldRun('classes')) {
                $count = (int) $this->seederConfig['classesPerTenant'];
                $this->output("  Creating {$count} classes...");
                $classIds         = $classFactory->createMany($context, $count);
                $this->stats['classes'] += count($classIds);
            }

            // Transport Routes
            if ($this->shouldRun('transport_routes')) {
                $count = (int) $this->seederConfig['transportRoutesPerTenant'];
                $this->output("  Creating {$count} transport routes...");
                $routeIds         = $transportRouteFactory->createMany($context, $count);
                $this->stats['routes'] += count($routeIds);
            }

            // Students
            if ($this->shouldRun('students')) {
                $totalStudents = (int) $this->seederConfig['classesPerTenant'] * (int) $this->seederConfig['studentsPerClass'];
                $this->output("  Creating {$totalStudents} students...");
                $studentIds       = $studentFactory->createMany($context, $totalStudents);
                $this->stats['students'] += count($studentIds);
            }

            // Charges
            if ($this->shouldRun('charges')) {
                $chargesPerStudent = (int) $this->seederConfig['chargesPerStudent'];
                $total             = count($context->studentIds) * $chargesPerStudent;
                $this->output("  Creating {$total} charges...");
                $chargeIds        = $chargeFactory->createMany($context, $chargesPerStudent);
                $this->stats['charges'] += count($chargeIds);
            }

            // Payments
            if ($this->shouldRun('payments')) {
                $paymentsPerStudent = (int) $this->seederConfig['paymentsPerStudent'];
                $total              = count($context->studentIds) * $paymentsPerStudent;
                $this->output("  Creating {$total} payments...");
                $paymentIds       = $paymentFactory->createMany($context, $paymentsPerStudent);
                $this->stats['payments'] += count($paymentIds);
            }

            // Transport Assignments
            if ($this->shouldRun('transport_allocations') && !empty($context->routeIds)) {
                $this->output("  Creating transport allocations (20-30% of students)...");
                $assignIds        = $assignmentFactory->createMany($context, 0);
                $this->stats['assignments'] += count($assignIds);
            }

            // Attendance
            if ($this->shouldRun('attendance')) {
                $days = (int) $this->seederConfig['attendanceDays'];
                $this->output("  Creating attendance records ({$days} days)...");
                $attIds           = $attendanceFactory->createMany($context, 0);
                $this->stats['attendance'] += count($attIds);
            }

            $this->peakMemory = max($this->peakMemory, memory_get_peak_usage(true));
        }

        $this->printSummary();
    }

    /**
     * Check if an entity type should be seeded based on --only / --skip config.
     */
    private function shouldRun(string $entity): bool
    {
        $only = $this->seederConfig['only'] ?? [];
        $skip = $this->seederConfig['skip'] ?? [];

        if (!empty($only)) {
            return in_array($entity, $only, true);
        }

        if (!empty($skip)) {
            return !in_array($entity, $skip, true);
        }

        return true;
    }

    /**
     * Truncate all seeded tables (for --fresh mode).
     */
    private function truncateTables(): void
    {
        $this->output("Truncating tables...", 'yellow');
        $this->db->query('SET FOREIGN_KEY_CHECKS=0');

        foreach (self::TRUNCATE_TABLES as $table) {
            if ($this->db->tableExists($table)) {
                $this->db->table($table)->truncate();
            }
        }

        $this->db->query('SET FOREIGN_KEY_CHECKS=1');
        $this->output("Tables cleared.", 'green');
    }

    /**
     * Apply a named scenario's configuration overrides.
     */
    private function applyScenario(string $scenarioName): void
    {
        $registry = new ScenarioRegistry();
        $scenario = $registry->get($scenarioName);

        if ($scenario === null) {
            $this->output("Warning: scenario '{$scenarioName}' not found. Using defaults.", 'red');
            return;
        }

        $this->output("Applying scenario: {$scenarioName}", 'cyan');
        $scenario->configure($this->seederConfig);
    }

    /**
     * Print a summary table after seeding completes.
     */
    private function printSummary(): void
    {
        $elapsed = round(microtime(true) - $this->startTime, 2);
        $memory  = round($this->peakMemory / 1024 / 1024, 1);

        $this->output('');
        $this->output(str_repeat('─', 50));
        $this->output('Seeding Complete!', 'green');
        $this->output(str_repeat('─', 50));

        $rows = [
            ['Entity',          'Count'],
            ['Tenants',         $this->stats['tenants']],
            ['Grade Levels',    $this->stats['grade_levels']],
            ['Users',           $this->stats['users']],
            ['Staff',           $this->stats['staff']],
            ['Classes',         $this->stats['classes']],
            ['Students',        $this->stats['students']],
            ['Charges',         $this->stats['charges']],
            ['Payments',        $this->stats['payments']],
            ['Transport Routes',$this->stats['routes']],
            ['Assignments',     $this->stats['assignments']],
            ['Attendance Recs', $this->stats['attendance']],
        ];

        foreach ($rows as $i => $row) {
            $label = str_pad($row[0], 20);
            $val   = $row[1];
            if ($i === 0) {
                $this->output("  {$label}  {$val}", 'cyan');
            } else {
                $this->output("  {$label}  {$val}");
            }
        }

        $this->output('');
        $this->output("  Time elapsed : {$elapsed}s");
        $this->output("  Peak memory  : {$memory} MB");
        $this->output(str_repeat('─', 50));
    }

    /**
     * Output a line (skips if quiet mode).
     */
    private function output(string $message, string $color = ''): void
    {
        if (!empty($this->seederConfig['quiet'])) {
            return;
        }

        if ($color && class_exists(CLI::class)) {
            CLI::write($message, $color);
        } else {
            echo $message . "\n";
        }
    }
}

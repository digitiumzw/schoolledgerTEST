<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;

/**
 * AttendanceFactory
 *
 * Generates attendance records for staff and students.
 * Priority: 120
 */
class AttendanceFactory extends AbstractFactory
{
    private int $attendanceDays;

    public function __construct(\CodeIgniter\Database\BaseConnection $db, int $batchSize = 100, int $attendanceDays = 30)
    {
        parent::__construct($db, $batchSize);
        $this->attendanceDays = $attendanceDays;
    }

    public function getPriority(): int
    {
        return 120;
    }

    protected function tableName(): string
    {
        return 'student_attendance'; // primary table, staff handled separately
    }

    public function make(FactoryContext $context): array
    {
        return []; // handled in createMany
    }

    public function createMany(FactoryContext $context, int $count): array
    {
        $ids = [];
        $ids = array_merge($ids, $this->createStudentAttendance($context));
        $ids = array_merge($ids, $this->createStaffAttendance($context));
        return $ids;
    }

    private function createStudentAttendance(FactoryContext $context): array
    {
        if (empty($context->studentIds)) return [];

        $ids     = [];
        $pending = [];
        $now     = $this->now();
        $days    = $this->buildWorkingDays($this->attendanceDays);

        $studentStatuses = ['present' => 85, 'absent' => 10, 'late' => 5];

        foreach ($context->studentIds as $studentId) {
            foreach ($days as $date) {
                $status = $this->weightedRandom($studentStatuses);
                // student_attendance uses 'excused' instead of 'on_leave'; remap 'late' -> 'late'
                $row    = [
                    'id'          => $this->generateId('sa'),
                    'tenant_id'   => $context->tenantId,
                    'student_id'  => $studentId,
                    'class_id'    => !empty($context->classIds) ? $context->classIds[array_rand($context->classIds)] : null,
                    'date'        => $date,
                    'status'      => $status,
                    'remarks'     => null,
                    'recorded_by' => 'seeder',
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ];
                $ids[]     = $row['id'];
                $pending[] = $row;

                if (count($pending) >= $this->batchSize) {
                    $this->db->table('student_attendance')->insertBatch($pending);
                    $pending = [];
                }
            }
        }

        if (!empty($pending)) {
            $this->db->table('student_attendance')->insertBatch($pending);
        }

        return $ids;
    }

    private function createStaffAttendance(FactoryContext $context): array
    {
        if (empty($context->staffIds)) return [];

        $ids     = [];
        $pending = [];
        $now     = $this->now();
        $days    = $this->buildWorkingDays($this->attendanceDays);

        $staffStatuses = ['present' => 70, 'absent' => 10, 'late' => 10, 'on_leave' => 10];

        foreach ($context->staffIds as $staffId) {
            foreach ($days as $date) {
                $status = $this->weightedRandom($staffStatuses);
                $row    = [
                    'id'         => $this->generateId('sfa'),
                    'tenant_id'  => $context->tenantId,
                    'staff_id'   => $staffId,
                    'date'       => $date,
                    'status'     => $status,
                    'check_in'   => in_array($status, ['present', 'late']) ? '08:00:00' : null,
                    'check_out'  => $status === 'present' ? '17:00:00' : null,
                    'work_hours' => $status === 'present' ? 9.00 : null,
                    'remarks'    => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $ids[]     = $row['id'];
                $pending[] = $row;

                if (count($pending) >= $this->batchSize) {
                    $this->db->table('staff_attendance')->insertBatch($pending);
                    $pending = [];
                }
            }
        }

        if (!empty($pending)) {
            $this->db->table('staff_attendance')->insertBatch($pending);
        }

        return $ids;
    }

    /**
     * Returns an array of Y-m-d date strings for the last N working days.
     */
    private function buildWorkingDays(int $days): array
    {
        $result = [];
        $date   = new \DateTime();
        $count  = 0;

        while ($count < $days) {
            $dow = (int) $date->format('N'); // 1=Mon, 7=Sun
            if ($dow <= 5) { // weekdays only
                $result[] = $date->format('Y-m-d');
                $count++;
            }
            $date->modify('-1 day');
        }

        return array_reverse($result);
    }
}

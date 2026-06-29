<?php

namespace App\Services;

use CodeIgniter\Database\Config;

class StaffAttendanceService
{
    protected $db;

    public function __construct()
    {
        $this->db = Config::connect();
    }

    /**
     * Read work-hours configuration from tenants.settings JSON.
     * Falls back to 08:30/17:00 (8.5 standard hours) when not configured.
     *
     * @return array{startTime:string, endTime:string, standardHours:float}
     */
    public function getWorkHoursConfig(string $tenantId): array
    {
        $defaults = [
            'startTime'     => '08:30',
            'endTime'       => '17:00',
            'standardHours' => 8.5,
        ];

        $tenant = $this->db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        if (!$tenant || empty($tenant['settings'])) {
            return $defaults;
        }

        $settings = json_decode($tenant['settings'], true);
        if (!is_array($settings) || empty($settings['staffWorkHours'])) {
            return $defaults;
        }

        $wh = $settings['staffWorkHours'];
        if (empty($wh['startTime']) || empty($wh['endTime'])) {
            return $defaults;
        }

        $startTime = $wh['startTime'];
        $endTime   = $wh['endTime'];

        $startSeconds = strtotime($startTime);
        $endSeconds   = strtotime($endTime);
        if ($endSeconds <= $startSeconds) {
            return $defaults;
        }

        $standardHours = round(($endSeconds - $startSeconds) / 3600, 2);

        return [
            'startTime'     => $startTime,
            'endTime'       => $endTime,
            'standardHours' => $standardHours,
        ];
    }

    /**
     * Derive the attendance status from check-in and optional check-out times.
     *
     * Precedence (applied on check-out, check-in gets present/late only):
     *   1. half_day      — work_hours < standardHours / 2
     *   2. early_departure — check_out < endTime
     *   3. late          — check_in > startTime (preserved from check-in)
     *   4. present       — default
     *
     * @param string      $checkIn       HH:mm
     * @param string|null $checkOut      HH:mm or null (check-in only)
     * @param string      $startTime     HH:mm
     * @param string      $endTime       HH:mm
     * @param float       $standardHours
     */
    public function classifyStatus(
        string  $checkIn,
        ?string $checkOut,
        string  $startTime,
        string  $endTime,
        float   $standardHours
    ): string {
        $checkInMinutes  = $this->timeToMinutes($checkIn);
        $startMinutes    = $this->timeToMinutes($startTime);

        // Check-in only: determine late vs present
        if ($checkOut === null) {
            return $checkInMinutes > $startMinutes ? 'late' : 'present';
        }

        $checkOutMinutes = $this->timeToMinutes($checkOut);
        $endMinutes      = $this->timeToMinutes($endTime);
        $workHours       = ($checkOutMinutes - $checkInMinutes) / 60;

        if ($workHours < $standardHours / 2) {
            return 'half_day';
        }

        if ($checkOutMinutes < $endMinutes) {
            return 'early_departure';
        }

        // Checked out on time or late — preserve late if they checked in late
        return $checkInMinutes > $startMinutes ? 'late' : 'present';
    }

    /**
     * Compute overtime hours for a working day.
     * Returns 0.0 when work_hours does not exceed standard hours.
     */
    public function calculateOvertimeHours(float $workHours, float $standardHours): float
    {
        return max(0.0, round($workHours - $standardHours, 2));
    }

    /**
     * Auto-create on_leave attendance rows for each Mon–Fri working day covered
     * by an approved leave request.
     *
     * Skips dates that already have a source='manual' or source='kiosk' record
     * (does not overwrite manual entries).
     *
     * @param array $leaveRow  Leave request row from leave_requests table.
     * @param string $tenantId
     */
    public function syncLeaveToAttendance(array $leaveRow, string $tenantId): int
    {
        $workingDays = $this->getWorkingDays($leaveRow['start_date'], $leaveRow['end_date']);
        if (empty($workingDays)) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');
        $synced = 0;

        $this->db->transStart();

        foreach ($workingDays as $date) {
            // Check if a non-leave-sync record already exists for this date
            $existing = $this->db->table('staff_attendance')
                ->where('tenant_id', $tenantId)
                ->where('staff_id', $leaveRow['staff_id'])
                ->where('date', $date)
                ->get()->getRow();

            if ($existing && $existing->source !== 'leave_sync') {
                // Manual or kiosk record exists — skip this date
                continue;
            }

            if ($existing && $existing->source === 'leave_sync') {
                // Update the existing leave_sync row (e.g., leave type changed)
                $this->db->table('staff_attendance')
                    ->where('id', $existing->id)
                    ->update([
                        'status'    => 'on_leave',
                        'remarks'   => 'leave_request:' . $leaveRow['id'],
                        'updated_at' => $now,
                    ]);
                $synced++;
                continue;
            }

            // Insert new leave_sync row
            $this->db->table('staff_attendance')->insert([
                'id'         => 'sa' . time() . '_' . bin2hex(random_bytes(4)),
                'tenant_id'  => $tenantId,
                'staff_id'   => $leaveRow['staff_id'],
                'date'       => $date,
                'status'     => 'on_leave',
                'remarks'    => 'leave_request:' . $leaveRow['id'],
                'source'     => 'leave_sync',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $synced++;
        }

        $this->db->transComplete();

        return $synced;
    }

    /**
     * Void (delete) all attendance rows created by leave_sync for this leave record.
     *
     * @param array $leaveRow  Leave request row from leave_requests table.
     * @param string $tenantId
     */
    public function voidLeaveAttendance(array $leaveRow, string $tenantId): void
    {
        $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $leaveRow['staff_id'])
            ->where('source', 'leave_sync')
            ->where('date >=', $leaveRow['start_date'])
            ->where('date <=', $leaveRow['end_date'])
            ->delete();
    }

    /**
     * Returns an array of YYYY-MM-DD strings for Mon–Fri dates between start and end (inclusive).
     */
    public function getWorkingDays(string $startDate, string $endDate): array
    {
        $days   = [];
        $current = strtotime($startDate);
        $end     = strtotime($endDate);

        while ($current <= $end) {
            $dow = (int) date('N', $current); // 1=Mon, 7=Sun
            if ($dow <= 5) {
                $days[] = date('Y-m-d', $current);
            }
            $current = strtotime('+1 day', $current);
        }

        return $days;
    }

    public function getWorkingDaysExcludingHolidays(string $tenantId, string $startDate, string $endDate): array
    {
        $holidays = $this->getHolidayDates($tenantId);

        return array_values(array_filter(
            $this->getWorkingDays($startDate, $endDate),
            static fn(string $date): bool => !in_array($date, $holidays, true)
        ));
    }

    private function getHolidayDates(string $tenantId): array
    {
        $tenant = $this->db->table('tenants')
            ->select('academic_calendar')
            ->where('id', $tenantId)
            ->get()
            ->getRowArray();

        if (!$tenant || empty($tenant['academic_calendar'])) {
            return [];
        }

        $calendar = json_decode($tenant['academic_calendar'], true);
        if (!is_array($calendar) || empty($calendar['holidays']) || !is_array($calendar['holidays'])) {
            return [];
        }

        return array_values(array_filter(
            $calendar['holidays'],
            static fn($date): bool => is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1
        ));
    }

    /**
     * Convert HH:mm string to integer minutes.
     */
    private function timeToMinutes(string $time): int
    {
        [$h, $m] = explode(':', $time);
        return (int) $h * 60 + (int) $m;
    }
}

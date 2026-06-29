<?php

namespace App\Services;

use App\Models\AttendanceModel;
use App\Models\StaffModel;
use CodeIgniter\Database\Config;

/**
 * AttendanceCutoffService
 *
 * Handles the logic for automatically marking staff as absent after a
 * configured cutoff time. Designed to be called by the attendance:cutoff
 * Spark command, which should be scheduled via cron.
 *
 * Processing rules:
 * - Only runs on working days (Mon–Fri, not a configured holiday)
 * - Only marks absences when at least one staff member has already checked in
 * - Idempotent: running multiple times on the same day produces no duplicates
 * - Staff with an existing ON_LEAVE record for today are excluded
 */
class AttendanceCutoffService
{
    protected AttendanceModel $attendanceModel;
    protected StaffModel      $staffModel;
    protected $db;

    public function __construct()
    {
        $this->attendanceModel = new AttendanceModel();
        $this->staffModel      = new StaffModel();
        $this->db              = Config::connect();
    }

    // -------------------------------------------------------------------------
    // Working-day checks (tasks 5.1 – 5.3)
    // -------------------------------------------------------------------------

    /**
     * Returns true if the given date falls on a Monday–Friday.
     */
    public function isWorkingDay(\DateTime $date = null): bool
    {
        $date = $date ?? new \DateTime();
        $dow  = (int) $date->format('N'); // 1 = Monday … 7 = Sunday
        return $dow >= 1 && $dow <= 5;
    }

    /**
     * Returns true if the given date is configured as a holiday for the tenant.
     *
     * Holidays are stored in the tenant's academic_calendar JSON under
     * academic_calendar.holidays as an array of 'YYYY-MM-DD' strings.
     */
    public function isHoliday(string $tenantId, \DateTime $date = null): bool
    {
        $date   = $date ?? new \DateTime();
        $dateStr = $date->format('Y-m-d');

        $tenant = $this->db->table('tenants')
            ->where('id', $tenantId)
            ->get()
            ->getRowArray();

        if (!$tenant || empty($tenant['academic_calendar'])) {
            return false;
        }

        $calendar = json_decode($tenant['academic_calendar'], true) ?? [];
        $holidays = $calendar['holidays'] ?? [];

        return in_array($dateStr, $holidays, true);
    }

    /**
     * Returns true if today should be processed (working day and not a holiday).
     */
    public function shouldProcessToday(string $tenantId, \DateTime $date = null): bool
    {
        $date = $date ?? new \DateTime();
        return $this->isWorkingDay($date) && !$this->isHoliday($tenantId, $date);
    }

    // -------------------------------------------------------------------------
    // Core checks (tasks 3.2 – 3.6)
    // -------------------------------------------------------------------------

    /**
     * Returns true if at least one staff member has a check-in record today.
     * Considers any status that implies physical presence (present, late, half_day).
     */
    public function hasAnyCheckInToday(string $tenantId, string $date = null): bool
    {
        $date = $date ?? date('Y-m-d');

        $row = $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('date', $date)
            ->whereIn('status', ['present', 'late', 'half_day'])
            ->countAllResults();

        return $row > 0;
    }

    /**
     * Returns staff IDs that have no attendance record for today (or have no
     * on_leave / excused status) — i.e. staff who should be marked absent.
     *
     * @return string[]  Array of staff IDs
     */
    public function getUncheckedStaff(string $tenantId, string $date = null): array
    {
        $date = $date ?? date('Y-m-d');

        // Get all active staff
        $allStaff = $this->staffModel->getActiveStaff($tenantId);

        if (empty($allStaff)) {
            return [];
        }

        $staffIds = array_column($allStaff, 'id');

        // Get staff with an existing attendance record for today
        $existing = $this->db->table('staff_attendance')
            ->select('staff_id, status')
            ->where('tenant_id', $tenantId)
            ->where('date', $date)
            ->get()
            ->getResultArray();

        $checkedIn = [];
        foreach ($existing as $record) {
            // Skip staff that are on leave or already excused
            if (in_array($record['status'], ['on_leave', 'excused'], true)) {
                $checkedIn[] = $record['staff_id'];
                continue;
            }
            // Any other status means they have been processed
            $checkedIn[] = $record['staff_id'];
        }

        return array_values(array_diff($staffIds, $checkedIn));
    }

    /**
     * Creates system-originated ABSENT records for the given staff IDs.
     * Timestamp is set to the cutoff time on today's date.
     *
     * @param  string[] $staffIds
     * @param  string   $cutoffTime  HH:MM
     * @return int  Number of records inserted
     */
    public function markAsAbsent(string $tenantId, array $staffIds, string $cutoffTime): int
    {
        if (empty($staffIds)) {
            return 0;
        }

        $today     = date('Y-m-d');
        $timestamp = $today . ' ' . $cutoffTime . ':00';
        $count     = 0;

        foreach ($staffIds as $staffId) {
            $id = 'sa' . time() . '_' . bin2hex(random_bytes(4));

            $this->attendanceModel->insert([
                'id'         => $id,
                'tenant_id'  => $tenantId,
                'staff_id'   => $staffId,
                'date'       => $today,
                'status'     => 'absent',
                'source'     => 'system',
                'remarks'    => 'Automatically marked absent at cutoff time ' . $cutoffTime,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]);

            $count++;
        }

        return $count;
    }

    public function markAsExcused(string $tenantId, array $staffIds, string $date = null): int
    {
        if (empty($staffIds)) {
            return 0;
        }

        $date      = $date ?? date('Y-m-d');
        $timestamp = date('Y-m-d H:i:s');
        $count     = 0;

        foreach ($staffIds as $staffId) {
            $existing = $this->db->table('staff_attendance')
                ->where('tenant_id', $tenantId)
                ->where('staff_id', $staffId)
                ->where('date', $date)
                ->get()
                ->getRow();

            if ($existing) {
                continue;
            }

            $this->attendanceModel->insert([
                'id'         => 'sa' . time() . '_' . bin2hex(random_bytes(4)),
                'tenant_id'  => $tenantId,
                'staff_id'   => $staffId,
                'date'       => $date,
                'status'     => 'excused',
                'source'     => 'system',
                'remarks'    => 'Automatically marked excused for school holiday',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]);

            $count++;
        }

        return $count;
    }

    /**
     * Returns true if the system has already processed absences for today
     * (i.e. at least one system-originated ABSENT record exists for this tenant today).
     */
    public function isAlreadyProcessedToday(string $tenantId, string $date = null): bool
    {
        $date = $date ?? date('Y-m-d');

        $count = $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('date', $date)
            ->where('source', 'system')
            ->whereIn('status', ['absent', 'excused'])
            ->countAllResults();

        return $count > 0;
    }

    // -------------------------------------------------------------------------
    // Settings helpers
    // -------------------------------------------------------------------------

    /**
     * Load attendance cutoff settings for a tenant.
     *
     * Cutoff is always enabled; the cutoff time is derived from
     * staffWorkHours.endTime. Falls back to "17:00" when not set.
     *
     * @return array{enabled: bool, cutoffTime: string}
     */
    public function getCutoffSettings(string $tenantId): array
    {
        $tenant = $this->db->table('tenants')
            ->where('id', $tenantId)
            ->get()
            ->getRowArray();

        if (!$tenant || empty($tenant['settings'])) {
            log_message('warning', "[AttendanceCutoff][{$tenantId}] No settings found; using fallback cutoff time 17:00");
            return ['enabled' => true, 'cutoffTime' => '17:00'];
        }

        $settings    = json_decode($tenant['settings'], true) ?? [];
        $endTime     = $settings['staffWorkHours']['endTime'] ?? null;

        if ($endTime === null) {
            log_message('warning', "[AttendanceCutoff][{$tenantId}] staffWorkHours.endTime not set; using fallback cutoff time 17:00");
            $endTime = '17:00';
        }

        return [
            'enabled'    => true,
            'cutoffTime' => $endTime,
        ];
    }

    /**
     * Return all tenant IDs. The cutoff feature is always-on for every tenant.
     *
     * @return string[]
     */
    public function getEnabledTenantIds(): array
    {
        $tenants = $this->db->table('tenants')->select('id')->get()->getResultArray();
        return array_column($tenants, 'id');
    }
}

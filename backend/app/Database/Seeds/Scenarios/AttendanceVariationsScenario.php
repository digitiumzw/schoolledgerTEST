<?php

namespace App\Database\Seeds\Scenarios;

/**
 * AttendanceVariationsScenario
 *
 * Varied attendance patterns for testing attendance reports:
 * - Extended date range (60 days instead of 30)
 * - Higher absence rates for both staff and students
 */
class AttendanceVariationsScenario extends AbstractScenario
{
    public function name(): string
    {
        return 'attendance-variations';
    }

    public function description(): string
    {
        return 'Extended attendance records (60 days) with varied absence and late patterns';
    }

    public function configure(array &$config): void
    {
        $config['attendanceDays'] = 60;
    }
}

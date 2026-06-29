<?php

namespace App\Models;

use CodeIgniter\Model;

class DashboardWidgetModel extends Model
{
    protected $table            = 'dashboard_widgets';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'widget_key', 'widget_type', 'title', 'description', 'icon',
        'required_roles', 'display_order', 'is_active', 'drill_down_config',
    ];

    public function getForRole(string $role): array
    {
        $rows = $this->where('is_active', 1)
            ->orderBy('display_order', 'ASC')
            ->findAll();

        return array_values(array_filter($rows, static function (array $row) use ($role): bool {
            $roles = json_decode($row['required_roles'] ?? '[]', true);
            return is_array($roles) && in_array($role, $roles, true);
        }));
    }

    public function ensureDefaults(): void
    {
        $now = date('Y-m-d H:i:s');
        $widgets = [
            ['total_students', 'metric_card', 'Total Students', 'Current active student enrollment', 'users', ['admin'], 10, ['url' => '/students', 'params' => ['status' => 'active']]],
            ['attendance_rate_today', 'metric_card', "Today's Attendance", 'Current student attendance rate', 'clipboard-check', ['admin'], 20, ['url' => '/attendance', 'params' => []]],
            ['outstanding_payments', 'metric_card', 'Outstanding Payments', 'Total unpaid student balances', 'dollar-sign', ['admin', 'bursar'], 30, ['url' => '/payments', 'params' => ['balance' => 'outstanding']]],
            ['payments_collected_today', 'metric_card', 'Payments Today', 'Payments collected today', 'credit-card', ['admin', 'bursar'], 40, ['url' => '/payments', 'params' => ['date' => 'today']]],
            ['active_transport_students', 'metric_card', 'Transport Students', 'Students with active transport allocation', 'bus', ['admin'], 50, ['url' => '/transport', 'params' => []]],
            ['staff_present_today', 'metric_card', 'Staff Present', 'Staff attendance for today', 'user-check', ['admin'], 60, ['url' => '/staff', 'params' => []]],
        ];

        foreach ($widgets as [$key, $type, $title, $description, $icon, $roles, $order, $drillDown]) {
            $existing = $this->where('widget_key', $key)->first();
            $data = [
                'widget_key'          => $key,
                'widget_type'         => $type,
                'title'               => $title,
                'description'         => $description,
                'icon'                => $icon,
                'required_roles'      => json_encode($roles),
                'display_order'       => $order,
                'is_active'           => 1,
                'drill_down_config'   => json_encode($drillDown),
                'updated_at'          => $now,
            ];

            if ($existing) {
                $this->update($existing['id'], $data);
            } else {
                $data['created_at'] = $now;
                $this->insert($data);
            }
        }
    }
}

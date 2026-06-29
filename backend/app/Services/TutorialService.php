<?php

namespace App\Services;

use App\Models\UserTutorialProgressModel;
use InvalidArgumentException;

class TutorialService
{
    private UserTutorialProgressModel $progressModel;

    public function __construct()
    {
        $this->progressModel = new UserTutorialProgressModel();
    }

    public function getTutorial(string $tenantId, string $userId, string $role): array
    {
        $progress = $this->progressModel->ensureForUser($tenantId, $userId);
        $modules = $this->visibleModules($role);
        $status = $progress['status'] ?? 'not_started';

        return [
            'status' => $status,
            'should_show' => in_array($status, ['not_started', 'in_progress'], true),
            'last_seen_step' => $progress['last_seen_step'] ?? null,
            'seen_module_keys' => $this->progressModel->decodeSeenModuleKeys($progress),
            'modules' => $modules,
        ];
    }

    public function updateProgress(string $tenantId, string $userId, string $role, array $data): array
    {
        $progress = $this->progressModel->ensureForUser($tenantId, $userId);
        $status = (string) ($data['status'] ?? '');
        $allowedStatuses = ['not_started', 'in_progress', 'completed', 'dismissed'];

        if (!in_array($status, $allowedStatuses, true)) {
            throw new InvalidArgumentException('Invalid tutorial status.');
        }

        $visibleKeys = array_column($this->visibleModules($role), 'module_key');
        $lastSeenStep = isset($data['last_seen_step']) && $data['last_seen_step'] !== null
            ? (string) $data['last_seen_step']
            : null;
        if ($lastSeenStep !== null && !in_array($lastSeenStep, $visibleKeys, true)) {
            throw new InvalidArgumentException('Tutorial step is not available to this user.');
        }

        $seenKeys = [];
        if (isset($data['seen_module_keys']) && is_array($data['seen_module_keys'])) {
            foreach ($data['seen_module_keys'] as $key) {
                $key = (string) $key;
                if (!in_array($key, $visibleKeys, true)) {
                    throw new InvalidArgumentException('Tutorial progress includes a module unavailable to this user.');
                }
                $seenKeys[] = $key;
            }
        }

        $now = date('Y-m-d H:i:s');
        $payload = [
            'status' => $status,
            'last_seen_step' => $lastSeenStep,
            'seen_module_keys' => json_encode(array_values(array_unique($seenKeys))),
        ];

        if ($status === 'in_progress' && empty($progress['started_at'])) {
            $payload['started_at'] = $now;
        }
        if ($status === 'completed') {
            $payload['completed_at'] = $now;
            $payload['dismissed_at'] = null;
        }
        if ($status === 'dismissed') {
            $payload['dismissed_at'] = $now;
        }

        $this->progressModel->update($progress['id'], $payload);

        return $this->getTutorial($tenantId, $userId, $role);
    }

    public function restart(string $tenantId, string $userId, string $role): array
    {
        $progress = $this->progressModel->ensureForUser($tenantId, $userId);
        $this->progressModel->update($progress['id'], [
            'status' => 'in_progress',
            'started_at' => date('Y-m-d H:i:s'),
            'completed_at' => null,
            'dismissed_at' => null,
            'last_seen_step' => null,
            'seen_module_keys' => json_encode([]),
        ]);

        return $this->getTutorial($tenantId, $userId, $role);
    }

    private function visibleModules(string $role): array
    {
        $modules = [];
        foreach ($this->moduleDefinitions() as $module) {
            if (in_array($role, $module['required_roles'], true)) {
                unset($module['required_roles']);
                $modules[] = $module;
            }
        }

        usort($modules, static fn (array $a, array $b): int => $a['order'] <=> $b['order']);
        return $modules;
    }

    private function moduleDefinitions(): array
    {
        return [
            [
                'module_key' => 'dashboard',
                'module_name' => 'Dashboard',
                'summary' => 'View school overview, key metrics, alerts, and quick actions.',
                'contains' => ['KPI summaries', 'financial overview', 'enrolment alerts', 'staff and transport summaries'],
                'primary_actions' => ['Review school status', 'open priority work areas', 'monitor recent activity'],
                'route' => '/',
                'order' => 1,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'students',
                'module_name' => 'Students',
                'summary' => 'Manage student records, profiles, finance history, and class/status changes.',
                'contains' => ['student directory', 'student profiles', 'finance tab', 'attendance and history sections'],
                'primary_actions' => ['Add students', 'update profiles', 'review balances and histories'],
                'route' => '/students',
                'order' => 2,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'classes',
                'module_name' => 'Classes',
                'summary' => 'Create and manage classes before enrolling students and configuring class-based billing.',
                'contains' => ['class directory', 'class rosters', 'promotion settings'],
                'primary_actions' => ['Add classes', 'assign teachers', 'view class students'],
                'route' => '/classes',
                'order' => 3,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'staff',
                'module_name' => 'Staff',
                'summary' => 'Manage staff records and employment details.',
                'contains' => ['staff directory', 'staff profiles', 'employment information'],
                'primary_actions' => ['Add staff', 'update staff details', 'review staff records'],
                'route' => '/staff',
                'order' => 4,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'staff-attendance',
                'module_name' => 'Staff Attendance',
                'summary' => 'Track staff check-ins, work hours, leave integration, and attendance reports.',
                'contains' => ['attendance records', 'leave-aware reports', 'period summaries'],
                'primary_actions' => ['Record attendance', 'review reports', 'monitor staff attendance'],
                'route' => '/s-attendance',
                'order' => 5,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'transport',
                'module_name' => 'Transport',
                'summary' => 'Manage routes, stops, vehicles, drivers, and student transport assignments.',
                'contains' => ['routes', 'vehicles', 'drivers', 'student assignments'],
                'primary_actions' => ['Create routes', 'assign students', 'review transport access'],
                'route' => '/transport',
                'order' => 6,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'payments',
                'module_name' => 'Payments',
                'summary' => 'Record payments, review payment history, and access receipt workflows.',
                'contains' => ['payment recording', 'payment history', 'receipts', 'filters and summaries'],
                'primary_actions' => ['Record payments', 'search payments', 'print receipts'],
                'route' => '/payments',
                'order' => 7,
                'required_roles' => ['super_admin', 'admin', 'bursar'],
            ],
            [
                'module_key' => 'fee-campaigns',
                'module_name' => 'Fee Campaigns',
                'summary' => 'Track targeted fee collection campaigns separately from the normal ledger.',
                'contains' => ['campaign lists', 'campaign students', 'campaign payments'],
                'primary_actions' => ['Create campaigns', 'record campaign payments', 'monitor progress'],
                'route' => '/fee-campaigns',
                'order' => 8,
                'required_roles' => ['super_admin', 'admin', 'bursar'],
            ],
            [
                'module_key' => 'attendance',
                'module_name' => 'Attendance',
                'summary' => 'Record and review student attendance according to your configured attendance mode.',
                'contains' => ['class attendance', 'legacy kiosk attendance', 'attendance summaries'],
                'primary_actions' => ['Submit registers', 'review attendance', 'monitor class attendance'],
                'route' => '/attendance',
                'order' => 9,
                'required_roles' => ['super_admin', 'admin', 'teacher'],
            ],
            [
                'module_key' => 'settings',
                'module_name' => 'Settings',
                'summary' => 'Configure school settings, billing rules, payment categories, and account options.',
                'contains' => ['fee structure', 'billing settings', 'payment categories', 'user settings'],
                'primary_actions' => ['Configure fees', 'manage settings', 'review system guardrails'],
                'route' => '/settings',
                'order' => 10,
                'required_roles' => ['super_admin', 'admin', 'bursar'],
            ],
            [
                'module_key' => 'subscription',
                'module_name' => 'Subscription',
                'summary' => 'Manage the school subscription, billing plan, and account credits.',
                'contains' => ['subscription status', 'plan options', 'credits'],
                'primary_actions' => ['Review subscription', 'manage plan', 'view account credits'],
                'route' => '/billing',
                'order' => 11,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'help',
                'module_name' => 'Help',
                'summary' => 'Find help content and guidance for using SchoolLedger.',
                'contains' => ['help topics', 'support information', 'usage guidance'],
                'primary_actions' => ['Search for help', 'learn workflows', 'contact support'],
                'route' => '/help',
                'order' => 12,
                'required_roles' => ['super_admin', 'admin', 'teacher', 'bursar'],
            ],
        ];
    }
}

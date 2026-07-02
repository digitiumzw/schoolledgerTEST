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
                'summary' => 'Your starting point — see a real-time overview of school finances, enrolment, staff, and transport at a glance.',
                'contains' => [
                    'Financial KPIs: outstanding fees, collection rate, and term revenue',
                    'Enrolment and academic summaries: student counts, classes, and bursary info',
                    'Staff overview: headcount, leave, and attendance rates',
                    'Transport summary: active routes and students using transport',
                    'Recent activity feed showing the latest payments, enrolments, and status changes',
                ],
                'primary_actions' => [
                    'Review financial and enrolment KPIs to spot areas needing attention',
                    'Use Quick Actions to add a student or record a payment without leaving the page',
                    'Click any KPI section to drill into the related module for details',
                ],
                'tips' => [
                    'If KPIs show "No active term", visit Settings → Academic Calendar to configure term dates — several metrics depend on an active term.',
                    'Use the Refresh button if figures look stale; data auto-refreshes every 30 seconds.',
                ],
                'route' => '/',
                'order' => 1,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'students',
                'module_name' => 'Students',
                'summary' => 'The central hub for managing student records — add, search, edit profiles, track finances, and monitor attendance history.',
                'contains' => [
                    'Searchable student directory with pagination and filtering',
                    'Individual student profiles with overview, finance, and history tabs',
                    'Finance tab: fee statements, payment history, charges, balance adjustments, and class/status history',
                    'Student timeline showing enrolment, transport, charges, payments, and profile changes',
                    'Bulk import via CSV for adding many students at once',
                ],
                'primary_actions' => [
                    'Click "Add Student" to create a new record, or use "Bulk Import" to upload a CSV',
                    'Open any student profile to view their fee statement, payment history, and timeline',
                    'Edit a student\'s profile — changes to personal details are preserved in profile history',
                    'Change a student\'s status (active, graduated, withdrawn) with automatic audit trail',
                ],
                'tips' => [
                    'Students must be assigned to a class before class-based fees can be generated. Use the Edit modal to assign a class.',
                    'The fee statement on the Finance tab matches the ledger balance exactly — use it as the authoritative financial summary.',
                ],
                'route' => '/students',
                'order' => 2,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'classes',
                'module_name' => 'Classes',
                'summary' => 'Create and organise classes before enrolling students and setting up class-based billing.',
                'contains' => [
                    'Class directory with name, grade level, assigned teacher, and student count',
                    'Class rosters showing all enrolled students',
                    'Academic session indicator showing the current active session',
                    'Year-end class migration and promotion tools',
                ],
                'primary_actions' => [
                    'Click "Add Class" to create a new class with a name and optional teacher assignment',
                    'Click any class to view its roster of enrolled students',
                    'Use the migration panel at year-end to promote students to the next grade',
                ],
                'tips' => [
                    'Create all your classes first — students need a class assignment for fee generation and attendance tracking.',
                    'Assigning a teacher to a class gives that teacher dashboard access to class analytics and attendance.',
                ],
                'route' => '/classes',
                'order' => 3,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'staff',
                'module_name' => 'Staff',
                'summary' => 'Manage teaching and non-teaching staff records, including employment details and department assignments.',
                'contains' => [
                    'Searchable staff directory with pagination, filtering, and sorting',
                    'Staff profiles with employment status, department, and teaching/non-teaching classification',
                    'Staff summary showing total count and breakdown by status',
                ],
                'primary_actions' => [
                    'Click "Add Staff" to create a new staff record with employee ID, name, and role',
                    'Edit staff details including department, employment status, and contact information',
                    'Use search and filters to find staff by name, department, or status',
                ],
                'tips' => [
                    'Staff must have employment_status "active" to appear in attendance reports and dashboard counts.',
                    'Teaching staff assigned to a class automatically get access to the Teacher Dashboard with class analytics.',
                ],
                'route' => '/staff',
                'order' => 4,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'staff-attendance',
                'module_name' => 'Staff Attendance',
                'summary' => 'Track daily staff check-in/check-out, automatically calculate work hours and overtime, and generate period attendance reports.',
                'contains' => [
                    'Daily attendance records with check-in/check-out times and derived status (present, late, early departure, half day)',
                    'Automatic work hours and overtime calculation based on configured working hours',
                    'Leave integration: approved leave auto-generates attendance entries for working days',
                    'Period and department reports with attendance rates, late counts, and overtime totals',
                    'Optional kiosk mode for self-service staff check-in using a kiosk code',
                ],
                'primary_actions' => [
                    'Use "Check In" and "Check Out" buttons to record staff attendance manually',
                    'View the Records tab to browse, filter, and edit individual attendance entries',
                    'Open the Reports tab to generate period or department attendance summaries',
                    'Enable kiosk mode in Settings to allow staff to self-check-in at a shared device',
                ],
                'tips' => [
                    'Working hours and overtime thresholds are configured in Settings — adjust them to match your school schedule.',
                    'Holidays set in the academic calendar are automatically excluded from working-day counts in reports.',
                    'Staff on approved leave are automatically marked and excluded from "not arrived" alerts.',
                ],
                'route' => '/s-attendance',
                'order' => 5,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'transport',
                'module_name' => 'Transport',
                'summary' => 'Set up and manage school transport — routes, stops, vehicles, drivers, and student assignments with transport charge generation.',
                'contains' => [
                    'Transport routes with assigned stops, vehicles, and drivers',
                    'Vehicle and driver management pages',
                    'Student-to-route assignments with stop selection and direction (pickup, drop-off, or both)',
                    'Monthly transport charge generation with optional proration',
                    'Driver kiosk for viewing student pickup/drop-off rosters',
                ],
                'primary_actions' => [
                    'Create routes first, then add stops, assign a vehicle and driver',
                    'Assign students to routes by selecting a stop and direction',
                    'Generate monthly transport charges from the Billing tab — charges appear on student ledgers automatically',
                ],
                'tips' => [
                    'A student can only be assigned to one active route at a time. Reassigning automatically deallocates the previous route.',
                    'Transport charges are generated per month — use the Billing tab to select a month and generate charges for all assigned students.',
                    'Enable charge proration in Settings to automatically reduce charges for students who join mid-month.',
                ],
                'route' => '/transport',
                'order' => 6,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'payments',
                'module_name' => 'Payments',
                'summary' => 'Record and manage student payments, search payment history, void transactions, and print or download receipts.',
                'contains' => [
                    'Payment recording with student lookup, amount, method, and category selection',
                    'Multi-category payments: split a single payment across multiple categories (e.g. Fees + Transport)',
                    'Searchable, paginated payment history with backend filtering and summary metrics',
                    'Receipt generation with printable PDF and student balance snapshot',
                    'Payment voiding with audit trail and receipt annotation',
                    'Billing tab for generating fee-rule charges and transport charges',
                ],
                'primary_actions' => [
                    'Click "Record Payment" to open the payment modal — search for a student, enter amount, select method and category',
                    'Use the search bar and filters to find specific payments by student, date range, or method',
                    'Click any payment row to view, print, or void its receipt',
                    'Open the Billing tab to generate fee charges for a term or transport charges for a month',
                ],
                'tips' => [
                    'General (non-ledger) payments like donations or uniform sales do not affect student balances. Use the "Split across categories" option to combine ledger and general payments in one transaction.',
                    'Voided payments are preserved with an audit trail — the original receipt is annotated as voided rather than deleted.',
                    'Fee campaigns have their own payment recording flow on the Fee Campaigns page — campaign payments are tracked separately from the main ledger.',
                ],
                'route' => '/payments',
                'order' => 7,
                'required_roles' => ['super_admin', 'admin', 'bursar'],
            ],
            [
                'module_key' => 'fee-campaigns',
                'module_name' => 'Fee Campaigns',
                'summary' => 'Run targeted fee collection campaigns — track expected amounts, record campaign-specific payments, and monitor progress separately from the main ledger.',
                'contains' => [
                    'Campaign list with status, progress bars, and summary stats (collected vs. expected)',
                    'Campaign detail page showing eligible students and their individual payment status',
                    'Campaign-specific payment recording with automatic snapshot capture',
                    'School-wide or class-scoped campaigns with automatic eligible-student resolution',
                ],
                'primary_actions' => [
                    'Click "New Campaign" to create a campaign — choose a name, scope (school-wide or specific classes), and expected amount per student',
                    'Open a campaign to see the student list, then use "Record Payment" next to any student to log a campaign payment',
                    'Monitor the progress bar and summary cards to track collection rates',
                    'Close a campaign when collection is complete to archive it',
                ],
                'tips' => [
                    'Campaign payments are recorded separately from the main ledger — they do not affect student fee balances on the Students page.',
                    'You can add or remove students from a campaign after creation using the campaign detail page.',
                ],
                'route' => '/fee-campaigns',
                'order' => 8,
                'required_roles' => ['super_admin', 'admin', 'bursar'],
            ],
            [
                'module_key' => 'attendance',
                'module_name' => 'Student Attendance',
                'summary' => 'Record and review student attendance by class. Supports per-day or per-class-session modes depending on your configuration.',
                'contains' => [
                    'Class attendance submission form — mark each student present, absent, late, or excused',
                    'Attendance summaries by class and student with attendance rate calculations',
                    'Session-level attendance for schools with multiple class sessions per day',
                    'Legacy kiosk attendance mode for simpler per-day tracking',
                ],
                'primary_actions' => [
                    'Select a class and date, then submit the attendance register for all students',
                    'Corrections are supported — submitting again for the same date cascades and updates the effective status',
                    'View class and student summaries to monitor attendance trends over time',
                ],
                'tips' => [
                    'Attendance mode (per-day or per-class-session) is configured in Settings. Switch modes if your school schedule changes.',
                    'Future dates cannot be submitted — attendance is recorded for today or past dates only.',
                    'Teachers can access this page for their assigned classes directly from the sidebar.',
                ],
                'route' => '/attendance',
                'order' => 9,
                'required_roles' => ['super_admin', 'admin', 'teacher'],
            ],
            [
                'module_key' => 'settings',
                'module_name' => 'Settings',
                'summary' => 'Configure school-wide settings — academic calendar, fee structures, billing rules, payment categories, and system preferences.',
                'contains' => [
                    'Academic calendar with term dates and holiday configuration',
                    'Fee structure and fee rules: define fee amounts by class, scope, and billing cycle',
                    'Payment categories: manage ledger and general categories (system categories are protected)',
                    'Charge proration toggle: automatically reduce charges for mid-period enrolments',
                    'Staff attendance working hours and overtime configuration',
                    'Student attendance mode selection (per-day or per-class-session)',
                ],
                'primary_actions' => [
                    'Set up the academic calendar first — term dates drive billing periods, attendance working days, and dashboard KPIs',
                    'Create fee rules on the Fee Structure tab to define recurring charges by class or school-wide scope',
                    'Review payment categories — system categories (Fees, Transport Fee) cannot be deleted but custom categories can be added',
                    'Configure working hours for staff attendance calculations',
                ],
                'tips' => [
                    'Fee rules with "school_wide" scope apply to all students; "class" scope lets you select specific classes. Multi-class selection is supported.',
                    'System payment categories (Fees, Transport + Fees, Transport Fee) are locked and cannot be renamed or deleted — they are used by the ledger balance calculation.',
                    'Enable charge proration to automatically reduce fee amounts for students who enrol partway through a billing period.',
                ],
                'route' => '/settings',
                'order' => 10,
                'required_roles' => ['super_admin', 'admin', 'bursar'],
            ],
            [
                'module_key' => 'subscription',
                'module_name' => 'Subscription',
                'summary' => 'Manage your school\'s subscription plan, view billing history, and update payment details.',
                'contains' => [
                    'Current subscription status: active plan, billing cycle, and renewal date',
                    'Plan options with pricing and student capacity limits',
                    'Account credits and payment history',
                ],
                'primary_actions' => [
                    'Review your current plan and student capacity usage',
                    'Upgrade or change your billing cycle (monthly/annual)',
                    'View payment history and download invoices',
                ],
                'tips' => [
                    'Some features are restricted until your subscription is active — check this page if you see subscription-related errors.',
                    'Annual plans offer cost savings — compare options before renewing.',
                ],
                'route' => '/billing',
                'order' => 11,
                'required_roles' => ['super_admin', 'admin'],
            ],
            [
                'module_key' => 'help',
                'module_name' => 'Help & Support',
                'summary' => 'Find answers to common questions, learn key workflows, and contact support if you need assistance.',
                'contains' => [
                    'Searchable help topics covering common tasks and troubleshooting',
                    'Step-by-step workflow guides for billing, attendance, and student management',
                    'Support contact information for reaching the SchoolLedger team',
                ],
                'primary_actions' => [
                    'Search for a keyword to find relevant help articles',
                    'Browse workflow guides to learn how to complete common tasks end-to-end',
                    'Use the support contact link if you cannot find what you need',
                ],
                'tips' => [
                    'You can restart this tutorial at any time from the sidebar — look for the "Restart Tutorial" option.',
                    'The setup guide on the Dashboard highlights recommended first steps after onboarding.',
                ],
                'route' => '/help',
                'order' => 12,
                'required_roles' => ['super_admin', 'admin', 'teacher', 'bursar'],
            ],
        ];
    }
}

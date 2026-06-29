<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;
use App\Services\ChargeBatchRollbackService;
use App\Services\ChargeProrationHelper;
use App\Services\TransportAssignmentService;
use App\Services\AcademicSessionService;

/**
 * TransportController
 *
 * Handles all transport management:
 *  - Admin: route CRUD, student assignment, monthly charge generation, reports
 *  - Driver: view assigned routes and student rosters
 */
class TransportController extends BaseApiController
{
    protected $db;
    protected TransportAssignmentService $assignmentService;
    protected AcademicSessionService $sessionService;

    public function __construct()
    {
        $this->db               = Config::connect();
        $this->assignmentService = new TransportAssignmentService($this->db);
        $this->sessionService    = new AcademicSessionService();
    }

    // =========================================================================
    // ROUTES – ADMIN CRUD
    // =========================================================================

    /** GET /transport/routes */
    public function getRoutes()
    {
        $tenantId = $this->getTenantId();
        $search = trim((string) ($this->request->getGet('search') ?? ''));

        $pagination = $this->normalisePaginationParams(50, 200);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $allowedSortFields = ['routeName', 'monthlyFee', 'status', 'createdAt'];
        $sort = $this->normaliseSortParams($allowedSortFields, 'routeName', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $sortColumnMap = [
            'routeName'   => 'route_name',
            'monthlyFee'  => 'monthly_fee',
            'status'      => 'status',
            'createdAt'   => 'created_at',
        ];

        $routesBuilder = $this->db->table('transport_routes')
            ->where('tenant_id', $tenantId);

        if ($search !== '') {
            $routesBuilder->like('route_name', $search);
        }

        $total = (int) $routesBuilder->countAllResults(false);

        $orderColumn = $sortColumnMap[$sort['sortBy']] ?? 'route_name';
        $routes = $routesBuilder
            ->orderBy($orderColumn, strtoupper($sort['sortOrder']))
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        if (empty($routes)) {
            return $this->success([
                'data'       => [],
                'pagination' => $this->buildPaginationMeta(0, $pagination['page'], $pagination['limit']),
            ]);
        }

        $routeIds = array_column($routes, 'id');

        // Stops per route
        $escapedIds  = implode("','", array_map([$this->db, 'escapeString'], $routeIds));
        $allStops = $this->db->query("
            SELECT * FROM transport_stops
            WHERE route_id IN ('$escapedIds') AND tenant_id = ?
            ORDER BY route_id, order_position
        ", [$tenantId])->getResultArray();

        $stopsByRoute = [];
        foreach ($allStops as $stop) {
            $stopsByRoute[$stop['route_id']][] = $this->formatStop($stop);
        }

        // Current active period (vehicle + driver) per route
        $periods = $this->db->query("
            SELECT rp.route_id, rp.id AS period_id,
                   v.id AS vehicle_id, v.name AS vehicle_name, v.reg_number, v.type AS vehicle_type, v.capacity,
                   d.id AS driver_id, d.name AS driver_name, d.phone AS driver_phone
            FROM transport_route_periods rp
            JOIN transport_vehicles v ON v.id = rp.vehicle_id
            LEFT JOIN transport_drivers d ON d.id = rp.driver_id
            WHERE rp.route_id IN ('$escapedIds') AND rp.tenant_id = ? AND rp.status = 'active'
            ORDER BY rp.created_at DESC
        ", [$tenantId])->getResultArray();

        $periodByRoute = [];
        foreach ($periods as $p) {
            if (!isset($periodByRoute[$p['route_id']])) {
                $periodByRoute[$p['route_id']] = $p;
            }
        }

        // Active allocations per route (new table)
        $allStudents = $this->db->query("
            SELECT tsa.route_id, tsa.id AS allocation_id, tsa.student_id,
                   tsa.stop_id, tsa.direction,
                   ts.name AS stop_name,
                   s.first_name, s.last_name, c.name AS class_name
            FROM transport_student_allocations tsa
            JOIN students s ON s.id = tsa.student_id
            LEFT JOIN classes c ON c.id = s.class_id
            LEFT JOIN transport_stops ts ON ts.id = tsa.stop_id
            WHERE tsa.route_id IN ('$escapedIds')
              AND tsa.tenant_id = ?
              AND tsa.status = 'active'
              AND s.status = 'active'
        ", [$tenantId])->getResultArray();

        $studentsByRoute = [];
        foreach ($allStudents as $s) {
            $studentsByRoute[$s['route_id']][] = $this->formatAllocationStudent($s);
        }

        $formatted = array_map(function ($r) use ($stopsByRoute, $periodByRoute, $studentsByRoute) {
            return $this->formatRoute(
                $r,
                $stopsByRoute[$r['id']] ?? [],
                $periodByRoute[$r['id']] ?? null,
                $studentsByRoute[$r['id']] ?? []
            );
        }, $routes);

        return $this->success([
            'data'       => $formatted,
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
        ]);
    }

    /** GET /transport/routes/:id */
    public function getRoute($id = null)
    {
        $tenantId = $this->getTenantId();

        $route = $this->db->table('transport_routes')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        $stops = $this->db->table('transport_stops')
            ->where('route_id', $id)->where('tenant_id', $tenantId)
            ->orderBy('order_position')
            ->get()->getResultArray();

        $period = $this->db->query("
            SELECT rp.*, v.name AS vehicle_name, v.reg_number, v.type AS vehicle_type, v.capacity,
                   d.name AS driver_name, d.phone AS driver_phone
            FROM transport_route_periods rp
            JOIN transport_vehicles v ON v.id = rp.vehicle_id
            LEFT JOIN transport_drivers d ON d.id = rp.driver_id
            WHERE rp.route_id = ? AND rp.tenant_id = ? AND rp.status = 'active'
            ORDER BY rp.created_at DESC LIMIT 1
        ", [$id, $tenantId])->getRowArray();

        $students = $this->db->query("
            SELECT tsa.id AS allocation_id, tsa.student_id,
                   tsa.stop_id, tsa.direction,
                   ts.name AS stop_name,
                   s.first_name, s.last_name, c.name AS class_name
            FROM transport_student_allocations tsa
            JOIN students s ON s.id = tsa.student_id
            LEFT JOIN classes c ON c.id = s.class_id
            LEFT JOIN transport_stops ts ON ts.id = tsa.stop_id
            WHERE tsa.route_id = ? AND tsa.tenant_id = ?
              AND tsa.status = 'active' AND s.status = 'active'
        ", [$id, $tenantId])->getResultArray();

        // ── Feature 087: Attach ledger balances ──
        $studentIds = array_column($students, 'student_id');
        $balanceMap = [];
        try {
            $ledgerService = new \App\Services\LedgerService($this->db);
            $balanceMap = $ledgerService->getBalancesForStudentIds($studentIds, $tenantId);
        } catch (\Throwable $e) {
            log_message('error', '[TransportController::getRoute] LedgerService error: ' . $e->getMessage());
        }

        $formattedStudents = array_map(function (array $s) use ($balanceMap): array {
            $student = $this->formatAllocationStudent($s);
            $student['balance'] = $balanceMap[$s['student_id']]['balance'] ?? null;
            return $student;
        }, $students);

        $studentsWithBalance = 0;
        $totalOutstandingBalance = 0.0;
        foreach ($formattedStudents as $s) {
            if ($s['balance'] !== null && $s['balance'] > 0) {
                $studentsWithBalance++;
                $totalOutstandingBalance += $s['balance'];
            }
        }
        $balanceSummary = [
            'totalStudents'           => count($formattedStudents),
            'studentsWithBalance'       => $studentsWithBalance,
            'totalOutstandingBalance'   => $totalOutstandingBalance,
        ];

        $result = $this->formatRoute(
            $route,
            array_map([$this, 'formatStop'], $stops),
            $period,
            $formattedStudents
        );
        $result['balanceSummary'] = $balanceSummary;

        return $this->success($result);
    }

    /**
     * GET /transport/routes/:id/students
     *
     * Returns paginated students assigned to a route with their ledger balances.
     * Supports pagination, sorting, and search by student name.
     */
    public function getRouteStudents($routeId = null)
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();

        // Verify route belongs to tenant
        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        $pagination = $this->normalisePaginationParams(20, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }
        $page = $pagination['page'];
        $limit = $pagination['limit'];
        $offset = $pagination['offset'];

        $search = trim((string) ($this->request->getGet('search') ?? ''));

        $allowedSortFields = ['name', 'class', 'balance'];
        $sort = $this->normaliseSortParams($allowedSortFields, 'name', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }
        $sortField = $sort['sortBy'];
        $sortOrder = $sort['sortOrder'];

        // Map frontend sort fields to database columns
        $sortColumnMap = [
            'name'    => 's.last_name',
            'class'   => 'c.name',
            'balance' => 'balance',
        ];
        $orderBy = $sortColumnMap[$sortField] ?? 's.last_name';

        // Build base query for counting and fetching
        $baseQuery = $this->db->table('transport_student_allocations tsa')
            ->where('tsa.route_id', $routeId)
            ->where('tsa.tenant_id', $tenantId)
            ->where('tsa.status', 'active')
            ->join('students s', 's.id = tsa.student_id')
            ->where('s.status', 'active')
            ->join('classes c', 'c.id = s.class_id', 'left')
            ->join('transport_stops ts', 'ts.id = tsa.stop_id', 'left');

        // Apply search filter
        if ($search !== '') {
            $baseQuery->groupStart()
                ->like('s.first_name', $search)
                ->orLike('s.last_name', $search)
                ->orLike('CONCAT(s.first_name, " ", s.last_name)', $search)
                ->groupEnd();
        }

        // Get total count
        $total = $baseQuery->countAllResults(false);

        // Fetch students with pagination
        $students = $baseQuery
            ->select('tsa.id AS allocation_id, tsa.student_id, tsa.stop_id, tsa.direction,
                      ts.name AS stop_name, s.first_name, s.last_name, c.name AS class_name')
            ->orderBy($orderBy, $sortOrder)
            ->limit($limit, $offset)
            ->get()->getResultArray();

        // Get ledger balances
        $studentIds = array_column($students, 'student_id');
        $balanceMap = [];
        if (!empty($studentIds)) {
            try {
                $ledgerService = new \App\Services\LedgerService($this->db);
                $balanceMap = $ledgerService->getBalancesForStudentIds($studentIds, $tenantId);
            } catch (\Throwable $e) {
                log_message('error', '[TransportController::getRouteStudents] LedgerService error: ' . $e->getMessage());
            }
        }

        // Format students with balances
        $formattedStudents = array_map(function (array $s) use ($balanceMap): array {
            $student = $this->formatAllocationStudent($s);
            $student['balance'] = $balanceMap[$s['student_id']]['balance'] ?? null;
            return $student;
        }, $students);

        return $this->success([
            'data'       => $formattedStudents,
            'pagination' => $this->buildPaginationMeta($total, $page, $limit),
        ]);
    }

    /**
     * GET /transport/routes/:id/pdf
     *
     * Generates and streams a professional PDF report for a route.
     * Accepts optional query param: includeBalances=1 to embed ledger balances.
     * The PDF is generated in-memory via Dompdf and never persisted to disk.
     */
    public function downloadRoutePdf($routeId = null)
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();

        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        $includeBalances = filter_var(
            $this->request->getGet('includeBalances'),
            FILTER_VALIDATE_BOOLEAN
        );

        // ── Tenant settings (school name) ──────────────────────────────────────
        $tenant   = $this->db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        $settings = !empty($tenant['settings']) ? (json_decode($tenant['settings'], true) ?? []) : [];
        $schoolName = $settings['schoolName'] ?? 'School Management System';

        // ── Stops ──────────────────────────────────────────────────────────────
        $stopsRaw = $this->db->table('transport_stops')
            ->where('route_id', $routeId)
            ->where('tenant_id', $tenantId)
            ->orderBy('order_position')
            ->get()->getResultArray();
        $stops = array_map([$this, 'formatStop'], $stopsRaw);

        // ── Active period (vehicle + driver) ───────────────────────────────────
        $period = $this->db->query("
            SELECT rp.*, v.name AS vehicle_name, v.reg_number, v.type AS vehicle_type, v.capacity,
                   d.name AS driver_name, d.phone AS driver_phone
            FROM transport_route_periods rp
            JOIN transport_vehicles v ON v.id = rp.vehicle_id
            LEFT JOIN transport_drivers d ON d.id = rp.driver_id
            WHERE rp.route_id = ? AND rp.tenant_id = ? AND rp.status = 'active'
            ORDER BY rp.created_at DESC LIMIT 1
        ", [$routeId, $tenantId])->getRowArray();

        // ── All active students (no pagination) ────────────────────────────────
        $studentsRaw = $this->db->query("
            SELECT tsa.id AS allocation_id, tsa.student_id,
                   tsa.stop_id, tsa.direction,
                   ts.name AS stop_name,
                   s.first_name, s.last_name, c.name AS class_name
            FROM transport_student_allocations tsa
            JOIN students s ON s.id = tsa.student_id
            LEFT JOIN classes c ON c.id = s.class_id
            LEFT JOIN transport_stops ts ON ts.id = tsa.stop_id
            WHERE tsa.route_id = ? AND tsa.tenant_id = ?
              AND tsa.status = 'active' AND s.status = 'active'
            ORDER BY s.last_name, s.first_name
        ", [$routeId, $tenantId])->getResultArray();

        // ── Ledger balances ────────────────────────────────────────────────────
        $balanceMap = [];
        if ($includeBalances && !empty($studentsRaw)) {
            try {
                $studentIds   = array_column($studentsRaw, 'student_id');
                $ledgerService = new \App\Services\LedgerService($this->db);
                $balanceMap   = $ledgerService->getBalancesForStudentIds($studentIds, $tenantId);
            } catch (\Throwable $e) {
                log_message('error', '[TransportController::downloadRoutePdf] LedgerService error: ' . $e->getMessage());
            }
        }

        $students = array_map(function (array $s) use ($balanceMap, $includeBalances): array {
            $student = $this->formatAllocationStudent($s);
            $student['balance'] = $includeBalances ? ($balanceMap[$s['student_id']]['balance'] ?? null) : null;
            return $student;
        }, $studentsRaw);

        // ── Balance summary ────────────────────────────────────────────────────
        $studentsWithBalance  = 0;
        $totalOutstanding     = 0.0;
        if ($includeBalances) {
            foreach ($students as $s) {
                if ($s['balance'] !== null && $s['balance'] > 0) {
                    $studentsWithBalance++;
                    $totalOutstanding += (float) $s['balance'];
                }
            }
        }

        // ── Logo (base64 for Dompdf local embedding) ───────────────────────────
        $logoDataUri = null;
        $logoPath    = FCPATH . 'assets/logo.jpg';
        if (is_file($logoPath)) {
            $logoDataUri = 'data:image/jpeg;base64,' . base64_encode(file_get_contents($logoPath));
        }

        // ── Render HTML ────────────────────────────────────────────────────────
        $html = view('transport/route_report', [
            'schoolName'          => $schoolName,
            'route'               => $route,
            'stops'               => $stops,
            'period'              => $period ?: null,
            'students'            => $students,
            'includeBalances'     => $includeBalances,
            'studentsWithBalance' => $studentsWithBalance,
            'totalOutstanding'    => $totalOutstanding,
            'generatedAt'         => date('d M Y, H:i'),
            'logoDataUri'         => $logoDataUri,
        ], ['saveData' => false]);

        // ── Generate PDF in-memory via Dompdf ──────────────────────────────────
        $options = new \Dompdf\Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new \Dompdf\Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $pdfBytes = $dompdf->output();

        $schoolSlug = preg_replace('/[^a-zA-Z0-9 _-]/', '', trim($schoolName) ?: 'School');
        $routeSlug  = preg_replace('/[^a-zA-Z0-9 _-]/', '', trim($route['route_name'] ?? 'Route'));
        $fileName   = $schoolSlug . ' - ' . $routeSlug . ' - ' . date('d-m-Y') . '.pdf';

        return $this->response
            ->setHeader('Content-Type', 'application/pdf')
            ->setHeader('Content-Disposition', 'attachment; filename="' . $fileName . '"')
            ->setHeader('Content-Length', (string) strlen($pdfBytes))
            ->setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
            ->setBody($pdfBytes);
    }

    /** POST /transport/routes */
    public function createRoute()
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        if ($err = $this->requireFields($body, ['routeName', 'monthlyFee'])) {
            return $err;
        }

        $id  = $this->generateId('route_');
        $now = date('Y-m-d H:i:s');

        $this->db->table('transport_routes')->insert([
            'id'          => $id,
            'tenant_id'   => $tenantId,
            'route_name'  => $this->sanitiseString($body['routeName']),
            'monthly_fee' => (float) ($body['monthlyFee'] ?? 0),
            'status'      => 'active',
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);

        // Automatically create a default "None" stop for the route
        $stopId = $this->generateId('stop_');
        $this->db->table('transport_stops')->insert([
            'id'            => $stopId,
            'tenant_id'     => $tenantId,
            'route_id'      => $id,
            'name'          => 'None',
            'pickup_time'   => null,
            'order_position'=> 0,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);

        $route = $this->db->table('transport_routes')->where('id', $id)->get()->getRowArray();
        $defaultStop = $this->db->table('transport_stops')->where('id', $stopId)->get()->getRowArray();
        return $this->created($this->formatRoute($route, [$this->formatStop($defaultStop)], null, []), 'Route created successfully');
    }

    /** PUT /transport/routes/:id */
    public function updateRoute($id = null)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        $route = $this->db->table('transport_routes')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        $update = ['updated_at' => date('Y-m-d H:i:s')];

        if (isset($body['routeName']))  $update['route_name']  = $this->sanitiseString($body['routeName']);
        if (isset($body['monthlyFee'])) $update['monthly_fee'] = (float) $body['monthlyFee'];
        if (isset($body['status']) && in_array($body['status'], ['active', 'inactive'])) {
            $update['status'] = $body['status'];
        }

        $this->db->table('transport_routes')->where('id', $id)->update($update);

        $updated = $this->db->table('transport_routes')->where('id', $id)->get()->getRowArray();
        return $this->success($this->formatRoute($updated, [], null, []), 'Route updated successfully');
    }

    /** DELETE /transport/routes/:id */
    public function deleteRoute($id = null)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();

        $route = $this->db->table('transport_routes')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        $now = date('Y-m-d H:i:s');

        // Deactivate allocations
        $this->db->table('transport_student_allocations')
            ->where('route_id', $id)->where('tenant_id', $tenantId)
            ->update(['status' => 'inactive', 'updated_at' => $now]);

        // Deactivate route periods
        $this->db->table('transport_route_periods')
            ->where('route_id', $id)->where('tenant_id', $tenantId)
            ->update(['status' => 'inactive', 'updated_at' => $now]);

        $this->db->table('transport_routes')->where('id', $id)->delete();

        return $this->success(null, 'Route deleted successfully');
    }

    // =========================================================================
    // MONTHLY CHARGE GENERATION
    // =========================================================================

    /**
     * POST /transport/generate-charges
     * Body: { month: "YYYY-MM" }
     *
     * Creates a transport charge in the `charges` table for every student
     * who has an active assignment during the requested month.
     * Idempotent: skips if a charge already exists for that student+month.
     */
    public function generateMonthlyCharges()
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();
        $month    = $body['month'] ?? date('Y-m');   // e.g. "2026-03"

        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            return $this->error('Invalid month format (expected YYYY-MM)', 400);
        }

        $monthStart = $month . '-01';
        $monthEnd   = date('Y-m-t', strtotime($monthStart)); // last day of month

        $tenant           = $this->db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        $tenantSettings   = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        $calendarData     = json_decode($tenant['academic_calendar'] ?? '{}', true) ?? [];
        $prorationEnabled = (bool) ($tenantSettings['chargeProrationEnabled'] ?? false);
        $batchService     = new ChargeBatchRollbackService($this->db);
        $labels           = $batchService->buildTransportLabels($month, $calendarData);

        // Find all active allocations that overlap with the target month
        $assignments = $this->db->table('transport_student_allocations ta')
            ->select('ta.id, ta.student_id, ta.route_id, ta.start_date,
                      r.monthly_fee, r.route_name')
            ->join('transport_routes r', 'r.id = ta.route_id')
            ->join('students s', 's.id = ta.student_id')
            ->where('ta.tenant_id', $tenantId)
            ->where('ta.status', 'active')
            ->where('s.status', 'active')
            ->where('ta.start_date <=', $monthEnd)
            ->groupStart()
                ->where('ta.end_date IS NULL')
                ->orWhere('ta.end_date >=', $monthStart)
            ->groupEnd()
            ->get()->getResultArray();

        $created  = 0;
        $skipped  = 0;
        $totalAmount = 0.0;
        $chargedStudents = [];
        $now      = date('Y-m-d H:i:s');
        $dueDate  = $month . '-05'; // due on 5th of the month

        $this->db->transStart();
        $billingRunId = $batchService->createBillingRun(
            $tenantId,
            ChargeBatchRollbackService::TRANSPORT_CHARGE_TYPE,
            $labels['periodKey'],
            $labels['periodLabel'],
            $labels['descriptionLabel'],
            $labels['termId'] ?? null,
            $labels['academicYear'] ?? substr($month, 0, 4),
            $this->getCurrentUser()->userId ?? null,
            'trun_'
        );

        foreach ($assignments as $a) {
            // Idempotency: check if charge already exists
            $exists = $this->db->table('charges')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $a['student_id'])
                ->where('charge_type', 'transport')
                ->where('academic_session', $month)
                ->where('deleted_at', null)
                ->where('voided_at', null)
                ->get()->getRowArray();

            if ($exists) { $skipped++; continue; }

            $proration   = $prorationEnabled
                ? ChargeProrationHelper::calculate((float) $a['monthly_fee'], $monthStart, $monthEnd, $a['start_date'] ?? null)
                : ['amount' => (float) $a['monthly_fee'], 'wasProrated' => false, 'remainingDays' => 0, 'totalDays' => 0];

            $routeName   = $a['route_name'] ?? 'Transport';
            $periodLabel = date('F Y', strtotime($monthStart));  // e.g. "May 2026"
            $description = sprintf('%s – %s (due %s)', $routeName, $periodLabel, $dueDate);
            if ($proration['wasProrated']) {
                $description .= sprintf(' – prorated %d/%d days', $proration['remainingDays'], $proration['totalDays']);
            }

            $this->db->table('charges')->insert([
                'id'                  => $this->generateId('chg_'),
                'tenant_id'           => $tenantId,
                'student_id'          => $a['student_id'],
                'charge_type'         => 'transport',
                'category'            => 'Transport Fee',
                'amount'              => $proration['amount'],
                'date_generated'      => $monthStart,
                'description'         => $description,
                'academic_session'    => $month,
                'term'                => 'Transport charge',
                'billing_run_id'      => $billingRunId,
                'academic_year'       => $labels['academicYear'] ?? substr($month, 0, 4),
                'due_date'            => $dueDate,
                'status'              => 'pending',
                'route_id'            => $a['route_id'],
                'term_id'             => $labels['termId'] ?? null,
                'created_at'          => $now,
                'updated_at'          => $now,
            ]);
            $created++;
            $chargedStudents[$a['student_id']] = true;
            $totalAmount += (float) $proration['amount'];
        }

        if ($created > 0) {
            $batchService->updateBillingRunTotals(
                $tenantId,
                $billingRunId,
                $created,
                count($chargedStudents),
                round($totalAmount, 2)
            );
        } else {
            $this->db->table('billing_runs')
                ->where('tenant_id', $tenantId)
                ->where('id', $billingRunId)
                ->delete();
            $billingRunId = null;
        }

        $this->db->transComplete();
        if ($this->db->transStatus() === false) {
            return $this->serverError('Failed to generate transport charges');
        }

        return $this->success(
            [
                'created' => $created,
                'skipped' => $skipped,
                'month' => $month,
                'batchId' => $billingRunId,
                'descriptionLabel' => $labels['descriptionLabel'],
                'totalAmount' => round($totalAmount, 2),
            ],
            "Transport charges generated: {$created} created, {$skipped} already existed"
        );
    }

    /**
     * POST /transport/generate-student-charge
     * Body: { studentId: string, month?: "YYYY-MM" }
     *
     * Creates a single transport charge for a specific student if they have
     * an active transport assignment and no charge exists for the month.
     * Used when recording transport payments to ensure balance accuracy.
     */
    public function generateStudentCharge()
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();
        $body = $this->getRequestBody();

        $studentId = $body['studentId'] ?? null;
        if (!$studentId) {
            return $this->error('studentId is required', 400);
        }

        $month = $body['month'] ?? date('Y-m');
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            return $this->error('Invalid month format (expected YYYY-MM)', 400);
        }

        $monthStart = $month . '-01';
        $monthEnd = date('Y-m-t', strtotime($monthStart));

        // Verify student has active transport assignment
        $allocation = $this->db->table('transport_student_allocations ta')
            ->select('ta.id, ta.student_id, ta.route_id, ta.start_date, r.monthly_fee, r.route_name')
            ->join('transport_routes r', 'r.id = ta.route_id')
            ->join('students s', 's.id = ta.student_id')
            ->where('ta.tenant_id', $tenantId)
            ->where('ta.student_id', $studentId)
            ->where('ta.status', 'active')
            ->where('s.status', 'active')
            ->where('ta.start_date <=', $monthEnd)
            ->groupStart()
                ->where('ta.end_date IS NULL')
                ->orWhere('ta.end_date >=', $monthStart)
            ->groupEnd()
            ->get()->getRowArray();

        if (!$allocation) {
            return $this->error('Student has no active transport assignment for this month', 404);
        }

        // Check if charge already exists
        $existing = $this->db->table('charges')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('charge_type', 'transport')
            ->where('academic_session', $month)
            ->where('deleted_at', null)
            ->where('voided_at', null)
            ->get()->getRowArray();

        if ($existing) {
            return $this->success([
                'chargeId' => $existing['id'],
                'amount' => (float) $existing['amount'],
                'status' => 'exists',
                'message' => 'Charge already exists for this student and month',
            ], 'Charge already exists');
        }

        $tenant = $this->db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        $tenantSettings = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        $calendarData = json_decode($tenant['academic_calendar'] ?? '{}', true) ?? [];
        $prorationEnabled = (bool) ($tenantSettings['chargeProrationEnabled'] ?? false);

        $batchService = new ChargeBatchRollbackService($this->db);
        $labels = $batchService->buildTransportLabels($month, $calendarData);

        // Calculate prorated amount if enabled
        $monthlyFee = (float) $allocation['monthly_fee'];
        $proration = $prorationEnabled
            ? ChargeProrationHelper::calculate($monthlyFee, $monthStart, $monthEnd, $allocation['start_date'] ?? null)
            : ['amount' => $monthlyFee, 'wasProrated' => false, 'remainingDays' => 0, 'totalDays' => 0];

        $routeName = $allocation['route_name'] ?? 'Transport';
        $periodLabel = date('F Y', strtotime($monthStart));
        $dueDate = $month . '-05';
        $description = sprintf('%s – %s (due %s)', $routeName, $periodLabel, $dueDate);
        if ($proration['wasProrated']) {
            $description .= sprintf(' – prorated %d/%d days', $proration['remainingDays'], $proration['totalDays']);
        }

        $now = date('Y-m-d H:i:s');
        $chargeId = $this->generateId('chg_');

        $this->db->table('charges')->insert([
            'id' => $chargeId,
            'tenant_id' => $tenantId,
            'student_id' => $studentId,
            'charge_type' => 'transport',
            'category' => 'Transport Fee',
            'amount' => $proration['amount'],
            'date_generated' => $monthStart,
            'description' => $description,
            'academic_session' => $month,
            'term' => 'Transport charge',
            'academic_year' => $labels['academicYear'] ?? substr($month, 0, 4),
            'due_date' => $dueDate,
            'status' => 'pending',
            'route_id' => $allocation['route_id'],
            'term_id' => $labels['termId'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return $this->success([
            'chargeId' => $chargeId,
            'amount' => round($proration['amount'], 2),
            'wasProrated' => $proration['wasProrated'],
            'routeId' => $allocation['route_id'],
            'routeName' => $routeName,
            'status' => 'created',
        ], 'Transport charge created successfully');
    }

    public function latestChargeBatch()
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();
        $service = new ChargeBatchRollbackService($this->db);
        $batch = $service->getLatestBatch($tenantId, ChargeBatchRollbackService::TRANSPORT_CHARGE_TYPE);

        if (!$batch) {
            return $this->notFound('No active transport charge batch exists');
        }

        return $this->success($batch, 'Latest transport charge batch retrieved');
    }

    public function voidLatestChargeBatch()
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();
        $body = $this->getRequestBody();
        $service = new ChargeBatchRollbackService($this->db);

        try {
            $result = $service->voidLatestBatch(
                $tenantId,
                ChargeBatchRollbackService::TRANSPORT_CHARGE_TYPE,
                $this->getCurrentUser()->userId ?? null,
                $body['reason'] ?? null
            );
        } catch (\RuntimeException $e) {
            if ($e->getMessage() === 'NO_ACTIVE_BATCH') {
                return $this->notFound('No active transport charge batch exists');
            }
            if ($e->getMessage() === 'BATCH_CHANGED') {
                return $this->error('Latest transport charge batch was already voided or changed', 409);
            }
            throw $e;
        } catch (\Throwable $e) {
            log_message('error', 'TransportController::voidLatestChargeBatch failed: ' . $e->getMessage());
            return $this->serverError('Failed to void latest transport charge batch');
        }

        return $this->success($result, 'Latest transport charge batch voided');
    }

    // =========================================================================
    // DRIVER ENDPOINTS
    // =========================================================================

    /** GET /transport/driver/routes – driver sees their own routes */
    public function getDriverRoutes()
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'driver')) return $err;

        $tenantId = $this->getTenantId();

        $routes = $this->db->table('transport_routes')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->orderBy('route_name')
            ->get()->getResultArray();

        $formatted = array_map(function ($r) {
            return $this->formatRoute($r, [], null, []);
        }, $routes);

        return $this->success($formatted);
    }

    /** GET /transport/driver/routes/:id/roster – driver sees the student list */
    public function getDriverRoster($routeId = null)
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'driver')) return $err;

        $tenantId = $this->getTenantId();

        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) return $this->notFound('Route not found');

        $students = $this->db->query("
            SELECT tsa.student_id, tsa.start_date,
                   ts.name AS stop_name,
                   s.first_name, s.last_name, c.name AS class_name, s.phone AS student_phone
            FROM transport_student_allocations tsa
            JOIN students s ON s.id = tsa.student_id
            LEFT JOIN classes c ON c.id = s.class_id
            LEFT JOIN transport_stops ts ON ts.id = tsa.stop_id
            WHERE tsa.route_id = ? AND tsa.tenant_id = ?
              AND tsa.status = 'active' AND s.status = 'active'
            ORDER BY s.last_name
        ", [$routeId, $tenantId])->getResultArray();

        $roster = array_map(function ($s) {
            return [
                'studentId'   => $s['student_id'],
                'studentName' => trim(($s['first_name'] ?? '') . ' ' . ($s['last_name'] ?? '')),
                'studentClass'=> $s['class_name'] ?? '',
                'stopName'    => $s['stop_name'],
                'startDate'   => $s['start_date'],
                'phone'       => $s['student_phone'],
            ];
        }, $students);

        return $this->success([
            'route'  => $this->formatRoute($route, [], null, []),
            'roster' => $roster,
            'total'  => count($roster),
        ]);
    }

    // =========================================================================
    // PAYMENT STATUS
    // =========================================================================

    /**
     * GET /transport/routes/:routeId/payment-status?month=YYYY-MM
     *
     * Returns transport payment status for each student assigned to a route.
     * Three states: paid | unpaid | no_charge
     *
     * Uses a single LEFT JOIN subquery to avoid N+1 queries (Constitution Principle V).
     */
    public function getRoutePaymentStatus($routeId = null)
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();
        $month    = $this->request->getGet('month') ?? date('Y-m');

        // Validate month format YYYY-MM
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            return $this->error('month must be in YYYY-MM format', 400);
        }

        // Verify route belongs to tenant
        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        // Single query: allocations → charges (LEFT) → payments subquery (LEFT)
        // Payments are matched by student_id + route_id + month since the payments
        // table has no charge_id column.
        $rows = $this->db->query(
            "SELECT
                ta.student_id,
                ch.id        AS charge_id,
                ch.amount    AS charge_amount,
                p.paid_total
             FROM transport_student_allocations ta
             LEFT JOIN charges ch ON
                ch.student_id        = ta.student_id
                AND ch.route_id      = ta.route_id
                AND ch.charge_type   = 'transport'
                AND ch.academic_session = ?
                AND ch.tenant_id     = ?
             LEFT JOIN (
                SELECT student_id, route_id, SUM(amount) AS paid_total
                FROM payments
                WHERE tenant_id = ?
                  AND category = 'Transport Fee'
                  AND DATE_FORMAT(date, '%Y-%m') = ?
                GROUP BY student_id, route_id
             ) p ON p.student_id = ta.student_id AND p.route_id = ta.route_id
             WHERE ta.route_id  = ?
               AND ta.tenant_id = ?
               AND ta.status    = 'active'",
            [$month, $tenantId, $tenantId, $month, $routeId, $tenantId]
        )->getResultArray();

        $students = array_map(function ($r) {
            if ($r['charge_id'] === null) {
                $status = 'no_charge';
            } elseif ((float) ($r['paid_total'] ?? 0) >= (float) $r['charge_amount']) {
                $status = 'paid';
            } else {
                $status = 'unpaid';
            }

            return [
                'studentId'     => $r['student_id'],
                'paymentStatus' => $status,
            ];
        }, $rows);

        return $this->success([
            'routeId'  => $routeId,
            'month'    => $month,
            'students' => $students,
        ]);
    }

    // =========================================================================
    // REPORTS
    // =========================================================================

    /**
     * GET /transport/reports
     * Query params: type = students_per_route | revenue | payment_status | driver_assignments
     */
    public function getReport()
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();
        $type     = $this->request->getGet('type') ?? 'students_per_route';
        $month    = $this->request->getGet('month') ?? date('Y-m');

        switch ($type) {
            case 'students_per_route':
                return $this->reportStudentsPerRoute($tenantId);
            case 'revenue':
                return $this->reportRevenue($tenantId, $month);
            case 'payment_status':
                return $this->reportPaymentStatus($tenantId, $month);
            case 'driver_assignments':
                return $this->reportDriverAssignments($tenantId);
            default:
                return $this->error('Unknown report type', 400);
        }
    }

    private function reportStudentsPerRoute(string $tenantId)
    {
        $rows = $this->db->query("
            SELECT r.id, r.route_name, r.monthly_fee, r.status,
                   v.name AS vehicle_name, d.name AS driver_name,
                   COUNT(tsa.id) AS student_count
            FROM transport_routes r
            LEFT JOIN transport_route_periods rp
                ON rp.route_id = r.id AND rp.status = 'active' AND rp.tenant_id = ?
            LEFT JOIN transport_vehicles v ON v.id = rp.vehicle_id
            LEFT JOIN transport_drivers d ON d.id = rp.driver_id
            LEFT JOIN transport_student_allocations tsa
                ON tsa.route_id = r.id AND tsa.status = 'active' AND tsa.tenant_id = ?
            WHERE r.tenant_id = ?
            GROUP BY r.id, v.name, d.name
            ORDER BY r.route_name
        ", [$tenantId, $tenantId, $tenantId])->getResultArray();

        $data = array_map(fn($r) => [
            'routeId'      => $r['id'],
            'routeName'    => $r['route_name'],
            'vehicle'      => $r['vehicle_name'],
            'driverName'   => $r['driver_name'],
            'monthlyFee'   => (float) $r['monthly_fee'],
            'status'       => $r['status'],
            'studentCount' => (int) $r['student_count'],
        ], $rows);

        return $this->success($data);
    }

    private function reportRevenue(string $tenantId, string $month)
    {
        $monthStart = $month . '-01';

        $rows = $this->db->table('transport_routes r')
            ->select('r.id, r.route_name, r.monthly_fee,
                      COUNT(ta.id) AS active_students,
                      COUNT(ta.id) * r.monthly_fee AS expected_revenue,
                      SUM(CASE WHEN c.status = "paid" THEN c.amount ELSE 0 END) AS collected_revenue')
            ->join('transport_student_allocations ta',
                   'ta.route_id = r.id AND ta.status = "active" AND ta.tenant_id = r.tenant_id', 'left')
            ->join('charges c',
                   'c.student_id = ta.student_id AND c.route_id = r.id
                    AND c.charge_type = "transport" AND c.academic_session = "' . $this->db->escapeString($month) . '"',
                   'left')
            ->where('r.tenant_id', $tenantId)
            ->where('r.status', 'active')
            ->groupBy('r.id')
            ->get()->getResultArray();

        $data = array_map(fn($r) => [
            'routeId'           => $r['id'],
            'routeName'         => $r['route_name'],
            'monthlyFee'        => (float) $r['monthly_fee'],
            'activeStudents'    => (int) $r['active_students'],
            'expectedRevenue'   => (float) $r['expected_revenue'],
            'collectedRevenue'  => (float) $r['collected_revenue'],
        ], $rows);

        $totalExpected  = array_sum(array_column($data, 'expectedRevenue'));
        $totalCollected = array_sum(array_column($data, 'collectedRevenue'));

        return $this->success([
            'month'          => $month,
            'routes'         => $data,
            'totalExpected'  => $totalExpected,
            'totalCollected' => $totalCollected,
        ]);
    }

    private function reportPaymentStatus(string $tenantId, string $month)
    {
        $rows = $this->db->table('transport_student_allocations ta')
            ->select('ta.student_id,
                      s.first_name, s.last_name,
                      c.name AS class_name,
                      r.route_name,
                      r.monthly_fee,
                      ch.status AS charge_status,
                      ch.id AS charge_id')
            ->join('students s', 's.id = ta.student_id')
            ->join('classes c', 'c.id = s.class_id', 'left')
            ->join('transport_routes r', 'r.id = ta.route_id')
            ->join('charges ch',
                   'ch.student_id = ta.student_id AND ch.route_id = ta.route_id
                    AND ch.charge_type = "transport" AND ch.academic_session = "' . $this->db->escapeString($month) . '"',
                   'left')
            ->where('ta.tenant_id', $tenantId)
            ->where('ta.status', 'active')
            ->orderBy('s.last_name')
            ->get()->getResultArray();

        $data = array_map(fn($r) => [
            'studentId'     => $r['student_id'],
            'studentName'   => trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? '')),
            'className'     => $r['class_name'] ?? '',
            'routeName'     => $r['route_name'],
            'monthlyFee'    => (float) $r['monthly_fee'],
            'chargeStatus'  => $r['charge_status'] ?? 'not_generated',
            'chargeId'      => $r['charge_id'],
        ], $rows);

        $paid    = count(array_filter($data, fn($r) => $r['chargeStatus'] === 'paid'));
        $pending = count(array_filter($data, fn($r) => $r['chargeStatus'] === 'pending'));
        $none    = count(array_filter($data, fn($r) => $r['chargeStatus'] === 'not_generated'));

        return $this->success([
            'month'   => $month,
            'records' => $data,
            'summary' => ['paid' => $paid, 'pending' => $pending, 'notGenerated' => $none],
        ]);
    }

    private function reportDriverAssignments(string $tenantId)
    {
        $rows = $this->db->query("
            SELECT r.id, r.route_name, r.monthly_fee, r.status,
                   v.name AS vehicle_name, v.reg_number,
                   d.id AS driver_id, d.name AS driver_name, d.phone AS driver_phone,
                   COUNT(tsa.id) AS student_count
            FROM transport_routes r
            LEFT JOIN transport_route_periods rp
                ON rp.route_id = r.id AND rp.status = 'active' AND rp.tenant_id = ?
            LEFT JOIN transport_vehicles v ON v.id = rp.vehicle_id
            LEFT JOIN transport_drivers d ON d.id = rp.driver_id
            LEFT JOIN transport_student_allocations tsa
                ON tsa.route_id = r.id AND tsa.status = 'active' AND tsa.tenant_id = ?
            WHERE r.tenant_id = ?
            GROUP BY r.id, v.name, v.reg_number, d.id, d.name, d.phone
            ORDER BY d.name
        ", [$tenantId, $tenantId, $tenantId])->getResultArray();

        $data = array_map(fn($r) => [
            'routeId'      => $r['id'],
            'routeName'    => $r['route_name'],
            'vehicle'      => $r['vehicle_name'],
            'regNumber'    => $r['reg_number'],
            'driverId'     => $r['driver_id'],
            'driverName'   => $r['driver_name'],
            'driverPhone'  => $r['driver_phone'],
            'monthlyFee'   => (float) $r['monthly_fee'],
            'status'       => $r['status'],
            'studentCount' => (int) $r['student_count'],
        ], $rows);

        return $this->success($data);
    }

    // =========================================================================
    // STUDENT STATUS & ASSIGNMENT VIEWS
    // =========================================================================

    /**
     * GET /transport/routes/:routeId/students-with-status
     *
     * Returns all active students in the tenant with their route assignment
     * status relative to the given route:
     *   - available            – not on any route
     *   - assigned_this_route  – currently on this route
     *   - assigned_other_route – on a different route
     */
    public function getStudentsWithRouteStatus($routeId = null)
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();

        // Verify route belongs to tenant
        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        // Fetch all active students
        $students = $this->db->table('students s')
            ->select('s.id, s.first_name, s.last_name, c.name AS class_name')
            ->join('classes c', 'c.id = s.class_id', 'left')
            ->where('s.tenant_id', $tenantId)
            ->where('s.status', 'active')
            ->orderBy('s.last_name')
            ->get()->getResultArray();

        // Fetch all active allocations for this tenant keyed by student_id
        $assignments = $this->db->table('transport_student_allocations ta')
            ->select('ta.student_id, ta.route_id, r.route_name')
            ->join('transport_routes r', 'r.id = ta.route_id')
            ->where('ta.tenant_id', $tenantId)
            ->where('ta.status', 'active')
            ->get()->getResultArray();

        $assignmentMap = [];
        foreach ($assignments as $a) {
            $assignmentMap[$a['student_id']] = $a;
        }

        $result = array_map(function ($s) use ($routeId, $assignmentMap) {
            $assignment = $assignmentMap[$s['id']] ?? null;
            if (!$assignment) {
                $routeStatus       = 'available';
                $assignedRouteName = null;
            } elseif ($assignment['route_id'] === $routeId) {
                $routeStatus       = 'assigned_this_route';
                $assignedRouteName = $assignment['route_name'];
            } else {
                $routeStatus       = 'assigned_other_route';
                $assignedRouteName = $assignment['route_name'];
            }

            return [
                'id'               => $s['id'],
                'firstName'        => $s['first_name'],
                'lastName'         => $s['last_name'],
                'className'        => $s['class_name'] ?? '',
                'routeStatus'      => $routeStatus,
                'assignedRouteName'=> $assignedRouteName,
            ];
        }, $students);

        return $this->success($result);
    }

    /**
     * GET /transport/routes/:routeId/assignments
     *
     * Returns all students assigned to a route with payment/access details.
     * Optional query param: month (YYYY-MM) to filter by assignment overlap.
     */
    public function getAssignmentsWithDetails($routeId = null)
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();
        $month    = $this->request->getGet('month'); // optional YYYY-MM

        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        $query = $this->db->table('transport_student_allocations ta')
            ->select('ta.id, ta.student_id, ta.start_date, ta.end_date, ta.status AS transport_status,
                      ta.created_at AS assigned_date,
                      s.first_name, s.last_name, c.name AS class_name,
                      r.monthly_fee, r.route_name')
            ->join('students s', 's.id = ta.student_id')
            ->join('transport_routes r', 'r.id = ta.route_id')
            ->join('classes c', 'c.id = s.class_id', 'left')
            ->where('ta.tenant_id', $tenantId)
            ->where('ta.route_id', $routeId);

        if ($month && preg_match('/^\d{4}-\d{2}$/', $month)) {
            $monthStart = $month . '-01';
            $monthEnd   = date('Y-m-t', strtotime($monthStart));
            $query->where('ta.start_date <=', $monthEnd)
                  ->groupStart()
                      ->where('ta.end_date IS NULL')
                      ->orWhere('ta.end_date >=', $monthStart)
                  ->groupEnd();
        }

        $rows = $query->orderBy('s.last_name')->get()->getResultArray();

        $currentMonth = date('Y-m');

        $data = array_map(function ($r) use ($currentMonth, $route) {
            $isActive = $r['transport_status'] === 'active';
            return [
                'id'              => $r['id'],
                'studentId'       => $r['student_id'],
                'studentName'     => trim($r['first_name'] . ' ' . $r['last_name']),
                'studentClass'    => $r['class_name'] ?? '',
                'paymentId'       => null,
                'access'          => $isActive,
                'assignedDate'    => $r['assigned_date'] ? substr($r['assigned_date'], 0, 10) : null,
                'startDate'       => $r['start_date'],
                'endDate'         => $r['end_date'],
                'routeFee'        => (float) $r['monthly_fee'],
                'routeName'       => $r['route_name'],
                'driverName'      => '',
                'month'           => $currentMonth,
                'routeId'         => $route['id'],
                'transportStatus' => $isActive ? 'Active' : 'Suspended',
            ];
        }, $rows);

        return $this->success($data);
    }

    /**
     * POST /transport/payment
     *
     * Records a transport fee payment for a student for a given month.
     * Creates a record in the payments table with category=Transport Fee.
     */
    public function recordPayment()
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        if ($err = $this->requireFields($body, ['studentId', 'routeId', 'month', 'amount', 'method'])) {
            return $err;
        }

        $studentId = $this->sanitiseString($body['studentId']);
        $routeId   = $this->sanitiseString($body['routeId']);
        $month     = $this->sanitiseString($body['month']);
        $amount    = (float) $body['amount'];
        $method    = $this->sanitiseString($body['method']);
        $notes     = $this->sanitiseString($body['notes'] ?? '');

        if ($amount <= 0) {
            return $this->error('Amount must be greater than zero', 400);
        }

        // Verify student belongs to tenant
        $student = $this->db->table('students')
            ->where('id', $studentId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        // Verify route belongs to tenant
        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        $paymentId     = $this->generateId('p');
        $receiptNumber = $this->generateReceiptNumber();
        $now           = date('Y-m-d H:i:s');

        $this->db->transBegin();
        try {
            $this->db->table('payments')->insert([
                'id'               => $paymentId,
                'tenant_id'        => $tenantId,
                'student_id'       => $studentId,
                'amount'           => $amount,
                'date'             => date('Y-m-d'),
                'method'           => $method,
                'description'      => $notes ?: 'Transport fee payment – ' . $month,
                'category'         => 'Transport Fee',
                'route_id'         => $routeId,
                'receipt_number'   => $receiptNumber,
                'created_at'       => $now,
                'updated_at'       => $now,
            ]);

            $ledgerService = new \App\Services\LedgerService($this->db);
            $ledgerService->allocatePaymentToCharges($studentId, $tenantId, $this->db);

            $ledger = $ledgerService->getStudentBalance($studentId, $tenantId);
            $this->db->table('payments')
                ->where('id', $paymentId)
                ->update(['balance_after_payment' => $ledger['balance'], 'updated_at' => $now]);

            $this->db->transCommit();
        } catch (\Throwable $e) {
            $this->db->transRollback();
            log_message('error', '[TransportController::recordPayment] ' . $e->getMessage());
            return $this->serverError('Failed to record transport payment. Please try again.');
        }

        return $this->success(['id' => $paymentId, 'receiptNumber' => $receiptNumber], 'Transport payment recorded');
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private function formatRoute(array $r, array $stops, ?array $period, array $students): array
    {
        return [
            'id'          => $r['id'],
            'tenantId'    => $r['tenant_id'],
            'routeName'   => $r['route_name'],
            'monthlyFee'  => (float) $r['monthly_fee'],
            'status'      => $r['status'],
            'stops'       => $stops,
            'stopCount'   => count($stops),
            // Current period vehicle/driver (null when no period assigned yet)
            'vehicle'     => $period ? [
                'id'        => $period['vehicle_id'],
                'name'      => $period['vehicle_name'],
                'regNumber' => $period['reg_number'] ?? null,
                'type'      => $period['vehicle_type'] ?? null,
                'capacity'  => isset($period['capacity']) ? (int) $period['capacity'] : null,
            ] : null,
            'driver'      => ($period && !empty($period['driver_id'])) ? [
                'id'    => $period['driver_id'],
                'name'  => $period['driver_name'] ?? null,
                'phone' => $period['driver_phone'] ?? null,
            ] : null,
            'periodId'    => $period['id'] ?? ($period['period_id'] ?? null),
            'students'    => $students,
            'activeCount' => count($students),
        ];
    }

    private function formatStop(array $s): array
    {
        return [
            'id'            => $s['id'],
            'name'          => $s['name'],
            'pickupTime'    => $s['pickup_time'] ?? null,
            'orderPosition' => (int) $s['order_position'],
        ];
    }

    private function formatAllocationStudent(array $s): array
    {
        return [
            'allocationId' => $s['allocation_id'],
            'studentId'    => $s['student_id'],
            'studentName'  => trim(($s['first_name'] ?? '') . ' ' . ($s['last_name'] ?? '')),
            'studentClass' => $s['class_name'] ?? '',
            'stopId'       => $s['stop_id'] ?? null,
            'stopName'     => $s['stop_name'] ?? null,
            'direction'    => $s['direction'] ?? 'both',
            'status'       => 'Active',
        ];
    }

    // =========================================================================
    // STOPS
    // =========================================================================

    /** GET /transport/routes/:routeId/stops */
    public function getStops(string $routeId)
    {
        $tenantId = $this->getTenantId();

        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) return $this->notFound('Route not found');

        $stops = $this->db->table('transport_stops')
            ->where('route_id', $routeId)->where('tenant_id', $tenantId)
            ->orderBy('order_position')
            ->get()->getResultArray();

        return $this->success(array_map([$this, 'formatStop'], $stops));
    }

    /** POST /transport/routes/:routeId/stops */
    public function createStop(string $routeId)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        if (empty($body['name'])) return $this->error('Stop name is required', 400);

        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) return $this->notFound('Route not found');

        // Append at the end by default
        $maxPos = $this->db->table('transport_stops')
            ->selectMax('order_position')
            ->where('route_id', $routeId)
            ->get()->getRow()->order_position ?? -1;

        $id = $this->generateId('stop_');
        $this->db->table('transport_stops')->insert([
            'id'             => $id,
            'tenant_id'      => $tenantId,
            'route_id'       => $routeId,
            'name'           => $this->sanitiseString($body['name']),
            'pickup_time'    => isset($body['pickupTime']) ? $this->sanitiseString($body['pickupTime']) : null,
            'order_position' => (int) ($body['orderPosition'] ?? ($maxPos + 1)),
            'created_at'     => date('Y-m-d H:i:s'),
            'updated_at'     => date('Y-m-d H:i:s'),
        ]);

        return $this->success(['id' => $id], 'Stop added', 201);
    }

    /** PUT /transport/stops/:id */
    public function updateStop(string $id)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        $stop = $this->db->table('transport_stops')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$stop) return $this->notFound('Stop not found');

        $update = ['updated_at' => date('Y-m-d H:i:s')];
        if (isset($body['name']))          $update['name']           = $this->sanitiseString($body['name']);
        if (isset($body['pickupTime']))    $update['pickup_time']    = $this->sanitiseString($body['pickupTime']);
        if (isset($body['orderPosition'])) $update['order_position'] = (int) $body['orderPosition'];

        $this->db->table('transport_stops')->where('id', $id)->update($update);

        return $this->success(null, 'Stop updated');
    }

    /** DELETE /transport/stops/:id */
    public function deleteStop(string $id)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();

        $stop = $this->db->table('transport_stops')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$stop) return $this->notFound('Stop not found');

        // Null out stop_id on any allocations referencing this stop
        $this->db->table('transport_student_allocations')
            ->where('stop_id', $id)
            ->update(['stop_id' => null, 'updated_at' => date('Y-m-d H:i:s')]);

        $this->db->table('transport_stops')->where('id', $id)->delete();

        return $this->success(null, 'Stop deleted');
    }

    /** PUT /transport/routes/:routeId/stops/reorder */
    public function reorderStops(string $routeId)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        // Expects: { order: ['stop_id_1', 'stop_id_2', ...] }
        $order = $body['order'] ?? [];
        if (empty($order) || !is_array($order)) {
            return $this->error('order array is required', 400);
        }

        $now = date('Y-m-d H:i:s');
        foreach ($order as $pos => $stopId) {
            $this->db->table('transport_stops')
                ->where('id', $stopId)
                ->where('route_id', $routeId)
                ->where('tenant_id', $tenantId)
                ->update(['order_position' => $pos, 'updated_at' => $now]);
        }

        return $this->success(null, 'Stops reordered');
    }

    // =========================================================================
    // ROUTE PERIODS (vehicle + driver assignments)
    // =========================================================================

    /** GET /transport/routes/:routeId/periods */
    public function getPeriods(string $routeId)
    {
        $tenantId = $this->getTenantId();

        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) return $this->notFound('Route not found');

        $periods = $this->db->query("
            SELECT rp.*,
                   v.name AS vehicle_name, v.reg_number, v.type AS vehicle_type, v.capacity,
                   d.name AS driver_name, d.phone AS driver_phone
            FROM transport_route_periods rp
            JOIN transport_vehicles v ON v.id = rp.vehicle_id
            LEFT JOIN transport_drivers d ON d.id = rp.driver_id
            WHERE rp.route_id = ? AND rp.tenant_id = ?
            ORDER BY rp.created_at DESC
        ", [$routeId, $tenantId])->getResultArray();

        $result = array_map(function ($p) {
            return [
                'id'           => $p['id'],
                'vehicleId'    => $p['vehicle_id'],
                'vehicleName'  => $p['vehicle_name'],
                'regNumber'    => $p['reg_number'],
                'vehicleType'  => $p['vehicle_type'],
                'capacity'     => (int) $p['capacity'],
                'driverId'     => $p['driver_id'],
                'driverName'   => $p['driver_name'],
                'driverPhone'  => $p['driver_phone'],
                'status'       => $p['status'],
            ];
        }, $periods);

        return $this->success($result);
    }

    /** POST /transport/routes/:routeId/periods */
    public function createPeriod(string $routeId)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        if ($err = $this->requireFields($body, ['vehicleId'])) return $err;

        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) return $this->notFound('Route not found');

        $vehicle = $this->db->table('transport_vehicles')
            ->where('id', $body['vehicleId'])->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$vehicle) return $this->error('Vehicle not found', 404);

        if (!empty($body['driverId'])) {
            $driver = $this->db->table('transport_drivers')
                ->where('id', $body['driverId'])->where('tenant_id', $tenantId)
                ->get()->getRowArray();
            if (!$driver) return $this->error('Driver not found', 404);
        }

        // Deactivate any existing active period for this route
        $this->db->table('transport_route_periods')
            ->where('route_id', $routeId)
            ->where('status', 'active')
            ->where('tenant_id', $tenantId)
            ->update(['status' => 'inactive', 'updated_at' => date('Y-m-d H:i:s')]);

        $academicYear = $this->sessionService->getCurrentSession($tenantId);
        $id = $this->generateId('rp_');
        $this->db->table('transport_route_periods')->insert([
            'id'            => $id,
            'tenant_id'     => $tenantId,
            'route_id'      => $routeId,
            'vehicle_id'    => $body['vehicleId'],
            'driver_id'     => $body['driverId'] ?? null,
            'academic_year' => $academicYear,
            'status'        => 'active',
            'created_at'    => date('Y-m-d H:i:s'),
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);

        return $this->success(['id' => $id], 'Period assigned', 201);
    }

    /** PUT /transport/route-periods/:id */
    public function updatePeriod(string $id)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        $period = $this->db->table('transport_route_periods')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$period) return $this->notFound('Period not found');

        $update = ['updated_at' => date('Y-m-d H:i:s')];

        if (isset($body['vehicleId'])) {
            $vehicle = $this->db->table('transport_vehicles')
                ->where('id', $body['vehicleId'])->where('tenant_id', $tenantId)
                ->get()->getRowArray();
            if (!$vehicle) return $this->error('Vehicle not found', 404);
            $update['vehicle_id'] = $body['vehicleId'];
        }
        if (array_key_exists('driverId', $body)) {
            $update['driver_id'] = $body['driverId'] ?: null;
        }
        if (isset($body['status']) && in_array($body['status'], ['active', 'inactive'])) {
            $update['status'] = $body['status'];
        }

        $this->db->table('transport_route_periods')->where('id', $id)->update($update);

        return $this->success(null, 'Period updated');
    }

    /** DELETE /transport/route-periods/:id */
    public function deletePeriod(string $id)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();

        $period = $this->db->table('transport_route_periods')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$period) return $this->notFound('Period not found');

        $this->db->table('transport_route_periods')->where('id', $id)->delete();

        return $this->success(null, 'Period deleted');
    }

    // =========================================================================
    // STUDENT ALLOCATIONS (new normalized system)
    // =========================================================================

    /** GET /transport/allocations?routeId=&studentId=&status= */
    public function getAllocations()
    {
        $tenantId    = $this->getTenantId();
        $routeId     = $this->request->getGet('routeId');
        $studentId   = $this->request->getGet('studentId');
        $status      = $this->request->getGet('status') ?? 'active';

        $builder = $this->db->table('transport_student_allocations tsa')
            ->select('tsa.*, ts.name AS stop_name, ts.order_position,
                      s.first_name, s.last_name, c.name AS class_name,
                      r.route_name')
            ->join('students s',       's.id = tsa.student_id')
            ->join('transport_routes r', 'r.id = tsa.route_id')
            ->join('classes c',        'c.id = s.class_id',  'left')
            ->join('transport_stops ts', 'ts.id = tsa.stop_id', 'left')
            ->where('tsa.tenant_id', $tenantId);

        if ($routeId)      $builder->where('tsa.route_id', $routeId);
        if ($studentId)    $builder->where('tsa.student_id', $studentId);
        if ($status !== 'all') $builder->where('tsa.status', $status);

        $rows = $builder->orderBy('s.last_name, s.first_name')->get()->getResultArray();

        $result = array_map(function ($row) {
            return [
                'id'           => $row['id'],
                'studentId'    => $row['student_id'],
                'studentName'  => trim($row['first_name'] . ' ' . $row['last_name']),
                'studentClass' => $row['class_name'] ?? '',
                'routeId'      => $row['route_id'],
                'routeName'    => $row['route_name'],
                'stopId'       => $row['stop_id'],
                'stopName'     => $row['stop_name'],
                'direction'    => $row['direction'],
                'status'       => $row['status'],
                'notes'        => $row['notes'],
            ];
        }, $rows);

        return $this->success($result);
    }

    /**
     * POST /transport/routes/:routeId/allocations
     *
     * Creates a new transport assignment for a student on the given route.
     * Enforces (Feature 054-transport-constraints):
     *  - US1: a student may only have ONE active assignment across all routes.
     *  - US2: stop_id is required and must belong to the route.
     *  - Route must have at least one configured stop.
     *
     * Returns 409 Conflict (with existing route info) if the student is already
     * assigned to any other active route, and 400 Bad Request for stop validation
     * failures.
     */
    public function createAllocation(string $routeId)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        if ($err = $this->requireFields($body, ['studentId', 'stopId'])) return $err;

        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) return $this->notFound('Route not found');

        $studentId = (string) $body['studentId'];
        $stopId    = (string) ($body['stopId'] ?? '');
        $direction = $body['direction'] ?? 'both';

        // US1 + US2 validation via service.
        $validationError = $this->assignmentService->validateNewAssignment(
            $tenantId,
            $routeId,
            $studentId,
            $stopId,
            $direction
        );
        if ($validationError !== null) {
            return $this->error(
                $validationError['message'],
                $validationError['status'],
                $validationError['errors']
            );
        }

        // Capacity check via active route period (preserved from original logic).
        if (!empty($body['checkCapacity']) && $body['checkCapacity'] !== false) {
            $period = $this->db->table('transport_route_periods rp')
                ->select('rp.id, v.capacity')
                ->join('transport_vehicles v', 'v.id = rp.vehicle_id')
                ->where('rp.route_id', $routeId)
                ->where('rp.status', 'active')
                ->where('rp.tenant_id', $tenantId)
                ->get()->getRowArray();

            if ($period) {
                $capacity = (int) $period['capacity'];
                $activeCount = $this->db->table('transport_student_allocations')
                    ->where('route_id', $routeId)
                    ->where('status', 'active')
                    ->where('tenant_id', $tenantId)
                    ->countAllResults();

                if ($capacity > 0 && $activeCount >= $capacity) {
                    return $this->error(
                        "Route is at full capacity ({$capacity} students). Remove a student or assign a larger vehicle.",
                        409
                    );
                }
            }
        }

        try {
            $row = $this->assignmentService->createAllocation(
                $tenantId,
                $routeId,
                $studentId,
                $stopId,
                $direction,
                $body['notes'] ?? null,
                $body['academicYear'] ?? ($route['academic_year'] ?? ''),
                isset($body['startDate']) ? (string) $body['startDate'] : null
            );
        } catch (\Throwable $e) {
            // Handle race condition: another request inserted an active allocation
            // for this student between our check and our insert. The DB unique
            // index `idx_unique_active_assignment` raises a 1062 duplicate-key error.
            if (strpos($e->getMessage(), '1062') !== false ||
                stripos($e->getMessage(), 'Duplicate entry') !== false) {
                $existing = $this->assignmentService->getActiveAllocation($tenantId, $studentId);
                return $this->error(
                    'Student already has an active transport assignment',
                    409,
                    [
                        'existingAssignment' => $existing ? [
                            'allocationId' => $existing['id'],
                            'routeId'      => $existing['route_id'],
                            'routeName'    => $existing['route_name'] ?? null,
                        ] : null,
                    ]
                );
            }
            log_message('error', '[TransportController::createAllocation] ' . $e->getMessage());
            return $this->serverError('Failed to create allocation');
        }

        return $this->success([
            'id'           => $row['id'],
            'studentId'    => $row['student_id'],
            'routeId'      => $row['route_id'],
            'stopId'       => $row['stop_id'],
            'direction'    => $row['direction'],
            'startDate'    => $row['start_date'],
            'status'       => $row['status'],
            'notes'        => $row['notes'] ?? null,
            'academicYear' => $row['academic_year'] ?? null,
        ], 'Student allocated to route', 201);
    }

    /**
     * POST /transport/allocations/reassign
     *
     * Atomically moves a student from one route to another:
     *  - Ends the existing active allocation (status=inactive, end_date set).
     *  - Creates a new active allocation on the target route + stop.
     *  - Wrapped in a single DB transaction.
     *
     * See contracts/transport-assignments.md for request/response shape.
     */
    public function reassignAllocation()
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        if ($err = $this->requireFields($body, ['studentId', 'fromRouteId', 'toRouteId', 'toStopId'])) {
            return $err;
        }

        $result = $this->assignmentService->reassignStudent(
            $tenantId,
            (string) $body['studentId'],
            (string) $body['fromRouteId'],
            (string) $body['toRouteId'],
            (string) $body['toStopId'],
            $body['direction'] ?? 'both',
            $body['notes'] ?? null,
            $body['reassignDate'] ?? null,
            $body['academicYear'] ?? null
        );

        if (isset($result['error'])) {
            return $this->error(
                $result['error']['message'],
                $result['error']['status'],
                $result['error']['errors']
            );
        }

        return $this->success([
            'endedAssignment' => [
                'id'        => $result['endedAssignment']['id'],
                'routeId'   => $result['endedAssignment']['route_id'],
                'endDate'   => $result['endedAssignment']['end_date'],
                'status'    => $result['endedAssignment']['status'],
            ],
            'newAssignment' => [
                'id'        => $result['newAssignment']['id'],
                'routeId'   => $result['newAssignment']['route_id'],
                'stopId'    => $result['newAssignment']['stop_id'],
                'direction' => $result['newAssignment']['direction'],
                'startDate' => $result['newAssignment']['start_date'],
                'status'    => $result['newAssignment']['status'],
            ],
        ], 'Student reassigned successfully');
    }

    /**
     * GET /transport/missing-charges
     *
     * Returns students with active transport assignments who lack a transport
     * charge for the given month (default: current month).
     *
     * Query params:
     *  - month        (string, YYYY-MM)  default: current month
     *  - routeId      (string)           optional filter
     *  - academicYear (string)           optional filter
     */
    public function getMissingCharges()
    {
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $tenantId = $this->getTenantId();
        $month    = (string) ($this->request->getGet('month') ?? date('Y-m'));
        $routeId  = $this->request->getGet('routeId');
        $academic = $this->request->getGet('academicYear');

        // Validate month format (YYYY-MM).
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            return $this->error('Invalid month format. Expected YYYY-MM.', 400, ['month' => 'invalid_format']);
        }

        $rows    = $this->assignmentService->getMissingCharges($tenantId, $month, $routeId ?: null, $academic ?: null);
        $byRoute = $this->assignmentService->groupMissingChargesByRoute($rows);
        $total   = count($rows);

        return $this->success([
            'month'        => $month,
            'totalMissing' => $total,
            'byRoute'      => $byRoute,
        ], 'Missing charge report generated');
    }

    /** PUT /transport/allocations/:id */
    public function updateAllocation(string $id)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        $allocation = $this->db->table('transport_student_allocations')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$allocation) return $this->notFound('Allocation not found');

        $update = ['updated_at' => date('Y-m-d H:i:s')];

        if (array_key_exists('stopId', $body)) $update['stop_id'] = $body['stopId'] ?: null;
        if (isset($body['direction']) && in_array($body['direction'], ['both', 'inbound', 'outbound'])) {
            $update['direction'] = $body['direction'];
        }
        if (isset($body['notes']))     $update['notes']      = $body['notes'];
        if (isset($body['status']) && in_array($body['status'], ['active', 'inactive'])) {
            $update['status'] = $body['status'];
        }

        $this->db->table('transport_student_allocations')->where('id', $id)->update($update);

        return $this->success(null, 'Allocation updated');
    }

    /** DELETE /transport/allocations/:id  (soft delete) */
    public function removeAllocation(string $id)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $tenantId = $this->getTenantId();

        $allocation = $this->db->table('transport_student_allocations')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$allocation) return $this->notFound('Allocation not found');

        $this->db->table('transport_student_allocations')
            ->where('id', $id)
            ->update([
                'status'     => 'inactive',
                'end_date'   => date('Y-m-d'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        return $this->success(null, 'Student removed from route');
    }
}

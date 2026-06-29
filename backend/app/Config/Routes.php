<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
$routes->get('/', 'Home::index');

// ============================================
// API Routes
// ============================================

// Handle all OPTIONS preflight requests (covers both /api/* and /api/platform/*)
$corsResponse = static function () {
    $response = service('response');
    $response->setHeader('Access-Control-Allow-Origin', '*');
    $response->setHeader('Access-Control-Allow-Headers', 'X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method, Authorization');
    $response->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    $response->setHeader('Access-Control-Allow-Credentials', 'true');
    $response->setStatusCode(200);
    return $response;
};
$routes->options('api/platform/(:any)', $corsResponse);
$routes->options('api/(:any)', $corsResponse);

$routes->group('api', ['namespace' => 'App\Controllers\Api'], function ($routes) {

    // ==================== Kiosk (Public — no JWT required) ====================
    // New format: /api/kiosk/status/:code (opaque kiosk code, no tenant_id in URL)
    // Legacy: /api/kiosk/status?tenant_id=xxx still supported via fallback in controller
    $routes->get('kiosk/status/(:any)', 'KioskController::status/$1');
    $routes->get('kiosk/status', 'KioskController::status');
    $routes->post('kiosk/action', 'KioskController::action');
    $routes->post('kiosk/qr-scan', 'KioskController::qrScan');

    // ==================== Driver Kiosk (Public — no JWT required) ====================
    // Drivers view their routes and student rosters via kiosk using Employee ID only.
    // See: specs/015-restrict-roles-kiosk/ for full specification.
    $routes->post('kiosk/driver/validate', 'DriverKioskController::validateDriver');
    $routes->get('kiosk/driver/routes/(:any)', 'DriverKioskController::roster/$1');

    // ==================== Student Attendance Kiosk (Public — no JWT required) ====================
    // Teachers mark student attendance via kiosk without logging in.
    // See: specs/011-student-kiosk-attendance/ for full specification.
    $routes->get('kiosk/student-attendance/status/(:any)', 'StudentKioskController::status/$1');
    $routes->post('kiosk/student-attendance/validate-teacher', 'StudentKioskController::validateTeacher');
    $routes->get('kiosk/student-attendance/class-students/(:any)', 'StudentKioskController::classStudents/$1');
    $routes->post('kiosk/student-attendance/submit', 'StudentKioskController::submit');

    // ==================== Payment Receipts (Public — no JWT required) ====================
    // Receipts are viewable without authentication so QR codes work for parents/guardians.
    $routes->get('receipts/student/(:segment)', 'ReceiptController::listByStudent/$1');
    $routes->get('receipts/(:segment)', 'ReceiptController::show/$1');

    // ==================== Demo Requests (Public — no JWT required) ====================
    $routes->post('demo-requests', 'DemoRequestsController::store');

    // ==================== Maintenance Status (Public — no JWT required) ====================
    $routes->get('maintenance-status', 'MaintenanceController::status');

    // ==================== Authentication ====================
    $routes->group('auth', function ($routes) {
        $routes->post('login', 'AuthController::login');
        $routes->post('register', 'AuthController::register');
        $routes->post('refresh', 'AuthController::refresh');
        $routes->get('me', 'AuthController::me');
        $routes->post('forgot-password', 'AuthController::forgotPassword');
        $routes->post('reset-password', 'AuthController::resetPassword');
        $routes->post('accept-invite', 'AuthController::acceptInvite');
    });

    // ==================== Dashboard ====================
    $routes->get('dashboard', 'DashboardController::index');
    $routes->get('dashboard/metrics/(:segment)', 'DashboardController::metric/$1');
    $routes->post('dashboard/refresh', 'DashboardController::refresh');
    $routes->get('dashboard/activity', 'DashboardController::activity');

    // ==================== Students ====================
    $routes->get('students', 'StudentController::index');
    $routes->get('students-optimized', 'StudentsOptimizedController::index');
    $routes->get('students/search', 'StudentController::search');
    $routes->get('students/count', 'StudentController::count');
    $routes->get('students/by-class/(:segment)', 'StudentController::byClass/$1');
    $routes->get('students/migration-preview', 'StudentController::migrationPreview');
    $routes->get('students/import/template', 'StudentImportController::template');
    $routes->post('students/import/validate', 'StudentImportController::validateImport');
    $routes->post('students/import/execute', 'StudentImportController::execute');
    $routes->get('students/export', 'StudentImportController::export');
    $routes->get('students/(:segment)/balance', 'StudentController::balance/$1');  // Ledger-based balance
    $routes->get('students/(:segment)/identity', 'StudentController::identity/$1');
    $routes->get('students/(:segment)/timeline', 'StudentController::timeline/$1');
    $routes->get('students/(:segment)/profile-history', 'StudentController::getProfileHistory/$1');
    $routes->post('students/(:segment)/profile-history', 'StudentController::recordProfileHistory/$1');
    $routes->get('students/(:segment)/profile', 'StudentController::getProfile/$1');
    $routes->get('students/(:segment)/fee-statement', 'StudentController::getFeeStatement/$1');
    $routes->get('students/(:segment)/finance-summary', 'StudentController::getFinanceSummary/$1');
    $routes->get('students/(:segment)/charges-history', 'StudentController::getChargesHistory/$1');
    $routes->get('students/(:segment)/adjustments-history', 'StudentController::getAdjustmentsHistory/$1');
    $routes->get('students/(:segment)/class-history', 'StudentController::getClassHistory/$1');
    $routes->get('students/(:segment)/status-history', 'StudentController::getStatusHistory/$1');
    $routes->get('students/(:segment)/transport-history', 'StudentController::getTransportHistory/$1');
    $routes->get('students/(:segment)/campaigns', 'FeeCampaignController::getStudentCampaigns/$1');
    $routes->get('students/(:segment)', 'StudentController::show/$1');
    $routes->post('students', 'StudentController::create');
    // bulk-status MUST precede the (:segment) wildcard to avoid route shadowing
    $routes->put('students/bulk-status', 'StudentController::bulkChangeStatus');
    $routes->put('students/(:segment)/status', 'StudentController::changeStatus/$1');
    $routes->put('students/(:segment)', 'StudentController::update/$1');
    $routes->delete('students/(:segment)', 'StudentController::delete/$1');
    $routes->post('students/promote', 'StudentController::promote');
    $routes->post('students/reconcile', 'StudentController::reconcile');
    $routes->post('students/(:segment)/promote', 'StudentController::promoteStudent/$1');
    $routes->post('students/(:segment)/repeat', 'StudentController::repeatStudent/$1');

    // ==================== Classes ====================
    $routes->get('class-instances', 'ClassController::classInstances');
    $routes->get('classes', 'ClassController::index');
    $routes->get('classes/student-counts', 'ClassController::getStudentCounts');
    $routes->get('classes/final', 'ClassController::getFinalClasses');
    $routes->get('classes/promotion-preview', 'ClassController::getPromotionPreview');
    $routes->get('classes/(:segment)/students', 'ClassController::students/$1');
    $routes->get('classes/(:segment)/student-count', 'ClassController::studentCount/$1');
    $routes->get('classes/(:segment)/enrollment-history', 'ClassController::getEnrollmentHistory/$1');
    $routes->get('classes/(:segment)/next-class', 'ClassController::getNextClass/$1');
    $routes->get('classes/(:segment)', 'ClassController::show/$1');
    $routes->post('classes', 'ClassController::create');
    $routes->put('classes/(:segment)/next-class', 'ClassController::setNextClass/$1');
    $routes->put('classes/(:segment)', 'ClassController::update/$1');
    $routes->delete('classes/(:segment)', 'ClassController::archive/$1');
    $routes->post('classes/(:segment)/unarchive', 'ClassController::unarchive/$1');
    $routes->post('classes/(:segment)/assign-students', 'ClassController::assignStudents/$1');
    $routes->delete('classes/(:segment)/permanent-delete', 'ClassController::permanentDelete/$1');

    // ==================== Staff ====================
    $routes->get('staff', 'StaffController::index');
    $routes->get('staff/teachers', 'StaffController::teachers');
    $routes->get('staff/import/template', 'StaffImportController::template');
    $routes->post('staff/import/validate', 'StaffImportController::validateImport');
    $routes->post('staff/import/execute', 'StaffImportController::execute');
    $routes->get('staff/export', 'StaffImportController::export');
    $routes->get('staff/(:segment)', 'StaffController::show/$1');
    $routes->get('staff/(:segment)/classes', 'StaffController::getClasses/$1');
    $routes->post('staff', 'StaffController::create');
    $routes->put('staff/(:segment)', 'StaffController::update/$1');
    $routes->delete('staff/(:segment)', 'StaffController::delete/$1');
    $routes->post('staff/(:segment)/qr-code', 'StaffController::generateQRCode/$1');
    $routes->post('staff/qr-codes/bulk', 'StaffController::bulkGenerateQRCodes');
    $routes->get('staff/(:segment)/qr-code.png', 'StaffController::downloadQRCode/$1');

    // ==================== Teachers (alias) ====================
    $routes->get('teachers', 'StaffController::teachers');

    // ==================== Payments ====================
    $routes->get('payments', 'PaymentController::index');
    $routes->get('payments/recent', 'PaymentController::recent');
    $routes->get('payments/filter-options', 'PaymentController::filterOptions');
    $routes->get('payments/with-students', 'PaymentController::withStudents');
    $routes->get('payments/revenue-by-category', 'PaymentController::revenueByCategory');
    $routes->get('payments/category-totals', 'PaymentController::categoryTotals');
    $routes->get('payments/report/pdf', 'PaymentController::generateReportPdf');
    $routes->get('payments/student/(:segment)', 'PaymentController::byStudent/$1');
    $routes->get('payments/student/(:segment)/term-total', 'PaymentController::termTotal/$1');
    $routes->post('payments/(:segment)/void', 'PaymentController::void/$1');
    $routes->get('payments/(:segment)', 'PaymentController::show/$1');
    $routes->post('payments', 'PaymentController::create');

    // ==================== Tenants ====================
    $routes->get('tenants', 'TenantController::index');
    $routes->get('tenants/current', 'TenantController::current');
    $routes->get('tenants/(:segment)', 'TenantController::show/$1');

    // ==================== Tenant Deletion (078-account-deletion-request) ====================
    $routes->get('tenant/deletion-status', 'TenantDeletionController::getStatus');
    $routes->post('tenant/deletion-request', 'TenantDeletionController::requestDeletion');
    $routes->post('tenant/undo-deletion', 'TenantDeletionController::undoDeletion');

    // ==================== Onboarding (043-school-creation-onboarding) ====================
    $routes->get('onboarding/progress',         'OnboardingController::getProgress');
    $routes->post('onboarding/progress',        'OnboardingController::saveProgress');
    $routes->post('onboarding/complete',        'OnboardingController::complete');
    $routes->post('onboarding/change-password', 'OnboardingController::changePassword');

    // ==================== Onboarding Guidance (076-onboarding-guided-tutorial) ====================
    $routes->get('setup-guide', 'SetupGuideController::index');
    $routes->patch('setup-guide/steps/(:segment)', 'SetupGuideController::updateStep/$1');
    $routes->post('setup-guide/dismiss', 'SetupGuideController::dismiss');
    $routes->get('tutorial', 'TutorialController::index');
    $routes->patch('tutorial/progress', 'TutorialController::updateProgress');
    $routes->post('tutorial/restart', 'TutorialController::restart');

    // ==================== Users ====================
    $routes->get('users', 'UserController::index');
    $routes->get('users/(:segment)', 'UserController::show/$1');
    $routes->post('users/invite', 'UserController::invite');
    $routes->post('users/(:segment)/resend-invite', 'UserController::resendInvite/$1');
    $routes->put('users/(:segment)', 'UserController::update/$1');
    $routes->delete('users/(:segment)', 'UserController::delete/$1');
    $routes->put('users/(:segment)/status', 'UserController::toggleStatus/$1');

    // ==================== Settings ====================
    $routes->get('settings', 'SettingsController::index');
    $routes->put('settings', 'SettingsController::update');

    // ==================== Fee Structure (billing cycle only) ====================
    $routes->get('fee-structure', 'SettingsController::getFeeStructure');
    $routes->put('fee-structure', 'SettingsController::saveFeeStructure');

    // ==================== Fee Rules (Feature 056) ====================
    // Static routes MUST come before the parameterised ones (:segment) so
    // CodeIgniter's router matches them first.
    $routes->get('fee-rules/billing-meta',    'FeeRuleController::billingMeta');
    $routes->get('fee-rules/unbilled-alert',  'FeeRuleController::unbilledAlert');
    $routes->get('fee-rules/latest-charge-batch', 'FeeRuleController::latestChargeBatch');
    $routes->post('fee-rules/latest-charge-batch/void', 'FeeRuleController::voidLatestChargeBatch');
    $routes->post('fee-rules/generate',       'FeeRuleController::generate');
    $routes->get('fee-rules',                 'FeeRuleController::index');
    $routes->post('fee-rules',                'FeeRuleController::store');
    $routes->put('fee-rules/(:segment)',      'FeeRuleController::update/$1');
    $routes->delete('fee-rules/(:segment)',   'FeeRuleController::destroy/$1');

    // ==================== Payment Categories ====================
    $routes->get('payment-categories', 'SettingsController::getPaymentCategories');
    $routes->post('payment-categories', 'SettingsController::createPaymentCategory');
    $routes->put('payment-categories/(:segment)', 'SettingsController::updatePaymentCategory/$1');
    $routes->delete('payment-categories/(:segment)', 'SettingsController::deletePaymentCategory/$1');

    // ==================== Calendar ====================
    $routes->get('calendar', 'SettingsController::getCalendar');
    $routes->put('calendar', 'SettingsController::saveCalendar');
    $routes->get('calendar-status', 'SettingsController::calendarStatus');

    // ==================== Attendance ====================
    // New attendance endpoints: monthly summary, today's status, admin status update
    $routes->get('attendance/summary', 'AttendanceController::summary');
    $routes->get('attendance/today', 'AttendanceController::today');
    $routes->post('attendance/(:segment)/status', 'AttendanceController::updateStatus/$1');

    // ==================== Class-Linked Student Attendance (feature 068) ====================
    // All specific paths registered BEFORE (:segment) wildcards.
    $routes->get('class-attendance/summary/student/(:segment)', 'StudentClassAttendanceController::studentSummary/$1');
    $routes->get('class-attendance/summary/class/(:segment)', 'StudentClassAttendanceController::classSummary/$1');
    $routes->get('class-attendance/summary/session', 'StudentClassAttendanceController::sessionSummary');
    $routes->get('class-attendance/audit', 'StudentClassAttendanceController::auditLog');
    $routes->get('class-attendance', 'StudentClassAttendanceController::index');
    $routes->post('class-attendance', 'StudentClassAttendanceController::submit');

    $routes->get('student-attendance/class-summary', 'AttendanceController::classSummary');
    $routes->get('student-attendance', 'AttendanceController::studentIndex');
    $routes->get('student-attendance/summary/(:segment)', 'AttendanceController::studentSummary/$1');
    $routes->post('student-attendance', 'AttendanceController::saveStudentAttendance');

    // Staff attendance endpoints with specific paths before wildcards
    $routes->get('staff-attendance/filter-metadata', 'AttendanceController::filterMetadata');
    $routes->get('staff-attendance', 'AttendanceController::staffIndex');
    $routes->get('staff-attendance/summary/(:segment)', 'AttendanceController::staffSummary/$1');
    $routes->get('staff-attendance/report', 'AttendanceController::periodReport');
    $routes->get('staff-attendance/departments', 'AttendanceController::departmentReport');
    $routes->post('staff-attendance/check-in', 'AttendanceController::checkIn');
    $routes->post('staff-attendance/check-out', 'AttendanceController::checkOut');
    $routes->post('staff-attendance', 'AttendanceController::recordStaffAttendance');
    $routes->delete('staff-attendance/(:segment)', 'AttendanceController::deleteStaffAttendance/$1');
    $routes->put('staff-attendance/(:segment)', 'AttendanceController::updateStaffAttendance/$1');

    // ==================== Leave ====================
    $routes->get('leave-requests', 'LeaveController::index');
    $routes->get('leave-requests/pending', 'LeaveController::pending');
    $routes->get('leave-requests/staff/(:segment)', 'LeaveController::byStaff/$1');
    $routes->post('leave-requests', 'LeaveController::create');
    $routes->put('leave-requests/(:segment)/review', 'LeaveController::review/$1');
    $routes->put('leave-requests/(:segment)', 'LeaveController::update/$1');
    $routes->delete('leave-requests/(:segment)', 'LeaveController::delete/$1');
    
    // ==================== Transport ====================
    // Route CRUD
    $routes->get('transport/routes', 'TransportController::getRoutes');
    $routes->post('transport/routes', 'TransportController::createRoute');
    // NOTE: specific sub-resources must precede the plain (:segment) wildcard
    $routes->get('transport/routes/(:segment)/payment-status', 'TransportController::getRoutePaymentStatus/$1');
    $routes->get('transport/routes/(:segment)/students-with-status', 'TransportController::getStudentsWithRouteStatus/$1');
    $routes->get('transport/routes/(:segment)/assignments', 'TransportController::getAssignmentsWithDetails/$1');
    $routes->get('transport/routes/(:segment)/students', 'TransportController::getRouteStudents/$1');
    $routes->get('transport/routes/(:segment)/pdf', 'TransportController::downloadRoutePdf/$1');

    // Stops (normalized, ordered)
    $routes->get('transport/routes/(:segment)/stops', 'TransportController::getStops/$1');
    $routes->post('transport/routes/(:segment)/stops', 'TransportController::createStop/$1');
    $routes->put('transport/routes/(:segment)/stops/reorder', 'TransportController::reorderStops/$1');

    // Route periods (vehicle + driver for a given academic year)
    $routes->get('transport/routes/(:segment)/periods', 'TransportController::getPeriods/$1');
    $routes->post('transport/routes/(:segment)/periods', 'TransportController::createPeriod/$1');

    // Student allocations per route
    $routes->post('transport/routes/(:segment)/allocations', 'TransportController::createAllocation/$1');

    // Reassignment + missing-charge alerts (must precede the wildcard /allocations/(:segment))
    $routes->post('transport/allocations/reassign', 'TransportController::reassignAllocation');
    $routes->get('transport/missing-charges', 'TransportController::getMissingCharges');

    $routes->get('transport/routes/(:segment)', 'TransportController::getRoute/$1');
    $routes->put('transport/routes/(:segment)', 'TransportController::updateRoute/$1');
    $routes->delete('transport/routes/(:segment)', 'TransportController::deleteRoute/$1');

    // Individual stop / period / allocation mutations
    $routes->put('transport/stops/(:segment)', 'TransportController::updateStop/$1');
    $routes->delete('transport/stops/(:segment)', 'TransportController::deleteStop/$1');

    $routes->put('transport/route-periods/(:segment)', 'TransportController::updatePeriod/$1');
    $routes->delete('transport/route-periods/(:segment)', 'TransportController::deletePeriod/$1');

    $routes->get('transport/allocations', 'TransportController::getAllocations');
    $routes->put('transport/allocations/(:segment)', 'TransportController::updateAllocation/$1');
    $routes->delete('transport/allocations/(:segment)', 'TransportController::removeAllocation/$1');

    // Vehicles
    $routes->get('transport/vehicles', 'TransportVehicleController::index');
    $routes->post('transport/vehicles', 'TransportVehicleController::create');
    $routes->put('transport/vehicles/(:segment)', 'TransportVehicleController::update/$1');
    $routes->delete('transport/vehicles/(:segment)', 'TransportVehicleController::delete/$1');

    // Drivers
    $routes->get('transport/drivers', 'TransportDriverController::index');
    $routes->post('transport/drivers', 'TransportDriverController::create');
    $routes->put('transport/drivers/(:segment)', 'TransportDriverController::update/$1');
    $routes->delete('transport/drivers/(:segment)', 'TransportDriverController::delete/$1');

    $routes->post('transport/payment', 'TransportController::recordPayment');

    // Monthly charge generation
    $routes->get('transport/latest-charge-batch', 'TransportController::latestChargeBatch');
    $routes->post('transport/latest-charge-batch/void', 'TransportController::voidLatestChargeBatch');
    $routes->post('transport/generate-charges', 'TransportController::generateMonthlyCharges');
    $routes->post('transport/generate-student-charge', 'TransportController::generateStudentCharge');

    // Driver dashboard
    $routes->get('transport/driver/routes', 'TransportController::getDriverRoutes');
    $routes->get('transport/driver/routes/(:segment)/roster', 'TransportController::getDriverRoster/$1');

    // Reports
    $routes->get('transport/reports', 'TransportController::getReport');

    // ==================== Fee Campaigns (Feature 059) ====================
    // Static routes MUST come before parameterised (:segment) routes.
    $routes->get('fee-campaigns',                                   'FeeCampaignController::index');
    $routes->post('fee-campaigns',                                  'FeeCampaignController::store');
    $routes->get('fee-campaigns/(:segment)/students',                           'FeeCampaignController::getCampaignStudents/$1');
    $routes->post('fee-campaigns/(:segment)/students',                          'FeeCampaignController::addStudent/$1');
    $routes->delete('fee-campaigns/(:segment)/students/(:segment)',             'FeeCampaignController::removeStudent/$1/$2');
    $routes->post('fee-campaigns/(:segment)/record-payment',                    'FeeCampaignController::recordPayment/$1');
    $routes->post('fee-campaigns/(:segment)/close',                             'FeeCampaignController::close/$1');
    $routes->get('fee-campaigns/(:segment)/payments',                           'FeeCampaignController::getCampaignPayments/$1');
    $routes->post('fee-campaigns/(:segment)/payments/(:segment)/void',          'FeeCampaignController::voidCampaignPayment/$1/$2');
    $routes->get('fee-campaigns/(:segment)',                                     'FeeCampaignController::show/$1');
    $routes->put('fee-campaigns/(:segment)',                                     'FeeCampaignController::update/$1');

    // ==================== Charges / Ledger ====================
    $routes->get('charges', 'LedgerController::getCharges');
    $routes->get('charges/student/(:segment)', 'LedgerController::getStudentCharges/$1');
    $routes->get('ledger/student/(:segment)/balance', 'LedgerController::getStudentBalance/$1');
    $routes->get('ledger/balances', 'LedgerController::getAllBalances');

    // ==================== Reports ====================
    $routes->get('reports/payment-collection', 'ReportController::paymentCollection');
    $routes->get('reports/aged-balances', 'ReportController::agedBalances');
    $routes->get('reports/revenue-by-category', 'ReportController::revenueByCategory');

    // ==================== Reconciliation ====================
    // Adjustments
    $routes->get('reconciliation/adjustments', 'ReconciliationController::getAdjustments');
    $routes->get('reconciliation/adjustments/(:segment)', 'ReconciliationController::getAdjustment/$1');
    $routes->post('reconciliation/adjustments', 'ReconciliationController::createAdjustment');
    $routes->post('reconciliation/adjustments/(:segment)/void', 'ReconciliationController::voidAdjustment/$1');
    
    // Refunds
    $routes->get('reconciliation/refunds', 'ReconciliationController::getRefunds');
    $routes->post('reconciliation/refunds', 'ReconciliationController::createRefund');
    $routes->put('reconciliation/refunds/(:segment)/process', 'ReconciliationController::processRefund/$1');
    $routes->put('reconciliation/refunds/(:segment)/complete', 'ReconciliationController::completeRefund/$1');
    $routes->put('reconciliation/refunds/(:segment)/cancel', 'ReconciliationController::cancelRefund/$1');
    
    // Audit & History
    $routes->get('reconciliation/audit-log', 'ReconciliationController::getAuditLog');
    $routes->get('reconciliation/voided-charge-batches', 'ReconciliationController::getVoidedChargeBatches');
    $routes->get('reconciliation/student/(:segment)/history', 'ReconciliationController::getStudentHistory/$1');
    $routes->get('reconciliation/student/(:segment)/balance', 'ReconciliationController::getStudentBalanceDetail/$1');
    
    // Balance & Summary
    $routes->post('reconciliation/recalculate-balance', 'ReconciliationController::recalculateBalance');
    $routes->get('reconciliation/summary', 'ReconciliationController::getSummary');

    // Subscription
    $routes->group('subscription', function ($routes) {
        $routes->get('plans',                        'SubscriptionController::plans');
        $routes->get('current',                      'SubscriptionController::current');
        $routes->get('history',                      'SubscriptionController::history');
        $routes->get('invoices',                     'SubscriptionController::invoices');
        $routes->get('invoices/(:segment)/download', 'SubscriptionController::downloadInvoice/$1');
        $routes->get('events',                       'SubscriptionController::billingEvents');
        $routes->post('initiate',                    'SubscriptionController::initiate');
        $routes->get('poll/(:segment)',              'SubscriptionController::poll/$1');
        // Proration endpoints
        $routes->post('calculate-proration',         'SubscriptionController::calculateProration');
        $routes->post('upgrade-with-proration',      'SubscriptionController::upgradeWithProration');
        $routes->get('credits',                      'SubscriptionController::credits');
        $routes->get('proration-history',            'SubscriptionController::prorationHistory');
        // Grace usage tracking (expired subscriptions — 5 min/hour window)
        $routes->get('usage/status',                 'SubscriptionUsageController::status');
        $routes->post('usage/heartbeat',             'SubscriptionUsageController::heartbeat');
    });

});

// Public webhook — excluded from JWT auth filter via $globals except rule in Filters.php
$routes->post('api/subscription/webhook', '\App\Controllers\Api\SubscriptionController::webhook');

// ============================================
// Platform Admin Routes
// ============================================

$routes->group('api/platform', ['namespace' => 'App\Controllers\Platform', 'filter' => 'platform-jwt-auth'], function ($routes) {

    // Authentication (login + password reset are public — filter excludes them)
    $routes->post('auth/login',             'AuthController::login');
    $routes->post('auth/refresh',           'AuthController::refresh');
    $routes->get('auth/me',                 'AuthController::me');
    $routes->post('auth/impersonate',       'AuthController::impersonate');
    $routes->post('auth/stop-impersonation','AuthController::stopImpersonation');
    $routes->post('auth/forgot-password',   'AuthController::forgotPassword');
    $routes->post('auth/reset-password',    'AuthController::resetPassword');

    // Dashboard
    $routes->get('dashboard/kpis',          'DashboardController::kpis');
    $routes->get('dashboard/revenue',       'DashboardController::revenue');
    $routes->get('dashboard/plans',         'DashboardController::plans');
    $routes->get('dashboard/activity',      'DashboardController::activity');

    // Tenants
    $routes->get('tenants',                              'TenantsController::index');
    $routes->get('tenants/(:segment)/invoices',          'TenantsController::tenantInvoices/$1');
    $routes->get('tenants/(:segment)',                   'TenantsController::show/$1');
    $routes->post('tenants',                            'TenantsController::store');
    $routes->post('tenants/(:segment)/resend-welcome',  'TenantsController::resendWelcome/$1');
    $routes->post('tenants/(:segment)/suspend',         'TenantsController::suspend/$1');
    $routes->post('tenants/(:segment)/reactivate',      'TenantsController::reactivate/$1');
    $routes->delete('tenants/(:segment)',               'TenantsController::delete/$1');

    // Plans
    $routes->get('plans',                    'PlansController::index');
    $routes->get('plans/(:segment)',         'PlansController::show/$1');
    $routes->post('plans',                  'PlansController::store');
    $routes->put('plans/(:segment)',         'PlansController::update/$1');
    $routes->delete('plans/(:segment)',      'PlansController::delete/$1');

    // Subscriptions
    $routes->get('subscriptions',                              'SubscriptionsController::index');
    $routes->post('subscriptions/assign',                      'SubscriptionsController::assign');
    $routes->post('subscriptions/(:segment)/change-plan',     'SubscriptionsController::changePlan/$1');
    $routes->post('subscriptions/(:segment)/cancel',          'SubscriptionsController::cancel/$1');

    // Finance
    $routes->get('finance/summary',                       'FinanceController::summary');
    $routes->get('finance/invoices',                      'FinanceController::invoices');
    $routes->get('finance/invoices/(:segment)/pdf',       'FinanceController::invoicePdf/$1');
    $routes->post('finance/invoices/export',              'FinanceController::exportInvoices');

    // Analytics
    $routes->get('analytics/growth',        'AnalyticsController::growth');
    $routes->get('analytics/geography',     'AnalyticsController::geography');
    $routes->get('analytics/leaderboard',   'AnalyticsController::leaderboard');

    // Settings
    $routes->get('settings',                'SettingsController::index');
    $routes->put('settings',                'SettingsController::update');

    // Account (own)
    $routes->put('account',                 'SettingsController::updateAccount');
    $routes->put('account/password',        'SettingsController::updatePassword');

    // Team
    $routes->get('team',                                'SettingsController::team');
    $routes->post('team/invite',                        'SettingsController::inviteTeamMember');
    $routes->post('team/(:num)/resend-invite',          'SettingsController::resendInvite/$1');
    $routes->post('team/(:num)/deactivate',             'SettingsController::deactivateTeamMember/$1');
    $routes->delete('team/(:num)',                      'SettingsController::removeTeamMember/$1');
    $routes->put('team/(:num)/role',                    'SettingsController::changeTeamMemberRole/$1');

    $routes->get('auth/login-history',      'AuthController::loginHistory');

    // Demo Requests
    $routes->get('demo-requests',              'DemoRequestsController::index');
    $routes->get('demo-requests/(:segment)',   'DemoRequestsController::show/$1');
    $routes->patch('demo-requests/(:segment)', 'DemoRequestsController::update/$1');
    $routes->delete('demo-requests/(:segment)','DemoRequestsController::destroy/$1');

    // Audit Logs
    $routes->get('audit',                   'AuditController::index');
    $routes->post('audit/export',           'AuditController::export');

    // System Error Logs
    $routes->get('system-errors',                        'SystemErrorsController::index');
    $routes->get('system-errors/(:segment)',             'SystemErrorsController::show/$1');

    // Public (filter excludes via PUBLIC_PATHS)
    $routes->post('auth/accept-invite',     'AuthController::acceptInvite');

});

# Implementation Tasks: Admin Platform Console

**Feature**: 040-admin-console  
**Date**: 2026-04-21  
**Status**: In Progress  
**Total Tasks**: 78

## Phase 1: Setup & Infrastructure

### Goal
Create the foundational database schema, authentication infrastructure, and project structure needed for the platform admin console.

### Independent Test Criteria
- Database migrations run successfully without errors
- Platform JWT authentication filter correctly validates and rejects tokens
- Platform routes are registered and protected by the new filter

### Tasks

- [X] T001 Create platform_users table migration in backend/app/Database/Migrations/
- [X] T002 Create platform_settings table migration in backend/app/Database/Migrations/
- [X] T003 Create platform_api_keys table migration in backend/app/Database/Migrations/
- [X] T004 Create platform_audit table migration in backend/app/Database/Migrations/
- [X] T005 Create PlatformUser model in backend/app/Models/PlatformUser.php
- [X] T006 Create PlatformSetting model in backend/app/Models/PlatformSetting.php
- [X] T007 Create PlatformApiKey model in backend/app/Models/PlatformApiKey.php
- [X] T008 Create PlatformAudit model in backend/app/Models/PlatformAudit.php
- [X] T009 Create PlatformJWTAuthFilter in backend/app/Filters/PlatformJWTAuthFilter.php
- [X] T010 Update JWT config to support platform scope in backend/app/Config/Jwt.php
- [X] T011 Add platform route group to backend/app/Config/Routes.php
- [X] T012 Register platform-jwt-auth filter in backend/app/Config/Filters.php
- [X] T013 Create PlatformPolicy trait for RBAC in backend/app/Libraries/PlatformPolicy.php
- [X] T014 Create AuditService for logging in backend/app/Libraries/AuditService.php
- [X] T015 Create PlatformSeeder for initial data in backend/app/Database/Seeds/PlatformSeeder.php
- [X] T016 Create platform API client in admin-frontend/src/api/platform.ts
- [X] T017 Create platform auth hook in admin-frontend/src/hooks/usePlatformAuth.ts
- [X] T018 Update admin-frontend environment variables for platform API URL

## Phase 2: Authentication & Authorization

### Goal
Implement secure platform admin authentication with JWT, role-based access control, and session management.

### Independent Test Criteria
- Platform admins can log in with valid credentials
- Invalid or expired tokens are rejected with 401
- Tenant JWTs cannot access platform endpoints
- Role permissions are enforced on all platform endpoints

### Tasks

- [X] T019 [US1] Create Platform\AuthController in backend/app/Controllers/Platform/AuthController.php
- [X] T020 [US1] Implement login method with TOTP support in AuthController
- [X] T021 [US1] Implement refresh method in AuthController
- [X] T022 [US1] Implement me method in AuthController
- [X] T023 [US1] Create login page component in admin-frontend/src/pages/Login.tsx
- [X] T024 [US1] Implement auth form validation with React Hook Form in Login.tsx
- [X] T025 [US1] Add TOTP input component for 2FA in admin-frontend/src/components/TOTPInput.tsx
- [X] T026 [US1] Create ProtectedRoute wrapper for platform routes in admin-frontend/src/components/ProtectedRoute.tsx
- [X] T027 [US1] Update App.tsx to use ProtectedRoute and auth state
- [X] T028 [US1] Add token refresh interceptor to platform API client
- [X] T029 [US1] Create auth context provider in admin-frontend/src/contexts/AuthContext.tsx

## Phase 3: Dashboard (User Story 1)

### Goal
Build a real-time dashboard showing platform KPIs, charts, and recent activity for platform admins.

### Independent Test Criteria
- Dashboard loads with real data from backend APIs
- All KPIs reflect current database values
- Charts render correctly with 12-month data
- Recent activity feed shows platform events

### Tasks

- [X] T030 [US1] Create Platform\DashboardController in backend/app/Controllers/Platform/DashboardController.php
- [X] T031 [US1] Implement KPIs aggregation query in DashboardController
- [X] T032 [US1] Implement revenue trend query in DashboardController
- [X] T033 [US1] Implement plan distribution query in DashboardController
- [X] T034 [US1] Implement recent activity feed query in DashboardController
- [X] T035 [US1] Create Dashboard page component in admin-frontend/src/pages/Dashboard.tsx
- [X] T036 [US1] Create KPICard component in admin-frontend/src/components/KPICard.tsx
- [X] T037 [US1] Create RevenueChart component in admin-frontend/src/components/RevenueChart.tsx
- [X] T038 [US1] Create PlanDistributionChart component in admin-frontend/src/components/PlanDistributionChart.tsx
- [X] T039 [US1] Create RecentActivityFeed component in admin-frontend/src/components/RecentActivityFeed.tsx
- [X] T040 [US1] Create useDashboard hook in admin-frontend/src/hooks/useDashboard.ts
- [X] T041 [US1] Add dashboard routes to App.tsx

## Phase 4: Tenant Management (User Story 2)

### Goal
Enable platform admins to view, create, suspend, reactivate, and delete tenants with full lifecycle management.

### Independent Test Criteria
- Tenant list loads with pagination and filtering
- New tenant creation provisions database and sends email
- Suspend/reactivate actions block/restore tenant access
- Delete action works only for tenants without financial records

### Tasks

- [X] T042 [US2] Create Platform\TenantsController in backend/app/Controllers/Platform/TenantsController.php
- [X] T043 [US2] Implement index method with pagination/filtering in TenantsController
- [X] T044 [US2] Implement show method for tenant details in TenantsController
- [X] T045 [US2] Implement store method for tenant creation in TenantsController
- [X] T046 [US2] Implement suspend method in TenantsController
- [X] T047 [US2] Implement reactivate method in TenantsController
- [X] T048 [US2] Implement delete method in TenantsController
- [X] T049 [US2] Create Schools page component in admin-frontend/src/pages/Schools.tsx
- [X] T050 [US2] Create TenantList component in admin-frontend/src/components/TenantList.tsx
- [X] T051 [US2] Create TenantDetailPanel component in admin-frontend/src/components/TenantDetailPanel.tsx
- [X] T052 [US2] Create CreateTenantDialog component in admin-frontend/src/components/CreateTenantDialog.tsx
- [X] T053 [US2] Create TenantActions component in admin-frontend/src/components/TenantActions.tsx
- [X] T054 [US2] Create useTenants hook in admin-frontend/src/hooks/useTenants.ts
- [X] T055 [US2] Add tenant routes to App.tsx

## Phase 5: Impersonation Feature (User Story 2 Extension)

### Goal
Allow platform admins to impersonate tenant admin users for support purposes with proper audit logging.

### Independent Test Criteria
- Impersonation creates short-lived JWT with tenant scope
- Tenant UI shows impersonation banner
- All actions during impersonation are audit logged
- Platform admin can terminate impersonation

### Tasks

- [X] T056 [US2] Implement impersonate method in AuthController
- [X] T057 [US2] Implement stopImpersonation method in AuthController
- [X] T058 [US2] Add impersonation endpoints to routes
- [X] T059 [US2] Create ImpersonationButton component in admin-frontend/src/components/ImpersonationButton.tsx
- [X] T060 [US2] Update tenant detail panel to include impersonation
- [X] T061 [US2] Create impersonation banner component for tenant app
- [X] T062 [US2] Add impersonation audit logging to all platform controllers

## Phase 6: Plans & Subscriptions (User Story 3)

### Goal
Provide CRUD operations for plan tiers and subscription management with proration support.

### Independent Test Criteria
- Plans can be created, edited, and retired
- Active subscribers block plan deletion
- Subscription changes show proration preview
- Subscription cancellation updates status correctly

### Tasks

- [X] T063 [US3] Create Platform\PlansController in backend/app/Controllers/Platform/PlansController.php
- [X] T064 [US3] Implement plans CRUD methods in PlansController
- [X] T065 [US3] Create Platform\SubscriptionsController in backend/app/Controllers/Platform/SubscriptionsController.php
- [X] T066 [US3] Implement subscriptions index in SubscriptionsController
- [X] T067 [US3] Implement changePlan method with proration in SubscriptionsController
- [X] T068 [US3] Implement cancel method in SubscriptionsController
- [X] T069 [US3] Create Subscriptions page component in admin-frontend/src/pages/Subscriptions.tsx
- [X] T070 [US3] Create PlansGrid component in admin-frontend/src/components/PlansGrid.tsx
- [X] T071 [US3] Create PlanForm component in admin-frontend/src/components/PlanForm.tsx
- [X] T072 [US3] Create SubscriptionTable component in admin-frontend/src/components/SubscriptionTable.tsx
- [X] T073 [US3] Create ChangePlanDialog component in admin-frontend/src/components/ChangePlanDialog.tsx
- [X] T074 [US3] Create usePlans hook in admin-frontend/src/hooks/usePlans.ts
- [X] T075 [US3] Create useSubscriptions hook in admin-frontend/src/hooks/useSubscriptions.ts

## Phase 7: Finance (User Story 4)

### Goal
Display financial KPIs, invoice management, and CSV export functionality without payouts panel.

### Independent Test Criteria
- Finance KPIs match aggregated invoice data
- Invoice list supports filtering and pagination
- CSV export streams large datasets efficiently
- Invoice PDF download works for platform admins

### Tasks

- [X] T076 [US4] Create Platform\FinanceController in backend/app/Controllers/Platform/FinanceController.php
- [X] T077 [US4] Implement summary method with KPIs in FinanceController
- [X] T078 [US4] Implement invoices method with filtering in FinanceController
- [X] T079 [US4] Implement invoicePdf method in FinanceController
- [X] T080 [US4] Implement exportInvoices method with streaming in FinanceController
- [X] T081 [US4] Create Finance page component in admin-frontend/src/pages/Finance.tsx
- [X] T082 [US4] Create FinanceKPITiles component in admin-frontend/src/components/FinanceKPITiles.tsx
- [X] T083 [US4] Create InvoiceList component in admin-frontend/src/components/InvoiceList.tsx
- [X] T084 [US4] Create InvoiceFilters component in admin-frontend/src/components/InvoiceFilters.tsx
- [X] T085 [US4] Create CSVExportButton component in admin-frontend/src/components/CSVExportButton.tsx
- [X] T086 [US4] Create useFinance hook in admin-frontend/src/hooks/useFinance.ts

## Phase 8: Analytics (User Story 5)

### Goal
Show platform growth charts, geographic distribution, and tenant leaderboard.

### Independent Test Criteria
- Growth charts display 12-month trends
- Geographic widget aggregates by country
- Leaderboard shows top tenants by selected metric

### Tasks

- [X] T087 [US5] Create Platform\AnalyticsController in backend/app/Controllers/Platform/AnalyticsController.php
- [X] T088 [US5] Implement growth method in AnalyticsController
- [X] T089 [US5] Implement geography method in AnalyticsController
- [X] T090 [US5] Implement leaderboard method in AnalyticsController
- [X] T091 [US5] Create Analytics page component in admin-frontend/src/pages/Analytics.tsx
- [X] T092 [US5] Create GrowthChart component in admin-frontend/src/components/GrowthChart.tsx
- [X] T093 [US5] Create GeographicWidget component in admin-frontend/src/components/GeographicWidget.tsx
- [X] T094 [US5] Create Leaderboard component in admin-frontend/src/components/Leaderboard.tsx
- [X] T095 [US5] Create useAnalytics hook in admin-frontend/src/hooks/useAnalytics.ts

## Phase 9: Settings (User Story 6)

### Goal
Manage platform settings, team members, security toggles, and API keys.

### Independent Test Criteria
- Settings persist and apply globally
- Team invitations work with role-based permissions
- API keys show raw value only once at creation
- Security toggles enforce platform policies

### Tasks

- [X] T096 [US6] Create Platform\SettingsController in backend/app/Controllers/Platform/SettingsController.php
- [X] T097 [US6] Implement settings CRUD in SettingsController
- [X] T098 [US6] Implement team management methods in SettingsController
- [X] T099 [US6] Create Platform\ApiKeysController in backend/app/Controllers/Platform/ApiKeysController.php
- [X] T100 [US6] Implement API key CRUD in ApiKeysController
- [X] T101 [US6] Create Settings page component in admin-frontend/src/pages/Settings.tsx
- [X] T102 [US6] Create SettingsTabs component in admin-frontend/src/components/SettingsTabs.tsx
- [X] T103 [US6] Create GeneralSettingsTab component in admin-frontend/src/components/GeneralSettingsTab.tsx
- [X] T104 [US6] Create TeamTab component in admin-frontend/src/components/TeamTab.tsx
- [X] T105 [US6] Create SecurityTab component in admin-frontend/src/components/SecurityTab.tsx
- [X] T106 [US6] Create APIKeysTab component in admin-frontend/src/components/APIKeysTab.tsx
- [X] T107 [US6] Create EmailTemplatesTab component in admin-frontend/src/components/EmailTemplatesTab.tsx
- [X] T108 [US6] Create useSettings hook in admin-frontend/src/hooks/useSettings.ts
- [X] T109 [US6] Create useAPIKeys hook in admin-frontend/src/hooks/useAPIKeys.ts

## Phase 10: Polish & Cross-Cutting Concerns

### Goal
Add error handling, loading states, accessibility, and final integration touches.

### Independent Test Criteria
- All API errors show user-friendly toasts
- Loading states prevent duplicate actions
- UI is accessible and responsive
- Audit logging covers all mutations

### Tasks

- [X] T110 Add global error toast handler in admin-frontend/src/components/ErrorToast.tsx
- [ ] T111 Add loading states to all forms and async actions
- [ ] T112 Implement accessibility features (ARIA labels, keyboard navigation)
- [ ] T113 Add responsive design for tablet/mobile layouts
- [X] T114 Ensure audit logging is called from all platform controllers
- [X] T115 Add rate limiting to authentication endpoints
- [X] T116 Add CSV injection sanitization to export methods
- [X] T117 Add 2FA enforcement check to login flow
- [ ] T118 Add unit tests for platform models
- [ ] T119 Add feature tests for platform controllers
- [ ] T120 Add component tests for critical UI components
- [ ] T121 Update documentation and README files

## Dependencies

### Story Completion Order

1. **Phase 1** (Setup) - Required for all subsequent phases
2. **Phase 2** (Auth) - Required for all protected features
3. **Phase 3** (Dashboard - US1) - Independent after auth
4. **Phase 4** (Tenants - US2) - Independent after auth
5. **Phase 5** (Impersonation) - Depends on Phase 4
6. **Phase 6** (Plans/Subscriptions - US3) - Independent after auth
7. **Phase 7** (Finance - US4) - Independent after auth
8. **Phase 8** (Analytics - US5) - Independent after auth
9. **Phase 9** (Settings - US6) - Independent after auth
10. **Phase 10** (Polish) - Runs throughout development

### Critical Path

Phase 1 → Phase 2 → (Any of Phases 3-9 in parallel) → Phase 10

## Parallel Execution Opportunities

### Within Phases
- **Phase 1**: All migration and model tasks can be done in parallel
- **Phase 3**: Backend controller and frontend components can be built simultaneously
- **Phase 4**: Tenant CRUD operations can be parallelized
- **Phase 6**: Plans and subscriptions can be developed in parallel
- **Phase 9**: Settings tabs can be built independently

### Across Stories
After Phase 2 (auth is complete), teams can work on different user stories simultaneously:
- Team A: Dashboard (Phase 3)
- Team B: Tenant Management (Phase 4)
- Team C: Plans & Subscriptions (Phase 6)
- Team D: Finance (Phase 7)
- Team E: Analytics (Phase 8)
- Team F: Settings (Phase 9)

## Implementation Strategy

### MVP Scope (First Release)
1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Authentication)
3. Complete Phase 3 (Dashboard - US1)
4. Basic tenant listing (Phase 4, T042-T043, T049-T050)

This provides a functional admin console where users can log in, view platform health, and browse tenants.

### Incremental Delivery
1. **Week 1**: Setup and authentication (Phases 1-2)
2. **Week 2**: Dashboard and basic tenant management (Phases 3-4)
3. **Week 3**: Plans, subscriptions, and finance (Phases 6-7)
4. **Week 4**: Analytics, settings, and polish (Phases 8-10)

### Risk Mitigation
- Start with database migrations to ensure schema is correct
- Implement authentication early to test platform JWT flow
- Create audit logging service before implementing mutations
- Test CSV export with large datasets early in Finance phase
- Validate RBAC implementation with each controller

## Testing Strategy

### Backend Tests
- Unit tests for all platform models
- Feature tests for each controller endpoint
- Authorization matrix tests for all roles
- Integration tests for cross-tenant queries

### Frontend Tests
- Unit tests for custom hooks
- Component tests for UI components
- Integration tests for user flows
- Accessibility tests for keyboard navigation

### Manual Testing
- Cross-browser compatibility
- Mobile responsive design
- Performance with large datasets
- Security penetration testing

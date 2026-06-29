# Quickstart: Admin Platform Console

**Feature**: 040-admin-console  
**Date**: 2026-04-21  
**Status**: Draft

## Prerequisites

- PHP 8.1+ with CodeIgniter 4
- MySQL 8.0+
- Node.js 18+ (for frontend)
- Existing SchoolLedger tenant backend and frontend

## Backend Setup

### 1. Run Database Migrations

```bash
php spark migrate
```

This will create the new platform tables:
- `platform_users`
- `platform_settings`
- `platform_api_keys`
- `platform_audit`

### 2. Seed Initial Data

```bash
php spark db:seed PlatformSeeder
```

Creates:
- Default platform settings
- Initial Owner admin user (email: `admin@localhost`, password: `admin123`)

### 3. Update Routes

Add platform route group to `app/Config/Routes.php`:

```php
$routes->group('api/platform', ['filter' => 'platform-jwt-auth'], static function ($routes) {
    // Authentication
    $routes->post('auth/login', 'Platform\AuthController::login');
    $routes->post('auth/refresh', 'Platform\AuthController::refresh');
    $routes->post('auth/impersonate', 'Platform\AuthController::impersonate');
    $routes->post('auth/stop-impersonation', 'Platform\AuthController::stopImpersonation');
    $routes->get('auth/me', 'Platform\AuthController::me');
    
    // Tenants
    $routes->resource('tenants', ['controller' => 'Platform\TenantsController']);
    $routes->post('tenants/(:num)/suspend', 'Platform\TenantsController::suspend/$1');
    $routes->post('tenants/(:num)/reactivate', 'Platform\TenantsController::reactivate/$1');
    
    // Plans & Subscriptions
    $routes->resource('plans', ['controller' => 'Platform\PlansController']);
    $routes->get('subscriptions', 'Platform\SubscriptionsController::index');
    $routes->post('subscriptions/(:num)/change-plan', 'Platform\SubscriptionsController::changePlan/$1');
    $routes->post('subscriptions/(:num)/cancel', 'Platform\SubscriptionsController::cancel/$1');
    
    // Finance
    $routes->get('finance/summary', 'Platform\FinanceController::summary');
    $routes->get('finance/invoices', 'Platform\FinanceController::invoices');
    $routes->get('finance/invoices/(:num)/pdf', 'Platform\FinanceController::invoicePdf/$1');
    $routes->post('finance/invoices/export', 'Platform\FinanceController::exportInvoices');
    
    // Analytics
    $routes->get('analytics/growth', 'Platform\AnalyticsController::growth');
    $routes->get('analytics/geography', 'Platform\AnalyticsController::geography');
    $routes->get('analytics/leaderboard', 'Platform\AnalyticsController::leaderboard');
    
    // Settings
    $routes->get('settings', 'Platform\SettingsController::index');
    $routes->put('settings', 'Platform\SettingsController::update');
    $routes->get('team', 'Platform\SettingsController::team');
    $routes->post('team/invite', 'Platform\SettingsController::inviteTeamMember');
    $routes->delete('team/(:num)', 'Platform\SettingsController::removeTeamMember/$1');
    $routes->put('team/(:num)/role', 'Platform\SettingsController::changeTeamMemberRole/$1');
    $routes->resource('api-keys', ['controller' => 'Platform\ApiKeysController']);
});
```

### 4. Register Platform JWT Filter

Add to `app/Config/Filters.php`:

```php
public $aliases = [
    // ... existing aliases
    'platform-jwt-auth' => \App\Filters\PlatformJWTAuthFilter::class,
];

public $filters = [
    'before' => [
        // ... existing filters
        'platform-jwt-auth' => [
            'except' => [
                'api/platform/auth/login',
            ],
        ],
    ],
];
```

### 5. Update JWT Configuration

Add platform settings to `app/Config/Jwt.php`:

```php
public $platformSecretKey = getenv('JWT_PLATFORM_SECRET_KEY') ?: 'your-platform-secret-key';
public $platformTokenLifetime = HOUR; // 1 hour
public $impersonationTokenLifetime = MINUTE * 30; // 30 minutes
```

Add to `.env`:
```
JWT_PLATFORM_SECRET_KEY=your-super-secret-platform-key
```

## Frontend Setup

### 1. Install Dependencies

```bash
cd admin-frontend
npm install
```

### 2. Configure API Client

Create `src/api/platform.ts`:

```typescript
import axios from 'axios';

const baseURL = import.meta.env.VITE_PLATFORM_API_URL || 'http://localhost:8080/api/platform';

export const platformApi = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add auth token
platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('schoolledger_platform_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401/403
platformApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('schoolledger_platform_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 3. Add Environment Variables

Create `.env` in admin-frontend:

```
VITE_PLATFORM_API_URL=http://localhost:8080/api/platform
VITE_TENANT_APP_URL=http://localhost:5173
```

### 4. Update Authentication

Modify `src/hooks/useAuth.ts` to handle platform JWTs:

```typescript
export const usePlatformAuth = () => {
  const login = async (email: string, password: string, totpCode?: string) => {
    const response = await platformApi.post('/auth/login', {
      email,
      password,
      totp_code: totpCode,
    });
    
    const { token, user } = response.data;
    localStorage.setItem('schoolledger_platform_token', token);
    return { user };
  };
  
  const logout = () => {
    localStorage.removeItem('schoolledger_platform_token');
    window.location.href = '/login';
  };
  
  // ... other methods
};
```

### 5. Add Platform Routes

Update `src/App.tsx` to include platform routes:

```typescript
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="schools" element={<Schools />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="finance" element={<Finance />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings/*" element={<Settings />} />
      </Route>
    </Routes>
  );
}
```

## Development Workflow

### 1. Start Backend

```bash
php spark serve
```

Backend runs on `http://localhost:8080`

### 2. Start Frontend

```bash
cd admin-frontend
npm run dev
```

Frontend runs on `http://localhost:5174` (different port from tenant app)

### 3. Initial Login

1. Navigate to `http://localhost:5174/login`
2. Login with:
   - Email: `admin@localhost`
   - Password: `admin123`
3. You'll be prompted to set up 2FA (optional for development)

### 4. Test Platform Features

- **Dashboard**: Should show KPIs (will be 0 if no tenants exist)
- **Schools**: Create a test tenant
- **Subscriptions**: View plans and create subscriptions
- **Finance**: Check financial summary
- **Settings**: Update platform settings

## Testing

### Backend Tests

```bash
# Run platform-specific tests
php spark test --filter Platform
```

### Frontend Tests

```bash
cd admin-frontend
npm run test
```

### E2E Tests (Optional)

```bash
npm run test:e2e
```

## Deployment Notes

### Backend

- Ensure JWT secret keys are set in production environment
- Run migrations on production database
- Set up proper CORS for admin frontend domain

### Frontend

- Build with `npm run build`
- Deploy to separate domain/subdomain from tenant app
- Set production API URL in environment variables

### Security

- Enable HTTPS in production
- Set secure cookies if using cookie-based auth
- Configure rate limiting on auth endpoints
- Monitor audit logs for suspicious activity

## Troubleshooting

### Common Issues

1. **401 Unauthorized on platform endpoints**
   - Check JWT secret key configuration
   - Verify token includes `scope: "platform"`

2. **CORS errors**
   - Add admin frontend domain to CORS config
   - Ensure preflight requests are allowed

3. **2FA setup issues**
   - Verify time sync between server and client
   - Check TOTP secret storage

4. **Database connection errors**
   - Run migrations to ensure tables exist
   - Check database credentials in `.env`

### Debug Mode

Enable debug logging by setting in `.env`:
```
CI_ENVIRONMENT = development
```

This will provide detailed error messages and SQL queries.

## Next Steps

1. Review the generated tasks in `tasks.md`
2. Implement backend controllers and models
3. Build frontend components and pages
4. Set up comprehensive testing
5. Configure production deployment

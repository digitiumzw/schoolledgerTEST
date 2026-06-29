# Quickstart Guide: Dashboard Data Aggregation and Decision Support

**Feature Branch**: `069-dashboard-data-aggregation`  
**Date**: 2026-05-08  
**Purpose**: Development setup and implementation guide for dashboard functionality

## Overview

The dashboard module provides role-based, tenant-scoped views of real-time KPIs with pre-aggregated metrics for performance. This guide covers setup, development, testing, and deployment procedures.

## Prerequisites

### Development Environment
- PHP 8.1+ with CodeIgniter 4
- MySQL 8.0+ 
- Node.js 18+ with npm/yarn
- Git

### Required Accounts
- Admin user with dashboard access
- Bursar user with financial dashboard access
- Test tenant with sample data

## Setup Instructions

### 1. Database Setup

```bash
# Switch to feature branch
git checkout 069-dashboard-data-aggregation

# Run dashboard migrations
cd backend
php spark migrate

# Verify new tables created
mysql -u root -p -e "USE your_database; SHOW TABLES LIKE 'dashboard_%';"
```

**Expected Tables**:
- `dashboard_kpi_metrics`
- `dashboard_widgets` 
- `user_dashboard_preferences`

### 2. Backend Setup

```bash
# Install dependencies (if needed)
composer install

# Seed dashboard widgets
php spark db:seed DashboardWidgetSeeder

# Verify dashboard controller
php spark route:list | grep dashboard
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Background Job Setup

```bash
# Set up cron job for metric aggregation (every 5 minutes)
crontab -e

# Add this line (adjust paths as needed):
*/5 * * * * cd /path/to/backend && php spark dashboard:aggregate-metrics

# Verify cron job is running
crontab -l
```

## Development Workflow

### 1. Adding New KPI Metrics

**Backend - Create Metric Computation**:
```php
// In app/Services/DashboardAggregationService.php
public function computeCustomMetric(string $tenantId): array
{
    // Your metric computation logic
    $value = $this->calculateCustomValue($tenantId);
    
    return [
        'metric_key' => 'custom_metric',
        'metric_value' => $value,
        'metric_label' => number_format($value, 2),
        'period_start' => date('Y-m-d'),
        'period_end' => date('Y-m-d')
    ];
}
```

**Database - Register Widget**:
```sql
INSERT INTO dashboard_widgets 
(widget_key, widget_type, title, description, icon, required_roles, display_order, is_active)
VALUES 
('custom_metric', 'metric_card', 'Custom Metric', 'Description of custom metric', 'chart', 
'["admin", "bursar"]', 10, 1);
```

**Frontend - Add Widget Type**:
```typescript
// In src/types/dashboard.ts
export interface CustomMetricWidget extends DashboardWidget {
  widget_type: 'metric_card';
  metric_value: number;
  metric_label: string;
  custom_property?: string;
}
```

### 2. Creating Custom Widget Components

```tsx
// In src/components/dashboard/CustomMetricWidget.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomMetricWidgetProps {
  widget: DashboardWidget;
  metric: DashboardKpiMetric;
}

export const CustomMetricWidget: React.FC<CustomMetricWidgetProps> = ({
  widget,
  metric
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
        <widget.icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{metric.metric_label}</div>
        <p className="text-xs text-muted-foreground">{widget.description}</p>
      </CardContent>
    </Card>
  );
};
```

### 3. Adding Drill-Down Navigation

```php
// In backend widget configuration
'drill_down_config' => [
    'url' => '/students',
    'params' => [
        'status' => 'active',
        'metric_source' => 'dashboard_widget'
    ]
]
```

```tsx
// Frontend drill-down handler
const handleDrillDown = (widget: DashboardWidget) => {
  if (widget.drill_down_config) {
    const { url, params } = widget.drill_down_config;
    navigate(url, { state: params });
  }
};
```

## Testing Guide

### 1. Unit Tests

**Backend Tests**:
```bash
cd backend

# Run dashboard-specific tests
./vendor/bin/phpunit tests/Unit/DashboardAggregationServiceTest.php

# Run model tests
./vendor/bin/phpunit tests/Unit/DashboardKpiMetricModelTest.php
```

**Frontend Tests**:
```bash
cd frontend

# Run widget component tests
npm test src/components/dashboard/__tests__/

# Run hook tests
npm test src/hooks/__tests__/useDashboardData.test.ts
```

### 2. Integration Tests (curl)

**Authentication**:
```bash
# Login as admin
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' | \
  jq -r '.data.token')
```

**Dashboard Tests**:
```bash
# Test dashboard access
curl -s -X GET http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq

# Test widget preferences
curl -s -X GET http://localhost:8080/api/dashboard/preferences \
  -H "Authorization: Bearer $TOKEN" | jq

# Test metric refresh (admin only)
curl -s -X POST http://localhost:8080/api/dashboard/refresh \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"metrics":["attendance_rate_today"]}' | jq
```

### 3. Performance Tests

**Load Testing**:
```bash
# Test dashboard load time
time curl -s -X GET http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer $TOKEN" > /dev/null

# Test concurrent users (using ab or similar tool)
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/dashboard
```

## Data Management

### 1. Seeding Test Data

```bash
# Seed sample KPI metrics
php spark db:seed DashboardKpiMetricsSeeder

# Seed user preferences
php spark db:seed UserDashboardPreferencesSeeder

# Verify seeded data
mysql -u root -p -e "USE your_database; SELECT COUNT(*) FROM dashboard_kpi_metrics;"
```

### 2. Manual Metric Updates

```bash
# Force metric recomputation
php spark dashboard:aggregate-metrics --force

# Update specific metric only
php spark dashboard:aggregate-metrics --metric=attendance_rate_today

# Clean up expired metrics
php spark dashboard:cleanup-expired-metrics
```

### 3. Cache Management

```bash
# Clear dashboard cache
php spark cache:clear dashboard

# Warm up cache with fresh metrics
php spark dashboard:warm-cache

# Monitor cache hit rates
php spark dashboard:cache-stats
```

## Troubleshooting

### Common Issues

**Dashboard Not Loading**:
```bash
# Check authentication
curl -s -X GET http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq '.status'

# Check user roles
mysql -u root -p -e "SELECT role FROM users WHERE email='admin@example.com';"

# Verify widget configuration
mysql -u root -p -e "SELECT * FROM dashboard_widgets WHERE is_active=1;"
```

**Metrics Not Updating**:
```bash
# Check background job status
ps aux | grep "dashboard:aggregate-metrics"

# Check cron logs
tail -f /var/log/cron.log | grep dashboard

# Manually run aggregation
php spark dashboard:aggregate-metrics --verbose
```

**Performance Issues**:
```bash
# Check slow queries
mysql -u root -p -e "SHOW FULL PROCESSLIST;"

# Analyze query performance
php spark dashboard:analyze-queries

# Check cache effectiveness
php spark dashboard:cache-stats
```

### Debug Mode

```bash
# Enable debug logging
php spark dashboard:aggregate-metrics --debug

# Monitor real-time metrics
tail -f backend/logs/dashboard.log

# Check API response times
curl -w "@curl-format.txt" -s -X GET http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer $TOKEN" > /dev/null
```

## Deployment Checklist

### Pre-Deployment

- [ ] All migrations tested on staging
- [ ] Background jobs configured and tested
- [ ] Cache strategy validated
- [ ] Performance targets met (5s load, 95% cache hit)
- [ ] Security tests passed (tenant isolation, role enforcement)
- [ ] Integration tests executed via curl

### Post-Deployment

- [ ] Monitor background job execution
- [ ] Verify dashboard loading performance
- [ ] Check metric freshness (5-minute targets)
- [ ] Validate user preferences functionality
- [ ] Monitor error rates and logs

### Monitoring

```bash
# Check dashboard health
curl -s -X GET http://localhost:8080/api/dashboard/health | jq

# Monitor aggregation job performance
php spark dashboard:job-stats

# Check user activity
mysql -u root -p -e "SELECT COUNT(*) FROM user_dashboard_preferences WHERE updated_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);"
```

## API Reference

### Key Endpoints

| Endpoint | Method | Purpose | Roles |
|----------|--------|---------|-------|
| `/api/dashboard` | GET | Load user dashboard | admin, bursar |
| `/api/dashboard/widgets` | GET | Get widget definitions | admin, bursar |
| `/api/dashboard/preferences` | GET/PUT | Manage layout preferences | admin, bursar |
| `/api/dashboard/metrics/{key}` | GET | Get specific metric data | admin, bursar |
| `/api/dashboard/refresh` | POST | Force metric refresh | admin |

### Response Format

All endpoints follow the consistent response format:
```json
{
  "status": "success|error",
  "data": { ... },
  "message": "Human-readable message"
}
```

## Support

For issues with dashboard functionality:

1. Check this quickstart guide for common solutions
2. Review logs in `backend/logs/dashboard.log`
3. Verify database tables and data integrity
4. Test API endpoints directly with curl
5. Check background job execution status

## Next Steps

After completing setup:

1. Customize widgets for your specific needs
2. Add organization-specific KPIs
3. Configure automated monitoring
4. Train users on new dashboard functionality
5. Gather feedback for future enhancements

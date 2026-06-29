# Data Model: Dashboard Data Aggregation and Decision Support

**Date**: 2026-05-08  
**Feature**: Dashboard Data Aggregation and Decision Support  
**Purpose**: Define data entities, relationships, and validation rules for dashboard functionality

## Core Entities

### DashboardKpiMetric

Represents pre-aggregated key performance indicators computed by background jobs.

**Table**: `dashboard_kpi_metrics`

**Fields**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT)
- `tenant_id` (VARCHAR(36), FOREIGN KEY) - Multi-tenant isolation
- `metric_key` (VARCHAR(100)) - KPI identifier (e.g., 'attendance_rate', 'outstanding_payments')
- `metric_value` (DECIMAL(15,2)) - Numeric value of the metric
- `metric_label` (VARCHAR(255)) - Human-readable label (e.g., '85.5%', '$12,345')
- `period_start` (DATE) - Start date for period-based metrics
- `period_end` (DATE) - End date for period-based metrics
- `computed_at` (TIMESTAMP) - When the metric was computed
- `expires_at` (TIMESTAMP) - When the metric should be refreshed

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE KEY `unique_tenant_metric_period` (`tenant_id`, `metric_key`, `period_start`, `period_end`)
- INDEX `idx_tenant_metric` (`tenant_id`, `metric_key`)
- INDEX `idx_expires_at` (`expires_at`)

**Validation Rules**:
- `tenant_id` must be valid UUID format
- `metric_key` must be from predefined enum of supported KPIs
- `metric_value` must be non-negative where applicable
- `period_end` must be >= `period_start`
- `expires_at` must be > `computed_at`

### DashboardWidget

Defines widget configurations for different user roles.

**Table**: `dashboard_widgets`

**Fields**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT)
- `widget_key` (VARCHAR(100)) - Unique widget identifier
- `widget_type` (ENUM('metric_card', 'chart', 'table', 'summary')) - Display type
- `title` (VARCHAR(255)) - Widget display title
- `description` (TEXT) - Widget description
- `icon` (VARCHAR(100)) - Icon identifier
- `required_roles` (JSON) - Array of roles that can view this widget
- `display_order` (INT) - Order in dashboard
- `is_active` (BOOLEAN) - Whether widget is enabled
- `drill_down_config` (JSON) - Navigation configuration for drill-down
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE KEY `unique_widget_key` (`widget_key`)
- INDEX `idx_active_order` (`is_active`, `display_order`)

**Validation Rules**:
- `widget_key` must be unique and URL-safe
- `widget_type` must be from predefined enum
- `required_roles` must contain valid role names
- `display_order` must be non-negative

### UserDashboardPreference

Stores user-specific dashboard preferences and widget layouts.

**Table**: `user_dashboard_preferences`

**Fields**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT)
- `user_id` (BIGINT, FOREIGN KEY) - Reference to users table
- `tenant_id` (VARCHAR(36), FOREIGN KEY) - Multi-tenant isolation
- `widget_key` (VARCHAR(100)) - Reference to dashboard_widgets
- `is_visible` (BOOLEAN) - Whether user has this widget visible
- `position_x` (INT) - Grid position X coordinate
- `position_y` (INT) - Grid position Y coordinate
- `width` (INT) - Widget width in grid units
- `height` (INT) - Widget height in grid units
- `custom_config` (JSON) - User-specific widget configuration
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE KEY `unique_user_widget` (`user_id`, `widget_key`)
- INDEX `idx_tenant_user` (`tenant_id`, `user_id`)

**Validation Rules**:
- `user_id` must reference valid user
- `widget_key` must reference valid widget
- Position and size values must be non-negative
- `custom_config` must be valid JSON if provided

## Relationships

### Entity Relationship Diagram

```
users (1) ←→ (many) user_dashboard_preferences
    ↓
dashboard_widgets (1) ←→ (many) user_dashboard_preferences

tenant (1) ←→ (many) dashboard_kpi_metrics
tenant (1) ←→ (many) user_dashboard_preferences
```

### Relationship Rules

1. **UserDashboardPreference → DashboardWidget**: Many-to-one
   - Each preference references exactly one widget
   - Widget can have many user preferences
   - Cascading delete: Delete preferences when widget deleted

2. **UserDashboardPreference → User**: Many-to-one
   - Each preference belongs to exactly one user
   - User can have many widget preferences
   - Cascading delete: Delete preferences when user deleted

3. **DashboardKpiMetric → Tenant**: Many-to-one
   - Each metric belongs to exactly one tenant
   - Tenant can have many metrics
   - Cascading delete: Delete metrics when tenant deleted

## KPI Metric Definitions

### Supported Metric Keys

**Student Metrics**:
- `total_students` - Total active student count
- `new_enrollments_today` - New student enrollments today
- `new_enrollments_week` - New student enrollments this week
- `new_enrollments_month` - New student enrollments this month

**Attendance Metrics**:
- `attendance_rate_today` - Overall attendance rate for today
- `attendance_rate_week` - Average attendance rate this week
- `attendance_rate_month` - Average attendance rate this month
- `present_today` - Total present students today
- `absent_today` - Total absent students today
- `late_today` - Total late students today

**Financial Metrics**:
- `outstanding_payments` - Total unpaid balance amount
- `payments_collected_today` - Total payments received today
- `payments_collected_week` - Total payments received this week
- `payments_collected_month` - Total payments received this month
- `payment_collection_rate` - Percentage of fees collected

**Transport Metrics**:
- `active_transport_students` - Students using transport services
- `transport_utilization_rate` - Percentage of transport capacity used
- `transport_revenue_month` - Transport revenue this month

**Staff Metrics**:
- `total_staff` - Total active staff count
- `staff_present_today` - Staff present today
- `staff_attendance_rate` - Staff attendance rate

### Metric Computation Rules

**Period-Based Metrics**:
- Daily metrics: `period_start` = `period_end` = current date
- Weekly metrics: `period_start` = Monday of current week, `period_end` = Sunday
- Monthly metrics: `period_start` = First day of current month, `period_end` = Last day

**Real-Time Metrics**:
- Computed every 5 minutes
- `expires_at` = `computed_at` + 5 minutes
- Fallback to last known good data if computation fails

**Aggregation Rules**:
- All metrics scoped by `tenant_id`
- Use existing ledger balance calculations for financial metrics
- Use existing attendance aggregations for attendance metrics
- Optimize queries to avoid N+1 patterns

## Data Access Patterns

### Read Patterns

1. **Dashboard Load**: 
   ```sql
   SELECT dw.*, dkp.metric_value, dkp.metric_label
   FROM dashboard_widgets dw
   LEFT JOIN dashboard_kpi_metrics dkp ON dkp.metric_key = dw.widget_key 
       AND dkp.tenant_id = ? 
       AND dkp.expires_at > NOW()
   WHERE dw.is_active = 1 
       AND JSON_CONTAINS(dw.required_roles, ?)
   ORDER BY dw.display_order
   ```

2. **User Preferences**:
   ```sql
   SELECT udp.*, dw.title, dw.widget_type
   FROM user_dashboard_preferences udp
   JOIN dashboard_widgets dw ON dw.widget_key = udp.widget_key
   WHERE udp.user_id = ? AND udp.tenant_id = ?
   ORDER BY udp.position_y, udp.position_x
   ```

### Write Patterns

1. **Metric Update** (Background Job):
   ```sql
   INSERT INTO dashboard_kpi_metrics 
   (tenant_id, metric_key, metric_value, metric_label, period_start, period_end, computed_at, expires_at)
   VALUES (?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 5 MINUTE))
   ON DUPLICATE KEY UPDATE
   metric_value = VALUES(metric_value),
   metric_label = VALUES(metric_label),
   computed_at = VALUES(computed_at),
   expires_at = VALUES(expires_at)
   ```

2. **User Preference Update**:
   ```sql
   INSERT INTO user_dashboard_preferences 
   (user_id, tenant_id, widget_key, is_visible, position_x, position_y, width, height, custom_config)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE
   is_visible = VALUES(is_visible),
   position_x = VALUES(position_x),
   position_y = VALUES(position_y),
   width = VALUES(width),
   height = VALUES(height),
   custom_config = VALUES(custom_config),
   updated_at = NOW()
   ```

## Performance Considerations

### Indexing Strategy

- Composite unique indexes prevent duplicate metrics
- Expiration index enables efficient cleanup of stale data
- Tenant-scoped indexes ensure data isolation
- Widget ordering index for dashboard display

### Query Optimization

- Pre-aggregated metrics eliminate expensive joins
- Batch metric computation reduces database load
- Efficient pagination for large datasets
- Proper WHERE clause ordering for tenant isolation

### Caching Strategy

- Application-level caching for frequently accessed widgets
- Database query result caching for complex aggregations
- Frontend caching with 5-minute stale time
- Background job scheduling for metric freshness

## Security Considerations

### Data Isolation

- All queries include `tenant_id` filtering
- Role-based widget filtering at database level
- User preference isolation by user and tenant
- No cross-tenant data access possible

### Input Validation

- Metric keys validated against allowed values
- Role names validated against system roles
- JSON configuration validated for structure
- Numeric values validated for ranges

### Access Control

- Widget visibility enforced by required_roles
- User preferences scoped to authenticated user
- API endpoints protected by JWT authentication
- Drill-down navigation respects target page permissions

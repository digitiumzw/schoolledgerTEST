# Dashboard API Contracts

**Date**: 2026-05-08  
**Feature**: Dashboard Data Aggregation and Decision Support  
**Purpose**: Define REST API contracts for dashboard functionality

## Base Configuration

**Base URL**: `/api/dashboard`  
**Authentication**: JWT Bearer Token required  
**Content-Type**: `application/json`  
**Response Format**: Consistent JSON envelope per Constitution Principle VI

## Endpoints

### GET /api/dashboard

Retrieve the user's dashboard with role-appropriate widgets and current metrics.

**Authentication**: Required  
**Roles**: `admin`, `bursar`  
**Tenant Scoped**: Yes

**Query Parameters**:
- `refresh` (boolean, optional) - Force refresh of cached metrics

**Request**:
```json
GET /api/dashboard?refresh=false
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "widgets": [
      {
        "widget_key": "total_students",
        "widget_type": "metric_card",
        "title": "Total Students",
        "description": "Current number of active students",
        "icon": "users",
        "metric_value": 1250,
        "metric_label": "1,250",
        "trend": {
          "direction": "up",
          "percentage": 5.2,
          "period": "this month"
        },
        "drill_down": {
          "url": "/students",
          "params": {
            "status": "active"
          }
        },
        "last_updated": "2026-05-08T12:30:00Z",
        "is_fresh": true
      },
      {
        "widget_key": "attendance_rate_today",
        "widget_type": "metric_card",
        "title": "Today's Attendance",
        "description": "Overall attendance rate for today",
        "icon": "check-circle",
        "metric_value": 92.5,
        "metric_label": "92.5%",
        "trend": {
          "direction": "down",
          "percentage": 1.8,
          "period": "vs yesterday"
        },
        "drill_down": {
          "url": "/attendance",
          "params": {
            "date": "2026-05-08"
          }
        },
        "last_updated": "2026-05-08T12:30:00Z",
        "is_fresh": true
      }
    ],
    "summary": {
      "total_widgets": 8,
      "fresh_widgets": 7,
      "stale_widgets": 1,
      "last_refresh": "2026-05-08T12:30:00Z"
    }
  },
  "message": "Dashboard loaded successfully"
}
```

**Error Responses**:
```json
// 401 Unauthorized
{
  "status": "error",
  "message": "Authentication required"
}

// 403 Forbidden
{
  "status": "error",
  "message": "Insufficient permissions to access dashboard"
}
```

### GET /api/dashboard/widgets

Retrieve available widget definitions for the user's role.

**Authentication**: Required  
**Roles**: `admin`, `bursar`  
**Tenant Scoped**: Yes

**Response**:
```json
{
  "status": "success",
  "data": {
    "widgets": [
      {
        "widget_key": "total_students",
        "widget_type": "metric_card",
        "title": "Total Students",
        "description": "Current number of active students",
        "icon": "users",
        "required_roles": ["admin", "bursar"],
        "display_order": 1,
        "is_active": true,
        "drill_down_config": {
          "url": "/students",
          "params": {
            "status": "active"
          }
        }
      }
    ]
  },
  "message": "Widgets retrieved successfully"
}
```

### GET /api/dashboard/preferences

Retrieve user's dashboard layout preferences.

**Authentication**: Required  
**Roles**: `admin`, `bursar`  
**Tenant Scoped**: Yes

**Response**:
```json
{
  "status": "success",
  "data": {
    "preferences": [
      {
        "widget_key": "total_students",
        "is_visible": true,
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": 2,
          "height": 1
        },
        "custom_config": {}
      }
    ],
    "layout": {
      "columns": 4,
      "row_height": 100
    }
  },
  "message": "Preferences retrieved successfully"
}
```

### PUT /api/dashboard/preferences

Update user's dashboard layout preferences.

**Authentication**: Required  
**Roles**: `admin`, `bursar`  
**Tenant Scoped**: Yes

**Request**:
```json
{
  "preferences": [
    {
      "widget_key": "total_students",
      "is_visible": true,
      "position": {
        "x": 0,
        "y": 0
      },
      "size": {
        "width": 2,
        "height": 1
      },
      "custom_config": {}
    }
  ]
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "preferences": [
      {
        "widget_key": "total_students",
        "is_visible": true,
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": 2,
          "height": 1
        },
        "custom_config": {},
        "updated_at": "2026-05-08T12:30:00Z"
      }
    ]
  },
  "message": "Preferences updated successfully"
}
```

**Error Responses**:
```json
// 422 Unprocessable Entity
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "preferences.0.widget_key": ["Invalid widget key"],
    "preferences.0.position.x": ["Must be non-negative"]
  }
}
```

### GET /api/dashboard/metrics/{metric_key}

Retrieve specific metric data with historical trends.

**Authentication**: Required  
**Roles**: `admin`, `bursar`  
**Tenant Scoped**: Yes

**Path Parameters**:
- `metric_key` - The metric identifier (e.g., 'attendance_rate_today')

**Query Parameters**:
- `period` (string, optional) - Time period: 'week', 'month', 'quarter'
- `format` (string, optional) - Response format: 'json', 'csv'

**Response**:
```json
{
  "status": "success",
  "data": {
    "metric_key": "attendance_rate_today",
    "current_value": 92.5,
    "current_label": "92.5%",
    "historical_data": [
      {
        "date": "2026-05-08",
        "value": 92.5,
        "label": "92.5%"
      },
      {
        "date": "2026-05-07",
        "value": 94.3,
        "label": "94.3%"
      }
    ],
    "trends": {
      "daily": {
        "direction": "down",
        "change": -1.8
      },
      "weekly": {
        "direction": "up",
        "change": 2.1
      }
    },
    "last_updated": "2026-05-08T12:30:00Z"
  },
  "message": "Metric retrieved successfully"
}
```

### POST /api/dashboard/refresh

Trigger immediate refresh of dashboard metrics.

**Authentication**: Required  
**Roles**: `admin` only  
**Tenant Scoped**: Yes

**Request**:
```json
{
  "metrics": ["attendance_rate_today", "outstanding_payments"]
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "refresh_id": "refresh_123456",
    "status": "initiated",
    "metrics_queued": 2,
    "estimated_completion": "2026-05-08T12:35:00Z"
  },
  "message": "Refresh initiated successfully"
}
```

**Error Responses**:
```json
// 403 Forbidden
{
  "status": "error",
  "message": "Only administrators can trigger metric refresh"
}
```

## Data Types

### Widget Types

**metric_card**: Single numeric value with optional trend
```json
{
  "widget_type": "metric_card",
  "metric_value": 1250,
  "metric_label": "1,250",
  "trend": {
    "direction": "up|down|neutral",
    "percentage": 5.2,
    "period": "this month"
  }
}
```

**chart**: Visual chart data
```json
{
  "widget_type": "chart",
  "chart_type": "line|bar|pie",
  "data_points": [
    {"label": "Mon", "value": 85},
    {"label": "Tue", "value": 92}
  ],
  "axes": {
    "x": {"label": "Day of Week"},
    "y": {"label": "Attendance Rate"}
  }
}
```

**table**: Tabular data
```json
{
  "widget_type": "table",
  "headers": ["Class", "Students", "Attendance Rate"],
  "rows": [
    ["10A", 25, "96%"],
    ["10B", 23, "91%"]
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45
  }
}
```

**summary**: Key highlights
```json
{
  "widget_type": "summary",
  "highlights": [
    {
      "label": "Best Attendance",
      "value": "10A - 96%",
      "trend": "up"
    },
    {
      "label": "Needs Attention",
      "value": "10B - 78%",
      "trend": "down"
    }
  ]
}
```

### Trend Direction

- `up`: Positive trend/increase
- `down`: Negative trend/decrease  
- `neutral`: No significant change

### Drill Down Configuration

```json
{
  "url": "/target-page",
  "params": {
    "filter_key": "filter_value",
    "date_range": "2026-05-01:2026-05-08"
  }
}
```

## Rate Limiting

**Standard Endpoints**: 100 requests per minute per user  
**Refresh Endpoint**: 10 requests per minute per user (admin only)  
**Metrics Endpoint**: 200 requests per minute per user

## Caching Strategy

**Dashboard Data**: 5 minutes cache with stale-while-revalidate  
**Widget Definitions**: 1 hour cache  
**User Preferences**: No cache (real-time updates)  
**Historical Metrics**: 1 hour cache for periods > week

## Error Handling

### Standard Error Format

```json
{
  "status": "error",
  "message": "Human-readable error message",
  "errors": {
    "field_name": ["Specific validation error"]
  },
  "error_code": "VALIDATION_FAILED",
  "timestamp": "2026-05-08T12:30:00Z"
}
```

### Error Codes

- `AUTHENTICATION_REQUIRED` - No JWT token provided
- `INSUFFICIENT_PERMISSIONS` - User lacks required role
- `VALIDATION_FAILED` - Request validation failed
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `AGGREGATION_FAILED` - Background job failed
- `TENANT_ISOLATION_VIOLATION` - Cross-tenant access attempted

## Integration Testing Requirements

Per Constitution Principle X, the following curl-based tests must be executed after implementation:

### Happy Path Tests
1. Admin user can access dashboard with role-appropriate widgets
2. Bursar user can access dashboard with financial-focused widgets
3. User can update dashboard preferences successfully
4. Metrics endpoint returns historical data correctly
5. Admin can trigger metric refresh successfully

### Error Path Tests
1. Unauthenticated user receives 401 error
2. User without dashboard role receives 403 error
3. Invalid widget configuration returns 422 error
4. Non-existent metric returns 404 error
5. Rate limiting returns 429 error

### Tenant Isolation Tests
1. User cannot access metrics from different tenant
2. Widget preferences isolated per tenant
3. Role enforcement works across tenant boundaries
4. Cross-tenant API calls return 404 errors

### Performance Tests
1. Dashboard loads within 5 seconds for 50k records
2. Concurrent user access (100 users) maintains performance
3. Cache hit ratio meets 95% target
4. Background aggregation completes within 5 minutes

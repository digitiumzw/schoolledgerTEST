# Contract: Admin Analytics API

## Purpose

Defines the backend-prepared response shape for the admin Analytics page and related drill-down widgets.

## Endpoints in scope

### GET `/api/platform/analytics/growth`

Returns tenant growth and revenue growth data for the Analytics page.

#### Query parameters
- `tenant_id` optional tenant filter for platform users who are allowed to narrow the view
- `status` optional payment or subscription status filter where supported
- `from` optional lower bound date
- `to` optional upper bound date

#### Expected response
```json
{
  "status": "success",
  "data": {
    "summary": {
      "totalTenants": 245,
      "monthsTracked": 12,
      "newThisMonth": 12
    },
    "tenant_growth": [
      {
        "month": "2026-05",
        "monthLabel": "May 2026",
        "new_tenants": 12,
        "newTenants": 12,
        "cumulative_tenants": 245,
        "cumulativeTenants": 245
      }
    ],
    "revenue_growth": [
      {
        "month": "2026-05",
        "monthLabel": "May 2026",
        "revenue": 1234.56,
        "displayValue": "$1,234.56",
        "comparisonValue": 1111.11,
        "deltaPercent": 11.11
      }
    ]
  }
}
```

#### Contract expectations
- The backend must return chart-ready series only.
- Any comparison or percentage change must already be computed server-side.
- The frontend must only render the returned series.

### GET `/api/analytics/leaderboard`

Returns ranked analytics data for the selected metric.

#### Query parameters
- `metric` required ranking dimension such as `mrr`, `students`, or `revenue`

#### Expected response
```json
{
  "status": "success",
  "data": [
    {
      "id": "tenant-1",
      "name": "School A",
      "value": 1234.56,
      "displayValue": "$1,234.56",
      "progressPercent": 100
    }
  ]
}
```

#### Contract expectations
- Ranking and ordering must be done server-side.
- The response must contain only the top records required by the page.
- No client-side ranking or normalization is permitted beyond display formatting.

## Rules

- Responses must be tenant- and role-aware where applicable.
- The frontend must treat these endpoints as authoritative sources of truth.
- Payloads must be minimal and ready for direct rendering.

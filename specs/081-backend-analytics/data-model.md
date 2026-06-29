# Data Model: Backend-Driven Admin Analytics

## Analytics Summary

Represents the server-prepared headline metrics and chart-ready values displayed on the admin Analytics page.

### Key fields
- **scope**: Tenant and role context used to produce the summary.
- **period**: Reporting period or selected date range.
- **metrics**: Named values such as revenue, outstanding balances, counts, growth, and ratios.
- **comparisons**: Prior-period or trend comparisons already computed by the backend.
- **breakdowns**: Category or grouping aggregates ready for display.

### Relationships
- Derived from one or more backend analytic queries.
- Consumed by the Analytics page and related dashboard widgets.

### Validation rules
- Must match the active tenant and permission scope.
- Must use the same filters as the visible data rows when a filtered view is requested.
- Must remain renderable even when a metric has no data.

## Analytics Query Context

Represents the active search, filter, and pagination state used to request analytics or payment-history data.

### Key fields
- **tenant**: The authorized tenant context.
- **role**: The user's role-based access scope.
- **searchTerm**: User-entered query string.
- **filters**: Date range, status, category, class, payment type, or similar constraints.
- **sort**: Active sort field and direction.
- **pagination**: Page number and page size.

### Relationships
- Drives the backend query used for result pages and summary calculations.
- Must be passed from frontend to backend unchanged except for validation/normalization.

### Validation rules
- Invalid page, sort, or filter inputs must be rejected or normalized by the backend.
- Pagination must stay bounded to the server-requested page size.
- Search and filters must be applied before any totals or summaries are computed.

## Analytics Result Page

Represents a backend-prepared table/list response for analytics-linked detail views.

### Key fields
- **rows**: The visible records for the requested page.
- **pagination**: Current page, page size, total records, and total pages.
- **summary**: Totals, counts, and any relevant breakdowns.
- **filtersApplied**: Normalized filters used for the response.

### Relationships
- Used by payment history, reports, leaderboard/detail screens, and other drill-down views.
- May share one backend query context with multiple visible widgets.

### Validation rules
- Must not include unbounded historical datasets when the view only needs a page.
- Must remain internally consistent between rows, totals, and pagination metadata.
- Must not force the frontend to derive authoritative values.

## Related Reporting View

Represents a screen that depends on analytics-derived values, such as payment history, receipts, reconciliation, or drill-down reporting.

### Key fields
- **viewType**: The report or detail screen being rendered.
- **sourceContext**: Filters or period selected from the originating analytics view.
- **displayRows**: Backend-prepared rows needed by the specific view.
- **supportingMetrics**: Any totals or summary values needed for the view.

### Relationships
- Reuses the analytics query context when users navigate between connected views.
- Should request only the data needed for the current screen.

### Validation rules
- Must not rebuild full historical datasets in the browser.
- Must preserve the active context across navigation when the user expects continuity.
- Must remain tenant-scoped and role-aware.

## Prepared Metric

Represents a server-computed value that is ready for display without client-side recalculation.

### Key fields
- **name**: The metric label.
- **value**: The current computed number or amount.
- **comparisonValue**: The prior or baseline value used for comparison, if applicable.
- **deltaPercent**: The change percentage, if applicable.
- **status**: Optional semantic meaning such as positive, warning, or neutral.

### Relationships
- Can appear in Analytics summary cards, charts, and related reporting sections.

### Validation rules
- Must be computed consistently with the dataset and filters used for the result page.
- Must remain stable when historical comparison data is unavailable.

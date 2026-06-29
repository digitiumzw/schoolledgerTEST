# Quickstart: Backend-Driven Admin Analytics

## Goal

Verify that the admin Analytics page and related payment-history/reporting views are fully backend-driven and performant.

## Local setup

- Start the backend and frontend for SchoolLedger.
- Sign in with an admin or bursar account that can access the Analytics page and payment history.

## What to verify

### 1. Analytics overview

- Open the admin Analytics page.
- Confirm the visible summary cards and charts are populated from backend responses.
- Confirm any trend or comparison value is already computed when received by the browser.

### 2. Search, filter, and pagination

- Use any analytics-linked table or payments history view that supports search and filters.
- Apply a search term, filter combination, and page change.
- Confirm the browser updates by requesting a new backend page instead of filtering a large client-side list.

### 3. Related payment/report views

- Open a payment receipt, payment history modal, or drill-down report linked from analytics.
- Confirm the view requests only the minimum record detail needed for that screen.
- Confirm no full-history client-side recalculation is needed to render the result.

### 4. Performance sanity checks

- Review response sizes and timing for the analytics and payment-history endpoints.
- Confirm the backend returns bounded pages, summary metadata, and only the fields needed by the current screen.
- Confirm repeated database work is not visible in the implementation path for a single page render.

## Recommended validation checklist

- Analytics overview renders without client-side aggregation.
- Filtered payment history returns matching rows and backend totals.
- Pagination metadata matches the returned page of records.
- Related views remain tenant-scoped and role-aware.
- No stale summary values appear after refresh or page navigation.

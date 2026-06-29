# Research: Backend-Driven Admin Analytics

## Decision 1: Keep analytics data preparation backend-first

- **Decision**: Move all analytics summary assembly, chart series construction, filtering, searching, pagination, and computed metrics to backend endpoints.
- **Rationale**: The current admin analytics page already uses backend endpoints for growth and leaderboard data, but the React page still transforms and derives display values locally. The spec requires authoritative server-prepared responses so the browser becomes a thin renderer and the same contract can scale to larger datasets.
- **Alternatives considered**:
  - Keep client-side derivations and only optimize the backend for partial data. Rejected because it still allows inconsistent counts, duplicated logic, and full-history browser processing.
  - Push only summary cards to the backend while leaving tables/search client-side. Rejected because the feature explicitly requires all loading, filtering, searching, pagination, and computations to be backend-owned.

## Decision 2: Extend existing analytics endpoints rather than introducing a separate analytics service layer

- **Decision**: Reuse the existing platform analytics controller and payment-history API surfaces, but reshape their responses so they return precomputed view-ready payloads.
- **Rationale**: The repository already contains platform analytics endpoints and a heavily optimized payments history controller/model path. Extending those surfaces is lower risk than creating a parallel analytics stack and avoids fragmenting role and tenant checks.
- **Alternatives considered**:
  - Introduce a separate analytics microservice. Rejected because it would add operational complexity and duplicate tenant/permission rules.
  - Rebuild the pages with client aggregation libraries. Rejected because it conflicts with the backend-driven data principle and would not solve performance at scale.

## Decision 3: Use server-side pagination, filtered counts, and summary queries for payments history

- **Decision**: Preserve the current pattern of backend pagination and filtered summary queries for payment history, while tightening the API contracts so the frontend never slices or aggregates the full dataset.
- **Rationale**: The Payments page already uses paginated backend requests and server-returned summary metadata. This is the strongest existing pattern to extend for scalability and keeps the browser from handling complete datasets.
- **Alternatives considered**:
  - Load a larger full-history payload and paginate locally. Rejected because it increases memory usage, transfer size, and stale-data risk.
  - Compute totals in the React layer from the visible rows only. Rejected because visible-page summaries would not match the full filtered dataset.

## Decision 4: Optimize repeated database access with bounded queries and shared aggregates

- **Decision**: Design the backend responses around bounded query patterns, shared summary lookups, server-side pagination metadata, and pre-aggregation/caching where a metric is reused across multiple widgets.
- **Rationale**: Analytics and payment history are high-volume surfaces. The plan must keep query counts bounded and avoid per-row repeated lookups when rendering pages or drill-downs.
- **Alternatives considered**:
  - Use many per-widget queries and let the frontend combine them. Rejected because it increases database hits and makes response times unpredictable.
  - Cache everything aggressively without query review. Rejected because stale data and invalidation complexity would be hard to control.

## Decision 5: Preserve frontend presentation responsibilities only

- **Decision**: The frontend may format backend-provided values for display, but it must not decide what records match filters or compute authoritative totals, page counts, or rankings.
- **Rationale**: This keeps the React layer thin, avoids duplicated business logic, and aligns with the constitution’s backend-driven data principle.
- **Alternatives considered**:
  - Keep lightweight frontend sorting/filtering for convenience. Rejected because it creates divergence between what the user sees and what the backend authoritatively reports.

## Notes for planning

- The admin Analytics page currently consumes `platform` analytics endpoints for growth and leaderboard data.
- The Payments page already depends on backend pagination and filtered summaries, but the payment history modal and supporting views still need review to ensure they do not reintroduce client-side processing.
- The implementation should prefer minimal API payloads, explicit pagination metadata, and summary fields that are directly renderable by the UI.

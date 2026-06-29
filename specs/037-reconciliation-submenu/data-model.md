# Data Model: Move Reconciliation Under Payments Submenu

**Date**: 2026-04-17  
**Feature**: 037-reconciliation-submenu

## Status: N/A

This feature involves **no data model changes**. It is a pure frontend presentation and navigation restructuring.

### What This Means

- No new database entities
- No changes to existing entities
- No schema migrations required
- No API contract changes

### Affected Components (Frontend Only)

1. **Navigation Component** - UI structure only, no data model
2. **Route Configuration** - URL path changes only
3. **Reconciliation Page** - Responsive styling only

### Existing Data Flow (Unchanged)

```
Reconciliation Page → API (/api/reconciliation/*) → Database
```

The reconciliation page will continue to fetch data from the same API endpoints. Only the presentation layer (URL, navigation, responsive layout) is modified.

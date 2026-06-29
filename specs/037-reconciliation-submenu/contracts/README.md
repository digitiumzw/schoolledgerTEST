# API Contracts: Move Reconciliation Under Payments Submenu

**Date**: 2026-04-17  
**Feature**: 037-reconciliation-submenu

## Status: No New Contracts Required

This feature involves **no new API contracts**. It is a pure frontend navigation and UI change.

### Existing Contracts (Unchanged)

The reconciliation page continues to use existing API endpoints:

- `GET /api/reconciliation` - Fetch reconciliation data
- Any other existing reconciliation endpoints

### What Changed

- **Frontend Route**: `/reconciliation` → `/payments/reconciliation`
- **Navigation Structure**: Reconciliation moved under Payments submenu
- **Responsive Design**: CSS/layout updates only

No backend API modifications are required for this feature.

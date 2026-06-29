# Implementation Plan: Move Reconciliation Under Payments Submenu

**Branch**: `037-reconciliation-submenu` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/037-reconciliation-submenu/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Restructure the navigation by moving the reconciliation page under the Payments menu as a submenu item. Update the reconciliation page to be fully responsive across all device sizes (320px to 2560px). This involves frontend changes to the navigation component, route restructuring, and responsive CSS updates to the reconciliation page.

## Technical Context

**Language/Version**: PHP 8.1+ (Backend), TypeScript/React 18 (Frontend)
**Primary Dependencies**: CodeIgniter 4 (Backend), React 18 + Vite + TailwindCSS + shadcn/ui (Frontend), TanStack React Query, React Hook Form + Zod
**Storage**: MySQL (existing, no schema changes needed)
**Testing**: Jest/Vitest for frontend, PHPUnit for backend
**Target Platform**: Web (Chrome, Firefox, Safari, Edge - modern browsers)
**Project Type**: Web application (React SPA + REST API)
**Performance Goals**: Page load < 2s, responsive breakpoints at 768px and 1024px
**Constraints**: Must maintain backward compatibility with old reconciliation URLs via redirects
**Scale/Scope**: Single feature affecting navigation and one page UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Multi-Tenant Data Isolation** | ✅ N/A | This is a frontend navigation/UI change only. No database queries involved. |
| **II. API-First Separation of Concerns** | ✅ PASS | Frontend-only changes to navigation component and page styling. No backend API modifications required. |
| **III. JWT Authentication & Role-Based Access** | ✅ PASS | Navigation items should respect existing role-based visibility patterns (if applicable). No new routes created on backend. |
| **IV. Immutable Migrations** | ✅ PASS | No database schema changes required for this feature. |
| **V. Financial Ledger Integrity** | ✅ PASS | No changes to ledger calculations, balance queries, or financial data. Purely UI/UX changes. |

**Constitution Compliance**: ✅ ALL PRINCIPLES PASSED - No violations or justifications needed.

## Project Structure

### Documentation (this feature)

```text
specs/037-reconciliation-submenu/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/                          # CodeIgniter 4 Backend
├── Config/
│   ├── Routes.php           # Route definitions
│   └── Filters.php          # JWTAuthFilter registration
├── Controllers/
│   └── Api/                 # API controllers (no changes needed)
└── Database/
    └── Migrations/            # No new migrations needed

src/                          # React Frontend
├── components/
│   └── ui/                  # shadcn/ui components
├── pages/
│   └── reconciliation/      # Reconciliation page (needs responsive updates)
├── components/
│   └── navigation/          # Navigation/sidebar components (needs submenu support)
├── api/
│   └── api.ts              # Axios instance
├── hooks/                   # Custom React hooks
└── lib/
    └── utils.ts            # Utility functions

public/                      # Static assets
tests/                       # Test files (if separate from src)
```

**Structure Decision**: SchoolLedger follows a standard React SPA + CodeIgniter 4 API structure. Frontend source is in `src/` with components, pages, and hooks. Backend is in `app/` following CodeIgniter 4 conventions. This feature primarily touches the navigation components in `src/components/navigation/` and the reconciliation page in `src/pages/reconciliation/`.

## Complexity Tracking

> **No Constitution violations to justify - all principles passed.**

---

## Phase 0: Research & Unknown Resolution

### Research Tasks Completed

This feature involves well-established frontend patterns with no significant unknowns. The following decisions were made based on project context:

#### Navigation Pattern Decision
- **Decision**: Use a collapsible submenu pattern under the Payments menu item
- **Rationale**: SchoolLedger uses shadcn/ui components which include NavigationMenu and Collapsible primitives. This aligns with existing UI patterns.
- **Alternatives considered**: 
  - Separate Reconciliation menu item (rejected - doesn't meet grouping requirement)
  - Mega-menu pattern (rejected - overkill for single submenu item)

#### Responsive Approach Decision
- **Decision**: Use TailwindCSS responsive breakpoints (sm:, md:, lg:) with container queries where needed
- **Rationale**: Project already uses TailwindCSS; responsive tables will use horizontal scroll containers or card-based layouts on mobile
- **Alternatives considered**:
  - CSS Grid reflow (rejected - tables need to maintain row/column relationships)
  - Separate mobile page (rejected - duplicate maintenance burden)

#### URL Structure Decision
- **Decision**: Change reconciliation route from `/reconciliation` to `/payments/reconciliation`
- **Rationale**: Reflects new navigation hierarchy; old URL will redirect to new location
- **Implementation**: React Router redirect + optional backend 301 for direct URL access

---

## Phase 1: Design & Contracts

### Data Model

No new data entities required. This is a pure frontend presentation change.

### API Contracts

No new API contracts required. Existing reconciliation data fetching remains unchanged.

### Route Changes

| Route | Before | After | Notes |
|-------|--------|-------|-------|
| Reconciliation Page | `/reconciliation` | `/payments/reconciliation` | Old route redirects to new |

### Navigation Structure Update

```typescript
// Navigation item structure (existing)
interface NavItem {
  label: string;
  path: string;
  icon?: React.ComponentType;
  children?: NavItem[];  // NEW: submenu support
}

// Updated Payments menu item
{
  label: "Payments",
  path: "/payments",
  icon: PaymentIcon,
  children: [
    { label: "Reconciliation", path: "/payments/reconciliation" }  // NEW
  ]
}
```

### Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 768px | Tables scroll horizontally, touch targets 44x44px, stacked layout |
| Tablet | 768px - 1024px | Adapted spacing, optimized column widths |
| Desktop | > 1024px | Full layout, all columns visible |

---

## Generated Artifacts

- ✅ `research.md` - Research decisions documented
- ✅ `data-model.md` - No data model changes (N/A)
- ✅ `contracts/` - No new API contracts (N/A)  
- ✅ `quickstart.md` - Development/testing instructions
- ✅ `tasks.md` - Implementation tasks generated with 49 tasks across 5 phases

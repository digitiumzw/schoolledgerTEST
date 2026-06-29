# Implementation Plan: Role-Based Help Page

**Branch**: `088-role-based-help-page` | **Date**: 2026-06-10 | **Spec**: [specs/088-role-based-help-page/spec.md](specs/088-role-based-help-page/spec.md)
**Input**: Feature specification from `/specs/088-role-based-help-page/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Redesign the existing Help page from a "Coming Soon" placeholder into a complete, role-based user guide. The page dynamically scopes its content to the logged-in user's role (super_admin, admin, bursar, teacher), displaying only help topics for features the user can access. The implementation is frontend-only: static help content structured as typed data files, a redesigned Help page with search, table of contents, and scroll-spy, plus contextual help links on key module pages. No backend changes, no database schema changes, and no new API endpoints are required.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite  
**Primary Dependencies**: React 18, TailwindCSS, shadcn/ui, TanStack React Query (existing auth context), React Router DOM (existing), Lucide React (existing icons)  
**Storage**: N/A — help content is static TypeScript data artifacts, not persisted in a database  
**Testing**: Frontend TypeScript type-check (`tsc --noEmit`) and ESLint; no backend curl tests since no new endpoints are introduced  
**Target Platform**: Web browser (desktop primary, tablet secondary, mobile responsive)  
**Project Type**: Web application (frontend-only page redesign within existing React SPA)  
**Performance Goals**: Full page render with all sections and search functional in under 2 seconds; search filtering responds in under 100ms for the expected content volume  
**Constraints**: Must not expose help content for features outside the user's role; static content only (no CMS/backend round-trips for v1); must reuse existing design system components  
**Scale/Scope**: Single page component + ~3 new component files + 1 content data file + contextual link integration on ~10 module pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle I (Multi-Tenant Data Isolation)**: PASS — No new backend endpoints or database queries introduced.

**Principle II (API-First Separation of Concerns)**: PASS — This is a frontend-only static content feature. No backend logic is added.

**Principle III (JWT Authentication & Role-Based Access)**: PASS — Help content scoping uses the existing `user.role` from AuthContext. No new routes or auth mechanisms.

**Principle IV (Immutable Migrations)**: PASS — No schema changes.

**Principle V (Financial Ledger Integrity)**: PASS — No ledger code touched.

**Principle VI (REST API Standards)**: PASS — No new endpoints.

**Principle VII (Code Quality & Maintainability)**: PASS — Content will be structured as typed data (not inline JSX strings), with clear separation between content data, page layout, and reusable components.

**Principle VIII (Defensive Security)**: PASS — No new user inputs; role scoping is read-only from existing auth context.

**Principle IX (Error Handling & Observability)**: PASS — No new error paths introduced.

**Principle X (API Endpoint Testing)**: N/A — No new backend endpoints.

**Principle XI (Backend-Driven Data & Performance)**: NOT APPLICABLE — Help content is static documentation, not tenant data. The spec explicitly states (FR-016) that no backend round-trips are required and content is maintained as code artifacts. No client-side filtering of tenant data occurs; search filters only over static help content scoped by role at compile time.

**Principle XII (Mutation Loading States)**: NOT APPLICABLE — This feature contains no mutations (create, update, delete, submit). It is read-only documentation.

**Principle XIII (Email Design System)**: N/A — No email communications involved.

**Re-evaluation after Phase 1**: All gates continue to pass. No constitution violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/088-role-based-help-page/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/
│   │   └── Help.tsx                 # Complete rewrite of Help page
│   ├── components/
│   │   └── help/
│   │       ├── HelpSearch.tsx       # Search input + filter logic
│   │       ├── HelpTableOfContents.tsx # Sticky TOC with scroll-spy
│   │       ├── HelpSection.tsx      # Rendered help section with steps
│   │       ├── ScreenshotPlaceholder.tsx # Styled image placeholder
│   │       └── ContextualHelpLink.tsx # Reusable help trigger for module pages
│   ├── lib/
│   │   └── helpContent.ts           # Static help content data structure
│   ├── types/
│   │   └── help.ts                  # TypeScript types for help entities
│   └── hooks/
│       └── useHelpSearch.ts       # Search/filter hook over static content
```

**Structure Decision**: Option 2 (Web application with frontend/backend separation). Only frontend files are modified. The existing `frontend/src/pages/Help.tsx` is completely rewritten. New component files are placed under `frontend/src/components/help/` following the existing component organization pattern. Static content data is placed in `frontend/src/lib/helpContent.ts` alongside other utility/data files like `studentUtils.ts` and `transportUtils.ts`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All constitution principles are either satisfied or correctly identified as not applicable for this frontend-only, read-only documentation feature.

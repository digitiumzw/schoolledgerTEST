# Implementation Plan: Onboarding Guided Tutorial

**Branch**: `076-onboarding-guided-tutorial` | **Date**: 2026-05-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/076-onboarding-guided-tutorial/spec.md`

## Summary

Streamline school onboarding by removing fee structure configuration from the initial wizard, adding phone number capture, and introducing two separate guidance experiences after onboarding: a tenant-level recommended setup guide and a per-user role-aware module tutorial. The implementation will update the existing onboarding wizard/backend completion rules, add tenant-scoped setup guide state, add user-scoped tutorial progress, expose REST contracts for the new state/content, and render frontend guidance through reusable hooks/components.

## Technical Context

**Language/Version**: PHP 8.1+ backend; React 18 + TypeScript frontend  
**Primary Dependencies**: CodeIgniter 4, MySQL, JWT auth, React Router, TanStack React Query, React Hook Form, Zod, TailwindCSS, shadcn/ui  
**Storage**: MySQL tables for onboarding progress, tenant-scoped setup guide progress, and per-user tutorial progress; existing tenant/user tables for profile/contact fields  
**Testing**: PHP lint, frontend TypeScript `tsc --noEmit`, targeted ESLint for touched frontend files, curl endpoint validation after implementation  
**Target Platform**: Web application with REST API backend and React SPA frontend  
**Project Type**: Full-stack web application (`backend/` + `frontend/`)  
**Performance Goals**: Setup guide and tutorial state should load with the dashboard/login experience without noticeable delay; avoid N+1 module permission checks by deriving tutorial content from current authenticated user context and static definitions  
**Constraints**: Tenant-owned setup guide data must be scoped by JWT tenant; tutorial content must not expose unauthorized modules; onboarding completion must no longer depend on fee-structure step; all API responses must use the standard JSON envelope  
**Scale/Scope**: One onboarding wizard, four recommended setup steps, role-aware tutorial content for existing school roles (`admin`, `teacher`, `bursar`, `super_admin`) and their accessible modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Multi-Tenant Data Isolation**: PASS — setup guide state will be tenant-scoped using JWT-derived `tenant_id`; user tutorial state will be user-scoped and tenant-scoped where applicable.
2. **API-First Separation of Concerns**: PASS — frontend will consume REST endpoints; backend owns setup/tutorial state and role filtering.
3. **JWT Authentication & Role-Based Access**: PASS — all new `/api/*` guide/tutorial endpoints are authenticated; backend filters tutorial content by role/permissions.
4. **Immutable Migrations**: PASS — new persistence requires new migration(s); existing migrations will not be edited.
5. **Financial Ledger Integrity**: PASS — feature does not alter ledger balance computation; billing setup is only linked as a navigation/setup step.
6. **REST API Standards & Consistent Responses**: PASS — planned resources use plural/lowercase kebab-case endpoints and `BaseApiController` response helpers.
7. **Code Quality & Maintainability**: PASS — separate services/models/hooks planned for setup guide and tutorial responsibilities.
8. **Defensive Security**: PASS — phone number and guide/tutorial inputs will be validated; tutorial content will not reveal unauthorized modules.
9. **Error Handling & Observability**: PASS — invalid step/status/module operations will return explicit error responses and log unexpected failures.
10. **API Endpoint Testing via curl**: PASS — quickstart defines curl validation after implementation for happy path, invalid input, unauthorized access, and tenant isolation.
11. **Performance Discipline**: PASS — no speculative performance work; guide/tutorial content is small and avoids repeated per-module backend lookups.

## Project Structure

### Documentation (this feature)

```text
specs/076-onboarding-guided-tutorial/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    └── onboarding-guidance-api.md
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php
│   ├── Controllers/
│   │   └── Api/
│   │       ├── OnboardingController.php
│   │       ├── SetupGuideController.php
│   │       └── TutorialController.php
│   ├── Database/
│   │   └── Migrations/
│   │       └── [new setup/tutorial guidance migration]
│   ├── Models/
│   │   ├── OnboardingProgressModel.php
│   │   ├── SetupGuideProgressModel.php
│   │   └── UserTutorialProgressModel.php
│   └── Services/
│       ├── SetupGuideService.php
│       └── TutorialService.php
└── tests/

frontend/
├── src/
│   ├── api/
│   │   └── api.ts
│   ├── components/
│   │   ├── onboarding/
│   │   └── tutorial/
│   ├── hooks/
│   │   ├── useOnboarding.ts
│   │   ├── useSetupGuide.ts
│   │   └── useTutorial.ts
│   ├── pages/
│   │   ├── OnboardingPage.tsx
│   │   └── Dashboard.tsx
│   └── types/
│       └── dashboard.ts
```

**Structure Decision**: Use the existing full-stack SchoolLedger structure. Backend state, authorization, and role filtering live in CodeIgniter controllers/services/models. Frontend presentation, walkthrough UI, and guide cards live in React hooks/components/pages while all server state flows through `src/api/api.ts` and TanStack React Query.

## Phase 0: Research

Research completed in [research.md](./research.md). All planning unknowns are resolved:

- Initial onboarding should remove `fee-structure` from both frontend step order and backend required completion rules.
- Phone number should be stored through existing onboarding profile/contact persistence paths.
- Recommended setup guide should be tenant-scoped.
- Tutorial progress should be user-scoped.
- Role-aware tutorial definitions should be backend-filtered and frontend-rendered.
- New guide/tutorial resources should use REST endpoints and curl validation.

## Phase 1: Design & Contracts

Design artifacts generated:

- [data-model.md](./data-model.md)
- [contracts/onboarding-guidance-api.md](./contracts/onboarding-guidance-api.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

1. **Multi-Tenant Data Isolation**: PASS — data model includes tenant-scoped setup guide progress and tenant-aware tutorial progress.
2. **API-First Separation of Concerns**: PASS — contract defines backend-owned guide/tutorial resources consumed by frontend.
3. **JWT Authentication & Role-Based Access**: PASS — tutorial module visibility is backend-filtered by authenticated role/permissions.
4. **Immutable Migrations**: PASS — data model requires new migration(s), not edits to applied migrations.
5. **Financial Ledger Integrity**: PASS — no ledger source-of-truth changes.
6. **REST API Standards & Consistent Responses**: PASS — contracts use lowercase kebab-case resource endpoints and standard envelopes.
7. **Code Quality & Maintainability**: PASS — services separate setup guide and tutorial logic.
8. **Defensive Security**: PASS — phone/status inputs validated and unauthorized module exposure prevented server-side.
9. **Error Handling & Observability**: PASS — contracts include invalid input and unauthorized responses.
10. **API Endpoint Testing via curl**: PASS — quickstart includes required curl validation scenarios.
11. **Performance Discipline**: PASS — small state payloads, no N+1 patterns, no speculative optimization.

## Complexity Tracking

No constitution violations or complexity exceptions identified.

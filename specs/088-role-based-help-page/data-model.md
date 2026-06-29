# Data Model: Role-Based Help Page

**Feature**: 088-role-based-help-page
**Date**: 2026-06-10
**Purpose**: Define the static data structures (TypeScript types) that represent help content, sections, topics, and contextual links.

---

## Overview

This feature has no database schema changes and no backend entities. All data structures are TypeScript interfaces used to type the static help content consumed by the frontend. The content is authored as a typed constant array and bundled with the application at build time.

---

## Entity Definitions

### `UserRole`

Already defined in `frontend/src/types/auth.ts`:

```typescript
type UserRole = 'super_admin' | 'admin' | 'teacher' | 'bursar';
```

Used to scope help content visibility. `super_admin` and `admin` share the same comprehensive help scope.

---

### `HelpStep`

Represents a single instruction within a help topic.

| Field | Type | Description |
|-------|------|-------------|
| `order` | `number` | Display order within the topic (1-indexed) |
| `instruction` | `string` | The step text, may include `{{organizationName}}` placeholder |
| `tip` | `string?` | Optional callout tip, warning, or best practice note |

---

### `HelpTopic`

A discrete unit of help content representing one workflow or concept.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique slug identifier (kebab-case), e.g. `"recording-payments"` |
| `title` | `string` | Display title of the topic |
| `roleVisibility` | `UserRole[]` | Roles that can see this topic |
| `order` | `number` | Display order within the parent section |
| `steps` | `HelpStep[]` | Ordered list of step-by-step instructions |
| `screenshotCaption` | `string?` | Caption for the screenshot placeholder |
| `relatedModuleRoute` | `string?` | React Router path of the related module page, e.g. `"/payments"` |
| `tags` | `string[]?` | Additional search keywords beyond title and steps |

---

### `HelpSection`

A logical grouping of `HelpTopic` instances under a heading.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique section slug (kebab-case), e.g. `"billing-workflow"` |
| `heading` | `string` | Section heading displayed in TOC and content |
| `description` | `string?` | Short summary paragraph shown below the heading |
| `roleVisibility` | `UserRole[]` | Roles that can see this section and its topics |
| `order` | `number` | Display order on the Help page |
| `topics` | `HelpTopic[]` | Ordered list of topics within this section |
| `icon` | `string?` | Lucide icon name for visual identification in TOC |

---

### `ContextualHelpMapping`

Maps module page routes to their corresponding help section or topic.

| Field | Type | Description |
|-------|------|-------------|
| `moduleRoute` | `string` | React Router path where the contextual link is placed |
| `targetSectionId` | `string` | `HelpSection.id` or `HelpTopic.id` to scroll to |
| `label` | `string` | Accessible label for the help icon button |
| `roleVisibility` | `UserRole[]` | Roles that see this contextual link |

---

### `HelpContentBundle`

The root data structure exported from `frontend/src/lib/helpContent.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `sections` | `HelpSection[]` | All help sections, ordered by `order` |
| `contextualMappings` | `ContextualHelpMapping[]` | All contextual help link definitions |

---

## TypeScript Interface Summary

```typescript
// frontend/src/types/help.ts

import { UserRole } from './auth';

export interface HelpStep {
  order: number;
  instruction: string;
  tip?: string;
}

export interface HelpTopic {
  id: string;
  title: string;
  roleVisibility: UserRole[];
  order: number;
  steps: HelpStep[];
  screenshotCaption?: string;
  relatedModuleRoute?: string;
  tags?: string[];
}

export interface HelpSection {
  id: string;
  heading: string;
  description?: string;
  roleVisibility: UserRole[];
  order: number;
  topics: HelpTopic[];
  icon?: string;
}

export interface ContextualHelpMapping {
  moduleRoute: string;
  targetSectionId: string;
  label: string;
  roleVisibility: UserRole[];
}

export interface HelpContentBundle {
  sections: HelpSection[];
  contextualMappings: ContextualHelpMapping[];
}
```

---

## Role Visibility Matrix

| Section / Topic | super_admin | admin | bursar | teacher |
|-----------------|-------------|-------|--------|---------|
| Dashboard Overview | ✅ | ✅ | ✅ | ✅ |
| School Setup & Configuration | ✅ | ✅ | ❌ | ❌ |
| Academic Year & Term Management | ✅ | ✅ | ❌ | ❌ |
| Class & Student Management | ✅ | ✅ | ❌ | ❌ |
| Fee Structure Creation | ✅ | ✅ | ✅ (view-only) | ❌ |
| Transport Configuration | ✅ | ✅ | ❌ | ❌ |
| Billing Workflow | ✅ | ✅ | ✅ | ❌ |
| Payment Recording | ✅ | ✅ | ✅ | ❌ |
| Reconciliation | ✅ | ✅ | ✅ | ❌ |
| User & Role Management | ✅ | ✅ | ❌ | ❌ |
| Reports & Analytics | ✅ | ✅ | ✅ (limited) | ❌ |
| System Settings | ✅ | ✅ | ❌ | ❌ |
| Best Practices | ✅ | ✅ | ❌ | ❌ |
| Marking Student Attendance | ✅ | ✅ | ❌ | ✅ |
| Viewing Class Rosters | ✅ | ✅ | ❌ | ✅ |
| Troubleshooting (Admin) | ✅ | ✅ | ❌ | ❌ |
| Troubleshooting (Bursar) | ✅ | ✅ | ✅ | ❌ |
| Troubleshooting (Teacher) | ✅ | ✅ | ❌ | ✅ |

*Notes*:
- `super_admin` and `admin` share identical help scopes for this feature.
- Bursar sees Fee Structure in a view-only context (understanding assigned rules, not creating them).
- Teacher scope is minimal: Dashboard, Attendance, Rosters, Teacher Troubleshooting.
- Universal sections (Dashboard Overview) are visible to all roles.

---

## Search Index Structure

At runtime, a flat search index is derived from the `HelpContentBundle` for fast keyword lookup:

```typescript
export interface SearchIndexEntry {
  sectionId: string;
  topicId: string;
  searchText: string; // Lowercase concatenation of heading + title + tags + step instructions
}
```

The index is computed once via `useMemo` when the Help page mounts. Search queries are matched with `.includes()` against `searchText`.

---

## Content Organization Example

```typescript
const helpContent: HelpContentBundle = {
  sections: [
    {
      id: 'dashboard-overview',
      heading: 'Dashboard Overview and Navigation',
      description: 'Understanding your SchoolLedger dashboard.',
      roleVisibility: ['super_admin', 'admin', 'bursar', 'teacher'],
      order: 1,
      icon: 'LayoutDashboard',
      topics: [
        {
          id: 'understanding-dashboard',
          title: 'Understanding the Dashboard',
          roleVisibility: ['super_admin', 'admin', 'bursar', 'teacher'],
          order: 1,
          steps: [
            { order: 1, instruction: 'Log in to your {{organizationName}} account.' },
            { order: 2, instruction: 'The Dashboard displays key metrics relevant to your role.' },
          ],
          screenshotCaption: 'Dashboard overview showing KPI cards',
          relatedModuleRoute: '/dashboard',
        },
      ],
    },
    {
      id: 'student-management',
      heading: 'Class and Student Management',
      description: 'Managing classes, enrollments, and student records.',
      roleVisibility: ['super_admin', 'admin'],
      order: 4,
      icon: 'Users',
      topics: [
        {
          id: 'creating-a-class',
          title: 'Creating a New Class',
          roleVisibility: ['super_admin', 'admin'],
          order: 1,
          steps: [
            { order: 1, instruction: 'Navigate to Classes from the sidebar.' },
            { order: 2, instruction: 'Click the "New Class" button.' },
            { order: 3, instruction: 'Enter the class name, grade level, and academic year.' },
            { order: 4, instruction: 'Click Save to create the class.' },
          ],
          screenshotCaption: 'Class creation form',
          relatedModuleRoute: '/classes',
        },
      ],
    },
  ],
  contextualMappings: [
    {
      moduleRoute: '/dashboard',
      targetSectionId: 'dashboard-overview',
      label: 'Dashboard Help',
      roleVisibility: ['super_admin', 'admin', 'bursar', 'teacher'],
    },
    {
      moduleRoute: '/classes',
      targetSectionId: 'student-management',
      label: 'Class Management Help',
      roleVisibility: ['super_admin', 'admin'],
    },
  ],
};
```

---

## Validation Rules

1. **Every `HelpSection.id` MUST be unique** across the bundle.
2. **Every `HelpTopic.id` MUST be unique** across the bundle.
3. **`roleVisibility` MUST contain at least one valid `UserRole`**.
4. **`order` fields MUST be sequential and unique** within their parent collection (sections globally, topics within a section, steps within a topic).
5. **`relatedModuleRoute` MUST match an existing route** declared in `App.tsx` (or be `undefined`).
6. **No circular or self-referential structures** — topics cannot reference sections that contain them.

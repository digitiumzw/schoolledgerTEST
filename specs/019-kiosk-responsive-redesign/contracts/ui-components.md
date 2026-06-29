# UI Component Contracts: Kiosk Responsive Redesign

**Branch**: `019-kiosk-responsive-redesign`
**Date**: 2026-04-08

## Scope

This feature is a pure frontend redesign. There are no new API endpoints and no changes to existing API contracts. The relevant contracts are the **component prop interfaces** that define the boundary between page components (callers) and kiosk sub-components (implementors).

All prop interfaces defined here are **stable** — they must not change. Internal rendering (JSX structure, Tailwind class strings) may be freely modified.

---

## Contract: Touch Target Compliance

All interactive elements rendered by kiosk components MUST satisfy:

| Element Type | Minimum Height | Minimum Width | Notes |
|-------------|---------------|--------------|-------|
| Primary action button | 56px (`h-14`) | Full width of container | Continue, Submit, Done |
| Secondary/navigation button | 44px (`h-11`) | 44px | Back, Cancel |
| Status toggle button | 44px | 56px | Present/Absent/Late/Excused |
| Card/list item (selectable) | 64px (`min-h-[64px]`) | Full width | Class card, Route card |
| Icon-only button | NOT PERMITTED | NOT PERMITTED | Must include text label |

---

## Contract: Responsive Layout Behavior

Each component MUST render correctly at these canonical breakpoints:

| Viewport Width | Layout Expectation |
|---------------|-------------------|
| 375px (portrait phone minimum) | Single column; no horizontal overflow; status buttons in 2×2 grid |
| 640px (sm) | Single column wider; status buttons can be 4-column row |
| 768px (md, tablet portrait) | Content max-width `max-w-lg` (512px) centered; generous padding |
| 1024px (lg, tablet landscape) | Same as 768px; no additional layout shift needed |
| 1280px+ (desktop / wall kiosk) | Content centered; `max-w-lg` constraint maintained |

---

## Contract: Visual Consistency

All redesigned components MUST use the existing design system tokens:

| Token | Usage |
|-------|-------|
| Background gradient | `bg-gradient-to-br from-slate-50 to-{color}-50` (per kiosk type) |
| Card surface | `bg-white rounded-xl border border-gray-200` |
| Primary button | `bg-{color}-600 hover:bg-{color}-700 text-white rounded-xl` |
| Secondary button | `border-2 border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700` |
| Error state | `bg-red-50 border border-red-200 text-red-600 rounded-xl` |
| Corner radius | `rounded-xl` (12px) for cards and buttons; `rounded-lg` (8px) for small elements |

Color accent per kiosk type (existing, unchanged):
- **Staff Attendance Kiosk**: blue (`blue-500/600`)
- **Student Attendance Kiosk**: emerald (`emerald-500/600`)
- **Driver Kiosk**: blue (`blue-500/600`)

---

## Contract: Typography Minimums

| Use | Minimum Class | Minimum Rendered Size |
|-----|-------------|----------------------|
| Body text / labels | `text-base` | 16px |
| List item names (students, routes) | `text-lg` | 18px |
| Input value text | `text-2xl` | 24px |
| Section headings | `text-2xl` | 24px |
| Page title / school name | `text-3xl` | 30px |
| Live clock display | `text-5xl` | 48px |

# Research: Move Reconciliation Under Payments Submenu

**Date**: 2026-04-17  
**Feature**: 037-reconciliation-submenu

## Research Tasks

This feature uses well-established frontend patterns with no significant technical unknowns. Research focused on identifying the best approach for submenu navigation and responsive design within the existing SchoolLedger tech stack.

---

## Navigation Pattern Decision

### Decision
Use a **collapsible submenu pattern** under the Payments menu item, implemented with shadcn/ui Collapsible or NavigationMenu primitives.

### Rationale
- SchoolLedger already uses shadcn/ui component library
- Collapsible/NavigationMenu components provide built-in accessibility (ARIA attributes, keyboard navigation)
- Aligns with existing UI design patterns in the application
- Minimal custom code required

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Keep Reconciliation as separate top-level menu item | Doesn't meet requirement to group under Payments |
| Mega-menu pattern | Overkill for a single submenu item; adds unnecessary complexity |
| Custom dropdown implementation | Would require custom ARIA/accessibility implementation; shadcn/ui already provides this |

---

## Responsive Design Approach

### Decision
Use **TailwindCSS responsive breakpoints** (sm:, md:, lg:) with horizontal scroll containers for tables on mobile.

### Rationale
- TailwindCSS is already the styling solution for SchoolLedger
- Responsive breakpoints are well-defined and consistent
- Horizontal scroll containers for tables preserve data relationships while fitting narrow screens
- No additional dependencies required

### Implementation Details

**Breakpoints**:
- `default` (< 640px): Mobile layout
- `sm` (640px+): Small tablets
- `md` (768px+): Tablets
- `lg` (1024px+): Desktop

**Table Handling**:
- Wrap tables in `overflow-x-auto` container
- Maintain minimum column widths to prevent content squishing
- Consider card-based layout for very narrow screens (< 480px)

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| CSS Grid table reflow | Would break row/column relationships; confusing for financial data |
| Separate mobile page | Duplicate maintenance burden; violates DRY principle |
| Hide columns on mobile | Would hide potentially important reconciliation data |

---

## URL Structure Decision

### Decision
Change reconciliation route from `/reconciliation` to `/payments/reconciliation` with a redirect from the old URL.

### Rationale
- Reflects the new navigation hierarchy in the URL
- Users with bookmarks will be seamlessly redirected
- Consistent with RESTful URL patterns

### Implementation
- React Router: Add redirect from `/reconciliation` to `/payments/reconciliation`
- Optional: Backend 301 redirect for direct URL access (SEO/bookmark compatibility)

---

## Accessibility Considerations

### Decision
Ensure full keyboard navigation and ARIA compliance using shadcn/ui built-in accessibility features.

### Requirements
- Submenu toggle: `aria-expanded`, `aria-haspopup`
- Active page: `aria-current="page"`
- Keyboard navigation: Tab, Enter, Escape, Arrow keys
- Focus management: Visible focus indicators, trap focus in open submenu

### Rationale
shadcn/ui components are built on Radix UI primitives which provide these accessibility features out of the box.

---

## Summary

All technical decisions align with existing SchoolLedger architecture:
- ✅ Uses established shadcn/ui components
- ✅ Leverages existing TailwindCSS setup
- ✅ No new dependencies required
- ✅ Maintains accessibility compliance
- ✅ Supports responsive design requirements

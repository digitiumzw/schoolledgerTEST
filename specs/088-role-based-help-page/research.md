# Research: Role-Based Help Page

**Feature**: 088-role-based-help-page
**Date**: 2026-06-10
**Purpose**: Resolve any technical unknowns and document decisions for the implementation plan.

---

## Research Topic 1: How to Structure Static Help Content in a TypeScript React App

**Decision**: Use a typed constant array exported from `frontend/src/lib/helpContent.ts`. Each help section is an object with `id`, `heading`, `roleVisibility`, `order`, and `topics[]`. Topics contain `title`, `slug`, `steps` (ordered string array), and `screenshotCaption`.

**Rationale**:
- TypeScript types (`frontend/src/types/help.ts`) ensure compile-time validation of content structure.
- Static data is tree-shakeable and bundled with the app; no runtime fetch latency.
- Easy to version-control and review in pull requests.
- Matches existing project patterns (e.g., `frontend/src/lib/studentUtils.ts`, `frontend/src/lib/transportUtils.ts` contain static utility data).

**Alternatives considered**:
- Markdown files loaded at build time: Adds Vite plugin complexity; no compile-time type safety for content structure.
- JSON files imported: Loses TypeScript type inference on import unless typed manually; same outcome as TS constant with more files.
- CMS/backend-stored content: Rejected per spec (FR-016); out of scope for v1.

---

## Research Topic 2: Search Implementation for Static Content

**Decision**: Client-side fuzzy search over the static content array using `useMemo` for filtering. No backend search endpoint.

**Rationale**:
- The total help content volume is bounded (estimated < 100 topics across all roles).
- Client-side filtering is instant (< 100ms) for this data size.
- No backend round-trip aligns with spec FR-016 (no backend API changes).
- Search terms are matched against section headings, topic titles, and step text content.

**Alternatives considered**:
- Backend search endpoint: Over-engineering for bounded static content; violates spec constraint.
- Full-text search library (e.g., Fuse.js, Lunr): Acceptable but unnecessary; simple `toLowerCase().includes()` across concatenated text fields is sufficient for v1.

---

## Research Topic 3: Table of Contents with Scroll-Spy

**Decision**: Use `IntersectionObserver` in a custom hook (`useActiveSection`) to track which section is in view. The TOC renders as a sticky sidebar with clickable links that call `element.scrollIntoView({ behavior: 'smooth' })`.

**Rationale**:
- `IntersectionObserver` is the modern, performant way to detect viewport visibility without scroll-event listeners.
- Works with dynamic content heights (step lists expand with placeholder images).
- Smooth scroll is a native browser API; no library needed.

**Alternatives considered**:
- `react-scrollspy` or similar library: Adds a dependency for a solvable problem; SchoolLedger prefers minimal dependencies and native APIs where practical.
- Manual scroll-event listener with offset calculation: Less performant than IntersectionObserver.

---

## Research Topic 4: Role Scoping Mechanism

**Decision**: Filter content at render time using the `user.role` value from the existing `AuthContext`. Each `HelpSection` has a `roleVisibility` array (`UserRole[]`). A utility function `isVisibleToRole(section, userRole)` checks inclusion.

**Rationale**:
- `AuthContext` already provides `user.role` to all components via `useAuth()`.
- `UserRole` union type (`'super_admin' | 'admin' | 'teacher' | 'bursar'`) is already defined in `frontend/src/types/auth.ts`.
- Admin and super_admin share the same help scope; both map to the comprehensive content set.
- Teacher scope is minimal but explicitly defined per spec FR-006.

**Fallback for unknown roles**: If `user.role` is not one of the four known roles, only universally visible sections (e.g., "Dashboard Overview") are rendered. This handles edge cases gracefully.

---

## Research Topic 5: Contextual Help Links on Module Pages

**Decision**: Add a small `ContextualHelpLink` component (icon button with tooltip) on key module page headers. It uses React Router's `useNavigate` to route to `/help` with a query parameter (`?section=billing-workflow`). The Help page reads `section` from URL on mount and auto-scrolls to the target.

**Rationale**:
- Query parameter approach is stateless and bookmarkable.
- The Help page is already routable at `/help` (existing route in `App.tsx`).
- Contextual links only render if the user's role has visibility to that help section (checked via the same `isVisibleToRole` utility).

**Module-to-section mapping** (partial list):
- `/dashboard` → `dashboard-overview`
- `/students` → `student-management`
- `/payments` → `recording-payments`
- `/settings` → `system-settings`
- `/classes` → `class-management`
- `/staff-attendance` → `staff-attendance`
- `/transport` → `transport-configuration`
- `/billing` → `billing-workflow`
- `/reports` or `/analytics` → `reports-analytics`

---

## Research Topic 6: Screenshot Placeholders

**Decision**: Implement a `ScreenshotPlaceholder` component using a styled `div` with a dashed border, a centered image icon from Lucide, and a caption below. The component accepts a `caption: string` prop.

**Rationale**:
- No actual image assets are available for v1 (per spec assumption).
- Placeholder maintains consistent layout and informs users where screenshots will appear.
- Uses existing design system (Card, muted background, border tokens).

---

## Research Topic 7: Tenant-Specific Content Customization

**Decision**: Use the existing `tenantId` or organization name from `AuthContext` for tenant-specific references in help text. Help content strings use template placeholders (e.g., `{{organizationName}}`) that are replaced at render time. For features disabled per tenant (e.g., transport not configured), sections are conditionally hidden by checking existing tenant settings or data presence.

**Rationale**:
- `AuthContext` already exposes `tenantId`; tenant settings are loaded via existing React Query hooks (e.g., `useSettings`).
- Template placeholder replacement is trivial string interpolation at render time.
- Feature-gated sections use existing frontend state (e.g., `settings.transportEnabled`) rather than new backend endpoints.

---

## Consolidated Decisions

| Decision | Rationale | Alternatives Rejected |
|----------|-----------|----------------------|
| Typed TS constant for content | Compile-time safety, version control, zero latency | Markdown build-time loading, CMS, JSON |
| Client-side `useMemo` search | Bounded data, instant response, no backend changes | Backend search endpoint, Fuse.js library |
| `IntersectionObserver` scroll-spy | Modern, performant, no dependencies | react-scrollspy library, manual scroll listeners |
| `AuthContext.role` filtering | Reuses existing auth, zero new infrastructure | Custom permission system, backend role endpoint |
| URL query param for contextual help | Stateless, bookmarkable, simple | React context state, localStorage |
| Styled div placeholder for screenshots | No assets yet, consistent layout, design-system aligned | External image hosting, SVG illustrations |
| Template placeholder for tenant name | Reuses existing auth data, minimal complexity | Per-tenant content bundles, backend content API |

# UI Contract: Role-Based Help Page

**Feature**: 088-role-based-help-page
**Date**: 2026-06-10
**Purpose**: Define the component interfaces, props, and rendering contracts for the Help page and contextual help links.

---

## Contract Scope

This feature is frontend-only with no backend API contracts. The contracts below describe the TypeScript component interfaces and the expected behavior of the Help page UI.

---

## Component: `HelpPage` (`frontend/src/pages/Help.tsx`)

### Props

None — the component uses `useAuth()` to read the current user role and `useSearchParams` to read optional `?section=` query parameter for contextual navigation.

### Render Contract

```
Layout: Full-width page with a two-column layout on desktop (TOC sidebar left, content right).
       On mobile/tablet, the TOC becomes a collapsible top panel or bottom sheet.

Left Column (TOC):
  - Sticky positioning on desktop (top: header-height)
  - Lists all HelpSection headings filtered by user.role
  - Current section is visually highlighted (active state)
  - Clicking a section scrolls the content area to that section (smooth)
  - Includes a search input at the top of the TOC panel

Right Column (Content):
  - Displays all visible HelpSections sequentially
  - Each section renders its heading, optional description, and all visible topics
  - Each topic renders its title, ordered steps, and optional screenshot placeholder
  - Sections are separated by a visual divider

Search Behavior:
  - Real-time filtering as the user types (debounced 150ms)
  - Filters topics by search text across: section heading, topic title, step instructions, tags
  - When search is active, non-matching sections/topics are hidden
  - Clear search restores full content
  - If no results match, display an empty state: "No help topics match your search."

Contextual Navigation:
  - On mount, if URL contains ?section={sectionId}, scroll to that section
  - If URL contains ?topic={topicId}, scroll to that topic
  - Invalid or invisible section/topic IDs are ignored (no error)
```

---

## Component: `HelpTableOfContents`

### Props Interface

```typescript
interface HelpTableOfContentsProps {
  sections: HelpSection[];           // Already filtered by role
  activeSectionId: string | null;    // Currently visible section
  onSectionClick: (sectionId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}
```

### Render Contract

```
- Rendered as a Card or bordered panel with scrollable inner area if content exceeds viewport
- Search input at top with a Search icon, Clear button (X) when query is non-empty
- Section list items show the section icon (if any) and heading
- Active item uses primary color background/border-left highlight
- Non-active items use muted text, hover state brightens
- On mobile: collapsible accordion or bottom sheet triggered by a floating button
```

---

## Component: `HelpSectionComponent`

### Props Interface

```typescript
interface HelpSectionComponentProps {
  section: HelpSection;
  isVisible: boolean;      // Controlled by parent based on search filtering
  searchQuery: string;       // For highlighting matching text
}
```

### Render Contract

```
- Rendered with an `id={section.id}` attribute for anchor linking
- Heading: H2 with section heading text
- Description: Optional paragraph below heading
- Topics: Rendered as a vertical stack
- If `isVisible` is false, the section is not rendered at all
```

---

## Component: `HelpTopicComponent`

### Props Interface

```typescript
interface HelpTopicComponentProps {
  topic: HelpTopic;
  isVisible: boolean;
  searchQuery: string;
}
```

### Render Contract

```
- Rendered with an `id={topic.id}` attribute for anchor linking
- Title: H3 with topic title
- Steps: Ordered list (<ol>) with each step as <li>
  - Step text may contain `{{organizationName}}` placeholder, replaced at render
  - Optional tip is rendered as an Alert or callout card below the step
- Screenshot Placeholder: Rendered below the steps if screenshotCaption is present
- Matching search text is highlighted (bold or background color) within titles and steps
- If isVisible is false, the topic is not rendered
```

---

## Component: `ScreenshotPlaceholder`

### Props Interface

```typescript
interface ScreenshotPlaceholderProps {
  caption: string;
}
```

### Render Contract

```
- A bordered, dashed container (aspect-ratio 16/9 or flexible)
- Centered Image icon from Lucide React
- Caption text below the placeholder area
- Uses muted background color (bg-muted/30)
- Border uses border-dashed and border-muted-foreground/30
```

---

## Component: `ContextualHelpLink`

### Props Interface

```typescript
interface ContextualHelpLinkProps {
  sectionId: string;       // Target help section to open
  label?: string;          // Accessible label (default: "Help")
  className?: string;      // Optional additional CSS classes
}
```

### Render Contract

```
- Rendered as a small icon button (CircleHelp from Lucide) with tooltip
- Only rendered if the current user's role has visibility to the target section
- On click: navigates to /help?section={sectionId} using React Router
- Tooltip shows the label or "Get help for this page"
- Positioned in the page header area, aligned right or near the page title
```

---

## Component: `HelpSearch` (Hook-level contract)

### Hook Interface

```typescript
function useHelpSearch(
  sections: HelpSection[],
  userRole: UserRole
): {
  filteredSections: HelpSection[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  hasResults: boolean;
};
```

### Behavior Contract

```
- Input: full sections array, current user role
- Filtering logic:
  1. Filter sections by role visibility (section.roleVisibility includes userRole)
  2. Filter topics within each section by role visibility
  3. If searchQuery is non-empty:
     a. For each topic, concatenate: section.heading + topic.title + step.instructions + topic.tags
     b. Convert to lowercase
     c. If searchQuery (lowercase) is included in the concatenated text, topic is visible
     d. A section is visible if at least one of its topics is visible
  4. Return filtered sections with only visible topics
- `hasResults` is true if at least one topic remains after filtering
- Performance: O(n * m * k) where n=sections, m=topics/section, k=avg steps. For <100 topics this is <1ms.
```

---

## Hook: `useActiveSection`

### Hook Interface

```typescript
function useActiveSection(sectionIds: string[]): {
  activeSectionId: string | null;
};
```

### Behavior Contract

```
- Creates an IntersectionObserver on elements matching the section IDs
- Observes each section's DOM element (found by id attribute)
- Threshold: 0.3 (section is "active" when 30% visible)
- rootMargin: "-80px 0px -50% 0px" (accounts for sticky header, favors top-of-viewport sections)
- Returns the sectionId of the most recently intersecting element
- Cleans up observers on unmount
```

---

## Navigation Contract

### Route

```
/help                     → HelpPage (no contextual target)
/help?section={id}        → HelpPage, auto-scroll to section
/help?topic={id}         → HelpPage, auto-scroll to topic
```

### Contextual Link Integration Points

The following module pages SHOULD include a `<ContextualHelpLink>` in their header:

| Page Route | Target Section ID | Role Visibility |
|-----------|-------------------|-----------------|
| `/dashboard` | `dashboard-overview` | all |
| `/students` | `student-management` | admin, super_admin |
| `/students/:id` | `student-management` | admin, super_admin, bursar |
| `/payments` | `recording-payments` | admin, super_admin, bursar |
| `/billing` | `billing-workflow` | admin, super_admin, bursar |
| `/classes` | `class-management` | admin, super_admin |
| `/staff` | `user-role-management` | admin, super_admin |
| `/staff-attendance` | `staff-attendance` | admin, super_admin |
| `/transport` | `transport-configuration` | admin, super_admin |
| `/settings` | `system-settings` | admin, super_admin |
| `/fee-campaigns` | `fee-campaigns` | admin, super_admin, bursar |
| `/reports` or `/analytics` | `reports-analytics` | admin, super_admin, bursar |

---

## Accessibility Contract

- All section headings use proper heading hierarchy (H1 for page title, H2 for sections, H3 for topics).
- TOC links are `<button>` or `<a>` elements with `aria-current="true"` for the active item.
- Search input has `aria-label="Search help topics"`.
- Screenshot placeholders have `role="img"` and `aria-label` describing the caption.
- Contextual help links have `aria-label` describing the target.
- Focus states are visible and follow the existing design system focus ring.

---

## Responsive Contract

| Breakpoint | Layout |
|-----------|--------|
| >= 1024px (lg) | Two-column: TOC sidebar (280px fixed width) + content (flexible) |
| 768px - 1023px (md) | Two-column: TOC sidebar (240px) + content |
| < 768px (sm) | Single column: collapsible TOC drawer/button above content |

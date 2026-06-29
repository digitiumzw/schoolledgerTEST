# Feature Specification: Role-Based Help Page

**Feature Branch**: `088-role-based-help-page`  
**Created**: 2026-06-10  
**Status**: Draft  
**Input**: User description: "Redesign the Help page to provide a complete, role-based user guide that walks users through the platform from start to finish within their tenant environment. The Help page must be dynamically scoped to the logged-in user's role. Users should only see help content relevant to the permissions and features available to their role. Do not display instructions for features the user cannot access. Super Admin / Admin get comprehensive guidance covering dashboard, school setup, academic year, classes, fee structure, transport, billing, payments, user management, reports, settings, best practices, troubleshooting. Bursar gets limited guidance: dashboard, students/balances, fee structures, billing, payments, receipts, outstanding balances, financial reports, reconciliation, troubleshooting. Additional: step-by-step guides, screenshots/placeholders, searchable sections and table of contents, contextual help links from each module, tenant-specific examples, complete onboarding/reference guide without exposing unauthorized features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Views Comprehensive Help Guide (Priority: P1)

An administrator or super administrator opens the Help page and sees a complete, structured guide covering all platform features they are authorized to use. The guide is organized into logical sections with a table of contents, includes step-by-step instructions for each major workflow, and provides best practices and troubleshooting advice specific to their tenant environment.

**Why this priority**: Administrators are the primary users who need comprehensive guidance to configure and operate the platform. Without a complete help resource, admins rely on trial and error or external support, increasing onboarding time and support burden.

**Independent Test**: Can be fully tested by logging in as an admin, navigating to the Help page, and verifying that all expected sections (Dashboard, Setup, Classes, Billing, Payments, Settings, etc.) are visible, searchable, and contain actionable step-by-step content.

**Acceptance Scenarios**:

1. **Given** an admin user is logged in, **When** they navigate to the Help page, **Then** they see a table of contents containing all admin-relevant sections including Dashboard Overview, School Setup, Academic Year Management, Class and Student Management, Fee Structure, Transport Configuration, Billing Workflow, Payment Recording, User Management, Reports and Analytics, System Settings, Best Practices, and Troubleshooting.
2. **Given** an admin user is on the Help page, **When** they click a section in the table of contents, **Then** the page scrolls to that section and the section content is displayed with step-by-step instructions.
3. **Given** an admin user is on the Help page, **When** they use the search input, **Then** only help topics matching the query are highlighted or filtered, and topics the admin role cannot access are never displayed.

---

### User Story 2 - Bursar Views Role-Limited Help Guide (Priority: P1)

A bursar opens the Help page and sees only the guidance relevant to their responsibilities. Sections such as User Management, System Settings, and Academic Year Management are hidden because the bursar role does not have permission to access those features. The visible content focuses on financial workflows, payment recording, reconciliation, and reporting.

**Why this priority**: Bursars perform distinct financial operations and must not be confused or misled by instructions for features they cannot access. A scoped help guide reduces cognitive load and prevents unauthorized feature discovery.

**Independent Test**: Can be fully tested by logging in as a bursar, navigating to the Help page, and confirming that only bursar-authorized sections appear while admin-only sections are absent.

**Acceptance Scenarios**:

1. **Given** a bursar user is logged in, **When** they navigate to the Help page, **Then** the table of contents contains only bursar-relevant sections such as Dashboard Overview, Viewing Students and Balances, Fee Structures, Billing and Invoice Processing, Recording Payments, Managing Receipts, Monitoring Outstanding Balances, Financial Reports, Daily Reconciliation, and Bursar Troubleshooting.
2. **Given** a bursar user is on the Help page, **When** they scroll through the content, **Then** they do not see any sections, links, or references to User Management, System Settings, Academic Year Management, or Transport Configuration.
3. **Given** a bursar user is on the Help page, **When** they search for "add user", **Then** no results appear because that topic is outside their role scope.

---

### User Story 3 - Teacher Views Role-Limited Help Guide (Priority: P1)

A teacher opens the Help page and sees guidance scoped to their limited permissions. The content focuses on student attendance marking, viewing class rosters, and understanding the dashboard from a teacher's perspective. All administrative and financial sections are hidden.

**Why this priority**: Teachers have the most restricted role (attendance marking only) and need concise, relevant guidance without exposure to billing, payments, or configuration topics they cannot act upon.

**Independent Test**: Can be fully tested by logging in as a teacher, navigating to the Help page, and confirming that only teacher-authorized content appears.

**Acceptance Scenarios**:

1. **Given** a teacher user is logged in, **When** they navigate to the Help page, **Then** the visible sections are limited to Dashboard Overview, Marking Student Attendance, Viewing Class Rosters, and Teacher Troubleshooting.
2. **Given** a teacher user is on the Help page, **When** they attempt to search for "fee structure" or "payment", **Then** no matching help topics are returned.

---

### User Story 4 - Search Help Content by Keyword (Priority: P2)

Any authenticated user types a keyword into the Help page search field and receives filtered results showing only help topics within their role scope that match the query. The search operates across topic titles, section headings, and step descriptions.

**Why this priority**: Searchability is critical for a reference guide. Users should quickly locate specific instructions without manually scanning all sections.

**Independent Test**: Can be fully tested by entering search terms on the Help page and verifying that results are scoped to the current user's role and highlight matching text.

**Acceptance Scenarios**:

1. **Given** an admin user types "invoice" into the Help search, **When** the search executes, **Then** sections related to billing and invoice generation are shown, while unrelated sections are hidden.
2. **Given** a bursar user types "invoice" into the Help search, **When** the search executes, **Then** only bursar-visible invoice topics are shown; admin-only invoice configuration topics remain hidden.
3. **Given** any user clears the search input, **When** the clear action completes, **Then** the full role-scoped table of contents and all sections are restored.

---

### User Story 5 - Launch Contextual Help from a Module (Priority: P2)

A user clicks a help icon or link within a platform module (e.g., on the Payments page, Settings page, or Student Profile). The system opens the Help page pre-scrolled to the section relevant to that module, filtered to the user's role.

**Why this priority**: Contextual help reduces friction by delivering assistance at the point of need rather than requiring users to navigate away and manually locate the right topic.

**Independent Test**: Can be fully tested by clicking a contextual help trigger on any module screen and verifying that the Help page opens at the corresponding section.

**Acceptance Scenarios**:

1. **Given** an admin user is on the Settings page, **When** they click the help icon, **Then** the Help page opens scrolled to the "System Settings and Configuration" section.
2. **Given** a bursar user is on the Payments page, **When** they click the help icon, **Then** the Help page opens scrolled to the "Recording Payments" section.
3. **Given** a user clicks a contextual help link for a module they do not have permission to view, **Then** the contextual link is not rendered or is disabled.

---

### User Story 6 - Navigate via Table of Contents (Priority: P2)

A user sees a persistent table of contents panel on the Help page that lists all sections available to their role. Clicking any item smoothly scrolls to the corresponding section. The currently visible section is highlighted in the table of contents as the user scrolls.

**Why this priority**: A persistent, interactive table of contents provides orientation within a long document and enables rapid navigation between topics.

**Independent Test**: Can be fully tested by scrolling through the Help page and observing table-of-contents highlight updates, and by clicking TOC items to verify smooth scroll behavior.

**Acceptance Scenarios**:

1. **Given** a user is on the Help page, **When** they click an item in the table of contents, **Then** the page scrolls smoothly to the corresponding section and the item is visually highlighted.
2. **Given** a user scrolls through the Help page manually, **When** a new section enters the viewport, **Then** the corresponding table of contents item becomes highlighted.

---

### Edge Cases

- What happens when a user has a custom or modified role that does not match standard role mappings? The system MUST fall back to showing only universally accessible help topics (Dashboard Overview and general navigation).
- How does the system handle a contextual help link for a module that has not yet had help content written? The system MUST gracefully scroll to a placeholder section or display a "Documentation coming soon" message instead of failing.
- What happens when the Help page content is very long? The table of contents MUST remain accessible (e.g., sticky or collapsible) so users do not lose navigation context.
- How does the system handle screenshot placeholders when actual images are unavailable? The system MUST render a styled placeholder with a descriptive caption so the layout remains intact and users understand where visual documentation will appear.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Help page MUST be accessible from the main navigation for all authenticated users.
- **FR-002**: The Help page MUST dynamically scope its content to the currently authenticated user's role.
- **FR-003**: The system MUST support at least four role scopes: super_admin, admin, bursar, and teacher. Each scope MUST display only help topics for features that role is authorized to access.
- **FR-004**: Admin and super_admin scopes MUST display comprehensive guidance covering: Dashboard Overview and Navigation, School/Organization Setup and Configuration, Academic Year and Term Management, Class and Student Management, Fee Structure Creation and Management, Transport Charge Configuration and Rules, Billing Workflow and Invoice Generation, Payment Recording and Reconciliation, User and Role Management, Reports and Analytics, System Settings and Configuration, Best Practices and Recommended Workflows, and Common Troubleshooting and FAQs.
- **FR-005**: The bursar scope MUST display guidance limited to: Dashboard Overview, Viewing Students and Account Balances, Managing Fee Structures (view-only context), Billing and Invoice Processing, Recording Payments, Managing Receipts, Monitoring Outstanding Balances, Financial Reports Accessible to Bursars, Daily Reconciliation Procedures, and Common Billing and Payment Troubleshooting and FAQs.
- **FR-006**: The teacher scope MUST display guidance limited to: Dashboard Overview, Marking Student Attendance, Viewing Class Rosters, and Teacher Troubleshooting.
- **FR-007**: Help content MUST be structured as step-by-step guides with numbered or ordered instructions for each workflow.
- **FR-008**: Each help section MUST support screenshot or diagram placeholders where visual documentation is applicable. Placeholders MUST include a descriptive caption and a visual style consistent with the platform design system.
- **FR-009**: The Help page MUST include a real-time search field that filters help topics by keyword across titles, headings, and step descriptions. Search results MUST respect role scoping.
- **FR-010**: The Help page MUST display a persistent table of contents that lists all sections available to the current user's role. Clicking a TOC item MUST scroll the page to the corresponding section.
- **FR-011**: The table of contents MUST visually indicate the currently visible section as the user scrolls (scroll-spy behavior).
- **FR-012**: Contextual help links MUST be available on key module pages (e.g., Payments, Settings, Student Profile, Billing, Transport). Clicking a contextual link MUST open the Help page focused on the relevant section.
- **FR-013**: Contextual help links MUST only be rendered for modules the current user has permission to access.
- **FR-014**: All help examples, workflows, and terminology MUST be tenant-specific, referencing the current user's organization name and reflecting features available within that tenant's configuration (e.g., if a tenant has not configured transport, transport help sections may be suppressed or marked as not yet configured).
- **FR-015**: The Help page MUST serve as a complete onboarding and reference guide without exposing features or instructions outside the user's assigned role.
- **FR-016**: Help content MUST be rendered statically or from a lightweight data structure. No backend database schema changes or backend API endpoints are required for v1; content may be maintained as code artifacts.
- **FR-017**: If a help section references a feature that is disabled for the current tenant (e.g., transport not configured), that section MUST either be hidden or display a contextual message indicating the feature is not active.

### Key Entities

- **HelpTopic**: A discrete unit of help content representing one workflow or concept. Attributes: title, slug, roleVisibility (array of roles), sectionOrder, contentSteps (ordered list of instructions), screenshotPlaceholderRefs, relatedModuleRoute.
- **HelpSection**: A logical grouping of HelpTopics under a heading (e.g., "Billing Workflow"). Attributes: sectionId, heading, roleVisibility, topics (ordered list), collapsibleState.
- **ContextualHelpLink**: A UI trigger placed on a module page that links to a specific HelpTopic or HelpSection. Attributes: moduleRoute, targetSectionSlug, displayLabel, roleVisibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can locate help for any feature they have permission to access within 30 seconds using either the table of contents or search.
- **SC-002**: 100% of help topics displayed to a user are within that user's role permissions. Zero unauthorized feature instructions are exposed to any role.
- **SC-003**: Contextual help links are present on at least 80% of primary module pages accessible to each role.
- **SC-004**: Search returns relevant, role-scoped results for 95% of common user queries (e.g., "record payment", "create class", "generate invoice").
- **SC-005**: Support ticket volume related to "how do I..." questions decreases by at least 30% within 60 days of release, measured against the prior 60-day baseline.
- **SC-006**: The Help page renders with all sections and search functional in under 2 seconds on a standard broadband connection, with no backend round-trips required for content retrieval.

## Assumptions

- The existing role system (super_admin, admin, teacher, bursar) and authentication context will be reused to determine help scope.
- Help content for v1 will be authored and maintained as frontend code artifacts (static content or structured data files), not stored in a database. A CMS or admin-editable help system is out of scope for v1.
- Mobile-responsive layout is required but the primary use case is desktop/tablet where the two-column TOC + content layout is optimal.
- Screenshot assets will be provided asynchronously after the feature ships; v1 will use styled placeholders with captions.
- The existing navigation sidebar already includes a Help link that routes to the Help page; no new navigation structure is required beyond what exists.
- Tenant-specific feature availability (e.g., transport enabled/disabled) is determined by existing tenant settings or data presence and can be checked at render time without new backend endpoints.
- Video tutorials and interactive walkthroughs are out of scope for v1; this feature delivers text-based step-by-step guides only.

# Feature Specification: Parent Receipt List

**Feature Branch**: `092-parent-receipt-list`  
**Created**: 2026-06-25  
**Status**: Draft  
**Input**: User description: "When parents view receipts online by scanning the QR codes, add a button that allows them to view all receipts in a single interface. The receipts should be displayed in a scrollable, paginated list and sorted by payment date in descending order (newest first). Ensure the design and styling remain consistent with the rest of the application."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View All Receipts from Individual Receipt (Priority: P1)

A parent or guardian scans the QR code on a physical receipt and lands on the individual receipt viewing page. They see a clearly visible button labeled "View All Receipts" (or similar). When they click it, they are taken to a new page that lists all payment receipts for the same student. The list is sorted by payment date in descending order (newest first) and is paginated — each page shows a bounded number of receipts with controls to load or navigate to the next page. Each entry in the list displays key summary information (date, amount, category, receipt number) and is clickable to open the full individual receipt view. The page design and styling are consistent with the existing receipt page and the broader application.

**Why this priority**: This is the core feature request — the ability for parents to see all receipts in one place after scanning a QR code. Without this, the feature has no value.

**Independent Test**: Can be fully tested by scanning a QR code for any existing receipt, clicking the "View All Receipts" button, and verifying that a paginated list of all receipts for that student appears sorted by date descending.

**Acceptance Scenarios**:

1. **Given** a parent has scanned a QR code and is viewing an individual receipt, **When** they click the "View All Receipts" button, **Then** they are navigated to a list page showing all receipts for the same student, sorted by payment date descending, with pagination controls visible.
2. **Given** the receipt list page is displayed with more receipts than the page limit, **When** the parent clicks the "Next" button or scrolls to load more, **Then** the next page of older receipts is loaded and appended/displayed without losing the previously viewed receipts.
3. **Given** the parent is viewing the receipt list, **When** they click on any receipt entry in the list, **Then** they are navigated to the full individual receipt view for that payment.
4. **Given** the parent is viewing an individual receipt reached from the list, **When** they click the browser back button or a "Back to List" control, **Then** they return to the receipt list at the same scroll position and page they were on.

---

### User Story 2 - Receipt List Display and Summary (Priority: P2)

The receipt list page displays a header with the student's name and a summary count of total receipts. Each receipt entry in the list shows the payment date, amount paid, payment category, receipt number, and payment method. Voided payments are visually distinguished (e.g., strikethrough or a "VOIDED" badge). Multi-category grouped payments appear as a single entry showing the combined total. The list uses a scrollable container with pagination, and the design matches the existing receipt page styling (card-based layout, consistent typography, spacing, and color palette).

**Why this priority**: Enhances the core list with proper visual design and summary metadata, making the list useful and consistent with the application. Without this, the list would be functional but not polished.

**Independent Test**: Can be tested by navigating to the receipt list for a student with multiple receipts including voided and multi-category payments, and verifying each entry displays correctly with proper visual treatment.

**Acceptance Scenarios**:

1. **Given** the parent is viewing the receipt list for a student, **Then** the page header shows the student's name and the total number of receipts.
2. **Given** a voided payment exists in the receipt list, **When** the list is rendered, **Then** the voided entry is visually distinguished with a "VOIDED" indicator and strikethrough styling on the amount.
3. **Given** a multi-category grouped payment exists, **When** the list is rendered, **Then** it appears as a single entry showing the combined total amount and a summary of the categories.
4. **Given** the receipt list is longer than the visible area, **When** the parent scrolls within the list container, **Then** the list scrolls smoothly and pagination controls remain accessible.

---

### Edge Cases

- What happens when the student has only one receipt (the one the parent scanned)? The list shows a single entry; pagination controls are hidden or disabled.
- What happens when the student ID in the URL is invalid or does not exist? A user-friendly "not found" message is displayed, consistent with the existing receipt-not-found error handling.
- What happens when a payment has no receipt number (legacy payment)? The payment ID is used as a fallback identifier, consistent with the existing individual receipt display.
- What happens when the parent navigates directly to the receipt list URL without coming from an individual receipt? The list still loads and displays all receipts for that student.
- What happens when the total number of receipts is exactly equal to the page limit? Pagination shows but "Next" is disabled on the last page.
- How does the system handle payments from different tenants? The student ID is globally unique (contains random hex), so the list is naturally scoped to a single student. No cross-tenant data leakage is possible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "View All Receipts" button on the individual receipt viewing page, visible to any unauthenticated viewer (parent/guardian).
- **FR-002**: System MUST provide a public (no authentication required) endpoint that returns a paginated list of all payment receipts for a given student, sorted by payment date in descending order (newest first).
- **FR-003**: The receipt list endpoint MUST accept pagination parameters (page number and page size) and return only the requested page of receipts plus pagination metadata (total count, current page, total pages).
- **FR-004**: The receipt list endpoint MUST group multi-category payments sharing the same payment group ID into a single list entry showing the combined total amount.
- **FR-005**: The receipt list endpoint MUST include voided payments in the list with a flag indicating their voided status, so the frontend can render them with appropriate visual treatment.
- **FR-006**: Backend APIs MUST return view-ready data for all feature screens, including any filtering, searching, pagination, sorting, aggregations, and computed values required by the frontend.
- **FR-007**: Frontend behavior MUST be limited to passing user-selected query parameters and rendering backend-prepared responses; it MUST NOT perform client-side data filtering, searching, sorting, pagination, aggregations, or business computations.
- **FR-008**: Every user action that triggers a data change (create, update, delete, submit, refresh, bulk-operation, status-change) MUST display a visible loading indicator from the moment the request is initiated until the response is fully received and the UI reflects the confirmed server state. Action-triggering controls MUST be disabled during in-flight requests to prevent duplicate submissions.
- **FR-009**: After any mutation completes, all React Query queries whose data was affected MUST be invalidated or updated so the next render reflects the latest server state. Stale cached values MUST NOT flash or re-appear after the mutation response is processed.
- **FR-010**: Each receipt entry in the list MUST display the following summary fields: payment date, amount paid, payment category (or "Multiple Categories" for grouped payments), receipt number (or payment ID fallback), and payment method.
- **FR-011**: The receipt list page MUST display the student's name and total receipt count in a header area.
- **FR-012**: Clicking any receipt entry in the list MUST navigate to the existing individual receipt viewing page for that payment.
- **FR-013**: The receipt list page MUST provide a "Back" control (browser back or explicit button) that returns the user to the previous view (individual receipt or list page they came from).
- **FR-014**: The receipt list page MUST use the same visual design system (colors, typography, spacing, card-based layout, border radius) as the existing individual receipt page and broader application.
- **FR-015**: The receipt list endpoint MUST scope results to a single student identified by a unique, non-guessable identifier, ensuring no cross-student or cross-tenant data leakage.

### Key Entities *(include if feature involves data)*

- **Payment Receipt**: Represents a single payment record. Key attributes: payment ID, receipt number, amount, date, method, category, description, voided status, payment group ID (for multi-category grouping), student ID, tenant ID.
- **Student**: The student for whom receipts are listed. Key attributes: student ID, first name, last name, admission number, class name.
- **Receipt List Page**: A paginated collection of payment receipt summaries for a single student, sorted by payment date descending, with pagination metadata (total count, current page, total pages, page size).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A parent who scans a QR code can reach the full receipt list for that student with at most one additional click ("View All Receipts" button).
- **SC-002**: The receipt list page loads the first page of results in under 2 seconds for a student with up to 500 payment records.
- **SC-003**: The receipt list displays a maximum of 20 receipts per page, with intuitive pagination controls to navigate to subsequent pages.
- **SC-004**: 100% of receipts for the student appear in the list across all pages, including voided payments and multi-category grouped payments (shown as single entries).
- **SC-005**: Backend list endpoint returns only the requested page and required summary metadata within the target response time at expected data volume, without the frontend needing to fetch or process the full receipt history.

## Assumptions

- The existing public receipt endpoint (no JWT authentication required) and QR code-based receipt viewing system will be reused; the receipt list endpoint will follow the same public access model.
- Student identifiers are globally unique (contain random hexadecimal suffixes), making them suitable as public scope keys without risk of enumeration.
- The existing individual receipt page and its visual design system will serve as the styling reference for the new receipt list page.
- Multi-category grouped payments (sharing a payment group ID) are already supported in the individual receipt view and will be similarly collapsed in the list view.
- Voided payments are already tracked in the payment records and will be included in the list with appropriate visual treatment.
- The page size for the receipt list defaults to 20 entries per page, consistent with pagination patterns used elsewhere in the application.
- No new authentication or authorization model is introduced; the receipt list inherits the existing public access model for receipt viewing.
- The feature is limited to read-only receipt viewing; no editing, downloading, or sharing capabilities are in scope for this version.

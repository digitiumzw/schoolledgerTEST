# Feature Specification: Bulk Student Import

**Feature Branch**: `077-bulk-student-import`  
**Created**: 2026-05-18  
**Status**: Draft  
**Input**: User description: "Add a bulk student import feature with CSV support."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Download CSV Template & Prepare Data (Priority: P1)

An admin or bursar navigates to a "Bulk Import Students" page, downloads a pre-built CSV template, fills in student records offline using a spreadsheet tool, then returns to the page to upload the completed file.

**Why this priority**: Without a clear template, users cannot produce a valid import file. The template is the entry point for the entire workflow and is the simplest deliverable that unlocks all downstream stories.

**Independent Test**: Can be fully tested by visiting the Bulk Import page, clicking "Download Template", opening the downloaded file, and confirming it contains the correct column headers with at least one example row.

**Acceptance Scenarios**:

1. **Given** the admin is on the Bulk Import Students page, **When** they click "Download CSV Template", **Then** a properly formatted CSV file is downloaded to their device containing all required column headers and at least one example row.
2. **Given** the downloaded template, **When** the user fills in student rows and saves the file, **Then** the file remains a valid CSV that can be re-uploaded without format errors.

---

### User Story 2 - Upload, Validate & Import CSV (Priority: P1)

An admin uploads a completed CSV file, the system validates every row, reports any errors with row-level detail, and — when no blocking errors remain — the admin confirms the import to create all student records.

**Why this priority**: This is the core value of the feature. The system must reliably accept valid data and reject or clearly flag invalid data before committing any records, to maintain data integrity.

**Independent Test**: Can be fully tested by uploading a CSV with a mix of valid and invalid rows, verifying per-row error messages appear, correcting the file, re-uploading, and confirming that all valid students are created in the system.

**Acceptance Scenarios**:

1. **Given** a valid, fully populated CSV file, **When** the admin uploads and clicks "Import", **Then** all student records are created, a success banner confirms how many were imported, and the post-import guidance message is shown.
2. **Given** a CSV with one or more rows containing missing required fields or duplicate first name + last name + date of birth, **When** the admin uploads the file, **Then** the system displays a validation summary listing each offending row number and the specific error before allowing import.
3. **Given** a CSV with some valid and some invalid rows, **When** validation completes, **Then** the admin is informed of the invalid rows and may choose to fix and re-upload; no students are created until a clean file is submitted.
4. **Given** a very large CSV (e.g., 2 000+ rows), **When** the import is triggered, **Then** a progress indicator is shown throughout and the page does not time out or become unresponsive.
5. **Given** an unauthenticated or unauthorised user, **When** they attempt to upload or import, **Then** the request is rejected with an appropriate access-denied response.

---

### User Story 3 - Post-Import Class Assignment Guidance (Priority: P2)

After a successful import, the system displays a clear actionable message directing the admin to the Classes page where they can multi-select the newly imported students and assign them to classes.

**Why this priority**: Without guidance, admins may not know the next step. This story links the import outcome to an existing workflow (multi-select class assignment) without requiring any new class-assignment UI.

**Independent Test**: Can be fully tested by completing a successful import and confirming the success state shows the prescribed guidance message with a navigable link to the Classes page.

**Acceptance Scenarios**:

1. **Given** a successful import, **When** the import completes, **Then** the success message reads "Students imported successfully. Please go to the Classes page to assign students to their respective classes using the multi-select feature." and includes a direct link to the Classes page.
2. **Given** the admin clicks the Classes page link in the success message, **Then** they are navigated to the Classes page.

---

### Edge Cases

- What happens when the uploaded file is not a CSV (e.g., .xlsx, .pdf)? → System rejects with "Invalid file type — please upload a CSV file."
- What happens when the CSV is empty (headers only, no data rows)? → System displays "No student records found in the file."
- What happens when the CSV has correct headers but all rows are duplicates of existing students? → System reports each duplicate row and allows no imports.
- What happens when the CSV exceeds the maximum allowed file size? → System rejects the upload with a clear size-limit message before processing begins.
- What happens if the upload is interrupted mid-way? → Partial upload is discarded; the user is prompted to try again.
- What happens when a row has extra columns beyond the template? → Extra columns are silently ignored; valid columns are still processed.
- What happens when a date of birth value is in an unrecognised format? → That row is flagged with "Invalid date format for date_of_birth — expected YYYY-MM-DD."
- What happens if two rows in the same CSV file have the same first name + last name + date of birth? → Both rows are flagged as intra-file duplicates and not imported.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to download a CSV template file directly from the Bulk Import Students page containing all required column headers and at least one example data row.
- **FR-002**: Users MUST be able to upload a CSV file (maximum 10 MB) from the Bulk Import Students page using a file picker or drag-and-drop area.
- **FR-003**: System MUST validate each row of the uploaded CSV before any records are written, checking for required fields, data types, date formats, and length constraints.
- **FR-004**: System MUST display a per-row validation error report when one or more rows fail validation, showing the row number and a human-readable description of each error.
- **FR-005**: System MUST prevent import from proceeding when any validation errors exist; no partial imports from an invalid file.
- **FR-006**: System MUST detect and reject rows that would create a duplicate student, defined as matching first name + last name + date of birth within the same tenant.
- **FR-007**: System MUST detect and reject intra-file duplicate rows (identical first name + last name + date of birth appearing more than once in the uploaded CSV).
- **FR-008**: System MUST process the import in server-side batches to handle files containing up to 5 000 student rows without timeout or performance degradation.
- **FR-009**: System MUST display a visible import progress indicator while the import is being processed on the server.
- **FR-010**: System MUST show a success confirmation message after a completed import, stating the number of students created.
- **FR-011**: System MUST display the post-import guidance message: "Students imported successfully. Please go to the Classes page to assign students to their respective classes using the multi-select feature." with a direct link to the Classes page.
- **FR-012**: System MUST enforce tenant data isolation — a user from one tenant cannot import students into another tenant's records.
- **FR-013**: System MUST enforce role-based access — only users with admin or bursar roles may access the Bulk Import Students page and trigger an import.
- **FR-014**: System MUST reject uploaded files that are not CSV format and display a clear error message.
- **FR-015**: System MUST reject uploaded files exceeding the maximum allowed size before processing begins.
- **FR-016**: The Bulk Import Students page MUST be accessible from the existing Students section navigation.
- **FR-017**: System MUST accept extra columns beyond the template silently without erroring, while still validating and importing the known required columns.

### Key Entities

- **Import Batch**: A single upload event representing one CSV file submission; tracks tenant, uploader, submitted-at timestamp, total rows, valid rows, error rows, and final status (pending/validated/completed/failed).
- **Student Record**: The existing student entity in the system; bulk import creates new student records using the same data model as manual student creation.
- **CSV Row Error**: A validation finding attached to a specific row number within an import batch; contains field name and human-readable error message.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A file containing 2 000 student rows is fully validated and imported in under 60 seconds on the server without the user receiving a timeout error.
- **SC-002**: 100% of rows with missing required fields, invalid date formats, or duplicate identities are reported to the user before any records are created.
- **SC-003**: Zero duplicate student records are created for rows that match an existing tenant student's first name + last name + date of birth.
- **SC-004**: An admin can complete the end-to-end workflow (download template → fill data → upload → validate → import) in under 5 minutes for a file of up to 50 rows.
- **SC-005**: After a successful import, 100% of valid rows result in new student records accessible in the Students list.
- **SC-006**: The import page is accessible from Students section navigation in no more than 2 clicks from the main sidebar.
- **SC-007**: The post-import success message and Classes page link are visible on screen without scrolling on a standard 1280 × 800 display after import completes.

## Assumptions

- The existing Students module and student data model are already in place; this feature creates new students using the same fields and validation rules as the existing manual student creation flow.
- Duplicate detection is based on the combination of first name + last name + date of birth within the same tenant; no national ID or student number uniqueness is enforced at this stage.
- Students imported via CSV are created without a class assignment; class assignment is a separate step performed via the existing multi-select feature on the Classes page.
- The CSV template must include at minimum: `first_name`, `last_name`, `date_of_birth`, `gender`, `phone_number` (optional), `address` (optional). Additional optional fields may be added but are not required for a valid import.
- File size limit of 10 MB is sufficient for files up to approximately 50 000 rows of typical student data.
- Batched server-side processing (e.g., chunks of 200–500 rows) is used to stay within request memory limits; the exact batch size is an implementation detail.
- The import does not assign transport, fee campaigns, or other relationships — only core student profile data is created.
- Admin and bursar roles have import access; teacher role does not.
- Mobile support for the import page is out of scope for v1; a desktop browser is assumed.
- The existing authentication and multi-tenant JWT system is reused; no new auth mechanism is needed.

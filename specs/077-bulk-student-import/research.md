# Research: Bulk Student Import (077)

## Decision 1 — CSV Parsing Strategy (Backend)

**Decision**: Parse the CSV entirely in PHP on the backend using `fgetcsv()` within a streaming loop; do not load the full file into memory at once.

**Rationale**: PHP's `fgetcsv()` reads one row at a time from the file handle, keeping memory consumption constant regardless of file size (5 000 rows × typical 200 B row ≈ 1 MB raw). A full `file_get_contents()` load followed by `str_getcsv()` would spike RAM for large files.

**Alternatives considered**:
- Third-party libraries (league/csv): adds a Composer dependency for a use case that native PHP handles well. Rejected to keep dependency footprint minimal.
- Chunked multipart upload: unnecessary complexity — a 10 MB file upload is well within CodeIgniter 4's default `upload_max_filesize` and PHP `post_max_size` defaults (both 8 MB in stock PHP; recommended to set to 12 MB in server config). The spec cap of 10 MB fits within safe limits.

---

## Decision 2 — Validate-then-Import Two-Phase Flow

**Decision**: Use a two-phase single-request approach: the `POST /api/students/import/validate` endpoint receives the file, validates all rows, and returns the error report without writing anything. A separate `POST /api/students/import/execute` endpoint accepts the same file again and writes rows atomically only when there are no errors.

**Rationale**: This cleanly separates read-only validation from write operations, avoids storing intermediate state on the server, and keeps the frontend flow simple (upload → see errors / confirm). No import batch table is required for the v1 MVP.

**Alternatives considered**:
- Server-side staged import (store file, run background job, poll for status): adds queue infrastructure, job runner, and status polling. Over-engineered for school-scale batch sizes (up to 5 000 rows). Rejected.
- Single combined validate+import endpoint: makes it impossible to show errors before committing. Rejected — the spec requires errors to be visible before any records are written.

---

## Decision 3 — Duplicate Detection Strategy

**Decision**: Duplicate detection uses a compound key of `(tenant_id, LOWER(first_name), LOWER(last_name), date_of_birth)`. For database-level dedup, build an in-memory lookup of existing `(lower_first, lower_last, dob)` tuples for the tenant at the start of the validate phase using a single bulk `SELECT`. Intra-file duplicates are detected via a PHP associative array keyed on the same compound during row iteration.

**Rationale**: A single bulk `SELECT first_name, last_name, date_of_birth FROM students WHERE tenant_id = ?` at validate time avoids per-row `SELECT` queries (N+1). Case-insensitive comparison (`LOWER()` in the database query and `strtolower()` in PHP) prevents obvious near-duplicate variants from being missed.

**Alternatives considered**:
- Adding a `UNIQUE` database index on `(tenant_id, first_name, last_name, date_of_birth)`: would enforce the constraint at the DB level but forces a try-catch per-insert approach and provides no friendly per-row report. Rejected in favour of application-level detection with explicit error reporting.
- Using admission_number as the duplicate key: admission numbers can be auto-generated or provided, making them unreliable as a pre-import dedup key. Rejected.

---

## Decision 4 — Batched Insert (Performance)

**Decision**: During the execute phase, process rows in batches of 250 using `insertBatch()`. Each batch runs inside the same database transaction. If any batch fails, the transaction is rolled back.

**Rationale**: CodeIgniter 4's `insertBatch()` generates a single multi-row `INSERT` statement per batch, which is significantly faster than individual `INSERT` per row. Batches of 250 balance memory use and SQL statement size. Wrapping all batches in one transaction ensures atomicity.

**Alternatives considered**:
- Single `insertBatch()` for all rows: generates a very large SQL statement for 5 000 rows. MySQL's `max_allowed_packet` default (64 MB) would allow it, but the PHP memory impact of accumulating all row data is avoided with batching. Rejected.
- Background queue (e.g., Redis + worker): unnecessary infrastructure. Batch inserts for 5 000 rows complete in under 5 seconds in practice. Rejected.

---

## Decision 5 — Frontend Upload UX

**Decision**: Implement the Bulk Import page as a new dedicated route `/students/import` with a three-state UI: (1) idle/upload state with drop zone and template download button; (2) validation-result state showing errors per row or a "Ready to import" confirmation; (3) success state with import count and Classes page link.

**Rationale**: A dedicated page (not a modal) gives enough vertical space to display per-row error tables cleanly. Three distinct states map directly to the spec's user stories and eliminate ambiguity about what the user should do next.

**Alternatives considered**:
- Modal on the Students page: too constrained for a potentially long error table. Rejected.
- Inline on the Students page: clutters the main student list view. Rejected.

---

## Decision 6 — CSV Template Column Set

**Decision**: The downloadable CSV template will contain these columns in order:

| Column | Required | Validation |
|---|---|---|
| `first_name` | Yes | Non-empty string, max 100 chars |
| `last_name` | Yes | Non-empty string, max 100 chars |
| `date_of_birth` | Yes | YYYY-MM-DD format, not in future |
| `gender` | Yes | `male` or `female` (case-insensitive) |
| `national_id` | No | String, max 50 chars |
| `email` | No | Valid email format or blank |
| `address` | No | String, max 500 chars |
| `guardian_name` | No | String, max 100 chars |
| `guardian_phone` | No | String, max 30 chars |
| `guardian_relationship` | No | String, max 50 chars |
| `admission_number` | No | Unique within tenant, max 50 chars |

**Rationale**: These align exactly with `StudentModel::formatFromApi()` / `allowedFields`. Fields not relevant to bulk import (photo, bursary, opening balance, class assignment) are deliberately excluded. `class_id` is excluded because class assignment is the post-import step in the Classes page.

---

## Decision 7 — Subscription Limit Enforcement

**Decision**: The validate endpoint checks the subscription plan's `max_students` limit. If importing `N` rows would exceed the limit, validation returns a top-level error (not per-row) before row-level validation proceeds.

**Rationale**: Mirrors the existing `StudentController::create()` subscription guard. Prevents a user from discovering the limit only after correcting all row-level errors.

---

## Decision 8 — Progress Indication

**Decision**: Use optimistic frontend UX: disable the Import button immediately on click, show a spinner/progress bar, and wait for the `execute` endpoint response. No server-sent events or polling needed because batch inserts for ≤5 000 rows complete within the HTTP request timeout.

**Rationale**: For ≤5 000 rows the execute phase completes in under 10 seconds in typical MySQL environments. SSE/WebSocket infrastructure is unnecessary complexity for this scale.

**Alternatives considered**:
- Server-Sent Events for real-time progress: justified only if rows can take minutes. Rejected.
- Polling a job status endpoint: requires async job runner. Rejected.

# API Contract: Financial Report PDF Generation

**Date**: 2026-06-15  
**Feature**: Generate Payment Financial Report (090-generate-payment-report)

## Endpoint

### GET /api/payments/report/pdf

Generates a financial summary report PDF for the selected period and optional filters.

#### Authentication

- **Required**: JWT Bearer token in `Authorization` header.
- **Roles**: `admin`, `bursar`, `super_admin`.
- **Unauthorized (401)**: Missing or invalid JWT.
- **Forbidden (403)**: User role is `teacher` or other non-privileged role.

#### Request

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `termId` | string | Conditionally | Academic term ID. Required if `month` and `year` are not provided. |
| `month` | integer (1-12) | Conditionally | Calendar month (1-12). Required if `termId` is not provided. |
| `year` | integer (1900-2200) | Conditionally | Calendar year. Required if `termId` is not provided. |
| `classId` | string | No | Filter to students in this class. |
| `method` | string | No | Filter to payments with this method (e.g., `Cash`, `EcoCash`). |
| `category` | string | No | Filter to payments/charges with this category. |

**Validation Rules**:
- At least one of `termId` OR (`month` + `year`) MUST be provided.
- If `termId` is provided, it MUST exist in the tenant's `academic_calendar.terms` array.
- If `month` is provided, it MUST be an integer between 1 and 12.
- If `year` is provided, it MUST be an integer between 1900 and 2200.
- `classId`, `method`, and `category` are optional and are applied as additional restrictions.

#### Success Response (200 OK)

**Content-Type**: `application/pdf`

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="financial-report-{term-label}-{YYYY-MM-DD}.pdf"
Content-Length: {byte-length}
```

**Body**: Raw PDF bytes.

#### Error Responses

All error responses follow the standard JSON envelope format:

```json
{
  "status": "error",
  "message": "Human-readable error description",
  "errors": {}
}
```

| HTTP Status | Condition | Example Message |
|-------------|-----------|-----------------|
| 400 | Missing required period parameters | "Either termId or month+year is required." |
| 400 | Invalid month value | "Invalid month. Must be between 1 and 12." |
| 400 | Invalid year value | "Invalid year." |
| 400 | Invalid termId (not found in calendar) | "Term not found in academic calendar." |
| 403 | User lacks required role | "Forbidden." |
| 404 | Tenant academic calendar not configured | "Academic calendar not configured." |
| 500 | PDF generation failure | "Failed to generate report. Please try again." |

#### Tenant Isolation

- All database queries MUST include `tenant_id = ?` where `?` is the `tenant_id` from the decoded JWT payload.
- Attempting to access another tenant's data by manipulating parameters MUST return a 404 ("Term not found") or empty results, never cross-tenant data.

## Frontend Integration

### api.ts Method

```typescript
// Proposed method signature
downloadFinancialReport(params: {
  termId?: string;
  month?: number;
  year?: number;
  classId?: string;
  method?: string;
  category?: string;
}): Promise<Blob>
```

**Implementation**:
- Uses the existing Axios instance with `responseType: 'blob'`.
- Constructs query string from params.
- Returns the Blob directly; the calling component handles the download trigger.

### Payments.tsx Integration

- Add a "Generate Financial Report" button near the existing filter bar.
- Button is disabled and shows a loading spinner during the Axios request.
- On success: create an object URL from the Blob, trigger a programmatic anchor click with the `download` attribute, then revoke the object URL.
- On error: display a toast with the error message from the JSON response.

## PDF Document Structure

The generated PDF contains the following sections in order:

1. **Header** (every page)
   - School logo (base64 encoded from `public/1765028860800.jpg`)
   - School name (from `tenants.name`)
   - Report title: "Financial Summary Report"
   - Selected period label (e.g., "Term 2 - 2026" or "June 2026")
   - Generation date and time

2. **Financial Summary**
   - Total Expected Fees
   - Total Payments Received
   - Total Outstanding Balance
   - Total Adjustments (Discounts/Waivers)
   - Collection Rate (percentage)

3. **Payment Method Breakdown**
   - Table: Method | Count | Total Amount
   - One row per distinct payment method used in the period

4. **Charges Summary**
   - Table: Category | Total Amount
   - Grouped by charge category

5. **Detailed Transactions**
   - Table: Date | Student Name | Class | Amount | Method | Category | Receipt #
   - One row per payment record in the period
   - Sorted by date descending

6. **Footer** (every page)
   - Page numbering: "Page X of Y"
   - Generated timestamp
   - "Confidential - {School Name}"

## Performance Expectations

- Target response time: < 5 seconds for reports covering up to 5,000 payment records.
- Target file size: < 5 MB for reports covering up to 5,000 payment records.
- No pagination of transactions within the PDF; all matching records are included.

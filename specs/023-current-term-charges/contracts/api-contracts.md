# API Contracts: Current Term Charge Generation

## Existing Endpoints (Modified Behavior)

### POST /api/ledger/generate-term-charges

**Modified to include validation gates.**

#### Request (Unchanged)
```json
{
  "termId": "term-1",
  "categories": [
    {"name": "Tuition", "amount": 500},
    {"name": "Sports", "amount": 50}
  ],
  "classId": "optional-class-id",
  "academicYear": "2026"
}
```

#### Success Response (200) - Unchanged
```json
{
  "success": true,
  "data": {
    "batchId": "batch-abc123",
    "generatedCount": 45,
    "totalAmount": 24750.00,
    "studentsAffected": 15,
    "generated": 45
  },
  "message": null
}
```

#### Error Responses (New Validation Errors)

**Term Mismatch (403)**
```json
{
  "success": false,
  "error": {
    "code": "TERM_MISMATCH",
    "message": "Charge generation is only allowed for the current term (Term 1).",
    "details": {
      "currentTerm": {
        "id": "term-1",
        "name": "Term 1",
        "start": "2026-01-15",
        "end": "2026-04-05"
      },
      "requestedTerm": "term-2",
      "today": "2026-02-20"
    }
  }
}
```

**Calendar Incomplete (403)**
```json
{
  "success": false,
  "error": {
    "code": "CALENDAR_INCOMPLETE",
    "message": "Academic calendar is incomplete. Please configure all term dates before generating charges.",
    "details": {
      "missingTerms": ["term-3"],
      "configuredTerms": ["term-1", "term-2"]
    }
  }
}
```

**Outside Term Dates (403)**
```json
{
  "success": false,
  "error": {
    "code": "OUTSIDE_TERM_DATES",
    "message": "Charge generation is not available. Today (2026-04-20) falls outside all term dates.",
    "details": {
      "today": "2026-04-20",
      "lastTermEnd": "2026-04-05",
      "nextTermStart": "2026-05-05"
    }
  }
}
```

**New Year Detected (403)**
```json
{
  "success": false,
  "error": {
    "code": "NEW_YEAR_DETECTED",
    "message": "A new academic year has begun. Please update the academic calendar before generating charges.",
    "details": {
      "today": "2027-01-15",
      "lastConfiguredDate": "2026-12-05",
      "actionRequired": "Update calendar in Settings > Academic Calendar"
    }
  }
}
```

---

### POST /api/settings/calendar

**Modified to include term sequence validation.**

#### Request (Unchanged)
```json
{
  "terms": [
    {"id": "term-1", "name": "Term 1", "start": "2026-01-15", "end": "2026-04-05"},
    {"id": "term-2", "name": "Term 2", "start": "2026-05-05", "end": "2026-08-10"},
    {"id": "term-3", "name": "Term 3", "start": "2026-09-10", "end": "2026-12-05"}
  ],
  "schoolOpen": true,
  "disableAttendanceWhenClosed": true
}
```

#### Error Response - Term Overlap (400)
```json
{
  "success": false,
  "error": {
    "code": "TERM_OVERLAP",
    "message": "Invalid term dates: Term 1 end date (2026-04-15) overlaps with Term 2 start date (2026-04-05).",
    "details": {
      "overlaps": [
        {
          "term1": "Term 1",
          "term1End": "2026-04-15",
          "term2": "Term 2",
          "term2Start": "2026-04-05"
        }
      ]
    }
  }
}
```

---

## New Endpoints

### GET /api/settings/calendar-status

**New endpoint to check calendar and charge generation status.**

#### Response (200)
```json
{
  "success": true,
  "data": {
    "calendarComplete": true,
    "currentTerm": {
      "id": "term-1",
      "name": "Term 1",
      "start": "2026-01-15",
      "end": "2026-04-05"
    },
    "today": "2026-02-20",
    "isNewYear": false,
    "canGenerateCharges": true,
    "blockingReason": null
  }
}
```

#### Response - Incomplete Calendar (200, canGenerateCharges: false)
```json
{
  "success": true,
  "data": {
    "calendarComplete": false,
    "currentTerm": null,
    "today": "2026-02-20",
    "isNewYear": false,
    "canGenerateCharges": false,
    "blockingReason": "CALENDAR_INCOMPLETE",
    "missingTerms": ["term-2", "term-3"]
  }
}
```

#### Response - New Year Detected (200, canGenerateCharges: false)
```json
{
  "success": true,
  "data": {
    "calendarComplete": true,
    "currentTerm": null,
    "today": "2027-01-15",
    "isNewYear": true,
    "canGenerateCharges": false,
    "blockingReason": "NEW_YEAR_DETECTED",
    "actionRequired": "Update academic calendar for 2027"
  }
}
```

---

## Frontend Integration

### Error Handling Pattern

```typescript
// src/api/ledger.ts
interface ChargeGenerationError {
  code: 'TERM_MISMATCH' | 'CALENDAR_INCOMPLETE' | 'OUTSIDE_TERM_DATES' | 'NEW_YEAR_DETECTED';
  message: string;
  details: {
    currentTerm?: { id: string; name: string; start: string; end: string };
    requestedTerm?: string;
    today?: string;
    actionRequired?: string;
  };
}

// Hook usage
const { mutate: generateCharges, error } = useGenerateCharges();

// Component displays error.code-specific UI
```

### UI Components

| Error Code | Component Behavior |
|------------|-------------------|
| `TERM_MISMATCH` | Show current term info, disable other term selection |
| `CALENDAR_INCOMPLETE` | Block UI, show "Configure Calendar" CTA |
| `OUTSIDE_TERM_DATES` | Display gap period message, next term start date |
| `NEW_YEAR_DETECTED` | Show prominent banner, link to calendar settings |

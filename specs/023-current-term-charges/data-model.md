# Data Model: Current Term Charge Generation

**Feature**: Current Term Charge Generation with Academic Calendar Validation

## Existing Entities (No Schema Changes)

### Tenant
```
Table: tenants
- id (VARCHAR 50) PK
- academic_calendar (JSON NULL)  // Stores term dates
- settings (JSON NULL)
- fee_structure (JSON NULL)
- payment_categories (JSON NULL)
- created_at, updated_at (DATETIME)
```

**Academic Calendar JSON Structure**:
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

### Charge
```
Table: charges
- id (VARCHAR 50) PK
- tenant_id (VARCHAR 50) FK → tenants.id
- student_id (VARCHAR 50) FK → students.id
- term_id (VARCHAR 50)          // Added in previous migration
- category (VARCHAR 100)
- charge_type (VARCHAR 50)       // 'fee_structure', 'opening_balance', etc.
- status (VARCHAR 20)           // 'pending', 'paid', 'overdue', 'cancelled'
- amount (DECIMAL 10,2)
- date_generated (DATE)
- due_date (DATE)
- academic_session (VARCHAR 20)  // Year identifier
- term (VARCHAR 20)              // Term identifier
- generation_batch_id (VARCHAR 50)
- is_fee_structure (TINYINT 1)
- created_by (VARCHAR 50)
- created_at, updated_at (DATETIME)
- deleted_at (DATETIME NULL)
```

## Validation Logic (No New Tables)

### CurrentTermContext (Runtime Object)
Computed at request time, not persisted:
```php
{
  "currentDate": "2026-04-10",           // date('Y-m-d')
  "activeTermId": "term-1",              // Determined from calendar
  "calendarValid": true,                 // All terms configured
  "isNewYear": false,                    // currentDate > lastTerm.end
  "canGenerateCharges": true,            // All validations pass
  "blockingReason": null                 // Error code if blocked
}
```

### ChargeGenerationValidationResult (Response Object)
```php
{
  "allowed": false,
  "reason": "TERM_MISMATCH",             // Error code
  "message": "Charge generation is only allowed for Term 1 (current term).",
  "currentTerm": {
    "id": "term-1",
    "name": "Term 1",
    "start": "2026-01-15",
    "end": "2026-04-05"
  },
  "requestedTerm": "term-2",
  "calendarStatus": "COMPLETE"
}
```

## Validation Rules

### FR-001: Current Term Detection
```php
function getCurrentTerm(array $calendar, string $today): ?array {
    foreach ($calendar['terms'] as $term) {
        if ($today >= $term['start'] && $today <= $term['end']) {
            return $term;
        }
    }
    return null;  // In gap or outside all terms
}
```

### FR-006/007: Term Sequence Validation
```php
function validateTermSequence(array $terms): array {
    $errors = [];
    for ($i = 0; $i < count($terms) - 1; $i++) {
        $currentEnd = $terms[$i]['end'];
        $nextStart = $terms[$i + 1]['start'];
        if ($currentEnd > $nextStart) {
            $errors[] = "Term overlap: {$terms[$i]['name']} ends after {$terms[$i+1]['name']} starts";
        }
    }
    return $errors;
}
```

### FR-008: New Year Detection
```php
function isNewYear(array $calendar, string $today): bool {
    $lastTerm = end($calendar['terms']);
    return $today > $lastTerm['end'];
}
```

## Error Codes

| Code | Description | Trigger |
|------|-------------|---------|
| `CALENDAR_INCOMPLETE` | Academic calendar not fully configured | Missing term dates |
| `TERM_MISMATCH` | Requested term doesn't match current term | User requests wrong term |
| `OUTSIDE_TERM_DATES` | Current date outside any term | Date in gap or off-calendar |
| `NEW_YEAR_DETECTED` | Calendar needs updating for new year | Current date > last term end |
| `TERM_OVERLAP` | Invalid term sequence on save | Term dates overlap |
| `GAP_BETWEEN_TERMS` | Info only - gaps allowed | Date falls in gap |

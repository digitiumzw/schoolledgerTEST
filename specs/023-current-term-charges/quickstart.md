# Quickstart: Current Term Charge Generation

## Development Setup

### Prerequisites
- Backend running (`php spark serve` on :8080)
- Frontend running (`npm run dev` on :8080)
- Academic calendar configured with 3 terms

### Configure Test Calendar

1. **Login**: Use `admin@greenwood.co.zw` / `1234`

2. **Navigate**: Settings → Academic Calendar

3. **Configure Terms**:
   ```
   Term 1: 2026-01-15 to 2026-04-05
   Term 2: 2026-05-05 to 2026-08-10
   Term 3: 2026-09-10 to 2026-12-05
   ```

4. **Save**: Calendar validates term sequence automatically

## Testing Scenarios

### Scenario 1: Current Term Detection

**Setup**: Set system date to 2026-02-20 (within Term 1)

**Test**:
```bash
curl -X POST http://localhost:8080/api/ledger/generate-term-charges \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "termId": "term-2",
    "categories": [{"name": "Tuition", "amount": 500}]
  }'
```

**Expected**: 403 error with `TERM_MISMATCH` code

---

### Scenario 2: Term Sequence Validation

**Setup**: Try to save overlapping term dates

**Test**:
```bash
curl -X POST http://localhost:8080/api/settings/calendar \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "terms": [
      {"id": "term-1", "name": "Term 1", "start": "2026-01-15", "end": "2026-04-15"},
      {"id": "term-2", "name": "Term 2", "start": "2026-04-05", "end": "2026-08-10"}
    ]
  }'
```

**Expected**: 400 error with `TERM_OVERLAP` code

---

### Scenario 3: New Year Detection

**Setup**: Set system date to 2027-01-15 (after last term)

**Test**: Check calendar status
```bash
curl http://localhost:8080/api/settings/calendar-status \
  -H "Authorization: Bearer <token>"
```

**Expected**:
```json
{
  "canGenerateCharges": false,
  "isNewYear": true,
  "blockingReason": "NEW_YEAR_DETECTED"
}
```

---

### Scenario 4: Calendar Status Check

**Test**: Verify calendar completeness
```bash
curl http://localhost:8080/api/settings/calendar-status \
  -H "Authorization: Bearer <token>"
```

**Expected**: Returns current term, calendar status, and charge generation eligibility

## Frontend Testing

### Charge Generation Page

1. **Navigate**: Ledger → Generate Charges
2. **Observe**: Only current term is selectable
3. **Attempt**: Select different term → Error message displayed

### Calendar Configuration Page

1. **Navigate**: Settings → Academic Calendar
2. **Test**: Enter overlapping dates
3. **Observe**: Validation error on save

## Verification Checklist

- [ ] Can generate charges for current term only
- [ ] Blocked with `TERM_MISMATCH` for wrong term
- [ ] Blocked with `CALENDAR_INCOMPLETE` if terms missing
- [ ] Blocked with `OUTSIDE_TERM_DATES` in gap period
- [ ] Blocked with `NEW_YEAR_DETECTED` after last term
- [ ] Calendar save rejects overlapping term dates
- [ ] Error messages are clear and actionable
- [ ] All requests include proper `tenant_id` filtering

## Common Issues

| Issue | Solution |
|-------|----------|
| Charges generated for wrong term | Check `AcademicCalendarService::getCurrentTerm()` logic |
| Calendar not validating | Verify `SettingsController::saveCalendar()` calls validation |
| Tenant isolation failing | Ensure `getTenantId()` used in all queries |

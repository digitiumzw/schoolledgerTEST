# Quickstart: Student Status Filtering

**Feature**: 049-student-status-filtering  
**Date**: 2026-04-28

---

## What This Feature Changes

Three targeted fixes across backend and frontend:

1. **Transport module** — non-active students are excluded from all transport rosters and charge generation.
2. **Payment modal** — student search goes live to the backend on each keystroke (debounced); returns all statuses; removes the 2000-student prefetch.
3. **Students page status update** — confirmed to refresh immediately; no structural change needed beyond verification.

---

## Dev Setup

### Backend

```bash
cd backend
php spark serve          # starts on port 8080
php spark migrate        # run any pending migrations (none needed for this feature)
```

### Frontend

```bash
cd frontend
npm run dev              # starts on port 8080 (via Vite proxy)
```

Login: `admin@greenwood.co.zw` / `1234`

---

## Key Files to Touch

### Backend

| File | Change |
|------|--------|
| `app/Controllers/Api/TransportController.php` | Add `->where('s.status', 'active')` to `getRoutes()`, `getRoute()`, `generateCharges()`, and driver roster query |
| `app/Controllers/Api/StudentController.php` | Add `limit` parameter handling to `search()` method |

### Frontend

| File | Change |
|------|--------|
| `src/components/modals/RecordPaymentModal.tsx` | Replace prefetch + client-side filter with debounced live search |
| `src/api/api.ts` | Update `searchStudents()` to accept `limit` parameter |

---

## Testing Checklist

After implementation, verify manually:

- [ ] Change a student to Inactive on Students page → status updates immediately without reload
- [ ] Go to Transport → that student no longer appears in any route roster
- [ ] Go to Dashboard → student headcount excludes the inactive student
- [ ] Go to Attendance → that student is absent from the class roster
- [ ] Open payment modal → search for the inactive student by name → student appears in results
- [ ] Open payment modal → no students pre-loaded on open; empty state shown
- [ ] Open payment modal → type quickly → only one request fires per debounce window (check Network tab)

---

## Integration Tests Location

Backend tests: `backend/tests/`

Run with:
```bash
cd backend
composer test
```

New tests to write:
- `TransportController` — assert inactive student excluded from route roster
- `StudentController::search` — assert all statuses returned, limit parameter respected

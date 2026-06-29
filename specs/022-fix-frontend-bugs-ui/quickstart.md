# Quickstart: Fix Frontend Bugs and UI Inconsistencies

**Branch**: `022-fix-frontend-bugs-ui`  
**Date**: 2026-04-09

## Prerequisites

- Node.js 18+
- Backend running on `http://localhost:8080` (see `backend/.env`)
- Default dev credentials: `admin@greenwood.co.zw` / `1234`

## Running the Frontend

```bash
cd frontend
npm install          # if not already done
npm run dev          # starts Vite dev server on http://localhost:5173
```

## Verifying Bug Fixes

### 1. Error State Testing

To test error states without taking the backend offline, open DevTools → Network → select "Offline" or throttle to "Slow 3G" and navigate to:

- `/students/:id` — should show error alert + Retry button (not infinite spinner)
- `/` (Dashboard, teacher role) — should show error alert when class data fails
- `/payments` — should identify which source failed

### 2. Null Safety Testing

Open the Student Form modal for a student that has no current enrollment (e.g., a recently archived student). The modal must open without crashing.

Open the Staff Form modal for a staff record with no `hireDate`. The modal must open with the date field blank.

### 3. Form Validation Testing

In the Staff Form modal:
- Enter a phone number like `+263 77 123 4567` — should be accepted
- Enter a phone number like `(263) 771234567` — should be accepted
- Enter tomorrow's date as hire date — should show validation error

### 4. UI Consistency Check

Navigate to Students, Staff, Classes, and Transport list pages. The primary action button (top right) should look identical across all four. Check with DevTools → Elements to verify no inline `h-8 px-3` styles are present.

Open any modal and measure its width — it should match `max-w-lg` (512px) or `max-w-2xl` (672px) per the modal standard, never a viewport-relative width.

## Lint Check

```bash
cd frontend
npm run lint
```

All fixes must pass without new lint errors.

## Key Files for This Feature

| File | What to check |
|------|--------------|
| `src/pages/StudentProfile.tsx` | Error state + retry, no infinite spinner |
| `src/pages/Dashboard.tsx` | Error handling in `loadClassStudents`, `loadClassAnalytics` |
| `src/pages/Payments.tsx` | Per-source error identification in Promise.all |
| `src/components/modals/RecordPaymentModal.tsx` | Null guards on `student.currentEnrollment` |
| `src/components/modals/StudentFormModal.tsx` | Phone normalization, guardian null guard |
| `src/components/modals/StaffFormModal.tsx` | Hire date future check, DOB age check |
| `src/components/BalanceDisplay.tsx` | Remove hardcoded 'USD', consistent color classes |
| All 20 `src/pages/*.tsx` | Button variant/size + heading hierarchy |
| All 57+ `src/components/modals/*.tsx` | Modal width + footer pattern |

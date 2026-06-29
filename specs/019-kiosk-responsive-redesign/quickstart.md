# Quickstart: Kiosk Responsive Redesign

**Branch**: `019-kiosk-responsive-redesign`
**Date**: 2026-04-08

## Prerequisites

- Node.js 18+ installed
- Backend running on `http://localhost:8080` (or the kiosk API is reachable)
- A valid kiosk code (obtainable from the admin panel after seeding)

## Dev Setup

```bash
# From repo root
cd frontend
npm install        # if not already done
npm run dev        # Vite dev server starts on port 8080 (or next available)
```

## Testing Kiosk Pages

Navigate to the kiosk URLs directly (no login required — kiosk pages are public):

| Kiosk | URL |
|-------|-----|
| Staff Attendance | `http://localhost:8080/kiosk/{kiosk_code}` |
| Student Attendance | `http://localhost:8080/student-kiosk/{kiosk_code}` |
| Driver | `http://localhost:8080/driver-kiosk/{kiosk_code}` |

Use a seeded kiosk code. With `CompleteDatabaseSeeder`, a default kiosk code is available in the `kiosk_settings` table.

## Responsive Testing Workflow

Use Chrome DevTools (F12) → Device Toolbar to test at these viewport widths:

| Viewport | Test Scenario |
|----------|--------------|
| 375 × 812 (iPhone SE) | Narrowest supported; status buttons must use 2×2 grid |
| 768 × 1024 (iPad portrait) | Primary kiosk target; all buttons must be easily tappable |
| 1024 × 768 (iPad landscape) | Landscape kiosk; verify no horizontal scroll |
| 1280 × 800 (wide tablet / desktop) | Widescreen kiosk display |

**For touch simulation**: Enable "Touch" in Chrome DevTools device emulation to verify tap targets feel natural.

## Key Files to Modify

```
frontend/src/components/kiosk/
├── StudentKioskAttendance.tsx   ← highest priority: status button size fix
├── StudentKioskClassList.tsx    ← Back button and card size
├── KioskConfirmation.tsx        ← Done button size
├── StudentKioskConfirmation.tsx ← Done button size
├── KioskIdleScreen.tsx          ← verify responsive layout
└── StudentKioskIdEntry.tsx      ← verify responsive layout

frontend/src/pages/
└── DriverKioskPage.tsx          ← Back button, card/roster row size
```

## Verification Checklist

Before marking the feature complete, verify each item at 375px and 768px:

- [ ] All buttons have a rendered height ≥ 44px (inspect with DevTools)
- [ ] Primary action buttons (Continue, Submit, Done) have height ≥ 56px
- [ ] Status buttons (Present/Absent/Late/Excused) are 2×2 on 375px, 4-column on 768px+
- [ ] Back controls show both icon and text label
- [ ] No horizontal scrollbar at any tested viewport
- [ ] Student names and route names are `text-lg` (18px+)
- [ ] Error messages are legible at all sizes
- [ ] Sticky header/footer in `StudentKioskAttendance` does not overlap content
- [ ] Auto-reset countdown on confirmation screens works correctly
- [ ] Visual style matches existing system (same colors, radii, gradient backgrounds)

# Research: Kiosk Responsive Redesign

**Branch**: `019-kiosk-responsive-redesign`
**Date**: 2026-04-08

## Decision 1: Touch Target Minimum Size

**Decision**: 44×44px minimum tap target for all interactive elements; 56px height for primary action buttons.

**Rationale**: Apple Human Interface Guidelines specify 44×44pt; WCAG 2.5.5 specifies 44×44px; Material Design 3 specifies 48×48dp. The 44px floor is the safe cross-platform minimum. Primary action buttons (Continue, Submit, Done) benefit from taller targets (56px+) since they are the most-used elements on kiosk screens where users approach from a distance. This matches the existing `h-14` (56px) pattern already used for some buttons in the codebase — the task is to make this consistent everywhere.

**Alternatives considered**:
- 48px minimum (Material Design default): Acceptable but 44px is sufficient for compliance and is already established in some existing kiosk buttons.
- 40px (current icon-only Back buttons): Too small; fails WCAG and results in mis-taps.

---

## Decision 2: Status Button Layout (Student Attendance)

**Decision**: Enlarge each status button (`Present`, `Absent`, `Late`, `Excused`) to `min-h-[44px] px-4 py-2.5 text-sm` and arrange them in a 2×2 grid on mobile and a single row on tablet+.

**Rationale**: The current `text-xs px-3 py-1.5` buttons render at approximately 28px tall, which is the primary usability failure identified in the spec. A 2×2 grid on narrow screens ensures each button has adequate width without wrapping. On tablet (768px+) the 4-column single row fits comfortably at ≥44px height each.

**Alternatives considered**:
- Full-width stacked buttons (one per row): Takes excessive vertical space for a list of 30+ students; makes the page very long.
- Keeping a single row with larger padding: At 375px wide, 4 buttons in a row get too narrow (~70px each) to read at kiosk distance; grid is safer.
- Icon-only buttons (P/A/L/E): Ambiguous without labels; rejected.

**Tailwind implementation approach**:
```
grid grid-cols-2 gap-1.5 sm:grid-cols-4   (on the button group container)
min-h-[44px] px-4 text-sm font-semibold rounded-lg border  (on each button)
```

---

## Decision 3: Responsive Breakpoint Strategy

**Decision**: Use Tailwind's `sm` (640px) and `md` (768px) breakpoints for the key layout shifts.

**Rationale**: Kiosk devices are primarily tablets (768px+). The `md` breakpoint captures tablets in portrait. The `sm` breakpoint handles the transition from phone-width layouts (375–639px). The existing kiosk code already uses `sm:` in one place (`StudentKioskAttendance`), confirming this convention.

**Breakpoint mapping**:
- `< 640px` (sm): Single-column layouts; 2×2 status button grid; full-width cards
- `640–767px` (sm): Wider single-column; status buttons can be 4-column row
- `≥ 768px` (md): Wider content containers; more generous padding; 4-column status button row

---

## Decision 4: Back Button Pattern

**Decision**: Replace all icon-only or text-only Back controls with a consistent button that combines an `ArrowLeft` icon and the text label "Back", styled as `flex items-center gap-2 h-11 px-4 rounded-xl border-2 border-gray-200 hover:bg-gray-50`.

**Rationale**: The current implementations are inconsistent — `DriverKioskPage` uses an icon-only circle (`h-10 w-10`), `StudentKioskClassList` uses a text-link. A labeled button is both more accessible (clear affordance) and larger (44px height). Keeping consistent border+rounded-xl style matches the existing card and button visual language.

**Alternatives considered**:
- Keep icon-only with increased size: Fails clarity requirement; icon meaning is not self-evident to all users.
- Text-only "← Back": No border/button affordance makes it look like a link, not a tap target.

---

## Decision 5: Container Width Strategy

**Decision**: Widen the `max-w-md` (448px) constraint used in Driver Kiosk to `max-w-lg` (512px) for list views and keep `max-w-md` for single-field entry screens.

**Rationale**: Route cards and roster lists benefit from more horizontal space on 1024px+ displays. The Student Kiosk already uses `max-w-lg` for its class list. The entry screens (single input + button) look intentionally focused at `max-w-sm`/`max-w-md`. Standardizing on `max-w-lg` for list views creates consistency.

**Alternatives considered**:
- Full-width lists: Too wide on desktop kiosk displays; cards become very spread out.
- Keep `max-w-md` everywhere: Wastes space on tablet landscape and desktop kiosk screens.

---

## Decision 6: Typography Scale

**Decision**: Body text minimum `text-base` (16px); student names and route names `text-lg` (18px); section headings `text-2xl`+ (24px+). Input placeholder and value text remain `text-2xl font-mono` (already correct).

**Rationale**: The current student row names use `text-base font-medium` which is 16px — acceptable. Route names use `font-semibold text-gray-900` without an explicit size (inherits `text-base`). Elevating these to `text-lg` improves legibility from arm's length. The heading sizes in existing code (`text-3xl`, `text-4xl`) are already appropriate.

**What already meets the bar** (no change needed):
- `KioskIdleScreen`: clock at `text-5xl`, heading at `text-4xl sm:text-5xl`, input at `text-2xl` ✅
- `StudentKioskIdEntry`: heading at `text-4xl sm:text-5xl` ✅
- `StudentKioskAttendance`: header `text-xl`, student names `text-base` (borderline — upgrade to `text-lg`)

---

## Summary of Changes by Component

| Component | Key Changes |
|-----------|-------------|
| `KioskIdleScreen` | Increase "Continue" button from `h-14` → already OK; verify error box legibility |
| `KioskConfirmation` | "Done" button: `h-12` → `h-14`; widen to `max-w-lg` |
| `StudentKioskIdEntry` | "Continue" button already `h-14` ✅; verify layout on 375px portrait |
| `StudentKioskClassList` | Back button: text-link → labeled button; class cards: increase padding `py-5`; student name `text-lg` |
| `StudentKioskAttendance` | **Status buttons**: critical fix from `text-xs py-1.5` → `text-sm min-h-[44px]` + 2×2 grid on mobile; student names `text-lg`; Back/Submit bar: `h-14` |
| `StudentKioskConfirmation` | "Done" button: `h-12` → `h-14` |
| `DriverKioskPage` (idle view) | Already `h-14` Continue ✅; verify `max-w-md` is sufficient |
| `DriverKioskPage` (routes view) | Back: icon-only → labeled; route cards: `p-4` → `p-5`; `max-w-md` → `max-w-lg` |
| `DriverKioskPage` (roster view) | Row height `py-3` → `py-4`; student name `text-base` → `text-lg`; `max-w-md` → `max-w-lg` |

# Data Model: Kiosk Responsive Redesign

**Branch**: `019-kiosk-responsive-redesign`
**Date**: 2026-04-08

## Overview

This feature has **no data model changes**. All backend models, database tables, and API response shapes remain unchanged. The redesign is purely a frontend layout and styling change.

The entities below document the **UI state** and **component data shapes** that are relevant to understanding the rendering logic — not database entities.

---

## UI State Entities

### KioskView (Staff Attendance)

State machine for `KioskPage.tsx`. No changes to the state machine or transitions.

| State | Description |
|-------|-------------|
| `idle` | Shows `KioskIdleScreen` — employee ID input |
| `processing` | Shows a fullscreen spinner |
| `confirmation` | Shows `KioskConfirmation` — success screen with auto-reset |
| `error` | Shows error message (fatal load error) |

### KioskView (Student Attendance)

State machine for `StudentKioskPage.tsx`. No changes.

| State | Description |
|-------|-------------|
| `loading` | Initial status fetch |
| `idle` | Shows `StudentKioskIdEntry` — teacher ID input |
| `classSelection` | Shows `StudentKioskClassList` — class picker |
| `attendance` | Shows `StudentKioskAttendance` — per-student marking |
| `processing` | Fullscreen spinner during submit |
| `confirmation` | Shows `StudentKioskConfirmation` |
| `error` | Fatal error screen |

### KioskView (Driver)

State machine for `DriverKioskPage.tsx`. No changes.

| State | Description |
|-------|-------------|
| `loading` | Initial status fetch |
| `idle` | Employee ID input |
| `routes` | Route list |
| `roster` | Student roster for selected route |
| `error` | Fatal error screen |

### AttendanceStatus

Enum used in `StudentKioskAttendance`. Unchanged.

| Value | Displayed Label | Button Color |
|-------|----------------|--------------|
| `present` | Present | Emerald (green) |
| `absent` | Absent | Red |
| `late` | Late | Yellow |
| `excused` | Excused | Blue |

---

## Component Prop Contracts (Stability Constraints)

These prop interfaces MUST NOT change — the page components call these components with the existing props. Only internal rendering logic and className strings are modified.

### KioskIdleScreen
```
schoolName: string
workHours: { startTime: string; endTime: string } | null
onSubmit: (employeeId: string) => void
errorMessage?: string
```

### KioskConfirmation
```
result: KioskActionResult
onDone: () => void
```

### StudentKioskIdEntry
```
schoolName: string
onSubmit: (employeeId: string) => void
errorMessage?: string
```

### StudentKioskClassList
```
teacherName: string
classes: ClassItem[]          // { id, name, studentCount, attendanceRecorded }
onSelectClass: (classId: string) => void
onBack: () => void
```

### StudentKioskAttendance
```
className: string
date: string
students: StudentItem[]       // { id, firstName, lastName, currentStatus }
onSubmit: (records: Array<{ studentId: string; status: AttendanceStatus }>) => void
onBack: () => void
```

### StudentKioskConfirmation
```
className: string
totalStudents: number
date: string
onDone: () => void
```

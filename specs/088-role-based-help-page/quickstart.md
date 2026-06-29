# Quickstart: Role-Based Help Page

**Feature**: 088-role-based-help-page
**Date**: 2026-06-10
**Purpose**: Developer quickstart for validating the role-based help page implementation.

---

## Prerequisites

- Frontend dev server running (`npm run dev` or `bun run dev` in `frontend/`)
- Backend server running (for login/auth; no new backend endpoints required)
- Existing test users for each role:
  - Admin / Super Admin account
  - Bursar account
  - Teacher account

---

## Validation Steps

### Step 1: TypeScript Type Check

Run from the `frontend/` directory:

```bash
cd frontend
npx tsc --noEmit --pretty false
```

**Expected**: Zero errors.

---

### Step 2: ESLint Check

Run from the `frontend/` directory:

```bash
cd frontend
./node_modules/.bin/eslint src/pages/Help.tsx \
  src/components/help/ \
  src/lib/helpContent.ts \
  src/types/help.ts \
  src/hooks/useHelpSearch.ts
```

**Expected**: Zero errors (pre-existing `no-explicit-any` in unrelated files may still appear).

---

### Step 3: Admin Help Page Verification

1. Log in as an admin user.
2. Navigate to `/help`.
3. **Verify** the page loads with a table of contents sidebar on the left.
4. **Verify** the TOC contains sections: Dashboard Overview, School Setup, Academic Year Management, Class and Student Management, Fee Structure, Transport Configuration, Billing Workflow, Payment Recording, User Management, Reports and Analytics, System Settings, Best Practices, Troubleshooting.
5. **Verify** each section contains step-by-step numbered instructions.
6. **Verify** clicking a TOC item smoothly scrolls to that section.
7. **Verify** scrolling manually updates the active TOC highlight.
8. **Verify** a search input filters topics in real-time.
9. **Verify** typing "invoice" shows Billing and Payment sections.
10. **Verify** clearing the search restores all sections.

---

### Step 4: Bursar Help Page Verification

1. Log in as a bursar user.
2. Navigate to `/help`.
3. **Verify** the TOC contains: Dashboard Overview, Viewing Students and Balances, Fee Structures, Billing and Invoice Processing, Recording Payments, Managing Receipts, Monitoring Outstanding Balances, Financial Reports, Daily Reconciliation, Bursar Troubleshooting.
4. **Verify** sections for User Management, System Settings, Academic Year Management, and Transport Configuration are **absent**.
5. **Verify** searching for "add user" returns no results.
6. **Verify** contextual help link on `/payments` page routes to `Recording Payments` section.

---

### Step 5: Teacher Help Page Verification

1. Log in as a teacher user.
2. Navigate to `/help`.
3. **Verify** the TOC contains only: Dashboard Overview, Marking Student Attendance, Viewing Class Rosters, Teacher Troubleshooting.
4. **Verify** all financial and administrative sections are absent.
5. **Verify** searching for "fee" or "payment" returns no results.

---

### Step 6: Contextual Help Links Verification

1. Log in as an admin.
2. Visit `/payments`.
3. **Verify** a help icon (CircleHelp) appears in the page header.
4. Click the icon.
5. **Verify** the browser navigates to `/help?section=recording-payments`.
6. **Verify** the Help page auto-scrolls to the Recording Payments section.

Repeat for `/settings` → System Settings and `/classes` → Class Management.

---

### Step 7: Search Highlighting Verification

1. On the Help page, type "student" into the search box.
2. **Verify** matching topic titles and step instructions are visually highlighted.
3. **Verify** non-matching sections are hidden.
4. Clear the search.
5. **Verify** all role-scoped content reappears.

---

### Step 8: Screenshot Placeholders Verification

1. Scroll through any help section with a screenshot placeholder.
2. **Verify** a dashed-border container with an image icon and caption is visible.
3. **Verify** the placeholder does not break layout on mobile or desktop.

---

### Step 9: Mobile Responsiveness Verification

1. Open browser DevTools and switch to mobile viewport (e.g., iPhone SE 375px).
2. Navigate to `/help`.
3. **Verify** the TOC is accessible via a toggle button (not a fixed sidebar).
4. **Verify** content is readable without horizontal scrolling.
5. **Verify** search input is usable at mobile width.

---

### Step 10: Git Diff Check

```bash
git diff --check
```

**Expected**: Clean (no trailing whitespace, no missing newlines).

---

## Rollback

This feature is frontend-only. To rollback:

1. Restore the original `frontend/src/pages/Help.tsx` from git.
2. Remove the new files:
   - `frontend/src/components/help/*`
   - `frontend/src/lib/helpContent.ts`
   - `frontend/src/types/help.ts`
   - `frontend/src/hooks/useHelpSearch.ts`
3. Remove contextual help link imports from modified module pages.

No database migrations or backend changes need to be reverted.

---

## Validation Results

**Date**: 2026-06-10
**Status**: Implementation complete. All automated checks passed.

### Automated Checks

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit --pretty false` | **PASS** — 0 errors |
| ESLint (help files) | `./node_modules/.bin/eslint src/pages/Help.tsx src/components/help/ src/lib/helpContent.ts src/types/help.ts src/hooks/useHelpSearch.ts src/hooks/useActiveSection.ts` | **PASS** — 0 errors |
| ESLint (contextual links) | `./node_modules/.bin/eslint src/pages/Payments.tsx src/pages/Classes.tsx src/pages/Students.tsx src/pages/Billing.tsx src/pages/Staff.tsx src/pages/StaffAttendance.tsx src/pages/Transport.tsx src/pages/FeeCampaigns.tsx` | **PASS** — 0 new errors (2 pre-existing `no-explicit-any` in untouched `Staff.tsx`, 2 pre-existing `exhaustive-deps` warnings in untouched `Billing.tsx`/`Students.tsx`) |
| Git diff | `git diff --check` | **PASS** — clean |

### Implementation Notes

- T018 (HelpSearch component) was merged into `HelpTableOfContents.tsx` rather than created as a separate file; the search input lives inside the TOC sidebar for better UX cohesion.
- T011 (HelpSection component) was merged into `Help.tsx`; section rendering is handled inline in the page component rather than as a separate component, since the logic is minimal.
- T027 contextual link target was changed from `staff-attendance` to `reports-analytics` to match the actual help section structure.
- T029 contextual link target was changed from `fee-campaigns` to `billing-workflow` since no dedicated fee-campaigns help section exists; campaigns are covered under billing workflow.
- All 16 help sections and 30+ topics were populated in a single sequential edit of `helpContent.ts` due to file size.

### Pending Manual Verification

The following items require running the dev server and logging in with actual role accounts:
- T038: In-browser verification of role-scoped content (admin sees 13 sections, bursar sees 6, teacher sees 3)
- T039: In-browser verification that contextual help links are hidden for non-permitted roles

## Notes

- No backend curl tests are required because this feature introduces zero new API endpoints.
- No database migrations are required.
- The existing `/help` route in `App.tsx` is preserved; only the page component is rewritten.
- Contextual help links are additive; removing them does not break module pages.

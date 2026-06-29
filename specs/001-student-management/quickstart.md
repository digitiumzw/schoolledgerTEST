# Quickstart: Student Management Feature Validation

**Branch**: `001-student-management`
**Date**: 2026-04-03

Use this guide to manually validate the feature end-to-end after implementation.

## Prerequisites

```bash
# 1. Start backend
cd backend && php spark serve

# 2. Start frontend (separate terminal)
cd frontend && npm run dev

# 3. Run migrations
cd backend && php spark migrate

# 4. Login
# URL: http://localhost:8080
# Email: admin@greenwood.co.zw  /  Password: 1234
```

---

## Validation Step 1 — Enroll a New Student (P1)

1. Navigate to **Students** → click **Add Student**.
2. Fill in:
   - First name: `Test`, Last name: `Student`
   - Leave **Admission Number** blank (should auto-generate)
   - Gender: `Male`
   - Date of Birth: `2012-05-20`
   - National ID: `12-345678A21`
   - Class: any available class
   - Guardian name: `Test Guardian`, Phone: `+263771234567`, Relationship: `Mother`
   - Second guardian name: `Second Guardian`, Phone: `+263779876543`, Relationship: `Father`
3. Click **Save**.

**Expected**:
- Student appears in directory immediately with an auto-generated admission number (format
  `{YEAR}/NNN`).
- Student's status shows as `Active`.

4. Attempt to enroll a second student with the **same admission number** as the one just
   created.

**Expected**: Error message — "Admission number is already in use at this school."

---

## Validation Step 2 — View and Edit Profile (P2)

1. Click the student created in Step 1 to open their profile.

**Expected**: Profile shows admission number, gender, both guardians, and all entered fields.

2. As admin: click **Edit**, change the guardian phone number, click **Save**.

**Expected**: Updated phone number visible immediately; no page reload required.

3. Log out and log back in as a **teacher** account. Open the same student profile.

**Expected**: No edit controls visible; read-only view only.

---

## Validation Step 3 — Directory Search and Filter (P3)

1. Navigate to **Students** directory.
2. Type the first three letters of the test student's last name.

**Expected**: Directory filters to show only matching students within ~1 second.

3. Type the exact admission number (e.g., `2026/001`) in the search box.

**Expected**: Only the matching student shown.

4. Select a grade/class from the filter dropdown.

**Expected**: Only students in that grade/class are listed.

5. Select status filter `Transferred`.

**Expected**: No active students shown; only transferred ones.

---

## Validation Step 4 — Status Lifecycle (P4)

1. Open the test student profile. Click **Change Status**.
2. Select `Transferred`, enter effective date `today`, reason `Test transfer`.
3. Click **Save**.

**Expected**:
- Student status changes to `Transferred`.
- Student no longer appears in the default Active directory.
- A status history entry is visible in the student's profile (Status History tab or section).

4. Navigate to **Billing** / charge generation.

**Expected**: Transferred student does NOT appear in the active student list for charges.

5. Search with status filter `Transferred` — find the student and verify all historical
   payment and charge records are still visible.

---

## Validation Step 5 — Hard-Delete Protection

1. Open a student who has at least one charge or payment on record.
2. Attempt to delete the student.

**Expected**: Error message — "Cannot delete a student with financial records. Change the
student's status instead." Delete does NOT proceed.

3. Open a brand-new student with zero financial records. Attempt to delete.

**Expected**: Delete succeeds; student is removed from directory.

---

## Validation Step 6 — Bulk Status Update

1. Navigate to **Students** directory.
2. Select 3+ active students via checkbox.
3. Choose **Bulk Action → Graduate**.
4. Enter effective date and reason, confirm.

**Expected**: All selected students move to `Graduated` status; disappear from active list;
status history entries created for each.

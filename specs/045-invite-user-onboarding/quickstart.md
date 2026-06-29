# Quickstart: Invitation-Based User Onboarding

**Feature**: `045-invite-user-onboarding`  
**Date**: 2026-04-27

---

## Prerequisites

- Backend running at `http://localhost:8080`
- Frontend running at `http://localhost:8082` (or configured `VITE_API_BASE_URL`)
- Database migrations applied (see below)
- SMTP/Mailtrap configured in `backend/.env` (or use log driver for local dev)

---

## Setup Steps

### 1. Apply Migrations

```bash
cd backend
php spark migrate
```

This runs:
- `2026-04-27-320000_Create_user_invitations_table` — creates `user_invitations` table
- `2026-04-27-330000_Add_invited_status_to_users` — adds `'invited'` to `users.status` enum

Verify:
```sql
DESCRIBE user_invitations;
SHOW COLUMNS FROM users LIKE 'status';
-- expected: enum('active','inactive','invited')
```

### 2. Configure Email (local dev)

In `backend/.env`, set the CodeIgniter email driver to log emails to a file so you can grab invitation tokens without an SMTP server:

```ini
email.protocol = mail
# Or use Mailtrap for SMTP testing:
# email.protocol = smtp
# email.SMTPHost = sandbox.smtp.mailtrap.io
# email.SMTPUser = your-user
# email.SMTPPass = your-pass
# email.SMTPPort = 587
```

To intercept emails during dev, check `backend/writable/logs/` or configure Mailtrap.

---

## Testing the Invite Flow Manually

### Step 1 — Admin sends invite

```bash
# Log in as an admin first to get a JWT
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourschool.com","password":"yourpassword"}' \
  | jq -r '.data.token')

# Send invite
curl -X POST http://localhost:8080/api/users/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com","role":"admin"}'
```

Expected: `201 Created` with user in `invited` status.

### Step 2 — Extract the invitation link

In development, find the plain token in the email log or Mailtrap. The link format is:

```
http://localhost:8082/accept-invite?token=<64-hex-chars>
```

### Step 3 — Accept the invite

```bash
curl -X POST http://localhost:8080/api/auth/accept-invite \
  -H "Content-Type: application/json" \
  -d '{"token":"<plain-token>","password":"mynewpassword1"}'
```

Expected: `200 OK`. User status changes to `active`.

### Step 4 — Log in with new credentials

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"mynewpassword1"}'
```

Expected: `200 OK` with JWT token.

---

## Testing the Resend Flow

```bash
# Get the invited user's ID from the invite response
USER_ID="u1234_abcdef"

curl -X POST http://localhost:8080/api/users/$USER_ID/resend-invite \
  -H "Authorization: Bearer $TOKEN"
```

Expected: old token invalidated, new email dispatched, `200 OK`.

---

## Testing Login Block for Pending Accounts

Before accepting the invite, attempt login:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"anything"}'
```

Expected: `403 Forbidden` — `"Your account is pending. Please accept your invitation email to set a password."`

---

## Running Integration Tests

```bash
cd backend
php spark test --filter UserInvitationTest
```

Test coverage expected:
- Happy path: invite → accept → login succeeds
- Expired token: `400` on accept
- Already-used token: `400` on accept
- Resend: old token invalidated, new token works
- Cross-tenant isolation: token for tenant A cannot be used after a tenant B user is created with the same email
- Account cap: 5 active+invited accounts blocks 6th invite

---

## Common Issues

**"Column 'status' cannot be null"** after migration  
→ Ensure the migration ran successfully. Run `php spark migrate:status` to confirm.

**Invite email not arriving**  
→ Check `backend/writable/logs/log-<date>.log` for `[error] Email failed` entries. Verify SMTP config.

**Token expired immediately**  
→ Check server clock. Token expiry is `NOW() + 48 hours`; if the server clock is wrong, tokens expire instantly.

**"This invitation link is invalid"** even with a fresh token  
→ Confirm the full token (64 hex chars) is being passed. URL-decoding issues can truncate tokens that contain `+` or `=` — though `bin2hex` output never contains these characters.

**Frontend `/accept-invite` shows 404**  
→ Ensure `App.tsx` has the public route registered and the frontend is rebuilt (`npm run build` or Vite dev server restarted).

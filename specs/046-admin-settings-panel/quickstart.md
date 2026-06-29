# Quickstart: Admin Settings Panel

**Branch**: `046-admin-settings-panel` | **Date**: 2026-04-27

---

## Prerequisites

- PHP 8.1+, Composer, MySQL running
- Node.js 18+ / Bun
- `.env` configured in `backend/` (copy from `.env.example`; set `JWT_SECRET_KEY`, `PLATFORM_JWT_SECRET_KEY`, DB credentials, `app.baseURL`)
- `.env` configured in `frontend/` (copy from `.env.example`; set `VITE_PLATFORM_API_URL`)

---

## 1. Run new migrations

```bash
cd backend
php spark migrate
```

Expected new migrations applied (in order):
1. `2026-04-27-400000_Add_status_actor_name_to_platform_users`
2. `2026-04-27-400001_Create_platform_login_history_table`
3. `2026-04-27-400002_Add_actor_name_email_snapshot_to_platform_audit`
4. `2026-04-27-400003_Create_platform_invitations_table`

---

## 2. Start the backend

```bash
cd backend
php spark serve --port=8080
```

---

## 3. Start the frontend (admin console)

```bash
cd frontend
bun install   # or npm install
bun run dev   # or npm run dev
```

Navigate to `http://localhost:5173/platform-control-panel/login`.

---

## 4. Smoke test — Settings section

1. Log in as an Owner account.
2. Navigate to **Settings** — verify 6 tabs appear: Account, Team, Access Control, Security, Audit Logs, General.
3. **Account tab**: Update display name → verify it persists after page reload.
4. **Team tab**: Invite a new team member (Finance role) → verify Invited status appears and invitation email is dispatched (check backend log if SMTP not configured).
5. **Access Control tab**: Verify the role-permission matrix renders without placeholders.
6. **Security tab**: Click "Enable Two-Factor Authentication" → complete enrolment flow → log out → verify TOTP is required on next login.
7. **Audit Logs tab**: Verify the actions from steps 3–6 appear as entries with actor name/email, action, and timestamp.

---

## 5. Verify immediate role-enforcement

```bash
# Get a valid token for a Finance-role admin
TOKEN="<finance-admin-token>"

# Attempt to suspend a tenant — should return 403
curl -X POST http://localhost:8080/api/platform/tenants/1/suspend \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"status":"error","message":"You do not have permission..."}

# Attempt to change a team member's role — should return 403
curl -X PUT http://localhost:8080/api/platform/team/2/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"Admin"}'
# Expected: {"status":"error","message":"You do not have permission..."}
```

---

## 6. Run backend integration tests

```bash
cd backend
./vendor/bin/phpunit --testdox tests/Controllers/Platform/
```

Expected test classes:
- `SettingsControllerTest` — account CRUD, 2FA, deactivation, last-Owner guard
- `AuditControllerTest` — listing, filtering, CSV export
- `PlatformJWTAuthFilterTest` — immediate role enforcement, deactivated-account rejection

---

## 7. Key environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `PLATFORM_JWT_SECRET_KEY` | `backend/.env` | Signs platform-scoped JWTs |
| `JWT_SECRET_KEY` | `backend/.env` | Signs tenant-scoped JWTs |
| `VITE_PLATFORM_API_URL` | `frontend/.env` | Base URL for platform API calls |
| `email.SMTPHost` etc. | `backend/.env` | SMTP for invitation/password-reset emails |

---

## 8. Troubleshooting

- **2FA QR not scanning**: Verify `app.baseURL` is set correctly in `backend/.env`; the issuer in the `otpauth://` URI derives from it.
- **Invitation email not received**: Check `backend/writable/logs/` for SMTP errors; in dev, the invite link is also returned in the API response `data.invite_link` field (dev mode only).
- **403 on Settings write as Admin**: Confirm `PlatformPolicy::canManageSettings` has been updated to include `Admin` (was Owner-only).
- **Role change not taking effect immediately**: Confirm `PlatformJWTAuthFilter` DB re-fetch is in place — check `$request->platformUser->platform_role` is set from the DB record, not the JWT `data` payload.

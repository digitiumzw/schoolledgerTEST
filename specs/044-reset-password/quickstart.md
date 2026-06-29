# Quickstart: Password Reset Feature

**Feature**: Reset Password  
**Branch**: `044-reset-password`

## Development Setup

### 1. Database Migration

```bash
cd backend
php spark migrate
```

This creates the `password_reset_tokens` table.

### 2. Environment Configuration

Add to `backend/.env`:
```env
# Password Reset Settings
RESET_TOKEN_TTL_HOURS=24
RESET_RATE_LIMIT_PER_EMAIL=3
RESET_RATE_LIMIT_PER_IP=10
```

### 3. Email Configuration

Ensure email is configured in `backend/.env`:
```env
email.protocol=smtp
email.SMTPHost=your-smtp-host
email.SMTPUser=your-email@example.com
email.SMTPPass=your-password
email.SMTPPort=587
email.SMTPCrypto=tls
```

## Testing the Feature

### Manual Testing Steps

1. **Navigate to login page**: `http://localhost:5173/login`
2. **Click "Forgot Password?"** link
3. **Enter email** of existing user account
4. **Check email inbox** for reset message
5. **Click reset link** in email
6. **Enter new password** on reset form
7. **Log in** with new password

### Automated Testing

```bash
# Backend integration tests
cd backend
php vendor/bin/phpunit tests/integration/PasswordResetTest.php

# Frontend tests
cd frontend
npm test password-reset

# E2E tests
cd frontend
npx playwright test specs/password-reset.spec.ts
```

### API Testing (cURL)

**Request password reset:**
```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Reset password with token:**
```bash
curl -X POST http://localhost:8080/api/auth/reset-password/TOKEN_HERE \
  -H "Content-Type: application/json" \
  -d '{"password": "NewPass123", "password_confirmation": "NewPass123"}'
```

## Expected Behavior

### Happy Path
1. User sees "Forgot Password?" link on login page
2. User enters email → receives generic success message (even if email doesn't exist)
3. Valid account receives email with secure link within 5 minutes
4. Clicking link opens reset form (valid for 24 hours)
5. User enters matching passwords → success message
6. Old password no longer works; new password works

### Security Behaviors
- Same response whether email exists or not (prevents enumeration)
- Previous reset tokens invalidated when new one requested
- Token can only be used once
- Rate limiting prevents abuse (3 per email/hour, 10 per IP/hour)
- All tokens for user invalidated after successful reset

### Error Cases
- **Invalid email format**: Validation error on form
- **Expired token**: Error message with link to request new reset
- **Used token**: Error message indicating token already consumed
- **Rate limited**: 429 response with retry-after guidance
- **Password mismatch**: Inline validation error

## Common Issues

### Email not received
- Check spam/junk folders
- Verify SMTP configuration in `.env`
- Check application logs for send errors
- Ensure `email.protocol` is set correctly

### Token rejected as invalid
- Token expires after 24 hours (configurable)
- Token is single-use (check if already used)
- URL encoding may affect token; ensure token is properly URL-decoded

### Rate limiting too aggressive
- Adjust `RESET_RATE_LIMIT_PER_EMAIL` and `RESET_RATE_LIMIT_PER_IP` in `.env`
- Restart development server after changing env vars

## Files Modified

### Backend
- `app/Config/Routes.php` - New auth endpoints
- `app/Controllers/AuthController.php` - Reset methods
- `app/Models/PasswordResetTokenModel.php` - Token CRUD
- `app/Services/PasswordResetService.php` - Business logic
- `app/Database/Migrations/2026-04-27-CreatePasswordResetTokensTable.php` - Schema

### Frontend
- `src/pages/LoginPage.tsx` - Added forgot password link
- `src/pages/ForgotPasswordPage.tsx` - Request form page
- `src/pages/ResetPasswordPage.tsx` - New password page
- `src/components/auth/ForgotPasswordForm.tsx` - Form component
- `src/components/auth/ResetPasswordForm.tsx` - Form component
- `src/hooks/usePasswordReset.ts` - Custom hook
- `src/api/auth.ts` - API methods

## Debugging

### Check for pending tokens
```sql
SELECT email, created_at, expires_at, used_at 
FROM password_reset_tokens 
WHERE email = 'user@example.com' 
ORDER BY created_at DESC;
```

### View application logs
```bash
tail -f backend/writable/logs/log-2026-04-27.log
```

### Test email sending
```bash
cd backend
php spark test:email user@example.com
```

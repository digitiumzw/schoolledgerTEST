# API Contract: Password Reset Endpoints

**Feature**: Reset Password  
**Base Path**: `/api/auth`  
**Date**: 2026-04-27

## Endpoints

### POST /api/auth/forgot-password

Initiates a password reset request. Returns generic success message regardless of whether email exists (enumeration protection).

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Success Response (200)**:
```json
{
  "status": "success",
  "data": null,
  "message": "If an account exists with this email, you will receive password reset instructions."
}
```

**Rate Limited Response (429)**:
```json
{
  "status": "error",
  "message": "Too many requests. Please try again later.",
  "errors": {}
}
```

**Validation Error Response (422)**:
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "email": "Invalid email format"
  }
}
```

**Security**:
- Rate limited: 3 requests per email per hour, 10 per IP per hour
- No indication whether email exists in system
- Token generation happens asynchronously (or appears to) to prevent timing attacks

---

### POST /api/auth/reset-password/{token}

Completes password reset using valid token.

**URL Parameters**:
- `token` (string, required): The plain reset token from email link

**Request**:
```json
{
  "password": "NewSecurePassword123",
  "password_confirmation": "NewSecurePassword123"
}
```

**Success Response (200)**:
```json
{
  "status": "success",
  "data": null,
  "message": "Your password has been reset successfully. You can now log in with your new password."
}
```

**Invalid Token Response (400)**:
```json
{
  "status": "error",
  "message": "Invalid or expired reset token. Please request a new password reset.",
  "errors": {}
}
```

**Validation Error Response (422)**:
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "password": "Password must be at least 8 characters and contain uppercase, lowercase, and number"
  }
}
```

**Password Mismatch Response (422)**:
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "password_confirmation": "Passwords do not match"
  }
}
```

**Security**:
- Token validated against hashed storage
- Expired tokens rejected
- Used tokens rejected
- Password hashed with `password_hash()` (PASSWORD_BCRYPT)
- All other tokens for user invalidated on success

---

## Authentication

| Endpoint | Authentication Required | Notes |
|----------|------------------------|-------|
| POST /api/auth/forgot-password | No | Public endpoint, rate limited |
| POST /api/auth/reset-password/{token} | No | Public endpoint, token-based auth |

---

## Frontend Integration

### TypeScript Types

```typescript
// Request types
interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  password: string;
  password_confirmation: string;
}

// Response types (consistent envelope)
interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  errors?: Record<string, string>;
}

type ForgotPasswordResponse = ApiResponse<null>;
type ResetPasswordResponse = ApiResponse<null>;
```

### React Query Hooks

```typescript
// hooks/usePasswordReset.ts
export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: ForgotPasswordRequest) => 
      api.post('/auth/forgot-password', data),
  });
}

export function useResetPassword(token: string) {
  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => 
      api.post(`/auth/reset-password/${token}`, data),
  });
}
```

### Zod Validation Schemas

```typescript
// validation/auth.ts
export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  password_confirmation: z.string(),
}).refine((data) => data.password === data.password_confirmation, {
  message: "Passwords don't match",
  path: ['password_confirmation'],
});
```

---

## Error Handling Consistency

All error responses follow the envelope format defined in Constitution Principle VI:

```json
{
  "status": "error",
  "message": "User-friendly error message",
  "errors": {
    "fieldName": "Field-specific error message"
  }
}
```

Internal error details (stack traces, SQL errors) are logged server-side but NEVER exposed in API responses (Principle IX).

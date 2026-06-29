# Research: Password Reset Implementation

**Feature**: Reset Password  
**Date**: 2026-04-27

## Decisions

### 1. Token Generation Strategy

**Decision**: Use PHP's `random_bytes(32)` (256 bits) encoded as URL-safe base64, stored hashed with SHA-256 in database.

**Rationale**:
- `random_bytes()` provides cryptographically secure randomness
- 256 bits provides ~2^256 possible combinations (infeasible to guess)
- Storing hashed tokens prevents token theft if database is compromised
- URL-safe base64 ensures tokens work in email links without encoding issues

**Alternatives considered**:
- UUID v4: Lower entropy (122 bits), not cryptographically secure by default
- Custom alphanumeric: Implementation risk, may have subtle biases

### 2. Token Expiration

**Decision**: 24 hours default, configurable via environment variable `RESET_TOKEN_TTL_HOURS`.

**Rationale**:
- 24 hours balances security (limits exposure window) with usability (gives users time to check email)
- Industry standard (OWASP, NIST guidelines)
- Configurable for different security requirements

### 3. Rate Limiting Approach

**Decision**: Implement rate limiting at application layer using CodeIgniter's built-in throttle mechanism.

**Limits**:
- 3 requests per email per hour
- 10 requests per IP per hour
- Returns 429 Too Many Requests with Retry-After header

**Rationale**:
- Email-based limit prevents targeted harassment of specific users
- IP-based limit prevents distributed abuse
- Built-in throttle integrates with existing infrastructure

### 4. Password Reset Email Template

**Decision**: Simple HTML email with plain text fallback, containing:
- Clear subject: "Reset your SchoolLedger password"
- Single prominent CTA button with reset link
- Expiration notice ("This link expires in 24 hours")
- Security note ("If you didn't request this, ignore this email")

**Rationale**:
- HTML ensures good rendering across email clients
- Plain text fallback for accessibility and spam filter friendliness
- Single CTA reduces confusion
- Security note helps users recognize phishing attempts

### 5. Password Complexity Requirements

**Decision**: Align with existing organizational policy (assumed: minimum 8 characters, at least one uppercase, one lowercase, one number).

**Implementation**: Use Zod schema validation on frontend, server-side validation in PHP controller.

**Rationale**:
- Consistent with other password inputs in application
- Defense in depth (client + server validation)

### 6. Database Schema for Tokens

**Decision**: Separate table `password_reset_tokens` with:
- `id` (primary key)
- `email` (indexed for lookup)
- `token_hash` (indexed for validation)
- `expires_at` (indexed for cleanup)
- `created_at`
- `used_at` (nullable, marks token as consumed)

**Rationale**:
- Normalized design separates token lifecycle from user table
- Indexes support efficient lookups and cleanup queries
- `used_at` allows detection of token reuse attempts (security audit)

### 7. Frontend State Management

**Decision**: Use React Hook Form + Zod for form validation, React Query for server state.

**Rationale**:
- Follows existing project conventions per constitution
- React Query provides caching, loading states, error handling out of box
- Zod enables type-safe validation shared between frontend logic and API contracts

## Open Questions Resolved

None - all technical aspects have clear decisions aligned with project constitution and industry best practices.

## References

- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- NIST Digital Identity Guidelines (SP 800-63B)
- CodeIgniter 4 Documentation: https://codeigniter4.github.io/userguide/

# Data Model: Password Reset

**Feature**: Reset Password  
**Date**: 2026-04-27

## Entities

### PasswordResetToken

Represents a single-use, time-limited token for authorizing password reset operations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | Internal identifier |
| email | VARCHAR(255) | NOT NULL, INDEX | User's registered email address |
| token_hash | VARCHAR(64) | NOT NULL, INDEX | SHA-256 hash of the plain token |
| expires_at | DATETIME | NOT NULL, INDEX | Token expiration timestamp (UTC) |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation time |
| used_at | DATETIME | NULLABLE | When token was consumed (null = unused) |

**Indexes**:
- `idx_email` on `email` (for rate limiting queries and user lookup)
- `idx_token_hash` on `token_hash` (for token validation)
- `idx_expires_at` on `expires_at` (for cleanup jobs)

**Validation Rules**:
- Email must be valid email format
- Token hash must be exactly 64 characters (SHA-256 hex)
- Expires_at must be in the future at creation time

**State Transitions**:
```
[created] ──(token used)──► [consumed] (used_at set)
[created] ──(time passes)──► [expired] (if expires_at < now() and used_at is null)
```

**Lifecycle**:
- New tokens invalidate all existing unused tokens for the same email
- Used tokens cannot be reused (idempotent consumption check)
- Expired tokens are cleaned up by scheduled job (or left for audit, depending on policy)

## Relationships

```
PasswordResetToken ──references──► User (via email, not FK)
```

Note: No foreign key constraint to `users` table. Email is used as the lookup key because:
1. Users may request reset before account verification
2. Tokens may exist for emails not yet in system (enumeration protection requires same behavior)
3. Simpler cleanup - no cascade deletion concerns

## Database Migration

```php
<?php
namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePasswordResetTokensTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type' => 'INT',
                'constraint' => 11,
                'unsigned' => true,
                'auto_increment' => true,
            ],
            'email' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => false,
            ],
            'token_hash' => [
                'type' => 'VARCHAR',
                'constraint' => 64,
                'null' => false,
            ],
            'expires_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'used_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        
        $this->forge->addKey('id', true);
        $this->forge->addKey('email', false, false, 'idx_email');
        $this->forge->addKey('token_hash', false, false, 'idx_token_hash');
        $this->forge->addKey('expires_at', false, false, 'idx_expires_at');
        
        $this->forge->createTable('password_reset_tokens');
    }

    public function down()
    {
        $this->forge->dropTable('password_reset_tokens');
    }
}
```

## Data Flow

### Creating a Token
1. User submits email on forgot-password form
2. System generates cryptographically secure random token (256 bits)
3. System hashes token with SHA-256
4. System invalidates all existing unused tokens for this email
5. System stores new token_hash with email, expires_at, created_at
6. System sends email containing the plain (unhashed) token in URL

### Validating a Token
1. User clicks reset link containing plain token
2. System hashes received token
3. System queries for matching token_hash where expires_at > now() AND used_at IS NULL
4. If found, token is valid; otherwise reject

### Consuming a Token
1. User submits new password with token in URL
2. System validates token (see above)
3. System updates user's password hash
4. System sets used_at = now() on token
5. System invalidates all other unused tokens for this user

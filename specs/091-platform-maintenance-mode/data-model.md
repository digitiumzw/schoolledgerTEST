# Data Model: Platform Maintenance Mode

**Feature Branch**: `091-platform-maintenance-mode`
**Date**: 2026-06-22

## Entities

### Platform Maintenance Setting

The maintenance mode feature uses the existing `platform_settings` table — a flexible key-value store with the following structure:

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | Primary key |
| `key` | VARCHAR(255) UNIQUE | Setting key name |
| `value` | JSON | Setting value (JSON-encoded) |
| `type` | ENUM('string','number','boolean','json') | Value type for casting |
| `description` | TEXT | Human-readable description |
| `created_at` | DATETIME | Record creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

### New Setting Keys

Three new keys are seeded into `platform_settings`:

| Key | Type | Default Value | Description |
|-----|------|---------------|-------------|
| `maintenance_mode` | `boolean` | `false` | Whether maintenance mode is enabled |
| `maintenance_headline` | `string` | `"Platform Under Maintenance"` | Custom headline for the maintenance notice |
| `maintenance_message` | `string` | `"The platform is currently under maintenance. Service will be restored shortly."` | Custom message body for the maintenance notice |

### Relationships

- **No new tables or relationships.** The maintenance settings are standalone key-value rows in `platform_settings`.
- The `PlatformSetting` model (`App\Models\PlatformSetting`) provides `get(string $key)`, `setSetting(string $key, mixed $value, string $type, string $description)`, and `getAll()` methods with an in-process static cache.

### Validation Rules

- `maintenance_mode` value MUST be a boolean (`true` or `false`).
- `maintenance_headline` and `maintenance_message` MUST be strings. Empty strings are allowed and fall back to defaults at read time.
- Setting updates require platform admin auth (Owner or Admin role) via `canManageSettings()` policy check.

### State Transitions

```
maintenance_mode: false ──[admin toggles on]──> true
maintenance_mode: true  ──[admin toggles off]──> false
```

- When `maintenance_mode` transitions to `true`: all non-admin tenant API calls return 503; tenant frontend shows maintenance notice.
- When `maintenance_mode` transitions to `false`: all tenant API calls resume normally; tenant frontend shows normal app UI.
- `maintenance_headline` and `maintenance_message` can be updated independently of the toggle state.

### Audit Logging

Each change to maintenance settings is logged via `AuditService::logFromRequest()`:

| Action | Target Type | Details |
|--------|-------------|---------|
| `platform.settings.update` (with maintenance keys) | `null` | `['maintenance_mode', ...]` (keys changed) |

The existing `SettingsController::update()` method already logs `platform.settings.update` with `array_keys($body)` as details. No new audit action type is needed — the audit log entry captures which keys were modified.

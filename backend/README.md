# SchoolLedger Backend API

A production-ready CodeIgniter 4 backend for the SchoolLedger school management system.

## Features

- **JWT Authentication** - Secure token-based authentication
- **Multi-tenant Support** - Multiple schools on one platform
- **Full CRUD Operations** - Students, Staff, Classes, Payments, etc.
- **Financial Ledger** - Charges, payments, and balance tracking
- **Attendance Management** - Student and staff attendance
- **Transport Management** - Routes and assignments
- **Subscription Plans** - SaaS pricing tiers
- **Audit Logging** - Activity tracking

## Requirements

- PHP 8.1 or higher
- MySQL 5.7+ or MariaDB 10.3+
- Composer
- PHP Extensions: intl, mbstring, json, mysqlnd

## Quick Start

### 1. Install Dependencies
```bash
cd backend
composer install
```

### 2. Configure Environment
```bash
cp env .env
```

Edit `.env` and update these settings:
```env
CI_ENVIRONMENT = development

# Database
database.default.hostname = localhost
database.default.database = schoolledger
database.default.username = your_username
database.default.password = your_password
database.default.DBDriver = MySQLi

# JWT (change in production!)
JWT_SECRET_KEY = your_secure_secret_key_here
```

### 3. Create Database
```sql
CREATE DATABASE schoolledger CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Run Migrations
```bash
php spark migrate
```

### 5. Seed Sample Data
```bash
php spark db:seed SampleDataSeeder
```

### 6. Start Development Server
```bash
php spark serve
```

The API will be available at `http://localhost:8080`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login and get JWT token |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Get current user |

### Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students` | List all students |
| GET | `/api/students/:id` | Get student by ID |
| POST | `/api/students` | Create student |
| PUT | `/api/students/:id` | Update student |
| DELETE | `/api/students/:id` | Delete student |

### Classes, Staff, Payments, etc.
See `app/Config/Routes.php` for complete endpoint list.

## Default Login Credentials

After seeding:
- **Admin**: admin@greenwood.co.zw / 1234
- **Teacher**: teacher@greenwood.co.zw / 1234
- **Bursar**: accounts@greenwood.co.zw / 1234

## Frontend Integration

Update your frontend's API base URL to point to this backend:

```typescript
// In frontend/src/api/config.ts or similar
const API_BASE_URL = 'http://localhost:8080/api';
```

## Production Deployment

1. Set `CI_ENVIRONMENT = production` in `.env`
2. Use strong `JWT_SECRET_KEY`
3. Hash all passwords with `password_hash()`
4. Configure proper CORS origins in `app/Filters/CorsFilter.php`
5. Set up HTTPS

## Scheduled Commands (Cron)

### Automatic Staff Attendance Cutoff

Automatically marks staff as ABSENT after a configurable cutoff time.

**Setup:**
1. Enable the feature in the admin panel: Settings → General → Automatic Attendance Cutoff
2. Set the desired cutoff time (e.g., `09:30`)
3. Add a cron job to run the command periodically:

```cron
# Run every 15 minutes, between 9 AM and 5 PM, weekdays only
*/15 9-17 * * 1-5 cd /path/to/schoolledger/backend && php spark attendance:cutoff >> /var/log/schoolledger/attendance-cutoff.log 2>&1
```

**Command options:**
```bash
php spark attendance:cutoff              # Process all enabled tenants
php spark attendance:cutoff --dry-run    # Preview without making changes
php spark attendance:cutoff --tenant <id>  # Process a single tenant
```

**Logging:**
All runs are logged to CodeIgniter's application log (`writable/logs/`) and output to stdout/stderr.
To capture output, redirect stdout in your cron job as shown above.

**Processing rules:**
- Skips weekends and configured holidays
- Only marks absences when at least one staff member has already checked in (prevents mass-absence before workday starts)
- Idempotent: running multiple times on the same day is safe
- Staff with ON_LEAVE or EXCUSED status are excluded
- Automated records have `source = 'system'` for audit trail

## Project Structure

```
backend/
├── app/
│   ├── Config/          # Configuration files
│   ├── Controllers/Api/ # API controllers
│   ├── Database/
│   │   ├── Migrations/  # Database migrations
│   │   └── Seeds/       # Data seeders
│   ├── Filters/         # CORS & JWT filters
│   ├── Libraries/       # JWT handler
│   └── Models/          # Database models
├── public/              # Web root
└── .env                 # Environment config
```

## Important Change with index.php

`index.php` is no longer in the root of the project! It has been moved inside the *public* folder,
for better security and separation of components.

This means that you should configure your web server to "point" to your project's *public* folder, and
not to the project root. A better practice would be to configure a virtual host to point there. A poor practice would be to point your web server to the project root and expect to enter *public/...*, as the rest of your logic and the
framework are exposed.

**Please** read the user guide for a better explanation of how CI4 works!

## Repository Management

We use GitHub issues, in our main repository, to track **BUGS** and to track approved **DEVELOPMENT** work packages.
We use our [forum](http://forum.codeigniter.com) to provide SUPPORT and to discuss
FEATURE REQUESTS.

This repository is a "distribution" one, built by our release preparation script.
Problems with it can be raised on our forum, or as issues in the main repository.

## Server Requirements

PHP version 8.1 or higher is required, with the following extensions installed:

- [intl](http://php.net/manual/en/intl.requirements.php)
- [mbstring](http://php.net/manual/en/mbstring.installation.php)

> [!WARNING]
> - The end of life date for PHP 7.4 was November 28, 2022.
> - The end of life date for PHP 8.0 was November 26, 2023.
> - If you are still using PHP 7.4 or 8.0, you should upgrade immediately.
> - The end of life date for PHP 8.1 will be December 31, 2025.

Additionally, make sure that the following extensions are enabled in your PHP:

- json (enabled by default - don't turn it off)
- [mysqlnd](http://php.net/manual/en/mysqlnd.install.php) if you plan to use MySQL
- [libcurl](http://php.net/manual/en/curl.requirements.php) if you plan to use the HTTP\CURLRequest library

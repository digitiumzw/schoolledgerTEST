# SchoolLedger Production Docker Deployment

## Architecture

```
                    ┌─────────────────────┐
                    │   Nginx Reverse     │
                    │   Proxy (:80)       │
                    └──────┬──────┬───────┘
                           │      │
              ┌────────────┘      └────────────┐
              │            ┌────────┐          │
              ▼            ▼        ▼          ▼
         /api/ →     /app/ →     / →
         Backend     Frontend    Landing
         (PHP-FPM)   (Nginx)     (Nginx)
              │
              ▼
         MySQL 8.0
```

- **`/`** — Landing page (static HTML)
- **`/app/`** — Frontend SPA (React/Vite, served at `/app/`)
- **`/api/`** — Backend API (CodeIgniter 4 PHP-FPM)

## Prerequisites

- Docker Engine 24+
- Docker Compose v2+

## Quick Start

1. **Copy and edit the environment file:**
   ```bash
   cp .env.docker.example .env.docker
   ```
   Edit `.env.docker` and fill in all production values (passwords, JWT secrets, SMTP, domain, etc.).

2. **Generate secure secrets:**
   ```bash
   # JWT secret
   openssl rand -hex 32

   # Encryption key (run in PHP container after build, or locally)
   php -r "echo 'hex2bin:' . bin2hex(random_bytes(32));"
   ```

3. **Build and start all services:**
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
   ```

4. **Check service status:**
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

5. **View logs:**
   ```bash
   docker compose -f docker-compose.prod.yml logs -f
   ```

## Services

| Service         | Container     | Port | Description                          |
|-----------------|---------------|------|--------------------------------------|
| nginx-proxy     | nginx-proxy   | 80   | Reverse proxy (single entry point)   |
| backend         | backend       | 80   | CodeIgniter 4 (PHP-FPM + Nginx)      |
| frontend        | frontend      | 80   | React SPA (Vite build + Nginx)       |
| landing         | landing       | 80   | Static landing page (Nginx)          |
| db              | db            | 3306 | MySQL 8.0                            |

## Database Migrations

Migrations run automatically on backend container start when `RUN_MIGRATIONS=1` (default).

To run migrations manually:
```bash
docker compose -f docker-compose.prod.yml exec backend php spark migrate --all
```

To seed the database (first deployment only):
```bash
docker compose -f docker-compose.prod.yml exec backend php spark db:seed InitialSeeder
```

## SSL / HTTPS

For production with HTTPS, use a reverse proxy like Caddy, Traefik, or Nginx with Certbot in front of this stack. Alternatively, add an SSL section to the nginx-proxy config.

### Option: Caddy (automatic HTTPS)

Add this to your `docker-compose.prod.yml`:
```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - caddy_data:/data
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    networks:
      - schoolledger
```

With a `Caddyfile`:
```
yourdomain.com {
    reverse_proxy nginx-proxy:80
}
```

Then remove the `ports` mapping from `nginx-proxy`.

## Cron Jobs (Staff Attendance Cutoff)

The attendance cutoff command should run via cron. Add to your host crontab:
```cron
*/15 9-17 * * 1-5 docker compose -f /path/to/docker-compose.prod.yml exec backend php spark attendance:cutoff >> /var/log/schoolledger/attendance.log 2>&1
```

## Volumes

| Volume               | Description                          |
|----------------------|--------------------------------------|
| `db_data`            | MySQL data directory                 |
| `backend_writable`   | Backend writable (logs, cache, etc.) |

## Backup

```bash
# Database backup
docker compose -f docker-compose.prod.yml exec db mysqldump -u root -p${MYSQL_ROOT_PASSWORD} ${MYSQL_DATABASE} > backup.sql

# Restore
docker compose -f docker-compose.prod.yml exec -T db mysql -u root -p${MYSQL_ROOT_PASSWORD} ${MYSQL_DATABASE} < backup.sql
```

## Rebuilding After Code Changes

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
```

## Stopping

```bash
docker compose -f docker-compose.prod.yml down
```

To remove volumes (⚠️ deletes database):
```bash
docker compose -f docker-compose.prod.yml down -v
```

## Environment Variables

See `.env.docker.example` for all configurable variables. Key ones:

| Variable                | Description                              |
|-------------------------|------------------------------------------|
| `DOMAIN`                | Your production domain                   |
| `MYSQL_ROOT_PASSWORD`   | MySQL root password                      |
| `MYSQL_PASSWORD`        | MySQL app user password                  |
| `JWT_SECRET_KEY`        | JWT signing secret                       |
| `JWT_PLATFORM_SECRET_KEY` | Platform JWT signing secret            |
| `ENCRYPTION_KEY`        | CI4 encryption key (hex2bin:...)         |
| `VITE_API_BASE_URL`     | API URL for frontend (default: `/api`)   |
| `RUN_MIGRATIONS`        | Auto-run migrations on start (1/0)       |
| `email.SMTPHost`        | SMTP server for emails                   |
| `PAYNOW_INTEGRATION_KEY` | Paynow payment gateway key              |

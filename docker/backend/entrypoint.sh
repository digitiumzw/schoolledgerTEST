#!/bin/sh
set -e

echo "[SchoolLedger] Starting backend container..."

# Ensure writable directories exist and are owned by www-data
mkdir -p /var/www/html/writable/logs \
         /var/www/html/writable/cache \
         /var/www/html/writable/session \
         /var/www/html/writable/uploads \
         /var/www/html/writable/invoices \
         /var/www/html/writable/debugbar

chown -R www-data:www-data /var/www/html/writable

# Run migrations if DB is available
if [ "$RUN_MIGRATIONS" = "1" ]; then
    echo "[SchoolLedger] Running database migrations..."
    cd /var/www/html
    php spark migrate --all || echo "[SchoolLedger] Migration warning — database may not be ready yet."
fi

# Start PHP-FPM in background
echo "[SchoolLedger] Starting PHP-FPM..."
php-fpm --daemonize

# Start nginx in foreground
echo "[SchoolLedger] Starting nginx..."
exec nginx -g 'daemon off;'

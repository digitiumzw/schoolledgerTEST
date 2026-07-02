FROM php:8.2-fpm-alpine

# Install system dependencies for PHP extensions
RUN apk add --no-cache \
    nginx \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    oniguruma-dev \
    icu-dev

# Install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    mysqli \
    pdo \
    pdo_mysql \
    mbstring \
    gd \
    zip \
    intl \
    opcache

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy composer files first for better caching
COPY backend/composer.json backend/composer.lock* ./

# Install dependencies (no dev in production)
RUN composer install --no-dev --optimize-autoloader --no-interaction || \
    composer install --no-dev --no-scripts --no-interaction

# Copy application code
COPY backend/ .

# Copy nginx and PHP configs
COPY docker/backend/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/backend/php.ini /usr/local/etc/php/conf.d/production.ini

# Copy entrypoint
COPY docker/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Ensure writable directories exist with correct permissions
RUN mkdir -p writable/logs writable/cache writable/session writable/uploads writable/invoices writable/debugbar \
    && chown -R www-data:www-data writable \
    && chmod -R 775 writable

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]

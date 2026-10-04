# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# base: PHP 8.2 FPM con las extensiones que necesitan Laravel,
# maatwebsite/excel (PhpSpreadsheet) y barryvdh/laravel-dompdf.
# ---------------------------------------------------------------------------
FROM php:8.2-fpm-bookworm AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
        libicu-dev libxml2-dev default-mysql-client \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql zip gd intl bcmath opcache exif \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-app.ini

ENV PHP_OPCACHE_VALIDATE_TIMESTAMPS=1
WORKDIR /var/www/html

# ---------------------------------------------------------------------------
# dev: el código se monta como volumen (docker-compose.dev.yml)
# ---------------------------------------------------------------------------
FROM base AS dev
COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint
ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

# ---------------------------------------------------------------------------
# prod: código y dependencias horneados en la imagen
# ---------------------------------------------------------------------------
FROM base AS prod
ENV PHP_OPCACHE_VALIDATE_TIMESTAMPS=0

COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY backend/ ./
RUN composer dump-autoload --optimize --no-dev \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

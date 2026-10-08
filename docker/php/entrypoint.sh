#!/bin/sh
set -e

cd /var/www/html

if [ -z "$APP_KEY" ] && [ "$1" = "php-fpm" ]; then
  echo "ERROR: APP_KEY está vacío. Genera uno con:" >&2
  echo '  echo "base64:$(openssl rand -base64 32)"' >&2
  exit 1
fi

# Modo desarrollo (código montado como volumen): instala dependencias si faltan.
if [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction --prefer-dist
fi

# Espera a que MySQL acepte conexiones antes de tocar la BD.
if [ -n "$DB_HOST" ]; then
  echo "Esperando a MySQL en $DB_HOST:${DB_PORT:-3306}..."
  i=0
  until mysqladmin ping -h"$DB_HOST" -P"${DB_PORT:-3306}" -u"$DB_USERNAME" -p"$DB_PASSWORD" --silent 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
      echo "MySQL no respondió tras 120 s" >&2
      exit 1
    fi
    sleep 2
  done
fi

# storage/app/private guarda los adjuntos. Se crea aquí (y se entrega a www-data) para que un
# "docker compose exec app php artisan ..." ejecutado como root no la cree antes con dueño root.
mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force
fi

if [ "$APP_ENV" = "production" ]; then
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
else
  php artisan optimize:clear >/dev/null || true
fi

exec "$@"

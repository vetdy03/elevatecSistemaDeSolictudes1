# FinControl — Sistema de Solicitudes de Recursos

Aplicación para gestionar lotes de solicitudes financieras:

- **Secretaría** carga los lotes (Excel/CSV o filas manuales).
- **Admin** aprueba o rechaza cada solicitud y finaliza el lote.
- **Colaborador** consulta el avance en modo lectura.

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS (diseño de Magic Patterns) |
| Backend | Laravel 12 (PHP 8.2) · Sanctum (sesión SPA) · maatwebsite/excel · barryvdh/laravel-dompdf |
| Base de datos | MySQL 8.0 |
| Infraestructura | Docker Compose: `web` (Nginx) · `app` (PHP-FPM) · `db` (MySQL) |

```
.
├── backend/                 Laravel (API REST en /api)
│   ├── app/Http/Controllers/Api/   Auth, Batch, Request, Excel, Pdf, Notification
│   ├── app/Imports/ app/Exports/   Lectura y generación de Excel
│   ├── database/migrations/        users, batches, requests, notifications…
│   ├── database/seeders/           Datos iniciales (usuarios + lotes del diseño)
│   └── resources/views/pdf/        Plantilla del reporte PDF
├── frontend/                React + Vite
│   └── src/ api/ hooks/ components/ pages/ lib/ types.ts
├── docker/
│   ├── php/                 Dockerfile PHP 8.2-FPM + entrypoint
│   └── nginx/               Dockerfile (compila el frontend) + default.conf
├── docker-compose.yml       Producción (Synology)
├── docker-compose.dev.yml   Desarrollo local
└── .env.example             Configuración (copiar a .env)
```

Nginx sirve el frontend compilado y deriva `/api`, `/sanctum` y `/up` a Laravel. El navegador ve **un solo origen**, por eso no hace falta configurar CORS y la sesión viaja en una cookie (no hay tokens en `localStorage`).

---

## 1. Puesta en marcha (cualquier equipo con Docker)

```bash
cp .env.example .env
```

Edita `.env`:

| Variable | Qué poner |
|----------|-----------|
| `APP_KEY` | Resultado de `echo "base64:$(openssl rand -base64 32)"` |
| `APP_URL` | URL con la que se abrirá la app, p. ej. `http://192.168.1.50:8080` |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | Contraseñas seguras |
| `SEED_USER_PASSWORD` | Contraseña de los usuarios iniciales |
| `APP_PORT` | Puerto publicado (por defecto `8080`) |

Levanta los contenedores:

```bash
docker compose up -d --build
```

En el primer arranque se construyen las imágenes (compila el frontend e instala Composer) y el contenedor `app` ejecuta las **migraciones** automáticamente (`RUN_MIGRATIONS=true`).

Carga los **datos iniciales**, solo la primera vez:

```bash
docker compose exec app php artisan db:seed --force
```

Abre `http://localhost:8080` (o tu `APP_URL`).

### Usuarios iniciales

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Admin | `admin@fincontrol.local` | valor de `SEED_USER_PASSWORD` (por defecto `FinControl2026!`) |
| Secretaría | `secretaria@fincontrol.local` | ídem |
| Colaborador | `colaborador@fincontrol.local` | ídem |

> ⚠️ Cambia `SEED_USER_PASSWORD` antes de sembrar en producción.
>
> ⚠️ **No ejecutes `db:seed` otra vez sobre datos reales.** Vuelve a dejar los lotes de ejemplo (04-JUL a 08-SEP) en su estado inicial y se pierden las decisiones tomadas en ellos.

### Comandos útiles

```bash
docker compose ps                                   # estado de los servicios
docker compose logs -f app                          # logs de Laravel / PHP
docker compose exec app php artisan migrate --force # migraciones manuales
docker compose exec app php artisan migrate:fresh --seed --force  # ⚠ BORRA todo y vuelve a sembrar
docker compose exec app php artisan tinker          # consola de Laravel
docker compose down                                 # detener (los datos quedan en ./data)
```

Para crear un usuario nuevo:

```bash
docker compose exec app php artisan tinker --execute="App\Models\User::create(['name'=>'Nombre Apellido','email'=>'correo@empresa.com','password'=>'ClaveSegura123','role'=>'secretaria']);"
```

Roles válidos: `admin`, `secretaria`, `colaborador`.

---

## 2. Desarrollo local

```bash
# Backend + MySQL (el código de ./backend se monta en vivo, MySQL en un volumen con nombre)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec app php artisan db:seed --force

# Frontend con recarga en caliente
cd frontend
npm install
npm run dev        # http://localhost:5180  (deriva /api y /sanctum a http://localhost:8080)
```

- MySQL queda expuesto en `localhost:3307` para clientes como DBeaver o Workbench.
- Para correr Composer o Artisan: `docker compose exec app composer require …` / `php artisan …`.
- No hace falta tener PHP ni Composer instalados en el equipo.

---

## 3. Despliegue en Synology DS925+ (Container Manager)

El DS925+ es x86_64 (AMD Ryzen), así que las imágenes oficiales de PHP, Nginx, MySQL y Node funcionan sin cambios.

### 3.1 Preparar el NAS

1. **Centro de paquetes** → instala **Container Manager**.
2. Instala también **Git Server**, que añade el comando `git` para SSH.
3. **Panel de control → Terminal y SNMP** → activa **SSH**.
4. En **File Station**, crea la carpeta `docker/fincontrol` dentro de `volume1`.

### 3.2 Clonar y configurar

```bash
ssh usuario@IP-DEL-NAS
cd /volume1/docker
sudo git clone https://github.com/<organizacion>/<repositorio>.git fincontrol
cd fincontrol
sudo cp .env.example .env
echo "base64:$(openssl rand -base64 32)"     # copia el resultado en APP_KEY
sudo vi .env                                 # APP_KEY, APP_URL, contraseñas, DATA_PATH
```

Valores recomendados en el NAS:

```dotenv
APP_URL=http://192.168.1.50:8080            # IP real del NAS
DATA_PATH=/volume1/docker/fincontrol/data   # MySQL y archivos persistentes
```

### 3.3 Crear el proyecto en Container Manager

**Opción A — interfaz gráfica**

1. Abre **Container Manager → Proyecto → Crear**.
2. Completa: **Nombre** `fincontrol`, **Ruta** `/docker/fincontrol`, **Origen** *Usar docker-compose.yml existente*.
3. Pulsa **Siguiente**. Omite la configuración de Web Station y pulsa **Hecho**.

Container Manager construye las imágenes y arranca los 3 contenedores. La primera vez tarda unos minutos.

**Opción B — SSH**

```bash
cd /volume1/docker/fincontrol
sudo docker compose up -d --build
```

En ambos casos, carga los datos iniciales (solo la primera vez):

```bash
sudo docker exec fincontrol-app php artisan db:seed --force
```

Abre `http://IP-DEL-NAS:8080`.

### 3.4 HTTPS con dominio (opcional, recomendado)

1. **Panel de control → Portal de inicio de sesión → Avanzado → Proxy inverso → Crear**.
   - **Origen:** `HTTPS`, `fincontrol.midominio.com`, puerto `443`
   - **Destino:** `HTTP`, `localhost`, puerto `8080`
2. En **Encabezado personalizado** agrega `X-Forwarded-Proto` = `$scheme`.
3. Asigna un certificado en **Panel de control → Seguridad → Certificado** (Let's Encrypt).
4. En `.env`, ajusta:
   ```dotenv
   APP_URL=https://fincontrol.midominio.com
   SESSION_SECURE_COOKIE=true
   ```
5. Aplica el cambio con `sudo docker compose up -d`. Si usas la interfaz gráfica: Proyecto → Acción → Detener / Iniciar.

### 3.5 Actualizar a una nueva versión

```bash
cd /volume1/docker/fincontrol
sudo git pull
sudo docker compose up -d --build     # las migraciones nuevas se ejecutan solas al arrancar
```

### 3.6 Respaldos

- **Base de datos:**
  ```bash
  sudo docker exec fincontrol-db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction fincontrol' > /volume1/docker/fincontrol/backup-$(date +%F).sql
  ```
- **Archivos:** incluye la carpeta `/volume1/docker/fincontrol/data` en una tarea de **Hyper Backup**. Detén el proyecto antes de copiar `data/mysql` en crudo.

---

## 4. API REST

Todas las rutas cuelgan de `/api` y requieren sesión, salvo `POST /login`. El cliente pide antes `GET /sanctum/csrf-cookie` y envía la cabecera `X-XSRF-TOKEN`.

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/login` · `/logout` | — | Iniciar / cerrar sesión |
| GET | `/user` | todos | Usuario autenticado |
| GET | `/batches?status=&q=&from=&to=` | todos | Listado / histórico de lotes |
| GET | `/batches/active` | todos | Lote pendiente más reciente con sus solicitudes |
| GET | `/batches/{id}` | todos | Lote con sus solicitudes |
| POST | `/batches/{id}/finalize` | admin | Finaliza el lote y notifica a Secretaría. Responde 422 si quedan pendientes |
| PATCH | `/requests/{id}/status` | admin | `{ "status": "Aprobado" \| "Rechazado" \| "Pendiente" }` |
| POST | `/requests` | admin, secretaría | Agrega una fila manual a un lote pendiente |
| GET | `/requests/options` | todos | Categorías y regionales usadas (autocompletar) |
| POST | `/excel/preview` | admin, secretaría | Valida un .xlsx/.csv sin guardar nada |
| POST | `/excel/import` | admin, secretaría | Crea un lote nuevo desde el archivo (`file`, `title`) |
| GET | `/excel/template` | admin, secretaría | Plantilla .xlsx |
| GET | `/excel/export?batch_id=&status=&category=&region=` | admin, secretaría | Exporta a Excel |
| GET | `/pdf/export?batch_id=&status=&category=&region=&full=1` | admin, secretaría | Reporte PDF; `full=1` agrega trazabilidad y subtotales |
| GET | `/notifications` · POST `/notifications/read` | todos | Notificaciones in-app (campana) |

En los reportes, `status` acepta `Aprobado`, `Rechazado`, `Pendiente` o `Decididos` (aprobados + rechazados). Sin `batch_id` se usa el lote activo.

### Formato del archivo de carga

La primera fila son los encabezados. No importan mayúsculas ni tildes:

`Fecha | Detalle | Importe | Moneda | N° trámite | Solicitado por | Prioridad | Regional | Categoría`

- **Fecha:** `29/09/2026`, `2026-09-29`, `29 Sep` o fecha de Excel. Si se deja vacía, se usa la fecha de hoy.
- **Importe:** acepta `18400`, `18.400`, `18.400,50` o `18,400.50`.
- **Moneda:** `Bs` (por defecto) o `USD`.
- **Prioridad:** `Alta`, `Media` (por defecto) o `Baja`.
- **Categoría:** puede ir en su columna, o en una fila separadora que solo tenga el nombre de la categoría (como en la tabla de la app).
- **CSV:** se detecta el separador (`,` o `;`) y la codificación (UTF-8 o Windows-1252), así que sirven los CSV que guarda Excel en español.

Si alguna fila tiene errores, la vista previa los lista por número de fila y no deja publicar el lote.

---

## 5. Problemas frecuentes

| Síntoma | Causa / solución |
|---------|------------------|
| El login vuelve a pedir credenciales o da error 419 | Accedes por HTTP con `SESSION_SECURE_COOKIE=true`. Ponlo en `false`, o accede por HTTPS. |
| `APP_KEY está vacío` en los logs de `app` | Falta `APP_KEY` en `.env` (ver sección 1). |
| `Bind for 0.0.0.0:8080 failed` | El puerto está ocupado. Cambia `APP_PORT` en `.env`. |
| 502 Bad Gateway justo después de arrancar | `app` aún espera a MySQL o ejecuta migraciones. Revisa `docker compose logs app`. |
| Cambios del frontend no se ven en el NAS | Reconstruye con `docker compose up -d --build`, porque el frontend se compila dentro de la imagen `web`. |

---

Diseño original: [Magic Patterns](https://www.magicpatterns.com/c/ejastpsf4pj96s29cp7kju)

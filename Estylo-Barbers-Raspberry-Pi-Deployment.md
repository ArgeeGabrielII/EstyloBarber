# Estylo Barbers — Raspberry Pi Full Deployment Guide

This document describes the deployment of the **Estylo Barbers PostgreSQL database, NestJS backend API, React/Vite frontend, and Nginx web server** on a Raspberry Pi 4 from a fresh operating system installation.

The deployment is performed **natively without Docker**.

## 1. Deployment Overview

### Hardware
- Raspberry Pi 4 Model B Rev 1.5
- 32 GB microSD card
- ARM64 / aarch64 architecture

### Operating System
- Debian GNU/Linux 13 (Trixie)
- 64-bit

### Network
- Hostname: `rpi4-001`
- Raspberry Pi uses DHCP.
- The router provides a DHCP reservation for the Raspberry Pi.
- Deployment-time IP address: `192.168.68.130`
- SSH enabled
- Raspberry Pi Connect enabled for remote browser access

The IP address is **not statically configured inside Raspberry Pi OS**. This allows the Raspberry Pi to obtain a different DHCP address if it is moved to another network/router.

### Application Stack
- Node.js 22
- npm 10
- NestJS 11
- Prisma 6
- PostgreSQL 17
- systemd for backend process management

### Deployment Architecture

```text
Raspberry Pi 4
rpi4-001
│
├── Raspberry Pi OS / Debian 13
│
├── PostgreSQL 17
│   └── estylo
│
├── Estylo Backend API
│   ├── Node.js 22
│   ├── NestJS 11
│   ├── Prisma 6
│   ├── Port 3000
│   └── systemd: estylo-api.service
│
└── Nginx :80
    ├── /      → React 19 / Vite 6 frontend
    └── /api/* → NestJS API on 127.0.0.1:3000
```

---

## 2. Fresh Raspberry Pi OS Setup

A fresh 64-bit operating system was installed on the Raspberry Pi.

Detected environment:

```text
Debian GNU/Linux 13 (trixie)
Raspberry Pi 4 Model B Rev 1.5
```

The 32 GB microSD card was detected as approximately 29.7 GB of usable physical capacity. The root filesystem occupied essentially the entire card, so no filesystem expansion or repartitioning was required.

Storage was verified using:

```bash
lsblk
df -h /
```

---

## 3. Operating System Updates

The operating system was updated before installing the application:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt autoremove -y
sudo apt clean
```

During the initial update, several packages were found in an unpacked/unconfigured state. They were repaired using:

```bash
sudo dpkg --configure -a
sudo apt --fix-broken install -y
sudo apt full-upgrade -y
```

Verification:

```bash
apt list --upgradable 2>/dev/null
sudo dpkg --audit
```

Final result:
- Pending updates: none
- Broken packages: none

---

## 4. Basic System Utilities and SSH

Basic administration utilities were installed:

```bash
sudo apt install -y curl wget git vim htop unzip zip ca-certificates
```

SSH was enabled and configured to start automatically:

```bash
sudo systemctl enable --now ssh
```

Verify:

```bash
systemctl is-active ssh
```

Expected result: `active`

Hostname: `rpi4-001`

Deployment-time DHCP-reserved IP: `192.168.68.130`

Where mDNS is available, SSH can use:

```bash
ssh <username>@rpi4-001.local
```

Raspberry Pi Connect was also configured separately for browser-based remote access.

---

## 5. Clone Estylo Repository

```bash
cd /home/rpi4-001
git clone https://github.com/ArgeeGabrielII/EstyloBarber.git
cd EstyloBarber
```

Application directory:

```text
/home/rpi4-001/EstyloBarber
```

The repository uses npm workspaces:
- `apps/api`
- `apps/web`

Backend directory:

```text
/home/rpi4-001/EstyloBarber/apps/api
```

---

## 6. Docker Decision

The repository contains `docker-compose.yml`, but Docker was intentionally **not used** for this Raspberry Pi deployment.

The backend and database are installed directly on Raspberry Pi OS. The Docker Compose configuration was used only as a reference for the application's intended database and environment configuration.

---

## 7. Backend Environment Configuration

Backend environment file:

```text
/home/rpi4-001/EstyloBarber/apps/api/.env
```

Example structure:

```env
DATABASE_URL="postgresql://estylo:<DATABASE_PASSWORD>@localhost:5432/estylo?schema=public"
JWT_SECRET=<JWT_SECRET>
COOKIE_SECURE=false
PORT=3000
TZ=Asia/Manila
SEED_ADMIN_PASSWORD=<ADMIN_PASSWORD>
SEED_CASHIER_PASSWORD=<CASHIER_PASSWORD>
SEED_VIEWER_PASSWORD=<VIEWER_PASSWORD>
```

Because PostgreSQL runs directly on the Raspberry Pi, the database hostname is `localhost`, not the Docker Compose hostname `postgres`.

Protect the environment file:

```bash
chmod 600 /home/rpi4-001/EstyloBarber/apps/api/.env
```

Do not commit `.env` to Git.

---

## 8. PostgreSQL Installation

The project's Docker configuration referenced PostgreSQL 16. Debian 13 Trixie provides PostgreSQL 17 through its standard repositories, so PostgreSQL 17 was used for the native deployment.

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Verify:

```bash
psql --version
systemctl is-active postgresql
pg_lsclusters
```

Installed during deployment:
- PostgreSQL 17.11
- Cluster: `17 main`
- Port: `5432`
- Status: online
- Owner: `postgres`
- Data directory: `/var/lib/postgresql/17/main`
- Log: `/var/log/postgresql/postgresql-17-main.log`

---

## 9. Create Estylo PostgreSQL Database

A fresh PostgreSQL database was created.

- Database: `estylo`
- User: `estylo`
- Host: `localhost`
- Port: `5432`

```bash
sudo -u postgres psql
```

Then:

```sql
CREATE USER estylo WITH PASSWORD '<DATABASE_PASSWORD>';
CREATE DATABASE estylo OWNER estylo;
GRANT ALL PRIVILEGES ON DATABASE estylo TO estylo;
```

Exit with `\q`.

Verify connectivity:

```bash
PGPASSWORD='<DATABASE_PASSWORD>' \
psql -h localhost -U estylo -d estylo \
-c "SELECT current_database(), current_user, version();"
```

The password must match the password contained in `DATABASE_URL`.

---

## 10. Existing Database Backup Was NOT Restored

The repository contains an existing database dump under `backups/`.

This dump was intentionally **not used**. The Raspberry Pi deployment uses a completely fresh database generated from the current Prisma schema. No historical database data was imported.

---

## 11. Install Node.js

Node.js 22 and build prerequisites were installed:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3
```

The build tools are useful for Node dependencies containing native components, including `argon2`.

Verify:

```bash
node --version
npm --version
node -p "process.arch"
```

Versions installed during deployment:
- Node.js `v22.23.3`
- npm `10.9.9`
- Architecture `arm64`

---

## 12. Install Application Dependencies

From the repository root:

```bash
cd /home/rpi4-001/EstyloBarber
npm ci
```

Backend versions observed after installation:
- `@nestjs/core@11.2.5`
- `@prisma/client@6.19.3`
- `prisma@6.19.3`

---

## 13. Generate Prisma Client

```bash
cd /home/rpi4-001/EstyloBarber
npm run db:generate
```

Prisma uses:
- Schema: `apps/api/prisma/schema.prisma`
- Environment: `apps/api/.env`

---

## 14. Verify Prisma Database Connection

```bash
cd /home/rpi4-001/EstyloBarber/apps/api

npx prisma db execute --schema=prisma/schema.prisma --stdin <<'SQL'
SELECT current_database(), current_user;
SQL
```

Successful result:

```text
Script executed successfully.
```

---

## 15. Prisma Schema Deployment

The repository did not contain Prisma migration history under `prisma/migrations`.

Because the database was new and empty, the current Prisma schema was applied directly:

```bash
cd /home/rpi4-001/EstyloBarber/apps/api
npm run prisma:push
```

This created 15 application tables:

- AuditLog
- Barber
- Checkout
- InventoryItem
- InventoryMovement
- ItemTransaction
- ItemTransactionLine
- Seat
- Service
- ServiceInventoryUsage
- ServiceTransaction
- ServiceTransactionLine
- ShopSetting
- TransactionCounter
- User

All tables are owned by PostgreSQL user `estylo`.

---

## 16. Seed Initial Application Data

```bash
cd /home/rpi4-001/EstyloBarber/apps/api
npm run prisma:seed
```

The seed created or updated:
- `duque-admin` — ADMIN
- `cashier` — CASHIER
- `viewer` — VIEWER

Passwords are loaded from the corresponding `SEED_*_PASSWORD` environment variables and are intentionally not documented here.

---

## 17. Build NestJS Backend

```bash
cd /home/rpi4-001/EstyloBarber
npm --workspace apps/api run build
```

Compiled application entry point:

```text
/home/rpi4-001/EstyloBarber/apps/api/dist/main.js
```

---

## 18. Manual Backend Test

Before configuring automatic startup:

```bash
cd /home/rpi4-001/EstyloBarber/apps/api
npm start
```

The API listens on port `3000`.

Health check:

```bash
curl -i http://localhost:3000/api/health
```

Successful response:

```json
{"status":"ok","database":"connected"}
```

This confirmed the full connection:

```text
NestJS → Prisma → PostgreSQL
```

---

## 19. Configure Backend as a systemd Service

Service file:

```text
/etc/systemd/system/estylo-api.service
```

Contents:

```ini
[Unit]
Description=Estylo Barbers Backend API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=rpi4-001
Group=rpi4-001
WorkingDirectory=/home/rpi4-001/EstyloBarber/apps/api
EnvironmentFile=/home/rpi4-001/EstyloBarber/apps/api/.env
ExecStart=/usr/bin/node /home/rpi4-001/EstyloBarber/apps/api/dist/main.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Reload systemd and enable the API:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now estylo-api
```

Verify:

```bash
systemctl is-active estylo-api
systemctl is-enabled estylo-api
```

Expected:
- `active`
- `enabled`

---

## 20. Backend Health Check

```bash
curl -s http://localhost:3000/api/health
```

Expected:

```json
{"status":"ok","database":"connected"}
```

---

## 21. Reboot Verification

The Raspberry Pi was rebooted to confirm that PostgreSQL and the Estylo API recover automatically:

```bash
sudo reboot
```

After reconnecting:

```bash
echo "=== POSTGRESQL ===" && systemctl is-active postgresql && \
echo -e "\n=== ESTYLO API ===" && systemctl is-active estylo-api && \
echo -e "\n=== HEALTH ===" && curl -s http://localhost:3000/api/health && \
echo -e "\n\n=== API AUTO-START ===" && systemctl is-enabled estylo-api && \
echo -e "\n=== UPTIME ===" && uptime
```

Actual successful reboot test:

```text
=== POSTGRESQL ===
active

=== ESTYLO API ===
active

=== HEALTH ===
{"status":"ok","database":"connected"}

=== API AUTO-START ===
enabled
```

This confirms that the backend and database survive a complete Raspberry Pi reboot.

---

## 22. Useful Administration Commands

### Estylo API

```bash
sudo systemctl status estylo-api
sudo systemctl start estylo-api
sudo systemctl stop estylo-api
sudo systemctl restart estylo-api
```

Recent logs:

```bash
journalctl -u estylo-api -n 100 --no-pager
```

Follow logs live:

```bash
journalctl -u estylo-api -f
```

### PostgreSQL

```bash
sudo systemctl status postgresql
```

Connect to the database:

```bash
psql -h localhost -U estylo -d estylo
```

Inside `psql`, list tables with:

```text
\dt
```

Exit with:

```text
\q
```

### API Health

```bash
curl http://localhost:3000/api/health
```

---

## 23. Updating the Backend

For future backend deployments:

```bash
cd /home/rpi4-001/EstyloBarber
git pull
npm ci
npm run db:generate
npm --workspace apps/api run build
sudo systemctl restart estylo-api
```

Verify:

```bash
curl -s http://localhost:3000/api/health
```

If the Prisma schema changes, the database changes must also be applied according to the project's database deployment strategy before restarting the application.

Because the repository currently has no Prisma migration history, `prisma db push` was used for this initial fresh deployment. A proper migration workflow should be introduced for future production schema changes.

---

## 24. Current Deployment Status

| Component | Status |
|---|---|
| Raspberry Pi OS / Debian 13 | Running |
| OS packages | Updated |
| SSH | Enabled |
| Raspberry Pi Connect | Enabled |
| PostgreSQL 17.11 | Active |
| Estylo database | Created |
| Prisma schema | Applied |
| Initial users | Seeded |
| Node.js 22.23.3 | Installed |
| NestJS backend | Built |
| Estylo API | Active |
| API port | 3000 |
| API systemd service | Enabled |
| Automatic startup | Verified |
| Database connectivity | Verified |
| `/api/health` | HTTP 200 / OK |
| Docker | Not used |
| Existing `.dump` backup | Not restored |

## Backend Deployment Result

```text
PostgreSQL
    ↓
estylo database
    ↓
Prisma
    ↓
NestJS API
    ↓
localhost:3000
    ↓
/api/health
    ↓
{"status":"ok","database":"connected"}
```

The **Estylo Barbers backend and database deployment is complete**.
---

## 25. Frontend Stack Inspection

The web application under `apps/web` was inspected before deployment.

Frontend stack:

- React 19
- TypeScript 5
- Vite 6
- React Router 7
- Bootstrap 5
- Chart.js
- Bootstrap Icons

The frontend package scripts include:

```json
{
  "dev": "vite --host 0.0.0.0",
  "build": "tsc -b && vite build",
  "lint": "eslint src --ext ts,tsx"
}
```

The existing Vite development configuration proxies `/api` to the local backend:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
```

The frontend API client uses relative API URLs:

```ts
fetch(`/api${path}`, ...)
```

This is important because the frontend does **not** need the Raspberry Pi IP address hardcoded into the application.

---

## 26. Build the React/Vite Frontend

The production frontend was built from the repository root:

```bash
cd /home/rpi4-001/EstyloBarber
npm --workspace apps/web run build
```

The production build completed successfully.

Deployment-time build output was approximately:

```text
60 modules transformed.
dist/index.html                               0.47 kB
dist/assets/bootstrap-icons-mSm7cUeB.woff2  134.04 kB
dist/assets/bootstrap-icons-BeopsB42.woff   180.29 kB
dist/assets/index-CCMG5OdR.css              319.31 kB
dist/assets/index-HN8N7N6e.js               476.44 kB
```

Total build size was approximately:

```text
1.3M
```

The generated production files are located at:

```text
/home/rpi4-001/EstyloBarber/apps/web/dist
```

Important generated files included:

```text
dist/index.html
dist/assets/
dist/estylo-logo.jpg
dist/manifest.webmanifest
dist/sw.js
```

---

## 27. Install Native Nginx

Nginx was installed directly on Raspberry Pi OS:

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

Verify:

```bash
nginx -v
systemctl is-active nginx
systemctl is-enabled nginx
```

Deployment result:

```text
nginx version: nginx/1.26.3
active
enabled
```

The default Nginx page was successfully reachable from another device using:

```text
http://192.168.68.130
```

This confirmed that port 80 on the Raspberry Pi was reachable over the LAN.

---

## 28. Deploy the Frontend to Nginx

A dedicated directory was created for the Estylo production frontend:

```bash
sudo mkdir -p /var/www/estylo
```

The Vite production build was copied into it:

```bash
sudo cp -a /home/rpi4-001/EstyloBarber/apps/web/dist/. /var/www/estylo/
```

The resulting architecture is:

```text
Browser / Shop Device
        │
        │ HTTP :80
        ▼
      Nginx
       │
       ├── / ───────────────► React/Vite static frontend
       │                      /var/www/estylo
       │
       └── /api/* ──────────► NestJS
                              127.0.0.1:3000
                                   │
                                   ▼
                              PostgreSQL
```

---

## 29. Configure Nginx for React and the API

A dedicated Nginx site was created:

```text
/etc/nginx/sites-available/estylo
```

Configuration:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name _;

    root /var/www/estylo;
    index index.html;

    # NestJS Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React / Vite SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

The site was enabled:

```bash
sudo ln -sf /etc/nginx/sites-available/estylo /etc/nginx/sites-enabled/estylo
```

The default Nginx site was disabled:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

The configuration was tested:

```bash
sudo nginx -t
```

Then Nginx was reloaded:

```bash
sudo systemctl reload nginx
```

---

## 30. Verify Frontend and API Through Nginx

Frontend:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost/
```

Expected:

```text
HTTP 200
```

Direct backend health check:

```bash
curl -i http://127.0.0.1:3000/api/health
```

API health check through Nginx:

```bash
curl -i http://127.0.0.1/api/health
```

Both API paths successfully returned:

```json
{"status":"ok","database":"connected"}
```

This confirmed:

```text
Nginx → NestJS → Prisma → PostgreSQL
```

was working correctly.

---

## 31. LAN HTTP Compatibility Issue: `crypto.randomUUID()`

After deployment, login worked successfully, but navigating to `/cashier` initially caused the browser application to crash with:

```text
Uncaught TypeError: crypto.randomUUID is not a function
```

The frontend contained two browser-side calls to:

```ts
crypto.randomUUID()
```

in:

```text
apps/web/src/pages/CashierPage.tsx
```

The backend also uses Node's `randomUUID()` from the `crypto` module. The backend implementation was not changed because it runs under Node.js and worked correctly.

### Cause

The application was being accessed on the local network using:

```text
http://192.168.68.130
```

Browser Web Crypto functionality such as `crypto.randomUUID()` may require a secure browser context. Plain HTTP on a LAN IP does not receive the same secure-context treatment as HTTPS or localhost.

### Frontend Fix

The two frontend calls were changed from:

```ts
crypto.randomUUID()
```

to a fallback-compatible implementation:

```ts
globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
```

This preserves `crypto.randomUUID()` where supported while allowing the Cashier page to operate when Estylo is accessed over local-network HTTP.

After the change, the frontend was rebuilt:

```bash
cd /home/rpi4-001/EstyloBarber
npm --workspace apps/web run build
```

The previous deployed frontend was replaced:

```bash
sudo rm -rf /var/www/estylo/*
sudo cp -a apps/web/dist/. /var/www/estylo/
sudo systemctl reload nginx
```

Because the application includes a service worker, the browser was hard-refreshed after deployment.

Chrome on macOS:

```text
Cmd + Shift + R
```

After the rebuild and refresh, `/cashier` loaded successfully.

> Note: The fallback above is suitable for the current client-side identifier use in the Cashier UI. Security-sensitive identifiers or cryptographic tokens should continue to be generated using cryptographically secure mechanisms.

---

## 32. Authentication Configuration

The backend authentication system uses an HTTP-only JWT cookie named:

```text
estylo_token
```

Cookie configuration:

```ts
httpOnly: true
sameSite: 'lax'
secure: process.env.COOKIE_SECURE === 'true'
```

For the current local HTTP deployment:

```env
COOKIE_SECURE=false
```

This allows authentication cookies to work when accessing Estylo at:

```text
http://192.168.68.130
```

Login was successfully tested through the deployed frontend.

The Cashier page was also successfully loaded after authentication and the `randomUUID()` compatibility fix.

---

## 33. Current User Access

Devices connected to the same local network can access Estylo using:

```text
http://192.168.68.130
```

Users do not need to access port `3000` directly.

Nginx handles both application surfaces:

```text
http://192.168.68.130/
```

for the React application, and:

```text
http://192.168.68.130/api/*
```

for API requests.

The backend remains on:

```text
127.0.0.1:3000
```

from the web application's perspective.

PostgreSQL remains behind the backend and is not accessed directly by browser clients.

---

## 34. Frontend Deployment After Code Changes

After changing frontend code:

```bash
cd /home/rpi4-001/EstyloBarber

npm --workspace apps/web run build

sudo rm -rf /var/www/estylo/*
sudo cp -a apps/web/dist/. /var/www/estylo/

sudo systemctl reload nginx
```

Then verify:

```bash
curl -s -o /dev/null -w "Frontend HTTP %{http_code}\n" http://localhost/
curl -s http://localhost/api/health
```

Expected:

```text
Frontend HTTP 200
{"status":"ok","database":"connected"}
```

Because Estylo uses a service worker, a hard refresh may be necessary on client browsers after a frontend deployment.

---

## 35. Full Application Update Procedure

For future deployments after pulling code from Git:

```bash
cd /home/rpi4-001/EstyloBarber

git pull
npm ci

npm run db:generate

npm --workspace apps/api run build
npm --workspace apps/web run build

sudo rm -rf /var/www/estylo/*
sudo cp -a apps/web/dist/. /var/www/estylo/

sudo systemctl restart estylo-api
sudo nginx -t
sudo systemctl reload nginx
```

Verify the deployment:

```bash
echo "=== POSTGRESQL ===" && systemctl is-active postgresql && \
echo -e "\n=== API ===" && systemctl is-active estylo-api && \
echo -e "\n=== NGINX ===" && systemctl is-active nginx && \
echo -e "\n=== FRONTEND ===" && \
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost/ && \
echo -e "\n=== API HEALTH ===" && \
curl -s http://localhost/api/health && echo
```

If the Prisma schema changes, apply the appropriate database schema change before restarting the API.

The initial deployment used `prisma db push` because the repository did not contain Prisma migration history. A proper Prisma migration workflow is recommended for future production schema changes.

---

## 36. Final Deployment Architecture

```text
                ESTYLO BARBERS
                      │
           Local Shop Network (LAN)
                      │
                      ▼
          http://192.168.68.130
                      │
                      ▼
                Nginx :80
              /           \
             /             \
            ▼               ▼
       React/Vite        /api/*
       Frontend             │
    /var/www/estylo         ▼
                        NestJS API
                      127.0.0.1:3000
                            │
                            ▼
                          Prisma
                            │
                            ▼
                       PostgreSQL 17
                         estylo DB
```

---

## 37. Final Deployment Status

| Component | Status |
|---|---|
| Raspberry Pi 4 | Running |
| Debian 13 / Trixie 64-bit | Running |
| OS packages | Updated |
| SSH | Enabled |
| Raspberry Pi Connect | Enabled |
| Node.js 22.23.3 | Installed |
| npm 10.9.9 | Installed |
| PostgreSQL 17.11 | Active |
| `estylo` database | Created |
| Prisma 6.19.3 | Working |
| Fresh Prisma schema | Applied |
| Initial users | Seeded |
| NestJS 11 backend | Built |
| Backend port 3000 | Active |
| `estylo-api` systemd service | Active / enabled |
| Backend reboot recovery | Verified |
| React 19 frontend | Built |
| Vite 6 production build | Successful |
| Nginx 1.26.3 | Active / enabled |
| Nginx React routing | Working |
| Nginx `/api` proxy | Working |
| LAN access on port 80 | Working |
| Login | Successful |
| `/cashier` | Successful |
| LAN HTTP UUID compatibility fix | Applied |
| API health | `database: connected` |
| Docker | Not used |
| Existing DB dump | Not restored |

### Final Result

The Estylo Barbers application is operational on the Raspberry Pi using a fully native deployment:

```text
React/Vite
    ↓
Nginx :80
    ↓
NestJS / Node.js
    ↓
Prisma
    ↓
PostgreSQL
```

The application is accessible to devices on the local network at:

```text
http://192.168.68.130
```

The database and backend automatically start after a Raspberry Pi reboot, and Nginx is also enabled at boot.

**Estylo Barbers Raspberry Pi deployment is operational end-to-end.**

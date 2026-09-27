# Estylo Barbers — Raspberry Pi Backend & Database Deployment

This document describes the deployment of the **Estylo Barbers backend API and PostgreSQL database** on a Raspberry Pi 4 from a fresh operating system installation.

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
└── Estylo Backend API
    ├── Node.js 22
    ├── NestJS 11
    ├── Prisma 6
    ├── Port 3000
    └── systemd: estylo-api.service
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

The web frontend deployment will be documented separately after it is configured.

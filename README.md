# Estylo Barbers Tracker

Responsive shop-management and POS web application for Estylo Barbers. The repository contains a React/Vite frontend, NestJS API, Prisma ORM, PostgreSQL database, Docker deployment, and Raspberry Pi-friendly runtime configuration.

## What is implemented

- Username/password login using an HTTP-only cookie
- Role-based access: `ADMIN`, `CASHIER`, `VIEWER`
- iPad-first cashier/POS interface
- Barber selection independent from the 3 shop seats
- Multiple services and products in one checkout
- Tips stored separately from service revenue
- Separate service and item-sale transactions
- Transaction IDs:
  - `SVC-YYYYMMDD-####`
  - `ITEM-YYYYMMDD-####`
- Daily database-backed counters
- Historical service/product price snapshots
- Retail and consumable inventory
- Automatic inventory consumption per service
- Inventory movement ledger
- Green/yellow/red stock-state calculation
- Stock-in and manual-adjustment API
- Transaction void/reversal logic
- 30-day and 3-month reports
- Service and barber breakdowns
- User, service and barber maintenance
- Audit log
- PWA manifest / Add to Home Screen support
- Docker Compose deployment
- PostgreSQL backup/restore scripts

## Architecture

```text
                           iPad / Desktop / Phone
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │ React + Vite + Nginx  │
                         │ Responsive / PWA      │
                         └───────────┬───────────┘
                                     │ /api
                                     ▼
                         ┌───────────────────────┐
                         │ NestJS REST API       │
                         │ Auth / RBAC           │
                         │ POS / Inventory       │
                         │ Reports / Audit       │
                         └───────────┬───────────┘
                                     │ Prisma
                                     ▼
                         ┌───────────────────────┐
                         │ PostgreSQL 16         │
                         └───────────────────────┘
```

Docker services:

```text
estylo-web
estylo-api
estylo-postgres
```

The web container proxies `/api/*` to the API container, so users access a single URL.

## Core data model

```text
User
Barber
Seat
Service ───────── ServiceInventoryUsage ───── InventoryItem
  │                                                │
  ▼                                                ▼
ServiceTransaction                           InventoryMovement
  │
  ▼
ServiceTransactionLine

Checkout
 ├── ServiceTransaction
 └── ItemTransaction ─── ItemTransactionLine ─── InventoryItem

TransactionCounter
AuditLog
ShopSetting
```

A barber is deliberately separate from a seat. A barber can therefore use a different physical seat without corrupting barber-performance history.

## Checkout behavior

A customer may have both services and retail items in one checkout.

Example:

```text
Haircut       ₱300
Beard Trim    ₱150
Tip            ₱50
Pomade        ₱350
```

The system creates one internal `Checkout`, then separately records:

```text
SVC-20260922-0001
  Service revenue: ₱450
  Tip:              ₱50

ITEM-20260922-0001
  Item revenue:    ₱350
```

Service consumables and sold products are deducted inside the same serializable PostgreSQL transaction. If a required stock operation fails, the checkout rolls back.

## Inventory thresholds

```text
quantity > warning level                         GREEN
quantity <= warning and quantity > reorder       YELLOW
quantity <= reorder                              RED
```

Inventory is changed through movement records such as:

```text
INITIAL_BALANCE
STOCK_IN
SERVICE_USAGE
ITEM_SALE
VOID_SERVICE
VOID_ITEM_SALE
MANUAL_ADJUSTMENT
```

## Local development

Requirements:

- Node.js 22+
- npm
- PostgreSQL 16, or Docker

Install dependencies:

```bash
npm install
```

Start PostgreSQL with Docker if desired:

```bash
docker compose up -d postgres
```

Create `.env`:

```bash
cp .env.example .env
```

For local processes outside Docker, set `DATABASE_URL` to a host-reachable PostgreSQL URL, for example:

```text
postgresql://estylo:change-this-password@localhost:5432/estylo?schema=public
```

Create/update the development database and seed it:

```bash
npm run db:generate
npm --workspace apps/api run prisma:push
npm run db:seed
```

Run API:

```bash
npm run dev:api
```

Run frontend in another terminal:

```bash
npm run dev:web
```

Frontend defaults to Vite's local URL and proxies `/api` to `http://localhost:3000`.

## Development users

The seed creates:

```text
admin
cashier
viewer
```

Development-only password for all seeded users:

```text
Estylo123!
```

**Change these credentials before real shop use.**

## Docker / Raspberry Pi deployment

Use a 64-bit Raspberry Pi OS / Debian installation with Docker and Docker Compose.

```bash
git clone <YOUR-GITHUB-REPOSITORY>
cd estylo-barbers-tracker
cp .env.example .env
```

Edit `.env` and set strong values for at least:

```text
POSTGRES_PASSWORD
DATABASE_URL
JWT_SECRET
```

Then:

```bash
docker compose up -d --build
```

Open:

```text
http://<raspberry-pi-ip>:8080
```

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

PostgreSQL data is stored in the persistent Docker volume `estylo_postgres_data`.

For a real deployment, use an SSD rather than relying only on a microSD card for the PostgreSQL volume, and consider a UPS for the Raspberry Pi.

## iPad setup

Open the application URL in Safari, then:

```text
Share → Add to Home Screen
```

The Cashier page intentionally does not use the admin sidebar and uses large touch controls for barber, seat, service, products and checkout.

## Database backup

```bash
./scripts/backup-db.sh
```

Backups are written to `backups/` and the sample script removes SQL dumps older than 14 days.

Example nightly cron entry:

```cron
0 2 * * * cd /opt/estylo-barbers-tracker && ./scripts/backup-db.sh >> /var/log/estylo-backup.log 2>&1
```

Restore:

```bash
./scripts/restore-db.sh backups/estylo-YYYYMMDD-HHMMSS.sql
```

## API routes

Important routes include:

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

GET  /api/barbers
GET  /api/seats
GET  /api/services
POST /api/services
POST /api/services/:id/inventory-usage

GET  /api/inventory
GET  /api/inventory/retail
POST /api/inventory/:id/stock-in
POST /api/inventory/:id/adjust

POST /api/checkouts
GET  /api/transactions
GET  /api/transactions/:id
POST /api/transactions/:id/void

GET  /api/reports/dashboard
GET  /api/reports/summary

GET  /api/users
POST /api/users
PATCH /api/users/:id

GET  /api/audit
GET  /api/health
```

Swagger is exposed at `/api/docs`.

## RBAC

| Capability | Admin | Cashier | Viewer |
|---|:---:|:---:|:---:|
| Dashboard | ✓ | | |
| Cashier / POS | ✓ | ✓ | |
| Transactions | ✓ | limited detail | |
| Inventory administration | ✓ | | |
| Reports | ✓ | | ✓ |
| Services | ✓ | | |
| Barbers | ✓ | | |
| Users | ✓ | | |
| Audit | ✓ | | |

The API enforces roles in addition to hiding restricted frontend routes.

## Branding

The supplied Estylo Barbers signage is included at:

```text
apps/web/public/estylo-logo.jpg
```

The UI theme uses black/charcoal, ivory and warm gold based on the supplied Estylo branding.

## Production follow-up

Before live financial use, perform a full acceptance test using a copy of production-like inventory and transaction data. Recommended next hardening items include automated end-to-end tests, HTTPS/reverse proxy configuration, login rate limiting, external/off-device backup replication, observability, and a documented disaster-recovery test.

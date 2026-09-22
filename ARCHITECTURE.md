# Estylo Barbers Architecture Notes

## Bounded modules

- **Auth**: login, session cookie and RBAC.
- **Users**: account maintenance.
- **Barbers**: barber roster. Independent of seats.
- **Seats**: three physical stations.
- **Services**: service catalog, pricing and inventory recipe.
- **Inventory**: item catalog, thresholds and movement ledger.
- **Checkouts**: atomic service/item sale orchestration and voids.
- **Reports**: operational/revenue aggregates from immutable transaction snapshots.
- **Audit**: administrative event trail.

## Transaction boundary

`POST /api/checkouts` executes inside a Serializable Prisma/PostgreSQL transaction. It validates barber/seat, loads authoritative prices, aggregates consumable demand, conditionally decrements stock, creates movement entries, allocates transaction counters, writes transaction snapshots, and commits as a single unit.

## Financial model

- Service revenue is `ServiceTransaction.serviceAmount`.
- Tip revenue is `ServiceTransaction.tipAmount` and is never included in service revenue.
- Retail revenue is `ItemTransaction.amount`.
- Voided records remain in the database and are excluded from normal reports.

## Inventory model

`InventoryItem.quantityOnHand` is the fast current balance. Every mutation also creates an `InventoryMovement` containing before/after quantity and the originating reference. This provides both fast reads and an auditable movement history.

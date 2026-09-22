import {
  PrismaClient,
  UserRole,
  InventoryType,
  InventoryMovementType,
} from '@prisma/client';

import argon2 from 'argon2';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * ============================================================
 * ENVIRONMENT
 * ============================================================
 *
 * seed.mjs is expected to be located at:
 *
 * apps/api/prisma/seed.mjs
 *
 * Environment file:
 *
 * apps/api/.env
 * ============================================================
 */

const __filename = fileURLToPath(
  import.meta.url,
);

const __dirname = path.dirname(
  __filename,
);

const envPath = path.resolve(
  __dirname,
  '../.env',
);

dotenv.config({
  path: envPath,
});

/*
 * ============================================================
 * REQUIRED ENV HELPER
 * ============================================================
 */

function requiredEnv(name) {
  const value =
    process.env[name];

  if (
    !value ||
    !value.trim()
  ) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

/*
 * ============================================================
 * LOAD SEED PASSWORDS FROM ENV
 * ============================================================
 */

const ADMIN_PASSWORD =
  requiredEnv(
    'SEED_ADMIN_PASSWORD',
  );

const CASHIER_PASSWORD =
  requiredEnv(
    'SEED_CASHIER_PASSWORD',
  );

const VIEWER_PASSWORD =
  requiredEnv(
    'SEED_VIEWER_PASSWORD',
  );

/*
 * ============================================================
 * PRISMA
 * ============================================================
 */

const prisma =
  new PrismaClient();

/*
 * ============================================================
 * USER ACCOUNTS
 * ============================================================
 */

const users = [
  {
    username:
      'duque-admin',

    displayName:
      'Estylo Admin',

    role:
      UserRole.ADMIN,

    password:
      ADMIN_PASSWORD,
  },

  {
    username:
      'cashier',

    displayName:
      'Estylo Cashier',

    role:
      UserRole.CASHIER,

    password:
      CASHIER_PASSWORD,
  },

  {
    username:
      'viewer',

    displayName:
      'Report Viewer',

    role:
      UserRole.VIEWER,

    password:
      VIEWER_PASSWORD,
  },
];

for (const user of users) {
  const passwordHash =
    await argon2.hash(
      user.password,
    );

  await prisma.user.upsert({
    where: {
      username:
        user.username,
    },

    update: {
      displayName:
        user.displayName,

      role:
        user.role,

      active:
        true,

      passwordHash,
    },

    create: {
      username:
        user.username,

      displayName:
        user.displayName,

      role:
        user.role,

      active:
        true,

      passwordHash,
    },
  });
}

/*
 * ============================================================
 * DISABLE LEGACY ADMIN ACCOUNT
 * ============================================================
 *
 * If the original seed created username "admin",
 * keep the database record for historical references,
 * but disable login access.
 * ============================================================
 */

await prisma.user.updateMany({
  where: {
    username:
      'admin',
  },

  data: {
    active:
      false,
  },
});

/*
 * ============================================================
 * GET ADMIN ACCOUNT
 * ============================================================
 */

const admin =
  await prisma.user.findUniqueOrThrow({
    where: {
      username:
        'duque-admin',
    },
  });

/*
 * ============================================================
 * BARBER SEATS
 * ============================================================
 */

for (
  const number
  of [1, 2, 3]
) {
  await prisma.seat.upsert({
    where: {
      number,
    },

    update: {
      active:
        true,
    },

    create: {
      number,

      name:
        `Seat ${number}`,

      active:
        true,
    },
  });
}

/*
 * ============================================================
 * BARBERS
 * ============================================================
 */

for (
  const [
    index,
    name,
  ] of [
    'Fritz',
    'Japol',
  ].entries()
) {
  await prisma.barber.upsert({
    where: {
      code:
        `BARBER-${index + 1}`,
    },

    update: {
      name,

      active:
        true,

      displayOrder:
        index + 1,
    },

    create: {
      code:
        `BARBER-${index + 1}`,

      name,

      displayOrder:
        index + 1,

      active:
        true,
    },
  });
}

/*
 * ============================================================
 * SERVICES
 * ============================================================
 */

const services = [
  {
    code:
      'HAIRCUT',

    name:
      'Haircut',

    fee:
      '180.00',

    displayOrder:
      1,
  },

  {
    code:
      'HAIRCUT + SHAMPOO',

    name:
      'Haircut + Shampoo',

    fee:
      '250.00',

    displayOrder:
      2,
  }
];

for (
  const service
  of services
) {
  await prisma.service.upsert({
    where: {
      code:
        service.code,
    },

    update: {
      name:
        service.name,

      fee:
        service.fee,

      displayOrder:
        service.displayOrder,

      active:
        true,
    },

    create: {
      code:
        service.code,

      name:
        service.name,

      fee:
        service.fee,

      displayOrder:
        service.displayOrder,

      active:
        true,
    },
  });
}

/*
 * ============================================================
 * INVENTORY
 *
 * No automatic service consumable mappings are created.
 * ============================================================
 */

const inventoryItems = [
  {
    sku: 'POMADE',
    name: 'Pomade',
    type: InventoryType.RETAIL,
    unit: 'pcs',
    qty: '20',
    warn: '8',
    reorder: '4',
    price: '250.00',
  },
  {
    sku: 'TEXTURED_POWDER',
    name: 'Textured Powder',
    type: InventoryType.RETAIL,
    unit: 'pcs',
    qty: '20',
    warn: '8',
    reorder: '4',
    price: '250.00',
  }
];

for (
  const itemData
  of inventoryItems
) {
  const item =
    await prisma.inventoryItem.upsert({
      where: {
        sku:
          itemData.sku,
      },

      update: {
        name:
          itemData.name,

        type:
          itemData.type,

        unit:
          itemData.unit,

        sellingPrice:
          itemData.price,

        active:
          true,
      },

      create: {
        sku:
          itemData.sku,

        name:
          itemData.name,

        type:
          itemData.type,

        unit:
          itemData.unit,

        quantityOnHand:
          itemData.qty,

        warningLevel:
          itemData.warn,

        reorderLevel:
          itemData.reorder,

        sellingPrice:
          itemData.price,

        active:
          true,
      },
    });

  /*
   * Create INITIAL_BALANCE only when this
   * inventory item has no previous movements.
   *
   * This prevents rerunning the seed from
   * repeatedly adding inventory.
   */

  const movementCount =
    await prisma.inventoryMovement.count({
      where: {
        inventoryItemId:
          item.id,
      },
    });

  if (
    movementCount === 0
  ) {
    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId:
          item.id,

        movementType:
          InventoryMovementType.INITIAL_BALANCE,

        quantity:
          itemData.qty,

        quantityBefore:
          0,

        quantityAfter:
          itemData.qty,

        reason:
          'Seed initial balance',

        createdById:
          admin.id,
      },
    });
  }
}

/*
 * ============================================================
 * SHOP SETTINGS
 * ============================================================
 */

await prisma.shopSetting.upsert({
  where: {
    id:
      'default',
  },

  update: {
    shopName:
      'Estylo Barbers',

    currency:
      'PHP',

    timezone:
      'Asia/Manila',
  },

  create: {
    id:
      'default',

    shopName:
      'Estylo Barbers',

    currency:
      'PHP',

    timezone:
      'Asia/Manila',
  },
});

/*
 * ============================================================
 * COMPLETED
 * ============================================================
 *
 * Passwords are intentionally NOT printed.
 * ============================================================
 */

console.log('');
console.log(
  'Estylo database seed completed successfully.',
);
console.log('');
console.log(
  `Environment loaded from: ${envPath}`,
);
console.log('');
console.log(
  'Accounts created/updated:',
);
console.log(
  '- duque-admin (ADMIN)',
);
console.log(
  '- cashier (CASHIER)',
);
console.log(
  '- viewer (VIEWER)',
);
console.log('');
console.log(
  'Passwords were loaded from environment variables.',
);
console.log('');

await prisma.$disconnect();
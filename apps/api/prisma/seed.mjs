import { PrismaClient, UserRole, InventoryType, InventoryMovementType } from '@prisma/client';
import argon2 from 'argon2';
const prisma = new PrismaClient();
const passwordHash = await argon2.hash('Estylo123!');
for (const [username, displayName, role] of [['admin','Estylo Admin',UserRole.ADMIN],['cashier','Maria Cashier',UserRole.CASHIER],['viewer','Report Viewer',UserRole.VIEWER]]) {
  await prisma.user.upsert({ where:{username}, update:{displayName,role,active:true}, create:{username,displayName,role,active:true,passwordHash} });
}
const admin=await prisma.user.findUniqueOrThrow({where:{username:'admin'}});
for (const number of [1,2,3]) await prisma.seat.upsert({where:{number},update:{active:true},create:{number,name:`Seat ${number}`}});
for (const [i,name] of ['Carlo','Miguel','James'].entries()) await prisma.barber.upsert({where:{code:`BARBER-${i+1}`},update:{name,active:true,displayOrder:i+1},create:{code:`BARBER-${i+1}`,name,displayOrder:i+1}});
for (const [code,name,fee,displayOrder] of [['HAIRCUT','Haircut','300.00',1],['KIDS','Kids Haircut','250.00',2],['BEARD','Beard Trim','150.00',3],['CUT-BEARD','Haircut + Beard','400.00',4]]) await prisma.service.upsert({where:{code},update:{name,fee,displayOrder,active:true},create:{code,name,fee,displayOrder}});
const list=[
 {sku:'POMADE',name:'Pomade',type:InventoryType.RETAIL,unit:'pcs',qty:'20',warn:'8',reorder:'4',price:'350.00'},
 {sku:'SHAMPOO',name:'Shampoo',type:InventoryType.RETAIL_AND_CONSUMABLE,unit:'ml',qty:'5000',warn:'1200',reorder:'600',price:'280.00'},
 {sku:'WAX',name:'Hair Wax',type:InventoryType.RETAIL_AND_CONSUMABLE,unit:'ml',qty:'1500',warn:'400',reorder:'200',price:'320.00'},
 {sku:'RAZOR',name:'Razor Blade',type:InventoryType.CONSUMABLE,unit:'pcs',qty:'100',warn:'30',reorder:'20',price:null},
];
for (const x of list) {
 const item=await prisma.inventoryItem.upsert({where:{sku:x.sku},update:{name:x.name,type:x.type,unit:x.unit,sellingPrice:x.price},create:{sku:x.sku,name:x.name,type:x.type,unit:x.unit,quantityOnHand:x.qty,warningLevel:x.warn,reorderLevel:x.reorder,sellingPrice:x.price}});
 if(await prisma.inventoryMovement.count({where:{inventoryItemId:item.id}})===0) await prisma.inventoryMovement.create({data:{inventoryItemId:item.id,movementType:InventoryMovementType.INITIAL_BALANCE,quantity:x.qty,quantityBefore:0,quantityAfter:x.qty,reason:'Seed initial balance',createdById:admin.id}});
}
const haircut=await prisma.service.findUniqueOrThrow({where:{code:'HAIRCUT'}}), razor=await prisma.inventoryItem.findUniqueOrThrow({where:{sku:'RAZOR'}});
await prisma.serviceInventoryUsage.upsert({where:{serviceId_inventoryItemId:{serviceId:haircut.id,inventoryItemId:razor.id}},update:{quantity:1},create:{serviceId:haircut.id,inventoryItemId:razor.id,quantity:1}});
await prisma.shopSetting.upsert({where:{id:'default'},update:{},create:{id:'default',shopName:'Estylo Barbers',currency:'PHP',timezone:'Asia/Manila'}});
console.log('Estylo seed complete. DEVELOPMENT password: Estylo123!');
await prisma.$disconnect();

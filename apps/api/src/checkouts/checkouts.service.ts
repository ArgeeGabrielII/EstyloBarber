import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto } from './checkouts.dto';

function businessDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const get=(t:string)=>parts.find(p=>p.type===t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

@Injectable()
export class CheckoutsService {
  constructor(private prisma: PrismaService) {}

  private async nextId(tx: Prisma.TransactionClient, type: TransactionType) {
    const date = businessDateString();
    const dateValue = new Date(`${date}T00:00:00.000Z`);
    const row = await tx.transactionCounter.upsert({
      where: { businessDate_transactionType: { businessDate: dateValue, transactionType: type } },
      create: { id: randomUUID(), businessDate: dateValue, transactionType: type, currentValue: 1 },
      update: { currentValue: { increment: 1 } },
    });
    const prefix = type === TransactionType.SERVICE ? 'SVC' : 'ITEM';
    return `${prefix}-${date.replaceAll('-','')}-${String(row.currentValue).padStart(4,'0')}`;
  }

  async create(dto: CreateCheckoutDto, cashierId: string) {
    const existing = await this.prisma.checkout.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: { serviceTransaction: true, itemTransaction: true } });
    if (existing) return this.toResponse(existing);
    if (dto.services.length === 0 && dto.items.length === 0) throw new BadRequestException('Select at least one service or product');
    if (new Prisma.Decimal(dto.tip).lt(0)) throw new BadRequestException('Tip cannot be negative');
    if (dto.services.length > 0 && (!dto.barberId || !dto.seatId)) throw new BadRequestException('Barber and seat are required for service transactions');

    const checkout = await this.prisma.$transaction(async tx => {
      if (dto.barberId) await tx.barber.findFirstOrThrow({ where: { id: dto.barberId, active: true } });
      if (dto.seatId) await tx.seat.findFirstOrThrow({ where: { id: dto.seatId, active: true } });
      const createdCheckout = await tx.checkout.create({ data: { idempotencyKey: dto.idempotencyKey, cashierId } });

      if (dto.services.length) {
        const ids = [...new Set(dto.services.map(s=>s.serviceId))];
        const services = await tx.service.findMany({ where: { id:{in:ids}, active:true }, include:{inventoryUsage:true} });
        if (services.length !== ids.length) throw new BadRequestException('One or more services are invalid or inactive');
        const byId = new Map(services.map(s=>[s.id,s]));
        let serviceAmount = new Prisma.Decimal(0);
        const lines = dto.services.map(sel=>{
          const s=byId.get(sel.serviceId)!; const total=s.fee.mul(sel.quantity); serviceAmount=serviceAmount.add(total);
          return { serviceId:s.id, serviceCodeSnapshot:s.code, serviceNameSnapshot:s.name, unitPrice:s.fee, quantity:sel.quantity, lineTotal:total };
        });

        const needed = new Map<string,Prisma.Decimal>();
        for (const sel of dto.services) {
          const service=byId.get(sel.serviceId)!;
          for (const usage of service.inventoryUsage) needed.set(usage.inventoryItemId,(needed.get(usage.inventoryItemId)??new Prisma.Decimal(0)).add(usage.quantity.mul(sel.quantity)));
        }
        for (const [inventoryItemId, qty] of needed) {
          const result = await tx.inventoryItem.updateMany({ where:{id:inventoryItemId,active:true,quantityOnHand:{gte:qty}}, data:{quantityOnHand:{decrement:qty}} });
          if (result.count !== 1) { const item=await tx.inventoryItem.findUnique({where:{id:inventoryItemId}}); throw new BadRequestException(`Not enough stock for ${item?.name ?? 'service consumable'}`); }
          const after=(await tx.inventoryItem.findUniqueOrThrow({where:{id:inventoryItemId}})).quantityOnHand;
          await tx.inventoryMovement.create({data:{inventoryItemId,movementType:InventoryMovementType.SERVICE_USAGE,quantity:qty.neg(),quantityBefore:after.add(qty),quantityAfter:after,referenceType:'CHECKOUT',referenceId:createdCheckout.id,reason:'Automatic service consumption',createdById:cashierId}});
        }
        const transactionId=await this.nextId(tx,TransactionType.SERVICE);
        await tx.serviceTransaction.create({data:{transactionId,checkoutId:createdCheckout.id,cashierId,barberId:dto.barberId!,seatId:dto.seatId!,serviceAmount,tipAmount:dto.tip,lines:{create:lines}}});
      }

      if (dto.items.length) {
        const ids=[...new Set(dto.items.map(i=>i.inventoryItemId))];
        const items=await tx.inventoryItem.findMany({where:{id:{in:ids},active:true,sellingPrice:{not:null}}});
        if(items.length!==ids.length) throw new BadRequestException('One or more products are invalid, inactive, or not for sale');
        const byId=new Map(items.map(i=>[i.id,i])); let amount=new Prisma.Decimal(0);
        const lines=[] as Array<{inventoryItemId:string;skuSnapshot:string;itemNameSnapshot:string;unitPrice:Prisma.Decimal;quantity:Prisma.Decimal;lineTotal:Prisma.Decimal}>;
        for(const sel of dto.items){ const item=byId.get(sel.inventoryItemId)!; const qty=new Prisma.Decimal(sel.quantity); if(qty.lte(0)) throw new BadRequestException('Product quantity must be greater than zero'); const total=item.sellingPrice!.mul(qty); amount=amount.add(total); lines.push({inventoryItemId:item.id,skuSnapshot:item.sku,itemNameSnapshot:item.name,unitPrice:item.sellingPrice!,quantity:qty,lineTotal:total}); const result=await tx.inventoryItem.updateMany({where:{id:item.id,quantityOnHand:{gte:qty}},data:{quantityOnHand:{decrement:qty}}}); if(result.count!==1) throw new BadRequestException(`Not enough stock for ${item.name}`); const after=(await tx.inventoryItem.findUniqueOrThrow({where:{id:item.id}})).quantityOnHand; await tx.inventoryMovement.create({data:{inventoryItemId:item.id,movementType:InventoryMovementType.ITEM_SALE,quantity:qty.neg(),quantityBefore:after.add(qty),quantityAfter:after,referenceType:'CHECKOUT',referenceId:createdCheckout.id,reason:'Retail sale',createdById:cashierId}}); }
        const transactionId=await this.nextId(tx,TransactionType.ITEM);
        await tx.itemTransaction.create({data:{transactionId,checkoutId:createdCheckout.id,cashierId,amount,lines:{create:lines}}});
      }

      return tx.checkout.findUniqueOrThrow({where:{id:createdCheckout.id},include:{serviceTransaction:true,itemTransaction:true}});
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.toResponse(checkout);
  }

  private toResponse(checkout: {id:string; serviceTransaction:null|{transactionId:string;serviceAmount:Prisma.Decimal;tipAmount:Prisma.Decimal}; itemTransaction:null|{transactionId:string;amount:Prisma.Decimal}}) {
    const service=checkout.serviceTransaction; const item=checkout.itemTransaction;
    const total=(service?.serviceAmount ?? new Prisma.Decimal(0)).add(service?.tipAmount ?? 0).add(item?.amount ?? 0);
    return { checkoutId:checkout.id, serviceTransaction:service?{transactionId:service.transactionId,amount:service.serviceAmount.toFixed(2),tip:service.tipAmount.toFixed(2)}:null, itemTransaction:item?{transactionId:item.transactionId,amount:item.amount.toFixed(2)}:null, totalCollected:total.toFixed(2) };
  }

  async list() {
    const [services,items]=await Promise.all([
      this.prisma.serviceTransaction.findMany({include:{cashier:{select:{displayName:true}},barber:true,seat:true},orderBy:{createdAt:'desc'},take:250}),
      this.prisma.itemTransaction.findMany({include:{cashier:{select:{displayName:true}}},orderBy:{createdAt:'desc'},take:250}),
    ]);
    return [...services.map(t=>({transactionId:t.transactionId,type:'SERVICE',createdAt:t.createdAt,amount:t.serviceAmount.toFixed(2),tip:t.tipAmount.toFixed(2),status:t.status,cashier:t.cashier.displayName,barber:t.barber.name,seat:t.seat.name})),...items.map(t=>({transactionId:t.transactionId,type:'ITEM',createdAt:t.createdAt,amount:t.amount.toFixed(2),tip:'0.00',status:t.status,cashier:t.cashier.displayName,barber:null,seat:null}))].sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt));
  }

  async get(transactionId:string){
    if(transactionId.startsWith('SVC-')) return this.prisma.serviceTransaction.findUniqueOrThrow({where:{transactionId},include:{lines:true,cashier:{select:{displayName:true}},barber:true,seat:true}});
    if(transactionId.startsWith('ITEM-')) return this.prisma.itemTransaction.findUniqueOrThrow({where:{transactionId},include:{lines:true,cashier:{select:{displayName:true}}}});
    throw new NotFoundException('Transaction not found');
  }

  async void(transactionId:string,reason:string,userId:string){
    if(!reason.trim()) throw new BadRequestException('Void reason is required');
    return this.prisma.$transaction(async tx=>{
      if(transactionId.startsWith('SVC-')){
        const t=await tx.serviceTransaction.findUniqueOrThrow({where:{transactionId},include:{checkout:true}}); if(t.status===TransactionStatus.VOID) throw new BadRequestException('Transaction is already void');
        const movements=await tx.inventoryMovement.findMany({where:{referenceId:t.checkoutId,movementType:InventoryMovementType.SERVICE_USAGE}});
        for(const m of movements){ const qty=m.quantity.abs(); const item=await tx.inventoryItem.findUniqueOrThrow({where:{id:m.inventoryItemId}}); const after=item.quantityOnHand.add(qty); await tx.inventoryItem.update({where:{id:item.id},data:{quantityOnHand:after}}); await tx.inventoryMovement.create({data:{inventoryItemId:item.id,movementType:InventoryMovementType.VOID_SERVICE,quantity:qty,quantityBefore:item.quantityOnHand,quantityAfter:after,referenceType:'SERVICE_TRANSACTION',referenceId:t.id,reason,createdById:userId}}); }
        await tx.serviceTransaction.update({where:{id:t.id},data:{status:TransactionStatus.VOID,voidedAt:new Date(),voidedBy:userId,voidReason:reason}});
      } else if(transactionId.startsWith('ITEM-')){
        const t=await tx.itemTransaction.findUniqueOrThrow({where:{transactionId}}); if(t.status===TransactionStatus.VOID) throw new BadRequestException('Transaction is already void');
        const movements=await tx.inventoryMovement.findMany({where:{referenceId:t.checkoutId,movementType:InventoryMovementType.ITEM_SALE}});
        for(const m of movements){ const qty=m.quantity.abs(); const item=await tx.inventoryItem.findUniqueOrThrow({where:{id:m.inventoryItemId}}); const after=item.quantityOnHand.add(qty); await tx.inventoryItem.update({where:{id:item.id},data:{quantityOnHand:after}}); await tx.inventoryMovement.create({data:{inventoryItemId:item.id,movementType:InventoryMovementType.VOID_ITEM_SALE,quantity:qty,quantityBefore:item.quantityOnHand,quantityAfter:after,referenceType:'ITEM_TRANSACTION',referenceId:t.id,reason,createdById:userId}}); }
        await tx.itemTransaction.update({where:{id:t.id},data:{status:TransactionStatus.VOID,voidedAt:new Date(),voidedBy:userId,voidReason:reason}});
      } else throw new NotFoundException('Transaction not found');
      await tx.auditLog.create({data:{event:'TRANSACTION_VOIDED',entityType:'Transaction',entityId:transactionId,userId,metadata:{reason}}});
      return {ok:true,transactionId};
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

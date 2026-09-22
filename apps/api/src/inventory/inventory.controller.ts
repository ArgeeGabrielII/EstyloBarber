import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InventoryMovementType, InventoryType, Prisma, UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard'; import { RolesGuard } from '../auth/roles.guard'; import { AuthUser, CurrentUser } from '../common/current-user.decorator'; import { Roles } from '../common/roles.decorator'; import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto, InventoryQuantityDto, UpdateInventoryItemDto } from './inventory.dto';

function itemView<T extends { quantityOnHand: Prisma.Decimal; warningLevel: Prisma.Decimal; reorderLevel: Prisma.Decimal }>(item:T){
 const q=item.quantityOnHand.toNumber(), w=item.warningLevel.toNumber(), r=item.reorderLevel.toNumber();
 return { ...item, stockStatus: q <= r ? 'RED' : q <= w ? 'YELLOW' : 'GREEN' };
}
@Controller('inventory') @UseGuards(AuthGuard,RolesGuard)
export class InventoryController {
 constructor(private prisma:PrismaService){}
 @Get() @Roles(UserRole.ADMIN) async list(){ return (await this.prisma.inventoryItem.findMany({orderBy:{name:'asc'}})).map(itemView); }
 @Get('retail') @Roles(UserRole.ADMIN,UserRole.CASHIER) async retail(){ const items=await this.prisma.inventoryItem.findMany({where:{active:true,type:{in:[InventoryType.RETAIL,InventoryType.RETAIL_AND_CONSUMABLE]},sellingPrice:{not:null}},orderBy:{name:'asc'}}); return items.map(itemView); }
 @Get(':id') @Roles(UserRole.ADMIN) async get(@Param('id')id:string){ return itemView(await this.prisma.inventoryItem.findUniqueOrThrow({where:{id},include:{movements:{orderBy:{createdAt:'desc'},take:100}}})); }
 @Post() @Roles(UserRole.ADMIN) async create(@Body()dto:CreateInventoryItemDto,@CurrentUser()actor:AuthUser){
  const q=new Prisma.Decimal(dto.quantityOnHand), w=new Prisma.Decimal(dto.warningLevel), r=new Prisma.Decimal(dto.reorderLevel); if(w.lt(r)) throw new BadRequestException('Warning level must be greater than or equal to reorder level');
  return this.prisma.$transaction(async tx=>{ const item=await tx.inventoryItem.create({data:dto}); if(!q.isZero()) await tx.inventoryMovement.create({data:{inventoryItemId:item.id,movementType:InventoryMovementType.INITIAL_BALANCE,quantity:q,quantityBefore:0,quantityAfter:q,reason:'Initial balance',createdById:actor.id}}); return itemView(item); });
 }
 @Patch(':id') @Roles(UserRole.ADMIN) async update(@Param('id')id:string,@Body()dto:UpdateInventoryItemDto,@CurrentUser()actor:AuthUser){ const old=await this.prisma.inventoryItem.findUniqueOrThrow({where:{id}}); const updated=await this.prisma.inventoryItem.update({where:{id},data:dto}); if(updated.warningLevel.lt(updated.reorderLevel)) { await this.prisma.inventoryItem.update({where:{id},data:{warningLevel:old.warningLevel,reorderLevel:old.reorderLevel}}); throw new BadRequestException('Warning level must be greater than or equal to reorder level'); } await this.prisma.auditLog.create({data:{event:'INVENTORY_UPDATED',entityType:'InventoryItem',entityId:id,userId:actor.id,oldValue:{name:old.name,warningLevel:old.warningLevel.toString(),reorderLevel:old.reorderLevel.toString()},newValue:{name:updated.name,warningLevel:updated.warningLevel.toString(),reorderLevel:updated.reorderLevel.toString()}}}); return itemView(updated); }
 @Post(':id/stock-in') @Roles(UserRole.ADMIN) stockIn(@Param('id')id:string,@Body()dto:InventoryQuantityDto,@CurrentUser()actor:AuthUser){ return this.change(id,dto.quantity,dto.reason,InventoryMovementType.STOCK_IN,actor.id); }
 @Post(':id/adjust') @Roles(UserRole.ADMIN) adjust(@Param('id')id:string,@Body()dto:InventoryQuantityDto,@CurrentUser()actor:AuthUser){ return this.change(id,dto.quantity,dto.reason,InventoryMovementType.MANUAL_ADJUSTMENT,actor.id); }
 private async change(id:string,qtyText:string,reason:string,type:InventoryMovementType,userId:string){ const qty=new Prisma.Decimal(qtyText); if(type===InventoryMovementType.STOCK_IN && qty.lte(0)) throw new BadRequestException('Stock-in quantity must be greater than 0'); return this.prisma.$transaction(async tx=>{ const item=await tx.inventoryItem.findUniqueOrThrow({where:{id}}); const after=item.quantityOnHand.add(qty); if(after.lt(0)) throw new BadRequestException('Inventory cannot become negative'); const updated=await tx.inventoryItem.update({where:{id},data:{quantityOnHand:after}}); await tx.inventoryMovement.create({data:{inventoryItemId:id,movementType:type,quantity:qty,quantityBefore:item.quantityOnHand,quantityAfter:after,reason,createdById:userId}}); return itemView(updated); }); }
}

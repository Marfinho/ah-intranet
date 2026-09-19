import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { OrderStatus, OrderType } from "@prisma/client";
import { OrdersService } from "./orders.service";
import { CurrentUser, Feature, Permission, Roles } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class BusinessCardOrderDto {
  @Type(() => Number) @IsInt() @Min(50) @Max(5000) quantity!: number;
  @IsObject() values!: Record<string, string>;
  @IsOptional() @IsString() reorderOf?: string;
}

class WorkwearItemDto {
  @IsString() catalogItemId!: string;
  @IsString() size!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) quantity!: number;
}

class WorkwearOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => WorkwearItemDto)
  items!: WorkwearItemDto[];
}

class CommentDto {
  @IsString() @MinLength(2) message!: string;
}

class TransitionDto {
  @IsIn(["submitted", "approved", "rejected", "queued_for_bulk_order", "ordered", "completed", "cancelled"])
  status!: OrderStatus;

  @IsOptional() @IsString() note?: string;

  /** Rechnungsbetrag des Dienstleisters; Grundlage für den DATEV-Export. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) netAmount?: number;

  @IsOptional() @IsString() supplierInvoice?: string;
}

class CycleDto {
  @IsOptional() @IsString() id?: string;
  @IsIn(["business_cards", "workwear"]) cycleType!: "business_cards" | "workwear";
  @IsString() @MinLength(2) title!: string;
  @IsString() nextOrderDate!: string;
  @IsOptional() @IsString() notes?: string;
}

class FieldDefinitionDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) key!: string;
  @IsString() @MinLength(1) label!: string;
  @IsIn(["text", "email", "phone", "select", "checkbox"]) fieldType!: string;
  @Type(() => Number) @IsInt() sortOrder!: number;
  @IsBoolean() isRequired!: boolean;
  @IsBoolean() isActive!: boolean;
  @IsArray() @IsString({ each: true }) options!: string[];
  @IsOptional() @IsString() helpText?: string;
}

class CatalogItemDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) category!: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() @IsString({ each: true }) sizes!: string[];
  @IsBoolean() isActive!: boolean;
}

@Controller("orders")
@Feature("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("mine") mine?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    return this.orders.list(user, { mine: mine === "true", status, search });
  }

  @Get("business-cards/config")
  businessCardConfig(@CurrentUser() user: RequestUser) {
    return this.orders.businessCardConfig(user);
  }

  @Post("business-cards")
  createBusinessCard(@CurrentUser() user: RequestUser, @Body() dto: BusinessCardOrderDto) {
    return this.orders.createBusinessCardOrder(user, dto);
  }

  @Get("workwear/catalog")
  workwearCatalog(@CurrentUser() user: RequestUser) {
    return this.orders.workwearCatalog(user);
  }

  @Post("workwear")
  createWorkwear(@CurrentUser() user: RequestUser, @Body() dto: WorkwearOrderDto) {
    return this.orders.createWorkwearOrder(user, dto);
  }

  @Get("cycles")
  cycles() {
    return this.orders.cycles();
  }

  @Post("cycles")
  @Roles("admin", "fachbereichsadmin")
  @Permission("catalog.manage")
  upsertCycle(@CurrentUser() user: RequestUser, @Body() dto: CycleDto) {
    return this.orders.upsertCycle(user, dto);
  }

  @Delete("cycles/:id")
  @Roles("admin")
  @Permission("catalog.manage")
  removeCycle(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.removeCycle(user, id);
  }

  @Get("catalog/workwear")
  @Roles("admin", "fachbereichsadmin")
  catalog() {
    return this.orders.catalog();
  }

  @Post("catalog/workwear")
  @Roles("admin", "fachbereichsadmin")
  @Permission("catalog.manage")
  upsertCatalogItem(@CurrentUser() user: RequestUser, @Body() dto: CatalogItemDto) {
    return this.orders.upsertCatalogItem(user, dto);
  }

  @Get("catalog/business-card-fields")
  @Roles("admin", "fachbereichsadmin")
  fieldDefinitions() {
    return this.orders.fieldDefinitions();
  }

  @Post("catalog/business-card-fields")
  @Roles("admin", "fachbereichsadmin")
  @Permission("catalog.manage")
  upsertFieldDefinition(@CurrentUser() user: RequestUser, @Body() dto: FieldDefinitionDto) {
    return this.orders.upsertFieldDefinition(user, dto);
  }

  @Get(":id")
  detail(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.detail(user, id);
  }

  @Post(":id/comments")
  comment(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CommentDto) {
    return this.orders.addComment(user, id, dto.message);
  }

  @Post(":id/status")
  transition(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: TransitionDto) {
    return this.orders.transition(user, id, dto.status, dto.note, {
      netAmount: dto.netAmount,
      supplierInvoice: dto.supplierInvoice,
    });
  }
}

@Controller("approvals")
@Feature("approvals")
export class ApprovalsController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @Roles("admin", "fachbereichsadmin")
  @Permission("orders.approve")
  list(@CurrentUser() user: RequestUser, @Query("status") status?: string, @Query("search") search?: string) {
    return this.orders.approvals(user, { status, search });
  }

  @Post("bulk/:type")
  @Roles("admin", "fachbereichsadmin")
  @Permission("orders.bulk")
  bulk(@CurrentUser() user: RequestUser, @Param("type") type: OrderType) {
    return this.orders.bulkOrder(user, type);
  }
}

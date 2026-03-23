import { Injectable, NotFoundException } from "@nestjs/common";
import {
  allOrders,
  approvalTasks,
  businessCardFields,
  businessCardOrders,
  orderCycles,
  workwearCatalog,
  workwearOrders,
} from "@ah-intranet/shared";
import { AuditService } from "../audit/audit.service";
import { CreateBusinessCardOrderDto } from "./dto/create-business-card-order.dto";
import { CreateWorkwearOrderDto } from "./dto/create-workwear-order.dto";

@Injectable()
export class OrdersService {
  constructor(private readonly auditService: AuditService) {}

  overview() {
    return {
      orders: allOrders,
      approvalTasks,
      orderCycles,
    };
  }

  findAll() {
    return allOrders;
  }

  businessCardConfig() {
    return {
      fields: businessCardFields,
      nextOrderDate: orderCycles.find((cycle) => cycle.type === "business_cards"),
      existingOrders: businessCardOrders,
    };
  }

  businessCardDetail(id: string) {
    const order = businessCardOrders.find((item) => item.id === id);
    if (!order) {
      throw new NotFoundException("Visitenkartenbestellung nicht gefunden");
    }
    return order;
  }

  createBusinessCardOrder(dto: CreateBusinessCardOrderDto) {
    const entityId = `BC-${Date.now()}`;
    this.auditService.log({
      actor: dto.username,
      action: "order.create",
      entityType: "business_card_order",
      entityId,
      detail: "Visitenkartenbestellung angelegt",
    });

    return {
      id: entityId,
      type: "business_card",
      status: "submitted",
      nextCycle: orderCycles.find((cycle) => cycle.type === "business_cards")?.nextOrderDate,
      submittedFields: dto.fields,
      message: "Bestellung wurde eingereicht und wartet auf Freigabe.",
    };
  }

  workwearCatalog() {
    return {
      catalog: workwearCatalog,
      nextOrderDate: orderCycles.find((cycle) => cycle.type === "workwear"),
      existingOrders: workwearOrders,
    };
  }

  workwearDetail(id: string) {
    const order = workwearOrders.find((item) => item.id === id);
    if (!order) {
      throw new NotFoundException("Arbeitskleidungsbestellung nicht gefunden");
    }
    return order;
  }

  createWorkwearOrder(dto: CreateWorkwearOrderDto) {
    const entityId = `WW-${Date.now()}`;
    this.auditService.log({
      actor: dto.username,
      action: "order.create",
      entityType: "workwear_order",
      entityId,
      detail: "Arbeitskleidungsbestellung angelegt",
    });

    return {
      id: entityId,
      type: "workwear",
      status: "submitted",
      nextCycle: orderCycles.find((cycle) => cycle.type === "workwear")?.nextOrderDate,
      items: dto.items,
      message: "Bestellung wurde eingereicht und wartet auf Freigabe.",
    };
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type OrderStatus, type OrderType } from "@prisma/client";
import type {
  ApprovalTask,
  BusinessCardFieldDefinition,
  BusinessCardOrderDetail,
  OrderCycleInfo,
  OrderSummary,
  TimelineEntry,
  WorkwearCatalogItem,
  WorkwearOrderDetail,
} from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { buildNumber, displayName, scopeLabel, toIso } from "../../core/mappers";
import { isManaging, type RequestUser } from "../../core/request-user";

const requesterSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  location: { select: { name: true } },
  department: { select: { name: true } },
  specialtyArea: { select: { name: true } },
} as const;

const orderInclude = {
  requester: { select: requesterSelect },
  orderCycle: true,
  statusHistory: { orderBy: { changedAt: "asc" } },
  comments: {
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  },
  businessCardOrder: { include: { fields: { include: { fieldDefinition: true } } } },
  workwearOrder: { include: { items: { include: { catalogItem: { select: { name: true } } } } } },
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** Welche Statusübergänge fachlich erlaubt sind. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["queued_for_bulk_order", "cancelled"],
  queued_for_bulk_order: ["ordered", "cancelled"],
  ordered: ["completed"],
  rejected: [],
  completed: [],
  cancelled: [],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Entwurf",
  submitted: "Eingereicht",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  queued_for_bulk_order: "Für Sammelbestellung vorgemerkt",
  ordered: "Extern bestellt",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ----------------------------------------------------------- Lesen */

  async list(user: RequestUser, filter: { mine?: boolean; status?: string; search?: string } = {}) {
    const where: Prisma.OrderWhereInput = {
      ...(filter.mine || !isManaging(user) ? { requesterId: user.id } : {}),
      ...(filter.status && filter.status !== "all" ? { status: filter.status as OrderStatus } : {}),
      ...(filter.search
        ? {
            OR: [
              { orderNumber: { contains: filter.search, mode: "insensitive" } },
              { requester: { firstName: { contains: filter.search, mode: "insensitive" } } },
              { requester: { lastName: { contains: filter.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const orders = await this.prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return orders.map((order) => this.toSummary(order));
  }

  async detail(user: RequestUser, id: string): Promise<BusinessCardOrderDetail | WorkwearOrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) {
      throw new NotFoundException("Bestellung nicht gefunden");
    }
    if (order.requesterId !== user.id && !isManaging(user)) {
      throw new ForbiddenException("Diese Bestellung gehört nicht zu Ihrem Zuständigkeitsbereich.");
    }
    return this.toDetail(order);
  }

  /* ------------------------------------------------------ Visitenkarten */

  async businessCardConfig(user: RequestUser) {
    const [fields, cycle, orders] = await Promise.all([
      this.prisma.businessCardFieldDefinition.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.nextCycle("business_cards"),
      this.prisma.order.findMany({
        where: { requesterId: user.id, type: "business_card" },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      fields: fields.map((field) => this.toFieldDefinition(field)),
      nextCycle: cycle,
      existingOrders: orders.map((order) => this.toSummary(order)),
    };
  }

  async createBusinessCardOrder(
    user: RequestUser,
    input: { quantity: number; values: Record<string, string>; reorderOf?: string },
  ): Promise<OrderSummary> {
    const definitions = await this.prisma.businessCardFieldDefinition.findMany({ where: { isActive: true } });

    // Serverseitige Validierung - die Prüfung im Formular ist nur Komfort.
    const missing = definitions
      .filter((field) => field.isRequired)
      .filter((field) => !String(input.values[field.key] ?? "").trim())
      .map((field) => field.label);
    if (missing.length) {
      throw new BadRequestException(`Pflichtfelder fehlen: ${missing.join(", ")}`);
    }
    if (!Number.isInteger(input.quantity) || input.quantity < 50 || input.quantity > 5000) {
      throw new BadRequestException("Die Auflage muss zwischen 50 und 5000 Stück liegen.");
    }

    const unknown = Object.keys(input.values).filter(
      (key) => !definitions.some((definition) => definition.key === key),
    );
    if (unknown.length) {
      throw new BadRequestException(`Unbekannte Felder: ${unknown.join(", ")}`);
    }

    const cycle = await this.nextCycle("business_cards");
    const orderNumber = await this.nextOrderNumber("business_card");

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        type: "business_card",
        requesterId: user.id,
        status: "submitted",
        submittedAt: new Date(),
        orderCycleId: cycle?.id ?? null,
        statusHistory: {
          create: { status: "submitted", note: "Bestellung eingereicht", actorName: user.displayName },
        },
        businessCardOrder: {
          create: {
            quantity: input.quantity,
            reorderFromId: input.reorderOf ?? null,
            fields: {
              create: definitions
                .filter((definition) => input.values[definition.key] !== undefined)
                .map((definition) => ({
                  fieldDefinitionId: definition.id,
                  value: String(input.values[definition.key] ?? ""),
                })),
            },
          },
        },
      },
      include: orderInclude,
    });

    await this.afterSubmit(user, order);
    return this.toSummary(order);
  }

  /* ---------------------------------------------------- Arbeitskleidung */

  async workwearCatalog(user: RequestUser) {
    const [items, cycle, orders] = await Promise.all([
      this.prisma.workwearCatalogItem.findMany({
        where: { isActive: true },
        include: { sizes: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      this.nextCycle("workwear"),
      this.prisma.order.findMany({
        where: { requesterId: user.id, type: "workwear" },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      catalog: items.map((item): WorkwearCatalogItem => ({
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        sizes: item.sizes.map((size) => size.sizeLabel),
        active: item.isActive,
      })),
      nextCycle: cycle,
      existingOrders: orders.map((order) => this.toSummary(order)),
    };
  }

  async createWorkwearOrder(
    user: RequestUser,
    input: { items: { catalogItemId: string; size: string; quantity: number }[] },
  ): Promise<OrderSummary> {
    const positions = input.items.filter((item) => item.quantity > 0);
    if (positions.length === 0) {
      throw new BadRequestException("Bitte wählen Sie mindestens einen Artikel mit Menge aus.");
    }

    const catalogItems = await this.prisma.workwearCatalogItem.findMany({
      where: { id: { in: positions.map((item) => item.catalogItemId) }, isActive: true },
      include: { sizes: { where: { isActive: true } } },
    });

    for (const position of positions) {
      const catalogItem = catalogItems.find((item) => item.id === position.catalogItemId);
      if (!catalogItem) {
        throw new BadRequestException("Ein gewählter Artikel ist nicht mehr verfügbar.");
      }
      if (!catalogItem.sizes.some((size) => size.sizeLabel === position.size)) {
        throw new BadRequestException(`Größe "${position.size}" ist für ${catalogItem.name} nicht verfügbar.`);
      }
      if (!Number.isInteger(position.quantity) || position.quantity > 20) {
        throw new BadRequestException("Pro Position sind maximal 20 Stück möglich.");
      }
    }

    const cycle = await this.nextCycle("workwear");
    const orderNumber = await this.nextOrderNumber("workwear");

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        type: "workwear",
        requesterId: user.id,
        status: "submitted",
        submittedAt: new Date(),
        orderCycleId: cycle?.id ?? null,
        statusHistory: {
          create: { status: "submitted", note: "Bestellung eingereicht", actorName: user.displayName },
        },
        workwearOrder: {
          create: {
            items: {
              create: positions.map((position) => ({
                catalogItemId: position.catalogItemId,
                sizeLabel: position.size,
                quantity: position.quantity,
              })),
            },
          },
        },
      },
      include: orderInclude,
    });

    await this.afterSubmit(user, order);
    return this.toSummary(order);
  }

  /* -------------------------------------------------------- Kommentare */

  async addComment(user: RequestUser, orderId: string, message: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, requesterId: true, orderNumber: true },
    });
    if (!order) {
      throw new NotFoundException("Bestellung nicht gefunden");
    }
    if (order.requesterId !== user.id && !isManaging(user)) {
      throw new ForbiddenException("Kein Zugriff auf diese Bestellung.");
    }

    await this.prisma.orderComment.create({ data: { orderId, authorId: user.id, message } });

    if (order.requesterId !== user.id) {
      await this.notifications.notify({
        userIds: [order.requesterId],
        title: `Rückfrage zu ${order.orderNumber}`,
        detail: message.slice(0, 160),
        link: `/bestellungen/${orderId}`,
      });
    }

    return this.detail(user, orderId);
  }

  /* ---------------------------------------------------------- Freigaben */

  async approvals(user: RequestUser, filter: { status?: string; search?: string } = {}): Promise<ApprovalTask[]> {
    if (!isManaging(user)) {
      throw new ForbiddenException("Freigaben sind Fachbereichs- und Administrationsrollen vorbehalten.");
    }

    const orders = await this.prisma.order.findMany({
      where: {
        status:
          filter.status && filter.status !== "all"
            ? (filter.status as OrderStatus)
            : { in: ["submitted", "approved", "queued_for_bulk_order"] },
        ...(filter.search
          ? {
              OR: [
                { orderNumber: { contains: filter.search, mode: "insensitive" } },
                { requester: { firstName: { contains: filter.search, mode: "insensitive" } } },
                { requester: { lastName: { contains: filter.search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: "asc" },
    });

    return orders.map((order) => ({
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderType: order.type,
      requester: displayName(order.requester),
      scope: scopeLabel(order.requester),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      summary: this.summaryText(order),
      nextAction: this.nextAction(order.status),
    }));
  }

  /**
   * Führt einen Statuswechsel aus. Zulässige Übergänge stehen in
   * `ALLOWED_TRANSITIONS`; alles andere wird abgewiesen, damit der
   * Freigabeprozess nicht über die API umgangen werden kann.
   */
  async transition(
    user: RequestUser,
    orderId: string,
    target: OrderStatus,
    note?: string,
    /** Rechnungsdaten des Dienstleisters, erfassbar beim Abschließen. */
    invoice?: { netAmount?: number; supplierInvoice?: string },
  ): Promise<OrderSummary> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) {
      throw new NotFoundException("Bestellung nicht gefunden");
    }

    const selfCancel = target === "cancelled" && order.requesterId === user.id;
    if (!isManaging(user) && !selfCancel) {
      throw new ForbiddenException("Für diese Aktion fehlen die erforderlichen Rechte.");
    }
    if (!ALLOWED_TRANSITIONS[order.status].includes(target)) {
      throw new BadRequestException(
        `Übergang von "${STATUS_LABELS[order.status]}" nach "${STATUS_LABELS[target]}" ist nicht zulässig.`,
      );
    }

    const now = new Date();
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: target,
        ...(target === "approved" ? { approvedAt: now } : {}),
        ...(target === "rejected" ? { rejectedAt: now } : {}),
        ...(target === "ordered" ? { orderedAt: now } : {}),
        ...(target === "completed" ? { completedAt: now } : {}),
        ...(invoice?.netAmount !== undefined ? { netAmount: invoice.netAmount } : {}),
        ...(invoice?.supplierInvoice !== undefined ? { supplierInvoice: invoice.supplierInvoice } : {}),
        statusHistory: {
          create: { status: target, note: note ?? STATUS_LABELS[target], actorName: user.displayName },
        },
        ...(target === "approved" || target === "rejected"
          ? {
              approvalDecisions: {
                create: {
                  actorId: user.id,
                  decision: target === "approved" ? "approved" : "rejected",
                  note: note ?? null,
                },
              },
            }
          : {}),
      },
      include: orderInclude,
    });

    await this.audit.log({
      actor: user,
      action: `order.${target}`,
      entityType: "order",
      entityId: orderId,
      detail: `${updated.orderNumber}: ${STATUS_LABELS[target]}${note ? ` (${note})` : ""}`,
    });

    await this.notifications.notify({
      userIds: [order.requesterId],
      title: `Bestellung ${updated.orderNumber}: ${STATUS_LABELS[target]}`,
      detail: note ?? this.nextAction(target),
      link: `/bestellungen/${orderId}`,
    });

    return this.toSummary(updated);
  }

  /** Alle genehmigten Bestellungen eines Typs gesammelt als extern bestellt markieren. */
  async bulkOrder(user: RequestUser, type: OrderType): Promise<{ count: number }> {
    const orders = await this.prisma.order.findMany({
      where: { type, status: { in: ["approved", "queued_for_bulk_order"] } },
      select: { id: true, orderNumber: true, requesterId: true },
    });
    if (orders.length === 0) {
      return { count: 0 };
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.order.updateMany({
        where: { id: { in: orders.map((order) => order.id) } },
        data: { status: "ordered", orderedAt: now },
      }),
      this.prisma.orderStatusHistory.createMany({
        data: orders.map((order) => ({
          orderId: order.id,
          status: "ordered" as OrderStatus,
          note: "Sammelbestellung an externen Dienstleister übergeben",
          actorName: user.displayName,
        })),
      }),
    ]);

    await this.audit.log({
      actor: user,
      action: "order.bulk_ordered",
      entityType: "order",
      entityId: type,
      detail: `${orders.length} Bestellungen als Sammelbestellung übergeben`,
    });

    await this.notifications.notify({
      userIds: orders.map((order) => order.requesterId),
      title: "Sammelbestellung ausgelöst",
      detail: "Ihre Bestellung wurde an den externen Dienstleister übergeben.",
      link: "/bestellungen/meine",
    });

    return { count: orders.length };
  }

  /* ------------------------------------------------------ Bestelltermine */

  async cycles(): Promise<OrderCycleInfo[]> {
    const cycles = await this.prisma.orderCycle.findMany({
      include: { location: { select: { name: true } } },
      orderBy: { nextOrderDate: "asc" },
    });
    return cycles.map((cycle) => this.toCycle(cycle));
  }

  async upsertCycle(
    user: RequestUser,
    input: {
      id?: string;
      cycleType: "business_cards" | "workwear";
      title: string;
      nextOrderDate: string;
      notes?: string;
    },
  ): Promise<OrderCycleInfo[]> {
    const data = {
      cycleType: input.cycleType,
      title: input.title,
      nextOrderDate: new Date(input.nextOrderDate),
      notes: input.notes ?? null,
    };

    const cycle = input.id
      ? await this.prisma.orderCycle.update({ where: { id: input.id }, data })
      : await this.prisma.orderCycle.create({ data });

    await this.audit.log({
      actor: user,
      action: input.id ? "order_cycle.update" : "order_cycle.create",
      entityType: "order_cycle",
      entityId: cycle.id,
      detail: `Bestelltermin "${cycle.title}" auf ${cycle.nextOrderDate.toISOString().slice(0, 10)} gesetzt`,
    });

    return this.cycles();
  }

  async removeCycle(user: RequestUser, id: string): Promise<OrderCycleInfo[]> {
    const cycle = await this.prisma.orderCycle.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "order_cycle.delete",
      entityType: "order_cycle",
      entityId: id,
      detail: `Bestelltermin "${cycle.title}" gelöscht`,
    });
    return this.cycles();
  }

  /* ------------------------------------------------------------ Kataloge */

  async fieldDefinitions(): Promise<BusinessCardFieldDefinition[]> {
    const fields = await this.prisma.businessCardFieldDefinition.findMany({ orderBy: { sortOrder: "asc" } });
    return fields.map((field) => this.toFieldDefinition(field));
  }

  async upsertFieldDefinition(
    user: RequestUser,
    input: {
      id?: string;
      key: string;
      label: string;
      fieldType: string;
      sortOrder: number;
      isRequired: boolean;
      isActive: boolean;
      options: string[];
      helpText?: string;
    },
  ): Promise<BusinessCardFieldDefinition[]> {
    const data = {
      key: input.key,
      label: input.label,
      fieldType: input.fieldType,
      sortOrder: input.sortOrder,
      isRequired: input.isRequired,
      isActive: input.isActive,
      options: input.options,
      helpText: input.helpText ?? null,
    };

    const field = input.id
      ? await this.prisma.businessCardFieldDefinition.update({ where: { id: input.id }, data })
      : await this.prisma.businessCardFieldDefinition.create({ data });

    await this.audit.log({
      actor: user,
      action: input.id ? "bc_field.update" : "bc_field.create",
      entityType: "business_card_field",
      entityId: field.id,
      detail: `Formularfeld "${field.label}" gespeichert`,
    });

    return this.fieldDefinitions();
  }

  async catalog(): Promise<WorkwearCatalogItem[]> {
    const items = await this.prisma.workwearCatalogItem.findMany({
      include: { sizes: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      sizes: item.sizes.map((size) => size.sizeLabel),
      active: item.isActive,
    }));
  }

  async upsertCatalogItem(
    user: RequestUser,
    input: { id?: string; name: string; category: string; description?: string; sizes: string[]; isActive: boolean },
  ): Promise<WorkwearCatalogItem[]> {
    const item = input.id
      ? await this.prisma.workwearCatalogItem.update({
          where: { id: input.id },
          data: {
            name: input.name,
            category: input.category,
            description: input.description ?? null,
            isActive: input.isActive,
          },
        })
      : await this.prisma.workwearCatalogItem.create({
          data: {
            name: input.name,
            category: input.category,
            description: input.description ?? null,
            isActive: input.isActive,
          },
        });

    // Größen abgleichen: fehlende anlegen, entfernte deaktivieren (nie löschen,
    // sonst brechen historische Bestellpositionen weg).
    const existing = await this.prisma.workwearItemSize.findMany({ where: { catalogItemId: item.id } });
    const wanted = new Set(input.sizes);

    await this.prisma.$transaction([
      ...input.sizes.map((sizeLabel, index) =>
        this.prisma.workwearItemSize.upsert({
          where: { catalogItemId_sizeLabel: { catalogItemId: item.id, sizeLabel } },
          update: { sortOrder: index, isActive: true },
          create: { catalogItemId: item.id, sizeLabel, sortOrder: index, isActive: true },
        }),
      ),
      ...existing
        .filter((size) => !wanted.has(size.sizeLabel))
        .map((size) => this.prisma.workwearItemSize.update({ where: { id: size.id }, data: { isActive: false } })),
    ]);

    await this.audit.log({
      actor: user,
      action: input.id ? "catalog.update" : "catalog.create",
      entityType: "workwear_item",
      entityId: item.id,
      detail: `Katalogartikel "${item.name}" gespeichert`,
    });

    return this.catalog();
  }

  /* ------------------------------------------------------------ Helfer */

  private async afterSubmit(user: RequestUser, order: OrderWithRelations) {
    await this.audit.log({
      actor: user,
      action: "order.create",
      entityType: "order",
      entityId: order.id,
      detail: `${order.orderNumber} eingereicht: ${this.summaryText(order)}`,
    });

    const approvers = await this.notifications.userIdsWithRole("fachbereichsadmin");
    const admins = await this.notifications.userIdsWithRole("admin");
    await this.notifications.notify({
      userIds: [...approvers, ...admins],
      title: `Neue Freigabe: ${order.orderNumber}`,
      detail: `${displayName(order.requester)} · ${this.summaryText(order)}`,
      link: "/freigaben",
    });
  }

  /**
   * Erzeugt die nächste Vorgangsnummer. Bei parallelen Einreichungen kann die
   * Zählung kollidieren - die Unique-Constraint fängt das ab, wir zählen hoch.
   */
  private async nextOrderNumber(type: OrderType): Promise<string> {
    const prefix = type === "business_card" ? "BC" : "WW";
    let sequence = (await this.prisma.order.count({ where: { type } })) + 1;

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = buildNumber(prefix, sequence);
      const taken = await this.prisma.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } });
      if (!taken) {
        return candidate;
      }
      sequence += 1;
    }
    return `${prefix}-${Date.now()}`;
  }

  private async nextCycle(cycleType: "business_cards" | "workwear"): Promise<OrderCycleInfo | null> {
    const cycle = await this.prisma.orderCycle.findFirst({
      where: { cycleType, nextOrderDate: { gte: new Date() } },
      include: { location: { select: { name: true } } },
      orderBy: { nextOrderDate: "asc" },
    });
    return cycle ? this.toCycle(cycle) : null;
  }

  private toCycle(
    cycle: Prisma.OrderCycleGetPayload<{ include: { location: { select: { name: true } } } }>,
  ): OrderCycleInfo {
    return {
      id: cycle.id,
      type: cycle.cycleType,
      label: cycle.title,
      nextOrderDate: cycle.nextOrderDate.toISOString(),
      notes: cycle.notes,
      scope: cycle.location?.name ?? "Alle Standorte",
    };
  }

  private toFieldDefinition(field: {
    id: string;
    key: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    isActive: boolean;
    sortOrder: number;
    options: string[];
    helpText: string | null;
  }): BusinessCardFieldDefinition {
    return {
      id: field.id,
      key: field.key,
      label: field.label,
      type: field.fieldType as BusinessCardFieldDefinition["type"],
      required: field.isRequired,
      active: field.isActive,
      sortOrder: field.sortOrder,
      options: field.options,
      helpText: field.helpText,
    };
  }

  private summaryText(order: OrderWithRelations): string {
    if (order.type === "business_card") {
      return `Visitenkarten, Auflage ${order.businessCardOrder?.quantity ?? 0}`;
    }
    const items = order.workwearOrder?.items ?? [];
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    return `Arbeitskleidung, ${items.length} Position(en) / ${total} Stück`;
  }

  private nextAction(status: OrderStatus): string {
    switch (status) {
      case "submitted":
        return "Freigabe durch Fachbereich ausstehend";
      case "approved":
        return "Für die nächste Sammelbestellung vormerken";
      case "queued_for_bulk_order":
        return "Sammelbestellung an Dienstleister übergeben";
      case "ordered":
        return "Auf Lieferung warten, danach abschließen";
      case "completed":
        return "Abgeschlossen";
      case "rejected":
        return "Abgelehnt";
      case "cancelled":
        return "Storniert";
      default:
        return "Bestellung vervollständigen und einreichen";
    }
  }

  private toSummary(order: OrderWithRelations): OrderSummary {
    const items = order.workwearOrder?.items ?? [];
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      employee: displayName(order.requester),
      employeeUsername: order.requester.username,
      scope: scopeLabel(order.requester),
      createdAt: order.createdAt.toISOString(),
      submittedAt: toIso(order.submittedAt),
      nextCycle: toIso(order.orderCycle?.nextOrderDate),
      itemCount: order.type === "business_card" ? (order.businessCardOrder?.quantity ?? 0) : items.length,
      summary: this.summaryText(order),
    };
  }

  private toDetail(order: OrderWithRelations): BusinessCardOrderDetail | WorkwearOrderDetail {
    const base = this.toSummary(order);
    const timeline: TimelineEntry[] = order.statusHistory.map((entry) => ({
      timestamp: entry.changedAt.toISOString(),
      title: STATUS_LABELS[entry.status],
      detail: entry.note ?? "",
      actor: entry.actorName,
    }));
    const comments = order.comments.map((comment) => ({
      id: comment.id,
      author: displayName(comment.author),
      message: comment.message,
      createdAt: comment.createdAt.toISOString(),
    }));

    if (order.type === "business_card") {
      return {
        ...base,
        requestedQuantity: order.businessCardOrder?.quantity ?? 0,
        fields: (order.businessCardOrder?.fields ?? []).map((field) => ({
          key: field.fieldDefinition.key,
          label: field.fieldDefinition.label,
          value: field.value,
        })),
        timeline,
        comments,
      };
    }

    return {
      ...base,
      items: (order.workwearOrder?.items ?? []).map((item) => ({
        catalogItemId: item.catalogItemId,
        itemName: item.catalogItem.name,
        size: item.sizeLabel,
        quantity: item.quantity,
      })),
      timeline,
      comments,
    };
  }
}

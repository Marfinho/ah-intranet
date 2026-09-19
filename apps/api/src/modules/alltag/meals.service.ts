import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { MealOfferItem, MealRoundup } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { displayName, toIso } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";
import { stichtagVorbei } from "./regeln";

const offerInclude = {
  location: { select: { name: true } },
  options: { orderBy: { name: "asc" as const }, include: { _count: { select: { orders: true } } } },
} as const;

export interface MealOfferInput {
  date: string;
  provider: string;
  orderDeadline: string;
  locationId?: string | null;
  note?: string | null;
  options: { name: string; description?: string | null; priceCents: number }[];
}

/**
 * Essensbestellung.
 *
 * Der Stichtag ist der ganze Punkt: wer nach der Abholfahrt bestellt, bekommt
 * nichts, und die Sammelliste muss sich darauf verlassen können. Deshalb wird
 * er serverseitig geprüft und nicht nur angezeigt.
 */
@Injectable()
export class MealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: RequestUser, filter: { from?: string } = {}): Promise<MealOfferItem[]> {
    const ab = filter.from ? new Date(filter.from) : this.tagesbeginn(new Date());

    const offers = await this.prisma.mealOffer.findMany({
      where: { date: { gte: ab } },
      include: offerInclude,
      orderBy: { date: "asc" },
    });

    const eigene = await this.prisma.mealOrder.findMany({
      where: { userId: user.id, offerId: { in: offers.map((offer) => offer.id) } },
    });

    return offers.map((offer) => {
      const meine = eigene.find((order) => order.offerId === offer.id);
      return {
        id: offer.id,
        date: toIso(offer.date)!,
        provider: offer.provider,
        orderDeadline: toIso(offer.orderDeadline)!,
        location: offer.location?.name ?? null,
        note: offer.note,
        options: offer.options.map((option) => ({
          id: option.id,
          name: option.name,
          description: option.description,
          priceCents: option.priceCents,
          count: option._count.orders,
        })),
        closed: stichtagVorbei(offer.orderDeadline),
        myOrder: meine ? { id: meine.id, optionId: meine.optionId, quantity: meine.quantity, note: meine.note } : null,
      };
    });
  }

  async createOffer(user: RequestUser, input: MealOfferInput): Promise<MealOfferItem[]> {
    if (input.options.length === 0) {
      throw new BadRequestException("Ein Angebot ohne Wahlmöglichkeit ist keines.");
    }
    const deadline = new Date(input.orderDeadline);
    const datum = new Date(input.date);
    if (Number.isNaN(deadline.getTime()) || Number.isNaN(datum.getTime())) {
      throw new BadRequestException("Datum und Stichtag müssen gültige Zeitpunkte sein.");
    }
    if (deadline > this.tagesende(datum)) {
      throw new BadRequestException("Der Stichtag muss spätestens am Tag des Angebots liegen.");
    }
    if (input.options.some((option) => option.priceCents < 0)) {
      throw new BadRequestException("Ein negativer Preis ist keine Wahlmöglichkeit.");
    }

    const offer = await this.prisma.mealOffer.create({
      data: {
        date: this.tagesbeginn(datum),
        provider: input.provider.trim(),
        orderDeadline: deadline,
        locationId: input.locationId || null,
        note: input.note?.trim() || null,
        createdById: user.id,
        options: {
          create: input.options.map((option) => ({
            name: option.name.trim(),
            description: option.description?.trim() || null,
            priceCents: Math.round(option.priceCents),
          })),
        },
      },
    });

    await this.audit.log({
      actor: user,
      action: "meal_offer.created",
      entityType: "meal_offer",
      entityId: offer.id,
      detail: `Angebot von ${offer.provider} für den ${this.datum(offer.date)} mit ${input.options.length} Wahlmöglichkeiten`,
    });

    return this.list(user);
  }

  async removeOffer(user: RequestUser, id: string): Promise<MealOfferItem[]> {
    const offer = await this.prisma.mealOffer.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!offer) {
      throw new NotFoundException("Angebot nicht gefunden");
    }
    if (offer._count.orders > 0) {
      throw new BadRequestException(
        `Für dieses Angebot liegen ${offer._count.orders} Bestellungen vor. Löschen würde sie stillschweigend mitnehmen.`,
      );
    }

    await this.prisma.mealOffer.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "meal_offer.deleted",
      entityType: "meal_offer",
      entityId: id,
      detail: `Angebot von ${offer.provider} für den ${this.datum(offer.date)} entfernt`,
    });

    return this.list(user);
  }

  /** Eine Bestellung je Person und Angebot - eine zweite ändert die erste. */
  async order(
    user: RequestUser,
    offerId: string,
    input: { optionId: string; quantity?: number; note?: string | null },
  ): Promise<MealOfferItem[]> {
    const offer = await this.prisma.mealOffer.findUnique({ where: { id: offerId }, include: { options: true } });
    if (!offer) {
      throw new NotFoundException("Angebot nicht gefunden");
    }
    if (stichtagVorbei(offer.orderDeadline)) {
      throw new BadRequestException(
        `Der Stichtag war am ${this.zeitpunkt(offer.orderDeadline)}. Die Sammelbestellung ist raus.`,
      );
    }
    if (!offer.options.some((option) => option.id === input.optionId)) {
      throw new BadRequestException("Diese Wahlmöglichkeit gehört nicht zu diesem Angebot.");
    }
    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new BadRequestException("Die Menge muss zwischen 1 und 10 liegen.");
    }

    const vorhanden = await this.prisma.mealOrder.findFirst({ where: { offerId, userId: user.id } });
    if (vorhanden) {
      await this.prisma.mealOrder.update({
        where: { id: vorhanden.id },
        data: { optionId: input.optionId, quantity, note: input.note?.trim() || null },
      });
    } else {
      await this.prisma.mealOrder.create({
        data: { offerId, optionId: input.optionId, userId: user.id, quantity, note: input.note?.trim() || null },
      });
    }

    return this.list(user);
  }

  async cancel(user: RequestUser, offerId: string): Promise<MealOfferItem[]> {
    const offer = await this.prisma.mealOffer.findUnique({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException("Angebot nicht gefunden");
    }
    if (stichtagVorbei(offer.orderDeadline)) {
      throw new BadRequestException("Nach dem Stichtag lässt sich nicht mehr abbestellen - das Essen ist geordert.");
    }
    await this.prisma.mealOrder.deleteMany({ where: { offerId, userId: user.id } });
    return this.list(user);
  }

  /**
   * Sammelliste für die Abholung.
   *
   * Mit Namen, weil jemand die Tüten verteilen muss - deshalb hängt sie am
   * Recht und steht nicht jedem offen.
   */
  async roundup(offerId: string): Promise<MealRoundup> {
    const offer = await this.prisma.mealOffer.findUnique({
      where: { id: offerId },
      include: {
        location: { select: { name: true } },
        options: { orderBy: { name: "asc" } },
        orders: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!offer) {
      throw new NotFoundException("Angebot nicht gefunden");
    }

    const lines = offer.options.map((option) => {
      const dazu = offer.orders.filter((order) => order.optionId === option.id);
      return {
        option: option.name,
        priceCents: option.priceCents,
        quantity: dazu.reduce((summe, order) => summe + order.quantity, 0),
        people: dazu.map((order) => displayName(order.user)).sort((a, b) => a.localeCompare(b, "de")),
      };
    });

    return {
      offer: {
        id: offer.id,
        date: toIso(offer.date)!,
        provider: offer.provider,
        orderDeadline: toIso(offer.orderDeadline)!,
        location: offer.location?.name ?? null,
      },
      lines: lines.filter((line) => line.quantity > 0),
      totalCents: lines.reduce((summe, line) => summe + line.quantity * line.priceCents, 0),
    };
  }

  /* ------------------------------------------------------------- Helfer */

  private datum(wert: Date): string {
    return wert.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  private zeitpunkt(wert: Date): string {
    return `${this.datum(wert)}, ${wert.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
  }

  private tagesbeginn(wert: Date): Date {
    const kopie = new Date(wert);
    kopie.setHours(0, 0, 0, 0);
    return kopie;
  }

  private tagesende(wert: Date): Date {
    const kopie = new Date(wert);
    kopie.setHours(23, 59, 59, 999);
    return kopie;
  }
}

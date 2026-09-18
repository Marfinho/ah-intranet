import { Injectable } from "@nestjs/common";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../../../core/prisma.service";
import {
  ConnectorError,
  requireFields,
  type CheckResult,
  type ConnectorAdapter,
  type ConnectorContext,
  type SyncResult,
} from "../adapter";

/**
 * Bestandsübernahme aus einem DMS über einen Dateiexport.
 *
 * Das ist im deutschen Autohaus-Umfeld der einzige Weg, der ohne Vertrag mit
 * dem DMS-Anbieter funktioniert: praktisch jedes System kann einen Bestands-
 * export als CSV in ein Verzeichnis schreiben.
 *
 * Die Spaltennamen unterscheiden sich je DMS erheblich, deshalb werden sie
 * über Synonyme erkannt statt fest verdrahtet.
 */
@Injectable()
export class DmsFileAdapter implements ConnectorAdapter {
  readonly key = "dms_file_exchange";

  /** Erkennungsmuster je Zielfeld, in absteigender Priorität. */
  private static readonly COLUMNS: Record<string, string[]> = {
    externalId: ["fahrzeugnummer", "fzgnr", "bestandsnummer", "interne_nummer", "id", "nummer"],
    vin: ["fahrgestellnummer", "fin", "vin", "fgstnr"],
    make: ["marke", "hersteller", "make", "fabrikat"],
    model: ["modell", "model", "typ", "handelsbezeichnung"],
    title: ["bezeichnung", "titel", "beschreibung", "modellbezeichnung"],
    price: ["preis", "verkaufspreis", "vk", "vkpreis", "endpreis", "bruttopreis"],
    mileageKm: ["kilometerstand", "km", "laufleistung", "kmstand"],
    firstRegistration: ["erstzulassung", "ez", "zulassung", "erstzulassungsdatum"],
    fuel: ["kraftstoff", "treibstoff", "fuel", "kraftstoffart"],
    gearbox: ["getriebe", "getriebeart", "schaltung"],
    powerKw: ["leistung", "kw", "leistung_kw", "motorleistung"],
  };

  constructor(private readonly prisma: PrismaService) {}

  async check(context: ConnectorContext): Promise<CheckResult> {
    requireFields(context, ["directory"]);

    const file = await this.findFile(context);
    const info = await stat(file);
    const { rows, headerIssues } = await this.parse(context, file);

    const message = `Datei ${file} gelesen (${Math.round(info.size / 1024)} kB, ${rows.length} Datensätze).`;
    return headerIssues.length > 0
      ? { ok: false, message: `${message} Nicht zuordenbare Pflichtspalten: ${headerIssues.join(", ")}.` }
      : { ok: true, message };
  }

  async run(capability: string, context: ConnectorContext): Promise<SyncResult> {
    if (capability !== "vehicles.import") {
      throw new ConnectorError(`Unbekannte Fähigkeit "${capability}" für den DMS-Dateiaustausch.`);
    }

    requireFields(context, ["directory"]);
    const file = await this.findFile(context);
    const { rows, headerIssues } = await this.parse(context, file);

    if (headerIssues.length > 0) {
      throw new ConnectorError(
        `Die Datei enthält keine erkennbaren Spalten für: ${headerIssues.join(", ")}. Bitte Exportvorlage im DMS anpassen.`,
      );
    }

    const seen: string[] = [];
    let failed = 0;

    for (const row of rows) {
      try {
        const externalId = row.externalId;
        if (!externalId || !row.make) {
          failed += 1;
          continue;
        }

        const data = {
          externalId,
          vin: row.vin ?? null,
          make: row.make,
          model: row.model ?? "",
          title: row.title || [row.make, row.model].filter(Boolean).join(" "),
          price: row.price ?? null,
          currency: "EUR",
          mileageKm: row.mileageKm ?? null,
          firstRegistration: row.firstRegistration ?? null,
          fuel: row.fuel ?? null,
          gearbox: row.gearbox ?? null,
          powerKw: row.powerKw ?? null,
          url: null,
          imageUrl: null,
          raw: row.raw as never,
        };

        await this.prisma.vehicleListing.upsert({
          where: { connectorKey_externalId: { connectorKey: this.key, externalId } },
          update: { ...data, connectorKey: this.key, syncedAt: new Date() },
          create: { ...data, connectorKey: this.key },
        });
        seen.push(externalId);
      } catch {
        failed += 1;
      }
    }

    const removed = await this.prisma.vehicleListing.deleteMany({
      where: { connectorKey: this.key, externalId: { notIn: seen.length > 0 ? seen : ["__keine__"] } },
    });

    return {
      itemsProcessed: seen.length,
      itemsFailed: failed,
      message: `${seen.length} Fahrzeug(e) aus ${file} übernommen, ${removed.count} entfernt${failed > 0 ? `, ${failed} fehlerhaft` : ""}.`,
      detail: { file, removed: removed.count },
    };
  }

  /* --------------------------------------------------------- Dateien */

  private async findFile(context: ConnectorContext): Promise<string> {
    const directory = context.settings.directory.trim();
    const pattern = context.settings.filePattern?.trim() || "*.csv";

    let entries: string[];
    try {
      entries = await readdir(directory);
    } catch {
      throw new ConnectorError(`Verzeichnis "${directory}" ist nicht lesbar.`);
    }

    const matcher = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i");
    const candidates = entries.filter((entry) => matcher.test(entry));
    if (candidates.length === 0) {
      throw new ConnectorError(`Keine Datei in "${directory}" passt auf das Muster "${pattern}".`);
    }

    // Bei mehreren Exporten gewinnt der jüngste.
    const withTimes = await Promise.all(
      candidates.map(async (entry) => {
        const path = join(directory, entry);
        return { path, mtime: (await stat(path)).mtimeMs };
      }),
    );
    withTimes.sort((a, b) => b.mtime - a.mtime);
    return withTimes[0].path;
  }

  private async parse(context: ConnectorContext, file: string) {
    const encoding = (context.settings.encoding?.trim() || "latin1") as BufferEncoding;
    const delimiter = context.settings.delimiter?.trim() || ";";

    const raw = await readFile(file);
    const text = raw.toString(encoding).replace(/^﻿/, "");
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new ConnectorError(`Die Datei ${file} enthält keine Datenzeilen.`);
    }

    const header = this.splitLine(lines[0], delimiter).map((cell) => this.normalise(cell));
    const index = this.mapColumns(header);

    const headerIssues = ["externalId", "make"].filter((field) => index[field] === undefined);

    const rows = lines.slice(1).map((line) => {
      const cells = this.splitLine(line, delimiter);
      const pick = (field: string) => {
        const position = index[field];
        return position === undefined ? undefined : cells[position]?.trim();
      };

      return {
        externalId: pick("externalId") || pick("vin"),
        vin: pick("vin"),
        make: pick("make"),
        model: pick("model"),
        title: pick("title") ?? "",
        price: this.number(pick("price")),
        mileageKm: this.integer(pick("mileageKm")),
        firstRegistration: this.date(pick("firstRegistration")),
        fuel: pick("fuel"),
        gearbox: pick("gearbox"),
        powerKw: this.integer(pick("powerKw")),
        raw: Object.fromEntries(header.map((name, position) => [name, cells[position] ?? ""])),
      };
    });

    return { rows, headerIssues };
  }

  /** CSV mit Anführungszeichen und verdoppelten Anführungszeichen im Feld. */
  private splitLine(line: string, delimiter: string): string[] {
    const cells: string[] = [];
    let current = "";
    let quoted = false;

    for (let position = 0; position < line.length; position += 1) {
      const character = line[position];

      if (quoted) {
        if (character === '"') {
          if (line[position + 1] === '"') {
            current += '"';
            position += 1;
          } else {
            quoted = false;
          }
        } else {
          current += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === delimiter) {
        cells.push(current);
        current = "";
      } else {
        current += character;
      }
    }
    cells.push(current);
    return cells;
  }

  private normalise(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/"/g, "")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/(^_|_$)/g, "");
  }

  private mapColumns(header: string[]): Record<string, number> {
    const index: Record<string, number> = {};

    for (const [field, synonyms] of Object.entries(DmsFileAdapter.COLUMNS)) {
      for (const synonym of synonyms) {
        const position = header.indexOf(synonym);
        if (position !== -1) {
          index[field] = position;
          break;
        }
      }
    }
    return index;
  }

  private number(value: string | undefined): number | undefined {
    if (!value) return undefined;
    // Deutsche Schreibweise: 12.345,67
    const parsed = Number(value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private integer(value: string | undefined): number | undefined {
    const parsed = this.number(value);
    return parsed === undefined ? undefined : Math.round(parsed);
  }

  /** Akzeptiert TT.MM.JJJJ, JJJJ-MM-TT und MM/JJJJ. */
  private date(value: string | undefined): Date | undefined {
    if (!value) return undefined;

    const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
    if (german) {
      return new Date(Date.UTC(Number(german[3]), Number(german[2]) - 1, Number(german[1])));
    }

    const iso = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(value);
    if (iso) {
      return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3] ?? 1)));
    }

    const monthYear = /^(\d{1,2})\/(\d{4})$/.exec(value);
    if (monthYear) {
      return new Date(Date.UTC(Number(monthYear[2]), Number(monthYear[1]) - 1, 1));
    }

    return undefined;
  }
}

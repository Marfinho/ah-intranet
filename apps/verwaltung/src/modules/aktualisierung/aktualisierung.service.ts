import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { DatenbankService } from "../../core/datenbank";
import type { Sitzung } from "../../core/decorators";
import { ProtokollService } from "../../core/protokoll.service";
import { GithubService } from "./github.service";
import { SHA_MUSTER, aktualisiererLebt, auswirkungen, bewerteAnforderung, kurz, zuBauen } from "./regeln";

const AKTIV = ["angefordert", "laeuft"] as const;

@Injectable()
export class AktualisierungService {
  constructor(
    private readonly db: DatenbankService,
    private readonly github: GithubService,
    private readonly protokoll: ProtokollService,
  ) {}

  /** Alles, was die Seite braucht: installierter Stand, Kopf von main, Änderungen, Prüfung, Aufträge. */
  async uebersicht() {
    const [status, aktiv, verlauf] = await Promise.all([
      this.db.aktualisiererStatus.findUnique({ where: { id: 1 } }),
      this.db.aktualisierung.findFirst({ where: { status: { in: [...AKTIV] } }, orderBy: { angefordertAm: "desc" } }),
      this.db.aktualisierung.findMany({ orderBy: { angefordertAm: "desc" }, take: 10, omit: { protokoll: true } }),
    ]);
    const installiert = status?.installierteSha ?? null;
    const lebt = aktualisiererLebt(status?.zuletztGesehen ?? null);

    // GitHub kann ausfallen oder begrenzen; die Seite zeigt dann Aufträge und Zustand weiter.
    let github: { fehler: string } | { kopf: Awaited<ReturnType<GithubService["kopf"]>> };
    try {
      github = { kopf: await this.github.kopf() };
    } catch (fehler) {
      github = { fehler: (fehler as Error).message };
    }

    const basis = {
      repo: this.github.repo,
      zweig: this.github.zweig,
      aktualisierer: {
        lebt,
        zuletztGesehen: status?.zuletztGesehen ?? null,
        skriptVersion: status?.skriptVersion ?? null,
      },
      installiert: installiert
        ? { sha: installiert, kurz: kurz(installiert), commit: await this.github.commitZu(installiert) }
        : null,
      aktiverAuftrag: aktiv ? { ...aktiv, protokoll: undefined } : null,
      verlauf,
    };
    if ("fehler" in github) {
      return {
        ...basis,
        github: { fehler: github.fehler },
        kopf: null,
        vergleich: null,
        ci: null,
        bewertung: { darfAnfordern: false, gruende: [github.fehler] },
      };
    }

    const kopf = github.kopf;
    let vergleich: Awaited<ReturnType<GithubService["vergleich"]>> | null = null;
    if (installiert && installiert !== kopf.sha) {
      try {
        vergleich = await this.github.vergleich(installiert, kopf.sha);
      } catch {
        vergleich = null;
      }
    }
    const ci = await this.github.ci(kopf.sha).catch(() => null);
    const bewertung = bewerteAnforderung({
      installiert,
      ziel: kopf.sha,
      zielGegenInstalliert: installiert === kopf.sha ? "identical" : (vergleich?.status ?? null),
      zielAufMain: true,
      ci: ci?.zustand ?? "unbekannt",
      aktiverAuftrag: aktiv !== null,
      aktualisiererLebt: lebt,
    });

    return {
      ...basis,
      github: { fehler: null },
      kopf,
      vergleich: vergleich && {
        status: vergleich.status,
        voraus: vergleich.voraus,
        commits: vergleich.commits.slice(0, 30),
        dateienAnzahl: vergleich.dateien.length,
        auswirkungen: auswirkungen(vergleich.dateien),
        bauen: zuBauen(vergleich.dateien),
      },
      ci,
      bewertung,
    };
  }

  async auftrag(id: string) {
    const auftrag = await this.db.aktualisierung.findUnique({ where: { id } });
    if (!auftrag) throw new NotFoundException("Auftrag nicht gefunden");
    return auftrag;
  }

  /**
   * Fordert die Aktualisierung an. Verlangt das Passwort noch einmal: ein
   * offenes Fenster oder eine gestohlene Sitzung soll nicht genügen, um die
   * Software aller Häuser auszutauschen. Alles, was die Seite zeigte, wird hier
   * neu geprüft - was gilt, entscheidet der Server, nicht der Klick.
   */
  async anfordern(wer: Sitzung, zielSha: string, passwort: string) {
    if (!SHA_MUSTER.test(zielSha)) throw new BadRequestException("Ungültiger Zielstand.");
    const konto = await this.db.betreiber.findUnique({ where: { id: wer.id } });
    if (!konto || !(await bcrypt.compare(passwort, konto.passwordHash))) {
      throw new BadRequestException("Das Passwort stimmt nicht.");
    }

    const status = await this.db.aktualisiererStatus.findUnique({ where: { id: 1 } });
    const installiert = status?.installierteSha ?? null;
    const aktiv = await this.db.aktualisierung.count({ where: { status: { in: [...AKTIV] } } });
    const kopf = await this.github.kopf();
    const [gegenInstalliert, gegenMain, ci] = await Promise.all([
      installiert ? this.github.beziehung(installiert, zielSha) : Promise.resolve(null),
      this.github.beziehung(zielSha, kopf.sha),
      this.github.ci(zielSha),
    ]);
    const bewertung = bewerteAnforderung({
      installiert,
      ziel: zielSha,
      zielGegenInstalliert: gegenInstalliert,
      // Das Ziel liegt auf main, wenn main es einschließt: gleich oder voraus.
      zielAufMain: gegenMain === "identical" || gegenMain === "ahead",
      ci: ci.zustand,
      aktiverAuftrag: aktiv > 0,
      aktualisiererLebt: aktualisiererLebt(status?.zuletztGesehen ?? null),
    });
    if (!bewertung.darfAnfordern) throw new BadRequestException(bewertung.gruende.join(" "));

    try {
      const auftrag = await this.db.aktualisierung.create({
        data: { zielSha, vonSha: installiert, betreiberId: wer.id, betreiberName: wer.username },
        omit: { protokoll: true },
      });
      await this.protokoll.schreibe(
        wer,
        "system.aktualisieren",
        "aktualisierung",
        auftrag.id,
        `Aktualisierung auf ${kurz(zielSha)} angefordert (von ${kurz(installiert)})`,
      );
      return auftrag;
    } catch (fehler) {
      // Der eindeutige Index lässt nur einen aktiven Auftrag zu - zwei Klicks gleichzeitig.
      if ((fehler as { code?: string }).code === "P2002")
        throw new ConflictException("Es läuft oder wartet bereits ein Auftrag.");
      throw fehler;
    }
  }

  /** Nur ein wartender Auftrag lässt sich zurückziehen; ein laufender gehört dem Aktualisierer. */
  async abbrechen(wer: Sitzung, id: string) {
    const treffer = await this.db.aktualisierung.updateMany({
      where: { id, status: "angefordert" },
      data: { status: "abgebrochen", beendetAm: new Date(), meldung: `Zurückgezogen von ${wer.username}` },
    });
    if (treffer.count === 0)
      throw new BadRequestException("Der Auftrag wartet nicht mehr und lässt sich nicht zurückziehen.");
    await this.protokoll.schreibe(
      wer,
      "system.aktualisieren-abbruch",
      "aktualisierung",
      id,
      "Wartender Auftrag zurückgezogen",
    );
  }
}

import { BadGatewayException, Injectable } from "@nestjs/common";
import { ciZustand, type CiZustand, type Datei, type Pruefung, type Vergleich } from "./regeln";

export interface CommitInfo {
  sha: string;
  titel: string;
  datum: string;
  autor: string | null;
}

interface Zwischenspeicher<T> {
  bis: number;
  wert: T;
}

/**
 * Liest von GitHub, welcher Stand der Hauptzweig hat und ob seine Prüfpipeline
 * grün ist. Nur lesend; ein Zugangstoken (`GITHUB_TOKEN`) ist nur bei einem
 * privaten Repository nötig und braucht nur Leserecht auf Inhalte und Checks.
 *
 * Kurz zwischengespeichert: unangemeldet erlaubt GitHub 60 Anfragen je Stunde,
 * und die Oberfläche fragt bei jedem Öffnen und beim Beobachten eines Auftrags.
 */
@Injectable()
export class GithubService {
  private readonly cache = new Map<string, Zwischenspeicher<unknown>>();
  readonly repo = process.env.GITHUB_REPO ?? "Marfinho/ah-intranet";
  readonly zweig = process.env.GITHUB_BRANCH ?? "main";

  private async hole<T>(pfad: string, sekunden = 30): Promise<T> {
    const treffer = this.cache.get(pfad) as Zwischenspeicher<T> | undefined;
    if (treffer && treffer.bis > Date.now()) return treffer.wert;

    let antwort: Response;
    try {
      antwort = await fetch(`https://api.github.com/repos/${this.repo}${pfad}`, {
        headers: {
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          // Allgemeiner Kennung, keine Angaben zum Betreiber oder Haus.
          "user-agent": "ahoi-verwaltung",
          ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (fehler) {
      throw new BadGatewayException(`GitHub nicht erreichbar: ${(fehler as Error).message}`);
    }
    if (antwort.status === 403 || antwort.status === 429) {
      throw new BadGatewayException(
        "GitHub begrenzt die Anfragen (Rate-Limit). Bitte in einigen Minuten erneut versuchen oder GITHUB_TOKEN setzen.",
      );
    }
    if (antwort.status === 404) {
      throw new BadGatewayException(
        `Bei GitHub nicht gefunden: ${this.repo}${pfad} (privates Repository? Dann GITHUB_TOKEN setzen).`,
      );
    }
    if (!antwort.ok) throw new BadGatewayException(`GitHub antwortet mit ${antwort.status}.`);
    const wert = (await antwort.json()) as T;
    this.cache.set(pfad, { bis: Date.now() + sekunden * 1000, wert });
    return wert;
  }

  private static commit(roh: {
    sha: string;
    commit: { message: string; author?: { date?: string; name?: string } };
  }): CommitInfo {
    return {
      sha: roh.sha,
      titel: roh.commit.message.split("\n")[0] ?? "",
      datum: roh.commit.author?.date ?? "",
      autor: roh.commit.author?.name ?? null,
    };
  }

  /** Aktueller Kopf des Hauptzweigs. */
  async kopf(): Promise<CommitInfo> {
    return GithubService.commit(await this.hole(`/commits/${this.zweig}`, 20));
  }

  async commitZu(sha: string): Promise<CommitInfo | null> {
    try {
      return GithubService.commit(await this.hole(`/commits/${sha}`, 3600));
    } catch {
      return null;
    }
  }

  /** Prüfungen eines Stands. Bei einem Stand, den GitHub nicht kennt, kommt `unbekannt`. */
  async ci(sha: string): Promise<{ zustand: CiZustand; laeufe: { name: string; ergebnis: string }[] }> {
    const antwort = await this.hole<{ check_runs: { name: string; status: string; conclusion: string | null }[] }>(
      `/commits/${sha}/check-runs?per_page=100`,
      20,
    );
    const pruefungen: Pruefung[] = antwort.check_runs.map((lauf) => ({
      name: lauf.name,
      status: lauf.status,
      conclusion: lauf.conclusion,
    }));
    return {
      zustand: ciZustand(pruefungen),
      laeufe: antwort.check_runs.map((lauf) => ({
        name: lauf.name,
        ergebnis: lauf.status === "completed" ? (lauf.conclusion ?? "unbekannt") : lauf.status,
      })),
    };
  }

  /** `von` ... `bis`: wie viele Änderungen `bis` voraus ist, mit Commits und Dateien. */
  async vergleich(
    von: string,
    bis: string,
  ): Promise<{ status: Vergleich; voraus: number; zurueck: number; commits: CommitInfo[]; dateien: Datei[] }> {
    const roh = await this.hole<{
      status: Vergleich;
      ahead_by: number;
      behind_by: number;
      commits: { sha: string; commit: { message: string; author?: { date?: string; name?: string } } }[];
      files?: { filename: string; status: string }[];
    }>(`/compare/${von}...${bis}?per_page=100`, 30);
    return {
      status: roh.status,
      voraus: roh.ahead_by,
      zurueck: roh.behind_by,
      commits: roh.commits.map((eintrag) => GithubService.commit(eintrag)).reverse(),
      dateien: (roh.files ?? []).map((datei) => ({ filename: datei.filename, status: datei.status })),
    };
  }

  /** Status ohne Commits und Dateien - nur die Beziehung. */
  async beziehung(von: string, bis: string): Promise<Vergleich> {
    return (await this.vergleich(von, bis)).status;
  }
}

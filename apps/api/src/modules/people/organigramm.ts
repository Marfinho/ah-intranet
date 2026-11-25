/**
 * Regeln rund um das Organigramm als reine Funktionen.
 *
 * Sie ergeben sich vollständig aus der Liste (Person, Vorgesetzte) und gehören
 * deshalb nicht zwischen Datenbankabfragen. Dieselben Funktionen tragen später
 * die Erfassung für Unterstellte und die Eskalation bei Abwesenheit.
 */

export interface PersonRef {
  id: string;
  managerId: string | null;
}

export interface OrgKnoten<T extends PersonRef> {
  person: T;
  unterstellte: OrgKnoten<T>[];
}

/**
 * Würde `vorgesetzteId` als Vorgesetzte von `personId` einen Kreis ergeben?
 *
 * Ein Kreis machte jede Aufwärtssuche zur Endlosschleife. Auch eine
 * unbekannte Vorgesetzte gilt als Fehler - sonst hinge die Kette im Leeren.
 */
export function wuerdeKreisBilden(personen: readonly PersonRef[], personId: string, vorgesetzteId: string): boolean {
  if (personId === vorgesetzteId) {
    return true;
  }
  const vorgesetzteVon = new Map(personen.map((person) => [person.id, person.managerId]));
  const gesehen = new Set<string>([personId]);
  let aktuell: string | null | undefined = vorgesetzteId;
  while (aktuell) {
    if (gesehen.has(aktuell)) {
      return true;
    }
    gesehen.add(aktuell);
    aktuell = vorgesetzteVon.get(aktuell);
  }
  return false;
}

/**
 * Baut den Baum aus der flachen Liste.
 *
 * Wurzeln sind Personen ohne Vorgesetzte - und solche, deren Vorgesetzte nicht
 * in der Liste steht (z. B. weil sie deaktiviert wurde). Sonst verschwände
 * ein ganzer Zweig aus der Ansicht, ohne dass es jemand merkt.
 */
export function baueBaum<T extends PersonRef>(personen: readonly T[]): OrgKnoten<T>[] {
  const knoten = new Map<string, OrgKnoten<T>>(personen.map((person) => [person.id, { person, unterstellte: [] }]));
  const wurzeln: OrgKnoten<T>[] = [];
  for (const eintrag of knoten.values()) {
    const oben = eintrag.person.managerId ? knoten.get(eintrag.person.managerId) : undefined;
    if (oben && oben !== eintrag) {
      oben.unterstellte.push(eintrag);
    } else {
      wurzeln.push(eintrag);
    }
  }
  return wurzeln;
}

/** Alle Personen unterhalb von `personId`, auch mittelbar. Die Person selbst gehört nicht dazu. */
export function alleUnterstellten(personen: readonly PersonRef[], personId: string): string[] {
  const direkte = new Map<string, string[]>();
  for (const person of personen) {
    if (person.managerId) {
      direkte.set(person.managerId, [...(direkte.get(person.managerId) ?? []), person.id]);
    }
  }
  const ergebnis: string[] = [];
  const gesehen = new Set<string>([personId]);
  const offen = [...(direkte.get(personId) ?? [])];
  while (offen.length > 0) {
    const id = offen.shift()!;
    if (gesehen.has(id)) {
      continue;
    }
    gesehen.add(id);
    ergebnis.push(id);
    offen.push(...(direkte.get(id) ?? []));
  }
  return ergebnis;
}

/** Vorgesetzte, Vorgesetzte der Vorgesetzten usw. - nächste zuerst. */
export function vorgesetztenKette(personen: readonly PersonRef[], personId: string): string[] {
  const vorgesetzteVon = new Map(personen.map((person) => [person.id, person.managerId]));
  const kette: string[] = [];
  const gesehen = new Set<string>([personId]);
  let aktuell = vorgesetzteVon.get(personId);
  while (aktuell && !gesehen.has(aktuell)) {
    kette.push(aktuell);
    gesehen.add(aktuell);
    aktuell = vorgesetzteVon.get(aktuell);
  }
  return kette;
}

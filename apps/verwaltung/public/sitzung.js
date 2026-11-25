/* Aufrufe der API und die Rolle der angemeldeten Person - ohne Abhängigkeit zu den Seiten. */

export class ApiFehler extends Error {
  constructor(status, meldung) {
    super(meldung);
    this.status = status;
  }
}

/** Alle Aufrufe laufen hierüber. Das Kopffeld ist die Absicherung gegen fremde Formulare (siehe main.ts). */
export async function api(pfad, { methode = "GET", daten } = {}) {
  const antwort = await fetch(`/api${pfad}`, {
    method: methode,
    headers: { "content-type": "application/json", "x-verwaltung": "1" },
    body: daten === undefined ? undefined : JSON.stringify(daten),
    credentials: "same-origin",
  });
  const koerper = await antwort.json().catch(() => null);
  if (!antwort.ok) {
    const meldung = Array.isArray(koerper?.message)
      ? koerper.message.join(" ")
      : (koerper?.message ?? `Fehler ${antwort.status}`);
    throw new ApiFehler(antwort.status, meldung);
  }
  return koerper;
}

let ich = null;
export const setzeIch = (wert) => {
  ich = wert;
};
export const darfSchreiben = () => ich?.rolle === "inhaber";

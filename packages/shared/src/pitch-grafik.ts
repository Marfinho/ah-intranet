/**
 * Geometrie der Sternbild-Grafik auf der Pitch-Seite.
 *
 * Reine Funktionen, damit die Winkel- und Pfadrechnung testbar bleibt und nicht
 * im Bauteil versteckt ist. Winkel in Grad, 0° oben, im Uhrzeigersinn - so, wie
 * man einen Kreis liest.
 */

export interface Punkt {
  x: number;
  y: number;
}

export function polar(mx: number, my: number, radius: number, grad: number): Punkt {
  const bogen = (grad * Math.PI) / 180;
  return { x: mx + radius * Math.sin(bogen), y: my - radius * Math.cos(bogen) };
}

const runde = (zahl: number) => Math.round(zahl * 100) / 100;

/** Pfad eines Ringsegments zwischen zwei Radien und zwei Winkeln. */
export function ringSegment(mx: number, my: number, innen: number, aussen: number, von: number, bis: number): string {
  const a = polar(mx, my, aussen, von);
  const b = polar(mx, my, aussen, bis);
  const c = polar(mx, my, innen, bis);
  const d = polar(mx, my, innen, von);
  const gross = bis - von > 180 ? 1 : 0;
  return [
    `M${runde(a.x)} ${runde(a.y)}`,
    `A${aussen} ${aussen} 0 ${gross} 1 ${runde(b.x)} ${runde(b.y)}`,
    `L${runde(c.x)} ${runde(c.y)}`,
    `A${innen} ${innen} 0 ${gross} 0 ${runde(d.x)} ${runde(d.y)}`,
    "Z",
  ].join(" ");
}

export interface Segment {
  von: number;
  bis: number;
  mitte: number;
}

/**
 * Teilt den Vollkreis in gleich große Segmente.
 *
 * `gruppen` nennt je Segment seine Gruppe; beim Wechsel der Gruppe wird die
 * Lücke dreimal so groß, damit die Bereiche als Einheiten lesbar bleiben.
 */
export function segmente(anzahl: number, gruppen: readonly number[], luecke = 1.6, start = 0): Segment[] {
  if (anzahl <= 0) {
    return [];
  }

  const luecken = Array.from({ length: anzahl }, (_, index) => {
    const naechste = (index + 1) % anzahl;
    return gruppen[index] === gruppen[naechste] ? luecke : luecke * 3;
  });
  const frei = 360 - luecken.reduce((summe, wert) => summe + wert, 0);
  const breite = frei / anzahl;

  const liste: Segment[] = [];
  let lauf = start;
  for (let index = 0; index < anzahl; index += 1) {
    const von = lauf;
    const bis = lauf + breite;
    liste.push({ von, bis, mitte: (von + bis) / 2 });
    lauf = bis + luecken[index];
  }
  return liste;
}

/** Gleichmäßige Winkel für Knoten auf einem Ring. */
export function verteile(anzahl: number, start = 0): number[] {
  return Array.from({ length: anzahl }, (_, index) => start + (index * 360) / Math.max(1, anzahl));
}

/**
 * Bahn von einem Punkt zu einem anderen, die zur Mitte hin ausschwingt.
 * `zug` 0 ist eine Gerade, 1 führt durch die Mitte.
 */
export function bahn(von: Punkt, nach: Punkt, mitte: Punkt, zug = 0.7): string {
  const regel = { x: (von.x + nach.x) / 2, y: (von.y + nach.y) / 2 };
  const kontrolle = { x: regel.x + (mitte.x - regel.x) * zug, y: regel.y + (mitte.y - regel.y) * zug };
  return `M${runde(von.x)} ${runde(von.y)} Q${runde(kontrolle.x)} ${runde(kontrolle.y)} ${runde(nach.x)} ${runde(nach.y)}`;
}

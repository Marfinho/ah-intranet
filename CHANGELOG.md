# Änderungsprotokoll

Alle nennenswerten Änderungen an AHOI. Neueste zuerst.

Die Versionsnummer steht in der `package.json` im Wurzelverzeichnis und wird beim
Merge nach `main` als Git-Kennzeichen gesetzt (`v0.1.0`). Was eine Ziffer
hochzählt, steht in [`docs/entwicklung.md`](docs/entwicklung.md).

## 0.2.0 – noch nicht ausgeliefert

Ergebnis einer Sicherheits- und Datenschutzdurchsicht. Der Funktionsumfang
bleibt gleich; was sich ändert, ändert sich an den Stellen, an denen es auf
Verlässlichkeit ankommt.

### Was ein Haus anders bedient

- **Die eigene Bestellung lässt sich nicht mehr selbst freigeben.** Wer bisher
  Freigaben erteilen durfte, konnte auch die eigene Anforderung genehmigen. Bei
  Unterlagen, die zehn Jahre aufbewahrt werden, ist das keine Kontrolle. Die
  eigene Bestellung **abzulehnen** oder zu stornieren bleibt möglich – das nimmt
  niemandem etwas.
- **Nach Fehleingaben wartet man kürzer.** Statt einer pauschalen Sperre von
  15 Minuten nach fünf Fehlversuchen wächst die Wartezeit: erst eine Minute,
  dann zwei, vier, acht, höchstens eine Viertelstunde. Wer sich vertippt hat,
  ist nach einer Minute wieder drin. Vorher konnte jede:r, der einen
  Benutzernamen kannte, damit Kolleginnen und Kollegen aussperren.
- **Die Anmeldung sagt nicht mehr, was genau falsch war.** Eine Absage für
  alles – falsche Kennung, unbekannter Benutzername, falsches Passwort. Die
  frühere Unterscheidung war bequem und verriet von außen, welche Konten und
  welche Häuser es gibt.

### Datenschutz

- **Auskunft nach Art. 15 im eigenen Profil.** Unter **Profil → Meine Daten**
  lädt jedes Konto herunter, was das Intranet über es hält – ohne Antrag und
  ohne Umweg über die Verwaltung.
- **Die Auskunft war unvollständig.** Es fehlten unter anderem die
  Lesebestätigungen, Ideen- und Umfragestimmen, Kommentare zu Beiträgen und
  Bestellungen, getroffene Freigabeentscheidungen, Wiki-Artikel, Termine und die
  Einarbeitung – zwölf Datenarten. Jetzt sind sie drin.
- **Jeder Auskunftsabruf steht im Protokoll.** Er zeigt den gesamten
  Datenbestand einer Person; dass er spurlos blieb, war die größte Lücke.
- **Krankmeldungen werden nach einem Jahr gelöscht**, nicht mehr nach dreien.
  Auch ohne Diagnose ist die Arbeitsunfähigkeit ein Gesundheitsdatum, für das
  die Begründung der übrigen Abwesenheiten – Verjährung von Urlaubsansprüchen –
  nicht passt.
- **Ausgeschiedene Konten werden von selbst anonymisiert**, drei Jahre nachdem
  sie auf inaktiv gesetzt wurden. Bestellungen und Freigaben bleiben als Vorgang
  erhalten, nur ohne Namen. Konten, die vorher schon deaktiviert waren, tragen
  keinen Austrittszeitpunkt und bleiben unberührt – sie sind von Hand
  anzustoßen.
- **Die Mobilnummer lässt sich aus dem Verzeichnis nehmen.** Ein Häkchen im
  eigenen Profil; sie ist häufig eine private Nummer, und das Verzeichnis steht
  jedem angemeldeten Konto offen. Die Personalverwaltung sieht sie weiterhin.
- **Administration → Datenschutz zeigt, wann der Aufräumlauf zuletzt lief** –
  und färbt den Hinweis rot, sobald es mehr als zwei Tage her ist. Bleibt der
  Lauf aus, greift keine Frist; vorher hinterließ ausgerechnet der nächtliche
  Lauf keinen Eintrag, sein Ausbleiben fiel also niemandem auf.

### Was im Verborgenen besser wurde

- Startpasswörter für neue und zurückgesetzte Konten kommen aus dem
  kryptographischen Zufallsgenerator des Betriebssystems.
- Die Trennung der Häuser hatte eine zweite Lücke neben den Rohabfragen:
  Kennungen aus Anfragedaten wurden ungeprüft übernommen. Eine Kennung aus einem
  fremden Haus hätte dessen Standort- oder Personennamen sichtbar machen können.
- Lücken im Protokoll fallen auf: fehlgeschlagene Einträge werden gezählt und
  stehen im Healthcheck.
- Die Anonymisierung läuft vollständig in einer Transaktion. Ein Abbruch
  mittendrin hätte ein Konto ohne Identität, aber mit Rechten hinterlassen
  können.
- Vor der Oberfläche stehen Sicherheitsheader (Content-Security-Policy, HSTS);
  das Sitzungscookie ist im Produktivbetrieb schärfer gestellt.
- Die Anwendung startet nicht mehr mit dem Beispiel-Sitzungsschlüssel aus dem
  Repository, und der Seed legt in Produktion keine Konten mit bekanntem
  Passwort mehr an.

### Für den Betrieb

- **Neu: `AHOI_SECURE_COOKIES`.** API und Oberfläche brauchen **denselben**
  Wert. `true` nur hinter HTTPS – sonst verwirft der Browser das Sitzungscookie
  und niemand kommt hinein. Einzelheiten in [`docs/betrieb.md`](docs/betrieb.md).
- **`JWT_SECRET` wird geprüft.** Die bekannten Beispielwerte und, in Produktion,
  alles unter 32 Zeichen führen zum Startabbruch statt zu einer Installation,
  deren Sitzungen sich fälschen lassen.
- Die Container laufen nicht mehr als `root`, bauen gegen die Sperrdatei und
  nehmen keine `.env`-Dateien oder lokalen Sicherungen mehr ins Abbild.
- Die Oberfläche läuft auf Next 15; die Prüfpipeline meldet ab sofort bekannte
  Lücken in Abhängigkeiten.
- Zwei Schemaänderungen: Austrittszeitpunkt und Sichtbarkeit der Mobilnummer am
  Konto. Vor dem Einspielen sichern, danach `./scripts/probelauf.sh`.

## 0.1.0 – noch nicht ausgeliefert

Erster vollständiger Stand. Lauffähig, aber in keinem Haus im Einsatz.

### Funktionen

- **22 Fachmodule**, je Haus einzeln ein- und ausschaltbar, jedes mit einem
  Reifegrad. Erprobungen schaltet nur die Plattformverwaltung frei und sind in
  der Oberfläche als solche erkennbar. Abhängige Module
  gehen beim Abschalten mit; ein abgeschaltetes Modul verhält sich nach außen,
  als gäbe es die Funktion nicht.
- **Aushänge, Bestellungen mit Freigabe, Abwesenheitsanträge, Serviceanfragen,
  Einarbeitung, Raumbuchung, Wissensdatenbank, Ideen und Umfragen** – jeweils mit
  Zielgruppensteuerung nach Standort, Abteilung und Fachbereich.
- **Mandantenfähigkeit:** mehrere Autohäuser auf einer Installation mit
  vollständig getrennten Daten. Ein neues Haus entsteht samt Rollen, Rechten und
  erstem Administrationskonto in einem Schritt.
- **Rollen und Rechte** serverseitig durchgesetzt. 21 Berechtigungen im Code,
  Rollen als Daten des Hauses: eigene Rollen lassen sich in der Oberfläche
  anlegen, benennen und mit Rechten versehen. Wird einer Rolle ein Recht
  entzogen, endet die Sitzung der betroffenen Konten sofort. Eine Änderung, nach
  der kein aktives Konto mehr an die Rollen- oder Benutzerverwaltung käme, wird
  zurückgerollt.
- **Schichtplan mit Diensttausch** (Erprobung): Besetzung je Standort und
  Abteilung, Doppelbelegungen werden beim Speichern abgewiesen. Ein Tausch
  braucht die Zustimmung der angefragten Person _und_ die Freigabe der
  Führungskraft; erst dann wechselt die Besetzung.
- **Fundsachen & Schlüssel** (Erprobung): Verzeichnis mit Aufnahme, Ausgabe,
  Rücknahme und Abholung. Jede Bewegung mit handelnder Person und Zeitstempel –
  der Zustand beantwortet „wer hat den Schlüssel", der Verlauf „wer hatte ihn im
  März". Empfänger können Konten des Hauses oder freie Namen sein.
- **Essensbestellung** (Erprobung): Tagesangebot je Standort mit Stichtag,
  eine Bestellung je Person und Tag, Sammelliste mit Namen und Summe für die
  Abholung.
- **Anmeldung:** Passwort als Grundweg, zusätzliche Anmeldearten je Haus
  hinterlegbar (Microsoft Entra ID vorbereitet). Clientschlüssel verschlüsselt
  gespeichert und nie von der API zurückgegeben. Der Austausch mit dem Anbieter
  ist noch nicht gebaut; freischalten lässt sich die Anmeldeart deshalb nicht.
- **Datenschutz:** Auskunft nach Art. 15 als Datei, Löschung nach Art. 17 als
  Anonymisierung, acht Aufbewahrungsfristen mit nächtlichem Aufräumlauf.
- **Erscheinungsbild AHOI** aus einer Quelle für Anwendung und Präsentation.

### Erprobung neuer Funktionen

- Neue Module tragen den Reifegrad `beta`: aus, nur von der Plattformverwaltung
  freischaltbar, in der Oberfläche als Erprobung erkennbar.
- **Rückmeldeknopf**, solange ein Haus eine Erprobung eingeschaltet hat. Er legt
  eine Serviceanfrage an und trägt die Seite gleich ein, aus der er gedrückt
  wurde.
- **Kunstfiguren für Erprobungsumgebungen:** ein Lauf, der eine Kopie der
  Produktion von Personenbezug befreit, ohne sie unbedienbar zu machen.

### Betrieb

- Sicherung, Wiederherstellung und ein Probelauf, der die zurückgespielte
  Sicherung gegen das Original zählt statt nur „erfolgreich" zu melden.
- Prüfpipeline bei jedem Push: Formatierung, Lint, Typen, 83 Unit-Tests,
  Migrationen gegen eine leere Datenbank, Probelauf der Wiederherstellung.
- Je Anfrage eine auswertbare Protokollzeile mit Haus, Route, Status und Dauer.

### Bewusst nicht enthalten

- **Schnittstellen zu Fremdsystemen, Fahrzeugbestand und Fuhrpark.** AHOI
  behandelt den Betriebsalltag, nicht das Autogeschäft – dort haben die Häuser
  bereits Software. Vollständig entfernt: Oberflächen, API-Module, Datenmodelle
  und Tabellen.
- Abzug der Sicherungen auf ein zweites System, zentrale Protokollauswertung,
  Auftragsverarbeitungsvertrag als Vorlage. Siehe `CLAUDE.md`, Bekannte Lücken.

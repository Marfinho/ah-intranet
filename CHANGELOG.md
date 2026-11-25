# Änderungsprotokoll

Alle nennenswerten Änderungen an AHOI. Neueste zuerst.

Die Versionsnummer steht in der `package.json` im Wurzelverzeichnis und wird beim
Merge nach `main` als Git-Kennzeichen gesetzt (`v0.1.0`). Was eine Ziffer
hochzählt, steht in [`docs/entwicklung.md`](docs/entwicklung.md).

## 0.1.0 – noch nicht ausgeliefert

Erster vollständiger Stand. Lauffähig, aber in keinem Haus im Einsatz.

### Sicherheit

- **Zweiter Faktor** per Authenticator-App (TOTP nach RFC 6238, gegen die
  Testvektoren der RFC geprüft) mit zehn Wiederherstellungscodes. Ein Haus kann
  ihn für alle Konten vorschreiben; Konten der Plattformverwaltung brauchen ihn
  immer. Wer ihn noch nicht hat, meldet sich an, kommt aber nur zur Einrichtung.
- **Next.js 15.5 und React 19** statt Next 14.2.21, das kritische Schwachstellen
  trug. Transitive Pakete mit bekannten Lücken sind angehoben.
- **Content-Security-Policy mit Einmalkennung** und weitere Sicherheitsheader im
  Frontend. Die Hausschrift wird mit der Anwendung ausgeliefert statt von Google.
- **HTTPS im Betrieb:** `Caddyfile.tls` holt je Haus ein Zertifikat; die API
  entscheidet, für welche Namen.
- **TypeScript 6.** Nest 12 wird nur noch als ES-Modul ausgeliefert; die API
  bleibt CommonJS und lädt es per `require()`. Das setzt **Node ≥ 22.12** voraus
  (`engines`), Images und CI laufen auf 26. Die Modulauflösung steht auf
  `nodenext`, der Logo-Upload nutzt den eigenen Typ `LogoFile` statt des globalen
  `Express.Multer.File`.
- **Tailwind 4** statt 3, optisch unverändert: 24 Seiten vor und nach der
  Migration als Screenshot verglichen, bis auf Daten und Ladezeitpunkt des Logos
  pixelgleich. Dafür stellt `globals.css` Standardwerte wieder her, die Tailwind 4
  geändert hat (Palette, Rahmenfarbe, `space-y`, Auswahllisten, Datumsfelder).
- **NestJS 12** (Express 5) statt 10: `@nestjs/core` trug die letzte offene
  Meldung im Betriebsbaum, jetzt meldet `pnpm audit --prod` nichts mehr. Die
  Middleware hängt an `{*splat}`, Express 5 verlangt benannte Platzhalter.
- **Node 26 (LTS)** in CI, Images und Typen; Node 20 ist seit April 2026 und
  22 ab April 2027 nicht mehr unterstützt.
- **CI:** Abhängigkeits-Audit ab „high“, CodeQL, Geheimnissuche, SBOM,
  Dependabot.

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

# Änderungsprotokoll

Alle nennenswerten Änderungen an AHOI. Neueste zuerst.

Die Versionsnummer steht in der `package.json` im Wurzelverzeichnis und wird beim
Merge nach `main` als Git-Kennzeichen gesetzt (`v0.1.0`). Was eine Ziffer
hochzählt, steht in [`docs/entwicklung.md`](docs/entwicklung.md).

## 0.1.0 – noch nicht ausgeliefert

Erster vollständiger Stand. Lauffähig, aber in keinem Haus im Einsatz.

### Funktionen

- **19 Fachmodule**, je Haus einzeln ein- und ausschaltbar, jedes mit einem
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
- **Rollen und Rechte** serverseitig durchgesetzt, vier Rollen mit feingranularen
  Berechtigungen.
- **Datenschutz:** Auskunft nach Art. 15 als Datei, Löschung nach Art. 17 als
  Anonymisierung, acht Aufbewahrungsfristen mit nächtlichem Aufräumlauf.
- **Erscheinungsbild AHOI** aus einer Quelle für Anwendung und Präsentation.

### Betrieb

- Sicherung, Wiederherstellung und ein Probelauf, der die zurückgespielte
  Sicherung gegen das Original zählt statt nur „erfolgreich" zu melden.
- Prüfpipeline bei jedem Push: Formatierung, Lint, Typen, 115 Unit-Tests,
  Migrationen gegen eine leere Datenbank, Probelauf der Wiederherstellung.

### Bewusst nicht enthalten

- **Schnittstellen zu Fremdsystemen, Fahrzeugbestand und Fuhrpark.** AHOI
  behandelt den Betriebsalltag, nicht das Autogeschäft – dort haben die Häuser
  bereits Software. Vollständig entfernt: Oberflächen, API-Module, Datenmodelle
  und Tabellen.
- Abzug der Sicherungen auf ein zweites System, zentrale Protokollauswertung,
  Auftragsverarbeitungsvertrag als Vorlage. Siehe `CLAUDE.md`, Bekannte Lücken.

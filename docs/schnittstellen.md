# Schnittstellen zu Autohaus-Systemen

Was Autohäuser mit Konzernmarken einsetzen, was davon anbindbar ist – und was
dieses Intranet konkret umsetzt.

## Die unangenehme Ausgangslage

Im deutschen Autohaus-Umfeld ist praktisch **jede** relevante Schnittstelle
vertraglich geschützt. Hersteller und Anbieter geben ihre Spezifikationen nur an
zertifizierte Softwarepartner heraus, und der Weg dorthin führt fast immer über
den DMS-Anbieter, nicht über das einzelne Autohaus.

Deshalb klassifiziert die Registry in
[`packages/shared/src/connectors.ts`](../packages/shared/src/connectors.ts) jeden
Konnektor nach seiner tatsächlichen Zugänglichkeit. Erfundene Endpunkte gibt es
hier nicht: Wo die Spezifikation fehlt, steht das ausdrücklich dran, und die API
weist Ausführungsversuche mit einer klaren Begründung ab.

| Klasse | Bedeutung | Anzahl |
| ------ | --------- | ------ |
| `public_api` | Öffentlich dokumentiert, vollständig implementiert | 1 |
| `documented_format` | Austauschformat öffentlich, vollständig implementiert | 2 |
| `partner_contract` | Spezifikation nur mit Vertrag, bewusst nicht implementiert | 7 |
| `portal_link` | Kein Datenaustausch vorgesehen, Absprung ins Portal | 4 |

## Was im Konzernumfeld läuft

### Herstellerseite

**RW.IL (Retail & Wholesale Integration Layer)** ist die aktuelle
Kommunikationsschicht des Volkswagen-Konzerns für den Aftersales-Austausch mit
dem DMS. Aufträge laufen in die zentrale Auftragsdatenbank **ORMA**. RW.IL löst
den **DMS-Backbone** ab, der jahrzehntelang der Standard war und über den unter
anderem Teilestammdaten (**My ETKA Info**) und Arbeitswerte (**APOS**) verteilt
wurden. Beide sind nur über den DMS-Anbieter erreichbar.

Arbeitsmittel ohne Drittsystem-Schnittstelle: **ElsaPro** (Reparaturleitfäden,
Stromlaufpläne), **ETKA** (Teilekatalog), **ODIS** (Diagnose, Codierung,
Programmierung) und das **Group Retail Portal**. Für diese ist der gepflegte
Absprung aus dem Intranet die einzige sinnvolle Integration.

### Dealer-Management-Systeme

Im Konzernumfeld dominiert **VaudisX / VaudisClassic** (T-Systems) als auf die
Konzernmarken spezialisiertes DMS; VaudisX bekommt die RW.IL-Anbindung. Daneben
sind **Cross / dx.one**, **Ecaros** (Nextlane), **werwiso** (Betzemeier) und
**Loco-Soft** verbreitet. Schnittstellenfreigaben sind bei allen
kostenpflichtig und vertragsgebunden.

### Umsysteme

- **Fahrzeugbörsen:** mobile.de und AutoScout24
- **Bewertung und Kalkulation:** DAT SilverDAT (rund 400 Schnittstellenpartner), SchwackeNet
- **Teile:** TecDoc für den freien Teilebezug
- **Buchhaltung:** DATEV

## Was dieses Intranet umsetzt

### mobile.de Seller-API — vollständig

Die einzige Schnittstelle in dieser Aufstellung mit frei zugänglicher
Dokumentation. Umgesetzt nach
[services.mobile.de/docs/seller-api.html](https://services.mobile.de/docs/seller-api.html):

- HTTP-Basic-Authentifizierung mit einem API-Benutzer je Händler
- `GET /seller-api/sellers/:sellerId/ads`
- Medientyp `application/vnd.de.mobile.api+json`
- Sandbox unter `https://services.sandbox.mobile.de`

Der Abgleich übernimmt alle Inserate in den internen Fahrzeugbestand und
entfernt Inserate, die es dort nicht mehr gibt. Die Antwortstruktur wird
tolerant ausgewertet – mobile.de liefert Felder mal als Skalar, mal als Objekt
mit `@value`. Ein einzelner unbrauchbarer Datensatz wird gezählt und
übersprungen, statt den ganzen Lauf abzubrechen.

**Inbetriebnahme:** API-Zugang über den Händlerbetreuer anfordern, zuerst gegen
die Sandbox testen.

### DMS-Dateiaustausch — vollständig

Der einzige Weg, der **ohne Vertrag mit jedem DMS** funktioniert: Das DMS legt
einen Bestandsexport als CSV in ein Verzeichnis, das Intranet liest ihn ein.

Spaltennamen werden über Synonyme erkannt, weil sie sich je DMS unterscheiden
(`Fahrzeugnummer`, `Bestandsnummer`, `FzgNr` …). Verarbeitet werden deutsche
Zahlen (`24.900,00`), die Datumsformate `TT.MM.JJJJ`, `JJJJ-MM` und `MM/JJJJ`
sowie `latin1`, das viele DMS weiterhin exportieren.

**Inbetriebnahme:** Im DMS einen wiederkehrenden Export einrichten, Verzeichnis
für die API freigeben.

### DATEV-Buchungsstapel — vollständig

Das EXTF-Format ist öffentlich dokumentiert, ein Vertrag mit der DATEV ist
nicht nötig. Erzeugt wird ein Stapel nach Formatversion 700 / Satzversion 13:

- Kopfsatz mit 31 Feldern, Spaltenzeile und Buchungssätze mit je 125 Feldern
- CRLF-Zeilenenden, Dezimalkomma, Windows-1252
- Belegdatum als `TTMM`, das Jahr steht im Kopfsatz

Gebucht wird je abgeschlossener Bestellung ein Satz: Aufwandskonto im Soll gegen
das konfigurierte Gegenkonto. Bestellungen **ohne hinterlegten Rechnungsbetrag
erzeugen keinen Buchungssatz** – ein Stapel mit geratenen Beträgen wäre
schlimmer als keiner. Den Betrag erfassen Sie beim Abschließen der Bestellung.

**Inbetriebnahme:** Berater- und Mandantennummer bei der Kanzlei erfragen,
Konten und BU-Schlüssel mit ihr abstimmen. Den ersten Stapel vor dem
Produktivbetrieb einmal gemeinsam einlesen.

### Portalkonnektoren

Group Retail Portal, ElsaPro, ETKA und ODIS werden als gepflegte Absprünge
geführt, damit Mitarbeitende keine Lesezeichen sammeln. Geprüft wird nur, ob
eine plausible Adresse hinterlegt ist – ein Erreichbarkeitstest wäre wertlos,
weil die Portale eine persönliche Anmeldung verlangen.

### Vorbereitet, aber nicht implementiert

RW.IL, DMS-Backbone, VaudisX, AutoScout24, DAT SilverDAT, SchwackeNet und
TecDoc sind mit Konfigurationsfeldern, Vorgängen und dem konkreten
Onboarding-Weg hinterlegt. Die Adapter fehlen bewusst. Sobald Vertrag und
Spezifikation vorliegen, ist nur noch eine Klasse nach dem Vorbild von
`MobileDeAdapter` zu ergänzen und in `IntegrationsService` zu registrieren –
Zugangsdatenverwaltung, Verschlüsselung, Laufprotokoll und Oberfläche stehen
bereits.

## Sicherheit

- Zugangsdaten liegen **AES-256-GCM-verschlüsselt** in der Datenbank, je Wert
  mit eigener IV und Authentifizierungs-Tag. Format: `v1:<iv>:<tag>:<ciphertext>`.
- Der Schlüssel kommt aus `INTEGRATION_SECRET_KEY`. Fehlt er, lassen sich
  Zugangsdaten weder speichern noch lesen – beabsichtigt, damit nichts
  unverschlüsselt abgelegt wird.
- Die API liefert Geheimnisse **nie** aus; die Oberfläche zeigt nur, welche
  Felder belegt sind. Ein leeres Passwortfeld lässt den Wert unverändert,
  gelöscht wird nur über ein eigenes Kästchen.
- Alle Konfigurationsänderungen, Verbindungstests und Abgleiche landen im
  Audit-Log. Fehlgeschlagene Abgleiche benachrichtigen zusätzlich die
  Administration.
- Sämtliche Schnittstellen-Endpunkte sind auf die Rolle `admin` beschränkt; der
  Fahrzeugbestand ist für alle Mitarbeitenden lesbar.

## Bedienung

**Administration → Schnittstellen** listet alle Konnektoren nach Kategorie, mit
Verfügbarkeitsklasse, Status, letztem Verbindungstest und letztem Abgleich.
Je Konnektor gibt es eine Detailseite mit Konfiguration, Voraussetzungen und
Laufprotokoll.

Beide Module sind über die Modulsteuerung abschaltbar; **Fahrzeugbestand** hängt
an **Schnittstellen** und wird mit deaktiviert.

## Grenzen

- Die Abgleiche laufen **manuell**. Eine zeitgesteuerte Ausführung ist nicht
  eingebaut; für den Betrieb wäre ein Cron-Aufruf auf den Run-Endpunkt oder ein
  Scheduler im API-Prozess zu ergänzen.
- Der mobile.de-Adapter ist gegen einen lokalen Nachbau der dokumentierten API
  geprüft, **nicht** gegen die echte Schnittstelle – dafür fehlen Zugangsdaten.
  Vor dem Produktivbetrieb gegen die Sandbox testen.
- Der DATEV-Export folgt der veröffentlichten Formatbeschreibung und einem
  bekannten Referenzbeispiel, wurde aber nicht in DATEV selbst eingelesen.
- mobile.de dokumentiert für die Inseratsliste keine Paginierung; bei sehr
  großen Beständen ist das im Auge zu behalten.

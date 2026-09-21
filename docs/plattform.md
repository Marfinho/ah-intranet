# Plattform: eine Installation, mehrere Autohausgruppen

Diese Seite beschreibt, wie aus einer laufenden AHOI-Installation ein
Angebot mit eigener Adresse wird: eine Domain für den Betreiber, eine
Subdomain je Autohausgruppe, ein Verwaltungsbereich für den Betreiber und ein
Selbstbedienungsbereich für jedes Haus - begrenzt durch die Lizenz, die der
Betreiber vergibt.

Die Mandantentrennung selbst ist bereits gebaut (siehe `CLAUDE.md`,
Abschnitt „Mandantenfähigkeit"). Diese Seite beschreibt nur, wie eine
Installation mit **mehreren zahlenden Kunden auf einer Domain** aufgestellt
wird - Adressierung, Zugang der Verwaltung, Lizenzgrenzen, Beobachtung des
Servers.

## Domain-Modell

| Adresse                      | Was dort läuft                                                             |
| ----------------------------- | --------------------------------------------------------------------------- |
| `ahoi.online`                  | Öffentliche Seite des Produkts (Marketing) - kein Mandant                    |
| `ahoi.online/verwaltung`      | Plattformverwaltung des Betreibers, hinter Login (siehe unten)             |
| `<gruppe>.ahoi.online`        | Ein Autohaus (Mandant), automatisch über die Subdomain aufgelöst           |
| `intranet.autohaus-x.de`      | Dieselbe Zuordnung über eine eigene Domain des Kunden statt der Subdomain  |

Die Auflösung „Subdomain oder eigene Domain → Mandant" ist bereits in
`TenantService.byHost()` umgesetzt: `<slug>.<basis>.<tld>` wird auf den
Mandanten mit dieser Kennung (`slug`) abgebildet, eine hinterlegte eigene
Domain (`Tenant.domain`) hat Vorrang. **Neu einzurichten ist nur die
Zustellung** - DNS und der Reverse Proxy davor -, nicht die Anwendung selbst.

### DNS

- `ahoi.online` → A/AAAA-Eintrag auf den Server.
- `*.ahoi.online` → derselbe Server (Wildcard-Eintrag).
- Für eine eigene Kundendomain: ein CNAME der Kundendomain auf `ahoi.online`
  (oder A/AAAA auf dieselbe Adresse), plus Eintrag der Domain am Mandanten
  (`Tenant.domain`) - das übernimmt die Plattformverwaltung beim Anlegen oder
  nachträglich.

### Reverse Proxy mit automatischem Zertifikat

Ein Zertifikat für eine Wildcard-Subdomain (`*.ahoi.online`) verlangt eine
Bestätigung über DNS, nicht über HTTP - der Anbieter des DNS-Eintrags braucht
dafür eine API. Caddy erledigt das mit einem Plugin für den jeweiligen
DNS-Anbieter. Beispiel (Anbieter austauschen):

```caddyfile
ahoi.online, *.ahoi.online {
  tls {
    dns <anbieter> {env.DNS_API_TOKEN}
  }

  # Frontend (Next.js) nimmt alles entgegen, reicht API-Aufrufe weiter.
  handle /api/* {
    reverse_proxy api:3001
  }
  handle {
    reverse_proxy web:3000
  }
}

# Eigene Kundendomains laufen über dasselbe Ziel, brauchen aber ein eigenes
# Zertifikat (HTTP-Bestätigung reicht hier, keine Wildcard nötig).
intranet.autohaus-x.de {
  handle /api/* {
    reverse_proxy api:3001
  }
  handle {
    reverse_proxy web:3000
  }
}
```

Das `docker-compose.yml` der Installation bleibt unverändert; Caddy kommt als
zusätzlicher Dienst davor. Näheres zur Aufstellung insgesamt steht in
[`docs/ausrollen.md`](ausrollen.md).

## Die Marketingseite auf `ahoi.online`

Ohne erkannten Mandanten (kein Subdomain-Treffer, keine eigene Domain, mehr
als ein Haus vorhanden) liefert die Middleware bewusst **keinen** Zugriff auf
Fachdaten - das ist die Fail-closed-Regel der Mandantentrennung. Für die
Wurzelseite `/` auf genau dieser Adresse zeigt das Frontend stattdessen eine
öffentliche Produktseite statt eines Anmeldeformulars ohne Kontext: die
Middleware in `apps/web/middleware.ts` erkennt den Basis-Host (Umgebungsvariable
`NEXT_PUBLIC_BASE_DOMAIN`) und leitet `/` dort auf eine eigene, öffentliche
Route um. Jede Subdomain und jede eigene Kundendomain bleibt beim gewohnten
Verhalten: ohne Sitzung direkt zum Anmeldeformular des jeweiligen Hauses.

## Verwaltungsbereich: `ahoi.online/verwaltung`

Die Plattformverwaltung ist **kein eigener Mandant** und keine Rolle - sie ist
das Merkmal `isPlatformAdmin` an einem einzelnen Benutzerkonto, unabhängig
davon, in welchem Haus dieses Konto liegt (`CLAUDE.md`: „Plattformverwaltung ≠
Adminrolle"). Praktisch heißt das:

1. Der Betreiber legt sich selbst ein Konto in einem eigenen, internen Haus
   an (z. B. Kennung `intern`) und markiert es als `isPlatformAdmin`.
2. Auf `ahoi.online/verwaltung` liegt ein eigenes Anmeldeformular, das - wie
   die Anmeldung bei mehreren Häusern ohnehin - Benutzername, Passwort **und**
   die Kennung dieses internen Hauses abfragt (dasselbe Feld, das die
   Mandantenauflösung schon unterstützt: `resolve({ explicit, host })`).
3. Nach der Anmeldung prüft die Seite `isPlatformAdmin`; fehlt es, wird
   abgemeldet und abgewiesen statt stillschweigend im falschen Bereich zu
   landen.
4. Von dort aus: Autohäuser (Mandanten) anlegen, freischalten, sperren und
   lizenzieren (`/verwaltung/mandanten`), Beta-Module freischalten
   (`/verwaltung/module`), Systemlast beobachten (`/verwaltung/monitoring`).

Diese Seiten existieren bereits unter `/admin/mandanten`, `/admin/module` und
`/admin/monitoring` innerhalb der normalen Anwendung und sind schon heute
gegen `isPlatformAdmin` bzw. gegen das jeweilige Recht abgesichert. Ein
eigener Pfad `/verwaltung` auf der Marketingdomain ist am Reverse Proxy eine
Weiterleitung auf dieselben Seiten - keine zweite Implementierung. Wer das
lieber als eigenständigen Auftritt hätte (eigenes Layout ohne den Rest der
Anwendung), kann das nachträglich als eigene Next-Route ergänzen; fachlich
ändert das nichts, weil die Rechteprüfung in der API liegt, nicht in der
Oberfläche.

## Lizenzmodell: was der Kunde selbst aufbauen darf

Ein Kunde soll sein Haus selbst einrichten können - Autohäuser (Standorte),
Abteilungen, Mitarbeitende -, aber nur bis zu dem, was der Betreiber
freigegeben hat. Umgesetzt als zwei Zahlen am Mandanten:

- `Tenant.maxLocations` - höchstens so viele Standorte (Autohäuser).
- `Tenant.maxUsers` - höchstens so viele Benutzerkonten.

`null` heißt unbegrenzt. Nur die Plattformverwaltung setzt diese Werte
(`PATCH /tenants/:id/lizenz`, Oberfläche unter „Autohäuser" in der
Verwaltung). Das Haus selbst legt Standorte (`organisation.manage`) und
Benutzerkonten (`users.manage`) frei an, solange die Grenze nicht erreicht
ist; darüber hinaus weist die API mit einer klaren Meldung ab, statt einen
Endpunkt zu verstecken. Abteilungen tragen keine Lizenzgrenze - sie kosten den
Betreiber nichts und sind reine Organisation des Hauses.

Eine gesenkte Grenze wirkt nur auf die **nächste** Neuanlage; bestehende
Standorte oder Konten werden dadurch nicht abgeschaltet. Ein Absenken unter
den aktuellen Bestand ist damit folgenlos für das, was schon da ist - es
verhindert nur weiteres Wachstum, bis die Lizenz wieder angehoben wird.

Was das Lizenzmodell bewusst nicht tut: Es entscheidet nicht, welche
Fachmodule ein Haus nutzen darf - das regelt weiterhin die Modulsteuerung
(`ModuleSetting`, Beta-Module nur durch die Plattformverwaltung, siehe
`CLAUDE.md`). Beide Mechanismen bleiben getrennt, weil sie unterschiedliche
Fragen beantworten: „wie groß darf das Haus werden" gegen „welche
Funktionen darf es einschalten".

## Monitoring und Warnsystem

Ein Messpunkt (`SystemMetricSample`) hält CPU-Last, Arbeitsspeicher- und
Plattenbelegung sowie den rohen Load-Average-Wert des Betriebssystems fest -
global, nicht je Haus, weil die Maschine allen Häusern gemeinsam gehört. Ein
Einstellungssatz (`PlatformSettings`, eine Zeile) hält Schwellen, die
Empfängeradresse und den Mindestabstand zwischen zwei Warnungen.

- **Messung**: `apps/api/src/scripts/monitoring.ts`, aufgerufen per Cron (z. B.
  minütlich). Läuft als eigener Prozess aus demselben Grund wie der
  Aufbewahrungslauf: bei mehreren API-Instanzen liefe eine eingebaute
  Zeitsteuerung mehrfach.

  ```cron
  * * * * *  cd /opt/ah-intranet/apps/api && node dist/scripts/monitoring.js
  ```

- **Auswertung**: Überschreitet ein Wert seine Schwelle und ist seit der
  letzten Warnung genug Zeit vergangen (`cooldownMinutes`), verschickt der
  Lauf eine E-Mail über `core/mailer.ts`.
- **Voraussetzung für den Versand**: Umgebungsvariablen `SMTP_HOST`,
  `SMTP_PORT` (Vorgabe 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`
  (`"true"` für Port 465) und `SMTP_FROM`. Fehlen `SMTP_HOST` oder
  `SMTP_FROM`, wird nur geloggt, nichts verschickt - dieselbe Ehrlichkeit wie
  bei fehlendem `SECRET_KEY` (`core/geheimnis.ts`): lieber eine klare Absage
  als ein Versand ins Leere.
- **Oberfläche**: „Monitoring" in der Verwaltung (nur Plattformverwaltung) -
  aktueller Stand, Verlauf der letzten 30 Tage, Schwellen und Empfänger
  einstellbar, eine sofortige Testmessung.

### Grenzen dieses Ansatzes

- Er beobachtet **eine** Maschine mit Bordmitteln (`os`-Modul, `df`). Für
  mehrere Maschinen (getrennte Datenbank, mehrere API-Instanzen hinter einem
  Lastverteiler) bräuchte es einen externen Sammler (z. B. Prometheus mit
  `node_exporter`) statt dieser eingebauten Messung - das ist ein bewusst
  kleiner erster Schritt, kein Ersatz dafür auf Dauer.
- Ein Ausfall der Maschine selbst zeigt sich hier nicht - dafür bleibt der in
  [`docs/ausrollen.md`](ausrollen.md) genannte externe Healthcheck auf
  `/api/health` zuständig, der unabhängig von der Maschine läuft.
- Die Warnung geht an eine einzelne Adresse. Mehrere Empfänger sind über eine
  Verteilerliste beim Mailanbieter lösbar, ohne dass die Anwendung das
  nachbilden müsste.

## Was noch zu entscheiden ist

- **Erste eigene Domain für den Betreiber selbst.** `ahoi.online` ist als
  Adresse dieser Seite unterstellt - die tatsächliche Registrierung und ihr
  Eintrag beim DNS-Anbieter sind außerhalb dieses Repositories zu erledigen.
- **Zahlungsabwicklung.** Diese Seite beschreibt nur die technische Grenze
  (Lizenzzahlen). Wie ein Kunde eine höhere Lizenz bestellt und bezahlt, ist
  eine kaufmännische Entscheidung, keine bauliche.
- **Eigenständiges Layout für `/verwaltung`.** Siehe oben - fachlich bereits
  vollständig, eine Frage der Außenwirkung.

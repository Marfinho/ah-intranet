# Subdomains lokal testen

Zwei Wege, um mehrere Häuser über eigene Adressen auszuprobieren, bevor eine
echte Domain und ein Zertifikat feststehen. Beide setzen voraus, dass mehr als
ein Mandant angelegt ist – mit nur einem Haus greift ohnehin die
Alleinstellung (`soleTenant`) und jede Adresse landet dort.

## Weg 1: auf der eigenen Maschine, ohne jede Einrichtung

Chrome, Firefox, Edge und Safari lösen jede `*.localhost`-Adresse auf die
eigene Maschine auf (RFC 6761) – ganz ohne Hosts-Datei oder Router. Es reicht:

```bash
docker compose up -d
```

und dann im Browser `http://autohaus-mueller.localhost:3000`,
`http://andere-firma.localhost:3000` usw. – je nach den Kennungen (`slug`),
die beim Anlegen der Häuser vergeben wurden. Die Auflösung sitzt in
`TenantService.byHost` (`apps/api/src/core/tenant.service.ts`) und erkennt
`<slug>.localhost` genauso wie eine echte Subdomain.

Funktioniert nur auf dem Rechner, auf dem der Browser läuft – ein Handy im
selben WLAN kann `*.localhost` nicht auf den Unraid-Server auflösen.

## Weg 2: im Heimnetz, z. B. auf Unraid

Für den Test von mehreren Geräten aus (Handy, Laptop) gegen den Server im
Netz gehört ein Reverse Proxy dazu, der die Subdomain wieder in den `Host`-
Kopf einträgt, den die Anwendung sieht. Dafür liegt `docker-compose.proxy.yml`
und `Caddyfile` bei:

```bash
BASE_DOMAIN=ahoi.home docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d
```

`BASE_DOMAIN` ist frei wählbar – eine Adresse, die nicht wirklich im Internet
existiert, reicht für den Hausgebrauch (`ahoi.home`, `ahoi.test`, …).

Der Proxy hört standardmäßig auf Port **8090**, nicht auf 80 – auf Unraid
belegt meist schon die eigene Weboberfläche Port 80. Ist bei dir ein anderer
Port frei (oder 80 tatsächlich frei), einfach mitgeben:

```bash
PROXY_PORT=8090 BASE_DOMAIN=ahoi.home docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d
```

Die Adressen lauten dann entsprechend `http://autohaus-mueller.ahoi.home:8090`
(bzw. ohne Portangabe, wenn `PROXY_PORT=80` gesetzt und der Port frei ist).

Damit Geräte im Netz die Adresse überhaupt finden, braucht es einen der
beiden Wege:

- **Ein Wildcard-Eintrag** `*.ahoi.home -> <IP des Unraid-Servers>` im Router
  oder in Pi-hole/AdGuard, falls dort vorhanden – dann funktioniert jede
  Kennung ohne weiteres Zutun.
- **Ohne eigenen DNS-Server**: auf jedem Testgerät einen Eintrag in der
  Hosts-Datei je Haus (unter Windows
  `C:\Windows\System32\drivers\etc\hosts`, unter Linux/macOS `/etc/hosts`):
  ```
  192.168.1.50   autohaus-mueller.ahoi.home andere-firma.ahoi.home
  ```

Danach im Browser `http://autohaus-mueller.ahoi.home:8090` (oder der Port, den
`PROXY_PORT` trägt). Ohne TLS – für die Erprobung im eigenen Netz ausreichend,
ein selbst ausgestelltes Zertifikat brächte nur Warnmeldungen ohne echten
Nutzen.
Echtes TLS mit einer erreichbaren Domain ist eine der offenen Fragen vor dem
Produktivbetrieb, siehe [`ausrollen.md`](ausrollen.md).

## Warum das vorher nicht ging

Zwei Stellen mussten dafür angepasst werden:

- `TenantService.byHost` erwartete mindestens drei Namensteile
  (`sub.basis.tld`) und hätte `<slug>.localhost` (nur zwei Teile) nie als
  Subdomain erkannt.
- Das Frontend spricht die API serverseitig immer unter ihrem internen Namen
  an (`api:3001`) – der `Host`-Kopf, den die API dabei sieht, war also nie
  der, den der Browser tatsächlich gerufen hat. `apps/web/lib/api.ts` reicht
  ihn jetzt als `x-forwarded-host` weiter, genau wie es ein Reverse Proxy vor
  der API täte; `TenantMiddleware` liest diesen Kopf jetzt bevorzugt.

## Ein Haus anlegen

Über **Administration → Mandanten** (nur `isPlatformAdmin`) oder direkt per
API. Die Kennung (`slug`) bestimmt die Subdomain – `slug: "autohaus-mueller"`
ergibt `autohaus-mueller.localhost` bzw. `autohaus-mueller.ahoi.home`.

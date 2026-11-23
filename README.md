# Entdeckerreise – Demonstrator

Demonstrator der Lionizers GmbH für eine ortsbasierte Lern- und Entdecker-App für Schulklassen der Stufen 4 bis 8.
Die App ist eine Progressive Web App (PWA): Sie läuft im Browser, lässt sich installieren und funktioniert offline.

**Alle Inhalte sind erfunden.** Orte, Figuren und Aufgaben dienen nur der Vorführung.

Live: https://klassesachsen-demo.lionizers.com

## Voraussetzungen

- Node.js 22 und npm
- für den Container: Docker

## Lokal starten

```bash
npm ci
npm run dev          # Entwicklungsserver auf http://localhost:5173
```

Der Service Worker (Offline-Betrieb) existiert nur im Produktions-Build:

```bash
npm run build
npm run preview      # http://localhost:4173
```

## Schnittstelle für Bildbeiträge (Simulation)

Nach der finalen Quest gestaltet eine Gruppe in der Sammlung eine Collage aus ihren Items und speichert sie
(PNG 2048 × 2048 px, Vorschau 512 px als WebP, ersatzweise JPEG). Freigegebene Beiträge stehen unter `/api/` bereit,
beschrieben in [`public/openapi.yaml`](public/openapi.yaml) (ausgeliefert unter `/openapi.yaml`):

- `GET /api/beitraege`: Metadaten (Kennung, Zeitpunkt, Art `item-collage`, Items), kein Gruppenname
- `GET /api/beitraege/{id}.png` und `.webp` bzw. `.jpg`
- `GET /api/export.zip`: Gesamtexport

Es gibt keinen Server: Der Service Worker beantwortet diese Pfade aus dem Speicher des Geräts und kennzeichnet jede
Antwort mit `X-Demonstrator: simulation`. Die Schnittstelle antwortet deshalb erst, wenn die App einmal geladen ist,
und nur im Produktions-Build (`npm run build && npm run preview`). Bis die Lehrkraft einen Beitrag freigibt, bleibt
die Liste leer.

## Prüfen

```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # Unit-Tests (Vitest)
npx playwright install chromium
npm run e2e          # End-to-End-Tests inkl. Barrierefreiheit (axe, WCAG 2.1 A/AA)
```

## Als Container betreiben

Das Image baut die App und liefert sie mit nginx auf Port 5000 aus. `/health` antwortet mit `200 ok`.

```bash
docker build -t entdeckerreise .
docker run --rm -p 8080:5000 entdeckerreise
curl http://localhost:8080/health
```

Die Prüfung, die auch die CI ausführt: `scripts/container-smoke.sh`.

Die App braucht keinen Server-Code, keine Datenbank und keine Umgebungsvariablen.

## Auslieferung

Jeder Push auf `main` durchläuft die CI (`.github/workflows/ci.yml`). Sind alle Prüfungen grün, deployt der zentrale Workflow
[`Lionizers/dokku-deploy`](https://github.com/Lionizers/dokku-deploy) auf einen Dokku-Server in der EU.
Für einen anderen Betreiber genügt jeder Host, der ein Docker-Image ausführt.

## Lizenz

[EUPL-1.2](LICENSE)

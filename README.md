# Falu Change Request

Interne Webanwendung der Falu AG für den vollständigen Lebenszyklus von Änderungsanträgen. Dieses Repository enthält Phase 1: technische Grundlage, Datenmodell, Prototyp-Identität, Berechtigungen, Audit-Architektur und Anwendungsshell.

## Voraussetzungen

- Node.js LTS (mindestens Node.js 20)
- npm
- Docker Desktop mit Docker Compose für die lokale PostgreSQL-Datenbank

## Installation

```bash
npm install
copy .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Die Anwendung ist anschließend unter `http://localhost:3000` erreichbar. Die PostgreSQL-Datenbank wird lokal auf Port `5432` bereitgestellt.

## Umgebungsvariablen

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindungszeichenfolge für Prisma |
| `AUTH_COOKIE_SECURE` | Für lokale HTTP-Entwicklung `false`, in HTTPS-Umgebungen `true` |

Keine produktiven Geheimnisse committen. `.env.example` enthält ausschließlich lokale Beispielwerte.

## Datenbankbefehle

```bash
npm run db:generate
npm run db:migrate -- --name beschreibung
npm run db:seed
npx prisma studio
```

Migrationen werden in `prisma/migrations` versioniert. Seed-Daten sind wiederholt ausführbar und umfassen Rollen, Beispielbenutzer, Maschinentypen, Änderungsgründe und Grundeinstellungen.

## Entwicklung und Prüfung

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Für den ersten Playwright-Lauf kann `npx playwright install chromium` erforderlich sein.

## Architektur

Die Anwendung ist ein modularer Next.js-Monolith:

- `src/app`: Routen, Seiten und serverseitige Actions
- `src/components`: wiederverwendbare Oberfläche und Anwendungsshell
- `src/modules`: fachliche Module wie Authentifizierung, Berechtigungen, Workflow und Audit
- `src/server`: Datenbank- und Infrastrukturadapter
- `prisma`: Schema, Migrationen und Seed
- `e2e`: Playwright-Browsertests

Der aktuelle `SampleIdentityProvider` verwendet ein HTTP-only Cookie und feste Beispielbenutzer. Die Abstraktion `IdentityProvider` erlaubt später den Austausch gegen Microsoft Entra ID. Berechtigungen werden über explizite Permission-Schlüssel serverseitig geprüft.

Geschäftsmutationen sollen `withAudit` verwenden. Dadurch werden Datenänderung und Audit-Eintrag in derselben Datenbanktransaktion gespeichert. Eingereichte und abgeschlossene Datensätze werden in späteren Phasen nur archiviert beziehungsweise gesperrt, niemals hart gelöscht.

Anhänge werden im Prototyp künftig unter `storage/` abgelegt; der Ordner ist von Git ausgeschlossen. Metadaten liegen in PostgreSQL.

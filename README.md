# Falu Change Request

Interne Webanwendung der Falu AG für den vollständigen Lebenszyklus von Änderungsanträgen. Enthalten sind die technische Grundlage sowie die Phase-2-Antragsaufnahme: Entwürfe, Einreichung, Anhänge, Suche, Filter, Detailansicht und Audit-Historie.

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
npm run dev:check
npm run dev:ensure
```

Die Anwendung ist anschließend unter `http://localhost:3000` erreichbar. Die PostgreSQL-Datenbank wird lokal auf Port `5432` bereitgestellt.

## Umgebungsvariablen

| Variable             | Bedeutung                                                       |
| -------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL-Verbindungszeichenfolge für Prisma                   |
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

`npm run dev:ensure` prüft `http://localhost:3000`, startet den Next.js-Entwicklungsserver bei Bedarf im Hintergrund und verhindert einen Doppelstart. Ist Port 3000 durch einen anderen Prozess belegt, wird dies als Fehler gemeldet.

## OpenAI-Unterstützung

Für echte AI-Schreibhilfe und Spracheingabe werden die Provider ausschließlich serverseitig konfiguriert:

```env
AI_PROVIDER="openai"
SPEECH_PROVIDER="openai"
OPENAI_API_KEY="..."
OPENAI_TEXT_MODEL="gpt-5.6"
OPENAI_TRANSCRIPTION_MODEL="gpt-4o-mini-transcribe"
```

Ohne Provider oder API-Schlüssel bleibt die Anwendung normal nutzbar und zeigt einen nicht störenden Hinweis. Für lokale Tests stehen weiterhin `AI_PROVIDER="mock"` und `SPEECH_PROVIDER="mock"` zur Verfügung. API-Schlüssel dürfen nicht committed werden.

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

## Phase-2-Routen

- `/change-requests`: Liste, Suche, Filter, Sortierung und Pagination
- `/change-requests/new`: neuer Entwurf oder direkte Einreichung
- `/change-requests/[id]`: Übersicht, Anhänge und Historie
- `/change-requests/[id]/edit`: Bearbeitung eigener Entwürfe mit Versionsprüfung

Antragsnummern werden beim ersten Speichern serverseitig über einen jährlichen, transaktional aktualisierten Nummernkreis erzeugt. Eine Einreichung erzeugt automatisch die ausstehenden AVOR- und Technik-Freigaben. Lokale Anhänge sind auf PDF, PNG, JPEG, DOCX und XLSX mit maximal 20 MB pro Datei beschränkt.

## Phase-3-Freigabeworkflow

Im Tab `Freigaben` entscheiden AVOR und Technik unabhängig voneinander. Entscheidungen sind unveränderlich, rollenbasiert geschützt und werden gemeinsam mit automatischen Statusübergängen und Audit-Ereignissen transaktional gespeichert. Eine Ablehnung führt zu `Änderung erforderlich`; nach der Überarbeitung erzeugt die erneute Einreichung eine neue Freigaberunde, während frühere Runden vollständig lesbar bleiben.

## Phase-4-Technische-Prüfung

Nach der Freigabe dokumentiert die Technik Sicherheit, Austauschbarkeit, Auswirkungen, bestehende Artikel, nächste Schritte und Dokumentationsstände. Teilstände können gespeichert und später abgeschlossen werden. Abgeschlossene Prüfungen sind gesperrt und können von Technik oder Administration nur mit protokollierter Begründung erneut geöffnet werden.

## Phase-5-AVOR-Auswirkungsprüfung

AVOR und Administration erfassen parallel zur technischen Prüfung die Auswirkungen auf Lagerbestand, Bestellungen, Produktionsaufträge und ausgelieferte Maschinen. Teilstände, Abschluss und begründetes Wiederöffnen werden vollständig auditiert. Sobald eine der beiden Umsetzungsprüfungen beginnt, wechselt der Antrag in `AVOR / Produktionsvorbereitung`; nach Abschluss beider Prüfungen erfolgt der transaktional abgesicherte Übergang zu `Einkauf / Beschaffung`.
# Authentifizierung und Benutzerverwaltung (Phase 9)

Die Anwendung verwendet eine interne E-Mail-/Passwort-Anmeldung. Passwörter werden mit bcrypt (Kostenfaktor 12) gehasht. Ein kryptografisch zufälliger Session-Token liegt in einem `HttpOnly`-, `SameSite=Lax`-Cookie (in Produktion zusätzlich `Secure`); PostgreSQL speichert ausschließlich dessen SHA-256-Hash. Sessions laufen nach sieben Tagen ab und werden bei Abmeldung, Deaktivierung oder Passwort-Reset invalidiert. Alle fachlichen Seiten und Server-Aktionen prüfen die Identität serverseitig.

Sichtbare Rollen sind ausschließlich `Mitarbeiter`, `AVOR`, `Technik` und `Administrator`. Der Prozessschritt **Einkauf / Beschaffung** bleibt bestehen und kann von AVOR oder Administrator bearbeitet werden. Historische Einkauf-Rollen werden durch die Migration in AVOR überführt; Audittexte bleiben unverändert.

Administratoren verwalten weitere Konten unter `/admin/users`. Dort können sie Benutzer erstellen, bearbeiten, aktivieren/deaktivieren und ein temporäres Passwort setzen. Nach einem Reset ist beim nächsten Login eine Passwortänderung erforderlich. Historische Benutzer werden nie gelöscht, und der letzte aktive Administrator kann weder deaktiviert noch seiner Administratorrolle beraubt werden.

## Ersten Produktions-Administrator einrichten

In Railway einmalig folgende Variablen setzen (Werte nicht protokollieren oder committen):

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD` (mindestens 10 Zeichen)
- `BOOTSTRAP_ADMIN_FIRST_NAME`
- `BOOTSTRAP_ADMIN_LAST_NAME`

Danach nicht-destruktiv ausführen:

```bash
npx prisma migrate deploy
NODE_ENV=production npm run db:seed
npm run db:bootstrap-admin
```

Existiert bereits ein aktiver Administrator, ändert der Bootstrap keine Zugangsdaten. `SEED_DEMO_USERS=true` ist ausschließlich für explizite Demo-Umgebungen vorgesehen; Produktions-Seeding legt standardmäßig keine Konten mit bekannten Passwörtern und keine Demo-Anträge an. Lokal verwenden die fiktiven Seed-Konten das nur für Entwicklung bestimmte Passwort `Falu-Dev-2026!`.

Railway muss außerdem `DATABASE_URL` erhalten. Die sichere Cookie-Einstellung wird automatisch aus `NODE_ENV=production` abgeleitet und funktioniert hinter Railway HTTPS ohne fest codierte Domain. Ein verteilter Login-Rate-Limiter ist noch nicht vorhanden; vor breiter Produktionseinführung sollte er am Reverse Proxy oder in einem zentralen Store ergänzt werden. Microsoft Entra ID kann später die interne Anmeldung ersetzen, ohne die fachlichen Benutzer-, Rollen- oder Auditbeziehungen zu verändern.

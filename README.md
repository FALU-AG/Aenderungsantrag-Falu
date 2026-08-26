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

## Persistente Anhänge mit Supabase Storage

Neue Anhänge werden im privaten Supabase-Bucket `change-request-attachments` gespeichert. PostgreSQL enthält weiterhin nur Metadaten und den Objektpfad; Downloads laufen ausschließlich über die authentifizierte Anwendungsroute. Der Service-Role-Key bleibt serverseitig und darf niemals als `NEXT_PUBLIC_`-Variable konfiguriert werden.

```env
DATABASE_URL="postgresql://..." # Prisma/PostgreSQL
SUPABASE_URL="https://PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..." # nur serverseitig
```

Den privaten Bucket einmalig und idempotent einrichten:

```bash
npm run storage:setup
```

`SUPABASE_SERVICE_ROLE_KEY` akzeptiert aus Kompatibilitätsgründen sowohl aktuelle Supabase Secret API Keys (`sb_secret_...`) als auch den bisherigen `service_role`-JWT. Der Wert wird nicht als JWT geparst und niemals an den Browser ausgeliefert. Vor dem Setup kann die Verbindung rein lesend diagnostiziert werden:

```bash
npm run storage:check
```

In Railway werden `DATABASE_URL`, `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` benötigt. Ein Railway Volume ist nicht erforderlich. Historische Datensätze mit Provider `LOCAL` bleiben lokal lesbar, solange die Datei existiert; ist sie in einer Produktionsinstanz nicht vorhanden, zeigt die Downloadroute `Anhang ist nicht mehr verfügbar.` Eine automatische oder destruktive Migration bestehender Dateien findet nicht statt.

Neue Anhänge werden im privaten Bucket `change-request-attachments` unter `change-requests/{requestId}/{attachmentId}/{safeFilename}` abgelegt. Die Anwendung erlaubt PDF, PNG, JPEG, DOCX und XLSX bis maximal 20 MB pro Datei; das Server-Action-Transportlimit ist dafür inklusive Multipart-Overhead auf 21 MB gesetzt. Downloads laufen ausschließlich über die authentifizierte Anwendungsroute. Schlägt die DB-Persistierung nach einem erfolgreichen Upload fehl, wird exakt das zuvor hochgeladene Objekt wieder entfernt.

## Phase-2-Routen

- `/change-requests`: Liste, Suche, Filter, Sortierung und Pagination
- `/change-requests/new`: neuer Entwurf oder direkte Einreichung
- `/change-requests/[id]`: Übersicht, Anhänge und Historie
- `/change-requests/[id]/edit`: Bearbeitung eigener Entwürfe mit Versionsprüfung

Antragsnummern werden beim ersten Speichern serverseitig über einen jährlichen, transaktional aktualisierten Nummernkreis erzeugt. Eine Einreichung erzeugt automatisch die ausstehenden AVOR- und Technik-Freigaben. Lokale Anhänge sind auf PDF, PNG, JPEG, DOCX und XLSX mit maximal 20 MB pro Datei beschränkt.

## Phase-3-Freigabeworkflow

Im Tab `Freigaben` entscheiden AVOR und Technik unabhängig voneinander. Entscheidungen sind unveränderlich, rollenbasiert geschützt und werden gemeinsam mit automatischen Statusübergängen und Audit-Ereignissen transaktional gespeichert. Eine Ablehnung führt zu `Änderung erforderlich`; nach der Überarbeitung erzeugt die erneute Einreichung eine neue Freigaberunde, während frühere Runden vollständig lesbar bleiben.

## E-Mail-Benachrichtigungen und Passwort-Wiederherstellung

E-Mails laufen zentral über eine transaktionale `EmailNotification`-Outbox und den serverseitigen Resend-Provider. Geschäftsdaten werden zuerst committed; Providerfehler werden danach in der Outbox erfasst und verändern den erfolgreichen Workflow nicht. Wiederholungen sind durch fachliche Idempotenzschlüssel und zusätzlich durch den Resend-Idempotency-Key geschützt. Fehlgeschlagene, nicht sicherheitskritische Nachrichten können begrenzt wiederholt werden:

```bash
npm run notifications:retry
```

Passwort-Reset-Links verwenden kryptografisch zufällige, einmalige Tokens mit 30 Minuten Gültigkeit. PostgreSQL speichert ausschließlich deren SHA-256-Hash; nach erfolgreichem Reset werden alle Sessions invalidiert. Roh-Tokens stehen weder in der Outbox noch in Logs. Das bestehende temporäre Admin-Passwort bleibt vorerst erhalten; `USER_INVITATION` ist als Ereignistyp und Templatepfad vorbereitet, ohne Klartextpasswörter per E-Mail zu versenden.

Erforderliche Railway-Variablen:

```env
RESEND_API_KEY="..."
RESEND_WEBHOOK_SECRET="..."
EMAIL_FROM="FALU Change Request <change-request@bestätigte-domain>"
EMAIL_MODE="redirect"
EMAIL_REDIRECT_TO="kontrolliertes-testpostfach@..."
APP_BASE_URL="https://aenderungsantrag-falu-production.up.railway.app"
```

`EMAIL_MODE` muss explizit `disabled`, `redirect` oder `live` sein. Lokal ist `disabled` sicher voreingestellt; `redirect` leitet alle Empfänger an `EMAIL_REDIRECT_TO` um. Den Versand erst nach verifizierter Domain (einschliesslich der von Resend gelieferten SPF-/DKIM-DNS-Einträge) auf `live` stellen. Der Resend-Webhook zeigt auf `/api/webhooks/resend` und wird mit `RESEND_WEBHOOK_SECRET` signaturgeprüft.

### Geplante E-Mail-Jobs auf Railway

Inaktivität wird aus dem jüngsten fachlichen Audit-Ereignis eines eingereichten, noch offenen Änderungsantrags abgeleitet; `submittedAt` dient als Fallback. Seitenaufrufe und das allgemeine `updatedAt` zählen nicht. Nach sieben vollen Tagen wird der Antragsteller informiert, danach höchstens einmal pro weiterem Sieben-Tage-Fenster. Eine neue fachliche Aktivität startet das Fenster neu. Der persönliche Wochen-Digest fasst pro aktivem Benutzer alle zugewiesenen, nicht abgeschlossenen Aufgaben in genau einer Nachricht zusammen.

Railway wertet Cron-Ausdrücke in UTC aus. Damit 08:00 Uhr `Europe/Zurich` sowohl in CET als auch CEST eingehalten wird, werden zwei kurze Cron-Services aus demselben Repository angelegt. Beide übernehmen dieselben Umgebungsvariablen wie der Web-Service und erhalten keinen öffentlichen Domainnamen:

| Service | Start Command | Cron Schedule (UTC) |
| --- | --- | --- |
| Inaktivitätserinnerungen | `npm run notifications:inactivity` | `0 6,7 * * *` |
| Wöchentliche Aufgaben | `npm run notifications:weekly-tasks` | `0 6,7 * * 1` |

Die Skripte prüfen zusätzlich mit der IANA-Zeitzone `Europe/Zurich`, ob lokal tatsächlich 08:00 Uhr ist. Daher arbeitet je nach Sommer-/Winterzeit nur einer der beiden UTC-Läufe; die anderen beenden sich ohne Änderungen. Fachliche Idempotenzschlüssel in der `EmailNotification`-Outbox verhindern doppelte Nachrichten auch bei Wiederholungen. Die Cron-Services müssen nach dem Lauf beendet werden; beide Skripte trennen dafür ihre Prisma-Verbindung. `EMAIL_MODE=disabled`, `redirect` und `live` gelten unverändert auch für diese Jobs.

Sicherer Produktions-Rollout:

1. Sender-Domain in Resend verifizieren und SPF/DKIM einrichten.
2. Railway-Variablen setzen, zunächst `EMAIL_MODE=redirect` mit kontrolliertem Testpostfach.
3. Deploy inklusive `npx prisma migrate deploy` ausführen.
4. Passwort-Reset, AVOR-/Technik-Freigabe, Aufgabenzuweisung, Ablehnung und Abschluss testen.
5. `EmailNotification`-Datensätze und sichere Fehlertexte prüfen.
6. Resend-Webhook konfigurieren und Zustände `sent`, `delivered`, `bounced` und `complained` prüfen.
7. Erst danach `EMAIL_MODE=live` setzen.

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

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

Die Anwendung ist anschließend unter `http://localhost:3000/aenderungsantrag` erreichbar. Die PostgreSQL-Datenbank wird lokal auf Port `5432` bereitgestellt.

## Umgebungsvariablen

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_URL` | PostgreSQL-Verbindungszeichenfolge für Prisma |
| `FALU_APP_SIGNING_PUBLIC_KEY` | Öffentlicher Ed25519-Schlüssel des Portals. Ohne ihn weist die Anwendung jede Anfrage ab |
| `FALU_CHANGE_REQUEST_DIRECTORY_SECRET` | Servicecredential für den signierten Verzeichnisabruf beim Portal |
| `FALU_PORTAL_ORIGIN` | Öffentlicher Portal-Origin. Ohne Angabe `https://admin.falu.com` |
| `FALU_PORTAL_SERVICE_ORIGIN` | Direkter Portal-Origin für den Verzeichnisabruf. Ohne Angabe wie `FALU_PORTAL_ORIGIN` |

Der private Signaturschlüssel liegt ausschliesslich im Portal. Diese Anwendung erhält nur
den öffentlichen Schlüssel und das eng begrenzte Verzeichnis-Credential.

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

`npm run dev:ensure` prüft `http://localhost:3000/aenderungsantrag`, startet den Next.js-Entwicklungsserver bei Bedarf im Hintergrund und verhindert einen Doppelstart. Ist Port 3000 durch einen anderen Prozess belegt, wird dies als Fehler gemeldet.

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

Beim endgültigen Abschluss eines Änderungsantrags erzeugt derselbe serverseitige Text-Provider automatisch eine kurze unternehmensweite Abschlusszusammenfassung. Sie wird am Antrag gespeichert und anschliessend per Slack an alle aktiven Benutzer verteilt. Fehlgeschlagene Generierungen bleiben am Antrag protokolliert und können mit `npm run notifications:retry-completion-summaries` erneut verarbeitet werden.

## Architektur

Die Anwendung ist ein modularer Next.js-Monolith:

- `src/app`: Routen, Seiten und serverseitige Actions
- `src/components`: wiederverwendbare Oberfläche und Anwendungsshell
- `src/modules`: fachliche Module wie Authentifizierung, Berechtigungen, Workflow und Audit
- `src/server`: Datenbank- und Infrastrukturadapter
- `prisma`: Schema, Migrationen und Seed
- `e2e`: Playwright-Browsertests

Die Anwendung besitzt **keine eigene Anmeldung**. Identität und fachliche Rollen kommen bei
jeder Anfrage als signierte Assertion vom FALU Admin Portal; `src/proxy.ts` prüft sie
kryptografisch, bevor irgendein Anwendungscode läuft. Berechtigungen werden darüber hinaus
über explizite Permission-Schlüssel serverseitig geprüft. Details unten unter
„Zentrale Anmeldung".

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

## Slack-Benachrichtigungen und Passwort-Wiederherstellung

Workflow- und Betriebsbenachrichtigungen werden als persönliche Slack-Direktnachrichten über die Slack Web API versendet. Dazu gehören AVOR- und Technik-Freigaben, Überarbeitungsaufforderungen, Freigaben, Aufgaben-Zuweisungen und -Neuzuweisungen, Abschlüsse, Inaktivitätserinnerungen und Wochenübersichten. Die Anwendung löst Empfänger ausschließlich über deren gespeicherte E-Mail-Adresse mit `users.lookupByEmail` auf. AVOR- und Technik-Empfänger folgen den explizit gespeicherten Fachrollen; eine reine Administratorrolle erzeugt keine Fachbenachrichtigung.

Passwort-Reset, Account-Recovery und vorbereitete Einladungen bleiben bei Resend. Normale Workflow-Ereignisse werden nicht zusätzlich per E-Mail versendet.

Alle Ereignisse laufen weiterhin zentral über die bestehende transaktionale `EmailNotification`-Outbox. Der historische Tabellenname bleibt aus Kompatibilitätsgründen bestehen; vorhandene E-Mail-Datensätze werden weder gelöscht noch migriert. Eine zentrale Provider-Abstraktion wählt anhand des Ereignistyps Slack oder E-Mail. Geschäftsdaten werden zuerst committed; Providerfehler oder ein fehlendes Slack-Konto werden danach sicher in der Outbox erfasst und verändern den erfolgreichen Workflow nicht. Fachliche Idempotenzschlüssel verhindern doppelte Nachrichten. Fehlgeschlagene, nicht sicherheitskritische Nachrichten können begrenzt wiederholt werden:

```bash
npm run notifications:retry
```

Passwort-Reset-Links verwenden kryptografisch zufällige, einmalige Tokens mit 30 Minuten Gültigkeit. PostgreSQL speichert ausschließlich deren SHA-256-Hash; nach erfolgreichem Reset werden alle Sessions invalidiert. Roh-Tokens stehen weder in der Outbox noch in Logs. Das bestehende temporäre Admin-Passwort bleibt vorerst erhalten; `USER_INVITATION` ist als Ereignistyp und Templatepfad vorbereitet, ohne Klartextpasswörter per E-Mail zu versenden.

Erforderliche Railway-Variablen:

```env
SLACK_BOT_TOKEN="xoxb-..."
SLACK_NOTIFICATIONS_ENABLED="true"
SLACK_NOTIFICATION_MODE="production"
SLACK_TEST_RECIPIENT_USER_ID=""
RESEND_API_KEY="..."
RESEND_WEBHOOK_SECRET="..."
EMAIL_FROM="FALU Change Request <change-request@bestätigte-domain>"
EMAIL_MODE="redirect"
EMAIL_REDIRECT_TO="kontrolliertes-testpostfach@..."
APP_BASE_URL="https://admin.falu.com/aenderungsantrag"
```

Der Slack Bot benötigt die OAuth-Scopes `chat:write`, `users:read` und `users:read.email`. `SLACK_BOT_TOKEN` ist ausschließlich serverseitig und darf nie als `NEXT_PUBLIC_`-Variable gesetzt werden. Mit `SLACK_NOTIFICATIONS_ENABLED=false` erfolgen keine externen Slack-Aufrufe. `SLACK_NOTIFICATION_MODE=production` verwendet die normale E-Mail-zu-Slack-Auflösung. `SLACK_NOTIFICATION_MODE=test` leitet jede logische Nachricht direkt an die Slack User ID in `SLACK_TEST_RECIPIENT_USER_ID` um und kennzeichnet den ursprünglichen Empfänger; fehlt die Test-ID oder ist der Modus ungültig, wird sicher nichts versendet. Ein fehlender Modus entspricht aus Abwärtskompatibilität `production`. Die Verbindung und Bot-Identität können ohne Testnachricht geprüft werden:

```bash
npm run slack:check
```

`APP_BASE_URL` bezeichnet immer die vollständige, extern sichtbare Wurzel **dieser Anwendung**, einschließlich `/aenderungsantrag`. Alle Slack- und Recovery-Links werden relativ zu dieser Wurzel erzeugt; der Base Path wird weder ausgelassen noch doppelt ergänzt.

`EMAIL_MODE` muss explizit `disabled`, `redirect` oder `live` sein. Lokal ist `disabled` sicher voreingestellt; `redirect` leitet alle Empfänger an `EMAIL_REDIRECT_TO` um. Den Versand erst nach verifizierter Domain (einschliesslich der von Resend gelieferten SPF-/DKIM-DNS-Einträge) auf `live` stellen. Der öffentlich konfigurierte Resend-Webhook lautet nach der Umstellung `https://admin.falu.com/aenderungsantrag/api/webhooks/resend` und wird mit `RESEND_WEBHOOK_SECRET` signaturgeprüft.

## Betrieb unter `/aenderungsantrag`

Next.js ist mit `basePath: "/aenderungsantrag"` gebaut. Normale `Link`- und Router-Navigation verwendet weiterhin interne App-Routen wie `/change-requests`; Next.js ergänzt den Base Path. Native Browser-URLs, Proxy-Redirects, Anhänge und absolute E-Mail-Links verwenden die zentrale Pfadlogik in `src/lib/app-paths.ts`.

- Portal: `https://admin.falu.com/aenderungsantrag`
- Bestehende Railway-Domain: `https://<railway-domain>/aenderungsantrag`
- Resend-Webhook: `https://admin.falu.com/aenderungsantrag/api/webhooks/resend`
- Railway-Root `/`: leitet nicht authentifizierte Aufrufe auf `/aenderungsantrag/login` weiter; die Anwendung selbst bleibt unter dem Base Path erreichbar.

Die Anwendung setzt **kein eigenes Cookie mehr**. Der Cloudflare-Worker entfernt eingehende
Cookies und `Authorization`-Header, bevor die Anfrage den Origin erreicht, und `src/proxy.ts`
tut dasselbe noch einmal. Ein altes `falu-session`-Cookie im Browser bestimmt daher nirgends
mehr Identität oder Rechte.

### Geplante Slack-Jobs auf Railway

Inaktivität wird aus dem jüngsten fachlichen Audit-Ereignis eines eingereichten, noch offenen Änderungsantrags abgeleitet; `submittedAt` dient als Fallback. Seitenaufrufe und das allgemeine `updatedAt` zählen nicht. Nach sieben vollen Tagen wird der Antragsteller informiert, danach höchstens einmal pro weiterem Sieben-Tage-Fenster. Eine neue fachliche Aktivität startet das Fenster neu. Der persönliche Wochen-Digest fasst pro aktivem Benutzer alle zugewiesenen, nicht abgeschlossenen Aufgaben in genau einer Nachricht zusammen.

Railway wertet Cron-Ausdrücke in UTC aus. Damit 08:00 Uhr `Europe/Zurich` sowohl in CET als auch CEST eingehalten wird, läuft ein kurzer Cron-Service aus demselben Repository ohne öffentlichen Domainnamen.

> **Die Variablen sind nicht identisch mit denen des Web-Service** — der Cron-Service hat
> heute einen kleineren Satz. Er benötigt mindestens `DATABASE_URL`, `APP_BASE_URL`,
> `SLACK_BOT_TOKEN`, `SLACK_NOTIFICATIONS_ENABLED` sowie seit der zentralen Anmeldung
> zusätzlich `FALU_APP_SIGNING_PUBLIC_KEY` und `FALU_CHANGE_REQUEST_DIRECTORY_SECRET`.
> Ohne die beiden letzten schlägt **jeder** Wochenlauf fehl, weil der Digest seine Empfänger
> über den zentralen Verzeichnisabruf ermittelt.

| Service | Start Command | Cron Schedule (UTC) |
| --- | --- | --- |
| Persönliche Wochenübersicht | `npm run notifications:weekly-digest` | `0 6,7 * * 1` |

Die früheren Befehle `notifications:inactivity` und `notifications:weekly-tasks` bleiben vorübergehend als kompatible Aliase erhalten. Beide führen ausschließlich die persönliche Wochenübersicht aus; separate Inaktivitätserinnerungen werden nicht mehr versendet.

Die Skripte prüfen zusätzlich mit der IANA-Zeitzone `Europe/Zurich`, ob lokal tatsächlich 08:00 Uhr ist. Daher arbeitet je nach Sommer-/Winterzeit nur einer der beiden UTC-Läufe; die anderen beenden sich ohne Änderungen. Fachliche Idempotenzschlüssel in der bestehenden Outbox verhindern doppelte Nachrichten auch bei Wiederholungen. Die Cron-Services müssen nach dem Lauf beendet werden; beide Skripte trennen dafür ihre Prisma-Verbindung. Zeitlogik, Inaktivitätsfenster und wöchentliche Gruppierung bleiben unverändert; nur der Versandkanal ist Slack.

Sicherer Produktions-Rollout:

1. Slack App installieren und die Scopes `chat:write`, `users:read`, `users:read.email` erteilen.
2. `SLACK_BOT_TOKEN` setzen und mit `npm run slack:check` prüfen.
3. Zunächst `SLACK_NOTIFICATIONS_ENABLED=false` deployen und anschließend bewusst aktivieren.
4. AVOR-/Technik-Freigabe, Aufgabenzuweisung, Ablehnung, Abschluss und Cron-Jobs kontrolliert testen.
5. Outbox-Datensätze und sichere Fehlertexte prüfen; fehlende Slack-Benutzer in Slack beziehungsweise über übereinstimmende E-Mail-Adressen korrigieren.
6. Resend-Konfiguration und Webhook betreffen nur noch Zustellquittungen für fachliche Benachrichtigungen. Passwort-Wiederherstellung findet ausschliesslich im Portal statt.

## Phase-4-Technische-Prüfung

Nach der Freigabe dokumentiert die Technik Sicherheit, Austauschbarkeit, Auswirkungen, bestehende Artikel, nächste Schritte und Dokumentationsstände. Teilstände können gespeichert und später abgeschlossen werden. Abgeschlossene Prüfungen sind gesperrt und können von Technik oder Administration nur mit protokollierter Begründung erneut geöffnet werden.

## Phase-5-AVOR-Auswirkungsprüfung

AVOR und Administration erfassen parallel zur technischen Prüfung die Auswirkungen auf Lagerbestand, Bestellungen, Produktionsaufträge und ausgelieferte Maschinen. Teilstände, Abschluss und begründetes Wiederöffnen werden vollständig auditiert. Sobald eine der beiden Umsetzungsprüfungen beginnt, wechselt der Antrag in `AVOR / Produktionsvorbereitung`; nach Abschluss beider Prüfungen erfolgt der transaktional abgesicherte Übergang zu `Einkauf / Beschaffung`.
# Zentrale Anmeldung

Die Anwendung hat **keine eigene Anmeldung und keine eigene Benutzerverwaltung mehr**.
Identität, Aktivstatus und fachliche Rollen kommen ausschliesslich aus dem FALU Admin Portal.

## Wie eine Anfrage geprüft wird

1. Der Browser ruft `https://admin.falu.com/aenderungsantrag/...` auf.
2. Der Cloudflare-Worker puffert den Rumpf, bildet dessen Hash und fragt das Portal mit
   seinem Servicecredential und dem zentralen Sitzungscookie nach einer Identität.
3. Das Portal prüft Sitzung, Aktivstatus, abgeschlossenen Passwortwechsel, freigeschalteten
   App-Zugriff **und mindestens eine fachliche Rolle**. Erst dann signiert es eine
   Ed25519-Assertion mit maximal **15 Sekunden** Lebensdauer, gebunden an Methode, exakten
   Pfad samt Query und Rumpf-Hash.
4. Der Worker reicht sie als `x-falu-assertion` weiter und entfernt dabei Cookies,
   `Authorization` sowie alle `x-falu-*`, `x-middleware-*` und `x-forwarded-*` Header.
5. `src/proxy.ts` prüft die Signatur unabhängig noch einmal, verifiziert die Request-Bindung
   und verhindert Mehrfachverwendung über einen eindeutigen Eintrag in `AppAssertionUse`.
6. `getSessionUser()` löst die lokale Benutzerzeile **ausschliesslich** über
   `User.externalId` auf. Es gibt keinen Rückfall über die E-Mail-Adresse.

Der Railway-Origin verlangt diese Assertion unabhängig vom Worker. Ein direkter Aufruf ohne
gültigen, frischen Nachweis wird abgewiesen — gefälschte Identitätsheader nützen nichts.

## Rollen

Sichtbare Rollen sind `Mitarbeiter`, `AVOR`, `Technik` und `Administrator`. Sie werden im
Portal pro Benutzer für die Anwendung `Änderungsanträge` vergeben und stehen in jeder
Assertion. Eine Portal-Administratorrolle erteilt **keine** Rechte in dieser Anwendung.

Der Prozessschritt **Einkauf / Beschaffung** bleibt bestehen und kann von AVOR oder
Administration bearbeitet werden.

## Benutzerverwaltung

Konten werden ausschliesslich unter `https://admin.falu.com/admin/users` verwaltet: anlegen,
bearbeiten, aktivieren/deaktivieren, Passwort zurücksetzen sowie App-Zugriff und fachliche
Rollen vergeben. Diese Anwendung hat dafür keine eigene Oberfläche mehr.

Die lokale `User`-Tabelle bleibt bestehen — sie trägt die gesamte Historie (Antragsteller,
Freigaben, Prüfungen, Aufgaben, Kommentare, Anhänge, Audit). Ihre Zeilen werden nie gelöscht.
Verknüpft sind beide Seiten über `User.externalId`.

## Widerruf

Jede Anfrage holt eine frische Assertion. Abmeldung, Deaktivierung, Entzug des App-Zugriffs
und Entzug einer Rolle wirken damit ab dem nächsten Aufruf. Eine bereits ausgestellte, noch
nicht verbrauchte Assertion bleibt höchstens 15 Sekunden gültig und ist nur einmal nutzbar.
Bereits gestartete Vorgänge laufen zu Ende.

## Prüfung

Im Portal-Repository fährt `npm run test:handoff:change-request` die vollständige Kette
Portal → Worker → Änderungsanträge gegen zwei isolierte Wegwerf-Datenbanken durch, mit
ephemeren Schlüsseln und ohne Produktionsdaten.

`SEED_DEMO_USERS=true` ist ausschliesslich für explizite Demo-Umgebungen vorgesehen;
Produktions-Seeding legt standardmässig keine Konten mit bekannten Passwörtern und keine
Demo-Anträge an. Lokal verwenden die fiktiven Seed-Konten das nur für Entwicklung bestimmte
Passwort `Falu-Dev-2026!`. Diese Konten dienen nur der lokalen Entwicklung — anmelden kann
man sich mit ihnen nicht mehr, weil es keine lokale Anmeldung gibt.

Ratenbegrenzung für Anmeldeversuche liegt jetzt im Portal, nicht mehr hier.

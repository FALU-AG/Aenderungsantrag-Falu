# Phase A – Bestandsanalyse zentrale Auth/Rollen

Erhebungsdatum: 2026-09-21. Grundlage ist ausschliesslich der Code beider Repositories
(inklusive **nicht committeter Arbeitsbaum-Änderungen**), nicht die vorhandene Dokumentation.
Es wurden keine Dateien ausser dieser geändert, keine Migration ausgeführt, keine Verbindung
zu Produktionssystemen aufgebaut und keine Secrets ausgelesen.

---

## 0. Nachtrag 22.09.2026 – Entscheidungen und Verifikationslauf

### 0.1 Getroffene Entscheidungen (Florian Kaufmann)

| Nr. | Frage | Entscheidung |
| --- | --- | --- |
| 1 | Umstellungsstrategie | **Stichtag mit Wartungsfenster** – kein Parallelbetrieb zweier Anmeldungen |
| 2 | Rechte der CR-Rolle `ADMINISTRATOR` | **Trennen** – Administrator verwaltet, erteilt aber keine fachlichen Freigaben mehr |
| 3 | Cloudflare-/Railway-Zugang | **Eigener Zugang für die Umsetzung** – noch einzurichten |
| 4 | Direkter Zugriff auf die Railway-Origins | **Wird im selben Zug geschlossen** |
| 5 | Cloudflare-Worker `falu-admin-router` | **Wird in ein eigenes Repository aufgenommen** |
| 6 | Reihenfolge Anmeldung ↔ Rollentrennung | **Nacheinander** – erst der Auth-Cutover, danach separat die Rollentrennung |
| 7 | Beschaffung der Ist-Rollenverteilung | **Ich lese sie lesend aus**, sobald die Railway-Zugänge existieren |
| 8 | Build-Reparatur und Testläufe | **Freigegeben** – ausgeführt, siehe 0.2 |

Auswirkungen auf den Plan:
- Entscheidung 2 erweitert den Auftrag um eine fachliche Änderung (Abschnitt 0.3).
- Entscheidung 4 zieht Phase D2 in den Pflichtumfang.
- Entscheidung 1 macht einen Dual-Mode-Schritt überflüssig, erhöht aber die Anforderungen an die
  Tests vor dem Cutover und verlangt, dass F7 **im selben Wartungsfenster** erfolgt.
- Entscheidung 5 ergänzt Phase D1 als Pflichtschritt.
- Entscheidung 6 löst die Rollentrennung aus Phase C heraus in eine **eigene Phase G nach dem
  Cutover**. Damit ist am Stichtag nur eine Variable im Spiel.
- Entscheidungen 3 und 7 blockieren die Phasen D, E, F und G, bis die Zugänge existieren.
  **Die Phasen B und C sind davon unabhängig und können sofort laufen.**

### 0.2 Verifikationslauf – Ergebnis

Ausgeführt am 22.09.2026, ausschliesslich lokal. Keine Produktionsverbindung, kein Commit,
kein Deployment.

| Prüfung | Portal | Änderungsantrag (vorher) | Änderungsantrag (nach Reparatur) |
| --- | --- | --- | --- |
| `npm run typecheck` | ✅ grün | ✅ grün | ✅ grün |
| `npm run lint` | ✅ grün (`--max-warnings=0`) | ⚠️ 2 Warnungen | ✅ grün, keine Warnungen |
| `npm run build` | ✅ grün, 16 Routen | ❌ **6 Fehler** | ✅ grün, 19 Routen + Proxy |
| `npm test` | ✅ **51/51** | – | ✅ **473/473 in 83 Dateien** |
| Playwright `test:e2e` | – | – | ❌ nicht ausgeführt – bekannt gebrochen (Abschnitt 3.11) |

> ### ⚠️ Befund: Der Arbeitsbaum der Änderungsantrag-App war nie gebaut worden
>
> Die in Abschnitt 4.8 als „zu prüfen" markierte Auffälligkeit war bestätigt und schwerwiegender
> als angenommen. In **zwei** Dateien wurde beim Umbau der neue Import
> `import { centralUser } from "@/modules/auth/directory";` **über** die Direktive `"use server"`
> gesetzt:
>
> - `src/modules/delegations/actions.ts:1-2`
> - `src/modules/tasks/actions.ts:1-2`
>
> Die sieben übrigen Action-Dateien waren korrekt. `tsc` bemerkte das nicht; ESLint meldete es
> nur als Warnung (`@typescript-eslint/no-unused-expressions`). Erst der Build brach ab:
>
> ```
> Error: Turbopack build failed with 6 errors:
> ./src/modules/delegations/actions.ts:2:1
> Error: The "use server" directive must be at the top of the file.
> ./src/modules/tasks/actions.ts:2:1
> Error: The "use server" directive must be at the top of the file.
> ```
>
> **Folgewirkung:** Weil `tasks/actions.ts` nicht als Server-Action-Modul erkannt wurde, zog
> Next.js es über `task-management.tsx` in das **Client-Bundle**. Daraus entstanden die vier
> weiteren Fehler – `next/headers`, `revalidatePath` und zweimal `server-only` wären im
> Browser-Bundle gelandet, unter anderem über `src/modules/auth/session.ts` und
> `src/modules/notifications/service.ts`.
>
> **Behoben am 22.09.2026** (freigegeben durch Entscheidung 8): `"use server"` steht in beiden
> Dateien wieder an erster Stelle. Build, Lint und alle 473 Tests laufen seitdem durch. Die
> Änderung ist auf diese zwei Zeilen begrenzt; es wurde keine Logik angefasst.
>
> **Einordnung, die bestehen bleibt:** Der Arbeitsbaum war **nie erfolgreich gebaut worden**.
> Die Aussage aus Abschnitt 1, die Migration sei „weitgehend implementiert", gilt – sie war aber
> bis zu diesem Zeitpunkt **unverifiziert und nicht deploybar**. Dass jetzt alles grün ist,
> beweist Lauffähigkeit, nicht fachliche Richtigkeit. Ein zeilenweises Review des gesamten
> Arbeitsbaums vor dem Rollout bleibt dringend empfohlen (Phase B6).
>
> **Was die grünen Tests nicht abdecken:** Die 473 Unit-Tests arbeiten mit Mocks. Es gibt
> weiterhin keinen Test, der Portal → Worker → Änderungsantrag durchgängig prüft
> (Phase B7), und die sechs Playwright-Specs sind unverändert gebrochen.

### 0.4 Verifizierte Deployment-Konfiguration (Railway, 22.09.2026)

Lesend über die Railway-CLI und die öffentliche GraphQL-API abgefragt. Damit ist die in
Abschnitt 6.4 als „nicht versioniert und nicht überprüfbar" markierte Lücke geschlossen —
die Konfiguration bleibt unversioniert, ist jetzt aber erhoben.

| Dienst | Builder | Build | Pre-Deploy | Start | Healthcheck | Cron |
| --- | --- | --- | --- | --- | --- | --- |
| Falu-Admin-Portal | RAILPACK | automatisch | **`npx prisma migrate deploy`** | automatisch | `/health` | – |
| Aenderungsantrag-Falu | RAILPACK | automatisch | **`npx prisma migrate deploy`** | automatisch | **nicht gesetzt** | – |
| Weekly Personal Digest | RAILPACK | automatisch | – | `npm run notifications:weekly-digest` | – | `0 6,7 * * 1` |

**Bestätigt:** `prisma migrate deploy` läuft in beiden Diensten automatisch vor jedem
Deployment. **Kein `db push`, kein automatisches Seeding.** Der Cron-Dienst entspricht
exakt der Dokumentation. Alle drei starten mit `restartPolicyType: ON_FAILURE`.

#### Abweichungen und Befunde

| # | Befund | Schwere | Empfehlung |
| --- | --- | --- | --- |
| D1 | Im Änderungsantrag-Dienst existiert eine Umgebungsvariable, deren **Name** mit `sb_secret_` beginnt — das Format eines Supabase Secret API Key. Offenbar wurde beim Anlegen der Schlüssel ins Namensfeld gefügt. Variablennamen sind deutlich weniger geschützt als Werte: sie erscheinen in Oberflächen, Logs und jeder Umgebungsauflistung | **hoch** | Den betroffenen Supabase-Schlüssel **rotieren** und die überzählige Variable löschen. Der reguläre `SUPABASE_SERVICE_ROLE_KEY` existiert daneben bereits |
| D2 | `BOOTSTRAP_ADMIN_EMAIL` und `BOOTSTRAP_ADMIN_PASSWORD` sind in der Produktion weiterhin gesetzt — für ein Bootstrap-Skript, das im Umbau gelöscht wurde | mittel | Beide entfernen. Ein Administrator-Passwort gehört nicht dauerhaft in die Umgebung |
| D3 | `RESEND_WEBHOOK_SECRET` ist **nicht gesetzt**. `webhook.ts:6` wirft ohne Secret, die Route schlägt also sauber fehl (kein Sicherheitsproblem) — aber Zustellstatus von Resend (zugestellt, unzustellbar, Beschwerde) werden dadurch **nie** verarbeitet | mittel | Secret setzen oder den Webhook bewusst als ungenutzt dokumentieren. Unabhängig von diesem Projekt |
| D4 | Der Änderungsantrag-Dienst hat **keinen Healthcheck-Pfad**. Ein fehlgeschlagenes Deployment würde nicht erkannt. `/aenderungsantrag/api/health` existiert und ist im Proxy öffentlich | mittel | Healthcheck eintragen — besonders wichtig für den Stichtag, weil es keinen Rückfallpfad gibt |
| D5 | Der Cron-Dienst hat einen **deutlich kleineren Variablensatz** als der Web-Dienst (kein `RESEND_API_KEY`, kein `EMAIL_*`, kein `SUPABASE_*`, kein `SLACK_NOTIFICATION_MODE`). `README.md:186` behauptet, er übernehme „dieselben Umgebungsvariablen wie der Web-Service" — das stimmt nicht | mittel | Dokumentation korrigieren **und** vor dem Stichtag ergänzen: ohne `FALU_CHANGE_REQUEST_DIRECTORY_SECRET` und `FALU_APP_SIGNING_PUBLIC_KEY` schlägt künftig **jeder** Wochenlauf fehl |
| D6 | Portal fehlt `FALU_CHANGE_REQUEST_DIRECTORY_SECRET`; Änderungsantrag fehlen `FALU_APP_SIGNING_PUBLIC_KEY`, `FALU_PORTAL_ORIGIN`, `FALU_PORTAL_SERVICE_ORIGIN`, `FALU_CHANGE_REQUEST_DIRECTORY_SECRET` | erwartet | Wird in Phase D3 gesetzt. Hier nur zur Vollständigkeit |

Vorhandene Variablennamen (nur Namen, keine Werte gelesen):

- **Portal:** `APP_BASE_URL`, `DATABASE_URL`, `DIRECT_URL`, `FALU_APP_SIGNING_PRIVATE_KEY`,
  `FALU_EDGE_AUTH_SECRET`, `RESEND_API_KEY` (dazu die `RAILWAY_*`-Systemvariablen).
- **Änderungsantrag:** `AI_PROVIDER`, `APP_BASE_URL`, `BOOTSTRAP_ADMIN_EMAIL`,
  `BOOTSTRAP_ADMIN_PASSWORD`, `DATABASE_URL`, `EMAIL_FROM`, `EMAIL_MODE`,
  `EMAIL_REDIRECT_TO`, `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`,
  `OPENAI_TRANSCRIPTION_MODEL`, `RESEND_API_KEY`, `SLACK_BOT_TOKEN`,
  `SLACK_NOTIFICATIONS_ENABLED`, `SLACK_NOTIFICATION_MODE`,
  `SLACK_TEST_RECIPIENT_USER_ID`, `SPEECH_PROVIDER`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_URL` sowie die überzählige Variable aus D1.
- **Cron:** `APP_BASE_URL`, `DATABASE_URL`, `SLACK_BOT_TOKEN`, `SLACK_NOTIFICATIONS_ENABLED`.

### 0.3 Zusätzlicher Umfang aus Entscheidung 2

Heute gilt `effectiveRoles()` (`src/modules/authorization/roles.ts:10`):
`if (roles.includes("ADMINISTRATOR")) return new Set(ROLE_KEYS);` – ein Administrator erhält
**alle** Rollen und damit jede Freigabebefugnis. Zu ändern sind:

| Ort | Heute | Künftig |
| --- | --- | --- |
| `authorization/roles.ts:10` | ADMINISTRATOR ⇒ alle Rollen | ADMINISTRATOR erbt nur `EMPLOYEE`, keine Fachrollen |
| `authorization/permissions.ts:15` | `ADMINISTRATOR: PERMISSIONS` (alle) | Nur Verwaltungsrechte: `ADMIN_MANAGE`, `CHANGE_REQUEST_VIEW`, `CHANGE_REQUEST_CREATE`, `TASK_*` – **ohne** `*_APPROVE_*`, `*_REVIEW_EDIT`, `PURCHASING_EDIT`, `CHANGE_REQUEST_CLOSE` |
| `avor-review/domain.ts` `canEditAvorReview` | `AVOR \|\| ADMINISTRATOR` | nur `AVOR` |
| `technical-review/domain.ts:12` `canEditTechnicalReview` | `TECHNICAL \|\| ADMINISTRATOR` | nur `TECHNICAL` |
| `delegations/authorization.ts:11,28` | ADMINISTRATOR gilt als freigabeberechtigt | nur Fachrolle oder gültige Delegation |
| `final-review/domain.ts:14,23` | `canFinalApprove` / `canRequestFinalChanges` | Fachrolle erforderlich |
| `final-review/domain.ts:29` `canReopenClosed` | ADMINISTRATOR | **bleibt** – reine Verwaltung |
| `change-requests/authorization.ts:6,16` | ADMINISTRATOR darf fremde Entwürfe bearbeiten und löschen | **bleibt** – reine Verwaltung |

**Wichtige Konsequenz, die vor der Umsetzung geklärt werden muss:** Personen, die heute nur
`ADMINISTRATOR` haben und faktisch Freigaben erteilen, verlieren diese Befugnis. Sie brauchen
im Portal zusätzlich explizit `AVOR` und/oder `TECHNICAL`. **Florian muss vor Phase C bestätigen,
wer von den fünf Konten künftig welche Rollen erhält.** Ohne diese Liste ist die Änderung nicht
sicher durchführbar – sie könnte sonst alle Freigaben blockieren.

---

## 1. Zusammenfassung

1. **Wichtigster Befund: Die Migration ist bereits weitgehend implementiert – aber uncommittet.**
   Beide Repos stehen auf Branch `codex/central-auth-integration`, dessen HEAD exakt `origin/main`
   entspricht (`git rev-list --left-right --count origin/main...HEAD` → `0 0`). Der gesamte
   zentrale-Auth-Umbau liegt als **uncommitteter Arbeitsbaum** vor (CR: 60 geänderte Dateien,
   −1085/+157 Zeilen, 7 neue Pfade; Portal: 9 geänderte Dateien, 6 neue Pfade).
2. Die Aufgabenstellung beschreibt den **committeten Stand (= Produktion)**. Der Arbeitsbaum ist
   bereits ein Schritt weiter. Beide Stände sind unten getrennt dokumentiert.
3. Produktion (HEAD): CR hat eigene Auth mit Cookie `falu-session`, eigener `Session`/`Role`/
   `UserRole`-Tabelle, `/admin/users`, lokalen Passwörtern. Der Proxy prüft nur die **Präsenz**
   des Cookies. Portal-Identität und CR-Identität können auseinanderlaufen – das ist der Fehler.
4. Arbeitsbaum: CR besitzt **keine lokale Authentifizierung mehr**. Identität kommt über eine
   Ed25519-signierte, request-gebundene, 15-Sekunden-Assertion im Header `x-falu-assertion`,
   ausgestellt vom Portal, transportiert vom Cloudflare Worker. Replay-Schutz über `AppAssertionUse`.
5. Das Portal hat im Arbeitsbaum ein **generisches App-Rollenmodell** (`ApplicationRole`,
   `UserApplicationRole`) inkl. DB-Trigger, UI und Migration `20260921090000_application_roles`.
6. Für Hintergrundjobs/Delegationen gibt es einen **signierten Verzeichnisabruf**
   (`/api/internal/change-request/directory`) – keine dauerhafte lokale Rollenkopie.
7. Die stabile Portal-ID ist `User.id` (Prisma `cuid()`), unveränderlich; sie landet als `sub`
   in der Assertion und wird lokal auf `User.externalId` gemappt.
8. **Der Worker-Code für `falu-admin-router` liegt in KEINEM der Repos.** Versioniert ist nur ein
   Adapter-Modul im Portal (`integration/cloudflare/change-request.mjs`), das manuell eingebaut
   werden muss. Die tatsächlich deployte Worker-Logik ist nicht überprüfbar.
9. **Offene Lücke: Der Railway-Origin-Bypass ist nicht per Shared Secret geschlossen.** Er ist im
   Arbeitsbaum nur dadurch abgesichert, dass der Origin selbst eine gültige Assertion verlangt.
10. Es gibt **keine `railway.json`/`railway.toml`/`nixpacks.toml`/`Procfile`** in beiden Repos.
    Build-, Pre-Deploy- und Start-Befehle sind nur in README-Prosa dokumentiert und liegen
    ausserhalb der Versionskontrolle im Railway-Dashboard.
11. Vollständige e2e-Suite der CR-App ist durch den Umbau gebrochen (Login-Flow existiert nicht mehr).
12. Empfehlung: **Variante 2 (signierte kurzlebige Assertion)** – bereits implementiert, bewährt sich
    produktiv für Kundeneinsätze, und löst als einzige auch den Origin-Bypass mit.

---

## 2. Admin Portal – Ist-Zustand

Pfad: `C:\Users\kaufmannf\OneDrive - Falu AG\Dokumente\ChatGPT\FALU Admin Portal`
Branch `codex/central-auth-integration` == `origin/main` (HEAD `d66dd6b`), plus Arbeitsbaum-Änderungen.

### 2.1 Tech-Stack und Struktur

| Aspekt | Wert |
| --- | --- |
| Framework | Next.js `16.3.5`, React `19.3.0`, App Router, kein `basePath` |
| Sprache/Build | TypeScript 5, Tailwind 4, ESLint 9 |
| ORM/DB | Prisma `6.19.3`, PostgreSQL (`DATABASE_URL` + `DIRECT_URL`) |
| Auth-Libs | **Eigenbau.** `bcryptjs`, `node:crypto`. Kein NextAuth/Auth.js/Lucia/Clerk/jose |
| Mail | `resend` 6.28.1 |
| Validierung | `zod` 4 |
| Node | `>=22.13.0` |

`package.json`-Scripts:
`dev`, `build` = `prisma generate && next build`, `start` = `next start --hostname 0.0.0.0`,
`typecheck`, `lint`, `test` = `tsx scripts/test.ts`, `postinstall` = `prisma generate`,
`admin:create` = `tsx scripts/create-admin.ts`, `test:http`, `test:handoff`.

Verzeichnisse: `src/app` (Pages, Server Actions unter `src/app/actions`, interne API-Routen unter
`src/app/api/internal/...`), `src/components`, `src/lib/auth`, `src/lib/applications`,
`src/config/applications.ts`, `prisma/migrations`, `tests/`, `scripts/`,
`integration/cloudflare/` (Worker-Adapter), `docs/`.

### 2.2 Prisma-Schema (vollständig)

Enums:
- `PortalRole`: `ADMINISTRATOR`, `ADMIN`, `EMPLOYEE` (nur noch Legacy-Projektion)
- `CentralRole`: `ADMIN`, `MANAGEMENT`, `SALES`, `PURCHASING_AVOR`, `ENGINEERING`,
  `SERVICE_TECHNICIAN`, `EMPLOYEE`

| Modell | Felder / Constraints |
| --- | --- |
| `User` | `id String @id @default(cuid())`, `email @unique`, `firstName`, `lastName`, `passwordHash` (**non-null**), `active` (default true), `mustChangePassword` (default true), `legacyRole PortalRole @map("role")`, `createdAt`, `updatedAt`, `lastLoginAt?`. Index `[legacyRole, active]`. Relationen: `roles`, `sessions`, `passwordResetTokens`, `applicationAccess`, `applicationPermissions` |
| `UserRole` | `@@id([userId, role])`, `role CentralRole`, FK → User `onDelete: Cascade`, Index `[role, userId]` |
| `Session` | `id cuid`, `tokenHash @unique`, `userId`, `expiresAt`, `createdAt`, `lastUsedAt`, FK Cascade, Indizes `[userId]`, `[expiresAt]` |
| `LoginThrottle` | `key @id`, `attempts`, `expiresAt`. Shared über alle Instanzen; Keys sind Hashes |
| `Application` | `id cuid`, `key @unique`, `name`, `description`, `active`, Zeitstempel. Relationen: `access`, `permissions`, `roles` |
| `UserApplicationAccess` | `@@id([userId, applicationId])`, `enabled` (default **false**), FKs Cascade, Relation `roles` |
| `ApplicationPermission` | `id cuid`, `applicationId`, `key`, `name`, `description`, `@@unique([applicationId, key])` |
| `UserApplicationPermission` | `@@id([userId, applicationPermissionId])` |
| `PasswordResetToken` | `userId @unique` (max. 1 offener Token/Benutzer), `tokenHash @unique`, `expiresAt` |
| `ApplicationRole` **(neu, uncommittet)** | `id cuid`, `applicationId`, `key`, `name`, `@@unique([applicationId, key])`, `@@unique([id, applicationId])` |
| `UserApplicationRole` **(neu, uncommittet)** | `@@id([userId, applicationRoleId])`, zusammengesetzter FK `(userId, applicationId)` → `UserApplicationAccess` Cascade, FK `(applicationRoleId, applicationId)` → `ApplicationRole` Cascade, Index `[applicationId, userId]` |

Migrationen: `20260917150000_central_auth`, `20260917170000_multi_role_support`,
`20260917190000_application_permissions`, `20260918080000_password_reset`,
`20260921090000_application_roles` (**uncommittet**).

`20260917190000_application_permissions` seedet fix:
`ADMIN_PORTAL`, `CUSTOMER_SERVICE`, `CHANGE_REQUEST` als `Application`, dazu die vier
`CUSTOMER_SERVICE`-Permissions `VIEW/CREATE/EDIT/MANAGE`. Ein Insert-Trigger
`user_default_portal_access` gibt jedem neuen Benutzer automatisch `ADMIN_PORTAL`-Zugriff.

`20260921090000_application_roles` legt zusätzlich zwei DB-Trigger an, die Datenintegrität erzwingen:
- `application_role_access` (BEFORE INSERT/UPDATE auf `UserApplicationRole`): App-Rolle nur mit
  `enabled=true` Zugriff, sonst `RAISE EXCEPTION 'Application access required'`.
- `application_access_roles` (AFTER UPDATE auf `UserApplicationAccess`): bei `enabled=false`
  werden alle App-Rollen des Benutzers für diese App gelöscht.
Ausserdem seedet sie die vier CHANGE_REQUEST-Rollen mit festen IDs
`cr-role-EMPLOYEE|AVOR|TECHNICAL|ADMINISTRATOR`.

### 2.3 Auth-Implementierung

**Eigenbau, DB-Sessions, kein JWT für die eigene Session.**

- Erzeugung: `AuthService.issue()` (`src/lib/auth/service.ts:259`) – 32 zufällige Bytes
  (`randomBytes(32).toString("hex")`, `policy.ts:7`), gespeichert wird nur SHA-256
  (`policy.ts:6`). Laufzeit `SESSION_SECONDS = 7 * 24 * 60 * 60` (`policy.ts:4`).
- Validierung: `sessionUser()` (`service.ts:41`) prüft Tokenformat `/^[a-f0-9]{64}$/`,
  Existenz, `expiresAt`, `user.active` und `mustChangePassword`.
- `lastUsedAt` wird höchstens minütlich aktualisiert (`service.ts:56`).

**Cookie (`src/lib/auth/policy.ts:3,9-11`):**

```ts
export const SESSION_COOKIE = "falu-admin-session";
export function sessionCookieOptions(production = process.env.NODE_ENV === "production") {
  return { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS };
}
```

| Attribut | Wert |
| --- | --- |
| Name | `falu-admin-session` |
| HttpOnly | ja |
| Secure | nur wenn `NODE_ENV=production` |
| SameSite | `Lax` |
| **Domain** | **nicht gesetzt → host-only für `admin.falu.com`** |
| **Path** | **`/`** |
| Lifetime | 7 Tage (`maxAge` + explizites `expires` in `server.ts:33`) |

CSRF: `checkOrigin()` (`server.ts:29`) vergleicht den `Origin`-Header exakt mit
`APP_BASE_URL` (`policy.ts:12`), zusätzlich `experimental.serverActions.allowedOrigins`
in `next.config.ts` (exakter Host, keine Wildcard).

### 2.4 Passwort-Handling

- bcrypt, Kosten **12** (`PASSWORD_COST`, `policy.ts:5`).
- Mindestlänge 12 Zeichen, max. 72 UTF-8-Bytes (`validation.ts:5-7`).
- Timing-Angleichung: Für unbekannte Konten wird gegen einen Dummy-Hash verglichen
  (`service.ts:27-28`).
- Login-Throttling in `LoginThrottle`: pro E-Mail-Hash 8 Versuche, global 300, Fenster 15 Minuten
  (`service.ts:246-258`).
- `mustChangePassword`: default `true`; Admin-Reset setzt es erneut auf `true` und löscht
  alle Sessions (`service.ts:329-340`).
- Reset-Flow: `requestPasswordReset` (`service.ts:147`) antwortet immer identisch (`RESET_RESPONSE`),
  arbeitet über `after()` nach der HTTP-Antwort, eigene Ratelimit-Buckets
  (3/E-Mail/Stunde, 60/Stunde global, 200/Tag global). Token = 32 Bytes, nur SHA-256 gespeichert,
  Gültigkeit `RESET_SECONDS`. Erfolgreicher Reset löscht **alle** Sessions des Benutzers.

### 2.5 Benutzerverwaltung

| Route/Action | Datei | Wirkung |
| --- | --- | --- |
| `createUserAction` | `src/app/actions/users.ts:25` | `checkOrigin` + `requireAdministrator` + `auth.createUser` |
| `updateUserAction` | `src/app/actions/users.ts:34` | Änderung inkl. `active` und Rollen |
| `resetPasswordAction` | `src/app/actions/users.ts:42` | temporäres Passwort |
| UI | `src/app/admin/users/page.tsx`, `/new`, `/[id]` | Adminbereich |

- Stabile ID: `User.id`, Prisma `cuid()`, **unveränderlich** – es gibt keinen Code-Pfad,
  der `User.id` schreibt oder ändert; `updateUser` (`service.ts:311`) schreibt nur
  `email/firstName/lastName/active/legacyRole` und Rollen.
- Letzter-Admin-Schutz: `service.ts:317-319` (`LAST_ADMIN`).
- Deaktivierung, Rollenwechsel oder E-Mail-Änderung löschen alle Sessions (`service.ts:325`).
- Alle Sicherheitsmutationen laufen unter `pg_advisory_xact_lock(194701, 1)` (`service.ts:35-40`).

> **Beobachteter Defekt (vorbestehend, committet):** `AuthService.bootstrap()` (`service.ts:355-364`)
> parst `roles` aus dem Input, legt den Benutzer aber **ohne `UserRole`-Zeilen** an – es wird nur
> `legacyRole: "ADMINISTRATOR"` gesetzt und `replaceRoles()` nie aufgerufen. Da jede Autorisierung
> ausschliesslich `UserRole` liest (`administrator()`, `service.ts:48-52`), hätte ein über
> `npm run admin:create` gebootstrappter Administrator **keine** `ADMIN`-Rolle. Nicht Teil dieses
> Auftrags, aber vor dem nächsten Bootstrap zu prüfen.

### 2.6 Anwendungszugriffe und App-Rollen

Es existieren **zwei parallele Anwendungslisten**:

| Quelle | Zweck | Schlüssel |
| --- | --- | --- |
| `src/config/applications.ts` (hartcodiert) | nur UI-Kacheln auf `/` | `aenderungsantrag`, `pms`, `service`, `shop` |
| DB-Tabelle `Application` | Autorisierung | `ADMIN_PORTAL`, `CUSTOMER_SERVICE`, `CHANGE_REQUEST` |

Die Kacheln sind **nicht** gefiltert: `src/app/page.tsx:27` rendert `applications.map(...)`
ohne jede Zugriffsprüfung. Nur der Portalzugriff selbst wird geprüft (`page.tsx:9`).

Zuweisung eines Zugriffs: `saveAccessAction` (`src/app/actions/applications.ts:22`) →
`AuthService.setApplicationAccess` (`service.ts:125-143`). Dort werden `enabled`,
`permissionIds` und – neu – `roleIds` atomar gesetzt. Rollen ohne Zugriff werden abgelehnt
(`service.ts:129`). UI: `ApplicationAccessForm` (`src/components/application-forms.tsx:16`).

**Konzept für App-Rollen ist im Arbeitsbaum vorhanden und generisch** (`ApplicationRole` pro
`Application`), aktuell aber nur für `CHANGE_REQUEST` mit Rollen befüllt.
Portal-`ADMIN` erteilt bewusst **keine** impliziten App-Rechte
(`service.ts:70-78` Kommentar, `service.ts:233-236`).

### 2.7 Übergabemechanismus an andere Apps

**Ja – vollständig vorhanden.** Suche nach `sso|assertion|token|sign|jwt|jose|hmac|handoff|redirect|
launch|impersonate|exchange|nonce|audience` ergab:

| Datei | Zweck |
| --- | --- |
| `src/lib/auth/app-assertion.ts` | Assertion-Contract Audience `CUSTOMER_SERVICE` (produktiv) |
| `src/lib/auth/change-request-assertion.ts` **(neu)** | Contract Audience `CHANGE_REQUEST`, Rollen `EMPLOYEE/AVOR/TECHNICAL/ADMINISTRATOR`, Pfad-Bindung `/aenderungsantrag` |
| `service.ts:211` `issueCustomerServiceAssertion` | Ausstellung (Permissions) |
| `service.ts:229` `issueChangeRequestAssertion` **(neu)** | Ausstellung (App-Rollen) |
| `src/app/api/internal/customer-service/identity/route.ts` | Edge-Endpoint |
| `src/app/api/internal/change-request/identity/route.ts` **(neu)** | Edge-Endpoint |
| `src/app/api/internal/change-request/directory/route.ts` **(neu)** | signiertes Benutzerverzeichnis für Jobs |
| `integration/cloudflare/customer-service.mjs`, `change-request.mjs` **(neu)** | Worker-Adapter |
| `scripts/change-request-migration.ts` **(neu)** | Dry-Run/Apply ID-Mapping |

**Assertion-Format** (`change-request-assertion.ts:14-19`):
`base64url(JSON).base64url(Ed25519-Signatur über das erste ASCII-Segment)` – kein
client-wählbarer Algorithmus, keine Key-URL. Strikte Claims:
`v=1`, `iss`, `aud="CHANGE_REQUEST"`, `sub`, `name`, `roles[]`, `iat`, `exp`, `jti`,
`method`, `target`, `bodyHash`. **TTL 15 Sekunden**, keine Clock-Skew-Toleranz
(`APP_ASSERTION_TTL = 15`).

Ausstellungsbedingungen (`service.ts:229-244`): gültige Portal-Session, aktives Konto, kein
erzwungener Passwortwechsel, aktive `CHANGE_REQUEST`-App, `enabled` Zugriff **und mindestens
eine App-Rolle** – sonst `FORBIDDEN`.

Der Endpoint selbst (`identity/route.ts`) verlangt `Authorization: Bearer <FALU_EDGE_AUTH_SECRET>`
per `timingSafeEqual` über SHA-256, erzwingt `content-type: application/json`, begrenzt den Body
auf 8192 Bytes und verlangt einen HTTPS-Origin als Issuer.

### 2.8 Verlinkung zu `/aenderungsantrag`

`src/components/application-card.tsx:23`:

```tsx
<a className="open-link" href={application.path} aria-label={...}>
```

Ein **normaler HTML-Link** (`/aenderungsantrag`), kein Router-Push, keine Query-Parameter,
keine Header. Bewusst eine Dokument-Navigation, damit der Worker den Aufruf vollständig übernimmt.
Es wird nichts mitgegeben – die Identität kommt allein aus dem Cookie, das der Browser wegen
`path=/` und Host-Gleichheit ohnehin an `admin.falu.com/aenderungsantrag` sendet.

Rückweg: `safeReturnPath()` (`src/lib/auth/return-path.ts:2`) ist eine **exakte Allowlist**
`"/" | "/einsaetze" | "/aenderungsantrag"` – alles andere fällt auf `/` zurück.

### 2.9 Middleware / geschützte Routen

**Es gibt keine `middleware.ts` und keine `proxy.ts` im Portal.** Der Schutz liegt
ausschliesslich in den Server Components/Actions:

| Guard | Datei |
| --- | --- |
| `requireUser(allowForced)` | `src/lib/auth/server.ts:12` → `redirect("/login")` bzw. `/account/password` |
| `requireAdministrator()` | `server.ts:18` → `redirect("/")` |
| `requireAnyRole(roles)` | `server.ts:24` |
| `requireApplicationAccess/Permission` | `server.ts:40,45` |

Öffentlich: `/login`, `/forgot-password`, `/reset-password`, `/health` (`src/app/health/route.ts`),
statische Assets, `/icon.svg`. Alles andere ruft `requireUser()`.
Die internen `/api/internal/...`-Routen sind nicht cookie-, sondern secret-geschützt.

### 2.10 Cookie-Domain – entscheidend

Es wird **kein `Domain`-Attribut gesetzt** (`policy.ts:10`). Das Cookie ist damit
**host-only für `admin.falu.com`**. Es ist also **nicht** auf `.falu.com` gesetzt.

Praktische Folge: Weil CR unter demselben Host auf dem Pfad `/aenderungsantrag` läuft und
`path=/` ist, **erreicht das Cookie den CR-Origin bereits heute** – es ist aber ein opakes
Token, das nur das Portal in seiner DB auflösen kann. Eine echte Cross-Subdomain-Nutzung
(z. B. `pms.falu.com`) wäre ohne `Domain=.falu.com` nicht möglich.

### 2.11 Environment-Variablen (nur Namen)

Aus `.env.example`: `DATABASE_URL`, `DIRECT_URL`, `APP_BASE_URL`, `RESEND_API_KEY`,
`FALU_APP_SIGNING_PRIVATE_KEY`, `FALU_EDGE_AUTH_SECRET`.

Im Code zusätzlich verwendet, **fehlt aber in `.env.example`**:
`FALU_CHANGE_REQUEST_DIRECTORY_SECRET` (`directory/route.ts:9`). Ausserdem `NODE_ENV`, `PORT` (Railway).

Worker-Variablen (aus `integration/cloudflare/change-request.mjs`): `FALU_PUBLIC_ORIGIN`,
`FALU_PORTAL_ORIGIN`, `FALU_CHANGE_REQUEST_ORIGIN`, `FALU_EDGE_AUTH_SECRET`, `FALU_STORAGE_ORIGIN`;
für Kundeneinsätze zusätzlich `FALU_CUSTOMER_SERVICE_ORIGIN`.

### 2.12 Tests

`npm test` = `tsx scripts/test.ts` startet über `embedded-postgres` eine kurzlebige lokale
PostgreSQL-Instanz, wendet die echten Migrationen an und läuft gegen diese DB
(`.test-databases/`, git-ignoriert). Suiten:

| Datei | Zeilen | Inhalt |
| --- | --- | --- |
| `tests/auth.test.ts` | 513 | Login, Throttling, Rollen, Benutzerverwaltung, Reset, Bootstrap |
| `tests/http.test.ts` | 195 | Produktionsserver inkl. CSRF |
| `tests/handoff.test.ts` | 43 | Worker-Adapter Kundeneinsätze (Cookie-Isolation, 401→303, Storage-Redirect) |
| `tests/migration.test.ts` | 86 | Migrationen |
| `tests/applications.test.tsx`, `tests/roles.test.tsx`, `tests/reset-mail.test.ts` | 87 | UI/Domänenlogik |

`npm run test:handoff` (`scripts/test-handoff.ts`) startet beide Produktionsserver, zwei isolierte
Datenbanken und den Worker-Adapter mit ephemeren Schlüsseln – **allerdings nur für
Kundeneinsätze** (`FALU_CUSTOMER_SERVICE_REPO`). Ein äquivalenter Ende-zu-Ende-Test für
`CHANGE_REQUEST` existiert nicht; `tests/handoff.test.ts:42` prüft für `/aenderungsantrag`
nur, dass `routeCustomerService` `null` zurückgibt.

---

## 3. Änderungsantrag – Ist-Zustand

Pfad: `C:\Users\kaufmannf\OneDrive - Falu AG\Desktop\Änderungsantrag Application`
Branch `codex/central-auth-integration` == `origin/main` (HEAD `0675ca7`) + grosser Arbeitsbaum.

### 3.1 Tech-Stack

Next.js `16.3.1`, React `19.2.8`, TypeScript, Tailwind 4 + shadcn (`components.json`),
Prisma `^6.19.3` auf PostgreSQL/Supabase, `@supabase/supabase-js`, `resend`, `openai`,
`bcryptjs` (**nur noch in `src/modules/auth/password.ts`, im Arbeitsbaum ohne Aufrufer**),
`zod` 4, `react-hook-form`. Tests: Vitest 4 + RTL + jsdom, Playwright 1.62.
`basePath: "/aenderungsantrag"` (`next.config.ts:5`).

### 3.2 Prisma-Schema – alle Modelle

Enums: `ApprovalType`, `ApprovalStatus`, `DelegationScope`, `ChangeRequestStatus` (9 Werte),
`ReviewAnswer`, `Department`, `TaskPriority`, `TaskStatus`, `StorageProvider`,
`EmailNotificationType` (11 Werte), `EmailNotificationStatus`.

`User` (`prisma/schema.prisma:97-133`):
`id cuid @id`, `name`, `firstName` (default ""), `lastName` (default ""), `email @unique`,
**`passwordHash String?`** (nullable), `department Department?`, `active` (default true),
`mustChangePassword` (default false), `lastLoginAt?`, **`externalId String? @unique`**,
`createdAt`, `updatedAt`.

Weitere Modelle: `ApprovalDelegation`, `PasswordResetToken`, `Session`, `Role`, `UserRole`,
`MachineType`, `ChangeRequestCounter`, `ChangeReason`, `ChangeRequest`,
`ChangeRequestMachineType`, `ChangeRequestReason`, `Approval`, `FinalApproval`,
`TechnicalReview`, `AvorImpactReview`, `PurchasingReview`, `Task`, `EmailNotification`,
`Attachment`, `Comment`, `AuditEvent`, `AppSetting`, **`AppAssertionUse` (neu, uncommittet)**.

Es gibt **kein eigenes `CompletionSummary`-Modell**; Abschlusstexte liegen als
`ChangeRequest.closingRemarks`/`finalComment`.

`externalId` existiert bereits seit `prisma/migrations/20260815120000_init` – es ist **kein
neues Feld**. Bisher war es nur im Cleanup-Report (`production-cleanup.ts:102,162`) gelesen worden.

### 3.3 Auth-Code

**Committeter Stand (Produktion), `git show HEAD`:**

| Element | Ort |
| --- | --- |
| Cookie `falu-session`, 7 Tage, `httpOnly`, `secure` nur in Produktion, `sameSite: lax`, **`path: "/"`**, kein `Domain` | `HEAD:src/modules/auth/session.ts:6,15` |
| Session-Token 32 Bytes base64url, nur SHA-256 gespeichert | `HEAD:session.ts:9-14` |
| `getSessionUser()` lädt Rollen aus lokalen `Role`/`UserRole` | `HEAD:session.ts:23-31` |
| `createSession`, `invalidateCurrentSession`, `invalidateUserSessions` | `HEAD:session.ts:11,17,22` |
| `getCurrentUser()` → `redirect("/login")` | `HEAD:src/modules/auth/index.ts:5` |
| Proxy prüft **nur Cookie-Präsenz** | `HEAD:src/proxy.ts:8` |
| Login/Logout/Forgot/Reset Server Actions | `HEAD:src/modules/auth/actions.ts`, `password-reset.ts` |
| `/admin/users` + Benutzerverwaltung | `HEAD:src/app/admin/users/page.tsx`, `src/modules/users/*` |
| bcrypt Kosten 12, Mindestlänge **10** | `src/modules/auth/password.ts:2,13` |

**Arbeitsbaum (umgebaut):**

| Element | Ort |
| --- | --- |
| Identität aus Header `x-falu-assertion` | `src/modules/auth/session.ts:7` |
| Ed25519-Verifikation gegen `FALU_APP_SIGNING_PUBLIC_KEY`, Issuer `portalOrigin()` | `session.ts:10` |
| Lokaler Benutzer **ausschliesslich über `externalId`**, kein E-Mail-Fallback | `session.ts:12` |
| Rollen kommen **nur** aus `claims.roles`; leere Rollenliste ⇒ `null` | `session.ts:11,14` |
| `mustChangePassword` fest `false`, `active` fest `true` | `session.ts:14` |
| Proxy prüft Signatur, Method/Target/BodyHash-Bindung, Replay, `externalId`-Mapping und Origin | `src/proxy.ts:10-18` |
| Replay-Ledger `AppAssertionUse` (atomarer Unique-Insert) | `src/proxy.ts:13` |
| Cookie/Authorization werden vor dem Weiterreichen entfernt | `src/proxy.ts:17` |
| `/login`, `/forgot-password`, `/reset-password`, `/change-password` → Redirect zum Portal | `src/proxy.ts:9`, `src/app/*/page.tsx` |
| Abmelden verweist auf `portalOrigin() + "/logout"` | `src/components/app-shell.tsx:64,73` |
| Signiertes Benutzerverzeichnis für Jobs/Delegationen | `src/modules/auth/directory.ts` |

**Session-Erzeugung findet in der CR-App im Arbeitsbaum nicht mehr statt.**
Es gibt keine App-eigene Session, kein App-Cookie, keinen Login. Jeder einzelne Request
trägt seine eigene Assertion.

`src/modules/auth/sample-users.ts` (5 Demo-Benutzer) hat **keinen Aufrufer mehr** im Produktivcode.
`src/modules/auth/password.ts` und `src/modules/auth/public-routes.ts` sind ebenfalls weitgehend
verwaist (`public-routes` wird nur noch von `src/app/layout.tsx:7` genutzt).

### 3.4 Trefferliste der gesuchten Symbole

Siehe die vollständige Tabelle in **Abschnitt 4**. Kurzübersicht der Suchbegriffe:

| Begriff | Treffer im Produktivcode (ohne Tests) |
| --- | --- |
| `requireRole` | 2 (Definition `auth/index.ts:14`, Aufruf `app/administration/page.tsx:3`) |
| `hasRole` | 0 (existiert in der CR-App nicht) |
| `hasEffectiveRole` | 2 (`authorization/roles.ts:19`, `auth/index.ts:16`) |
| `getCurrentUser` | 1 Definition + 24 Aufrufe |
| `falu-session` | **0 im Produktivcode**; nur in `session.test.ts:11,12`, `proxy.test.ts:11,12` und `docs/admin-portal-architecture.md:12` |
| `EMPLOYEE/AVOR/TECHNICAL/ADMINISTRATOR` | `auth/types.ts:1` (Quelle), `auth/app-assertion.ts:4`, `authorization/roles.ts`, `authorization/permissions.ts:11-16`, diverse `can*`-Funktionen |
| `session` | nur noch `getSessionUser` (2 Aufrufer) und das Prisma-Modell `Session` (ohne Schreiber) |
| `cookies()` | **0** |
| `headers()` | 2 (`app/layout.tsx:26`, `auth/session.ts:7`) |
| `"use server"` | 9 Dateien |
| `middleware` | keine `middleware.ts`; Next 16 nutzt `src/proxy.ts` (ohne `matcher` ⇒ alle Routen) |

### 3.5 `/admin/users` und lokale Benutzerverwaltung

Im **committeten** Stand gehören dazu:
`src/app/admin/users/page.tsx` (+ `page.test.tsx`), `src/modules/users/actions.ts`,
`create-admin.ts`, `delete-user.ts`, `reset-admin-password.ts` (+ Tests),
`src/components/delete-user-action.tsx`, `login-form.tsx`, `forgot-password-form.tsx`,
`reset-password-form.tsx`, `change-password-form.tsx`, `src/modules/auth/actions.ts`,
`src/modules/auth/password-reset.ts`, sowie die Scripts
`scripts/bootstrap-admin.ts`, `create-admin.ts`, `list-admins.ts`, `reset-admin-password.ts`
und die npm-Scripts `db:bootstrap-admin`, `db:create-admin`, `db:list-admins`,
`db:reset-admin-password`.

Im Arbeitsbaum sind **alle** diese Dateien und Scripts gelöscht. Was noch daran hängt:
- `src/modules/users/domain.ts` (+ Test) existiert weiter – zu prüfen, ob noch benötigt.
- `README.md:218-239` beschreibt weiterhin `/admin/users` und `npm run db:bootstrap-admin`
  (jetzt stale, siehe Abschnitt 9).
- `e2e/authentication.spec.ts` und `e2e/auth-helper.ts` testen genau diesen entfernten Flow.

### 3.6 Base path `/aenderungsantrag`

| Aspekt | Fundstelle |
| --- | --- |
| `basePath: APP_BASE_PATH` | `next.config.ts:5` |
| `APP_BASE_PATH = "/aenderungsantrag"` | `src/lib/app-paths.ts:1` |
| `withBasePath` / `withoutBasePath` / `absoluteAppUrl` | `src/lib/app-paths.ts:3,9,20` |
| Proxy normalisiert eingehende Pfade | `src/proxy.ts:7` |
| Assertion-Bindung erzwingt Präfix `/aenderungsantrag` | `src/modules/auth/app-assertion.ts:8` |
| Server-Action-Origin-Allowlist `["admin.falu.com"]` | `next.config.ts:16` |
| `proxyClientMaxBodySize: "21mb"`, `bodySizeLimit: "21mb"` | `next.config.ts:11,14` |

Annahmen des Codes:
- **Cookie-Path:** Der Arbeitsbaum setzt **kein** Cookie mehr; die Cookie-Path-Frage entfällt dort.
  Der committete Stand setzte `path: "/"` (nicht `/aenderungsantrag`), was in `README.md:180`
  ausdrücklich so dokumentiert ist.
- **Redirect-URLs:** Der Proxy leitet mit **absoluten Portal-URLs** um (`portalLogin()`,
  `proxy.ts:9,21`), interne Redirects nutzen Next-Routen ohne Base Path;
  E-Mail-/Slack-Links über `absoluteAppUrl()` aus `APP_BASE_URL`
  (erwartet inklusive Base Path: `https://admin.falu.com/aenderungsantrag`).

### 3.7 Code, der `externalId` schreibt oder liest

| Datei:Zeile | Richtung | Zweck |
| --- | --- | --- |
| `src/modules/auth/session.ts:12` | lesen | `findUnique({ where: { externalId: claims.sub } })` – Identitätsauflösung |
| `src/proxy.ts:15` | lesen | Mapping-Vorprüfung im Proxy, sonst 403 |
| `src/modules/auth/directory.ts:30-31` | lesen | Verzeichnis-Join lokaler IDs |
| `src/modules/maintenance/production-cleanup.ts:102,162` | lesen | Report „SSO mapping: present/absent" |
| *Portal* `scripts/change-request-migration.ts:20,24,35-37` | lesen **und schreiben** | einziger Schreibpfad: `UPDATE "User" SET "externalId" = ...` |

**Es gibt in der CR-App selbst keinen Code, der `externalId` schreibt.** Das ist bewusst so:
Die Zuordnung erfolgt ausschliesslich über das geprüfte Migrationsskript im Portal-Repo.

### 3.8 Weekly Digest und Slack-Empfänger

`runWeeklyDigest()` (`src/modules/notifications/scheduled.ts:30`):
1. `centralUsers()` – signierter Verzeichnisabruf beim Portal.
2. `db.user.findMany({ where: { id: { in: directory.map(u => u.id) } } })` – nur lokale Benutzer,
   die im zentralen Verzeichnis vorkommen (Join über `externalId`).
3. Rollen für Freigabe-Zeilen kommen aus `directory` (`scheduled.ts:45,48`), **nicht** aus
   lokalen `UserRole`-Tabellen.
4. Empfängeradresse: `recipientEmail` aus dem lokalen Datensatz bzw. `centralUser()`.

Weitere Empfängerermittlung:
- `activeRoleRecipients()` (`recipients.ts:9`) → `centralUsers(tx)` gefiltert nach Rollenschlüssel.
- `requestRecipient()` (`recipients.ts:13`) → Antragsteller, danach `centralUser(applicant.id, tx)`.
- `sendNotification` (`service-core.ts:10`) → `centralUser(recipientUserId)`; ohne Treffer
  wird **nicht** versendet.
- Slack: `slack-client.ts:70-74` löst `users.lookupByEmail` auf – die E-Mail stammt aus der
  **lokalen** `User.email` (via `centralUser()` aus dem Verzeichnis, Feld `email`).

**Was bricht, wenn Identität zentral wird:**
- Jeder Benutzer ohne `externalId`-Mapping verschwindet vollständig aus allen Benachrichtigungen,
  aus dem Digest, aus Delegations-Dropdowns und aus der Aufgabenzuweisung – **stillschweigend**,
  weil überall `flatMap`/`filter` statt Fehlern verwendet wird (`directory.ts:31`).
- Jeder Cron-Lauf und jede Notification benötigt jetzt **Netzwerkerreichbarkeit zum Portal**.
  Fällt das Portal aus, wirft `centralDirectory()` (`directory.ts:10,16`), und der Job schlägt fehl
  (wird in `cron-cli.ts:17` abgefangen und mit Exit 1 beendet).
- `centralUsers()` wird pro Aufruf frisch geholt; in `scheduled.ts`, `inbox/query.ts`,
  `delegations/query.ts` und `recipients.ts` teils **mehrfach pro Request** – es gibt keinen Cache.
  `inbox/query.ts:7` nutzt `cache()` nur pro Request.
- Das Verzeichnis liefert nur Benutzer mit `enabled`-Zugriff, `active`, `mustChangePassword=false`
  **und mindestens einer App-Rolle** (`directory/route.ts:18-19`). Ein Portal-Benutzer mit
  ausstehendem Passwortwechsel fällt damit aus allen Empfängerlisten heraus.

### 3.9 Storage-Zugriff (Supabase)

Mechanismus: **Service-Role-Key serverseitig, keine signierten URLs, kein RLS pro Benutzer.**

- `createSupabaseStorageClient()` (`src/server/storage/supabase-storage-node.ts:10-19`) erzeugt
  einen Client aus `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` mit `persistSession: false`.
- Download: `downloadSupabaseObject()` (`supabase-storage-node.ts:31`) lädt die Bytes
  **serverseitig** aus dem privaten Bucket `change-request-attachments` und streamt sie über die
  eigene Route aus (`src/app/change-requests/[id]/attachments/[attachmentId]/route.ts:13-14`).
- Autorisierung passiert also **ausschliesslich in der Anwendung**:
  `getCurrentUser()` + `requirePermission(user, "CHANGE_REQUEST_VIEW")`
  (`route.ts:8`) plus `deletedAt: null`-Filter (`route.ts:10`).
- Objektschlüssel sind gebunden an `change-requests/<requestId>/<attachmentId>/<safeFilename>`
  (`attachment-storage.ts:12-14`) und werden beim Löschen erneut validiert
  (`delete-change-request.ts:9-12`).

> **Inkonsistenz:** Der Worker-Adapter erlaubt Storage-Redirects nur für Pfade unter
> `prefix + "/api/attachments/"` (`change-request.mjs:69`). Eine solche Route existiert in der
> CR-App nicht, und die App liefert überhaupt keine Redirects zu Supabase aus. Der Zweig ist
> aktuell wirkungslos – nicht falsch, aber irreführend.

### 3.10 Environment-Variablen (nur Namen)

Aus `.env.example`: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`AUTH_COOKIE_SECURE`, `AI_PROVIDER`, `OPENAI_API_KEY`, `SPEECH_PROVIDER`, `OPENAI_TEXT_MODEL`,
`OPENAI_TRANSCRIPTION_MODEL`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`,
`BOOTSTRAP_ADMIN_FIRST_NAME`, `BOOTSTRAP_ADMIN_LAST_NAME`, `SEED_DEMO_USERS`, `RESEND_API_KEY`,
`RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `EMAIL_MODE`, `EMAIL_REDIRECT_TO`, `APP_BASE_URL`,
`SLACK_BOT_TOKEN`, `SLACK_NOTIFICATIONS_ENABLED`, `SLACK_NOTIFICATION_MODE`,
`SLACK_TEST_RECIPIENT_USER_ID`.

Im Arbeitsbaum-Code **neu benötigt, aber noch nicht in `.env.example`**:
`FALU_APP_SIGNING_PUBLIC_KEY`, `FALU_PORTAL_ORIGIN`, `FALU_PORTAL_SERVICE_ORIGIN`,
`FALU_CHANGE_REQUEST_DIRECTORY_SECRET`.

Durch den Umbau **obsolet geworden**: `AUTH_COOKIE_SECURE`, `BOOTSTRAP_ADMIN_*`, `SEED_DEMO_USERS`.
Ausserdem `NEXT_DIST_DIR` (nur lokale Validierungsbuilds), `NODE_ENV`, `PORT`.

### 3.11 Testabdeckung rund um Auth/Rollen

83 Testdateien insgesamt. Auth-/Rollenbezogen:

| Datei | Status nach Umbau |
| --- | --- |
| `src/modules/auth/session.test.ts` | **angepasst** – testet Assertion-Pfad, Legacy-Cookie-Ignoranz, Rollenübernahme, unmapped user |
| `src/proxy.test.ts` | **angepasst** – direkter Origin, Legacy-Cookie, gespoofte Header, Cookie-Stripping |
| `src/modules/auth/actions.test.ts` | **gelöscht** |
| `src/modules/auth/password-reset.test.ts` | **gelöscht** |
| `src/modules/users/create-admin.test.ts`, `delete-user.test.ts`, `reset-admin-password.test.ts` | **gelöscht** |
| `src/app/admin/users/page.test.tsx`, `src/app/reset-password/page.test.tsx` | **gelöscht** |
| `src/components/change-password-form.test.tsx`, `delete-user-action.test.tsx` | **gelöscht** |
| `src/modules/authorization/permissions.test.ts` | unverändert – testet reine Funktionen, bleibt gültig |
| `src/modules/approvals/actions.test.ts`, `delegations/*.test.ts`, `tasks/actions.test.ts`, `technical-review/actions.test.ts` | angepasst (Mocks um `centralUser*` erweitert) |
| `src/modules/notifications/recipients.test.ts`, `scheduled.test.ts`, `service.test.ts`, `workflow.test.ts` | angepasst |
| `src/app/layout.test.tsx`, `src/app/delegations/page.test.tsx` | Mocks auf `getCurrentUser`, bleiben gültig |
| **`e2e/auth-helper.ts`, `e2e/authentication.spec.ts`** | **gebrochen** – sie steuern `login`, füllen E-Mail/Passwort, öffnen `admin/users` und erwarten `/aenderungsantrag/login`. Nichts davon existiert mehr |
| `e2e/final-review.spec.ts`, `request-intake.spec.ts`, `shell.spec.ts`, `task-management.spec.ts` | **gebrochen** – alle importieren `loginAs`/`logout` |

Es gibt **keinen** Test, der einen echten Ende-zu-Ende-Durchlauf Portal → Worker → CR abbildet
(das Portal-`test:handoff` deckt nur Kundeneinsätze ab).

---

## 4. Vollständige Autorisierungs-Trefferliste

Legende „serverseitig": **ja** = Prüfung läuft in einer Server Component / Server Action /
Route Handler und blockt die Operation. **nein** = reine UI-Ausblendung (Prop/Rendering).

### 4.1 Perimeter

| Datei:Zeile | Bereich | serverseitig | Bemerkung |
| --- | --- | --- | --- |
| `src/proxy.ts:8` | Perimeter | ja | Öffentlich: `GET/HEAD` auf `/_next/static/*`, `/icon.svg`, `/api/health`; jede Methode auf `/api/webhooks/resend` |
| `src/proxy.ts:9` | Perimeter | ja | `GET/HEAD` auf `/login`, `/forgot-password`, `/reset-password`, `/change-password` → Redirect Portal |
| `src/proxy.ts:11` | Perimeter | ja | Ohne `FALU_APP_SIGNING_PUBLIC_KEY` → 503, fail closed |
| `src/proxy.ts:12-14` | Perimeter | ja | Ed25519-Verifikation + Replay-Insert in `AppAssertionUse` |
| `src/proxy.ts:15` | Perimeter | ja | `externalId`-Mapping Pflicht, sonst 403 |
| `src/proxy.ts:16` | Perimeter/CSRF | ja | Nicht-GET/HEAD/OPTIONS erfordert `Origin === portalOrigin()` |
| `src/proxy.ts:17` | Perimeter | ja | Entfernt `cookie` und `authorization` vor dem Weiterreichen |
| `src/modules/auth/portal-guard.ts:6-22` | Perimeter | ja | Method/Target/BodyHash-Bindung, Body ≤ 21 MiB, `jti`-Consume, leere Rollen ⇒ 403 |
| `src/modules/auth/app-assertion.ts:21-30` | Perimeter | ja | Länge ≤ 10000, Ed25519, Issuer, `iat/exp`, TTL ≤ 15 s |
| `src/modules/auth/session.ts:10-14` | Perimeter | ja | Zweite, unabhängige Verifikation im Request-Kontext |

### 4.2 Guards und Rollenlogik

| Datei:Zeile | Bereich | serverseitig | Bemerkung |
| --- | --- | --- | --- |
| `src/modules/auth/index.ts:6-10` | Guard | ja | `getCurrentUser()`; ohne Identität `redirect(portalLogin())` |
| `src/modules/auth/index.ts:12` | Guard | ja | `requireUser()` = Alias |
| `src/modules/auth/index.ts:14-20` | Guard | ja | `requireRole(...)`, wirft `Error` (kein Status-Mapping) |
| `src/modules/authorization/roles.ts:9-17` | Rollenlogik | n/a | `effectiveRoles()`: **`ADMINISTRATOR` erhält ALLE Rollen**; AVOR/TECHNICAL/ADMINISTRATOR erben `EMPLOYEE` |
| `src/modules/authorization/roles.ts:19-25` | Rollenlogik | n/a | `hasEffectiveRole()` |
| `src/modules/authorization/permissions.ts:11-16` | Rollenlogik | n/a | Rolle→Permission-Matrix, `ADMINISTRATOR: PERMISSIONS` |
| `src/modules/authorization/permissions.ts:33-35` | Guard | ja | `requirePermission()` wirft `AuthorizationError` |

### 4.3 Admin-Routen

| Datei:Zeile | Bereich | serverseitig | Bemerkung |
| --- | --- | --- | --- |
| `src/app/administration/page.tsx:3` | Admin | ja | `requireRole("ADMINISTRATOR")`, dann Redirect `/admin/delegations` |
| `src/app/admin/delegations/page.tsx:8-9` | Admin/Delegation | ja | `getCurrentUser()` + `roles.includes("ADMINISTRATOR")` → `redirect("/")` |
| `src/app/layout.tsx:26-28` | Shell | ja | `getCurrentUser()` für alle nicht-öffentlichen Pfade; `mustChangePassword`-Zweig ist toter Code (immer `false`) |
| `src/app/page.tsx` (Dashboard) | Seite | ja (indirekt) | **Keine eigene Prüfung.** Abgesichert nur durch `proxy.ts` + `layout.tsx:27` |

### 4.4 Server Actions – Änderungsanträge

| Datei:Zeile | Bereich | serverseitig | Bemerkung |
| --- | --- | --- | --- |
| `src/modules/change-requests/actions.ts:36-37` | Erstellen | ja | `getCurrentUser` + `requirePermission("CHANGE_REQUEST_CREATE")` |
| `src/modules/change-requests/actions.ts:313,318` | Attachments | ja | `getCurrentUser` + `requireDraftEdit` |
| `src/modules/change-requests/actions.ts:331,337` | Attachments | ja | `getCurrentUser` + `requireDraftEdit` über die Relation |
| `src/modules/change-requests/actions.ts:360,364` | Einreichen | ja | `getCurrentUser` + `requireDraftEdit` |
| `src/modules/change-requests/actions.ts:466-467` | Löschen | ja | `getCurrentUser` + `permanentlyDeleteChangeRequest` |
| `src/modules/change-requests/authorization.ts:5-11` | Entwurf | ja | `canEditDraft`: Status DRAFT/CHANGES_REQUESTED **und** (Antragsteller **oder** `ADMINISTRATOR`) |
| `src/modules/change-requests/authorization.ts:15-22` | Löschen | ja | `ADMINISTRATOR` erforderlich **und** keine `APPROVED`-Freigabe |
| `src/modules/change-requests/delete-change-request.ts:20,30` | Löschen | ja | Doppelte Prüfung vor und **innerhalb** der Transaktion |

### 4.5 Server Actions – Freigaben und Prüfungen

| Datei:Zeile | Bereich | serverseitig | Bemerkung |
| --- | --- | --- | --- |
| `src/modules/approvals/actions.ts:14-16` | Approval | ja | `resolveApprovalAuthority()` statt `requirePermission`; berücksichtigt Delegation |
| `src/modules/delegations/authorization.ts:26-31` | Approval | ja | `ADMINISTRATOR` oder passende Rolle ⇒ erlaubt; sonst aktive Delegation |
| `src/modules/delegations/authorization.ts:9-23` | Approval | ja | Delegierender muss laut **zentralem Verzeichnis** die Rolle besitzen |
| `src/modules/technical-review/actions.ts:17` | Technical Review | ja | `requirePermission("TECHNICAL_REVIEW_EDIT")` + `canEditTechnicalReview` (Workflow-Gate) |
| `src/modules/technical-review/actions.ts:24` | Technical Review | ja | Reopen, gleiche Permission |
| `src/modules/technical-review/domain.ts:12` | Technical Review | n/a | `TECHNICAL` oder `ADMINISTRATOR` + Gate |
| `src/modules/avor-review/actions.ts:48-49` | AVOR Review | ja | `requirePermission("AVOR_REVIEW_EDIT")` |
| `src/modules/avor-review/actions.ts:141-142` | AVOR Review | ja | Reopen |
| `src/modules/avor-review/domain.ts:5` (`canEditAvorReview`) | AVOR Review | n/a | `AVOR` oder `ADMINISTRATOR` + Statusliste |
| `src/modules/purchasing-review/actions.ts:46-47` | Purchasing | ja | `requirePermission("PURCHASING_EDIT")` |
| `src/modules/purchasing-review/actions.ts:188-189` | Purchasing | ja | zweite Aktion |
| `src/modules/purchasing-review/domain.ts:59` | Purchasing | n/a | `canEditPurchasingReview` |
| `src/modules/final-review/actions.ts:71-73` | Final Approval | ja | `canFinalApprove(user, type)` |
| `src/modules/final-review/actions.ts:172-174` | Final Approval | ja | `canRequestFinalChanges(user)` |
| `src/modules/final-review/actions.ts:224-225` | Final Approval | ja | `canReopenClosed(user)` |
| `src/modules/final-review/domain.ts:14,23,29` | Final Approval | n/a | Reine Rollenprädikate |

### 4.6 Server Actions – Aufgaben, Delegation, Assist

| Datei:Zeile | Bereich | serverseitig | Bemerkung |
| --- | --- | --- | --- |
| `src/modules/tasks/actions.ts:46-47` | Tasks | ja | `requirePermission("TASK_CREATE")` |
| `src/modules/tasks/actions.ts:58` | Tasks | ja | Verantwortlicher muss im **zentralen Verzeichnis** sein (`centralUser`) |
| `src/modules/tasks/actions.ts:100-101` | Tasks | ja | `requirePermission("TASK_UPDATE")` |
| `src/modules/tasks/actions.ts:227-228` | Tasks | ja | `requirePermission("TASK_UPDATE")` |
| `src/modules/delegations/actions.ts:40-45` | Delegation | ja | `assertManageable` (eigener Datensatz **oder** `ADMINISTRATOR`) + `assertScopeManagement` + `validateUsersAndOverlap` |
| `src/modules/delegations/actions.ts:69-73` | Delegation | ja | wie oben, für Update |
| `src/modules/delegations/actions.ts:88-90` | Delegation | ja | `assertManageable` für Cancel |
| `src/modules/delegations/actions.ts:34` | Delegation | ja | Delegierende Person braucht laut Verzeichnis die Scope-Rolle |
| `src/modules/delegations/domain.ts:23,27` | Delegation | n/a | `canManageOwnDelegations`, `canManageDelegation` |
| `src/modules/assist/actions.ts:62-64` | Assist/Speech | ja | Nur `getSessionUser()` – **keine Permission-Prüfung**, jede authentifizierte Identität darf transkribieren |

### 4.7 Routen, Downloads, Cron

| Datei:Zeile | Bereich | serverseitig | Bemerkung |
| --- | --- | --- | --- |
| `src/app/change-requests/[id]/attachments/[attachmentId]/route.ts:8` | Attachments/Storage | ja | `getCurrentUser` + `requirePermission("CHANGE_REQUEST_VIEW")`. **Keine Prüfung, ob der Benutzer diesen Antrag sehen darf** – `CHANGE_REQUEST_VIEW` hat jede Rolle |
| `src/app/api/webhooks/resend/route.ts` | Webhook | ja (eigene Signatur) | Öffentlich im Proxy; prüft `RESEND_WEBHOOK_SECRET` |
| `src/app/api/health/route.ts:1` | Health | n/a | Bewusst öffentlich, datenfrei |
| `src/modules/notifications/scheduled.ts:33` | Weekly Digest / Cron | ja (Servicecredential) | `centralUsers()` mit `FALU_CHANGE_REQUEST_DIRECTORY_SECRET`; läuft ohne Benutzerkontext |
| `src/modules/notifications/recipients.ts:9,13` | Notifications | ja | Empfänger nur aus dem zentralen Verzeichnis |
| `src/modules/notifications/service-core.ts:10` | Notifications | ja | Ohne Verzeichnistreffer kein Versand |
| `src/modules/notifications/workflow.ts:17,49,76` | Notifications | ja | Rollen-/Empfängerauflösung über Verzeichnis |
| `src/modules/inbox/query.ts:10-14` | Inbox | ja | Delegationen nur wirksam, wenn der Delegierende laut Verzeichnis die Rolle hat |
| `src/modules/delegations/query.ts:7-8` | Delegation | ja | Auswahllisten aus dem Verzeichnis |

### 4.8 Reine UI-Ausblendung (keine serverseitige Wirkung)

| Datei:Zeile | Bereich | serverseitig | Bemerkung |
| --- | --- | --- | --- |
| `src/components/app-shell.tsx:70` | Navigation | **nein** | `canCreate={hasPermission(user,"CHANGE_REQUEST_CREATE")}` – Backstop ist `actions.ts:37` |
| `src/app/change-requests/[id]/page.tsx:292` | Tasks | **nein** | `canCreateAndAssign={hasPermission(user,"TASK_CREATE")}` – Backstop `tasks/actions.ts:47` |
| `src/components/role-selector.tsx` | Filter | **nein** | Rollenfilter in Listen |
| `src/app/delegations/page.tsx:10` | Delegation | ja | `canManageOwnDelegations` → `redirect("/")` (Seiten-Guard, nicht nur UI) |
| `src/app/change-requests/new/page.tsx:9` | Erstellen | ja | `requirePermission("CHANGE_REQUEST_CREATE")` als Seiten-Guard |
| `src/app/change-requests/[id]/edit/page.tsx:13` | Bearbeiten | **teilweise** | Lädt `getCurrentUser()`; die eigentliche Sperre ist `requireDraftEdit` in der Action |

> **⛔ Bestätigter Defekt in `delegations/actions.ts:1-2` und `tasks/actions.ts:1-2`:**
> Beide Dateien beginnen mit `import { centralUser } from "@/modules/auth/directory";`, erst in
> Zeile 2 folgt `"use server";`. Die Direktive muss die **erste** Anweisung der Datei sein.
> Der Build bricht deshalb mit 6 Fehlern ab – siehe Abschnitt 0.2. `tasks/actions.ts` wird
> dadurch als Client-Modul behandelt, sodass serverseitiger Code ins Browser-Bundle gerät.
> **Alle Aussagen dieses Abschnitts zu `tasks/actions.ts` und `delegations/actions.ts` sind
> daher zwar als Absicht des Codes korrekt, aber im aktuellen Zustand nicht lauffähig.**

---

## 5. Datenmodell-Abhängigkeiten auf `User` (Änderungsantrag)

Alle Fremdschlüssel, die auf `User` zeigen. `onDelete` ist nur angegeben, wenn es im Schema
explizit gesetzt ist – sonst gilt Prismas Default **`Restrict`** (für optionale Relationen:
`SetNull` nur wenn explizit; hier durchweg `Restrict`, ausser wo vermerkt).

| Modell | Feld | Relationsname | onDelete | Bedeutung |
| --- | --- | --- | --- | --- |
| `UserRole` | `userId` | – | **Cascade** | Lokale Rollenzuordnung |
| `Session` | `userId` | – | **Cascade** | Lokale Sitzung |
| `PasswordResetToken` | `userId` | – | **Cascade** | Lokaler Reset-Token |
| `ChangeRequest` | `applicantId` (NOT NULL) | `Applicant` | Restrict (Default) | **Antragsteller** |
| `ChangeRequest` | `closedById?` | `ClosedBy` | Restrict (Default) | Abschliessende Person |
| `Approval` | `decisionUserId?` | `ApprovalDecisionUser` | Restrict | Entscheider |
| `Approval` | `representedUserId?` | `ApprovalRepresentedUser` | Restrict | Vertretene Person bei Delegation |
| `FinalApproval` | `approvedById` (NOT NULL) | `FinalApprovalUser` | Restrict | Abschlussfreigeber |
| `TechnicalReview` | `completedById?` | `TechnicalReviewCompletedBy` | Restrict | Abschliesser technische Prüfung |
| `AvorImpactReview` | `completedById?` | `AvorReviewCompletedBy` | Restrict | Abschliesser AVOR-Prüfung |
| `PurchasingReview` | `completedById?` | `PurchasingReviewCompletedBy` | Restrict | Abschliesser Einkaufsprüfung |
| `PurchasingReview` | `orderedById?` | `PurchasingReviewOrderedBy` | Restrict | Besteller |
| `Task` | `responsibleUserId?` | `TaskResponsible` | Restrict | Verantwortlicher |
| `Task` | `createdById` (NOT NULL) | `TaskCreator` | Restrict | Ersteller |
| `Task` | `completedById?` | `TaskCompleter` | Restrict | Abschliesser |
| `Attachment` | `uploadedById` (NOT NULL) | – | Restrict | Hochladende Person |
| `Comment` | `authorId` (NOT NULL) | – | Restrict | Kommentarautor |
| `AuditEvent` | `userId?` | – | Restrict | Audit-Akteur |
| `EmailNotification` | `recipientUserId?` | – | **SetNull** | Empfänger; einzige explizite `SetNull`-Beziehung |
| `ApprovalDelegation` | `delegatingUserId` (NOT NULL) | `DelegatingUser` | Restrict | Delegierende Person |
| `ApprovalDelegation` | `substituteUserId` (NOT NULL) | `SubstituteUser` | Restrict | Stellvertreter |
| `ApprovalDelegation` | `createdById` (NOT NULL) | `DelegationCreator` | Restrict | Ersteller der Delegation |

**Fazit:** 19 von 22 Beziehungen sind `Restrict`. Ein lokaler `User` kann faktisch **nicht gelöscht**
werden, sobald er irgendetwas getan hat. Das ist der zentrale Grund, warum die lokale
`User`-Zeile als Domänenreferenz erhalten bleiben muss (siehe Kernfrage E).

Portal-seitig gilt: `UserRole`, `Session`, `PasswordResetToken`, `UserApplicationAccess`,
`UserApplicationPermission` sind alle **Cascade**; `UserApplicationRole` hängt via zusammengesetztem
FK an `UserApplicationAccess` und kaskadiert mit.

---

## 6. Routing / Cloudflare – Ist-Zustand

### 6.1 Worker-Code

**Der Worker `falu-admin-router` liegt in keinem der beiden Repositories.** Es gibt keine
`wrangler.toml`, keine `wrangler.jsonc`, kein `workers/`-Verzeichnis und keinen
Deployment-Job dafür. Bestätigt durch Verzeichnis-Listing und Dateisuche in beiden Repos.

Versioniert ist nur ein **Adapter-Modul**, das manuell in das bestehende Worker-Projekt kopiert
und dort am Anfang des `fetch`-Handlers aufgerufen werden muss:

- `integration/cloudflare/customer-service.mjs` → `routeCustomerService` (committet, produktiv)
- `integration/cloudflare/change-request.mjs` → `routeChangeRequest` (**uncommittet**)

Der Portal-Header dazu (`change-request.mjs:1-2`):
> „Call before the existing path router. null means: continue existing routing.
> Deploy manually; no production Worker configuration is changed by this repository."

**Die tatsächlich deployte Weiterleitungslogik des Produktions-Workers ist aus den Repos nicht
feststellbar** und damit für diese Analyse als „unklar" zu markieren.

### 6.2 Weiterleitungslogik des Adapters `routeChangeRequest`

| Zeile | Verhalten |
| --- | --- |
| `21` | `/api/internal/change-request/*` von aussen ⇒ hart `404` |
| `22` | Nur `/aenderungsantrag` und `/aenderungsantrag/*`; sonst `null` (= bestehendes Routing) |
| `25-28` | Origins müssen HTTPS und exakt origin-förmig sein; `FALU_EDGE_AUTH_SECRET` muss 64 Hex-Zeichen haben – sonst `503` fail closed |
| `29` / `12` | **Header-Bereinigung:** entfernt `x-falu-*`, `x-middleware-*`, `x-forwarded-*`, `authorization`, `cookie`, `host` |
| `31` | Öffentlich (ohne Identitätsabruf): `GET/HEAD` auf `/_next/static/*`, `/icon.svg`, `/api/health`, `/api/webhooks/resend` |
| `34` | Nicht-GET/HEAD/OPTIONS erfordert `Origin === FALU_PUBLIC_ORIGIN`, sonst `403` |
| `35-40` | Body wird **vollständig gepuffert** (Limit 21 MiB, sonst `413`) und SHA-256-gehasht |
| `41-42` | Aus dem Cookie-Header wird **genau ein** `falu-admin-session=<64 hex>` extrahiert; bei 0 oder >1 Treffern leer |
| `43-46` | `POST` an `<FALU_PORTAL_ORIGIN>/api/internal/change-request/identity` mit Bearer-Credential, dem Portal-Cookie und `{method, target, bodyHash}`; `redirect: "manual"`, Timeout 10 s |
| `47-52` | `401`/`409` ⇒ bei `GET/HEAD` und Nicht-API ein `303` auf `/login?returnTo=/aenderungsantrag` bzw. `/account/password`; sonst Deny |
| `53` | Sonstige Fehler: `403` bei 403, sonst `503` |
| `56` | Gültige Assertion wird als `x-falu-assertion` gesetzt |
| `58` | Upstream-Aufruf an `FALU_CHANGE_REQUEST_ORIGIN` mit `cacheEverything: false, cacheTtl: 0` |
| `60` | Aus der Antwort werden `x-falu-*`, `x-middleware-*` und **`set-cookie`** entfernt |
| `61` | Geschützte Antworten bekommen `cache-control: no-store` |
| `62-71` | Redirects werden auf den öffentlichen Origin umgeschrieben; fremde Origins nur für signierte Supabase-Links erlaubt, sonst `503` |

**Werden Method, Body, Header, Cookies vollständig durchgereicht?**

| Element | Antwort |
| --- | --- |
| Method | **Ja**, unverändert (`change-request.mjs:58`) |
| Body | **Ja**, aber gepuffert statt gestreamt (ausser Resend-Webhook, der gestreamt wird) – Limit 21 MiB |
| Header | **Nein, bewusst nicht.** `cookie`, `authorization`, `host`, `x-falu-*`, `x-middleware-*`, `x-forwarded-*` werden entfernt |
| Cookies | **Nein.** Weder Request-Cookies zum Origin noch `Set-Cookie` zurück zum Browser |

Das ist korrekt für das Assertion-Modell, bedeutet aber: Nach dem Umbau kann die CR-App
**keine eigenen Cookies mehr setzen** – alle cookie-basierten Funktionen sind tot.

### 6.3 Direkter Zugriff auf den Railway-Origin

**Es gibt keinen Shared-Secret-Header und keine Cloudflare-spezifische Header-Prüfung
an einem der beiden Origins.** Suche nach `cf-connecting-ip`, `cf-ray`, `cf-access`,
`x-forwarded-host`, `cloudflare` ergab in `src/` beider Repos **null Treffer**.

Es existieren nur diese Prüfungen:

| Wo | Was | Wirkung |
| --- | --- | --- |
| Portal `/api/internal/change-request/identity:15` | `FALU_EDGE_AUTH_SECRET` per `timingSafeEqual` | Schützt **nur** den internen Endpoint, nicht die Portal-Seiten |
| Portal `/api/internal/change-request/directory:12` | `FALU_CHANGE_REQUEST_DIRECTORY_SECRET` + Nonce | Schützt nur das Verzeichnis |
| CR `src/proxy.ts:12` | Gültige, request-gebundene, einmalige Assertion | **Schützt den CR-Origin vollständig** |

Bewertung:

- **Änderungsantrag-Origin (Arbeitsbaum): faktisch geschlossen.** Ein direkter Aufruf der Railway-
  Domain ohne Assertion wird abgewiesen (`proxy.test.ts:11` erwartet `307` auf das Portal-Login).
  Das leistet aber die Anwendung, nicht das Netzwerk.
- **Änderungsantrag-Origin (committeter Produktionsstand): OFFEN.** `HEAD:src/proxy.ts:8` prüft
  nur die **Präsenz** eines `falu-session`-Cookies. Wer die Railway-Domain kennt und ein
  beliebiges `falu-session`-Cookie setzt, passiert den Proxy; erst `getSessionUser()` schlägt
  dann fehl. Für öffentliche Pfade und statische Assets gibt es gar keine Hürde.
- **Portal-Origin: OFFEN.** Der Portal-Origin akzeptiert Requests von überall. Wer die direkte
  Railway-Domain des Portals kennt, kann sich dort normal anmelden (`APP_BASE_URL` wird nur für
  den `Origin`-Vergleich bei Server Actions und für Reset-Links genutzt, nicht als Host-Filter).
  Damit umgeht man alle Worker-seitigen Schutzmassnahmen, Ratelimits und Logging auf Cloudflare-Ebene.

> **Offene Lücke (ausdrücklich festgehalten):** Es gibt aktuell **keine** Prüfung, die direkten
> Zugriff auf einen der beiden Railway-Origins verhindert. Empfohlen wären zusätzlich zur
> Assertion ein Shared-Secret-Header (z. B. `x-falu-edge`) oder Cloudflare mTLS/Tunnel; beides
> ist heute nicht implementiert.

### 6.4 Deployment-Konfiguration

**In keinem der beiden Repos existieren `railway.json`, `railway.toml`, `nixpacks.toml`,
`Procfile` oder `Dockerfile`.** (Die CR-App hat nur eine `docker-compose.yml` für die lokale
Entwicklungsdatenbank.) Sämtliche Railway-Befehle sind ausschliesslich Dashboard-Konfiguration
und damit **nicht versioniert und nicht reviewbar**.

> **Nachtrag 22.09.2026:** Die tatsächliche Konfiguration wurde inzwischen lesend erhoben und
> ist in **Abschnitt 0.4** dokumentiert. Die Dokumentation stimmt: `npx prisma migrate deploy`
> läuft als Pre-Deploy-Befehl, kein `db push`, kein automatisches Seeding. Versioniert ist sie
> weiterhin nicht — Phase D4 bleibt offen.

Dokumentierte Sollwerte:

| Service | Quelle | Befehl (wörtlich zitiert) |
| --- | --- | --- |
| Portal – Install | `README.md:75` | `npm ci --include=dev` |
| Portal – Build | `README.md:75` | `npm run build` |
| Portal – Pre-Deploy | `README.md:76` | **`npx prisma migrate deploy`** |
| Portal – Start | `README.md:77` | `npm start` (= `next start --hostname 0.0.0.0`) |
| Portal – Healthcheck | `README.md:77` | `/health` |
| Portal – Admin-Bootstrap | `README.md:85` | `npm run admin:create` (manuell, interaktives Terminal) |
| CR – Migration | `README.md:232` | **`npx prisma migrate deploy`** |
| CR – Seed | `README.md:233` | `NODE_ENV=production npm run db:seed` |
| CR – Admin-Bootstrap | `README.md:234` | `npm run db:bootstrap-admin` (**Script im Arbeitsbaum gelöscht**) |
| CR – Cron „Persönliche Wochenübersicht" | `README.md:190` | Start Command `npm run notifications:weekly-digest`, Schedule `0 6,7 * * 1` (UTC) |

**Antwort auf die Frage nach automatischem Migrieren/Seeding:**
- `prisma migrate deploy` läuft laut Dokumentation als **Pre-Deploy-Befehl** in beiden Services,
  also **automatisch bei jedem Deploy**. Bestätigen lässt sich das nur im Railway-Dashboard.
- **`db push` wird nirgends verwendet** – weder in `package.json` noch in der Dokumentation.
- **`prisma db seed` läuft NICHT automatisch.** Es ist zwar über `"prisma": { "seed": "tsx prisma/seed.ts" }`
  in der CR-`package.json` registriert, wird aber nur durch manuelles `npm run db:seed` bzw.
  `prisma migrate dev` ausgelöst – nicht durch `migrate deploy`. Das Portal hat gar kein Seed-Script.
- `postinstall: prisma generate` läuft im Portal bei jeder Installation (nur Client-Generierung,
  keine DB-Änderung).

**Weekly-Digest-Service:** Laut `README.md:186-190` ein **eigener Railway-Service aus demselben
Repository**, ohne öffentliche Domain, mit **denselben Umgebungsvariablen wie der Web-Service**.
Nach dem Umbau braucht er zwingend zusätzlich `FALU_PORTAL_ORIGIN` bzw. `FALU_PORTAL_SERVICE_ORIGIN`,
`FALU_CHANGE_REQUEST_DIRECTORY_SECRET` und `FALU_APP_SIGNING_PUBLIC_KEY`.
Seine User-/Rollenabfragen: `centralUsers()` (`scheduled.ts:33`) für Identität und Rollen,
`db.user.findMany({ where: { id: { in: <lokale IDs aus dem Verzeichnis-Join> } } })`
(`scheduled.ts:35`) für Aufgaben, Anträge und empfangene Delegationen sowie
`db.approval.findMany(...)` für offene Freigaben. **Er läuft ohne Benutzerkontext und
authentifiziert sich nur mit dem Verzeichnis-Servicecredential.**

### 6.5 Cookie-Pfade – exakter Beleg

| Anwendung | Cookie | Path | Beleg |
| --- | --- | --- | --- |
| Portal | `falu-admin-session` | **`/`** | `src/lib/auth/policy.ts:10`: `{ httpOnly: true, secure: production, sameSite: "lax", path: "/", maxAge: SESSION_SECONDS }` |
| CR (committet) | `falu-session` | **`/`** (nicht `/aenderungsantrag`) | `HEAD:src/modules/auth/session.ts:15`: `{ httpOnly: true, secure: ..., sameSite: "lax", path: "/", expires: expiresAt }`; bestätigt in `README.md:180` |
| CR (Arbeitsbaum) | – | – | Kein Cookie mehr; `cookies()` kommt im Produktivcode nicht vor |

Beide Cookies liegen also auf `path=/` desselben Hosts. Das ist genau die Konstellation, in der
zwei unabhängige Identitäten koexistieren können – der eigentliche Fehler.

---

## 7. Antworten auf die Kernfragen A–G

### A. Stabile, unveränderliche User-ID im Portal

`User.id`, Typ `String`, erzeugt von Prisma als **`cuid()`** (`prisma/schema.prisma:28`).
Sie wird nirgends im Code geschrieben oder geändert – `updateUser()` (`service.ts:311-328`)
berührt nur `email`, `firstName`, `lastName`, `active`, `legacyRole` und die Rollen.
Sie ist damit unveränderlich und eignet sich als dauerhafter Fremdschlüssel.

Sie erscheint als `sub` in der Assertion (`service.ts:238`, Schema erlaubt 1–128 Zeichen)
und im Verzeichnis als `id` (`directory/route.ts:19`). Auf CR-Seite wird sie in
`User.externalId` (`String? @unique`) gespiegelt.

Kein Bezug zu Entra/`oid`: Die ältere Dokumentation nennt `externalId` als Speicher für den
Entra-Object-ID. Der aktuelle Code verwendet dafür die Portal-cuid.

### B. Bewertung der Übergabemechanismen

Siehe die Vergleichstabelle in **Abschnitt 8**. Kurz:

1. **Gemeinsames Cookie auf `.falu.com` + zentrale Session-Validierung** – technisch möglich
   (heute ist das Cookie host-only), erfordert aber, dass jede App das Portal pro Request
   befragt oder das Session-Geheimnis teilt. Vergrössert den Blast Radius und löst den
   Origin-Bypass nicht.
2. **Signierte kurzlebige Assertion + eigene App-Session** – im Arbeitsbaum implementiert,
   allerdings **ohne** eigene App-Session (jeder Request trägt seine eigene Assertion).
   Beste Sicherheitseigenschaften, höchste Kopplung an den Worker.
3. **Introspection-/Userinfo-API pro Request** – konzeptionell nah an Variante 2, aber die App
   müsste ein Bearer-Token oder Cookie vorlegen, das sie vom Browser bekommt. Das bringt die
   Cookie-Problematik zurück.
4. **Validierung im Cloudflare Worker** – der Worker allein kann Identität feststellen, aber
   nicht beweisbar an den Origin übergeben, ohne einen signierten Nachweis. Ohne Variante 2
   bleibt es bei unsignierten Headern, was der Code an mehreren Stellen ausdrücklich ablehnt
   (`proxy.test.ts:11` testet gespoofte `x-forwarded-user`-Header).

### C. Zwingend nötige Portal-Erweiterungen

Datenmodell – **bereits im Arbeitsbaum vorhanden**:
- `ApplicationRole(id, applicationId, key, name)` mit `@@unique([applicationId, key])` und
  `@@unique([id, applicationId])`.
- `UserApplicationRole(userId, applicationId, applicationRoleId)` mit zusammengesetzten FKs
  auf `UserApplicationAccess` und `ApplicationRole`, sodass die App-Rolle **nur mit aktivem
  App-Zugriff** existieren kann.
- Zwei DB-Trigger, die diese Invariante auch bei direktem SQL erzwingen.

UI – **bereits vorhanden**: Rollen-Checkboxen pro Anwendung in `ApplicationAccessForm`
(`application-forms.tsx:28`), abhängig vom Zugriffshaken; Server-Validierung in
`setApplicationAccess` (`service.ts:128-140`).

**Noch fehlend für „generisch verwaltbar":**
- Eine UI zum **Anlegen/Bearbeiten von `ApplicationRole`-Einträgen**. Es gibt `CatalogForm` für
  Applications und Permissions (`application-forms.tsx:5`), aber keine Server Action und kein
  Formular für App-Rollen. Rollen entstehen heute nur durch die Migration mit festen IDs.
- Die Filterung der Kacheln auf `/` nach `UserApplicationAccess` – heute ungefiltert
  (`src/app/page.tsx:27`), und die hartcodierte Liste in `src/config/applications.ts` ist nicht
  mit der DB-Tabelle `Application` verknüpft (unterschiedliche Schlüsselschreibweisen:
  `aenderungsantrag` vs. `CHANGE_REQUEST`).
- Eine Übersicht „Wer hat welche App-Rolle", heute nur pro Benutzer sichtbar.
- Lockerung von `service.ts:116`: `saveApplicationPermission` verweigert für `CHANGE_REQUEST`
  jede Permission-Pflege („registration-only"). Für weitere Apps muss das generisch werden.

### D. Zwingend zu migrierende Stellen in der CR-App, risikoarme Reihenfolge

Zu migrieren (alle im Arbeitsbaum bereits erledigt, hier zur Verifikation):

1. `src/proxy.ts` – Perimeter.
2. `src/modules/auth/session.ts` – Identitätsquelle.
3. `src/modules/auth/index.ts` – `getCurrentUser`/`requireRole` (Redirect-Ziel Portal).
4. Neue Module: `app-assertion.ts`, `portal-guard.ts`, `portal-config.ts`, `directory.ts`.
5. Alle Stellen, die **andere** Benutzer auflisten oder validieren: `delegations/query.ts`,
   `delegations/authorization.ts`, `delegations/actions.ts`, `tasks/actions.ts`,
   `inbox/query.ts`, `notifications/recipients.ts`, `workflow.ts`, `scheduled.ts`,
   `service-core.ts`.
6. Entfernen: lokale Auth-Actions, `/admin/users`, `users/*`-Module, Auth-Formulare,
   Admin-Scripts, npm-Scripts.
7. Öffentliche Auth-Seiten auf Portal-Redirects reduzieren; `app-shell` Logout auf Portal.
8. Schema: `AppAssertionUse` + Migration.

Risikoarme Reihenfolge:

| Schritt | Inhalt | Rücknehmbar |
| --- | --- | --- |
| 1 | Portal: Migration `application_roles` deployen (rein additiv, keine Datenänderung) | ja |
| 2 | Portal: CHANGE_REQUEST-Rollen und Zugriffe für die 5 Benutzer in der UI setzen | ja |
| 3 | CR: Migration `central_auth_replay` deployen (nur neue Tabelle) | ja |
| 4 | Portal: Assertion- und Directory-Endpoints deployen (ohne Worker wirkungslos) | ja |
| 5 | CR: Dual-Mode-Deploy – Assertion akzeptieren, **aber** Cookie-Login als Fallback belassen | ja |
| 6 | ID-Mapping per Dry-Run prüfen, dann `apply-local` ausführen | ja (`rollback-local`) |
| 7 | Worker-Adapter deployen; ab hier kommen Assertions an | ja (Adapter entfernen) |
| 8 | Nach erfolgreicher Pilotphase: lokale Auth entfernen | **nein** (Code-Löschung) |

Der aktuelle Arbeitsbaum überspringt Schritt 5 – er ist **Big-Bang statt Dual-Mode**.
Das ist die wichtigste Entscheidung, die Florian treffen muss (siehe Abschnitt 10).

### E. Lokale User-Daten, die zwingend erhalten bleiben müssen

| Feld/Tabelle | Warum |
| --- | --- |
| `User.id` | Ziel von 19 `Restrict`-Fremdschlüsseln (Abschnitt 5). Eine Änderung oder Löschung ist unmöglich, ohne die gesamte Historie zu zerstören |
| `User.name` | Wird in Audit-Zusammenfassungen und Delegations-Meldungen als Text gespeichert und in Listen angezeigt (`delegations/actions.ts:52`, `approvals/actions.ts:27`) |
| `User.email` | Einziger Kanal-Schlüssel: Resend-Versand und Slack `users.lookupByEmail` (`slack-client.ts:74`). Kommt aktuell aus der lokalen Zeile (`session.ts:12`) |
| `User.externalId` | Der neue Primärbezug zur zentralen Identität |
| `ChangeRequest.applicantName` | Denormalisierter Namens-Snapshot – bewusst redundant, für Historie |
| `Approval.decisionUserId` / `representedUserId` | Nachweis, wer entschieden und wen vertreten hat |
| `AuditEvent.userId` + `summary` | Revisionssicherheit |
| `ApprovalDelegation.*UserId` | Rechtliche Nachvollziehbarkeit der Vertretung |
| `Attachment.uploadedById`, `Comment.authorId` | Urheberschaft |

**Nicht zwingend, aber behalten:** `Role`, `UserRole`, `Session`, `PasswordResetToken`,
`passwordHash`, `mustChangePassword`. Das Worklog bezeichnet sie als „historische Tabellen erhalten".
`docs/PRODUCTION-ROLLOUT.md` listet sie ebenfalls als „Preserved". Sie sind nach dem Umbau
funktionslos, aber ihre Löschung ist eine eigene, später zu treffende Entscheidung.

**Achtung:** `Session` und `PasswordResetToken` sollten nach dem Umbau **aktiv geleert** werden.
Solange dort Zeilen liegen und der Code irgendwann zurückgerollt würde, gälten alte Sitzungen
wieder (siehe Kernfrage F).

### F. Wo würde ein altes `falu-session`-Cookie heute noch Identität oder Rechte bestimmen?

**Im Arbeitsbaum: an keiner Stelle.** Belege:

| Ort | Verhalten |
| --- | --- |
| `src/proxy.ts:17` | Entfernt `cookie` bevor der Request die App erreicht |
| `src/modules/auth/session.ts:7` | Liest ausschliesslich `x-falu-assertion`, nie `cookies()` |
| Gesamter Produktivcode | `cookies()` kommt **null Mal** vor |
| `integration/cloudflare/change-request.mjs:12` | Der Worker entfernt `cookie` ebenfalls vor dem Upstream-Aufruf |
| `integration/cloudflare/change-request.mjs:41-42` | Zum Portal wird **nur** ein sauberes `falu-admin-session=<64 hex>` gesendet; alles andere wird verworfen |
| `src/modules/auth/session.test.ts:12` | Explizit getestet: „legacy cookie alone never authenticates" |
| `src/proxy.test.ts:11` | Explizit getestet: Legacy-Cookie + gespoofter Header ⇒ Redirect zum Portal-Login |

**Aber – Restrisiken, die ausserhalb dieses Codes liegen:**

1. **Der Browser sendet das alte Cookie weiterhin.** Es liegt host-only auf `admin.falu.com`
   mit `path=/` und 7 Tagen Laufzeit. Es wird von niemandem gelöscht: Der neue Code ruft nirgends
   `cookies().delete("falu-session")` auf, und der Worker entfernt `set-cookie` aus Antworten
   (`change-request.mjs:60`), kann also gar nichts löschen. Das Cookie verfällt erst nach Ablauf.
   ⇒ **Empfehlung: einen einmaligen expliziten Löschpfad einplanen.**
2. **Rollback-Risiko.** Wird die CR-App auf den committeten Stand zurückgerollt, während die
   `Session`-Tabelle noch gefüllt ist, funktionieren alle alten Cookies sofort wieder – mit der
   **alten, lokalen Identität und den alten lokalen Rollen**. Das ist genau der Fehlerzustand,
   der behoben werden soll.
3. **Direkter Railway-Origin im committeten Stand.** Dort bestimmt die reine Cookie-Präsenz,
   ob der Proxy passieren lässt (`HEAD:src/proxy.ts:8`).
4. `docs/admin-portal-architecture.md:12` beschreibt das Cookie weiterhin als aktiven Mechanismus.

### G. Risiken bei der Migration der 5 lokalen Benutzer auf `externalId`

Das Migrationsskript `scripts/change-request-migration.ts` (Portal-Repo) ist sorgfältig gebaut:
Dry-Run als Default, SHA-256-Fingerprint über den Plan, Pflicht-Bestätigung
`CONFIRM_CENTRAL_MIGRATION=APPROVED_MAINTENANCE_WINDOW`, Drift-Erkennung, `rollback-local`/
`rollback-portal`, `SET TRANSACTION READ ONLY` beim Planen, `LOCK TABLE "User"` beim Anwenden.
Trotzdem bleiben konkrete Risiken:

| # | Risiko | Detail |
| --- | --- | --- |
| 1 | **Falsches Mapping wird nicht erkannt** | `mappings.json` wird manuell gepflegt. Das Skript prüft Eindeutigkeit und Existenz, aber **nicht**, ob die Zuordnung fachlich stimmt. Ein vertauschtes Paar führt dazu, dass Person A die komplette Historie von Person B erbt – inklusive ihrer Freigaben. Nicht automatisch erkennbar, da E-Mail-Matching bewusst nicht stattfindet |
| 2 | **Abweichende E-Mails** | Die Portal-E-Mail kann von der lokalen abweichen. `session.ts:14` liefert die **lokale** E-Mail; Slack- und Resend-Versand nutzen diese. Eine im Portal geänderte Adresse schlägt nicht durch |
| 3 | **Namensdrift** | `session.ts:14` nimmt `claims.name` aus dem Portal, aber `User.name` bleibt lokal. Audit-Einträge mischen künftig Portal-Namen (neu) und lokale Namen (historisch, z. B. `delegations/actions.ts:52` liest `db.user.name`) |
| 4 | **Unvollständige Migration = stiller Funktionsverlust** | Ein Benutzer ohne `externalId` wird nirgends als Fehler gemeldet: `directory.ts:31` filtert ihn per `flatMap` heraus, `session.ts:13` gibt `null` zurück, `proxy.ts:15` antwortet 403. Er kann sich nicht anmelden **und** verschwindet aus allen Empfänger- und Auswahllisten |
| 5 | **App-Rolle fehlt** | Die Assertion wird nur ausgestellt, wenn der Benutzer mindestens eine CHANGE_REQUEST-Rolle hat (`service.ts:236`). Zugriff ohne Rolle ⇒ „Kein Zugriff", nicht „bitte anmelden". Das Verzeichnis filtert ebenso (`directory/route.ts:19`) |
| 6 | **`mustChangePassword` sperrt aus** | Das Verzeichnis liefert nur Benutzer mit `mustChangePassword: false` (`directory/route.ts:18`). Ein frisch angelegter Portal-Benutzer mit temporärem Passwort ist damit für Digest, Delegation und Aufgabenzuweisung unsichtbar, bis er sein Passwort geändert hat. Beim Seitenaufruf bekommt er immerhin einen Redirect auf `/account/password` (409 → `change-request.mjs:49`) |
| 7 | **Rollenverschmelzung beim `apply-portal`** | `change-request-migration.ts:44` bildet `[...new Set([...before.roles, ...source.roles])]` – lokale Rollen werden **additiv** ins Portal übernommen. Wer lokal versehentlich `ADMINISTRATOR` hatte, bekommt das zentral ebenfalls |
| 8 | **`effectiveRoles` verstärkt jeden Fehler** | `authorization/roles.ts:10`: `ADMINISTRATOR` erhält **alle** Rollen. Eine einzige falsch vergebene ADMINISTRATOR-Rolle gibt AVOR-, Technik- und Abschlussfreigaberechte |
| 9 | **Kein Audit-Eintrag** | Das Skript schreibt weder im Portal noch in der CR-App einen `AuditEvent` über das gesetzte Mapping. Nachträglich ist nicht belegbar, wer wann welche Zuordnung vorgenommen hat |
| 10 | **Zwei Datenbanken gleichzeitig** | Das Skript braucht `FALU_CR_DATABASE_URL` **und** `FALU_CENTRAL_DATABASE_URL` in einer Umgebung. Das ist der einzige Punkt, an dem beide Produktionsverbindungen gleichzeitig offen sind |
| 11 | **Wartungsfenster** | `apply-local` und `apply-portal` sind zwei getrennte Läufe. Zwischen ihnen ist der Zustand inkonsistent (lokale `externalId` gesetzt, zentrale Rollen fehlen oder umgekehrt) |
| 12 | **5 Benutzer = keine Stichprobe** | Bei fünf Konten fällt ein Fehler bei 20 % der Belegschaft auf einmal an. Ein Pilotbetrieb mit einem Konto ist im aktuellen Big-Bang-Design nicht vorgesehen |

---

## 8. Bewertung der Übergabemechanismen

| Kriterium | (1) Gemeinsames Cookie `.falu.com` | (2) Signierte Assertion (implementiert) | (3) Introspection-API pro Request | (4) Validierung im Worker |
| --- | --- | --- | --- | --- |
| **Voraussetzungen** | `Domain=.falu.com` setzen; alle Apps auf Subdomains desselben Registrable Domain; zentraler Validierungsdienst **oder** geteiltes Session-Secret | Ed25519-Schlüsselpaar; Worker-Adapter deployt; Replay-Ledger in jeder App; Uhren synchron (keine Skew-Toleranz) | Endpoint im Portal; die App muss ein Credential des Benutzers besitzen – also doch wieder ein geteiltes Cookie oder Token | Worker als einzige Vertrauensinstanz; signierte Weitergabe an den Origin (sonst unsignierte Header) |
| **Was der Origin sieht** | Opakes Session-Token | Request-gebundene, signierte Claims | Antwort einer HTTP-Abfrage | Header, dessen Echtheit der Origin nicht prüfen kann |
| **Schutz gegen Header-Spoofing** | – (Token genügt) | **vollständig** (Signatur + Method/Target/BodyHash) | teilweise (Token genügt) | **keiner**, wenn unsigniert |
| **Replay-Schutz** | nein (7 Tage gültig) | **ja** (`jti` einmalig, `AppAssertionUse`) | nein | nein |
| **Revocation-Latenz** | bis zum nächsten zentralen Check | **≤ 15 s** | pro Request | pro Request |
| **Auswirkung auf Railway-Origin-Bypass** | **keine** – wer den Origin kennt und ein Cookie hat, kommt durch | **löst ihn faktisch**: Ohne gültige, frische Assertion gibt es keinen Zugriff, egal über welchen Weg | gering – Origin muss trotzdem selbst prüfen | **verschlimmert ihn**: Der Origin vertraut Headern, die jeder direkt setzen kann |
| **Blast Radius bei Kompromittierung** | **gross** – ein geleaktes Session-Secret öffnet alle Apps | klein – nur der private Schlüssel im Portal ist kritisch; Apps haben nur den öffentlichen | mittel | gross |
| **Latenz** | 1 zusätzlicher Portal-Call pro Request (bei zentraler Validierung) | **1 zusätzlicher Portal-Call pro Request** (Worker → `/identity`, Timeout 10 s) | 1 zusätzlicher Call pro Request | 1 Call pro Request |
| **Kopplung/Betrieb** | sehr hoch (gemeinsamer Session-Lifecycle) | hoch: **ohne Worker keine Funktion**, und der Worker ist nicht versioniert | mittel | sehr hoch |
| **Body-Handling** | unverändert | Body muss im Worker **vollständig gepuffert** werden (21 MiB) – Streaming-Uploads nicht möglich | unverändert | unverändert |
| **Aufwand ab heute** | hoch (Neuentwicklung + Cookie-Domain-Umstellung) | **niedrig – bereits implementiert**, offen sind Verifikation, Tests und Rollout | mittel-hoch | niedrig, aber sicherheitstechnisch nicht vertretbar |
| **Eignung für weitere Apps (PMS, Shop)** | gut, sofern alle unter `.falu.com` | **gut** – Audience pro App, Pfad-Allowlist, App-Rollen generisch | gut | schlecht |

### Empfehlung

**Variante 2 – signierte, kurzlebige, request-gebundene Assertion.** Begründung:

1. **Sie ist bereits vollständig implementiert** – im Portal, in der CR-App und im Worker-Adapter –
   und läuft für Kundeneinsätze bereits produktiv (`origin/main`, Commit `d66dd6b`). Ein Wechsel
   auf eine andere Variante würde funktionierenden, getesteten Code verwerfen und zwei
   unterschiedliche Auth-Modelle für zwei Apps bedeuten.
2. **Sie ist die einzige Variante, die den Railway-Origin-Bypass mitlöst.** Der Origin verlangt
   selbst kryptografischen Nachweis; Netzwerkzugang allein nützt nichts. Bei Variante 1, 3 und 4
   bleibt ein direkt erreichbarer Origin eine offene Flanke.
3. **Kein geteiltes Geheimnis zwischen Apps.** Der private Schlüssel bleibt im Portal; jede App
   erhält nur den öffentlichen Schlüssel. Eine kompromittierte App kann keine Identität für eine
   andere fälschen.
4. **Revocation in ≤ 15 Sekunden**, ohne verteilten Session-Store.
5. **Skaliert auf weitere Apps** über eigene Audience + Pfad-Allowlist – der Contract ist
   bereits zweimal instanziiert (`CUSTOMER_SERVICE`, `CHANGE_REQUEST`) und nahezu identisch.

**Mit diesen Auflagen:**

- Der Worker-Adapter muss versioniert und reviewbar werden. Heute ist die deployte Worker-Logik
  eine Black Box. **Empfehlung: den Worker-Code in ein Repo aufnehmen.**
- Zusätzlich zum Assertion-Schutz einen **Shared-Secret-Header oder mTLS zwischen Worker und
  beiden Railway-Origins** einführen. Die Assertion schützt die CR-App, aber nicht den
  Portal-Origin, an dem man sich direkt anmelden kann.
- Ein Ende-zu-Ende-Test analog `npm run test:handoff` für `CHANGE_REQUEST` ist Pflicht vor Rollout.
- Die 10-Sekunden-Timeout-/Vollpufferung im Worker bei 21 MiB Uploads muss unter realen
  Bedingungen gemessen werden.
- **Dual-Mode statt Big-Bang** erwägen (siehe Abschnitt 10, Entscheidung 1).

---

## 9. Widersprüche zwischen Code und bisheriger Dokumentation

| # | Dokument | Aussage | Tatsächlicher Code |
| --- | --- | --- | --- |
| 1 | `docs/admin-portal-architecture.md` (gesamt) | Zielarchitektur ist **Microsoft Entra ID** als alleinige Identitätsquelle, optional Cloudflare Access; `externalId` speichert den Entra-`oid` | Kein Entra, kein OIDC, kein Cloudflare Access, kein `jose`/JWKS. `externalId` speichert die **Portal-cuid**. Das Portal **ist** der Identity Provider mit eigenen bcrypt-Passwörtern. Das Dokument ist vollständig überholt (bestätigt in `docs/central-auth-worklog.md:6`) |
| 2 | `docs/admin-portal-architecture.md:12` | Cookie `falu-session` ist der aktive Mechanismus | Im Arbeitsbaum existiert das Cookie nicht mehr; `cookies()` wird nicht mehr aufgerufen |
| 3 | `docs/admin-portal-architecture.md` §2 | „Anmeldung: lokale E-Mail/Passwort-Prüfung" in der CR-App | Entfernt; `/login` ist ein reiner Redirect (`src/app/login/page.tsx:3`) |
| 4 | `README.md:218` (CR) | „Administratoren verwalten weitere Konten unter `/admin/users`" | Route und alle zugehörigen Module sind gelöscht |
| 5 | `README.md:234` (CR) | `npm run db:bootstrap-admin` | Script **und** npm-Eintrag gelöscht (`git diff package.json`) |
| 6 | `README.md:239` (CR) | „Die sichere Cookie-Einstellung wird automatisch aus `NODE_ENV=production` abgeleitet" | Es gibt kein Cookie mehr; `AUTH_COOKIE_SECURE` ist funktionslos |
| 7 | `README.md:180` (CR) | „Das Session-Cookie bleibt HttpOnly, SameSite=Lax … Pfad `/`" | Kein Session-Cookie mehr |
| 8 | `README.md:61` (Portal) | „Die Änderungsantrags-App bleibt eine eigenständige Anwendung mit **eigener Anmeldung und eigenem `falu-session`-Cookie**. … Kein SSO, keine Änderungen an dieser Anwendung." | Direkt widerlegt: `issueChangeRequestAssertion`, `identity`- und `directory`-Route, Worker-Adapter und die gesamte CR-Umstellung existieren |
| 9 | `README.md:60` (Portal) | „Anwendungsspezifische Rollen wie AVOR/TECHNICAL … gehören in eine spätere Erweiterung" | `ApplicationRole`/`UserApplicationRole` inkl. UI und Migration sind implementiert |
| 10 | `docs/central-auth-architecture.md` (Portal), letzter Absatz | „Change Request migration remains a separate task" | Diese separate Aufgabe ist im Arbeitsbaum bereits ausgeführt |
| 11 | `docs/central-auth-worklog.md:3` und Portal-`docs/change-request-worklog.md:3` | „Stand 21.09.2026, **vor Implementierung**. Beide Ausgangsbäume sauber" | Beide Arbeitsbäume sind massiv verändert. Die Worklogs beschreiben den Plan, nicht den Zustand |
| 12 | `docs/PRODUCTION-ROLLOUT.md` Tabelle | `Session`, `PasswordResetToken` werden als „Preserved … Auth" geführt | Korrekt als Daten, aber sie sind jetzt funktionslos. Der Runbook-Schritt „login/SSO" (§9) beschreibt einen nicht mehr existierenden Login |
| 13 | Portal `.env.example` | listet `FALU_CHANGE_REQUEST_DIRECTORY_SECRET` **nicht** | Wird in `directory/route.ts:9` zwingend benötigt, sonst 503 |
| 14 | CR `.env.example` | listet `FALU_APP_SIGNING_PUBLIC_KEY`, `FALU_PORTAL_ORIGIN`, `FALU_PORTAL_SERVICE_ORIGIN`, `FALU_CHANGE_REQUEST_DIRECTORY_SECRET` **nicht** | Alle vier sind im Arbeitsbaum Pflicht |
| 15 | Portal `docs/central-auth-architecture.md`, Worker-Tabelle | Nennt nur `FALU_CUSTOMER_SERVICE_ORIGIN` | Der neue Adapter braucht zusätzlich `FALU_CHANGE_REQUEST_ORIGIN` |
| 16 | `integration/cloudflare/change-request.mjs:69` | Storage-Redirects unter `/aenderungsantrag/api/attachments/` | Diese Route existiert nicht; Downloads laufen über `/change-requests/[id]/attachments/[attachmentId]` und liefern Bytes, keine Redirects |

---

## 10. Offene Punkte / Entscheidungen, die Florian treffen muss

> **Stand 22.09.2026:** Die Entscheidungen 1, 3 und 5 sind getroffen (siehe Abschnitt 0.1) und
> unten als *entschieden* markiert. Entscheidung 2 ist offen. Neu hinzugekommen ist
> Entscheidung 13.

**Entscheidung 1 – Big-Bang oder Dual-Mode? → ✅ ENTSCHIEDEN: Stichtag mit Wartungsfenster.**
Der Arbeitsbaum entfernt die lokale Authentifizierung vollständig in einem Schritt. Sobald
deployt, ist die CR-App **ohne funktionierenden Worker unerreichbar**.
*Konsequenz: kein Parallelbetrieb zweier Identitäten, der Fehler ist mit dem Cutover weg.
Es gibt aber keinen Rückfallpfad ausser einem Code-Rollback – und der reaktiviert alle alten
Sessions (siehe Kernfrage F). Daraus folgt zwingend: Schritt F7 (Sessions leeren, Cookie
entwerten) muss **im selben Wartungsfenster** erfolgen, nicht danach. Und der Ende-zu-Ende-Test
aus B7 ist keine Kür, sondern die einzige Absicherung vor dem Cutover.*

**Entscheidung 2 – Wird der Worker-Code versioniert? → ✅ ENTSCHIEDEN: ja, eigenes Repository.**
Aktuell ist die produktiv laufende Weiterleitungslogik in keinem Repo. Damit ist der
sicherheitskritischste Bestandteil der Kette nicht reviewbar, nicht testbar und nicht
rollback-fähig. Umsetzung als Phase D1: eigenes Repo `falu-admin-router` mit `wrangler.toml`,
in das der bestehende Produktions-Worker zuerst unverändert übernommen wird, bevor
`routeChangeRequest` ergänzt wird.

**Entscheidung 3 – Wird der Railway-Origin-Bypass geschlossen? → ✅ ENTSCHIEDEN: ja, im selben Zug.**
Beide Railway-Domains sind heute direkt erreichbar. Die CR-App ist im Arbeitsbaum durch die
Assertion geschützt, **das Portal jedoch nicht** – dort kann man sich direkt anmelden und damit
Worker-seitige Kontrollen und Logs umgehen. Umsetzung als Phase D2; Mechanismus (Shared-Secret-Header,
Cloudflare Tunnel, mTLS oder Railway-IP-Allowlist) wähle ich nach Prüfung der Railway-Optionen aus
und lege ihn vor.

**Entscheidung 4 – Wie wird das alte `falu-session`-Cookie aktiv entwertet?**
Vorschlag: einmalige Route oder Worker-Regel, die `falu-session` mit `Max-Age=0` löscht, plus
`DELETE FROM "Session"` in der CR-DB nach erfolgreichem Cutover.

**Entscheidung 5 – Soll `effectiveRoles` so bleiben? → ✅ ENTSCHIEDEN: nein, trennen.**
`authorization/roles.ts:10`: `ADMINISTRATOR` erhält heute **alle** Rollen. Künftig verwaltet der
Administrator, erteilt aber keine fachlichen Freigaben mehr. Damit folgt die CR-App derselben
Philosophie wie das Portal („Roles are independent: ADMIN does not implicitly grant other
functional roles", `src/lib/roles.ts:21`). Betroffene Code-Stellen: siehe Abschnitt 0.3.
**Voraussetzung: Florian muss die Soll-Rollen der fünf Konten benennen (Entscheidung 13).**

**Entscheidung 6 – E-Mail-Quelle: Portal oder lokal?**
Aktuell kommt der Name aus dem Portal (`claims.name`), die E-Mail aus der lokalen Zeile
(`session.ts:14`). Eine im Portal geänderte Adresse erreicht Resend und Slack nicht.
Soll die E-Mail ebenfalls aus dem Portal stammen (dann muss sie in die Assertion oder der
Verzeichnisabruf muss sie pro Request liefern)?

**Entscheidung 7 – Verhalten bei Portal-Ausfall für Hintergrundjobs.**
`centralDirectory()` wirft bei jedem Portal-Fehler. Der Weekly-Digest beendet sich dann mit
Exit 1 und wird bis zur nächsten Woche nicht erneut ausgeführt. Soll es Retries oder einen
kurzlebigen Cache geben?

**Entscheidung 8 – Verwaltung von App-Rollen im Portal-UI.**
Rollen entstehen heute nur per Migration mit festen IDs (`cr-role-*`). Für PMS/Shop braucht es
eine Pflege-UI. Jetzt bauen oder später?

**Entscheidung 9 – Zeitpunkt und Verfahren des ID-Mappings.**
Wer erstellt `mappings.json`, wer reviewt es, und wie wird fachlich verifiziert, dass die fünf
Zuordnungen korrekt sind? Ohne E-Mail-Matching ist das ein rein manueller Vorgang.
Empfehlung: Vier-Augen-Prinzip und ein Audit-Eintrag nach dem Apply.

**Entscheidung 10 – Umgang mit den gebrochenen e2e-Tests.**
Alle sechs Playwright-Specs hängen an `loginAs()`. Neu schreiben (Assertion-Stub oder
Worker-Emulation) oder vorerst deaktivieren?

**Entscheidung 11 – Portal-Kacheln filtern?**
`src/app/page.tsx:27` zeigt allen Benutzern alle vier Kacheln, unabhängig vom Zugriff. Wer keinen
CHANGE_REQUEST-Zugriff hat, landet nach dem Klick auf „Kein Zugriff". Soll die Kachel
ausgeblendet oder als gesperrt markiert werden?

**Entscheidung 12 – Uhren-Synchronisation.**
Die 15-Sekunden-TTL hat **keine Clock-Skew-Toleranz** (`app-assertion.ts:29`). Bei
Zeitdrift zwischen den Railway-Instanzen schlägt jede Anfrage fehl. Ist NTP auf beiden
Services gewährleistet?

**Entscheidung 13 (neu) – Soll-Rollen der fünf Konten.**
Folgt zwingend aus Entscheidung 5. Für jedes der fünf Konten wird gebraucht: welche
CHANGE_REQUEST-Rollen (`EMPLOYEE`, `AVOR`, `TECHNICAL`, `ADMINISTRATOR`) es künftig haben soll.
Ohne diese Liste würde die Rollentrennung Freigaben blockieren, weil heutige „Nur-Administrator"-
Konten ihre Freigabebefugnis verlieren. Ich liefere die Ist-Liste als Vorlage; Florian bestätigt
oder korrigiert sie.

**Erledigter technischer Punkt:**
~~`src/modules/delegations/actions.ts:1-2` – `"use server"` steht nicht als erste Anweisung.~~
**Bestätigt und blockierend, zusätzlich auch in `tasks/actions.ts`.** Der Build schlägt mit 6
Fehlern fehl. Details in Abschnitt 0.2. Behebung wartet auf Freigabe.

**Zu klärender technischer Punkt (kein Entscheid):**
Die Portal-Migration `20260921090000_application_roles` verwendet feste IDs (`cr-role-*`) und
ein `CROSS JOIN` über eine `VALUES`-Liste. Vor dem Produktionslauf gegen eine Kopie der
Produktionsdatenbank testen (Phase C6).

---

## 11. Vorgeschlagener Umsetzungsplan Phase B–F

Jeder Schritt ist einzeln überprüfbar und – bis Phase E – einzeln rücknehmbar.

### Phase B – Verifikation des vorhandenen Arbeitsbaums (keine Produktionsänderung)

| B# | Schritt | Status / Prüfkriterium |
| --- | --- | --- |
| B1 | Entscheidungen mit Florian klären | ✅ **erledigt 22.09.2026** – 8 Entscheidungen (Abschnitt 0.1); offen nur noch Entscheidung 13 (Soll-Rollen), gebunden an die Zugänge |
| B2 | Portal: `typecheck`, `lint`, `build`, `npm test` | ✅ **erledigt, alle grün** – 16 Routen, 51/51 Tests |
| B3 | CR: `typecheck`, `lint`, `build`, `npm test` | ✅ **erledigt, alle grün nach B4** – 19 Routen, 473/473 Tests in 83 Dateien |
| B4 | `"use server"` in `delegations/actions.ts` und `tasks/actions.ts` an den Dateianfang verschieben | ✅ **erledigt 22.09.2026.** Build grün, 6 Fehler entfallen, Lint ohne Warnungen |
| **B5** | **Zeilenweises Review des gesamten Arbeitsbaums beider Repos** – der Code war nie gebaut und ist daher fachlich unverifiziert | Jede geänderte/neue Datei bewusst gelesen und abgenommen |
| B6 | `.env.example` in beiden Repos um die fehlenden Variablennamen ergänzen (Abschnitt 9, #13/#14) | Review |
| B7 | Portal `tests/handoff.test.ts` um `routeChangeRequest` erweitern (Cookie-Isolation, 401→303, 403, Body-Limit, Static-Bypass) | neue Tests grün |
| **B8** | **Ein `test:handoff`-Pendant für CHANGE_REQUEST bauen:** beide Server, zwei isolierte DBs, ephemere Schlüssel, echter Adapter | End-to-End-Lauf grün. **Pflicht** – bei Entscheidung 1 gibt es keinen Rückfallpfad, das ist die einzige Absicherung vor dem Stichtag |
| B9 | Negativtests: abgelaufene Assertion, Replay, falsche Audience, manipulierter Body, fehlendes `externalId`, fehlende App-Rolle, `mustChangePassword` | alle fail closed |
| B10 | `docs/admin-portal-architecture.md` als überholt kennzeichnen oder ersetzen; READMEs korrigieren (Abschnitt 9, #1–#12) | Review |
| B11 | Prüfen, ob `src/modules/users/domain.ts`, `auth/password.ts`, `auth/sample-users.ts`, `auth/public-routes.ts` noch gebraucht werden | entfernt oder begründet behalten |
| B12 | Beide Arbeitsbäume in Feature-Branches committen (noch kein `main`) | `git status` sauber, Branches gepusht. **Erst nach B5** |

### Phase C – Portal-Erweiterungen

| C# | Schritt | Prüfkriterium |
| --- | --- | --- |
| C1 | Bootstrap-Defekt beheben: `bootstrap()` muss `UserRole` schreiben (`service.ts:355`) | Test deckt „gebootstrappter Admin kann `/admin/users` öffnen" ab |
| C2 | CRUD für `ApplicationRole` (Server Action + `CatalogForm`-Variante), analog zu Permissions | Rolle für eine Test-App anlegbar |
| C3 | `saveApplicationPermission`-Sperre für `CHANGE_REQUEST` (`service.ts:116`) generisch machen oder bewusst dokumentieren | Entscheid dokumentiert |
| C4 | Kachelfilterung auf `/` nach `UserApplicationAccess` (Entscheidung 11); `src/config/applications.ts` an die DB-Schlüssel koppeln | Benutzer ohne Zugriff sieht die Kachel nicht bzw. als gesperrt |
| C5 | Audit-/Änderungsprotokoll für Zugriffs- und Rollenänderungen im Portal | Änderung erzeugt nachvollziehbaren Eintrag |
| C6 | Migration `20260921090000_application_roles` gegen eine Kopie der Produktions-DB testen | Trigger greifen, Bestandsdaten unverändert |

> Die Rollentrennung (Entscheidung 2) ist wegen Entscheidung 6 **nicht** Teil von Phase C.
> Sie bildet die eigene **Phase G nach dem Cutover**.

### Phase D – Infrastruktur und Perimeter

| D# | Schritt | Prüfkriterium |
| --- | --- | --- |
| D1 | **Pflicht (Entscheidung 5).** Worker-Repo `falu-admin-router` anlegen, aktuellen Produktions-Worker dort abbilden, `routeCustomerService` und `routeChangeRequest` integrieren | Worker-Code reviewbar und versioniert, `wrangler deploy` reproduzierbar, Rückkehr zur Vorversion möglich |
| D2 | **Pflicht (Entscheidung 3).** Origin-Bypass schliessen: Shared-Secret-Header oder Cloudflare Tunnel/mTLS am Portal- **und** CR-Origin. Mechanismus nach Prüfung der Railway-Optionen vorlegen | Direkter Railway-Aufruf ohne Nachweis ⇒ 403; Health-Endpoints bleiben erreichbar |
| D3 | Ed25519-Schlüsselpaar und beide Servicecredentials manuell erzeugen, in Railway/Worker als Secrets setzen | Werte nie geloggt, nie im Repo |
| D4 | Deployment-Konfiguration versionieren: `railway.json` je Service mit Build-/Pre-Deploy-/Start-Befehl | Konfiguration im Repo überprüfbar |
| D5 | Uhren-/NTP-Prüfung beider Railway-Services (Entscheidung 12) | Drift < 1 s belegt |
| D6 | Cron-Service um die neuen Variablen ergänzen | Manueller Lauf mit `--ignoreSchedule` erfolgreich |

### Phase E – Datenmigration der 5 Benutzer

| E# | Schritt | Prüfkriterium |
| --- | --- | --- |
| E1 | Verifizierte DB-Backups beider Datenbanken | Wiederherstellung getestet |
| E2 | Die fünf Portal-Konten anlegen/prüfen, `CHANGE_REQUEST`-Zugriff + App-Rollen in der UI setzen, Passwortwechsel abschliessen lassen | `mustChangePassword=false` für alle fünf |
| E3 | `mappings.json` im Vier-Augen-Prinzip erstellen (Entscheidung 9) | zwei Unterschriften |
| E4 | `change-request-migration.ts plan` – Dry-Run, Konflikte = 0 | Plan + Fingerprint archiviert |
| E5 | Wartungsfenster: `apply-portal`, dann `apply-local` | Skript meldet Erfolg; Drift-Prüfungen greifen |
| E6 | Verifikation: alle fünf lokalen Zeilen haben die erwartete `externalId`; Verzeichnisabruf liefert genau fünf Benutzer mit korrekten Rollen | Read-only-Query + `centralUsers()`-Probe |
| E7 | Audit-Eintrag über das Mapping (Entscheidung 9) | Eintrag vorhanden |
| E8 | Rollback-Probe auf einer Kopie: `rollback-local`/`rollback-portal` | stellt Ausgangszustand her |

### Phase F – Cutover und Nachbereitung

| F# | Schritt | Prüfkriterium |
| --- | --- | --- |
| F1 | Portal deployen (Migration + Endpoints). Ohne Worker keine Wirkung | `/health` grün, interner Endpoint ohne Credential ⇒ 401 |
| F2 | CR deployen (Migration `central_auth_replay` + neuer Auth-Code) | `/aenderungsantrag/api/health` grün; direkter Origin ⇒ Redirect/403 |
| F3 | Worker-Adapter deployen | Assertion kommt an, Cookies werden entfernt |
| F4 | Pilot mit **einem** Konto: anmelden, Antrag erstellen, Anhang hoch-/runterladen, Freigabe, Aufgabe, Abschluss | vollständiger Durchlauf |
| F5 | Negativprüfungen in Produktion: Zugriff entziehen ⇒ nächster Request scheitert; App-Rolle entziehen ⇒ „Kein Zugriff"; Portal-Logout ⇒ nächster Request scheitert | belegt |
| F6 | Die übrigen vier Konten freischalten | alle arbeitsfähig |
| F7 | **Noch im selben Wartungsfenster** (Folge aus Entscheidung 1): altes `falu-session`-Cookie entwerten und `Session`/`PasswordResetToken` in der CR-DB leeren (Entscheidung 4) | Tabellen leer, Cookie gelöscht. Verhindert, dass ein späterer Code-Rollback die alten Identitäten reaktiviert |
| F8 | Cron-Service: ersten Digest-Lauf beobachten | korrekte Empfängerliste, keine Dubletten |
| F9 | e2e-Tests neu aufsetzen (Entscheidung 10) | Suite grün |
| F10 | Dokumentation final: `admin-portal-architecture.md` ersetzen, READMEs, `PRODUCTION-ROLLOUT.md` §9 anpassen | Review |
| F11 | Rückbau-Entscheid für `Role`/`UserRole`/`Session`/`PasswordResetToken`/`passwordHash` in der CR-DB terminieren | eigenes Ticket |

### Phase G – Rollentrennung (separat, ein bis zwei Wochen nach dem Cutover)

Ausgelagert aus Phase C wegen Entscheidung 6: Am Stichtag ändert sich nur die Anmeldung.
Klemmt danach etwas, ist die Ursache eindeutig. Die Rollentrennung folgt als kleine,
unabhängig beurteilbare Auslieferung.

| G# | Schritt | Prüfkriterium |
| --- | --- | --- |
| G1 | Ist-Rollenverteilung der fünf Konten lesend auslesen und Florian als Liste vorlegen (Entscheidung 7) | Liste vollständig, nur lesender Zugriff |
| G2 | Soll-Rollen bestätigen lassen (Entscheidung 13) | Für jede Freigabeart existiert mindestens eine berechtigte aktive Person |
| G3 | Fehlende Fachrollen im Portal nachtragen, **bevor** der Code ausgeliefert wird | Zuweisungen sichtbar in der Portal-UI |
| G4 | Code ändern (Abschnitt 0.3): `effectiveRoles`, `rolePermissions`, `canEditAvorReview`, `canEditTechnicalReview`, `resolveApprovalAuthority`, `canFinalApprove`, `canRequestFinalChanges` | Administrator ohne Fachrolle kann keine Freigabe mehr erteilen; `canReopenClosed`, Löschen und Entwurfsbearbeitung bleiben ihm erhalten |
| G5 | Tests: je ein Positiv- und Negativfall pro Freigabeart | `permissions.test.ts` und die Action-Tests decken die neue Matrix ab |
| G6 | Ausliefern und einen realen Freigabedurchlauf je Art beobachten | AVOR-, Technik- und Abschlussfreigabe funktionieren mit den neuen Rollen |
| G7 | Rückfallplan: Die Änderung ist rein im Code, ohne Migration – ein Rollback stellt den alten Zustand her | dokumentiert |

---

## Änderungsprotokoll dieses Dokuments

| Datum | Änderung |
| --- | --- |
| 21.09.2026 | Erstfassung der Bestandsanalyse (Abschnitte 1–11) |
| 22.09.2026 | Abschnitt 0 ergänzt: 8 Entscheidungen, Verifikationslauf, Build-Befund. Abschnitt 4.8, 10 und 11 nachgeführt. Phase G neu. Einzige Code-Änderung: `"use server"` in zwei Dateien an den Dateianfang verschoben (freigegeben) |

*Phase A abgeschlossen. Ausser der freigegebenen Zwei-Zeilen-Reparatur wurde keine
Implementierung begonnen. Nichts committet, nichts deployt.*

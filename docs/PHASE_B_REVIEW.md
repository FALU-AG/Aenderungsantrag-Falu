# Phase B5 – Code-Review des zentralen Auth-Umbaus

Datum: 22.09.2026. Grundlage: Commits `99298c2` (Änderungsantrag) und `57246f4` (Portal),
verglichen mit dem jeweils vorherigen Stand auf `main`. Ergänzung zu
[PHASE_A_ANALYSE.md](PHASE_A_ANALYSE.md).

**Anlass:** Der Umbau war nie gebaut worden (Abschnitt 0.2 der Phase-A-Analyse). Lauffähigkeit
ist inzwischen hergestellt und alle 524 Tests laufen durch — das beweist aber nur, dass der Code
startet, nicht dass er fachlich richtig ist. Dieses Review geht jede geänderte Zeile durch.

**Gesamturteil:** Die Architektur ist solide. Der kryptografische Kern (Assertion-Prüfung,
Request-Bindung, Replay-Sperre, `externalId`-Mapping) ist sauber gebaut und gut getestet. Die
Befunde betreffen nicht die Sicherheitsarchitektur, sondern die **Betriebsfestigkeit**: Der
Umbau hat einen Netzwerkaufruf an Stellen eingefügt, an denen vorher eine Datenbankabfrage stand,
ohne die Folgen für Transaktionen, Wiederholungen und Antwortzeiten zu berücksichtigen.

| Schwere | Anzahl | Stand |
| --- | --- | --- |
| Hoch – vor dem Cutover | 2 | ✅ beide behoben |
| Mittel – vor dem Cutover | 4 | ✅ 2 behoben (M1, M4), 2 offen (M2, M3) |
| Niedrig – kann danach | 3 | ⏳ offen |
| Testlücke | 1 | ✅ behoben |

## Stand der Behebung (22.09.2026)

Freigegeben wurde die Behebung der fünf blockierenden Befunde. Ergebnis:

| Befund | Stand | Was geändert wurde |
| --- | --- | --- |
| H1 | ✅ behoben | `directory.ts` bekam `warmCentralDirectory()`. Der Aufruf steht jetzt **vor** jeder Transaktion, die Benutzer auflöst (`approvals/actions.ts`, `change-requests/actions.ts` ×2, `delegations/actions.ts`, `tasks/actions.ts`, `completion-summary.ts`). Die Auflösung innerhalb der Transaktion wird damit aus dem Zwischenspeicher bedient; es findet kein Netzwerkaufruf mehr in einer Transaktion statt. Der Aufwärmaufruf ist bewusst unkritisch (`.catch`), damit die Fehlerbehandlung an ihrer bisherigen Stelle bleibt |
| H2 | ✅ behoben | `service-core.ts`: statt eines stillen `return false` wird der Datensatz jetzt als fehlgeschlagen vermerkt. Ein zurückgezogener Benachrichtigungstyp wird endgültig stillgelegt, ein fehlendes Mapping bekommt einen gezählten Versuch mit Wartezeit und läuft nach fünf Versuchen aus. `USER_INVITATION` ist zusätzlich aus der Wiederholungsabfrage ausgenommen. Drei neue Tests |
| M1 | ✅ behoben | `centralDirectory()` hat einen Zwischenspeicher mit 15 Sekunden Gültigkeit und Bündelung gleichzeitiger Aufrufe. 15 Sekunden entsprechen der Assertion-Lebensdauer, der Widerruf bleibt also innerhalb des dokumentierten Fensters. Fehler werden nie zwischengespeichert. Nebenwirkung: die Doppelabrufe in `delegations/query.ts` und `workflow.ts` kosten jetzt einen Abruf statt drei |
| M4 | ✅ behoben | Portal: `actions/auth.ts` und `login/page.tsx` reichen das geprüfte Rücksprungziel durch, statt `%2Feinsaetze` fest zu setzen |
| T1 | ✅ behoben | `proxy.test.ts`: fünf neue Tests – manipulierter Body, passender Body, fremder Origin trotz gültiger Assertion, fehlendes `externalId`-Mapping, und die Cookie-Prüfung wurde von einer schwachen auf eine belastbare Zusicherung umgestellt |
| M2, M3, N1–N3 | ⏳ offen | Bewusst zurückgestellt, nicht blockierend |

**Prüfung nach der Behebung:**

| | Portal | Änderungsantrag |
| --- | --- | --- |
| `typecheck` | ✅ | ✅ |
| `lint` | ✅ | ✅ |
| `build` | ✅ 16 Routen | ✅ 19 Routen |
| `test` | ✅ 51/51 | ✅ **481/481** (vorher 473) |

**Nachtrag 22.09.2026 – der Ende-zu-Ende-Lauf existiert jetzt.** `npm run
test:handoff:change-request` im Portal-Repo fährt die volle Kette Portal → Cloudflare-Adapter
→ Änderungsantrag gegen zwei isolierte Wegwerf-Datenbanken durch und ist grün. Er deckt
anonymen Zugriff, den direkten Origin, Zugriff ohne Rolle, Zugriff mit Rolle, den signierten
Verzeichnisabruf, Replay, gefälschte Identitätsheader, fehlendes `externalId`-Mapping sowie
Widerruf über Rollenentzug, Zugriffsentzug, Logout und Deaktivierung ab.

Nicht geprüft: die sechs Playwright-Suiten (unverändert gebrochen) und Mutationen über
Server Actions — der Ende-zu-Ende-Lauf beschränkt sich auf Seitenaufrufe, weil Next-Server-Actions
eigene Header und einen exakten Origin verlangen.

---

## Hoch

### H1 – Netzwerkaufruf zum Portal innerhalb von Datenbanktransaktionen

**Wo:**
- `src/modules/approvals/actions.ts:35` → `queueRequestNotification(tx, …)`
  → `src/modules/notifications/workflow.ts:67` `requestRecipient(tx, …)`
  → `src/modules/notifications/recipients.ts:14` `centralUser(applicant.id, tx)`
  → `src/modules/auth/directory.ts:15` `fetch(…)`
- `src/modules/delegations/actions.ts:59` → `queueApprovalCycleNotifications`
  → `workflow.ts:49` `centralUsers()`
- `src/modules/tasks/actions.ts:128` `centralUser(...)` innerhalb `db.$transaction`

**Was passiert:** Vorher stand an diesen Stellen `tx.user.findFirst(...)` – eine Abfrage auf
derselben Datenbankverbindung, innerhalb weniger Millisekunden. Jetzt steht dort ein
HTTPS-Aufruf an das Portal.

**Warum das ein Problem ist:**
1. Die Freigabe-Transaktion in `approvals/actions.ts:38` läuft mit
   `isolationLevel: "Serializable"`. Sie hält ihre Sperren jetzt über einen Netzwerkaufruf hinweg.
2. Prismas Standard-Transaktionstimeout beträgt **5 Sekunden**. Der Verzeichnisabruf hat selbst
   ein Timeout von **5 Sekunden** (`directory.ts:15`, `AbortSignal.timeout(5000)`). Ist das
   Portal langsam, läuft die Transaktion ab, **bevor** der Abruf aufgibt.
3. Folge: Eine AVOR- oder Technikfreigabe schlägt fehl, sobald das Portal träge antwortet –
   obwohl die Freigabe selbst nichts mit dem Portal zu tun hat. Die Entscheidung wird
   zurückgerollt, die Person sieht eine Fehlermeldung.

**Empfehlung:** Den Empfänger **vor** der Transaktion ermitteln und als Wert hineinreichen, oder
die Benachrichtigung erst nach dem Commit auflösen. Die Transaktion darf keinen Netzwerkaufruf
enthalten. Zusätzlich das Prisma-Transaktionstimeout bewusst setzen statt den Standard zu nutzen.

### H2 – Unzustellbare Benachrichtigungen werden endlos wiederholt

**Wo:** `src/modules/notifications/service-core.ts:9-11`

```ts
if (["PASSWORD_RESET", "USER_INVITATION"].includes(notification.type)) return false;
const recipient = notification.recipientUserId ? await centralUser(notification.recipientUserId) : null;
if (!recipient) return false;
```

**Was passiert:** Beide `return false` stehen **vor** dem `try`-Block. Damit wird weder
`attemptCount` erhöht noch `nextAttemptAt` gesetzt.

`retryNotifications()` (`service-core.ts:29`) wählt Zeilen mit
`attemptCount < MAX_DELIVERY_ATTEMPTS` und `nextAttemptAt: null`. Genau diese Zeilen erfüllen
die Bedingung dauerhaft. Sie werden bei **jedem** Wiederholungslauf erneut ausgewählt, scheitern
erneut lautlos, und bleiben für immer im Zustand `PENDING`.

**Wen es trifft:**
- Jede Benachrichtigung an eine Person ohne `externalId`-Zuordnung.
- Alle `USER_INVITATION`-Zeilen: `retryNotifications` filtert nur `PASSWORD_RESET` heraus
  (`service-core.ts:29`), nicht `USER_INVITATION`. Sie werden also ausgewählt und in Zeile 9
  verworfen.
- Alle Altbestände in der Produktionsdatenbank, die zum Zeitpunkt des Cutovers noch offen sind.

**Verstärkend:** Jeder dieser Fehlversuche löst wegen Befund M1 einen eigenen HTTPS-Abruf beim
Portal aus. 20 hängende Zeilen bedeuten 20 Portal-Aufrufe pro Wiederholungslauf, dauerhaft.

**Empfehlung:** Bei fehlendem Empfänger den Datensatz als endgültig fehlgeschlagen markieren
(`status: "FAILED"`, `attemptCount` erhöhen, `lastError` setzen), statt lautlos auszusteigen.
`USER_INVITATION` zusätzlich in den Filter von `retryNotifications` aufnehmen. Vor dem Cutover
prüfen, wie viele offene Zeilen in der Produktionsdatenbank liegen.

---

## Mittel

### M1 – Kein Zwischenspeicher für den Verzeichnisabruf

**Wo:** `src/modules/auth/directory.ts:28-33`

`centralUser(id)` ruft `centralUsers()` auf, und `centralUsers()` ruft immer `centralDirectory()`
auf – also **einen vollständigen HTTPS-Abruf pro Aufruf**, ohne jede Zwischenspeicherung.

Konkrete Häufungen:
- `src/modules/delegations/query.ts:7-8` ruft `centralUsers()` **zweimal parallel** für exakt
  dieselben Daten und filtert das Ergebnis nur unterschiedlich. Zwei Abrufe, wo einer genügt.
- `src/modules/notifications/workflow.ts:49` holt das Verzeichnis, und `activeRoleRecipients`
  (`recipients.ts:10`) holt es in derselben Schleife erneut – für `AVOR` und `TECHNICAL` je
  einmal. Drei Abrufe pro Freigaberunde.
- `sendNotifications` (`service-core.ts:25`) ruft `sendNotification` je Empfänger auf, und jeder
  löst `centralUser` → einen eigenen Abruf aus.

**Empfehlung:** `centralDirectory()` pro Request bzw. pro Job-Lauf zwischenspeichern
(z. B. React `cache()` wie in `inbox/query.ts:7`, für Cron-Jobs ein kurzlebiger Speicher mit
wenigen Sekunden Lebensdauer). Da Widerruf ohnehin erst bei der nächsten Assertion greift
(15 Sekunden), ist ein kurzer Zwischenspeicher sicherheitlich unbedenklich.

### M2 – Mehr Benutzerdaten gelangen in den Browser als vorher

**Wo:** `src/app/change-requests/[id]/page.tsx:119` und `:289`

```ts
const activeUsers = await centralUsers();   // vorher: select { id, name }
…
users={activeUsers}                          // an task-management.tsx ("use client")
```

`centralUsers()` liefert `{ id, centralId, name, email, active, roles }`. Diese Objekte werden
unverändert an eine Client-Komponente gereicht und landen damit im HTML jeder Antragsdetailseite.

**Folge:** Jede angemeldete Person erhält E-Mail-Adresse, Rollenzuordnung und – am heikelsten –
die **zentrale Portal-Benutzerkennung** aller anderen. Diese Kennung ist der `sub` der
Assertion. Vorher wurden nur `{ id, name }` ausgeliefert.

Kein unmittelbares Sicherheitsproblem: Es sind Kolleginnen und Kollegen im internen Werkzeug,
und die Kennung allein erlaubt nichts. Aber es ist eine unbeabsichtigte Ausweitung, und
interne Kennungen gehören grundsätzlich nicht in den Browser.

**Empfehlung:** Auf `{ id, name }` reduzieren, bevor die Liste an die Komponente geht.
Gleiches in `src/app/change-requests/page.tsx:44` prüfen (dort wird über
`users.map((x) => [x.id, x.name])` bereits reduziert – unkritisch).

### M3 – Benutzerlisten sind nicht mehr alphabetisch sortiert

**Wo:**
- `src/app/change-requests/page.tsx:44` – vorher `orderBy: { name: "asc" }`
- `src/app/change-requests/[id]/page.tsx:119` – vorher `orderBy: { name: "asc" }`
- `src/modules/delegations/query.ts:7` – vorher `orderBy: [{ lastName }, { firstName }]`

Der Ersatz `centralUsers()` sortiert nirgends: weder die Portal-Abfrage
(`directory/route.ts:18`) noch der lokale Join (`directory.ts:30`) hat ein `orderBy`.

**Folge:** Auswahllisten für Aufgabenverantwortliche, Antragstellerfilter und Stellvertretungen
erscheinen in beliebiger Datenbankreihenfolge. Bei fünf Personen ein Schönheitsfehler, bei
wachsender Belegschaft eine spürbare Verschlechterung.

**Empfehlung:** In `directory.ts` nach `name` sortieren, damit alle Aufrufer profitieren.

### M4 – Portal: Nach erzwungenem Passwortwechsel landet man in der falschen Anwendung

**Wo:** Admin Portal, `src/app/actions/auth.ts:16` und `src/app/login/page.tsx:10`

```ts
destination = safeReturnPath(form.get("returnTo")) === "/" ? "/account/password" : "/account/password?returnTo=%2Feinsaetze";
```

`safeReturnPath` wurde in diesem Umbau um `/aenderungsantrag` erweitert
(`src/lib/auth/return-path.ts:2`), diese beiden Aufrufstellen jedoch nicht. Sie setzen
weiterhin **fest verdrahtet** `%2Feinsaetze`.

**Folge:** Wer aus den Änderungsanträgen kommt, sich anmeldet und sein temporäres Passwort
ändern muss, wird nach dem Passwortwechsel zu **Kundeneinsätze** geleitet statt zurück zu den
Änderungsanträgen. Betrifft genau den Weg, den alle fünf Benutzer beim ersten Anmelden nach dem
Cutover gehen.

Der Worker macht es richtig (`integration/cloudflare/change-request.mjs:49-51` setzt
`returnTo=/aenderungsantrag`), und `/account/password` reicht den Wert korrekt durch
(`src/app/account/password/page.tsx:14`). Nur diese beiden Stellen überschreiben ihn.

**Empfehlung:** Den geprüften Wert weiterreichen statt ihn zu ersetzen.

---

## Niedrig

### N1 – Unerreichbarer Code

`src/modules/notifications/service-core.ts:13`:
`if (notification.type === "PASSWORD_RESET" && !data.url) return false;` – Zeile 9 hat
`PASSWORD_RESET` bereits abgefangen. Entfernen.

### N2 – Verwaiste Module ohne Aufrufer

- `src/modules/auth/password.ts` – bcrypt-Hilfsfunktionen, im Produktivcode nicht mehr verwendet
- `src/modules/auth/sample-users.ts` – fünf Demo-Identitäten, kein Aufrufer
- `src/modules/auth/public-routes.ts` – nur noch von `src/app/layout.tsx:7` genutzt, dessen
  Zweig wegen `src/proxy.ts:9` praktisch nicht mehr erreicht wird
- `src/app/layout.tsx:28` – `user?.mustChangePassword` ist wegen `session.ts:14` immer `false`

Entfernen oder mit einer Begründung behalten (Phase B11).

### N4 – Eine Fehlkonfiguration des Portal-Origins endet in einem 500 statt einer Fehlerseite

**Wo:** `src/proxy.ts:19-22`

Der `catch`-Block ruft `portalLogin()` und `portalOrigin()` auf. Beide werfen, wenn
`FALU_PORTAL_ORIGIN` ungültig ist – und dieser Wurf liegt **ausserhalb** des `try`. Der
vorgesehene 503 mit der Seite „Kein Zugriff" wird dadurch nie erreicht; stattdessen
antwortet Next mit einem nackten `500 Internal Server Error`.

Empirisch bestätigt am 22.09.2026: Mit `FALU_PORTAL_ORIGIN=http://127.0.0.1:39999` und
Produktionsmodus antwortet die Anwendung auf `/aenderungsantrag` mit `500`.

Praktische Auswirkung ist gering – der Fall tritt nur bei falsch gesetzter Variable ein,
und er scheitert immerhin geschlossen. Unschön ist, dass genau in dieser Lage die
Fehlersuche erschwert wird: Der 500 nennt keine Ursache, die vorgesehene Meldung hätte es
getan. **Empfehlung:** Den Origin einmal am Anfang auflösen und im `catch` nur noch den
bereits ermittelten Wert verwenden, mit einer festen Rückfallseite ohne Origin.

### N3 – Optimierte Bilder lösen einen Portal-Abruf aus

`next/image` wird in `src/app/change-requests/[id]/page.tsx:988` und
`src/components/attachment-picker.tsx:124` verwendet. Solche Anfragen laufen über
`/_next/image?url=…`.

Die Ausnahmelisten decken nur `/_next/static/` ab – im Worker
(`change-request.mjs:31`) wie im Proxy (`src/proxy.ts:8`). Jede optimierte Bildanfrage erzeugt
daher einen Portal-Roundtrip, eine signierte Assertion und eine Zeile im Replay-Register.

Funktioniert, ist aber unnötig teuer. Bei der Belastungsmessung in Phase D berücksichtigen.

---

## Testlücken

### T1 – Fehlende Negativtests im Proxy

`src/proxy.test.ts` prüft Signatur, Replay, Pfadbindung, Legacy-Cookie und die öffentlichen
Pfade. Nicht geprüft:

| Fehlender Fall | Warum wichtig |
| --- | --- |
| Gültige Assertion, aber **manipulierter Body** | Die Body-Bindung (`portal-guard.ts:17`) ist die einzige Absicherung gegen Vertauschen von Formularinhalten |
| Gültige Assertion, aber **falscher `Origin`** bei POST | `src/proxy.ts:16` ist die verbleibende CSRF-Grenze |
| Gültige Assertion, aber **kein `externalId`-Mapping** | `src/proxy.ts:15`, der Pfad, den alle nicht migrierten Benutzer nehmen |

Zeile 12 prüft ausserdem nur `expect(r.headers.get("x-middleware-request-cookie")).toBeNull()`.
Das wäre auch dann erfüllt, wenn der Header nie gesetzt würde – die Aussage ist schwächer als
sie wirkt.

---

## Was das Review **nicht** beanstandet

Ausdrücklich geprüft und für gut befunden:

- Die Assertion-Prüfung (`app-assertion.ts:21-30`): strikte Schemaprüfung, feste Kurve,
  kein client-wählbarer Algorithmus, keine Toleranz bei der Laufzeit.
- Die Request-Bindung (`portal-guard.ts:12-17`): Methode, vollständiger Pfad samt Query und
  Body-Hash werden geprüft.
- Die Replay-Sperre (`proxy.ts:13`): atomarer Unique-Insert, wirkt auch über mehrere Instanzen.
- Die Identitätsauflösung (`session.ts:12`): ausschliesslich `externalId`, kein E-Mail-Rückfall.
- Dass Rollen ausschliesslich aus den signierten Claims stammen und niemals aus lokalen Tabellen.
- Die doppelte Prüfung – Worker fragt das Portal, Origin prüft unabhängig kryptografisch.
- Das Entfernen von Cookies und `Authorization` an beiden Grenzen.
- Die Portal-Seite insgesamt: `ApplicationRole`/`UserApplicationRole` mit Datenbank-Triggern,
  keine impliziten Rechte für Portal-`ADMIN`, sorgfältig abgesichertes Migrationsskript.

---

## Empfohlene Reihenfolge

| Schritt | Befund | Vor dem Cutover nötig? |
| --- | --- | --- |
| 1 | H1 – Netzwerkaufruf aus den Transaktionen lösen | **ja** |
| 2 | H2 – Endloswiederholung stoppen | **ja** |
| 3 | M4 – Rücksprungziel im Portal korrigieren | **ja**, betrifft den ersten Anmeldeweg aller Benutzer |
| 4 | M1 – Verzeichnis zwischenspeichern | **ja**, entschärft H1 und N3 zusätzlich |
| 5 | T1 – Negativtests ergänzen | **ja** |
| 6 | M2, M3 – Datenumfang und Sortierung | empfohlen, nicht blockierend |
| 7 | N1, N2, N3 | danach |

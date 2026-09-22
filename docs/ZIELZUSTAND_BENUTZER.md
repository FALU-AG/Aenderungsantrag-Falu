# Zielzustand Benutzer und Rollen

> ## Aktualisiert am 22.09.2026 — der Zuordnungsschritt entfällt
>
> Die Prüfung der Produktionsdatenbank ergab: **null Änderungsanträge**, keine Freigaben,
> Aufgaben, Kommentare oder Anhänge. An den fünf lokalen Konten hängt keine Historie.
>
> Daraufhin wurde entschieden, die lokalen Konten **zu entfernen statt zuzuordnen**, und die
> lokale Zeile künftig **automatisch beim ersten Besuch** anzulegen — aus signierten
> Portaldaten, nach erfolgreicher Prüfung der Assertion.
>
> **Damit entfallen ersatzlos:** die Zuordnungsdatei `mappings.json`, das Migrationsskript
> `scripts/change-request-migration.ts` im Portal-Repo, die Vier-Augen-Prüfung der Zuordnung
> und das gesamte Risiko einer Verwechslung (Kernfrage G der Phase-A-Analyse).
>
> **Neu stattdessen:** `npm run db:reset-local-users` in der Änderungsantrag-App entfernt
> einmalig die Altbestände. Abschnitt 3 unten ist entsprechend angepasst; Abschnitt 1 und 2
> bleiben als Bestandsaufnahme gültig.

Stand 22.09.2026. Grundlage: lesende Abfrage beider Produktionsdatenbanken über die
Railway-CLI. Es wurde nichts geschrieben. Ergänzung zu
[PHASE_A_ANALYSE.md](PHASE_A_ANALYSE.md) und [PHASE_B_REVIEW.md](PHASE_B_REVIEW.md).

---

## 1. Ist-Zustand

### Änderungsanträge — 5 Konten, alle aktiv, alle haben sich schon angemeldet

| Person | E-Mail | Rollen heute | `externalId` |
| --- | --- | --- | --- |
| Florian Kaufmann | kaufmann@falu.com | ADMINISTRATOR + AVOR + TECHNICAL | fehlt |
| Marc Wyss | wyss@falu.com | ADMINISTRATOR | fehlt |
| Lina Graber | graber@falu.com | TECHNICAL | fehlt |
| Caner Toker | toker@falu.com | EMPLOYEE | fehlt |
| Max Bodmer | bodmer@falu.com | EMPLOYEE | fehlt |

Keines der fünf Konten ist bisher mit dem Portal verknüpft. Das ist erwartungsgemäss.

### Admin Portal — 4 Konten

| Person | E-Mail | Portalrollen | App-Zugriffe | Passwort |
| --- | --- | --- | --- | --- |
| Florian Kaufmann | kaufmann@falu.com | ADMIN + MANAGEMENT | ADMIN_PORTAL, CHANGE_REQUEST, CUSTOMER_SERVICE | gesetzt |
| Marc Wyss | wyss@falu.com | ADMIN + MANAGEMENT | ADMIN_PORTAL | gesetzt |
| Caner Toker | toker@falu.com | EMPLOYEE | ADMIN_PORTAL, CHANGE_REQUEST, CUSTOMER_SERVICE | **Wechsel offen** |
| Florian Kaufmann | *private Adresse* | EMPLOYEE + SERVICE_TECHNICIAN | ADMIN_PORTAL | gesetzt |

Die Tabelle `ApplicationRole` existiert in der Produktion **noch nicht** — Migration
`20260921090000_application_roles` ist nicht ausgerollt. Es hat daher noch niemand
fachliche Rollen im Portal.

### Lücken

| # | Lücke | Wirkung ohne Behebung |
| --- | --- | --- |
| 1 | **Lina Graber hat kein Portalkonto** | Nach dem Stichtag vollständig ausgesperrt |
| 2 | **Max Bodmer hat kein Portalkonto** | Nach dem Stichtag vollständig ausgesperrt |
| 3 | **Marc Wyss hat keinen CHANGE_REQUEST-Zugriff** | Nach dem Stichtag ausgesperrt, trotz Administratorrolle in der App |
| 4 | **Caner Toker: Passwortwechsel offen** | Das zentrale Verzeichnis liefert nur Konten mit abgeschlossenem Wechsel (`directory/route.ts:18`). Er verschwindet aus Empfängerlisten, Aufgabenzuweisung und Stellvertretungsauswahl — **ohne Fehlermeldung** |
| 5 | Niemand hat fachliche CR-Rollen im Portal | Ohne mindestens eine Rolle stellt das Portal keine Assertion aus (`service.ts:236`) — Zugriff allein genügt nicht |

---

## 2. Zielzustand

Beschlossen am 22.09.2026.

| Person | Portalkonto | Was zu tun ist | CR-Rollen (Ziel) |
| --- | --- | --- | --- |
| Florian Kaufmann | vorhanden, Zugriff ✅ | nur Rollen setzen | **ADMINISTRATOR + AVOR + TECHNICAL** |
| Marc Wyss | vorhanden, Zugriff ❌ | Zugriff aktivieren, dann Rolle | **ADMINISTRATOR** |
| Caner Toker | vorhanden, Zugriff ✅ | Passwortwechsel abschliessen, dann Rolle | **EMPLOYEE** |
| Lina Graber | **fehlt** | Konto anlegen, Zugriff, Rolle | **TECHNICAL** |
| Max Bodmer | **fehlt** | Konto anlegen, Zugriff, Rolle | **EMPLOYEE** |
| Florian Kaufmann (privat) | vorhanden | **nichts** | — **ausdrücklich nicht zuordnen** |

Die Zielrollen entsprechen exakt den heutigen Rollen in den Änderungsanträgen. Niemand
gewinnt oder verliert durch die Umstellung selbst etwas.

### Bewusst getroffene Entscheidungen

**Marc Wyss behält nur ADMINISTRATOR.**
Heute erteilt ihm die Rolle automatisch sämtliche Freigabebefugnisse, weil
`effectiveRoles()` einem ADMINISTRATOR alle Rollen zuspricht. Nach der Rollentrennung in
Phase G verwaltet er Stellvertretungen, darf Anträge löschen und wieder öffnen, kann aber
**keine AVOR- oder Technikfreigabe mehr erteilen**. Vor Phase G ist zu prüfen, ob er das
heute tatsächlich tut — sonst ist es eine spürbare Einschränkung.

**AVOR bleibt bei einer Person.**
Florian Kaufmann ist der einzige AVOR-Inhaber. Das ist so gewollt.
Das Ausfallrisiko ist gedeckt: Marc Wyss kann als ADMINISTRATOR auch für eine andere
Person eine AVOR-Stellvertretung einrichten (`delegations/domain.ts:28` — für fremde
Delegationen genügt ADMINISTRATOR, unabhängig vom Fachbereich). Diese Möglichkeit bleibt
auch nach der Rollentrennung bestehen, weil `delegatableScopes` die tatsächlich
vergebenen Rollen liest und nicht die abgeleiteten. **Eine AVOR-Freigabe ist also auch
dann noch delegierbar, wenn Florian selbst nicht handlungsfähig ist.**

**Das private Zweitkonto bleibt unangetastet** und wird in der Zuordnungsliste
ausdrücklich als „nicht zuordnen" geführt, damit es niemand später versehentlich verknüpft.

---

## 3. Arbeitsliste für Florian

Reihenfolge ist wichtig: Fachliche Rollen lassen sich erst vergeben, **nachdem** die
Portal-Migration ausgerollt ist — vorher existiert die Tabelle nicht.

### Schritt 1 — jetzt möglich, unabhängig vom Rest

- [ ] **Lina Graber anlegen** unter `https://admin.falu.com/admin/users/new`
      Vorname `Lina`, Nachname `Graber`, E-Mail `graber@falu.com`,
      Portalrolle: `Mitarbeiter` (oder `Technik`, falls fachlich passender),
      Konto aktiv, temporäres Passwort selbst vergeben.
- [ ] **Max Bodmer anlegen** — ebenso, E-Mail `bodmer@falu.com`, Portalrolle `Mitarbeiter`.
- [ ] Beide temporären Passwörter **persönlich oder über einen sicheren Kanal** übergeben.
      Nicht per E-Mail, nicht in einem Ticket.
- [ ] **Caner Toker bitten, seinen Passwortwechsel abzuschliessen.** Solange der offen ist,
      fällt er aus allen Empfängerlisten heraus, ohne dass es irgendwo auffällt.
- [ ] Lina Graber und Max Bodmer bitten, sich nach Erhalt ihres Passworts **einmal
      anzumelden und es zu ändern** — aus demselben Grund.

> Passwörter erzeuge und übermittle ich grundsätzlich nicht. Das bleibt vollständig bei dir.

### Schritt 2 — nach dem Ausrollen der Portal-Migration

- [ ] Bei **Marc Wyss** den Zugriff auf `Änderungsanträge` aktivieren.
- [ ] Bei allen fünf Konten die fachlichen Rollen gemäss Zielzustand setzen —
      unter `Benutzer bearbeiten` → `Anwendungszugriff` → `Fachliche Rollen`.
- [ ] Prüfen, dass **jede** der fünf Personen mindestens eine Rolle hat. Ohne Rolle
      stellt das Portal keine Assertion aus, und die Person sieht „Kein Zugriff" statt
      einer Anmeldeaufforderung.

### Schritt 3 — Altbestände entfernen (im Wartungsfenster)

Statt der früher geplanten Zuordnung wird einmalig aufgeräumt. Danach entsteht jede lokale
Zeile automatisch beim ersten Besuch.

- [ ] **Datenbank-Backup erstellen und prüfen.**
- [ ] Trockenlauf — schreibt nichts:

  ```powershell
  railway run --service Aenderungsantrag-Falu -- npx tsx scripts/reset-local-users.ts --dry-run
  ```

- [ ] Ausgabe prüfen: fünf Benutzer, keine Änderungsanträge, keine Freigaben.
- [ ] Ausführen:

  ```powershell
  $env:CONFIRM_LOCAL_USER_RESET = "DELETE_ALL_LOCAL_USERS"
  railway run --service Aenderungsantrag-Falu -- npx tsx scripts/reset-local-users.ts --execute
  Remove-Item Env:CONFIRM_LOCAL_USER_RESET
  ```

- [ ] Danach meldet sich jede Person einmal an. Die lokale Zeile entsteht dabei von selbst.

Das Skript **verweigert die Ausführung**, sobald auch nur ein Änderungsantrag, eine Freigabe,
eine Aufgabe, ein Kommentar oder ein Anhang existiert — dann hinge Historie an den Zeilen und
das Entfernen wäre Datenverlust. Es ist ausschliesslich ein Werkzeug für den Zustand vor der
produktiven Nutzung.

Erhalten bleiben: Maschinentypen, Änderungsgründe, App-Einstellungen, der Nummernzähler und
der Rollenkatalog.

---

## 4. Offene Abhängigkeiten

| Was | Wovon abhängig |
| --- | --- |
| Fachliche Rollen vergeben | Portal-Migration `20260921090000_application_roles` ausgerollt |
| Altbestände entfernen | Backup vorhanden, Trockenlauf geprüft, noch keine produktiven Anträge |
| Stichtag | Portalkonten vollständig, Rollen gesetzt, Ende-zu-Ende-Test erfolgreich |

## 5. Was künftig bei einer Neueinstellung zu tun ist

Nur noch ein Schritt: **im Portal ein Konto anlegen, Zugriff auf Änderungsanträge geben und
mindestens eine fachliche Rolle vergeben.** In der Änderungsantrag-App ist nichts mehr zu
tun — die lokale Zeile entsteht beim ersten Aufruf.

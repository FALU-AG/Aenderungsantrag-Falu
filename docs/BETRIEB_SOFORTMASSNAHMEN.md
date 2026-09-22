# Sofortmassnahmen Betrieb

Stand 22.09.2026. Vier Punkte, die beim Erheben der Deployment-Konfiguration aufgefallen
sind. Sie gehören **nicht** zur Auth-Umstellung, sollten aber vorher erledigt sein.

Alle Schritte führst du selbst aus. Ich fasse weder Schlüssel noch Passwörter an.
Nach jedem Punkt steht, was ich anschliessend nachprüfe.

---

## 1. Supabase-Schlüssel rotieren · **dringend**

### Was passiert ist

Im Railway-Dienst `Aenderungsantrag-Falu` gibt es eine Umgebungsvariable, deren **Name**
der vollständige, aktuell gültige Supabase Secret API Key ist. Das Wertfeld ist leer.
Offenbar wurde der Schlüssel beim Anlegen ins Namensfeld gefügt. Derselbe Schlüssel steht
zusätzlich korrekt als Wert von `SUPABASE_SERVICE_ROLE_KEY`.

Nachgeprüft und bestätigt:

| Prüfung | Ergebnis |
| --- | --- |
| Variable mit `sb_secret_`-Name vorhanden | ja |
| Ihr Wert | leer |
| Name identisch mit dem aktiven Schlüssel | **ja** |
| Schlüsseltyp | neuer Supabase Secret API Key |

**Warum das zählt:** Railway verbirgt Variablen*werte*, aber nicht Variablen*namen*. Der
Name steht in der Oberfläche, in Auflistungen und in Protokollen offen. Dieser Schlüssel
öffnet den privaten Anhang-Speicher vollständig und umgeht sämtliche Zugriffsregeln.

**Entwarnung zur Reichweite:** Kundeneinsätze nutzt ein **anderes** Supabase-Projekt mit
einem **anderen** Schlüssel (per Fingerabdruck verglichen, ohne die Werte zu lesen). Die
Rotation betrifft ausschliesslich die Änderungsanträge. Das Portal verwendet gar kein
Supabase Storage.

### Reihenfolge — bitte genau so

Der alte Schlüssel wird **zuletzt** gesperrt. Andersherum wären Anhänge sofort tot.

1. **Supabase öffnen** → Projekt `ypxjblqaltcpvaubbmwg` → `Project Settings` → `API Keys`.
2. **Neuen Secret Key erstellen** („Create new secret key" / „Generate new key").
   Den Wert einmal kopieren — er wird nur einmal angezeigt.
3. **Railway öffnen** → Projekt `Aenderungsantrag Falu` → Dienst `Aenderungsantrag-Falu`
   → `Variables`. Dort in einem Zug:
   - `SUPABASE_SERVICE_ROLE_KEY` auf den **neuen** Wert setzen.
   - Die überzählige Variable (Name beginnt mit `sb_secret_`) **löschen**.
   - `BOOTSTRAP_ADMIN_EMAIL` und `BOOTSTRAP_ADMIN_PASSWORD` **löschen** (siehe Punkt 2).
   Dann einmal speichern/deployen — so gibt es nur **ein** Deployment statt vier.
4. **Deployment abwarten**, bis der Dienst wieder „Online" meldet.
5. **Prüfen, dass Anhänge funktionieren:** einen bestehenden Änderungsantrag mit Anhang
   öffnen und den Anhang herunterladen. Kommt die Datei, ist der neue Schlüssel aktiv.
6. **Erst jetzt** in Supabase den **alten** Secret Key sperren („Revoke" / löschen).
7. Anhang-Download noch einmal testen — er muss weiterhin funktionieren.

> Falls Schritt 5 fehlschlägt: alten Schlüssel **nicht** sperren. Stattdessen
> `SUPABASE_SERVICE_ROLE_KEY` wieder auf den alten Wert setzen; damit läuft alles weiter,
> und wir sehen uns den neuen Schlüssel gemeinsam an.

### Was ich danach prüfe

Ich lese den Fingerabdruck des hinterlegten Schlüssels erneut (nur einen 12-stelligen
Hashwert, nie den Schlüssel selbst) und bestätige, dass er sich geändert hat und dass die
überzählige Variable verschwunden ist.

---

## 2. Bootstrap-Zugangsdaten entfernen

`BOOTSTRAP_ADMIN_EMAIL` und `BOOTSTRAP_ADMIN_PASSWORD` sind im Änderungsantrag-Dienst
gesetzt. Sie gehörten zum Skript `db:bootstrap-admin`, das beim Umbau entfernt wurde.

Nachgeprüft: **Kein Code verwendet diese Variablen mehr.** Der einzige verbliebene
Treffer ist `prisma/seed.ts:7`, und der liest nur `SEED_DEMO_USERS` — eine andere Variable,
die ohnehin nicht gesetzt ist. Das Löschen ist also folgenlos.

Ein Administrator-Passwort dauerhaft in der Umgebung zu halten, ist unnötiges Risiko:
Es ist für jeden mit Projektzugriff lesbar und läuft nie ab.

**Zu tun:** Beide Variablen löschen — am besten zusammen mit Punkt 1, Schritt 3.

**Zusatz:** Falls das Passwort noch irgendwo als echtes Anmeldepasswort in Gebrauch ist,
gehört es ohnehin geändert. Das kannst nur du beurteilen.

---

## 3. Healthcheck eintragen

Der Dienst `Aenderungsantrag-Falu` hat **keinen** Healthcheck-Pfad. Das Portal hat einen
(`/health`). Ohne Healthcheck bemerkt Railway nicht, wenn eine neue Fassung zwar startet,
aber nicht funktioniert — sie ginge trotzdem live.

Gerade beim Stichtag, der laut deiner Entscheidung ohne Rückfallpfad läuft, ist das die
billigste verfügbare Absicherung.

**Zu tun:** Railway → Dienst `Aenderungsantrag-Falu` → `Settings` → `Deploy` →
`Healthcheck Path` auf

```
/aenderungsantrag/api/health
```

Der Pfad enthält bewusst das Präfix `/aenderungsantrag`, weil die Anwendung unter diesem
Basispfad ausgeliefert wird. Die Route ist im Proxy ausdrücklich öffentlich
(`src/proxy.ts:8`) und antwortet auch ohne Anmeldung — sie eignet sich also als
Healthcheck, ohne ein Loch aufzureissen.

**Was ich danach prüfe:** dass der Pfad gesetzt ist und das nächste Deployment ihn besteht.

---

## 4. Resend-Webhook-Secret setzen · optional

`RESEND_WEBHOOK_SECRET` ist nicht gesetzt. Der Code scheitert dadurch sauber
(`webhook.ts:6` wirft ohne Secret) — es ist **kein Sicherheitsproblem**, die Route lässt
nichts Unsigniertes durch.

Folge ist aber: Rückmeldungen von Resend über den Zustellstatus (zugestellt, unzustellbar,
als Spam markiert) werden **nie** verarbeitet. Im Feld `EmailNotification.status` bleibt
darum immer `SENT` stehen, auch wenn eine Mail in Wahrheit nie ankam.

Dieser Zustand besteht vermutlich schon länger und hat nichts mit der Auth-Umstellung zu tun.

**Zu tun, falls gewünscht:**
1. Resend öffnen → `Webhooks`. Prüfen, ob überhaupt ein Webhook auf
   `https://admin.falu.com/aenderungsantrag/api/webhooks/resend` eingerichtet ist.
2. Falls ja: das Signing Secret kopieren und in Railway als `RESEND_WEBHOOK_SECRET`
   im Dienst `Aenderungsantrag-Falu` setzen.
3. Falls nein: entweder einrichten, oder wir vermerken den Webhook ausdrücklich als
   ungenutzt, damit niemand später davon ausgeht, dass Zustellstatus gepflegt wird.

---

## 5. Noch nicht jetzt: die neuen Variablen für die Umstellung

Nur zur Vollständigkeit — diese kommen in Phase D, nicht heute:

| Dienst | Fehlt noch |
| --- | --- |
| Portal | `FALU_CHANGE_REQUEST_DIRECTORY_SECRET` |
| Aenderungsantrag-Falu | `FALU_APP_SIGNING_PUBLIC_KEY`, `FALU_CHANGE_REQUEST_DIRECTORY_SECRET`, `FALU_PORTAL_SERVICE_ORIGIN` |
| **Weekly Personal Digest** | `FALU_APP_SIGNING_PUBLIC_KEY`, `FALU_CHANGE_REQUEST_DIRECTORY_SECRET`, `FALU_PORTAL_SERVICE_ORIGIN` |

Der Cron-Dienst wird dabei leicht übersehen: Er hat heute einen deutlich kleineren
Variablensatz als der Web-Dienst — entgegen der Aussage in `README.md:186`. Ohne diese
beiden Variablen schlägt nach der Umstellung **jeder** Wochenlauf fehl.

`FALU_PORTAL_ORIGIN` ist nicht zwingend: Der Code fällt auf `https://admin.falu.com`
zurück (`portal-config.ts:2`).

**`FALU_PORTAL_SERVICE_ORIGIN` dagegen schon** — bei beiden Diensten. Ohne die Variable
fragt die Anwendung das Benutzerverzeichnis über `https://admin.falu.com` an, und dort
beantwortet der Cloudflare Worker alles unter `/api/internal/change-request/` absichtlich
mit 404. Die Variable muss auf die **Railway-Adresse des Portals** zeigen, nicht auf
`admin.falu.com`. Ohne sie bleibt das Verzeichnis leer und niemand kommt herein.

## 6. Ebenfalls später: die Herkunftssperre

Heute sind alle drei Anwendungen auch unter ihrer Railway-Adresse direkt erreichbar, unter
Umgehung von Cloudflare. Beim Portal reicht das bis zur Anmeldeseite.

Der Worker markiert künftig jede Anfrage, die er weiterreicht; die Anwendungen weisen
unmarkierte Anfragen ab. Gesteuert wird das über **eine** neue Variable, die überall
denselben Wert trägt:

| Dienst | Variable |
| --- | --- |
| Cloudflare Worker | `FALU_ORIGIN_LOCK` (als Secret) |
| Portal | `FALU_ORIGIN_LOCK` |
| Aenderungsantrag-Falu | `FALU_ORIGIN_LOCK` |

Solange die Variable nirgends gesetzt ist, markiert der Worker nichts und die Anwendungen
prüfen nichts. Deshalb lässt sich die Umstellung in Ruhe machen:

1. Worker ausliefern.
2. Beide Anwendungen ausliefern.
3. Erst danach den Wert überall setzen.

Das Entfernen der Variable schaltet die Sperre wieder ab, ohne Deployment.

Ausgenommen von der Sperre bleiben `/health` beziehungsweise
`/aenderungsantrag/api/health`, der von Resend signierte Webhook und beim Portal alles unter
`/api/internal/`. Letzteres ist der gewollte Maschinenweg, der gar nicht über Cloudflare
läuft: Dort holt der Worker die Ausweise und die Änderungsantrag-Anwendung das
Benutzerverzeichnis. Jede dieser Routen prüft ihr eigenes Geheimnis.

Zwei Dinge bleiben bewusst offen: Der Cron-Dienst **Weekly Personal Digest** spricht die
Anwendung nicht über Cloudflare an — er braucht die Variable daher **nicht** und darf sie
auch nicht bekommen, sonst sperrt er sich selbst aus. Und **Kundeneinsätze** erhält die
Marke bereits, prüft sie aber noch nicht; jene Anwendung bleibt bis zu einer eigenen
Änderung direkt erreichbar.

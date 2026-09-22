> # ⚠️ ÜBERHOLT — nicht mehr umsetzen
>
> **Dieses Dokument beschreibt eine Zielarchitektur, die NICHT gebaut wurde.**
> Es stammt vom 17.09.2026 und schlug Microsoft Entra ID als Identitätsquelle vor,
> optional mit Cloudflare Access davor. Umgesetzt wurde etwas anderes:
>
> - Das **FALU Admin Portal selbst** ist die Identitätsquelle, mit eigenen bcrypt-Passwörtern.
> - Kein Entra, kein OIDC, kein Cloudflare Access, keine JWKS.
> - Die Identitätsübergabe erfolgt über **signierte Ed25519-Assertions** mit 15 Sekunden
>   Lebensdauer, gebunden an die einzelne Anfrage.
> - `User.externalId` speichert die **Portal-Benutzerkennung**, nicht den Entra-Object-ID.
>
> Aktueller Stand: [PHASE_A_ANALYSE.md](../PHASE_A_ANALYSE.md),
> [PHASE_B_REVIEW.md](../PHASE_B_REVIEW.md) und der Abschnitt „Zentrale Anmeldung"
> im [README](../../README.md).
>
> Aufbewahrt wird das Dokument allein als Nachweis der damals geprüften Optionen. Die
> Abwägung in Abschnitt 4 bleibt lesenswert, falls die Frage je neu gestellt wird.
> Alle konkreten Anweisungen darin sind hinfällig.

---

# FALU Admin Portal – Zielarchitektur für zentrale Anmeldung

## 1. Aktuelle Architektur

`admin.falu.com` wird durch einen Cloudflare Worker nach Pfad verteilt. `/aenderungsantrag` wird an die auf Railway betriebene Next.js-16-Anwendung weitergeleitet; deren `basePath` ist `/aenderungsantrag`. Der Worker-Quellcode liegt nicht in diesem Repository, deshalb können Header-Rewrite, Cache- und Timeout-Regeln hier nur als externe Konfiguration bewertet werden. Supabase stellt PostgreSQL und privaten Attachment-Speicher bereit.

## 2. Aktuelle Authentifizierung

- Anmeldung: lokale E-Mail/Passwort-Prüfung mit `bcryptjs` (Kostenfaktor 12).
- Benutzer: Prisma-`User` mit eindeutiger E-Mail, optionalem `passwordHash`, `externalId`, Aktivstatus und anwendungsspezifischen `UserRole`-Zuordnungen.
- Sitzung: 32 zufällige Bytes; nur der SHA-256-Hash wird in `Session` gespeichert. Laufzeit sieben Tage. `lastUsedAt` wird best effort aktualisiert.
- Cookie: `falu-session`, `HttpOnly`, in Produktion `Secure`, `SameSite=Lax`, Pfad `/`, kein explizites `Domain`-Attribut. Damit ist es ein Host-Cookie für `admin.falu.com` und wird wegen Pfad `/` auch an andere Pfade dieses Hosts gesendet; andere Anwendungen können es ohne gemeinsamen Verifikationsdienst trotzdem nicht sicher auswerten.
- Schutz: `src/proxy.ts` prüft das Cookie nur auf Vorhandensein. `getCurrentUser()` prüft anschließend serverseitig Hash, Ablaufdatum, Aktivstatus und Rollen. Öffentlich sind Login, Passwort vergessen/zurücksetzen sowie der Resend-Webhook.
- Rollen: aus der lokalen Datenbank; die zentrale Rollen-/Berechtigungslogik bildet EMPLOYEE-Basisrechte für erhöhte Rollen ab. Anwendungen besitzen ihre eigenen Rollen.
- Passwort-Reset: einmaliger, 30 Minuten gültiger, nur gehashter Token; erfolgreicher Reset invalidiert alle Sitzungen. Administratoren können temporäre Passwörter setzen; `mustChangePassword` erzwingt den Wechsel.
- Logout: löscht die aktuelle Datenbanksitzung und das Cookie und leitet zu `/login` um. Es gibt heute keinen organisationsweiten Logout.

## 3. Anforderungen

Ein Mitarbeiter meldet sich einmal mit dem Microsoft-Firmenkonto an, sieht anschließend nur freigegebene Anwendungen und öffnet `/aenderungsantrag`, `/pms`, `/shop` oder `/service` ohne erneute Eingabe. Die zentrale Identität und die je Anwendung getrennte Autorisierung müssen klar getrennt bleiben. On-/Offboarding, MFA und Kontosperrung sollen zentral wirken. Browserdaten oder unsignierte Proxy-Header dürfen nie als Identitätsnachweis gelten.

## 4. Bewertete Optionen

| Option | UX und Sicherheit | Betrieb/Komplexität | Eignung |
| --- | --- | --- | --- |
| Microsoft Entra ID OIDC direkt je App | Microsoft SSO, Conditional Access/MFA; jede App validiert eigene Tokens | OIDC-Konfiguration und Sessions je App; mehrfacher Code, aber etablierter Standard | Gut, besonders wenn Apps unabhängig gehostet werden |
| Cloudflare Access mit Entra ID | Anmeldung vor dem Origin, zentraler Schutz und sehr gute Offboarding-Grenze | Access-Lizenz/Policy extern klären; Apps müssen den signierten Access-JWT validieren, nicht nur Header lesen | Sehr gut als äußerer Zero-Trust-Gürtel |
| Zentrales Next.js/Auth.js-Portal | Einheitliches Portal und OIDC-Callback; volle UX-Kontrolle | Portal wird kritischer Identity Broker; sichere Token-Weitergabe, Schlüsselrotation und Logout über mehrere Apps sind anspruchsvoll | Gut als Portal, nicht als selbstgebauter alleiniger IdP |
| Gemeinsame First-Party-Session | Nahtlose Pfad-Apps unter einem Host | Alle Apps müssen denselben Sessiondienst, Schlüssel und Lebenszyklus teilen; starke Kopplung/Blast Radius | Nur mit zentralem, wohldefiniertem Session-/Token-Service sinnvoll |

Microsoft-Lizenzen und die Verfügbarkeit von Cloudflare Access sind nicht aus dem Repository feststellbar und müssen vor Umsetzung bestätigt werden.

## 5. Empfohlene Zielarchitektur

Empfohlen wird **Microsoft Entra ID als alleinige Identitätsquelle**, optional und bevorzugt **Cloudflare Access als vorgelagerte Zugriffsschicht**, plus ein schlankes Portal. Cloudflare Access authentifiziert gegen Entra ID und stellt dem Origin ein kurzlebiges, signiertes Access-JWT bereit. Jede Anwendung validiert dieses JWT serverseitig gegen Cloudflares veröffentlichte Schlüssel (`iss`, `aud`, Signatur, Ablauf) oder führt – falls Access nicht verfügbar ist – selbst einen Entra-OIDC-Authorization-Code-Flow mit PKCE aus.

Das Portal ist kein eigener Passwort-Identity-Provider. Es zeigt Anwendungen anhand zentraler App-Zugriffsregeln. Jede Anwendung behält ihre lokale `User`-Zeile und ihre eigenen Rollen. `externalId` speichert stabil den Entra-Object-ID/`oid`-Claim; E-Mail dient nur der initialen, kontrollierten Zuordnung und darf nach der Verknüpfung nicht der dauerhafte Primärschlüssel sein. `active` und lokale Rollen bleiben als zusätzliche App-Grenze bestehen.

Cloudflare Access sollte verwendet werden, wenn Lizenz, Administrationsmodell und Service-Verfügbarkeit bestätigt sind. Auch dann validiert der Origin den signierten JWT. `CF-Access-Authenticated-User-Email` oder andere vom Browser nachbildbare Header allein reichen nicht. Der Worker entfernt eingehende Identitätsheader und setzt/transportiert nur vom Access-Layer stammende Daten.

## 6. Authentifizierungssequenz

1. Browser öffnet `https://admin.falu.com/`.
2. Cloudflare Access erkennt keine gültige Access-Sitzung und leitet zu Entra ID um.
3. Entra ID führt Anmeldung, MFA und Conditional Access aus und antwortet an Cloudflare.
4. Cloudflare setzt seine sichere Sitzung und leitet zum Portal. Der Portal-Origin validiert den signierten Access-JWT.
5. Das Portal liest stabile Claims (`oid`, Tenant, Name, bevorzugte E-Mail) und ermittelt sichtbare Anwendungen.
6. Beim Öffnen von `/aenderungsantrag` sendet der Browser dieselbe Access-Sitzung. Die Change-Request-App validiert den JWT erneut, ordnet `oid` dem lokalen Benutzer zu und erstellt/erneuert optional eine kurze app-lokale Sitzung.
7. Die App lädt ausschließlich ihre lokalen Rollen und Berechtigungen. Entra-/Access-Gruppen erteilen nicht automatisch AVOR-, Technik- oder Administratorrechte.

Ohne Cloudflare Access entspricht der Ablauf einem OIDC-Login je App. Microsoft SSO verhindert normalerweise eine zweite Passworteingabe, obwohl jede App eine eigene sichere Session besitzt.

## 7. Autorisierungsmodell

- Zentrale Ebene: Darf die Identität das Portal bzw. eine Anwendung erreichen?
- Anwendungsebene: Welche FALU-Funktionen darf der lokale Benutzer ausführen?
- Die bestehende `User`- und `Role`-Struktur bleibt. Neue Anwendungen besitzen eigene Rollen/Datenbanken oder einen strikt mandantenfähigen Autorisierungsdienst.
- Provisionierung kann zunächst Just-in-Time nur für vorab freigegebene E-Mails erfolgen. Später ist Entra SCIM/Graph-basierte Provisionierung möglich; keine Lizenzannahme wird vorausgesetzt.
- Deaktivierung in Entra/Access sperrt den Randzugriff. Lokale `active=false` bleibt Defense in Depth und erhält Historie.

## 8. Cloudflare-/Railway-Routing

Der Worker routet `/aenderungsantrag*` unverändert an Railway und andere Präfixe an ihre Origins. Er darf Querystrings (unter anderem Reset-/OIDC-Parameter), Cookies und WebSocket/Streaming-Verhalten nicht beschädigen. Origin-Zugriff sollte auf Cloudflare beschränkt werden, soweit Railway/Netzwerkoptionen dies erlauben. Next.js `allowedOrigins` und `X-Forwarded-Host` bleiben exakt konfiguriert. Auth-Antworten und private Seiten dürfen nicht öffentlich gecacht werden.

Für jeden Origin werden Access-Audience, Issuer/JWKS, erwarteter Host und Proxy-Vertrauensgrenzen konfiguriert. Der Worker darf keine selbst erfundenen, unsignierten Benutzerheader als Authentifizierung verwenden.

## 9. Migrationsstrategie

1. Externe Entscheidungen: Entra-Tenant/App-Registrierungen, Access-Lizenz/Policies, verantwortliche Administratoren und Break-Glass-Verfahren klären.
2. Staging: signierte Identität validieren, `externalId` ergänzen, E-Mail-Mapping mit Konfliktbericht testen.
3. Dualer Übergang: bestehende lokale Anmeldung bleibt zunächst verfügbar; Benutzer verknüpfen kontrolliert ihr Microsoft-Konto. Administrator-/Break-Glass-Konten besonders absichern.
4. Portal einführen und App-Karten/Zugriffsregeln aktivieren.
5. SSO für Change Request verpflichtend machen, nachdem Zuordnung, Audit, Logout und Notfallzugang getestet sind.
6. Lokale Passwortanmeldung und Passwort-Reset erst anschließend deaktivieren. `passwordHash` kann nullable bleiben; historische Benutzer- und Geschäftsbeziehungen bleiben erhalten.
7. Weitere Apps folgen demselben Identitätsvertrag, aber eigener Autorisierung.

## 10. Sicherheit

- OIDC-/Access-JWT vollständig validieren: Signatur, Algorithmus, `iss`, `aud`, `exp`, `nbf`, Tenant und Nonce/State beim OIDC-Flow.
- Keine Identität aus E-Mail- oder `X-*`-Headern ohne kryptografische Verifikation ableiten.
- Kurze App-Sitzungen, sichere HttpOnly-Cookies, Rotation nach Login, serverseitige Invalidierung und CSRF-Schutz beibehalten.
- Globaler Logout beendet Portal-/App-Sitzungen und initiiert Access-/Entra-Logout. Vollständiger Single Logout ist abhängig von Provider-Funktionen und muss praktisch getestet werden.
- Schlüsselrotation/JWKS-Caching, Audit für Mapping-/Rollenänderungen, Rate Limits und Alarmierung vorsehen.
- Break-Glass-Zugang dokumentieren, stark schützen und regelmäßig testen; kein dauerhaft allgemein verfügbares Hintertür-Passwort.

## 11. Portal-UI-Spezifikation

Das Portal bleibt eine responsive Anwendungsnavigation, kein Analytics-Dashboard.

- Header: FALU-Marke/Logo links; angemeldeter Mitarbeiter sowie Konto/Abmelden rechts; mobil kompakt.
- Inhalt: tageszeitabhängige Begrüssung („Guten Morgen, Florian“) und Überschrift „Ihre Anwendungen“.
- Karten: Icon, Name, kurze Aufgabe und klare Aktion „Anwendung öffnen“. „Änderungsanträge“ verweist auf `/aenderungsantrag`; PMS, Shop und Service können als „Demnächst“ deaktiviert sein.
- Zugriff: grundsätzlich nur berechtigte Apps anzeigen; angekündigte Apps dürfen bewusst als deaktiviert erscheinen. Keine sensiblen Ablehnungsgründe offenlegen.
- Layout: Desktop-Raster, Tablet zwei Spalten, Smartphone eine Spalte; Tastaturfokus, ausreichender Kontrast und Touch-Ziele ≥ 44 px.

## 12. Implementierungsphasen

1. Identity-/Lizenzentscheid und Threat Model.
2. Entra-/Access-Staging und JWT-Verifikationsbibliothek mit negativen Tests.
3. Benutzer-Mapping, Admin-Diagnose und Audit.
4. Portal-MVP mit App-Zugriffsmodell.
5. Change-Request-Dualbetrieb und Pilotgruppe.
6. verpflichtendes SSO, koordinierter Logout und Abschaltung lokaler Passwortflüsse.
7. standardisiertes Onboarding weiterer Apps.

## 13. Erforderliche externe Konfiguration

- Entra App-Registrierung(en), Redirect-URIs, Tenant-ID, Claims und ggf. Gruppenstrategie.
- Falls gewählt: Cloudflare Access Application, Entra-IdP-Verbindung, Policies, Audience/Team-Domain und Service Tokens für technische Zugriffe/Webhooks.
- Railway-Secrets für Issuer/Audience/JWKS bzw. OIDC-Clientdaten; niemals im Repository.
- Worker-Routen und Header-Bereinigung, Origin-Schutz, Cache-Regeln und Logout-URLs.
- DNS/TLS, Staging-Host, Monitoring, Owner und Notfallverfahren.

## 14. Offene Risiken und Entscheidungen

- Sind Cloudflare Access und erforderliche Entra-Funktionen in den vorhandenen Lizenzen enthalten?
- Eine oder mehrere Entra App-Registrierungen/Audiences für die Apps?
- Wo liegt die zentrale Liste der App-Zugriffe, und wer darf sie administrieren?
- Soll jede App eine eigene Session halten oder bei jedem Request den Access-JWT validieren?
- Welche Claims sind im realen Tenant stabil verfügbar; wie werden E-Mail-Änderungen behandelt?
- Wie funktionieren globaler Logout, technische Webhooks und Notfallzugriff im konkreten Access-Setup?
- Wie wird der Railway-Origin gegen direkte Umgehung von Cloudflare geschützt?

Diese Dokumentation ändert die bestehende Produktionsauthentifizierung nicht. Die lokale Anmeldung und Passwort-Wiederherstellung bleiben unverändert, bis eine separate, getestete Migrationsphase freigegeben wird.

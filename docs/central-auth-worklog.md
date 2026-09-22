# Arbeitsprotokoll – zentrale Änderungsantrag-Identität

Stand 21.09.2026, vor Implementierung. Beide Ausgangsbäume sauber; Branch codex/central-auth-integration.

## Ist-Zustand und Ursache
Portal: bcrypt 12, SHA-256-gehashte 7-Tage-Datenbanksessions im HttpOnly/Secure-Cookie falu-admin-session; zentrale Rollen und App-Zugriffe. Kundeneinsätze verwendet bereits Ed25519-Assertions (15 Sekunden, Request-Bindung, Replay-Sperre). Änderungsanträge: unabhängiges Cookie falu-session, Session/Passwort-Reset/UserRole-Tabellen; Proxy prüft Cookiepräsenz, Guards laden lokale Rollen. Deshalb können zwei verschiedene Benutzer gleichzeitig gelten. Alte Entra-Zieldokumentation ist überholt.

## Ziel
Vorhandenes Assertion-Protokoll für Audience CHANGE_REQUEST und /aenderungsantrag wiederverwenden. Generische ApplicationRole/UserApplicationRole-Relationen im Portal, Mehrfachrollen und DB-Integrität mit App-Zugriff. Keine impliziten App-Rechte für Portal-ADMIN. Lokale Referenzen ausschließlich über externalId; kein Laufzeit-E-Mail-Matching. Lokale Auth-Aktionen und Benutzerverwaltung entfernen, historische Tabellen erhalten. Delegationen, Empfängerauswahl und Hintergrundjobs müssen aktuelle zentrale Rollen/Zugriffe über einen authentifizierten, signierten Verzeichnisabruf verwenden. Keine dauerhafte lokale Rollenkopie.

## Migration und Grenzen
Additive Schema-Migrationen: generische Rollen im Portal, Replay-Ledger in CR. Bestehende Zugriffe erhalten. Fünf genannte lokale Konten benötigen explizites, geprüftes ID-Mapping; abweichende E-Mails sind kein automatisches Mapping. Separates Dry-Run-/Apply-Verfahren, keine Datenübernahme im Deployment. Historie, Stammdaten, Zähler bleiben unverändert. Keine Produktionsänderungen, kein main-Push. Private Schlüssel nur Portal; App erhält öffentlichen Schlüssel und eng begrenzten Verzeichnis-Servicecredential. Worker entfernt Alt-Cookies/Identitätsheader; Origin prüft selbst kryptografisch. Revocation beim nächsten Abruf, Restlaufzeit maximal 15 Sekunden; bereits gestartete Aktionen bleiben in-flight.

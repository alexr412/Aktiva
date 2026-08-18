# ARCHITECTURE GUARD & PROTECTED MODULES

## 1. Governance & Modul-Grenzen

Dieses Dokument definiert die verbindliche Architekturstruktur und die Schutzregeln für den Aktiva-Codebestand.

Das Projekt folgt dem Prinzip des **Modularen Monolithen**:

- **App / Page Layer (`src/app/`)**: Verantwortlich für Routing, Seitenkomposition, Layout, Modals und UI-State.
- **Feature Layer (`src/features/`)**: Kapselt fachliche Kern-Logik (z.B. Feed Engine, Feed Filter). Features bieten schmale öffentliche Schnittstellen.
- **Shared / Lib Layer (`src/lib/`)**: Technische, mathematische oder datenbankspezifische Utilities.
- **Contexts & Hooks (`src/contexts/`, `src/hooks/`)**: Globale React State Provider & wiederverwendbare Data Fetching Hooks.

---

## 2. Protected Modules (Schutz-Katalog)

Die folgenden Kerndateien sind als **PROTECTED** klassifiziert:

```text
src/features/feed/**
src/lib/ranking.ts
src/lib/geo-utils.ts
src/lib/geoapify.ts
src/contexts/location-context.tsx
src/contexts/auth-context.tsx
src/hooks/use-friend-radar.tsx
```

### Unumstößliche Schutzregeln für Protected Modules:

1. **Kein automatisches Mitbearbeiten:** UI-Aufgaben (Header, Buttons, Abstände, Modals, Responsive Layout) dürfen **NIEMALS** Dateien in Protected Modules verändern.
2. **Begründungspflicht & Stopp-Regel:** Falls eine Änderung an einem Protected Module zwingend notwendig erscheint, muss die Bearbeitung **SOFORT GESTOPPT** und im Abschlussbericht/User-Prompt begründet werden.
3. **Behavior Preservation:** Logik in `src/lib/ranking.ts` oder `src/features/feed/` wird bei Refactorings nur **mechanisch (1:1)** verschoben, keinesfalls neu geschrieben, optimiert, vereinfacht oder formelmäßig angepasst.
4. **Golden Master Protection:** Vor Änderungen an Feature-Engines muss das bestehende Verhalten durch deterministische Regressionstests festgeschrieben sein.

---

## 3. Erlaubte Abhängigkeitsrichtungen

- `src/app/` $\to$ `src/features/`, `src/components/`, `src/contexts/`, `src/lib/`
- `src/features/` $\to$ `src/lib/`, `src/contexts/`
- `src/components/` $\to$ `src/lib/`, `src/types/` (UI-Komponenten sollen reine Präsentations-Komponenten sein)
- **VERBOTEN:** Zirkuläre Abhängigkeiten zwischen Features oder direkte Mutationen interner Zustandselemente anderer Features.

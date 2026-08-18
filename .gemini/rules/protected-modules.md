# PROTECTED MODULES

Folgende Verzeichnisse und Kernmodul-Dateien sind als **PROTECTED** klassifiziert:

```text
src/features/feed/**
src/lib/ranking.ts
src/lib/geo-utils.ts
src/lib/geoapify.ts
src/contexts/location-context.tsx
src/contexts/auth-context.tsx
src/hooks/use-friend-radar.tsx
src/lib/duplicate-detector.ts
src/components/map/map-marker-data.ts
src/lib/moderation/blacklist.ts
```

## Schutzregeln für Antigravity-Agenten

1. **Verbot unangemeldeter Änderungen:** Protected Modules dürfen **NUR** verändert werden, wenn eine Benutzeranforderung ausdrücklich diesen spezifischen fachlichen Kernbereich betrifft.
2. **Keine Änderungen bei UI-Aufgaben:** Bei Aufgaben zu UI, Styling, Layout, Modals, Header-Buttons, Spacing oder CSS dürfen **unter keinen Umständen** Dateien aus der Liste der Protected Modules verändert werden.
3. **Stopp & Report:** Falls eine Aufgabe überraschend eine Änderung an einem Protected Module zu erfordern scheint, muss die Ausführung **SOFORT GESTOPPT** und dem Benutzer vorab erklärt werden, warum eine Änderung notwendig ist.
4. **Kein "Nebenbei"-Refactoring:** Keine funktionierende Kernlogik aufräumen, neu strukturieren, vereinfachen oder umbenennen.
5. **Behavior Preservation:** Änderungen an Kernbereichen setzen zwingend voraus, dass das bisherige Verhalten zuerst durch einen automatisierten Test festgeschrieben wird.

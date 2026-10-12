# Spot-Caches und Stadt-Kataloge

## Bereits aktiv

Der Startseiten-Feed liest Spot-Metadaten maximal alle fünf Minuten erneut. IndexedDB bewahrt sie auch beim erneuten Öffnen auf. Gleiche parallele Abfragen teilen eine Anfrage. Eigene Abstimmungen verwerfen den betroffenen Cache sofort. Geöffnete Spot-Details, Chats und Aktivitäten behalten ihre Live-Abos. Unveränderte Feed-Einstellungen erzeugen keinen Write.

Die lokalen Zähler `localDataMetrics` in `src/lib/cache/local-data-cache.ts` erfassen Cache-Treffer, zusammengeführte Anfragen, Loader-Aufrufe und gelesene Dokumente dieser Loader. Mehrere Loader-Aufrufe können eine gebündelte Firestore-Abfrage bilden. Sie erzeugen keine Telemetrie-Writes. Security-Rule-Reads und übrige App-Abfragen sind darin nicht enthalten; die tatsächliche Abrechnung bleibt in Firebase Usage sichtbar.

Im Entwicklungsmodus sind diese Zähler in der Browser-Konsole als `window.__ACTIVA_DATA_METRICS__` sichtbar.

## Eine Stadt veröffentlichen

Eine JSON-Datei mit diesem Format vorbereiten. Die Angaben hier sind ein Formatbeispiel, kein veröffentlichter Spot-Bestand:

```json
{
  "cityId": "example-city",
  "name": "Beispielstadt",
  "lat": 52.52,
  "lon": 13.405,
  "radiusMeters": 30000,
  "places": [
    {
      "id": "STABILE-QUELLEN-ID",
      "name": "Name des geprüften Spots",
      "address": "Adresse",
      "lat": 52.52,
      "lon": 13.405,
      "categories": ["leisure.park"],
      "openingHours": "Mo-Su 08:00-20:00"
    }
  ]
}
```

Geoapify-Spots behalten ihre ursprüngliche `place_id` als `id`. Kategorien entsprechen den bestehenden App-/Geoapify-Kategorien. Quellenangaben zu OpenStreetMap und Geoapify bleiben erforderlich. Nur geprüfte öffentliche Ortsangaben veröffentlichen. Das Skript übernimmt ausschließlich die gezeigten Stammdaten; Abstimmungen, Nutzer-IDs und Teilnehmer werden nicht kopiert.

1. Lokal validieren: `npx tsx scripts/publish-spot-catalog.ts --input city.json`. Ohne `--publish` erfolgen keine Cloud-Zugriffe.
2. Geänderte `firestore.rules` und `firestore.indexes.json` im vorgesehenen Projekt veröffentlichen. Kataloge bleiben für Gäste und gesperrte/nicht fertig eingerichtete Konten gesperrt; alle Client-Writes sind verboten.
3. Mit Admin-Zugang veröffentlichen: `npx tsx scripts/publish-spot-catalog.ts --input city.json --project PROJECT_ID --publish`. Das Skript nutzt bestehende Admin-Zugangsdaten oder Application Default Credentials. Projekt explizit angeben.
4. `NEXT_PUBLIC_SPOT_CATALOGS_ENABLED=true` in der Hosting-Konfiguration setzen und die App neu bauen/veröffentlichen. Die Funktion bleibt bis dahin deaktiviert.

Mit der vorhandenen lokalen Firebase-CLI-Anmeldung ist kein neuer Service-Account-Schlüssel erforderlich: `npx tsx scripts/publish-spot-catalog.ts --input data/spot-catalogs/bremerhaven-pilot.json --project activa-444220 --check-access --firebase-cli-login` validiert den Import und liest ausschließlich den Katalog-Index. Es erfolgen null Datenbank-Writes. Zum tatsächlichen Import `--check-access` durch `--publish` ersetzen. Der optionale Login-Adapter nutzt die ADC-Datei, die die installierte Firebase-CLI für das bestehende Projektkonto im Benutzerprofil verwaltet. Er verändert keine Kontoberechtigungen und gibt keine Zugangsdaten aus. Er verwendet CLI-interne Schnittstellen; nach einem CLI-Update die Zugriffsprüfung wiederholen. Der normale Admin-/ADC-Weg bleibt verfügbar.

Das Skript speichert unveränderliche Seiten in `spot_catalog_pages` und veröffentlicht gleichzeitig eine neue Version in `spot_catalogs/index`. Derselbe Inhalt erzeugt dieselbe Version und beim Wiederholen keine Writes. Ein Katalog darf maximal 24 Seiten mit je 300 KB JSON umfassen, damit die Veröffentlichung in eine Transaktion passt. Größere Bestände müssen in getrennte Gebiete aufgeteilt werden.

Die App prüft den Index höchstens einmal in 24 Stunden pro Konto/Gerät und lädt nur eine passende Stadt. Ein unveränderter, lokal vorhandener Bestand wird nicht erneut übertragen. Suche nach Kategorien, Entfernungssortierung und Paginierung dieses Bestands laufen lokal. Das ist eine kuratierte Auswahl, kein vollständiges Verzeichnis aller Orte. Die gesamte Suchfläche muss innerhalb des Katalogradius liegen; außerhalb bleibt Geoapify zuständig.

Zum Bearbeiten oder Entfernen von Spots dieselbe Stadt-JSON ändern und erneut veröffentlichen. Eine neue Version ersetzt den lokalen Bestand vollständig; entfernte Orte bleiben nicht aus alten Katalogseiten erhalten. Öffnungszeiten können dadurch bis zur nächsten täglichen Versionsprüfung veraltet sein. Bei fehlender IndexedDB funktioniert ein begrenzter Speicher-Cache; nach einem Neuladen können erneut Reads nötig werden.

Alte veröffentlichte Seiten zunächst aufbewahren: Geräte können einen bis zu 24 Stunden alten Index besitzen. Es gibt absichtlich keine automatische Cloud-Löschung. Rollback: Feature-Flag auf `false` setzen und neu veröffentlichen; Geoapify übernimmt wieder die Entdeckung.

## Stadt-Entwürfe: Bremerhaven zuerst, Bielefeld später

Bremerhaven ist als erster Pilot vorgesehen, weil der Gründer dort bis Ende Oktober 2026 vor Ort testen kann. `data/spot-catalogs/bremerhaven.json` enthält den lokalen Entwurf; `data/spot-catalogs/bremerhaven-review.md` die lesbare Prüfliste. Erzeugen: `npx tsx scripts/prepare-bielefeld-catalog.ts --city bremerhaven`. Trotz des bestehenden Skriptnamens unterstützt der Import beide Städte. Quellencaches, Kataloge und Berichte werden je Stadt getrennt gespeichert. Der Bielefelder Entwurf bleibt für die nächste Stadt erhalten. Beide Kataloge sind unveröffentlicht; die Feature-Flag bleibt deaktiviert.

`data/spot-catalogs/bielefeld.json` ist ein lokaler, noch nicht veröffentlichter Pilot-Bestand. Die lesbare Auswahl mit Quellen, Abrufdatum und Kartenlinks steht in `data/spot-catalogs/bielefeld-review.md`. Es handelt sich um Vorschläge aus öffentlichen Geoapify-/OpenStreetMap-Daten, nicht um bestätigte beliebte Spots. Zugang, Öffnungszeiten und Eignung müssen vor dem Start geprüft werden.

`npx tsx scripts/prepare-bielefeld-catalog.ts` erstellt diesen Entwurf. Das Skript liest den bestehenden Geoapify-Schlüssel ausschließlich aus der lokalen Umgebung, begrenzt einen Lauf auf sechs Anfragen und bewahrt öffentliche Quellenfelder in `bielefeld-source-*.json` auf. Ein erneuter Lauf verwendet diese Dateien ohne weitere API-Aufrufe. `--refresh` lädt alle sechs Quellen erneut. Die Katalogdatei dabei nicht nach einer manuellen Kuratierung neu erzeugen, sonst werden die eigenen Änderungen überschrieben.

Die Auswahl enthält nur benannte Orte innerhalb der gelieferten Stadtgrenze. Doppelte Quellen-IDs, gleiche Namen innerhalb von 40 Metern, ausdrücklich gesperrter/privater Zugang, Schulangebote ohne bestätigten öffentlichen Zugang und Archive werden ausgeschlossen. Die pro Bereich begrenzten Suchergebnisse sind nicht vollständig. Gleichnamige Filialen an verschiedenen Adressen bleiben erhalten und müssen bei der Durchsicht unterschieden werden. Der Importbericht dokumentiert verworfene Kandidaten. Der Entwurf enthält weder Beliebtheitswerte noch Nutzerdaten und das Importscript greift nicht auf Firebase zu.

## Kuratierter Bremerhaven-Pilot und allgemeine Ideen

Die erweiterte Pilot-Auswahl steht in `data/spot-catalogs/bremerhaven-pilot.json` (75 Orte) und lesbar in `data/spot-catalogs/bremerhaven-pilot-review.md`: 20 Cafés/Eis/Trefforte, 18 Restaurants, 10 Parks/Outdoor-Trefforte, 17 Sport-/Freizeit-/Kulturangebote und Bibliotheken sowie 10 Bars/Karaoke-/Spieletrefforte. Die ursprünglichen 13 Orte bleiben enthalten. Die Bar Karlsburg ist ausdrücklich bestätigt. Der gesamte Vorschlagsbestand in `bremerhaven.json` ist um Restaurants und fehlende Freizeitangebote ergänzt. Die Auswahl ist keine gemessene Beliebtheitsliste; Betreiberprüfungen und noch offene Prüfungen sind in der Prüfliste ausgewiesen.

`npx tsx scripts/curate-bremerhaven-catalog.ts` ergänzt den Grundimport und erstellt die Pilot-Auswahl anhand der benannten Gruppen in `bremerhaven-pilot-selection.json`. Höchstens sechs zusätzliche Geoapify-Abfragen erfolgen bei vollständig fehlenden Ergänzungscaches; Folgeläufe verwenden die drei Dateien `bremerhaven-source-*-additions.json` ohne API-Aufrufe. Neue Anbieter ohne eigenes POI erhalten feste Katalog-IDs; öffentlich belegte Adressen werden exakt geokodiert. Der genaue Eingang muss vor Ort geprüft werden. Vorhandene Geoapify-IDs bleiben bei Namensänderungen erhalten. Doppelte IDs, mehrdeutige Ortsnamen und fehlende ursprüngliche Pilot-Orte brechen die Kuratierung ab. Der Bericht enthält Quellen, Gruppen, ausgewählte IDs und die Version des Piloten. Der 75-Orte-Pilot benötigt eine Katalogseite, die nach dem ersten Laden lokal gespeichert wird. Wird der Grundimport erneut erstellt, danach dieses Kuratierungsskript erneut ausführen. Für einen Start mit dieser Auswahl die Pilot-Datei lokal validieren und später veröffentlichen, nicht den gesamten ungeprüften Bestand.

`src/lib/activity-ideas.ts` enthält sechs allgemeine, zweisprachige Ideen: Spazieren, Wandern, Radfahren, Shoppen, Brettspiele und Kaffee trinken. Sie stehen auf der Startseite auch in kleineren Städten bereit. Die Anzeige benötigt keine Datenbank-/Geoapify-Abfrage. Ein Klick öffnet den bestehenden Community-Dialog mit Titel und Kategorie; Treffpunkt und Termin werden im Formular festgelegt. Es wird keine Aktivität automatisch veröffentlicht. Die Vorschläge sind von Orten und tatsächlichen Community-Aktivitäten getrennt. Beim normalen Erstellen werden die Vorbelegungen wieder geleert.

## Prüfen

`npx tsx --test src/lib/cache/local-data-cache.test.ts src/lib/spot-catalog.test.ts`

Metadaten-Cache: `npx tsx --test src/lib/firebase/place-metadata-cache.test.ts`

Zugriffsregeln isoliert prüfen: `npx firebase emulators:exec --only firestore --project demo-activa-spot-cache --config firebase.spot-cache-test.json "npx tsx src/lib/firebase/spot-catalog-rules.test.ts"`

Die Tests vergleichen konkrete Loader-Aufrufe beim erneuten Öffnen, nach Ablauf, bei Versionswechsel und bei Cache-/Netzwerkfehlern. Für echte Einsparungen zusätzlich dieselben App-Abläufe in Firebase Usage vor/nach dem Rollout vergleichen.

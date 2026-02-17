
# Anleitung für bessere Prompts

Diese Anleitung hilft dir, deine Anfragen (Prompts) so zu formulieren, dass ich sie bestmöglich verstehen und umsetzen kann. Je präziser deine Anweisungen sind, desto schneller und besser wird das Ergebnis.

## 1. Sei so spezifisch wie möglich

Vage Anweisungen führen oft zu unbefriedigenden Ergebnissen. Versuche, deine Wünsche so detailliert wie möglich zu beschreiben.

**Schlecht:**
> "Mach die Chat-Seite schöner."

**Gut:**
> "Passe die Chat-Seite an. Die Sprechblasen sollen so aussehen wie bei WhatsApp. Meine Nachrichten sollen rechts in einem hellen Grün (`#e7ffdb`) erscheinen, die von anderen links in Weiß. Der Zeitstempel soll klein in der Ecke jeder Blase stehen."

## 2. Gib visuelle Referenzen und Beispiele

Verweise auf bekannte Apps oder Webseiten sind extrem hilfreich, da sie mir ein klares visuelles Ziel vorgeben.

**Beispiele:**
> "Ich möchte, dass die Profilseite so aufgebaut ist wie bei Instagram: Oben ein runder Avatar mit dem Namen, darunter eine Statistik für 'Aktivitäten' und 'Freunde'."

> "Für die Karten auf der Startseite, orientiere dich am mobilen Layout von Airbnb: Ein Bild links, die Infos wie Titel und Preis rechts daneben."

## 3. Zerlege komplexe Aufgaben in kleinere Schritte

Anstatt eine große, komplexe Funktion auf einmal anzufordern, zerlege sie in logische Teilschritte. Das macht den Prozess überschaubarer und erlaubt es dir, nach jedem Schritt Korrekturen vorzunehmen.

**Anstatt:**
> "Baue mir eine komplette Buchungsfunktion für Aktivitäten."

**Besser in Schritten:**
> 1. "Füge einen 'Aktivität buchen'-Button zur `PlaceDetails`-Komponente hinzu."
> 2. "Wenn der Button geklickt wird, soll sich ein Dialog mit einer Kalenderansicht öffnen, um ein Datum auszuwählen."
> 3. "Nach der Datumsauswahl, erstelle einen neuen Eintrag in einer 'bookings'-Kollektion in Firestore mit der `activityId`, `userId` und dem `date`."

## 4. Beziehe dich auf vorhandenen Code

Wenn du Änderungen an bestehenden Teilen der App vornehmen möchtest, nenne die Datei, die Komponente oder sogar die Funktion, die angepasst werden soll.

**Beispiele:**
> "In der Datei `src/components/aktvia/place-card.tsx`, ändere bitte das `Plus`-Icon zu einem `Calendar`-Icon aus `lucide-react`."

> "Die Funktion `handleSendMessage` in `src/app/chat/[chatId]/page.tsx` soll vor dem Senden prüfen, ob die Nachricht leer ist."

## 5. Gib präzises, iteratives Feedback

Genau das, was du in letzter Zeit getan hast, ist perfekt. Anstatt nur zu sagen "es ist kaputt", beschreibe genau, *was* nicht funktioniert.

**Schlechtes Feedback:**
> "Die Navigation funktioniert nicht."

**Gutes, präzises Feedback:**
> "Die untere Navigationsleiste verschwindet, wenn ich auf der Startseite nach oben scrolle. Sie sollte aber immer am unteren Bildschirmrand angeheftet bleiben."

Indem du diese Prinzipien anwendest, werden wir zu einem viel effizienteren Team. Ich danke dir für deine Kooperation!

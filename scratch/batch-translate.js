const fs = require('fs');

function translateFile(filePath, replacements) {
    let c = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // First, ensure 'language' is available if not already
    // (This was already handled in the previous specific edit for page.tsx, 
    // but we can be safe or just apply string replacements)

    for (const [search, replace] of replacements) {
        if (c.includes(search)) {
            // Using a simple split/join for exact matches to avoid regex escaping issues
            c = c.split(search).join(replace);
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, c);
        console.log(`Updated ${filePath}`);
    }
}

// replacements for src/app/page.tsx
const pageReplacements = [
    ['"Unbekannter Ort"', 'language === "de" ? "Unbekannter Ort" : "Unknown Place"'],
    ['"Keine Adresse verfügbar"', 'language === "de" ? "Keine Adresse verfügbar" : "No address available"'],
    ['"Standort wird ermittelt..."', 'language === "de" ? "Standort wird ermittelt..." : "Determining location..."'],
    ['"Verbindungsproblem."', 'language === "de" ? "Verbindungsproblem." : "Connection problem."'],
    ['>Keine Ergebnisse<', '>{language === "de" ? "Keine Ergebnisse" : "No results"}<'],
    ['>Passe deine Suche oder die Filter an.<', '>{language === "de" ? "Passe deine Suche oder die Filter an." : "Adjust your search or filters."}<'],
    ['>Filter zurücksetzen<', '>{language === "de" ? "Filter zurücksetzen" : "Reset filters"}<'],
    ['>Noch keine Favoriten<', '>{language === "de" ? "Noch keine Favoriten" : "No favorites yet"}<'],
    ['>Keine aktiven Aktivitäten.<', '>{language === "de" ? "Keine aktiven Aktivitäten." : "No active activities."}<'],
    ['>Keine vergangenen Aktivitäten.<', '>{language === "de" ? "Keine vergangenen Aktivitäten." : "No past activities."}<'],
    ['>Noch leer hier<', '>{language === "de" ? "Noch leer hier" : "Nothing here yet"}<'],
    ['>Entdecke spannende Orte in deiner Nähe.<', '>{language === "de" ? "Entdecke spannende Orte in deiner Nähe." : "Discover exciting places nearby."}<'],
    ['>Orte entdecken<', '>{language === "de" ? "Orte entdecken" : "Discover places"}<'],
    ['"Unbekannter Ort"', 'language === "de" ? "Unbekannter Ort" : "Unknown Place"'],
    ['"Keine Adresse"', 'language === "de" ? "Keine Adresse" : "No Address"'],
    ['"Bremerhaven"', 'language === "de" ? "Bremerhaven" : "Bremerhaven"'], // Names usually stay
    ['"Wird geladen..."', 'language === "de" ? "Wird geladen..." : "Loading..."'],
];

translateFile('src/app/page.tsx', pageReplacements);

// Also handle the create-activity-dialog
const dialogReplacements = [
    ['"Aktivität erstellen"', 'language === "de" ? "Aktivität erstellen" : "Create Activity"'],
    ['"Wann möchtest du starten?"', 'language === "de" ? "Wann möchtest du starten?" : "When do you want to start?"'],
    ['"Ort suchen..."', 'language === "de" ? "Ort suchen..." : "Search place..."'],
    ['"Titel der Aktivität"', 'language === "de" ? "Titel der Aktivität" : "Activity Title"'],
    ['"Beschreibung"', 'language === "de" ? "Beschreibung" : "Description"'],
    ['"Erstellen"', 'language === "de" ? "Erstellen" : "Create"'],
    ['"Abbrechen"', 'language === "de" ? "Abbrechen" : "Cancel"']
];

translateFile('src/components/aktvia/create-activity-dialog.tsx', dialogReplacements);

console.log('Batch translation completed.');

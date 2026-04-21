const fs = require('fs');

function translateFile(filePath, replacements) {
    let c = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Make sure we have useLanguage imported
    if (replacements.length > 0 && !c.includes("useLanguage()")) {
        if(c.includes("useAuth")) {
            c = c.replace(/import \{ useAuth \} from ['"]@\/hooks\/use-auth['"];/, "import { useAuth } from '@/hooks/use-auth';\nimport { useLanguage } from '@/hooks/use-language';");
        } else {
            c = "import { useLanguage } from '@/hooks/use-language';\n" + c;
        }

        if (c.includes('const { user, userProfile, loading: authLoading } = useAuth();')) {
            c = c.replace('const { user, userProfile, loading: authLoading } = useAuth();', "const { user, userProfile, loading: authLoading } = useAuth();\n    const language = useLanguage();");
        } else if (c.includes('export function CreateActivityDialog(')) {
            c = c.replace(/    const \{ user \} = useAuth\(\);/, "    const { user } = useAuth();\n    const language = useLanguage();");
        }
    }

    for (const [search, replace] of replacements) {
        if (c.includes(search)) {
            c = c.split(search).join(replace);
            modified = true;
        } else {
             console.log('NOT FOUND in ' + filePath + ': ' + search.substring(0, 50));
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, c);
        console.log(`Updated ${filePath}`);
    }
}

// 2. Profile Page (Bottom)
translateFile('src/app/profile/page.tsx', [
    ['>Profil bearbeiten<', ">{language === 'de' ? 'Profil bearbeiten' : 'Edit Profile'}<"],
    ['>Keine aktiven Aktivitäten.<', ">{language === 'de' ? 'Keine aktiven Aktivitäten.' : 'No active activities.'}<"],
    ['>Keine vergangenen Aktivitäten.<', ">{language === 'de' ? 'Keine vergangenen Aktivitäten.' : 'No past activities.'}<"],
    ['>Noch leer hier<', ">{language === 'de' ? 'Noch leer hier' : 'Nothing here yet'}<"],
    ['>Entdecke spannende Orte in deiner Nähe.<', ">{language === 'de' ? 'Entdecke spannende Orte in deiner Nähe.' : 'Discover exciting places nearby.'}<"],
    ['>Orte entdecken<', ">{language === 'de' ? 'Orte entdecken' : 'Discover Places'}<"],
    ['>Orte finden<', ">{language === 'de' ? 'Orte finden' : 'Find Places'}<"],
    ['>Reviews folgen in Kürze.<', ">{language === 'de' ? 'Reviews folgen in Kürze.' : 'Reviews coming soon.'}<"],
    ['>Schließen<', ">{language === 'de' ? 'Schließen' : 'Close'}<"],
    ['>Bild zuschneiden<', ">{language === 'de' ? 'Bild zuschneiden' : 'Crop Image'}<"],
    ['>Abbrechen<', ">{language === 'de' ? 'Abbrechen' : 'Cancel'}<"],
    ['>Bild speichern<', ">{language === 'de' ? 'Bild speichern' : 'Save Image'}<"]
]);

// 3. Create Activity Dialog
translateFile('src/components/aktvia/create-activity-dialog.tsx', [
    ['"Aktivität erstellen"', "language === 'de' ? 'Aktivität erstellen' : 'Create Activity'"],
    ['"Abbrechen"', "language === 'de' ? 'Abbrechen' : 'Cancel'"],
    ['>{place ? `Treffen am ${place.name} anfragen` : "Aktivität erstellen"}<', ">{place ? (language === 'de' ? `Treffen am ${place.name} anfragen` : `Request meetup at ${place.name}`) : (language === 'de' ? 'Aktivität erstellen' : 'Create Activity')}<"],
    ['>Titel der Aktivität<', ">{language === 'de' ? 'Titel der Aktivität' : 'Activity Title'}<"],
    ['"Zusammen grillen, Joggen im Park..."', "language === 'de' ? 'Zusammen grillen, Joggen im Park...' : 'BBQ together, jogging in the park...'"],
    ['>Beschreibe dein Treffen...<', ">{language === 'de' ? 'Beschreibe dein Treffen...' : 'Describe your meetup...'}<"],
    ['>Aktivität speichern<', ">{language === 'de' ? 'Aktivität speichern' : 'Save Activity'}<"]
]);

console.log('Batch translation done!');

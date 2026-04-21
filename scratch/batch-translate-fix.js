const fs = require('fs');

function translateFile(filePath, replacements) {
    let c = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const [search, replace] of replacements) {
        if (c.includes(search)) {
            c = c.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
            modified = true;
        }
    }
    
    // Custom insert for language
    if(filePath.includes('page.tsx')){
        if(c.includes('export default function Home() {') && !c.includes('const language = useLanguage();')) {
            c = c.replace(/import \{ useAuth \} from ['"]@\/hooks\/use-auth['"];/, "import { useAuth } from '@/hooks/use-auth';\nimport { useLanguage } from '@/hooks/use-language';");
            c = c.replace('export default function Home() {\n', "export default function Home() {\n  const language = useLanguage();\n");
            
            // Remove the lower one if it exists
            c = c.replace(/  const \{ user, userProfile \} = useAuth\(\);\n  const language = useLanguage\(\);/g, "  const { user, userProfile } = useAuth();");
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, c);
        console.log(`Updated ${filePath}`);
    }
}

// 3. Home / Explore Page
translateFile('src/app/page.tsx', [
    ['"Wird geladen..."', "language === 'de' ? 'Wird geladen...' : 'Loading...'"],
    ['"Standort suchen..."', "language === 'de' ? 'Standort suchen...' : 'Search location...'"],
    ['"Aktivitäten durchsuchen..."', "language === 'de' ? 'Aktivitäten durchsuchen...' : 'Search activities...'"],
    ['"Karte"', "language === 'de' ? 'Karte' : 'Map'"],
    ['"Liste"', "language === 'de' ? 'Liste' : 'List'"],
    ['>Lokale Highlights<', ">{language === 'de' ? 'Lokale Highlights' : 'Local Highlights'}<"],
    ['>Aktiv<', ">{language === 'de' ? 'Aktiv' : 'Active'}<"],
    ['>Alle<', ">{language === 'de' ? 'Alle' : 'All'}<"],
    ['>Erkunden<', ">{language === 'de' ? 'Erkunden' : 'Explore'}<"],
    ['>Suchradius<', ">{language === 'de' ? 'Suchradius' : 'Search Radius'}<"],
    ['"Orte & Aktivitäten laden..."', "language === 'de' ? 'Orte & Aktivitäten laden...' : 'Loading places & activities...'"],
    ['"Neuer Ort"', "language === 'de' ? 'Neuer Ort' : 'New Place'"],
    ['"Du entdeckst neue Orte in"', "language === 'de' ? 'Du entdeckst neue Orte in' : 'You are discovering new places in'"]
]);

console.log('Batch translation done!');

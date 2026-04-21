const fs = require('fs');

function translateFile(filePath, replacements) {
    let c = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Ensure useLanguage imported and initialized if not there
    if (replacements.length > 0 && !c.includes("useLanguage()")) {
        c = c.replace(/import \{ useAuth \} from ['"]@\/hooks\/use-auth['"];/, "import { useAuth } from '@/hooks/use-auth';\nimport { useLanguage } from '@/hooks/use-language';");
        // For profile page specifically:
        if (c.includes('const { user, userProfile, loading: authLoading } = useAuth();')) {
            c = c.replace('const { user, userProfile, loading: authLoading } = useAuth();', "const { user, userProfile, loading: authLoading } = useAuth();\n    const language = useLanguage();");
        }
    }

    for (const [search, replace] of replacements) {
        if (c.includes(search)) {
            // Need to escape regex characters safely, EXCEPT we'll just do a straight string replace since we only expect 1 match usually
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

// 2. Profile Page
translateFile('src/app/profile/page.tsx', [
    ['<h1 className="text-3xl font-black text-white tracking-tighter font-heading drop-shadow-sm">Profil</h1>', '<h1 className="text-3xl font-black text-white tracking-tighter font-heading drop-shadow-sm">{language === \'de\' ? \'Profil\' : \'Profile\'}</h1>'],
    ["const displayName = userData?.displayName || user.displayName || 'Anonymer Nutzer';", "const displayName = userData?.displayName || user.displayName || (language === 'de' ? 'Anonymer Nutzer' : 'Anonymous User');"],
    ['toast({ title: "Profilbild aktualisiert!" });', 'toast({ title: language === \'de\' ? "Profilbild aktualisiert!" : "Profile picture updated!" });'],
    ['toast({ variant: \'destructive\', title: \'Upload fehlgeschlagen\', description: error.message });', 'toast({ variant: \'destructive\', title: language === \'de\' ? \'Upload fehlgeschlagen\' : \'Upload failed\', description: error.message });'],
    ['toast({ title: \'Erfolgreich abgemeldet.\' });', 'toast({ title: language === \'de\' ? \'Erfolgreich abgemeldet.\' : \'Successfully logged out.\' });'],
    ['toast({ title: \'Fehler beim Beitritt.\', variant: \'destructive\' });', 'toast({ title: language === \'de\' ? \'Fehler beim Beitritt.\' : \'Error joining.\', variant: \'destructive\' });'],
    ['toast({ title: "Freund hinzugefügt!" });', 'toast({ title: language === \'de\' ? "Freund hinzugefügt!" : "Friend added!" });'],
    ['toast({ title: "Anfrage abgelehnt." });', 'toast({ title: language === \'de\' ? "Anfrage abgelehnt." : "Request declined." });'],
    ['toast({ title: "Username kopiert!" });', 'toast({ title: language === \'de\' ? "Username kopiert!" : "Username copied!" });'],
    ['toast({ title: \'Aktivität erstellt!\' });', 'toast({ title: language === \'de\' ? \'Aktivität erstellt!\' : \'Activity created!\' });'],
    ['toast({ variant: \'destructive\', title: \'Fehler beim Erstellen\'', 'toast({ variant: \'destructive\', title: language === \'de\' ? \'Fehler beim Erstellen\' : \'Creation error\''],
    
    // Tab labels
    ["tabName=\"activities\" label=\"Aktivitäten\"", "tabName=\"activities\" label={language === 'de' ? 'Aktivitäten' : 'Activities'}"],
    ["tabName=\"friends\" label=\"Freunde\"", "tabName=\"friends\" label={language === 'de' ? 'Freunde' : 'Friends'}"],
    ["tabName=\"stats\" label=\"Statistiken\"", "tabName=\"stats\" label={language === 'de' ? 'Statistiken' : 'Stats'}"],

    // Stats
    ['>Du hast keine abgeschlossenen Aktivitäten.<', '>{language === \'de\' ? \'Du hast keine abgeschlossenen Aktivitäten.\' : \'You have no completed activities yet.\'}<'],
    ['>Erstelle oder besuche Aktivitäten, um Trophäen zu sammeln!<', '>{language === \'de\' ? \'Erstelle oder besuche Aktivitäten, um Trophäen zu sammeln!\' : \'Create or join activities to collect trophies!\'}<'],
    ['>Aktivität erstellen<', '>{language === \'de\' ? \'Aktivität erstellen\' : \'Create Activity\'}<'],

    ['<span className="font-bold">Keine aktuellen Aktivitäten</span>', '<span className="font-bold">{language === \'de\' ? \'Keine aktuellen Aktivitäten\' : \'No current activities\'}</span>'],
    ['<p className="text-xs text-muted-foreground mt-1">Hier erscheinen deine geplanten Treffen.</p>', '<p className="text-xs text-muted-foreground mt-1">{language === \'de\' ? \'Hier erscheinen deine geplanten Treffen.\' : \'Your upcoming meetups will appear here.\'}</p>'],

    ['<span className="font-bold">Noch keine Freunde</span>', '<span className="font-bold">{language === \'de\' ? \'Noch keine Freunde\' : \'No friends yet\'}</span>'],
    ['<p className="text-xs text-muted-foreground mt-1">Finde Leute in deiner Nähe.</p>', '<p className="text-xs text-muted-foreground mt-1">{language === \'de\' ? \'Finde Leute in deiner Nähe.\' : \'Find people nearby.\'}</p>'],
    ['>Entdecken<', '>{language === \'de\' ? \'Entdecken\' : \'Discover\'}<']
]);

console.log('Batch translation done!');

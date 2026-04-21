const fs = require('fs');
let c = fs.readFileSync('src/app/settings/page.tsx', 'utf8');

const replacements = [
  // Community Support
  ['Unterstütze Aktvia', "{language === 'de' ? 'Unterstütze Aktvia' : 'Support Aktvia'}"],
  ['Spende einen kleinen Betrag & erhalte das Supporter-Badge.', "{language === 'de' ? 'Spende einen kleinen Betrag & erhalte das Supporter-Badge.' : 'Donate a small amount & get the supporter badge.'}"],

  // Radar
  ['<span>Freunde-Radar</span>', "<span>{language === 'de' ? 'Freunde-Radar' : 'Friends Radar'}</span>"],
  ['<Label htmlFor="radar-enabled" className="font-medium">Radar aktivieren</Label>', '<Label htmlFor="radar-enabled" className="font-medium">{language === \'de\' ? \'Radar aktivieren\' : \'Enable Radar\'}</Label>'],
  ['<p className="text-xs text-muted-foreground">Zeigt Freunde in deiner Nähe an, wenn sie die App nutzen.</p>', '<p className="text-xs text-muted-foreground">{language === \'de\' ? \'Zeigt Freunde in deiner Nähe an, wenn sie die App nutzen.\' : \'Show nearby friends when they use the app.\'}</p>'],
  ['<Label className="text-sm font-medium">Radar-Radius</Label>', '<Label className="text-sm font-medium">{language === \'de\' ? \'Radar-Radius\' : \'Radar Radius\'}</Label>'],
  ['Dein Standort wird nur bei App-Nutzung aktualisiert.', "{language === 'de' ? 'Dein Standort wird nur bei App-Nutzung aktualisiert.' : 'Your location is only updated while using the app.'}"],

  // Notifications
  ['<span>Benachrichtigungen</span>', "<span>{language === 'de' ? 'Benachrichtigungen' : 'Notifications'}</span>"],
  ['Lokale Highlights', "{language === 'de' ? 'Lokale Highlights' : 'Local Highlights'}"],
  ['Infos zu Top-Aktivitäten im 2km Umkreis.', "{language === 'de' ? 'Infos zu Top-Aktivitäten im 2km Umkreis.' : 'Info about top activities in a 2km radius.'}"],
  ['<Label htmlFor="friend-requests" className="font-medium">Freundesanfragen</Label>', '<Label htmlFor="friend-requests" className="font-medium">{language === \'de\' ? \'Freundesanfragen\' : \'Friend Requests\'}</Label>'],
  ['Bei neuen Anfragen informieren.', "{language === 'de' ? 'Bei neuen Anfragen informieren.' : 'Notify on new friend requests.'}"],
  ['<Label htmlFor="activity-invites" className="font-medium">Einladungen</Label>', '<Label htmlFor="activity-invites" className="font-medium">{language === \'de\' ? \'Einladungen\' : \'Invites\'}</Label>'],
  ['Bei Einladungen zu Aktivitäten informieren.', "{language === 'de' ? 'Bei Einladungen zu Aktivitäten informieren.' : 'Notify on activity invites.'}"],
  ['<Label htmlFor="chat-messages" className="font-medium">Chat-Nachrichten</Label>', '<Label htmlFor="chat-messages" className="font-medium">{language === \'de\' ? \'Chat-Nachrichten\' : \'Chat Messages\'}</Label>'],
  ['Bei neuen Nachrichten benachrichtigen.', "{language === 'de' ? 'Bei neuen Nachrichten benachrichtigen.' : 'Notify on new chat messages.'}"],
  
  // Creator
  ['<span>Creator Programm</span>', "<span>{language === 'de' ? 'Creator Programm' : 'Creator Program'}</span>"],
  ['<p className="font-bold">Monetarisierung & Wallet</p>', '<p className="font-bold">{language === \'de\' ? \'Monetarisierung & Wallet\' : \'Monetization & Wallet\'}</p>'],
  ['Schalte Creator-Features frei, um bezahlte Events zu hosten.', "{language === 'de' ? 'Schalte Creator-Features frei, um bezahlte Events zu hosten.' : 'Unlock creator features to host paid events.'}"],
  ['Du bist verifizierter Creator!', "{language === 'de' ? 'Du bist verifizierter Creator!' : 'You are a verified creator!'}"],
  ['Prüfung läuft...', "{language === 'de' ? 'Prüfung läuft...' : 'Review in progress...'}"],
  // These require careful replacement to not mess up HTML structure:
  ['<span className="text-[8px] font-bold uppercase text-slate-400">Aktivitäten</span>', '<span className="text-[8px] font-bold uppercase text-slate-400">{language === \'de\' ? \'Aktivitäten\' : \'Activities\'}</span>'],
  ['<span className="text-[8px] font-bold uppercase text-slate-400">Rating</span>', '<span className="text-[8px] font-bold uppercase text-slate-400">{language === \'de\' ? \'Bewertung\' : \'Rating\'}</span>'],
  ['{isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Als Creator bewerben"}', '{isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : language === \'de\' ? "Als Creator bewerben" : "Apply as Creator"}'],
  ['Erfülle beide Anforderungen, um dich zu bewerben.', "{language === 'de' ? 'Erfülle beide Anforderungen, um dich zu bewerben.' : 'Meet both requirements to apply.'}"]
];

for (const [search, replace] of replacements) {
    if(c.includes(search)) {
        c = c.replace(search, replace);
    } else {
        console.warn('NOT FOUND:', search);
    }
}

fs.writeFileSync('src/app/settings/page.tsx', c);
console.log('DONE');

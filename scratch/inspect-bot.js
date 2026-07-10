const https = require('https');

function testBot(userAgent) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'aktiva-jod0jzalv-alexr412s-projects.vercel.app',
      port: 443,
      path: '/activities/FROS2L5HyZmAm640Pc1I/invite',
      method: 'GET',
      headers: {
        'User-Agent': userAgent
      }
    };

    const req = https.request(options, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        resolve({
          userAgent: userAgent,
          statusCode: res.statusCode,
          title: (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || 'No Title',
          isSso: html.includes('sso') || html.includes('Vercel SSO')
        });
      });
    });

    req.on('error', (e) => resolve({ userAgent, error: e.message }));
    req.end();
  });
}

async function run() {
  const bots = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_oped.html)',
    'Twitterbot/1.0',
    'LinkedInBot/1.0 (Compatible; Heritrix/3.5.1; +http://www.linkedin.com)'
  ];
  
  for (const bot of bots) {
    const res = await testBot(bot);
    console.log(`User-Agent: ${res.userAgent.split(' ')[0]}`);
    console.log(`Status: ${res.statusCode}, Title: ${res.title}, IsSSO: ${res.isSso}`);
    console.log('----------------------------------------');
  }
}

run().catch(console.error);

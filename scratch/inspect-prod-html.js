const https = require('https');

function inspectProd() {
  const options = {
    hostname: 'aktiva.app',
    port: 443,
    path: '/activities/FROS2L5HyZmAm640Pc1I/invite',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  };

  const req = https.request(options, (res) => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
      const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'No Title';
      console.log('Page Title:', title);
      console.log('HTML contains 404:', html.includes('404') || html.includes('not found') || html.includes('nicht gefunden'));
      console.log('HTML snippet:', html.slice(0, 1500));
    });
  });

  req.on('error', console.error);
  req.end();
}

inspectProd();

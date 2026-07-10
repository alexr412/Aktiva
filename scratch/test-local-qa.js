const https = require('https');

function checkFirebaseUrl(hostname) {
  return new Promise((resolve) => {
    const options = {
      hostname: hostname,
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
        resolve({
          hostname,
          statusCode: res.statusCode,
          title: (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || 'No Title',
          length: html.length
        });
      });
    });

    req.on('error', (e) => resolve({ hostname, error: e.message }));
    req.end();
  });
}

async function run() {
  const hosts = [
    'activa-444220.web.app',
    'activa-444220.firebaseapp.com'
  ];
  for (const host of hosts) {
    const res = await checkFirebaseUrl(host);
    console.log(`Host: ${res.hostname}`);
    console.log(`Status: ${res.statusCode}, Title: ${res.title}, Length: ${res.length || 0}`);
  }
}

run().catch(console.error);

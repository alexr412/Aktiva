const https = require('https');

function inspectProd() {
  const options = {
    hostname: 'aktiva-six.vercel.app',
    port: 443,
    path: '/activities/xBwEk2JS9WuqC1dmCG5d/invite',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  };

  const req = https.request(options, (res) => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'No Title';
      console.log('Page Title:', title);
      console.log('Snippet:', html.slice(0, 1000));
    });
  });

  req.on('error', console.error);
  req.end();
}

inspectProd();

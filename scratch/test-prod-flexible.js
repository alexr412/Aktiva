const https = require('https');

function fetchProdUrl(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'aktiva-six.vercel.app',
      port: 443,
      path: path,
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
          path,
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          html
        });
      });
    });

    req.on('error', (err) => resolve({ path, error: err.message }));
    req.end();
  });
}

async function run() {
  console.log('Fetching flexible invite page from production...');
  const pageResult = await fetchProdUrl('/activities/xBwEk2JS9WuqC1dmCG5d/invite');
  console.log(`Invite Page Path: ${pageResult.path}`);
  console.log(`Status Code: ${pageResult.statusCode}`);
  console.log(`Contains "beendet": ${pageResult.html.includes('beendet') || pageResult.html.includes('Diese Aktivität ist bereits beendet')}`);
  console.log(`Contains "Zeit flexibel" or "flexibel": ${pageResult.html.includes('flexibel') || pageResult.html.includes('Flexibel')}`);
  
  console.log('----------------------------------------');
  
  console.log('Fetching flexible OG image from production...');
  const ogResult = await fetchProdUrl('/api/og/activity/xBwEk2JS9WuqC1dmCG5d');
  console.log(`OG Image Path: ${ogResult.path}`);
  console.log(`Status Code: ${ogResult.statusCode}`);
  console.log(`Content-Type: ${ogResult.contentType}`);
}

run().catch(console.error);

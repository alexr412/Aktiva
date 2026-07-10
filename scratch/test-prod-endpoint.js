const https = require('https');

function testUrl(path) {
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
      resolve({
        path,
        statusCode: res.statusCode,
        contentType: res.headers['content-type']
      });
    });

    req.on('error', (err) => resolve({ path, error: err.message }));
    req.end();
  });
}

async function run() {
  console.log('Testing live Vercel production API endpoints with real ID...');
  
  // Real ID in DB has a zero: FROS2L5HyZmAm640Pc1I
  const realResult = await testUrl('/api/og/activity/FROS2L5HyZmAm640Pc1I');
  console.log(`Real Activity ID Path: ${realResult.path}`);
  console.log(`Status Code: ${realResult.statusCode} (Expected: 200)`);
  console.log(`Content-Type: ${realResult.contentType} (Expected: image/png)`);
  console.log('----------------------------------------');

  const invalidResult = await testUrl('/api/og/activity/invalid-test-id');
  console.log(`Invalid Activity ID Path: ${invalidResult.path}`);
  console.log(`Status Code: ${invalidResult.statusCode} (Expected: 404)`);
  console.log(`Content-Type: ${invalidResult.contentType}`);
}

run().catch(console.error);

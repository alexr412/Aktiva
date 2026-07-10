const http = require('http');

function fetchPage(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 9002,
      path: path,
      method: 'GET',
      headers: {
        'Host': 'aktiva-jod0jzalv-alexr412s-projects.vercel.app'
      }
    };
    const req = http.request(options, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => resolve(html));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const detailsHtml = await fetchPage('/activities/FROS2L5HyZmAm640Pc1I');
  console.log('Details page has FirebaseError:', detailsHtml.includes('FirebaseError'));
  console.log('Details page has collection error message:', detailsHtml.includes('Expected first argument'));
  
  const inviteHtml = await fetchPage('/activities/FROS2L5HyZmAm640Pc1I/invite');
  console.log('Invite page has FirebaseError:', inviteHtml.includes('FirebaseError'));
  console.log('Invite page has collection error message:', inviteHtml.includes('Expected first argument'));
}

run().catch(console.error);

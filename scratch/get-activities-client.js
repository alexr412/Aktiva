const https = require('https');

const url = 'https://firestore.googleapis.com/v1/projects/activa-444220/databases/(default)/documents/activities?pageSize=20';

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (!json.documents) {
        console.log('No documents found or error:', json);
        return;
      }
      
      json.documents.forEach((doc) => {
        const fields = doc.fields || {};
        const docId = doc.name.split('/').pop();
        const title = fields.title?.stringValue || 'N/A';
        const status = fields.status?.stringValue || 'N/A';
        const maxParticipants = fields.maxParticipants?.integerValue || 'N/A';
        const participantIds = fields.participantIds?.arrayValue?.values || [];
        const joinedCount = participantIds.length;
        
        console.log(`ID: ${docId}`);
        console.log(`Title: ${title}`);
        console.log(`Status: ${status}`);
        console.log(`Spots: Joined ${joinedCount} / Max ${maxParticipants}`);
        console.log('---');
      });
    } catch (e) {
      console.error('Failed to parse response:', e);
    }
  });
}).on('error', (err) => {
  console.error('Request error:', err);
});

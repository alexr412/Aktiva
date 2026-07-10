const https = require('https');

const url = 'https://firestore.googleapis.com/v1/projects/activa-444220/databases/(default)/documents/activities?pageSize=100';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (!json.documents) {
        console.log('No documents found:', json);
        return;
      }
      
      let foundCancelled = null;
      let foundCompleted = null;
      let foundFull = null;
      
      json.documents.forEach((doc) => {
        const fields = doc.fields || {};
        const docId = doc.name.split('/').pop();
        const title = fields.title?.stringValue || 'N/A';
        const status = fields.status?.stringValue || 'N/A';
        const maxParticipants = parseInt(fields.maxParticipants?.integerValue || '0', 10);
        const participantIds = fields.participantIds?.arrayValue?.values || [];
        const joinedCount = participantIds.length;
        
        if (status === 'cancelled') {
          foundCancelled = { id: docId, title, status, joinedCount, maxParticipants };
        }
        if (status === 'completed') {
          foundCompleted = { id: docId, title, status, joinedCount, maxParticipants };
        }
        if (maxParticipants > 0 && joinedCount >= maxParticipants) {
          foundFull = { id: docId, title, status, joinedCount, maxParticipants };
        }
      });
      
      console.log('Cancelled:', foundCancelled);
      console.log('Completed:', foundCompleted);
      console.log('Full:', foundFull);
    } catch (e) {
      console.error(e);
    }
  });
});

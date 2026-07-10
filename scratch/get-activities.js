const admin = require('firebase-admin');

// Initialize Firebase Admin (uses application default credentials or local config)
admin.initializeApp({
  projectId: 'activa-444220'
});

const db = admin.firestore();

async function getActivities() {
  console.log('Fetching activities...');
  const snapshot = await db.collection('activities').limit(15).get();
  
  if (snapshot.empty) {
    console.log('No activities found.');
    return;
  }
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const spotsLeft = (data.maxParticipants || 0) - (data.participantIds?.length || 0);
    console.log(`ID: ${doc.id}`);
    console.log(`Title: ${data.title}`);
    console.log(`Status: ${data.status}`);
    console.log(`Spots Left: ${spotsLeft} (Max: ${data.maxParticipants}, Joined: ${data.participantIds?.length || 0})`);
    console.log(`Date: ${data.activityDate?.toDate ? data.activityDate.toDate().toISOString() : 'N/A'}`);
    console.log('---');
  });
}

getActivities().catch(err => {
  console.error('Error fetching activities:', err);
});

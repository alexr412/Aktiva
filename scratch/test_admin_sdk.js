const admin = require('firebase-admin');

admin.initializeApp({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'activa-444220'
});

const db = admin.firestore();

async function main() {
  const colRef = db.collection('places');
  const snap = await colRef.get();
  console.log(`Places count using Admin SDK: ${snap.size}`);
}
main().catch(console.error);

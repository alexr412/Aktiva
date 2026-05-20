const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const q = query(
    collection(db, 'places'),
    where('name', '==', 'Sankt Marien und historischer Friedhof')
  );
  
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log('No place found with name "Sankt Marien und historischer Friedhof"');
    
    // Let's do a wider search
    const allQ = collection(db, 'places');
    const allSnap = await getDocs(allQ);
    console.log(`Total places in Firestore: ${allSnap.size}`);
    allSnap.forEach(doc => {
      const name = doc.data().name || '';
      if (name.includes('Marien') || name.includes('Friedhof')) {
        console.log(`Found match: "${name}" =>`, doc.data());
      }
    });
  } else {
    snap.forEach(doc => {
      console.log(`Found place ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  }
}

main().catch(console.error);

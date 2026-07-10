const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "activa-444220.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDoc() {
  const docRef1 = doc(db, 'activities', 'FROS2L5HyZmAm64OPc1I');
  const snap1 = await getDoc(docRef1);
  console.log('Document FROS2L5HyZmAm64OPc1I (with O) exists:', snap1.exists());
  if (snap1.exists()) {
    console.log('Data (with O):', snap1.data());
  }

  const docRef2 = doc(db, 'activities', 'FROS2L5HyZmAm640Pc1I');
  const snap2 = await getDoc(docRef2);
  console.log('Document FROS2L5HyZmAm640Pc1I (with zero) exists:', snap2.exists());
  if (snap2.exists()) {
    console.log('Data (with zero):', snap2.data());
  }
}

checkDoc().catch(console.error);

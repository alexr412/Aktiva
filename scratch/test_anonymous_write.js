const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');

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
const auth = getAuth(app);

async function main() {
  console.log("Attempting anonymous sign in...");
  const userCredential = await signInAnonymously(auth);
  console.log("Signed in anonymously. User UID:", userCredential.user.uid);
  
  // Try to read and write a safe field
  const placeRef = doc(db, 'places', '51d7aab8cc441021405962fab9fce2034a40f00103f901c364211603000000c0020192031454686520537472696b65204269656c6566656c64');
  console.log("Attempting write to place doc...");
  await updateDoc(placeRef, {
    _dummy_test_field: Date.now()
  });
  console.log("Write successful!");
}

main().catch(e => {
  console.error("Test failed:", e);
});

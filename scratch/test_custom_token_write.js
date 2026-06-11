const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const admin = require('../functions/node_modules/firebase-admin');
const fs = require('fs');

// Initialize admin app using local CLI authentication
let credential;
try {
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const toolsConfigPath = path.join(userProfile, '.config/configstore/firebase-tools.json');
  if (fs.existsSync(toolsConfigPath)) {
    const toolsConfig = JSON.parse(fs.readFileSync(toolsConfigPath, 'utf8'));
    const refreshToken = toolsConfig.tokens?.refresh_token;
    if (refreshToken) {
      credential = admin.credential.refreshToken({
        type: 'authorized_user',
        client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
        client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
        refresh_token: refreshToken
      });
    }
  }
} catch (e) {
  console.warn("Failed to load Firebase CLI credentials:", e.message);
}

admin.initializeApp({
  credential,
  projectId: 'activa-444220'
});

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');
const { getAuth, signInWithCustomToken } = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const clientApp = initializeApp(firebaseConfig);
const clientDb = getFirestore(clientApp);
const clientAuth = getAuth(clientApp);

async function main() {
  console.log("Minting custom token using admin auth...");
  const customToken = await admin.auth().createCustomToken('soyEuPNmA9f2TxdZ6uxEwLpjbpt1');
  console.log("Custom token minted successfully!");

  console.log("Signing in using client auth...");
  const userCredential = await signInWithCustomToken(clientAuth, customToken);
  console.log("Signed in successfully. UID:", userCredential.user.uid);

  // Try to write to places doc
  const placeRef = doc(clientDb, 'places', '51d7aab8cc441021405962fab9fce2034a40f00103f901c364211603000000c0020192031454686520537472696b65204269656c6566656c64');
  console.log("Attempting write to place doc...");
  await updateDoc(placeRef, {
    _dummy_test_field: Date.now()
  });
  console.log("Write successful!");
}

main().catch(e => {
  console.error("Test failed:", e);
});

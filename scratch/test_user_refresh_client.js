const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { UserRefreshClient } = require('../functions/node_modules/google-auth-library');
const { Firestore } = require('../functions/node_modules/@google-cloud/firestore');
const fs = require('fs');

async function main() {
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const toolsConfigPath = path.join(userProfile, '.config/configstore/firebase-tools.json');
  if (!fs.existsSync(toolsConfigPath)) {
    throw new Error("firebase-tools.json not found");
  }

  const toolsConfig = JSON.parse(fs.readFileSync(toolsConfigPath, 'utf8'));
  const refreshToken = toolsConfig.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error("refresh_token not found in firebase-tools.json");
  }

  console.log("Initializing UserRefreshClient...");
  const authClient = new UserRefreshClient(
    '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    'j9iVZfS8kkCEFUPaAeJV0sAi',
    refreshToken
  );

  console.log("Initializing Firestore...");
  const db = new Firestore({
    projectId: 'activa-444220',
    authClient
  });

  console.log("Fetching places from Firestore...");
  const snap = await db.collection('places').get();
  console.log(`Successfully fetched ${snap.size} places!`);

  // Try updating one document
  const firstDoc = snap.docs[0];
  if (firstDoc) {
    console.log(`Attempting to update place: ${firstDoc.id} (${firstDoc.data().name})`);
    await firstDoc.ref.update({
      _dummy_test_client_field: Date.now()
    });
    console.log("Update successful!");
  }
}

main().catch(console.error);

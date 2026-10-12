import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { prepareSpotCatalog, publishSpotCatalog } from './spot-catalog-publish';

async function enableFirebaseCliLogin() {
  // Explicit opt-in: reuse the existing project account without exporting a service-account key.
  // Keep this CLI-specific adapter out of the browser app and normal Admin/ADC workflow.
  const require = createRequire(resolve('package.json'));
  const auth = require('firebase-tools/lib/auth');
  const defaults = require('firebase-tools/lib/defaultCredentials');
  if (typeof auth.getProjectDefaultAccount !== 'function' || typeof defaults.getCredentialPathAsync !== 'function') throw new Error('Installed Firebase CLI does not support the login adapter. Use Admin/ADC credentials.');
  const account = auth.getProjectDefaultAccount(process.cwd());
  if (!account?.tokens?.refresh_token) throw new Error('No existing Firebase CLI project login. Run firebase login first.');
  // Use the CLI's own ADC file mechanism, which Cloud Firestore supports.
  // Its existing login stays in the user profile; no credentials enter the repository or logs.
  let credentialPath: string | undefined;
  try { credentialPath = await defaults.getCredentialPathAsync(account); }
  catch { throw new Error('Existing Firebase CLI login could not be prepared; no credentials logged.'); }
  if (!credentialPath) throw new Error('Firebase CLI could not prepare application default credentials.');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath;
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag: string) => args[args.indexOf(flag) + 1];
  if (!args.includes('--input') || !value('--input') || value('--input').startsWith('--')) throw new Error('Usage: npx tsx scripts/publish-spot-catalog.ts --input city.json [--project PROJECT_ID --publish|--check-access] [--firebase-cli-login]');
  if (args.includes('--publish') && args.includes('--check-access')) throw new Error('Choose publication or a read-only access check.');
  const prepared = prepareSpotCatalog(JSON.parse(await readFile(value('--input'), 'utf8')));
  console.log(JSON.stringify({ city: prepared.city.cityId, version: prepared.city.version, spots: prepared.pages.reduce((sum, page) => sum + page.places.length, 0), pages: prepared.pages.length, mode: args.includes('--publish') ? 'publish' : args.includes('--check-access') ? 'read-only access check' : 'validation only' }, null, 2));
  if (!args.includes('--publish') && !args.includes('--check-access')) return;
  if (!args.includes('--project') || !value('--project') || value('--project').startsWith('--')) throw new Error('Cloud access requires an explicit --project PROJECT_ID.');
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (args.includes('--firebase-cli-login')) await enableFirebaseCliLogin();
  const credential = !args.includes('--firebase-cli-login') && serviceAccount ? cert(JSON.parse(serviceAccount)) : undefined;
  const app = initializeApp({ projectId: value('--project'), ...(credential ? { credential } : {}) });
  try {
    const db = getFirestore(app);
    if (args.includes('--check-access')) {
      const index = await db.collection('spot_catalogs').doc('index').get();
      console.log(JSON.stringify({ project: value('--project'), firestoreReadAccess: true, catalogIndexExists: index.exists, writes: 0 }));
      return;
    }
    const changed = await publishSpotCatalog(db, prepared);
    console.log(changed ? 'Published catalog atomically.' : 'Version unchanged; no database writes.');
  } catch (error: any) {
    // Cloud errors can contain request details. Report only the code, never credentials or payloads.
    throw new Error(`Catalog cloud operation failed (code ${typeof error.code === 'number' || typeof error.code === 'string' && /^[A-Za-z0-9/_-]+$/.test(error.code) ? error.code : 'unknown'}).`);
  } finally { await deleteApp(app); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

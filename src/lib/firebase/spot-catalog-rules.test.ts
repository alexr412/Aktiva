import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run this test in the Firestore emulator.');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const env = await initializeTestEnvironment({ projectId: 'demo-activa-spot-cache', firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'active'), { uid: 'active', onboardingCompleted: true, accountStatus: 'active', isBanned: false });
      await setDoc(doc(db, 'users', 'new'), { uid: 'new', onboardingCompleted: false });
      await setDoc(doc(db, 'users', 'banned'), { uid: 'banned', onboardingCompleted: true, isBanned: true });
      await setDoc(doc(db, 'spot_catalogs', 'index'), { catalogs: [] });
      await setDoc(doc(db, 'spot_catalog_pages', 'version-1'), { cityId: 'example', version: '1', places: [] });
    });
    for (const path of ['spot_catalogs/index', 'spot_catalog_pages/version-1']) {
      await assertSucceeds(getDoc(doc(env.authenticatedContext('active').firestore(), path)));
      for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('new').firestore(), env.authenticatedContext('banned').firestore()]) await assertFails(getDoc(doc(db, path)));
      await assertFails(updateDoc(doc(env.authenticatedContext('active').firestore(), path), { version: 'tampered' }));
    }
    await assertFails(setDoc(doc(env.authenticatedContext('active').firestore(), 'spot_catalogs', 'new'), { catalogs: [] }));
    await assertFails(setDoc(doc(env.authenticatedContext('active').firestore(), 'spot_catalog_pages', 'new'), { places: [] }));
    console.log('Spot catalog rules: authenticated active readers only; client writes denied.');
  } finally { await env.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

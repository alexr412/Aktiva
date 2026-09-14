import assert from 'assert';
import * as fs from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const PROJECT_ID = 'activa-444220';

export async function runStorageRulesTests() {
  let hostEnv = process.env.STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
  hostEnv = hostEnv.replace(/^https?:\/\//, '');
  const [host, portStr] = hostEnv.split(':');
  const port = parseInt(portStr || '9199', 10);

  let firestoreHostEnv = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  firestoreHostEnv = firestoreHostEnv.replace(/^https?:\/\//, '');
  const [fHost, fPortStr] = firestoreHostEnv.split(':');
  const fPort = parseInt(fPortStr || '8080', 10);

  console.log(`Initializing storage rules test environment on ${host}:${port}...`);

  let testEnv: any;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      storage: {
        host,
        port,
        rules: fs.readFileSync('storage.rules', 'utf8'),
      },
      firestore: {
        host: fHost,
        port: fPort,
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      }
    });
  } catch (err) {
    console.error('Failed to initialize Storage rules test environment:', err);
    process.exit(1);
  }

  try {
    await testEnv.clearStorage();
    await testEnv.clearFirestore();
    await new Promise((r) => setTimeout(r, 300));
    await testEnv.withSecurityRulesDisabled(async (context: any) => {
      try {
        await deleteObject(ref(context.storage(), 'kyc/alice/identity_document.jpg'));
      } catch (e) {}
    });

    console.log('Running Test 1: Owner can upload valid KYC document (JPEG, <10MB, allowed filename)...');
    const aliceStorage = testEnv.authenticatedContext('alice').storage();
    const aliceRef = ref(aliceStorage, 'kyc/alice/identity_document.jpg');
    const dummyBuffer = Buffer.from('dummy image content');
    await assertSucceeds(uploadBytes(aliceRef, dummyBuffer, { contentType: 'image/jpeg' }));
    console.log('✅ Test 1 passed');

    console.log('Running Test 1b: Owner can read own allowed KYC file...');
    await assertSucceeds(getBytes(aliceRef));
    console.log('✅ Test 1b passed');

    console.log('Running Test 2: Deny oversized file upload (>10MB)...');
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    await assertFails(uploadBytes(aliceRef, largeBuffer, { contentType: 'image/jpeg' }));
    console.log('✅ Test 2 passed');

    console.log('Running Test 3: Deny disallowed MIME type (text/plain)...');
    const scriptBuffer = Buffer.from('script content');
    await assertFails(uploadBytes(aliceRef, scriptBuffer, { contentType: 'text/plain' }));
    console.log('✅ Test 3 passed');

    console.log('Running Test 4: Deny disallowed filename (malicious.exe)...');
    const badFileRef = ref(aliceStorage, 'kyc/alice/malicious.exe');
    await assertFails(uploadBytes(badFileRef, dummyBuffer, { contentType: 'image/jpeg' }));
    console.log('✅ Test 4 passed');

    console.log('Running Test 5: Deny uploading to another user path...');
    const bobStorage = testEnv.authenticatedContext('bob').storage();
    const foreignRef = ref(bobStorage, 'kyc/alice/identity_document.jpg');
    await assertFails(uploadBytes(foreignRef, dummyBuffer, { contentType: 'image/jpeg' }));
    console.log('✅ Test 5 passed');

    console.log('Running Test 6: Deny foreign KYC read by regular user, supporter, moderator, finance...');
    await testEnv.withSecurityRulesDisabled(async (context: any) => {
      const storage = context.storage();
      const targetRef = ref(storage, 'kyc/alice/identity_document.jpg');
      await uploadBytes(targetRef, Buffer.from('kyc content'), { contentType: 'image/jpeg' });
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'bob'), { role: 'user' });
      await setDoc(doc(db, 'users', 'supporter1'), { role: 'supporter' });
      await setDoc(doc(db, 'users', 'mod1'), { role: 'moderator' });
      await setDoc(doc(db, 'users', 'fin1'), { role: 'finance' });
    });

    const bobReadRef = ref(testEnv.authenticatedContext('bob').storage(), 'kyc/alice/identity_document.jpg');
    const supporterReadRef = ref(testEnv.authenticatedContext('supporter1').storage(), 'kyc/alice/identity_document.jpg');
    const modReadRef = ref(testEnv.authenticatedContext('mod1').storage(), 'kyc/alice/identity_document.jpg');
    const finReadRef = ref(testEnv.authenticatedContext('fin1').storage(), 'kyc/alice/identity_document.jpg');

    await assertFails(getBytes(bobReadRef));
    await assertFails(getBytes(supporterReadRef));
    await assertFails(getBytes(modReadRef));
    await assertFails(getBytes(finReadRef));
    console.log('✅ Test 6 passed');

    console.log('Running Test 7: Allow foreign KYC read by Admin / Superadmin per Firestore user doc...');
    await testEnv.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'admin1'), {
        uid: 'admin1',
        displayName: 'Admin 1',
        username: 'admin1',
        role: 'admin',
        onboardingCompleted: true,
        isBanned: false
      });
      const checkSnap = await getDoc(doc(db, 'users', 'admin1'));
      console.log('DIAGNOSTIC - Seeded admin1 doc exists:', checkSnap.exists(), checkSnap.data());
      await setDoc(doc(db, 'users', 'super1'), {
        uid: 'super1',
        displayName: 'Super 1',
        username: 'super1',
        role: 'superadmin',
        onboardingCompleted: true,
        isBanned: false
      });
      await setDoc(doc(db, 'users', 'user_with_admin_doc'), {
        uid: 'user_with_admin_doc',
        displayName: 'User With Admin Doc',
        username: 'user_with_admin_doc',
        role: 'admin',
        onboardingCompleted: true,
        isBanned: false
      });
    });
    await new Promise((r) => setTimeout(r, 200));

    const adminReadRef = ref(testEnv.authenticatedContext('admin1', { role: 'admin' }).storage(), 'kyc/alice/identity_document.jpg');
    const superReadRef = ref(testEnv.authenticatedContext('super1', { role: 'superadmin' }).storage(), 'kyc/alice/identity_document.jpg');
    const userWithAdminDocRef = ref(testEnv.authenticatedContext('user_with_admin_doc', { role: 'user' }).storage(), 'kyc/alice/identity_document.jpg');

    await assertSucceeds(getBytes(adminReadRef));
    await assertSucceeds(getBytes(superReadRef));
    await assertSucceeds(getBytes(userWithAdminDocRef));
    console.log('✅ Test 7 passed (Firestore role admin/superadmin allows read even if token claim is user)');

    console.log('Running Test 7b: Deny admin/superadmin reading file with disallowed filename...');
    await testEnv.withSecurityRulesDisabled(async (context: any) => {
      const storage = context.storage();
      const badRef = ref(storage, 'kyc/alice/unauthorized.txt');
      await uploadBytes(badRef, Buffer.from('unauthorized content'), { contentType: 'text/plain' });
    });

    const adminBadFileRef = ref(testEnv.authenticatedContext('admin1').storage(), 'kyc/alice/unauthorized.txt');
    await assertFails(getBytes(adminBadFileRef));
    console.log('✅ Test 7b passed');

    console.log('Running Test 8: Deny token admin claim when Firestore user document is role "user" or missing...');
    await testEnv.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'ex_admin'), {
        uid: 'ex_admin',
        displayName: 'Ex Admin',
        username: 'ex_admin',
        role: 'user',
        onboardingCompleted: true,
        isBanned: false
      });
    });
    await new Promise((r) => setTimeout(r, 200));

    const staleAdminRef = ref(testEnv.authenticatedContext('ex_admin', { role: 'admin' }).storage(), 'kyc/alice/identity_document.jpg');
    const missingDocAdminRef = ref(testEnv.authenticatedContext('missing_doc_admin', { role: 'admin' }).storage(), 'kyc/alice/identity_document.jpg');

    await assertFails(getBytes(staleAdminRef));
    await assertFails(getBytes(missingDocAdminRef));
    console.log('✅ Test 8 passed (Token admin + Firestore user role -> DENY, Token admin + missing Firestore doc -> DENY)');

    console.log('Running Test 9: Deny overwrite of existing KYC file (resource == null)...');
    const charlieStorage = testEnv.authenticatedContext('charlie').storage();
    const charlieRef = ref(charlieStorage, 'kyc/charlie/identity_document.jpg');
    await assertSucceeds(uploadBytes(charlieRef, dummyBuffer, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(charlieRef, Buffer.from('overwrite attempt'), { contentType: 'image/jpeg' }));
    console.log('✅ Test 9 passed');

    console.log('🎉 ALL STORAGE RULES SECURITY HARDENING TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    await testEnv.cleanup();
  }
}

if (process.argv[1]?.endsWith('storage.rules.test.ts')) {
  runStorageRulesTests().catch((err) => {
    console.error('Storage rules test execution error:', err);
    process.exit(1);
  });
}

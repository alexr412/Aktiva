import * as admin from 'firebase-admin';

/**
 * Standalone Admin Migration Script for Legacy Location Fields.
 * 
 * Safely removes legacy `lastLocation` and `proximitySettings` fields from user profile documents.
 * 
 * Usage:
 * - Dry-run mode (default, no changes made):
 *     npx tsx scripts/migrate-legacy-locations.ts
 * 
 * - Execute mode (requires explicit --execute flag):
 *     npx tsx scripts/migrate-legacy-locations.ts --execute
 */

async function runLegacyLocationMigration() {
  const isExecute = process.argv.includes('--execute');
  const isDryRun = !isExecute;

  console.log('----------------------------------------------------');
  console.log(`🚀 Aktiva Legacy Location Migration Script`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (No changes will be written)' : 'EXECUTE (Writing changes to Firestore)'}`);
  console.log('----------------------------------------------------');

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();
  const projectId = admin.app().options.projectId || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
  console.log(`Target Project ID: ${projectId || 'Unknown / Emulator'}\n`);

  let processedCount = 0;
  let updatedCount = 0;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  const batchSize = 100;

  while (true) {
    let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc.id);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    let batchUpdates = 0;

    for (const doc of snapshot.docs) {
      processedCount++;
      const data = doc.data();
      const hasLastLocation = 'lastLocation' in data;
      const hasProximitySettings = 'proximitySettings' in data;

      if (hasLastLocation || hasProximitySettings) {
        updatedCount++;
        batchUpdates++;

        // Coordinate-free log output (security & privacy)
        console.log(`[${isDryRun ? 'DRY-RUN WOULD CLEAN' : 'CLEANING'}] User: ${doc.id} (fields: ${hasLastLocation ? 'lastLocation ' : ''}${hasProximitySettings ? 'proximitySettings' : ''})`);

        if (!isDryRun) {
          batch.update(doc.ref, {
            lastLocation: admin.firestore.FieldValue.delete(),
            proximitySettings: admin.firestore.FieldValue.delete(),
          });
        }
      }
    }

    if (!isDryRun && batchUpdates > 0) {
      await batch.commit();
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < batchSize) break;
  }

  console.log('\n----------------------------------------------------');
  console.log(`Migration Summary:`);
  console.log(`Total User Profiles Processed: ${processedCount}`);
  console.log(`Profiles ${isDryRun ? 'that would be cleaned' : 'cleaned'}: ${updatedCount}`);
  console.log('----------------------------------------------------\n');

  if (isDryRun && updatedCount > 0) {
    console.log('💡 To execute this migration and delete legacy fields, run:');
    console.log('   npx tsx scripts/migrate-legacy-locations.ts --execute\n');
  }
}

runLegacyLocationMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

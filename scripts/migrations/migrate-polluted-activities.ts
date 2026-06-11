import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config();

// Determine if we should perform a dry run
const isDryRun = process.argv.includes('--dry-run');

console.log(`========================================================`);
console.log(`🔥 RUNNING FIRESTORE ACTIVITY MIGRATION`);
console.log(`👉 Mode: ${isDryRun ? 'DRY RUN (No database mutations)' : 'LIVE UPDATE'}`);
console.log(`========================================================\n`);

// Initialize Firebase Admin SDK
// Looks for GOOGLE_APPLICATION_CREDENTIALS environment variable.
// If not found, falls back to default application credentials or emulator.
if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'activa-444220'
    });
    console.log('✅ Firebase Admin SDK initialized successfully.');
  } catch (err: any) {
    console.error('❌ Failed to initialize Firebase Admin SDK. Please make sure you are authenticated or have GOOGLE_APPLICATION_CREDENTIALS set.');
    console.error(err);
    process.exit(1);
  }
}

const db = admin.firestore();

function isGeoapifyCategory(c: string): boolean {
  const geoapifyPrefixes = [
    'accommodation', 'activity', 'airport', 'amenity', 'area', 'building',
    'catering', 'commercial', 'education', 'entertainment', 'leisure',
    'natural', 'office', 'parking', 'pet', 'power', 'railway', 'rental',
    'route', 'service', 'shopping', 'sport', 'tourism', 'public_transport',
    'religion', 'highway', 'man_made', 'waterway', 'wheelchair'
  ];
  const lower = c.toLowerCase();
  return lower.includes('.') || geoapifyPrefixes.includes(lower);
}

async function runMigration() {
  const activitiesRef = db.collection('activities');
  
  console.log('Fetching activities...');
  const snapshot = await activitiesRef.get();
  console.log(`Fetched ${snapshot.size} activities total. Processing...`);

  let totalProcessed = 0;
  let placeBasedFixed = 0;
  let communityFixed = 0;
  let skipped = 0;

  const batchSize = 500;
  let currentBatch = db.batch();
  let currentBatchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docId = doc.id;
    const categories = Array.isArray(data.categories) ? (data.categories as string[]) : [];
    const placeId = data.placeId as string | undefined;
    const hasUserEvent = categories.includes('user_event');

    const isPlaceBasedActivity = Boolean(placeId && placeId !== 'custom');
    const isFreeCommunityEvent = !placeId || placeId === 'custom';

    let needsUpdate = false;
    const updatePayload: Record<string, any> = {};

    if (isPlaceBasedActivity) {
      // Rule 1: Place-based activities must not contain "user_event"
      // and their isUserEvent must be false.
      const hasGeoapifyCats = categories.some(isGeoapifyCategory);
      if (hasUserEvent || hasGeoapifyCats || data.isUserEvent !== false || data.creationSource !== 'place_activity' || data.sourceType !== 'activity') {
        const cleanedCategories = categories.filter(c => c !== 'user_event' && !isGeoapifyCategory(c));
        // Ensure category or "Sonstiges" is inside categories array
        const finalCategory = data.category || 'Sonstiges';
        if (!cleanedCategories.includes(finalCategory)) {
          cleanedCategories.push(finalCategory);
        }

        updatePayload.categories = cleanedCategories;
        updatePayload.isUserEvent = false;
        updatePayload.sourceType = 'activity';
        updatePayload.creationSource = 'place_activity';
        
        needsUpdate = true;
        placeBasedFixed++;
      }
    } else if (isFreeCommunityEvent) {
      // Rule 2: Free community events must have user_event in categories,
      // isUserEvent: true, creationSource: "community", and normalizedCategory: "community".
      // They should also not have placeId equal to "custom" (or no placeId at all).
      const missingUserEvent = !hasUserEvent;
      const hasCustomPlaceId = placeId === 'custom';
      
      if (missingUserEvent || hasCustomPlaceId || data.isUserEvent !== true || data.creationSource !== 'community' || data.normalizedCategory !== 'community') {
        const cleanedCategories = categories.filter(c => c !== 'user_event');
        cleanedCategories.unshift('user_event');

        updatePayload.categories = cleanedCategories;
        updatePayload.isUserEvent = true;
        updatePayload.sourceType = 'activity';
        updatePayload.creationSource = 'community';
        updatePayload.normalizedCategory = 'community';
        
        if (hasCustomPlaceId) {
          updatePayload.placeId = admin.firestore.FieldValue.delete();
        }

        needsUpdate = true;
        communityFixed++;
      }
    }

    if (needsUpdate) {
      totalProcessed++;
      console.log(`[UPDATE] Doc ${docId} (${data.placeName || 'Aktivität'}):`);
      console.log(`   Before: categories=${JSON.stringify(categories)}, placeId=${placeId}, isUserEvent=${data.isUserEvent}`);
      console.log(`   After:  ${JSON.stringify(updatePayload)}`);

      if (!isDryRun) {
        currentBatch.update(doc.ref, updatePayload);
        currentBatchCount++;

        if (currentBatchCount >= batchSize) {
          console.log(`Committing batch of ${currentBatchCount} updates...`);
          await currentBatch.commit();
          currentBatch = db.batch();
          currentBatchCount = 0;
        }
      }
    } else {
      skipped++;
    }
  }

  // Commit remaining batch
  if (!isDryRun && currentBatchCount > 0) {
    console.log(`Committing final batch of ${currentBatchCount} updates...`);
    await currentBatch.commit();
  }

  console.log(`\n========================================================`);
  console.log(`🏁 MIGRATION COMPLETED`);
  console.log(`👉 Total activities scanned:     ${snapshot.size}`);
  console.log(`👉 Total activities modified:    ${totalProcessed}`);
  console.log(`   - Place-based activities:   ${placeBasedFixed}`);
  console.log(`   - Free community activities:${communityFixed}`);
  console.log(`👉 Total activities skipped:     ${skipped}`);
  console.log(`========================================================\n`);
}

runMigration().catch(err => {
  console.error('❌ Migration failed with error:', err);
  process.exit(1);
});

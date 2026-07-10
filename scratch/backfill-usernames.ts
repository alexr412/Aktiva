import * as admin from '../functions/node_modules/firebase-admin';

// 1. Argument parsing
const projectIndex = process.argv.indexOf('--project');
const projectIdArg = projectIndex !== -1 && process.argv[projectIndex + 1] ? process.argv[projectIndex + 1] : null;

if (!projectIdArg) {
  console.error(`[ERROR] Missing required argument: --project <projectId>. Aborting!`);
  process.exit(1);
}

const dryRun = process.argv.includes('--execute') ? false : true;

// Output recognized configuration
console.log(`[BACKFILL] Running in ${dryRun ? 'DRY-RUN' : 'EXECUTE'} mode.`);
console.log(`[BACKFILL] Target project: ${projectIdArg}`);

// Configure environment
process.env.GCLOUD_PROJECT = projectIdArg;
if (process.argv.includes('--emulator') || projectIdArg === 'aktiva-rules-test') {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  console.log(`[BACKFILL] Connecting to local emulator on 127.0.0.1:8080`);
}

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// 2. Statistics Tracking
const stats = {
  scanned: 0,
  eligible: 0,
  unchanged: 0,
  wouldUpdate: 0,
  updated: 0,
  skipped: 0,
  failed: 0
};

const failedPaths: string[] = [];

function logFailure(path: string, err: any) {
  stats.failed++;
  failedPaths.push(path);
  console.error(`[FAILURE] Error updating document at "${path}":`, err.message || err);
}

async function backfill() {
  console.log('Fetching users with username field...');
  const usersSnap = await db.collection('users').get();
  stats.scanned += usersSnap.size;
  
  // Create user profile lookup map
  const userMap = new Map();
  usersSnap.docs.forEach(d => {
    const data = d.data();
    if (data.username) {
      userMap.set(d.id, {
        username: data.username,
        photoURL: data.photoURL || null,
        isPremium: data.isPremium || false,
        isSupporter: data.isSupporter || false,
        isCreator: data.isCreator || false,
        age: data.age || null,
        location: data.location || null,
        bio: data.bio || null,
        interests: data.interests || [],
        ratingCount: data.ratingCount || 0,
        averageRating: data.averageRating || 0,
      });
    }
  });

  // 1. Backfill publicProfiles
  console.log('Backfilling publicProfiles collection...');
  let publicProfilesBatchCount = 0;
  let batch = db.batch();
  
  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const uid = userDoc.id;
    if (userData.username) {
      stats.eligible++;
      const publicProfileRef = db.collection('publicProfiles').doc(uid);
      
      const publicProfilePayload = {
        uid: uid,
        username: userData.username,
        photoURL: userData.photoURL || null,
        isPremium: userData.isPremium || false,
        isSupporter: userData.isSupporter || false,
        isCreator: userData.isCreator || false,
        age: userData.age || null,
        location: userData.location || null,
        bio: userData.bio || null,
        interests: userData.interests || [],
        ratingCount: userData.ratingCount || 0,
        averageRating: userData.averageRating || 0,
      };

      // Check if existing profile already matches
      let alreadyMatches = false;
      try {
        const existingProfile = await publicProfileRef.get();
        if (existingProfile.exists) {
          const epData = existingProfile.data();
          if (epData && epData.username === userData.username && epData.photoURL === publicProfilePayload.photoURL) {
            alreadyMatches = true;
          }
        }
      } catch (err) {
        // Safe to ignore, we will set the document
      }

      if (alreadyMatches) {
        stats.unchanged++;
        continue;
      }

      if (!dryRun) {
        try {
          batch.set(publicProfileRef, publicProfilePayload, { merge: true });
          publicProfilesBatchCount++;
          stats.updated++;
          if (publicProfilesBatchCount >= 50) {
            await batch.commit();
            console.log(`Committed batch of 50 publicProfiles.`);
            batch = db.batch();
            publicProfilesBatchCount = 0;
          }
        } catch (err) {
          logFailure(`publicProfiles/${uid}`, err);
        }
      } else {
        stats.wouldUpdate++;
        console.log(`[DRY-RUN] Would create/update publicProfiles doc for user: ${userData.username}`);
      }
    } else {
      stats.skipped++;
    }
  }
  
  if (!dryRun && publicProfilesBatchCount > 0) {
    try {
      await batch.commit();
      console.log(`Committed remaining publicProfiles.`);
    } catch (err) {
      console.error('[ERROR] Error committing publicProfiles remaining batch:', err);
    }
  }

  // 2. Backfill activities
  console.log('Backfilling activities...');
  const activitiesSnap = await db.collection('activities').get();
  console.log(`Found ${activitiesSnap.size} activities.`);
  
  let activityBatchCount = 0;
  batch = db.batch();

  for (const actDoc of activitiesSnap.docs) {
    stats.scanned++;
    const actData = actDoc.data();
    const updates: any = {};
    let needsUpdate = false;
    
    // Backfill hostUsername
    if (actData.hostId) {
      const hostProfile = userMap.get(actData.hostId);
      if (hostProfile) {
        if (!actData.hostUsername) {
          updates.hostUsername = hostProfile.username;
          const hostUsernameFormatted = `@${hostProfile.username.replace(/^@/, '')}`;
          updates.hostName = hostUsernameFormatted;
          needsUpdate = true;
        }
      }
    }
    
    // Backfill participantDetails
    if (actData.participantDetails) {
      for (const uid of Object.keys(actData.participantDetails)) {
        const pProfile = userMap.get(uid);
        if (pProfile) {
          const detail = actData.participantDetails[uid];
          if (!detail.username) {
            updates[`participantDetails.${uid}.username`] = pProfile.username;
            const formatted = `@${pProfile.username.replace(/^@/, '')}`;
            updates[`participantDetails.${uid}.displayName`] = formatted;
            needsUpdate = true;
          }
        }
      }
    }
    
    // Backfill participantsPreview
    if (Array.isArray(actData.participantsPreview)) {
      const newPreview = actData.participantsPreview.map((p: any) => {
        const pProfile = userMap.get(p.uid);
        if (pProfile && !p.username) {
          needsUpdate = true;
          return {
            ...p,
            username: pProfile.username,
            displayName: `@${pProfile.username.replace(/^@/, '')}`
          };
        }
        return p;
      });
      if (needsUpdate) {
        updates.participantsPreview = newPreview;
      }
    }
    
    if (needsUpdate) {
      stats.eligible++;
      if (!dryRun) {
        try {
          batch.update(actDoc.ref, updates);
          activityBatchCount++;
          stats.updated++;
          if (activityBatchCount >= 50) {
            await batch.commit();
            console.log(`Committed batch of 50 activity updates.`);
            batch = db.batch();
            activityBatchCount = 0;
          }
        } catch (err) {
          logFailure(`activities/${actDoc.id}`, err);
        }
      } else {
        stats.wouldUpdate++;
        console.log(`[DRY-RUN] Would update activity: ${actDoc.id}`);
      }
    } else {
      stats.unchanged++;
    }
  }
  
  if (!dryRun && activityBatchCount > 0) {
    try {
      await batch.commit();
      console.log(`Committed remaining activities.`);
    } catch (err) {
      console.error('[ERROR] Error committing activities remaining batch:', err);
    }
  }

  // 3. Backfill chats
  console.log('Backfilling chats...');
  const chatsSnap = await db.collection('chats').get();
  console.log(`Found ${chatsSnap.size} chats.`);
  
  let chatBatchCount = 0;
  batch = db.batch();
  
  for (const chatDoc of chatsSnap.docs) {
    stats.scanned++;
    const chatData = chatDoc.data();
    const updates: any = {};
    let needsUpdate = false;
    
    if (chatData.hostId) {
      const hostProfile = userMap.get(chatData.hostId);
      if (hostProfile && !chatData.hostUsername) {
        updates.hostUsername = hostProfile.username;
        updates.hostName = `@${hostProfile.username.replace(/^@/, '')}`;
        needsUpdate = true;
      }
    }
    
    if (chatData.participantDetails) {
      for (const uid of Object.keys(chatData.participantDetails)) {
        const pProfile = userMap.get(uid);
        if (pProfile) {
          const detail = chatData.participantDetails[uid];
          if (!detail.username) {
            updates[`participantDetails.${uid}.username`] = pProfile.username;
            updates[`participantDetails.${uid}.displayName`] = `@${pProfile.username.replace(/^@/, '')}`;
            needsUpdate = true;
          }
        }
      }
    }
    
    if (needsUpdate) {
      stats.eligible++;
      if (!dryRun) {
        try {
          batch.update(chatDoc.ref, updates);
          chatBatchCount++;
          stats.updated++;
          if (chatBatchCount >= 50) {
            await batch.commit();
            console.log(`Committed batch of 50 chat updates.`);
            batch = db.batch();
            chatBatchCount = 0;
          }
        } catch (err) {
          logFailure(`chats/${chatDoc.id}`, err);
        }
      } else {
        stats.wouldUpdate++;
        console.log(`[DRY-RUN] Would update chat: ${chatDoc.id}`);
      }
    } else {
      stats.unchanged++;
    }
  }
  
  if (!dryRun && chatBatchCount > 0) {
    try {
      await batch.commit();
      console.log(`Committed remaining chats.`);
    } catch (err) {
      console.error('[ERROR] Error committing chats remaining batch:', err);
    }
  }

  // 4. Backfill Join Requests
  console.log('Backfilling joinRequests...');
  try {
    const jrSnap = await db.collectionGroup('joinRequests').get();
    console.log(`Found ${jrSnap.size} join requests.`);
    let jrBatchCount = 0;
    batch = db.batch();
    
    for (const jrDoc of jrSnap.docs) {
      stats.scanned++;
      const jrData = jrDoc.data();
      const senderId = jrData.userId || jrData.senderId;
      if (senderId && !jrData.username) {
        const senderProfile = userMap.get(senderId);
        if (senderProfile) {
          stats.eligible++;
          if (!dryRun) {
            try {
              batch.update(jrDoc.ref, { username: senderProfile.username });
              jrBatchCount++;
              stats.updated++;
              if (jrBatchCount >= 50) {
                await batch.commit();
                batch = db.batch();
                jrBatchCount = 0;
              }
            } catch (err) {
              logFailure(jrDoc.ref.path, err);
            }
          } else {
            stats.wouldUpdate++;
            console.log(`[DRY-RUN] Would update joinRequest: ${jrDoc.ref.path}`);
          }
        }
      } else {
        stats.unchanged++;
      }
    }
    if (!dryRun && jrBatchCount > 0) {
      await batch.commit();
    }
  } catch (err: any) {
    console.warn(`[WARN] Could not backfill collectionGroup joinRequests (possibly rules or empty group):`, err.message || err);
  }

  // 5. Backfill Notifications
  console.log('Backfilling notifications...');
  try {
    const notifSnap = await db.collection('notifications').get();
    console.log(`Found ${notifSnap.size} notifications.`);
    let notifBatchCount = 0;
    batch = db.batch();
    
    for (const notifDoc of notifSnap.docs) {
      stats.scanned++;
      const notifData = notifDoc.data();
      const senderId = notifData.senderId;
      if (senderId && (notifData.type === 'join_request' || notifData.type === 'friend_request')) {
        const senderProfile = userMap.get(senderId);
        if (senderProfile && (!notifData.senderProfile || !notifData.senderProfile.username)) {
          stats.eligible++;
          const newProfile = {
            displayName: `@${senderProfile.username.replace(/^@/, '')}`,
            photoURL: senderProfile.photoURL,
            username: senderProfile.username
          };
          if (!dryRun) {
            try {
              batch.update(notifDoc.ref, { senderProfile: newProfile });
              notifBatchCount++;
              stats.updated++;
              if (notifBatchCount >= 50) {
                await batch.commit();
                batch = db.batch();
                notifBatchCount = 0;
              }
            } catch (err) {
              logFailure(`notifications/${notifDoc.id}`, err);
            }
          } else {
            stats.wouldUpdate++;
            console.log(`[DRY-RUN] Would update notification: ${notifDoc.id}`);
          }
        }
      } else {
        stats.unchanged++;
      }
    }
    if (!dryRun && notifBatchCount > 0) {
      await batch.commit();
    }
  } catch (err: any) {
    console.warn(`[WARN] Could not backfill notifications:`, err.message || err);
  }

  // Print Summary
  console.log('\n==================================================');
  console.log('BACKFILL COMPLETED SUMMARY');
  console.log('==================================================');
  console.log(`scanned:      ${stats.scanned}`);
  console.log(`eligible:     ${stats.eligible}`);
  console.log(`unchanged:    ${stats.unchanged}`);
  console.log(`wouldUpdate:  ${stats.wouldUpdate}`);
  console.log(`updated:      ${stats.updated}`);
  console.log(`skipped:      ${stats.skipped}`);
  console.log(`failed:       ${stats.failed}`);
  console.log('==================================================');

  if (failedPaths.length > 0) {
    console.error('\nList of failed document paths:');
    failedPaths.forEach(p => console.error(`- ${p}`));
    process.exit(1);
  }
}

backfill().catch(err => {
  console.error('[BACKFILL] Error running backfill:', err);
  process.exit(1);
});

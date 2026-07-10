import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

interface SendChatMessageRequest {
  chatId: string;
  text: string;
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  clientMessageId: string;
}

export const sendChatMessage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const { chatId, text, replyToId, replyToText, replyToSenderName, clientMessageId } = request.data as SendChatMessageRequest;

  // Validation
  if (!chatId) {
    throw new HttpsError('invalid-argument', 'chatId is required.');
  }
  if (!text || !text.trim()) {
    throw new HttpsError('invalid-argument', 'text is required and cannot be empty.');
  }
  if (text.length > 2000) {
    throw new HttpsError('invalid-argument', 'text cannot exceed 2000 characters.');
  }
  if (!clientMessageId || !/^[a-zA-Z0-9_-]{10,100}$/.test(clientMessageId)) {
    throw new HttpsError('invalid-argument', 'clientMessageId is missing or has an invalid format.');
  }

  const db = admin.firestore();
  const chatRef = db.collection('chats').doc(chatId);
  const messageRef = chatRef.collection('messages').doc(clientMessageId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Idempotency check: check if message already exists
      const messageSnap = await transaction.get(messageRef);
      if (messageSnap.exists) {
        return { success: true, duplicated: true, messageId: clientMessageId };
      }

      // 2. Fetch Chat document
      const chatSnap = await transaction.get(chatRef);
      if (!chatSnap.exists) {
        throw new HttpsError('not-found', 'Chat does not exist.');
      }
      const chatData = chatSnap.data()!;

      // 3. Verify user participation
      const participantIds = chatData.participantIds || [];
      if (!participantIds.includes(uid)) {
        throw new HttpsError('permission-denied', 'User is not a participant in this chat.');
      }

      // 4. Verify chat is active
      const activityId = chatData.activityId;
      if (activityId) {
        const activityRef = db.collection('activities').doc(activityId);
        const activitySnap = await transaction.get(activityRef);
        if (!activitySnap.exists) {
          throw new HttpsError('not-found', 'Associated activity does not exist.');
        }
        const activityData = activitySnap.data()!;
        const status = activityData.status;
        if (status === 'completed' || status === 'cancelled' || status === 'blacklisted') {
          throw new HttpsError('failed-precondition', 'This chat is archived because the activity has ended or been cancelled.');
        }
      }

      // Fetch user profile for latest badges and name
      const userRef = db.collection('users').doc(uid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
      }
      const userData = userSnap.data()!;

      const senderUsername = userData.username || null;
      const userLanguage = userData.language || 'de';
      const usernameFormatted = senderUsername ? `@${senderUsername.replace(/^@/, '')}` : (userLanguage === 'en' ? 'Aktiva user' : 'Aktiva-Nutzer');
      const senderNameToUse = usernameFormatted;

      // 5. Create Message document
      const messagePayload: any = {
        text: text.trim(),
        senderId: uid,
        senderName: senderNameToUse,
        senderUsername: senderUsername,
        senderPhotoURL: userData.photoURL || null,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        isPremium: userData.isPremium || false,
        isSupporter: userData.isSupporter || false,
        isCreator: userData.isCreator || false,
      };

      if (replyToId) {
        messagePayload.replyToId = replyToId;
        messagePayload.replyToText = replyToText || '';
        messagePayload.replyToSenderName = replyToSenderName || 'User';
        messagePayload.replyToSenderUsername = (request.data as any).replyToSenderUsername || null;
      }

      transaction.set(messageRef, messagePayload);

      // 6. Update Chat document
      const chatUpdates: any = {
        lastMessage: {
          text: text.trim(),
          senderName: senderNameToUse,
          senderUsername: senderUsername,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Increment unreadCount for everyone else
      participantIds.forEach((pid: string) => {
        if (pid !== uid) {
          chatUpdates[`unreadCount.${pid}`] = admin.firestore.FieldValue.increment(1);
        }
      });

      transaction.update(chatRef, chatUpdates);

      return { success: true, duplicated: false, messageId: clientMessageId };
    });

    return result;
  } catch (error: any) {
    console.error('Error in sendChatMessage Cloud Function:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message || 'An internal error occurred.');
  }
});

export const onChatUpdated = onDocumentUpdated({
  document: 'chats/{chatId}',
  retry: true
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return null;

  const beforeParticipants: string[] = before.participantIds || [];
  const afterParticipants: string[] = after.participantIds || [];

  const joinedUsers = afterParticipants.filter(uid => !beforeParticipants.includes(uid));
  const leftUsers = beforeParticipants.filter(uid => !afterParticipants.includes(uid));

  if (joinedUsers.length === 0 && leftUsers.length === 0) {
    return null;
  }

  // Skip direct/DM chats (system messages are only for activities/groups)
  if (after.type === 'direct' || !after.activityId) {
    return null;
  }

  const db = admin.firestore();
  const chatId = event.params.chatId;
  const chatRef = db.collection('chats').doc(chatId);
  const messagesRef = chatRef.collection('messages');

  const batch = db.batch();
  let chatUpdates: any = {};
  let updateNeeded = false;

  // 1. Process joins
  for (const uid of joinedUsers) {
    const details = after.participantDetails?.[uid] || {};
    const username = details.username || null;
    const formattedName = username ? `@${username.replace(/^@/, '')}` : 'Aktiva-Nutzer';
    
    const msgRef = messagesRef.doc();
    batch.set(msgRef, {
      text: `${formattedName} ist beigetreten`,
      senderId: uid,
      senderName: formattedName,
      senderUsername: username,
      senderPhotoURL: "system:join",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      isPremium: details.isPremium || false,
      isSupporter: details.isSupporter || false,
      isCreator: details.isCreator || false
    });

    chatUpdates.lastMessage = {
      text: `${formattedName} ist beigetreten`,
      senderName: 'System',
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    };
    chatUpdates.lastActivityAt = admin.firestore.FieldValue.serverTimestamp();
    updateNeeded = true;
  }

  // 2. Process leaves
  for (const uid of leftUsers) {
    const details = before.participantDetails?.[uid] || {};
    const username = details.username || null;
    const formattedName = username ? `@${username.replace(/^@/, '')}` : 'Aktiva-Nutzer';

    // Determine message text (check if user still exists in activity participants to differentiate leave vs remove)
    let text = `${formattedName} hat die Aktivität verlassen`;
    try {
      const activitySnap = await db.collection('activities').doc(chatId).get();
      if (activitySnap.exists) {
        const activityParticipants = activitySnap.data()?.participantIds || [];
        if (activityParticipants.includes(uid)) {
          text = `${formattedName} hat den Chat verlassen`;
        }
      }
    } catch (err) {
      console.warn("Error checking activity participants in onChatUpdated:", err);
    }

    const msgRef = messagesRef.doc();
    batch.set(msgRef, {
      text,
      senderId: uid,
      senderName: formattedName,
      senderUsername: username,
      senderPhotoURL: "system:leave",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      isPremium: details.isPremium || false,
      isSupporter: details.isSupporter || false,
      isCreator: details.isCreator || false
    });

    chatUpdates.lastMessage = {
      text,
      senderName: 'System',
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    };
    chatUpdates.lastActivityAt = admin.firestore.FieldValue.serverTimestamp();
    updateNeeded = true;
  }

  if (updateNeeded) {
    batch.update(chatRef, chatUpdates);
  }

  await batch.commit();
  return null;
});

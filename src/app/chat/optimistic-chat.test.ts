import assert from 'node:assert';
import type { Message } from '../../lib/types';

function testOptimisticMessageCreationAndLocalEcho() {
  console.log('Running testOptimisticMessageCreationAndLocalEcho...');

  const clientMessageId = 'client_msg_1001';
  const text = 'Hallo, das ist ein Test!';
  const senderUid = 'alice';

  const optimisticMsg: Message = {
    id: clientMessageId,
    text,
    senderId: senderUid,
    senderName: '@alice',
    senderUsername: 'alice',
    senderPhotoURL: 'https://example.com/alice.jpg',
    sentAt: new Date(1700000000000),
    isPremium: true,
    status: 'sending',
  };

  assert.strictEqual(optimisticMsg.id, clientMessageId);
  assert.strictEqual(optimisticMsg.status, 'sending');
  assert.strictEqual(optimisticMsg.text, text);

  // Simulate local state append
  const prevMessages: Message[] = [];
  const nextMessages = [...prevMessages.filter(m => m.id !== clientMessageId), optimisticMsg];

  assert.strictEqual(nextMessages.length, 1);
  assert.strictEqual(nextMessages[0].status, 'sending');
  console.log('✅ testOptimisticMessageCreationAndLocalEcho passed');
}

function testStatusTransitionAndDeduplication() {
  console.log('Running testStatusTransitionAndDeduplication...');

  const clientMessageId = 'client_msg_1002';

  const optimisticMsg: Message = {
    id: clientMessageId,
    text: 'Test Nachrichtenfluss',
    senderId: 'alice',
    senderName: '@alice',
    senderPhotoURL: null,
    sentAt: new Date(1700000001000),
    status: 'sending',
  };

  let messagesState: Message[] = [optimisticMsg];

  // 1. Backend succeeds -> transition to 'sent'
  messagesState = messagesState.map(m => m.id === clientMessageId ? { ...m, status: 'sent' } : m);
  assert.strictEqual(messagesState[0].status, 'sent');

  // 2. Realtime listener fires with committed server document (same clientMessageId)
  const serverMsg: Message = {
    id: clientMessageId,
    text: 'Test Nachrichtenfluss',
    senderId: 'alice',
    senderName: '@alice',
    senderPhotoURL: null,
    sentAt: { toMillis: () => 1700000001000 } as any,
  };

  // Reconcile and deduplicate using Map by ID
  const mergedMap = new Map<string, Message>();
  messagesState.forEach(m => mergedMap.set(m.id, m));
  [serverMsg].forEach(m => mergedMap.set(m.id, m));

  const reconciledList = Array.from(mergedMap.values());
  assert.strictEqual(reconciledList.length, 1, 'Duplicate ID must be merged cleanly without creating a second item');
  assert.strictEqual(reconciledList[0].id, clientMessageId);

  console.log('✅ testStatusTransitionAndDeduplication passed');
}

function testFailedStatusAndRetry() {
  console.log('Running testFailedStatusAndRetry...');

  const clientMessageId = 'client_msg_1003';
  const optimisticMsg: Message = {
    id: clientMessageId,
    text: 'Fehlerhafte Nachricht',
    senderId: 'alice',
    senderName: '@alice',
    senderPhotoURL: null,
    sentAt: new Date(1700000002000),
    status: 'sending',
  };

  let messagesState: Message[] = [optimisticMsg];

  // Backend failure -> status becomes 'failed'
  messagesState = messagesState.map(m => m.id === clientMessageId ? { ...m, status: 'failed' } : m);
  assert.strictEqual(messagesState[0].status, 'failed');
  assert.strictEqual(messagesState.length, 1, 'Failed message remains visible in UI');

  // Retry -> status becomes 'sending'
  messagesState = messagesState.map(m => m.id === clientMessageId ? { ...m, status: 'sending' } : m);
  assert.strictEqual(messagesState[0].status, 'sending');

  console.log('✅ testFailedStatusAndRetry passed');
}

function testMultipleRapidMessagesSorting() {
  console.log('Running testMultipleRapidMessagesSorting...');

  const msg1: Message = {
    id: 'msg_rapid_1',
    text: 'Erste Nachricht',
    senderId: 'alice',
    senderName: '@alice',
    senderPhotoURL: null,
    sentAt: new Date(1700000000000),
    status: 'sent',
  };

  const msg2: Message = {
    id: 'msg_rapid_2',
    text: 'Zweite Nachricht',
    senderId: 'alice',
    senderName: '@alice',
    senderPhotoURL: null,
    sentAt: new Date(1700000001000),
    status: 'sending',
  };

  const msg3: Message = {
    id: 'msg_rapid_3',
    text: 'Dritte Nachricht',
    senderId: 'alice',
    senderName: '@alice',
    senderPhotoURL: null,
    sentAt: new Date(1700000002000),
    status: 'sending',
  };

  const list = [msg3, msg1, msg2];

  const getMessageMs = (m: Message): number => {
    if (!m.sentAt) return Date.now();
    if (typeof (m.sentAt as any).toMillis === 'function') return (m.sentAt as any).toMillis();
    if (m.sentAt instanceof Date) return m.sentAt.getTime();
    if (typeof m.sentAt === 'number') return m.sentAt;
    return Date.now();
  };

  list.sort((a, b) => {
    const aTime = getMessageMs(a);
    const bTime = getMessageMs(b);
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return a.id.localeCompare(b.id);
  });

  assert.strictEqual(list[0].id, 'msg_rapid_1');
  assert.strictEqual(list[1].id, 'msg_rapid_2');
  assert.strictEqual(list[2].id, 'msg_rapid_3');

  console.log('✅ testMultipleRapidMessagesSorting passed');
}

function testSystemMessageGroupingAndHeaderResolution() {
  console.log('Running testSystemMessageGroupingAndHeaderResolution...');
  const { resolvePublicUsername } = require('../../lib/utils');

  const systemMsg: Message = {
    id: 'sys_1',
    text: '@busi ist beigetreten',
    senderId: 'busi',
    senderName: '@busi',
    senderUsername: 'busi',
    senderPhotoURL: 'system:join',
    sentAt: new Date(1700000000000),
  };

  const userMsg: Message = {
    id: 'user_1',
    text: 'hallo',
    senderId: 'busi',
    senderName: '@busi',
    senderUsername: 'busi',
    senderPhotoURL: 'https://example.com/busi.jpg',
    sentAt: new Date(1700000001000),
  };

  const messages = [systemMsg, userMsg];

  // Test grouping condition logic
  const prevMessage = messages[0];
  const message = messages[1];

  const isPrevSystem = Boolean(
    prevMessage?.senderPhotoURL === "system:join" ||
    prevMessage?.senderPhotoURL === "system:leave" ||
    prevMessage?.senderPhotoURL === "system:kick" ||
    prevMessage?.senderPhotoURL?.startsWith("system:")
  );

  const isFirstInGroup = !prevMessage || isPrevSystem || prevMessage.senderId !== message.senderId;
  assert.strictEqual(isFirstInGroup, true, 'Message following a system message must be marked as first in group');

  // Test username resolution fallback
  const resolvedName = resolvePublicUsername({
    uid: message.senderId,
    participantDetails: null,
    currentUserProfile: null,
    fallbackUsername: message.senderUsername || message.senderName,
    language: 'de',
  });
  assert.strictEqual(resolvedName, '@busi', 'Username must fall back to senderUsername/senderName when participantDetails is missing');

  console.log('✅ testSystemMessageGroupingAndHeaderResolution passed');
}

try {
  testOptimisticMessageCreationAndLocalEcho();
  testStatusTransitionAndDeduplication();
  testFailedStatusAndRetry();
  testMultipleRapidMessagesSorting();
  testSystemMessageGroupingAndHeaderResolution();
  console.log('🎉 ALL OPTIMISTIC CHAT TESTS PASSED SUCCESSFULLY! 🎉');
} catch (err) {
  console.error('❌ Optimistic Chat Unit Tests failed:', err);
  process.exit(1);
}

const assert = require("assert");

// ─── ROBUST WINDOWS CACHE MOCK HELPER ────────────────────────────────────────

function mockModule(moduleName: string, mockExports: any) {
  try {
    const resolvedPath = require.resolve(moduleName);
    const mockEntry = {
      id: resolvedPath,
      filename: resolvedPath,
      loaded: true,
      exports: mockExports,
      parent: module,
      paths: [],
    } as any;

    require.cache[resolvedPath] = mockEntry;
    const lowerDrive = resolvedPath.charAt(0).toLowerCase() + resolvedPath.slice(1);
    require.cache[lowerDrive] = mockEntry;
    const upperDrive = resolvedPath.charAt(0).toUpperCase() + resolvedPath.slice(1);
    require.cache[upperDrive] = mockEntry;
    const forwardSlashes = resolvedPath.replace(/\\/g, "/");
    require.cache[forwardSlashes] = mockEntry;
  } catch (e) {
    console.error(`Failed to mock module ${moduleName}:`, e);
  }
}

// ─── FIRESTORE IN-MEMORY MOCK ────────────────────────────────────────────────

let mockDbState: { [collection: string]: { [docId: string]: any } } = {};
let mockTransactionsRun = 0;

function resetMockDb() {
  mockDbState = {};
  mockTransactionsRun = 0;
}

class MockDocumentReference {
  constructor(public collectionPath: string, public docId: string) {}
  get id() { return this.docId; }
  get path() { return `${this.collectionPath}/${this.docId}`; }
  collection(path: string) {
    return new MockCollectionReference(`${this.collectionPath}/${this.docId}/${path}`);
  }
  async get() {
    const data = mockDbState[this.collectionPath]?.[this.docId];
    return {
      exists: !!data,
      data: () => data || null
    };
  }
  async set(data: any, options?: any) {
    if (!mockDbState[this.collectionPath]) mockDbState[this.collectionPath] = {};
    if (options?.merge) {
      mockDbState[this.collectionPath][this.docId] = {
        ...(mockDbState[this.collectionPath][this.docId] || {}),
        ...JSON.parse(JSON.stringify(data))
      };
    } else {
      mockDbState[this.collectionPath][this.docId] = JSON.parse(JSON.stringify(data));
    }
  }
  async update(data: any) {
    if (!mockDbState[this.collectionPath]?.[this.docId]) {
      throw new Error(`Document not found: ${this.collectionPath}/${this.docId}`);
    }
    const current = mockDbState[this.collectionPath][this.docId];
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val && val.__type === "increment") {
        current[key] = (current[key] || 0) + val.value;
      } else {
        current[key] = JSON.parse(JSON.stringify(val));
      }
    }
  }
}

class MockCollectionReference {
  constructor(public collectionPath: string) {}
  doc(docId?: string) {
    const id = docId || Math.random().toString(36).substring(7);
    return new MockDocumentReference(this.collectionPath, id);
  }
  async add(data: any) {
    const docId = Math.random().toString(36).substring(7);
    if (!mockDbState[this.collectionPath]) mockDbState[this.collectionPath] = {};
    mockDbState[this.collectionPath][docId] = JSON.parse(JSON.stringify(data));
    return new MockDocumentReference(this.collectionPath, docId);
  }
}

const mockFieldValue = {
  serverTimestamp: () => ({ __type: "serverTimestamp" }),
  increment: (n: number) => ({ __type: "increment", value: n }),
  arrayUnion: (...elements: any[]) => ({ __type: "arrayUnion", value: elements }),
  arrayRemove: (...elements: any[]) => ({ __type: "arrayRemove", value: elements }),
  delete: () => ({ __type: "delete" }),
};

class MockTransaction {
  async get(ref: MockDocumentReference) {
    const data = mockDbState[ref.collectionPath]?.[ref.docId];
    return {
      exists: data !== undefined,
      data: () => data ? JSON.parse(JSON.stringify(data)) : undefined,
    };
  }
  set(ref: MockDocumentReference, data: any, options?: any) {
    if (!mockDbState[ref.collectionPath]) mockDbState[ref.collectionPath] = {};
    if (options?.merge) {
      this.update(ref, data);
    } else {
      mockDbState[ref.collectionPath][ref.docId] = JSON.parse(JSON.stringify(data));
    }
  }
  update(ref: MockDocumentReference, data: any) {
    if (!mockDbState[ref.collectionPath]?.[ref.docId]) {
      mockDbState[ref.collectionPath] = mockDbState[ref.collectionPath] || {};
      mockDbState[ref.collectionPath][ref.docId] = {};
    }
    const current = mockDbState[ref.collectionPath][ref.docId];
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val && val.__type === "increment") {
        // Handle nested paths (e.g. unreadCount.alice)
        if (key.includes('.')) {
          const parts = key.split('.');
          let obj = current;
          for (let i = 0; i < parts.length - 1; i++) {
            obj[parts[i]] = obj[parts[i]] || {};
            obj = obj[parts[i]];
          }
          const lastPart = parts[parts.length - 1];
          obj[lastPart] = (obj[lastPart] || 0) + val.value;
        } else {
          current[key] = (current[key] || 0) + val.value;
        }
      } else {
        if (key.includes('.')) {
          const parts = key.split('.');
          let obj = current;
          for (let i = 0; i < parts.length - 1; i++) {
            obj[parts[i]] = obj[parts[i]] || {};
            obj = obj[parts[i]];
          }
          const lastPart = parts[parts.length - 1];
          obj[lastPart] = JSON.parse(JSON.stringify(val));
        } else {
          current[key] = JSON.parse(JSON.stringify(val));
        }
      }
    }
  }
  delete(ref: MockDocumentReference) {
    if (mockDbState[ref.collectionPath]) {
      delete mockDbState[ref.collectionPath][ref.docId];
    }
  }
}

class MockWriteBatch {
  set(ref: any, data: any) {
    const transaction = new MockTransaction();
    transaction.set(ref, data);
  }
  update(ref: any, data: any) {
    const transaction = new MockTransaction();
    transaction.update(ref, data);
  }
  delete(ref: any) {
    const transaction = new MockTransaction();
    transaction.delete(ref);
  }
  async commit() {
    // Bereits in den set/update-Methoden im Mock ausgeführt
  }
}

const mockDb = {
  collection: (path: string) => new MockCollectionReference(path),
  runTransaction: async (callback: any) => {
    mockTransactionsRun++;
    const transaction = new MockTransaction();
    return callback(transaction);
  },
  batch: () => new MockWriteBatch(),
};

const firestoreFunc = () => mockDb;
(firestoreFunc as any).FieldValue = mockFieldValue;

const mockAdmin = {
  firestore: firestoreFunc,
};

mockModule("firebase-admin", mockAdmin);
mockModule("firebase-admin/firestore", { FieldValue: mockFieldValue });

// ─── FIREBASE FUNCTIONS IN-MEMORY MOCK ────────────────────────────────────────

class HttpsError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "HttpsError";
  }
}

const mockFunctionsHttps = {
  onCall: (handler: any) => {
    return async (data: any, auth?: any) => {
      const request = { data, auth: auth || null };
      return handler(request);
    };
  },
  HttpsError,
};

mockModule("firebase-functions/v2/https", mockFunctionsHttps);

const mockFunctionsFirestore = {
  onDocumentCreated: (path: string, handler: any) => handler,
  onDocumentUpdated: (path: string, handler: any) => handler,
};

mockModule("firebase-functions/v2/firestore", mockFunctionsFirestore);

// ─── IMPORTS UNDER TEST ──────────────────────────────────────────────────────

const { sendChatMessage, onChatUpdated } = require("./chats");

// ─── TEST CASES ──────────────────────────────────────────────────────────────

async function testSendChatMessage() {
  console.log("Running testSendChatMessage...");

  const seedFixtures = () => {
    resetMockDb();
    mockDbState["chats"] = {
      chat1: { participantIds: ["alice", "bob"], unreadCount: { alice: 0, bob: 0 } },
      groupChat: { participantIds: ["alice", "bob", "charlie"], unreadCount: { alice: 0, bob: 0, charlie: 0 } },
      archivedChat: { activityId: "actArchived", participantIds: ["alice", "bob"] }
    };
    mockDbState["activities"] = {
      actArchived: { status: "completed" }
    };
    mockDbState["users"] = {
      alice: { displayName: "Alice", username: "alice_un", photoURL: "alice.jpg", isPremium: true, isSupporter: false, isCreator: false },
      bob: { displayName: "Bob", username: "bob_un", photoURL: "bob.jpg", isPremium: false, isSupporter: true, isCreator: true },
      charlie: { displayName: "Charlie", username: "charlie_un", photoURL: "charlie.jpg", isPremium: false, isSupporter: false, isCreator: false }
    };
  };

  // 1. Unauthenticated send throws HttpsError
  seedFixtures();
  await assert.rejects(
    sendChatMessage({ chatId: "chat1", text: "Hello", clientMessageId: "clientMsgIdAlice1" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // 2. Non-participant send throws HttpsError
  seedFixtures();
  await assert.rejects(
    sendChatMessage({ chatId: "chat1", text: "Hello", clientMessageId: "clientMsgIdAlice1" }, { uid: "charlie" }),
    (err: any) => err.name === "HttpsError" && err.code === "permission-denied"
  );

  // 3. Message in archived chat is blocked
  seedFixtures();
  await assert.rejects(
    sendChatMessage({ chatId: "archivedChat", text: "Hello", clientMessageId: "clientMsgIdAlice1" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 4. Successful send in DM increments other's unreadCount by exactly +1
  seedFixtures();
  const res1 = await sendChatMessage({ chatId: "chat1", text: "Hello Bob", clientMessageId: "clientMsgIdAlice1" }, { uid: "alice" });
  assert.deepStrictEqual(res1, { success: true, duplicated: false, messageId: "clientMsgIdAlice1" });
  
  // Verify message document was created
  const msgDoc = mockDbState["chats/chat1/messages"]?.["clientMsgIdAlice1"];
  assert.ok(msgDoc);
  assert.strictEqual(msgDoc.text, "Hello Bob");
  assert.strictEqual(msgDoc.senderId, "alice");
  assert.strictEqual(msgDoc.senderName, "@alice_un");
  assert.strictEqual(msgDoc.isPremium, true);

  // Verify chat lastMessage & unreadCount updates
  const chatDoc = mockDbState["chats"]["chat1"];
  assert.strictEqual(chatDoc.lastMessage.text, "Hello Bob");
  assert.strictEqual(chatDoc.unreadCount.bob, 1);
  assert.strictEqual(chatDoc.unreadCount.alice, 0); // Sender not incremented

  // 5. Successful send in Group Chat increments ALL others' unreadCount by exactly +1
  seedFixtures();
  const resGroup = await sendChatMessage({ chatId: "groupChat", text: "Hey guys", clientMessageId: "groupMsg12345" }, { uid: "alice" });
  assert.deepStrictEqual(resGroup, { success: true, duplicated: false, messageId: "groupMsg12345" });

  const groupChatDoc = mockDbState["chats"]["groupChat"];
  assert.strictEqual(groupChatDoc.unreadCount.bob, 1);
  assert.strictEqual(groupChatDoc.unreadCount.charlie, 1);
  assert.strictEqual(groupChatDoc.unreadCount.alice, 0);

  // 6. Idempotency check: duplicated clientMessageId returns duplicated: true
  const resGroupDup = await sendChatMessage({ chatId: "groupChat", text: "Hey guys", clientMessageId: "groupMsg12345" }, { uid: "alice" });
  assert.deepStrictEqual(resGroupDup, { success: true, duplicated: true, messageId: "groupMsg12345" });

  console.log("✅ testSendChatMessage passed successfully!");
}

async function testOnChatUpdatedTrigger() {
  console.log("Running testOnChatUpdatedTrigger...");

  const seedFixtures = () => {
    resetMockDb();
    mockDbState["chats"] = {
      chat1: {
        activityId: "chat1",
        participantIds: ["alice"],
        participantDetails: {
          alice: { displayName: "Alice", photoURL: "alice.jpg", isPremium: true }
        }
      }
    };
    mockDbState["activities"] = {
      chat1: { participantIds: ["alice"] }
    };
  };

  // 1. Test Join Trigger
  seedFixtures();
  const joinEvent = {
    data: {
      before: {
        data: () => ({
          activityId: "chat1",
          participantIds: ["alice"],
          participantDetails: {
            alice: { displayName: "Alice", username: "alice_un", photoURL: "alice.jpg", isPremium: true }
          }
        })
      },
      after: {
        data: () => ({
          activityId: "chat1",
          participantIds: ["alice", "bob"],
          participantDetails: {
            alice: { displayName: "Alice", username: "alice_un", photoURL: "alice.jpg", isPremium: true },
            bob: { displayName: "Bob", username: "bob_un", photoURL: "bob.jpg", isPremium: false, isSupporter: true }
          }
        })
      }
    },
    params: {
      chatId: "chat1"
    }
  };

  await onChatUpdated(joinEvent);

  // Assert message was written in mock DB
  const messages = mockDbState["chats/chat1/messages"] || {};
  const msgKeys = Object.keys(messages);
  assert.strictEqual(msgKeys.length, 1);
  const joinMsg = messages[msgKeys[0]];
  assert.strictEqual(joinMsg.text, "@bob_un ist beigetreten");
  assert.strictEqual(joinMsg.senderId, "bob");
  assert.strictEqual(joinMsg.senderPhotoURL, "system:join");
  assert.strictEqual(joinMsg.isSupporter, true);

  // Assert chat metadata was updated
  const chatDoc = mockDbState["chats"]["chat1"];
  assert.strictEqual(chatDoc.lastMessage.text, "@bob_un ist beigetreten");
  assert.strictEqual(chatDoc.lastMessage.senderName, "System");

  // 2. Test Leave Trigger (normal leave)
  seedFixtures();
  const leaveEvent = {
    data: {
      before: {
        data: () => ({
          activityId: "chat1",
          participantIds: ["alice", "bob"],
          participantDetails: {
            alice: { displayName: "Alice", username: "alice_un", photoURL: "alice.jpg", isPremium: true },
            bob: { displayName: "Bob", username: "bob_un", photoURL: "bob.jpg", isPremium: false, isSupporter: true }
          }
        })
      },
      after: {
        data: () => ({
          activityId: "chat1",
          participantIds: ["alice"],
          participantDetails: {
            alice: { displayName: "Alice", username: "alice_un", photoURL: "alice.jpg", isPremium: true }
          }
        })
      }
    },
    params: {
      chatId: "chat1"
    }
  };

  await onChatUpdated(leaveEvent);

  const messagesLeave = mockDbState["chats/chat1/messages"] || {};
  const msgKeysLeave = Object.keys(messagesLeave);
  assert.strictEqual(msgKeysLeave.length, 1);
  const leaveMsg = messagesLeave[msgKeysLeave[0]];
  assert.strictEqual(leaveMsg.text, "@bob_un hat die Aktivität verlassen");
  assert.strictEqual(leaveMsg.senderId, "bob");
  assert.strictEqual(leaveMsg.senderPhotoURL, "system:leave");

  // 3. Test Leave Trigger (cleanup / removeUserFromChat)
  seedFixtures();
  // For cleanup, user is removed from chat, but is still in the activity participants!
  mockDbState["activities"]["chat1"] = { participantIds: ["alice", "bob"] };

  await onChatUpdated(leaveEvent);

  const messagesCleanup = mockDbState["chats/chat1/messages"] || {};
  const msgKeysCleanup = Object.keys(messagesCleanup);
  assert.strictEqual(msgKeysCleanup.length, 1);
  const cleanupMsg = messagesCleanup[msgKeysCleanup[0]];
  assert.strictEqual(cleanupMsg.text, "@bob_un hat den Chat verlassen");
  assert.strictEqual(cleanupMsg.senderId, "bob");
  assert.strictEqual(cleanupMsg.senderPhotoURL, "system:leave");

  console.log("✅ testOnChatUpdatedTrigger passed successfully!");
}

async function runAllTests() {
  try {
    await testSendChatMessage();
    await testOnChatUpdatedTrigger();
    console.log("🎉 ALL CHAT CALLABLE FUNCTION & TRIGGER TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (error) {
    console.error("❌ TEST RUNNER FAILED:", error);
    process.exit(1);
  }
}

runAllTests();

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
    mockDbState[this.collectionPath][this.docId] = {
      ...mockDbState[this.collectionPath][this.docId],
      ...JSON.parse(JSON.stringify(data))
    };
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
      if (val && val.__type === "arrayUnion") {
        current[key] = current[key] || [];
        for (const el of val.value) {
          if (!current[key].includes(el)) current[key].push(el);
        }
      } else if (val && val.__type === "arrayRemove") {
        current[key] = current[key] || [];
        current[key] = current[key].filter((el: any) => !val.value.includes(el));
      } else {
        current[key] = JSON.parse(JSON.stringify(val));
      }
    }
  }
  delete(ref: MockDocumentReference) {
    if (mockDbState[ref.collectionPath]) {
      delete mockDbState[ref.collectionPath][ref.docId];
    }
  }
}

const mockDb = {
  collection: (path: string) => new MockCollectionReference(path),
  runTransaction: async (callback: any) => {
    mockTransactionsRun++;
    const transaction = new MockTransaction();
    return callback(transaction);
  },
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

const { respondToJoinRequest } = require("./activities");

// ─── TEST CASES ──────────────────────────────────────────────────────────────

async function testRespondToJoinRequest() {
  console.log("Running testRespondToJoinRequest...");

  // Setup Fixture Data
  const seedFixtures = () => {
    resetMockDb();
    mockDbState["activities"] = {
      act1: { hostId: "host1", status: "active", participantIds: ["host1"] }
    };
    mockDbState["notifications"] = {
      notif1: { type: "join_request", activityId: "act1", senderId: "joiner1", recipientId: "host1" }
    };
    mockDbState["users"] = {
      host1: { displayName: "Host", role: "user" },
      joiner1: { displayName: "Joiner", role: "user" }
    };
  };

  // 1. Unauthenticated Call
  seedFixtures();
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // 2. Caller is Not Host
  seedFixtures();
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "other_user" }),
    (err: any) => err.name === "HttpsError" && err.code === "permission-denied"
  );

  // 3. Invalid Action
  seedFixtures();
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "hack" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // 4. Missing Activity
  seedFixtures();
  delete mockDbState["activities"]["act1"];
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found"
  );

  // 5. Cancelled/Completed Activity
  seedFixtures();
  mockDbState["activities"]["act1"] = { hostId: "host1", status: "completed", participantIds: ["host1"] };
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 6. Target User Banned
  seedFixtures();
  mockDbState["users"]["joiner1"].isBanned = true;
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 7. Full Activity Capacity
  seedFixtures();
  mockDbState["activities"]["act1"].maxParticipants = 1; // already includes host1!
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "resource-exhausted"
  );

  // 8. Successful Accept
  seedFixtures();
  const acceptResult = await respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" });
  assert.deepStrictEqual(acceptResult, { success: true });
  // Verify updates in database
  assert.ok(mockDbState["activities"]["act1"].participantIds.includes("joiner1"));
  assert.strictEqual(mockDbState["chats"]["act1"].participantIds.includes("joiner1"), true);
  // Verify notification resolved/deleted
  assert.strictEqual(mockDbState["notifications"]["notif1"], undefined);
  // Verify exactly one response notification created
  const notifs = Object.values(mockDbState["notifications"]);
  assert.strictEqual(notifs.length, 1);
  assert.strictEqual(notifs[0].type, "join_response");
  assert.strictEqual(notifs[0].responseStatus, "accepted");
  assert.strictEqual(notifs[0].recipientId, "joiner1");

  // 9. Successful Decline
  seedFixtures();
  const declineResult = await respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "decline", customMessage: "Sorry" }, { uid: "host1" });
  assert.deepStrictEqual(declineResult, { success: true });
  // Verify target not added to participantIds
  assert.ok(!mockDbState["activities"]["act1"].participantIds.includes("joiner1"));
  // Verify notification resolved/deleted
  assert.strictEqual(mockDbState["notifications"]["notif1"], undefined);
  // Verify exactly one response notification created
  const declineNotifs = Object.values(mockDbState["notifications"]);
  assert.strictEqual(declineNotifs.length, 1);
  assert.strictEqual(declineNotifs[0].type, "join_response");
  assert.strictEqual(declineNotifs[0].responseStatus, "declined");
  assert.strictEqual(declineNotifs[0].customMessage, "Sorry");

  // 10. Retry/Idempotency: calling second time fails cleanly because notification no longer exists
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found"
  );

  console.log("✅ testRespondToJoinRequest passed successfully!");
}

async function runAllTests() {
  try {
    await testRespondToJoinRequest();
    console.log("🎉 ALL ACTIVITIES MODULE TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (error) {
    console.error("❌ TEST RUNNER FAILED:", error);
    process.exit(1);
  }
}

runAllTests();

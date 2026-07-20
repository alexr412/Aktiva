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
  async get() {
    const data = mockDbState[this.collectionPath]?.[this.docId];
    return {
      id: this.docId,
      ref: this,
      exists: data !== undefined,
      data: () => data ? JSON.parse(JSON.stringify(data)) : undefined,
    };
  }
}

class MockQuery {
  private limitCount: number = -1;
  constructor(public collectionPath: string, public conditions: [string, string, any][]) {}

  where(field: string, op: string, value: any) {
    this.conditions.push([field, op, value]);
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  async get() {
    const collectionData = mockDbState[this.collectionPath] || {};
    let docs = Object.keys(collectionData).map(docId => {
      const data = collectionData[docId];
      const ref = new MockDocumentReference(this.collectionPath, docId);
      return {
        id: docId,
        ref,
        data: () => JSON.parse(JSON.stringify(data)),
      };
    });

    // Filter based on conditions
    for (const [field, op, value] of this.conditions) {
      docs = docs.filter(doc => {
        const data = doc.data();
        const fieldValue = data[field];
        if (op === "==") {
          return fieldValue === value;
        }
        if (op === "array-contains") {
          return Array.isArray(fieldValue) && fieldValue.includes(value);
        }
        return true;
      });
    }

    if (this.limitCount >= 0) {
      docs = docs.slice(0, this.limitCount);
    }

    return {
      empty: docs.length === 0,
      docs,
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
  where(field: string, op: string, value: any) {
    return new MockQuery(this.collectionPath, [[field, op, value]]);
  }
  limit(n: number) {
    return new MockQuery(this.collectionPath, []).limit(n);
  }
  async get() {
    return new MockQuery(this.collectionPath, []).get();
  }
}

const mockFieldValue = {
  serverTimestamp: () => ({ __type: "serverTimestamp" }),
  increment: (n: number) => ({ __type: "increment", value: n }),
  arrayUnion: (...elements: any[]) => ({ __type: "arrayUnion", value: elements }),
  arrayRemove: (...elements: any[]) => ({ __type: "arrayRemove", value: elements }),
  delete: () => ({ __type: "delete" }),
};

class MockBatch {
  private operations: (() => void)[] = [];

  update(ref: MockDocumentReference, data: any) {
    this.operations.push(() => {
      const doc = mockDbState[ref.collectionPath]?.[ref.docId];
      if (!doc) return;
      
      const updatedDoc = { ...doc };
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (key.includes('.')) {
          const parts = key.split('.');
          let current = updatedDoc;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
          }
          const lastPart = parts[parts.length - 1];
          if (value && value.__type === "delete") {
            delete current[lastPart];
          } else {
            current[lastPart] = value;
          }
        } else {
          if (value && value.__type === "arrayRemove") {
            const arr = Array.isArray(updatedDoc[key]) ? updatedDoc[key] : [];
            updatedDoc[key] = arr.filter((x: any) => !value.value.includes(x));
          } else if (value && value.__type === "delete") {
            delete updatedDoc[key];
          } else {
            updatedDoc[key] = value;
          }
        }
      });
      mockDbState[ref.collectionPath][ref.docId] = JSON.parse(JSON.stringify(updatedDoc));
    });
  }

  delete(ref: MockDocumentReference) {
    this.operations.push(() => {
      if (mockDbState[ref.collectionPath]) {
        delete mockDbState[ref.collectionPath][ref.docId];
      }
    });
  }

  async commit() {
    for (const op of this.operations) {
      op();
    }
    this.operations = [];
  }
}

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
      mockDbState[ref.collectionPath][ref.docId] = {
        ...(mockDbState[ref.collectionPath][ref.docId] || {}),
        ...JSON.parse(JSON.stringify(data))
      };
    } else {
      mockDbState[ref.collectionPath][ref.docId] = JSON.parse(JSON.stringify(data));
    }
  }
  update(ref: MockDocumentReference, data: any) {
    const doc = mockDbState[ref.collectionPath]?.[ref.docId];
    if (!doc) {
      throw new Error(`Document not found for update: ${ref.collectionPath}/${ref.docId}`);
    }
    const updatedDoc = { ...doc };
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = updatedDoc;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
        const lastPart = parts[parts.length - 1];
        if (value && value.__type === "delete") {
          delete current[lastPart];
        } else if (value && value.__type === "arrayUnion") {
          const arr = Array.isArray(current[lastPart]) ? current[lastPart] : [];
          const newArr = [...arr];
          value.value.forEach((x: any) => {
            if (!newArr.includes(x)) newArr.push(x);
          });
          current[lastPart] = newArr;
        } else if (value && value.__type === "arrayRemove") {
          const arr = Array.isArray(current[lastPart]) ? current[lastPart] : [];
          current[lastPart] = arr.filter((x: any) => !value.value.includes(x));
        } else {
          current[lastPart] = value;
        }
      } else {
        if (value && value.__type === "arrayUnion") {
          const arr = Array.isArray(updatedDoc[key]) ? updatedDoc[key] : [];
          const newArr = [...arr];
          value.value.forEach((x: any) => {
            if (!newArr.includes(x)) newArr.push(x);
          });
          updatedDoc[key] = newArr;
        } else if (value && value.__type === "arrayRemove") {
          const arr = Array.isArray(updatedDoc[key]) ? updatedDoc[key] : [];
          updatedDoc[key] = arr.filter((x: any) => !value.value.includes(x));
        } else if (value && value.__type === "delete") {
          delete updatedDoc[key];
        } else {
          updatedDoc[key] = value;
        }
      }
    });
    mockDbState[ref.collectionPath][ref.docId] = JSON.parse(JSON.stringify(updatedDoc));
  }
  delete(ref: MockDocumentReference) {
    if (mockDbState[ref.collectionPath]) {
      delete mockDbState[ref.collectionPath][ref.docId];
    }
  }
}

const mockDb = {
  collection: (path: string) => new MockCollectionReference(path),
  collectionGroup: (path: string) => new MockCollectionReference(path),
  batch: () => new MockBatch(),
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
  auth: () => ({
    getUser: async (uid: string) => ({ uid, metadata: {} }),
  }),
  storage: () => ({
    bucket: () => ({
      deleteFiles: async (options: any) => {
        console.log(`Mock storage: deleteFiles with prefix ${options.prefix}`);
      }
    })
  })
};

const mockTimestamp = {
  fromDate: (d: Date) => ({
    toMillis: () => d.getTime(),
    toDate: () => d,
  })
};

mockModule("firebase-admin", mockAdmin);
mockModule("firebase-admin/firestore", { FieldValue: mockFieldValue, Timestamp: mockTimestamp });

// ─── FIREBASE FUNCTIONS IN-MEMORY MOCK ────────────────────────────────────────

class HttpsError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "HttpsError";
  }
}

const mockFunctionsHttps = {
  onCall: (handler: any) => {
    return async (reqOrData: any, auth?: any) => {
      if (reqOrData && typeof reqOrData === 'object' && ('data' in reqOrData || 'auth' in reqOrData)) {
        return handler({ data: reqOrData.data, auth: reqOrData.auth || null });
      }
      return handler({ data: reqOrData, auth: auth || null });
    };
  },
  HttpsError: HttpsError,
};

mockModule("firebase-functions/v2/https", mockFunctionsHttps);

const mockFunctionsFirestore = {
  onDocumentCreated: (path: string, handler: any) => handler,
  onDocumentUpdated: (path: string, handler: any) => handler,
};

mockModule("firebase-functions/v2/firestore", mockFunctionsFirestore);

const mockFunctionsV1 = {
  config: () => ({}),
  https: {
    onCall: (handler: any) => handler,
    HttpsError: HttpsError,
  },
  auth: {
    user: () => ({
      onCreate: (handler: any) => handler,
      onDelete: (handler: any) => handler,
    }),
  },
};
mockModule("firebase-functions/v1", mockFunctionsV1);

// ─── IMPORTS UNDER TEST ──────────────────────────────────────────────────────

const { applyReferralCode, onUserCreated, getOrganizerAnalytics } = require("./users");

// ─── TEST CASES ──────────────────────────────────────────────────────────────

async function testLaunchCampaign2026() {
  console.log("Running testLaunchCampaign2026...");

  // 1. User created inside launch campaign window (e.g. 2026-08-15)
  resetMockDb();
  const validUser = {
    uid: "camp_user_1",
    email: "camp1@aktiva.app",
    metadata: {
      creationTime: "2026-08-15T12:00:00.000Z"
    }
  };

  await onUserCreated(validUser);
  const grantedDoc = mockDbState["users"]?.["camp_user_1"];
  assert.strictEqual(grantedDoc?.isPremium, true, "User should receive campaign premium");
  assert.strictEqual(grantedDoc?.premiumCampaignId, "launch_2026");
  assert.strictEqual(grantedDoc?.premiumSource, "launch_campaign_2026");

  // Check idempotency - re-executing must not change or extend dates
  const originalExpiry = grantedDoc.premiumExpiresAt;
  await onUserCreated(validUser);
  assert.strictEqual(mockDbState["users"]["camp_user_1"].premiumExpiresAt, originalExpiry);

  // 2. User created BEFORE campaign window (e.g. 2026-06-01)
  resetMockDb();
  const earlyUser = {
    uid: "early_user",
    email: "early@aktiva.app",
    metadata: {
      creationTime: "2026-06-01T12:00:00.000Z"
    }
  };
  await onUserCreated(earlyUser);
  assert.strictEqual(mockDbState["users"]?.["early_user"]?.isPremium, undefined, "Early user should NOT receive premium");

  // 3. User created WITHOUT creationTime metadata -> no fallback to new Date()
  resetMockDb();
  const noMetaUser = {
    uid: "no_meta_user",
    email: "nometa@aktiva.app",
    metadata: {}
  };
  await onUserCreated(noMetaUser);
  assert.strictEqual(mockDbState["users"]?.["no_meta_user"]?.isPremium, undefined, "Missing creationTime user should NOT receive premium");

  console.log("✅ testLaunchCampaign2026 passed successfully!");
}

async function testGetOrganizerAnalytics() {
  console.log("Running testGetOrganizerAnalytics...");
  resetMockDb();

  // Seed user, place, and telemetry events
  mockDbState["users"] = {
    "host_1": { uid: "host_1", isOrganizer: true },
    "other_user": { uid: "other_user" },
  };

  mockDbState["places"] = {
    "place_100": { id: "place_100", hostId: "host_1", title: "My Beach Volleyball Court" },
  };

  mockDbState["telemetry_events"] = {
    "e1": { entity_id: "place_100", event_type: "card_open" },
    "e2": { entity_id: "place_100", event_type: "card_open" },
    "e3": { entity_id: "place_100", event_type: "favorite" },
    "e4": { entity_id: "place_100", event_type: "share" },
    "e5": { entity_id: "place_100", event_type: "directions" },
    "e6": { entity_id: "other_place", event_type: "card_open" },
  };

  // 1. Unauthenticated call
  await assert.rejects(
    async () => { await getOrganizerAnalytics({ data: { entityId: "place_100", entityType: "place" } }); },
    (err: any) => err.code === "unauthenticated"
  );

  // 2. Unauthorized caller (not host)
  await assert.rejects(
    async () => { await getOrganizerAnalytics({ data: { entityId: "place_100", entityType: "place" }, auth: { uid: "other_user" } }); },
    (err: any) => err.code === "permission-denied"
  );

  // 3. Authorized host call
  const stats = await getOrganizerAnalytics({
    data: { entityId: "place_100", entityType: "place" },
    auth: { uid: "host_1" }
  });

  assert.deepStrictEqual(stats, { opens: 2, saves: 1, shares: 1, directions: 1 });

  console.log("✅ testGetOrganizerAnalytics passed successfully!");
}

async function testApplyReferralCode() {
  console.log("Running testApplyReferralCode...");

  const seedFixtures = () => {
    resetMockDb();
    mockDbState["users"] = {
      alice: { uid: "alice", displayName: "Alice", role: "user" },
      bob: { uid: "bob", displayName: "Bob", role: "user" },
    };
    mockDbState["referralCodes"] = {
      BOBCODE: { uid: "bob" },
      ALICECODE: { uid: "alice" },
    };
  };

  // 1. Unauthenticated Call
  seedFixtures();
  await assert.rejects(
    applyReferralCode({ code: "BOBCODE" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // 2. Missing/Invalid code parameter
  seedFixtures();
  await assert.rejects(
    applyReferralCode({}, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // 3. Invalid Referral Code
  seedFixtures();
  await assert.rejects(
    applyReferralCode({ code: "INVALID_CODE" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found"
  );

  // 4. Self-referral block
  seedFixtures();
  await assert.rejects(
    applyReferralCode({ code: "ALICECODE" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 5. Caller Profile not found
  seedFixtures();
  await assert.rejects(
    applyReferralCode({ code: "BOBCODE" }, { uid: "non_existent" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found"
  );

  // 6. Successful application (with whitespace/case sanitization)
  seedFixtures();
  const res = await applyReferralCode({ code: "  bobcode  " }, { uid: "alice" });
  assert.deepStrictEqual(res, { success: true });
  assert.strictEqual(mockDbState["users"]["alice"].referredBy, "bob");

  // 7. Idempotency (already referred)
  await assert.rejects(
    applyReferralCode({ code: "BOBCODE" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "already-exists"
  );

  console.log("✅ testApplyReferralCode passed successfully!");
}

async function testResolveLoginIdentifier() {
  console.log("Running testResolveLoginIdentifier...");

  const { resolveLoginIdentifier } = require("./users");

  const seedFixtures = () => {
    resetMockDb();
    mockDbState["users"] = {
      alice: { uid: "alice", displayName: "Alice", email: "alice@example.com", username: "Alice_Un", usernameLowercase: "alice_un" },
      bob: { uid: "bob", displayName: "Bob", email: "bob@example.com", username: "bob_un" }, // Fallback test (no lowercase field)
    };
  };

  // 1. Missing/Invalid username parameter
  seedFixtures();
  await assert.rejects(
    resolveLoginIdentifier({}, null),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // 2. Illegal username format/length returns null email
  seedFixtures();
  let res = await resolveLoginIdentifier({ username: "a" }, null);
  assert.deepStrictEqual(res, { email: null });

  res = await resolveLoginIdentifier({ username: "invalid_char!" }, null);
  assert.deepStrictEqual(res, { email: null });

  // 3. Non-existent username
  seedFixtures();
  res = await resolveLoginIdentifier({ username: "nonexistent" }, null);
  assert.deepStrictEqual(res, { email: null });

  // 4. Existing username via usernameLowercase
  seedFixtures();
  res = await resolveLoginIdentifier({ username: "  ALICE_UN  " }, null);
  assert.deepStrictEqual(res, { email: "alice@example.com" });

  // 5. Existing username via fallback to username field
  seedFixtures();
  res = await resolveLoginIdentifier({ username: "  BOB_UN  " }, null);
  assert.deepStrictEqual(res, { email: "bob@example.com" });

  console.log("✅ testResolveLoginIdentifier passed successfully!");
}

async function testOnUserDeleted() {
  console.log("Running testOnUserDeleted...");

  // Seed user, activities, friendships, notifications
  resetMockDb();
  mockDbState["users"] = {
    alice: { uid: "alice", displayName: "Alice", email: "alice@example.com", username: "alice_un", friends: ["bob"], friendRequestsSent: ["charlie"] },
    bob: { uid: "bob", displayName: "Bob", email: "bob@example.com", username: "bob_un", friends: ["alice"] },
    charlie: { uid: "charlie", displayName: "Charlie", email: "charlie@example.com", friendRequestsReceived: ["alice"] },
  };
  mockDbState["activities"] = {
    act1: { id: "act1", title: "Activity 1", hostId: "alice", status: "active", participantIds: ["alice", "bob"], participantsPreview: [{ uid: "alice" }, { uid: "bob" }] },
    act2: { id: "act2", title: "Activity 2", hostId: "bob", status: "active", participantIds: ["bob", "alice"], participantsPreview: [{ uid: "bob" }, { uid: "alice" }] },
  };
  mockDbState["activities/act1/participants"] = {
    alice: { uid: "alice" },
    bob: { uid: "bob" },
  };
  mockDbState["activities/act2/participants"] = {
    bob: { uid: "bob" },
    alice: { uid: "alice" },
  };
  mockDbState["notifications"] = {
    n1: { recipientId: "alice", senderId: "bob" },
    n2: { recipientId: "bob", senderId: "alice" },
  };

  // Mock admin.storage().bucket().deleteFiles
  const mockBucket = {
    deleteFiles: async (options: any) => {
      console.log(`Mock storage: deleteFiles with prefix ${options.prefix}`);
    }
  };
  (mockAdmin as any).storage = () => ({
    bucket: () => mockBucket
  });

  const { onUserDeleted } = require("./users");

  await onUserDeleted({ uid: "alice" });

  // Assertions:
  // 1. Alice's user doc is deleted
  assert.strictEqual(mockDbState["users"]["alice"], undefined);

  // 2. Bob's friends list is updated (alice removed)
  assert.deepStrictEqual(mockDbState["users"]["bob"].friends, []);

  // 3. Charlie's friendRequestsReceived is updated (alice removed)
  assert.deepStrictEqual(mockDbState["users"]["charlie"].friendRequestsReceived, []);

  // 4. hosted activity act1 status is cancelled
  assert.strictEqual(mockDbState["activities"]["act1"].status, "cancelled");

  // 5. participant activity act2 participant list is updated (alice removed)
  assert.deepStrictEqual(mockDbState["activities"]["act2"].participantIds, ["bob"]);

  // 6. notifications n1 and n2 are deleted
  assert.strictEqual(mockDbState["notifications"]["n1"], undefined);
  assert.strictEqual(mockDbState["notifications"]["n2"], undefined);

  // 7. participants subcollection documents for alice are deleted
  assert.strictEqual(mockDbState["activities/act1/participants"]["alice"], undefined);
  assert.strictEqual(mockDbState["activities/act2/participants"]["alice"], undefined);

  console.log("✅ testOnUserDeleted passed successfully!");
}

async function testSecureSendFriendRequest() {
  console.log("Running testSecureSendFriendRequest...");
  const { secureSendFriendRequest } = require("./users");

  const seedFixtures = () => {
    resetMockDb();
    mockDbState["users"] = {
      alice: { uid: "alice", displayName: "Alice", username: "alice_un", role: "user", friends: [], friendRequestsSent: [], friendRequestsReceived: [] },
      bob: { uid: "bob", displayName: "Bob", username: "bob_un", role: "user", friends: [], friendRequestsSent: [], friendRequestsReceived: [] },
      charlie: { uid: "charlie", displayName: "Charlie", username: "charlie_un", role: "user", friends: ["alice"], friendRequestsSent: [], friendRequestsReceived: [] },
      dave: { uid: "dave", displayName: "Dave", username: "dave_un", role: "user", friends: [], friendRequestsSent: [], friendRequestsReceived: [], blacklist: { hard: ["alice"] } },
    };
    mockDbState["notifications"] = {};
  };

  // 1. Unauthenticated
  seedFixtures();
  await assert.rejects(
    secureSendFriendRequest({ toUserId: "bob" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // 2. Missing toUserId
  seedFixtures();
  await assert.rejects(
    secureSendFriendRequest({}, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // 3. Self request
  seedFixtures();
  await assert.rejects(
    secureSendFriendRequest({ toUserId: "alice" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 4. Sender or recipient not found
  seedFixtures();
  await assert.rejects(
    secureSendFriendRequest({ toUserId: "nonexistent" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found"
  );

  // 5. Already friends
  seedFixtures();
  mockDbState["users"]["alice"].friends = ["charlie"];
  await assert.rejects(
    secureSendFriendRequest({ toUserId: "charlie" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "already-exists"
  );

  // 6. Blocked user
  seedFixtures();
  await assert.rejects(
    secureSendFriendRequest({ toUserId: "dave" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "permission-denied"
  );

  // 7. Successful request
  seedFixtures();
  const res = await secureSendFriendRequest({ toUserId: "bob" }, { uid: "alice" });
  assert.deepStrictEqual(res, { success: true });
  assert.deepStrictEqual(mockDbState["users"]["alice"].friendRequestsSent, ["bob"]);
  assert.deepStrictEqual(mockDbState["users"]["bob"].friendRequestsReceived, ["alice"]);
  
  // Verify notification
  const notifKeys = Object.keys(mockDbState["notifications"] || {});
  assert.strictEqual(notifKeys.length, 1);
  const notif = mockDbState["notifications"][notifKeys[0]];
  assert.strictEqual(notif.recipientId, "bob");
  assert.strictEqual(notif.senderId, "alice");
  assert.strictEqual(notif.type, "friend_request");
  assert.strictEqual(notif.isRead, false);
  assert.strictEqual(notif.senderProfile.displayName, "@alice_un");

  // 8. Duplicate request
  await assert.rejects(
    secureSendFriendRequest({ toUserId: "bob" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "already-exists"
  );

  console.log("✅ testSecureSendFriendRequest passed successfully!");
}

async function testSecureAcceptFriendRequest() {
  console.log("Running testSecureAcceptFriendRequest...");
  const { secureAcceptFriendRequest } = require("./users");

  const seedFixtures = () => {
    resetMockDb();
    mockDbState["users"] = {
      alice: { uid: "alice", displayName: "Alice", role: "user", friends: [], friendRequestsSent: [], friendRequestsReceived: ["bob"] },
      bob: { uid: "bob", displayName: "Bob", role: "user", friends: [], friendRequestsSent: ["alice"], friendRequestsReceived: [] },
      charlie: { uid: "charlie", displayName: "Charlie", role: "user", friends: [], friendRequestsSent: [], friendRequestsReceived: [] },
    };
  };

  // 1. Unauthenticated
  seedFixtures();
  await assert.rejects(
    secureAcceptFriendRequest({ fromUserId: "bob" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // 2. Missing fromUserId
  seedFixtures();
  await assert.rejects(
    secureAcceptFriendRequest({}, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // 3. Self accept
  seedFixtures();
  await assert.rejects(
    secureAcceptFriendRequest({ fromUserId: "alice" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 4. No pending request
  seedFixtures();
  await assert.rejects(
    secureAcceptFriendRequest({ fromUserId: "charlie" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 5. Successful accept
  seedFixtures();
  const res = await secureAcceptFriendRequest({ fromUserId: "bob" }, { uid: "alice" });
  assert.deepStrictEqual(res, { success: true });
  assert.deepStrictEqual(mockDbState["users"]["alice"].friends, ["bob"]);
  assert.deepStrictEqual(mockDbState["users"]["bob"].friends, ["alice"]);
  assert.deepStrictEqual(mockDbState["users"]["alice"].friendRequestsReceived, []);
  assert.deepStrictEqual(mockDbState["users"]["bob"].friendRequestsSent, []);

  // 6. Already friends
  await assert.rejects(
    secureAcceptFriendRequest({ fromUserId: "bob" }, { uid: "alice" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  console.log("✅ testSecureAcceptFriendRequest passed successfully!");
}

async function runAllTests() {
  try {
    await testLaunchCampaign2026();
    await testGetOrganizerAnalytics();
    await testApplyReferralCode();
    await testResolveLoginIdentifier();
    await testOnUserDeleted();
    await testSecureSendFriendRequest();
    await testSecureAcceptFriendRequest();
    console.log("🎉 ALL USERS MODULE TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (error) {
    console.error("❌ TEST RUNNER FAILED:", error);
    process.exit(1);
  }
}

runAllTests();

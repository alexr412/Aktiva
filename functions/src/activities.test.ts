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

const { respondToJoinRequest, secureRequestJoinActivity, kickParticipant, validateActivityEligibility, normalizeAndValidateGenderRequirements } = require("./activities");

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
    (err: any) => err.name === "HttpsError" && (err.code === "resource-exhausted" || err.code === "failed-precondition")
  );

  // 8. Successful Accept
  seedFixtures();
  mockDbState["users/host1/notification_meta"] = { state: { unreadCount: 2 } };
  const acceptResult = await respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" });
  assert.deepStrictEqual(acceptResult, { success: true });
  // Verify updates in database
  assert.ok(mockDbState["activities"]["act1"].participantIds.includes("joiner1"));
  assert.strictEqual(mockDbState["chats"]["act1"].participantIds.includes("joiner1"), true);
  // Verify notification resolved/deleted
  assert.strictEqual(mockDbState["notifications"]["notif1"], undefined);
  // Verify host unreadCount decremented from 2 to 1
  assert.strictEqual(mockDbState["users/host1/notification_meta"]["state"].unreadCount, 1);
  // Verify exactly one response notification created
  const notifs = Object.values(mockDbState["notifications"]);
  assert.strictEqual(notifs.length, 1);
  assert.strictEqual(notifs[0].type, "join_response");
  assert.strictEqual(notifs[0].responseStatus, "accepted");
  assert.strictEqual(notifs[0].recipientId, "joiner1");

  // 9. Successful Decline
  seedFixtures();
  mockDbState["users/host1/notification_meta"] = { state: { unreadCount: 1 } };
  const declineResult = await respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "decline", customMessage: "Sorry" }, { uid: "host1" });
  assert.deepStrictEqual(declineResult, { success: true });
  // Verify target not added to participantIds
  assert.ok(!mockDbState["activities"]["act1"].participantIds.includes("joiner1"));
  // Verify notification resolved/deleted
  assert.strictEqual(mockDbState["notifications"]["notif1"], undefined);
  // Verify host unreadCount decremented from 1 to 0 (never negative)
  assert.strictEqual(mockDbState["users/host1/notification_meta"]["state"].unreadCount, 0);
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

  // 11. Test entityId fallback (current notifications format) - Accept
  seedFixtures();
  mockDbState["notifications"]["notif_entity"] = { type: "join_request", entityId: "act1", senderId: "joiner1", recipientId: "host1" };
  const acceptEntityIdResult = await respondToJoinRequest({ notificationId: "notif_entity", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" });
  assert.deepStrictEqual(acceptEntityIdResult, { success: true });
  assert.ok(mockDbState["activities"]["act1"].participantIds.includes("joiner1"));

  // 12. Test legacy activityId format - Decline
  seedFixtures();
  mockDbState["notifications"]["notif_legacy"] = { type: "join_request", activityId: "act1", senderId: "joiner1", recipientId: "host1" };
  const declineLegacyResult = await respondToJoinRequest({ notificationId: "notif_legacy", activityId: "act1", userIdToJoin: "joiner1", action: "decline" }, { uid: "host1" });
  assert.deepStrictEqual(declineLegacyResult, { success: true });

  // 13. Test wrong activityId -> Notification mismatch
  seedFixtures();
  mockDbState["notifications"]["notif_wrong"] = { type: "join_request", entityId: "act_other", senderId: "joiner1", recipientId: "host1" };
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif_wrong", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument" && err.message === "Notification mismatch."
  );

  console.log("✅ testRespondToJoinRequest passed successfully!");
}

async function testSecureRequestJoinActivity() {
  console.log("Running testSecureRequestJoinActivity...");

  const seedFixtures = () => {
    resetMockDb();
    mockDbState["activities"] = {
      act1: { hostId: "host1", status: "active", participantIds: ["host1"] },
      act_direct: { hostId: "host1", status: "active", participantIds: ["host1"], joinMode: "direct" }
    };
    mockDbState["users"] = {
      host1: { displayName: "Host", role: "user" },
      joiner1: { displayName: "Joiner", role: "user" }
    };
  };

  // 1. Unauthenticated Call
  seedFixtures();
  await assert.rejects(
    secureRequestJoinActivity({ activityId: "act1" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // 2. Missing Activity
  seedFixtures();
  await assert.rejects(
    secureRequestJoinActivity({ activityId: "nonexistent" }, { uid: "joiner1" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found"
  );

  // 3. Activity is Completed (not active)
  seedFixtures();
  mockDbState["activities"]["act1"].status = "completed";
  await assert.rejects(
    secureRequestJoinActivity({ activityId: "act1" }, { uid: "joiner1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 4. Direct Activity Join Mode
  seedFixtures();
  await assert.rejects(
    secureRequestJoinActivity({ activityId: "act_direct" }, { uid: "joiner1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 5. Requester is Host
  seedFixtures();
  await assert.rejects(
    secureRequestJoinActivity({ activityId: "act1" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 6. Requester is already Participant
  seedFixtures();
  mockDbState["activities"]["act1"].participantIds.push("joiner1");
  await assert.rejects(
    secureRequestJoinActivity({ activityId: "act1" }, { uid: "joiner1" }),
    (err: any) => err.name === "HttpsError" && err.code === "already-exists"
  );

  // 7. Requester is Banned
  seedFixtures();
  mockDbState["users"]["joiner1"].isBanned = true;
  await assert.rejects(
    secureRequestJoinActivity({ activityId: "act1" }, { uid: "joiner1" }),
    (err: any) => err.name === "HttpsError" && (err.code === "permission-denied" || err.code === "failed-precondition")
  );

  // 8. Successful Request
  seedFixtures();
  const res = await secureRequestJoinActivity({ activityId: "act1", message: "Hi" }, { uid: "joiner1" });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, "requested");
  
  // Verify notification doc
  const notif = mockDbState["notifications"][`join_request_act1_joiner1`];
  assert.ok(notif);
  assert.strictEqual(notif.recipientId, "host1");
  assert.strictEqual(notif.actorId, "joiner1");
  assert.strictEqual(notif.type, "join_request");
  assert.strictEqual(notif.body, "Hi");
  assert.ok(notif.senderProfile);
  assert.strictEqual(notif.senderProfile.displayName, "Joiner");

  // 9. Repeated Request (Idempotency)
  const res2 = await secureRequestJoinActivity({ activityId: "act1", message: "Hi second time" }, { uid: "joiner1" });
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.status, "already_requested");
  // Verify no new notification was created and body not updated
  assert.strictEqual(mockDbState["notifications"][`join_request_act1_joiner1`].body, "Hi");

  console.log("✅ testSecureRequestJoinActivity passed successfully!");
}

async function testKickParticipant() {
  console.log("Running testKickParticipant...");

  const seedFixtures = () => {
    resetMockDb();
    mockDbState["activities"] = {
      act1: {
        hostId: "host1",
        status: "active",
        participantIds: ["host1", "user2"],
        participantsPreview: [{ uid: "host1" }, { uid: "user2" }],
        participantDetails: { host1: { displayName: "Host" }, user2: { displayName: "User2" } },
        kickedUserIds: []
      }
    };
    mockDbState["chats"] = {
      act1: {
        activityId: "act1",
        hostId: "host1",
        participantIds: ["host1", "user2"],
        participantDetails: { host1: {}, user2: {} }
      }
    };
    mockDbState["users"] = {
      host1: { displayName: "Host", role: "user" },
      user2: { displayName: "User2", role: "user" },
      user3: { displayName: "User3", role: "user" },
      sysadmin: { displayName: "SysAdmin", role: "admin" }
    };
  };

  // 1. Host can remove participant
  seedFixtures();
  const kickRes = await kickParticipant({ activityId: "act1", targetUserId: "user2" }, { uid: "host1" });
  assert.deepStrictEqual(kickRes, { success: true });
  assert.strictEqual(mockDbState["activities"]["act1"].participantIds.includes("user2"), false);
  assert.strictEqual(mockDbState["activities"]["act1"].kickedUserIds.includes("user2"), true);
  assert.strictEqual(mockDbState["chats"]["act1"].participantIds.includes("user2"), false);

  // 2. Regular participant cannot remove anyone
  seedFixtures();
  await assert.rejects(
    kickParticipant({ activityId: "act1", targetUserId: "user2" }, { uid: "user3" }),
    (err: any) => err.name === "HttpsError" && err.code === "permission-denied"
  );

  // 3. Global system admin cannot remove participants of someone else's activity
  seedFixtures();
  await assert.rejects(
    kickParticipant({ activityId: "act1", targetUserId: "user2" }, { uid: "sysadmin" }),
    (err: any) => err.name === "HttpsError" && err.code === "permission-denied"
  );

  // 4. Host cannot be removed
  seedFixtures();
  await assert.rejects(
    kickParticipant({ activityId: "act1", targetUserId: "host1" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  // 5. Kicked user cannot re-join directly
  seedFixtures();
  mockDbState["activities"]["act1"].participantIds = ["host1"];
  mockDbState["activities"]["act1"].kickedUserIds = ["user2"];
  await assert.rejects(
    secureRequestJoinActivity({ activityId: "act1", message: "Rejoin request" }, { uid: "user2" }),
    (err: any) => err.name === "HttpsError" && err.code === "permission-denied"
  );

  console.log("✅ testKickParticipant passed successfully!");
}

async function testValidateActivityEligibility() {
  console.log("Running testValidateActivityEligibility...");

  // 1. Normalization tests
  assert.strictEqual(normalizeAndValidateGenderRequirements(undefined), undefined);
  assert.strictEqual(normalizeAndValidateGenderRequirements([]), undefined);
  assert.deepStrictEqual(normalizeAndValidateGenderRequirements(["female"]), ["female"]);
  assert.deepStrictEqual(normalizeAndValidateGenderRequirements(["female", "female"]), ["female"]);
  assert.strictEqual(normalizeAndValidateGenderRequirements(["female", "male", "diverse"]), undefined);
  assert.throws(
    () => normalizeAndValidateGenderRequirements(["invalid_gender"]),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // 2. Frau -> ['female'] -> Join allowed
  const res1 = validateActivityEligibility(
    { requirements: { gender: ["female"] }, hostId: "host1" },
    { uid: "user_f", gender: "female" }
  );
  assert.strictEqual(res1.eligible, true);

  // 3. Mann -> ['female'] -> Join blocked (GENDER_REQUIREMENT_NOT_MET)
  const res2 = validateActivityEligibility(
    { requirements: { gender: ["female"] }, hostId: "host1" },
    { uid: "user_m", gender: "male" }
  );
  assert.strictEqual(res2.eligible, false);
  assert.strictEqual(res2.errorCode, "GENDER_REQUIREMENT_NOT_MET");

  // 4. Diverse -> ['female'] -> Join blocked (GENDER_REQUIREMENT_NOT_MET)
  const res3 = validateActivityEligibility(
    { requirements: { gender: ["female"] }, hostId: "host1" },
    { uid: "user_d", gender: "diverse" }
  );
  assert.strictEqual(res3.eligible, false);
  assert.strictEqual(res3.errorCode, "GENDER_REQUIREMENT_NOT_MET");

  // 5. Mann -> ['male'] -> Join allowed
  const res4 = validateActivityEligibility(
    { requirements: { gender: ["male"] }, hostId: "host1" },
    { uid: "user_m", gender: "male" }
  );
  assert.strictEqual(res4.eligible, true);

  // 6. Diverse -> ['female', 'diverse'] -> Join allowed
  const res5 = validateActivityEligibility(
    { requirements: { gender: ["female", "diverse"] }, hostId: "host1" },
    { uid: "user_d", gender: "diverse" }
  );
  assert.strictEqual(res5.eligible, true);

  // 7. No requirements.gender -> All allowed
  const res6 = validateActivityEligibility(
    { requirements: {}, hostId: "host1" },
    { uid: "user_m", gender: "male" }
  );
  assert.strictEqual(res6.eligible, true);

  // 8. Age requirement test
  const res7 = validateActivityEligibility(
    { requirements: { ageRange: { min: 21, max: 50 } }, hostId: "host1" },
    { uid: "user_young", age: 18 }
  );
  assert.strictEqual(res7.eligible, false);
  assert.strictEqual(res7.errorCode, "AGE_REQUIREMENT_NOT_MET");

  // 9. Profile picture requirement test
  const res8 = validateActivityEligibility(
    { requirements: { requireProfilePicture: true }, hostId: "host1" },
    { uid: "user_no_pic", photoURL: null }
  );
  assert.strictEqual(res8.eligible, false);
  assert.strictEqual(res8.errorCode, "PROFILE_PICTURE_REQUIRED");

  // 10. Verification requirement test
  const res9 = validateActivityEligibility(
    { requirements: { requireVerification: true }, hostId: "host1" },
    { uid: "user_unverified", kycStatus: "unverified" }
  );
  assert.strictEqual(res9.eligible, false);
  assert.strictEqual(res9.errorCode, "VERIFICATION_REQUIRED");

  // 11. Banned user & accountStatus tests
  const res10 = validateActivityEligibility(
    { hostId: "host1" },
    { uid: "user_banned", isBanned: true }
  );
  assert.strictEqual(res10.eligible, false);
  assert.strictEqual(res10.errorCode, "ACCOUNT_NOT_ELIGIBLE");

  const res10b = validateActivityEligibility(
    { hostId: "host1" },
    { uid: "user_deleted", accountStatus: "deleted" }
  );
  assert.strictEqual(res10b.eligible, false);
  assert.strictEqual(res10b.errorCode, "ACCOUNT_NOT_ELIGIBLE");

  const res10c = validateActivityEligibility(
    { hostId: "host1" },
    { uid: "user_disabled", accountStatus: "disabled" }
  );
  assert.strictEqual(res10c.eligible, false);
  assert.strictEqual(res10c.errorCode, "ACCOUNT_NOT_ELIGIBLE");

  // Suspended in future vs expired suspension
  const res10d = validateActivityEligibility(
    { hostId: "host1" },
    { uid: "user_suspended", accountStatus: "suspended", suspendedUntil: Date.now() + 3600000 }
  );
  assert.strictEqual(res10d.eligible, false);
  assert.strictEqual(res10d.errorCode, "ACCOUNT_NOT_ELIGIBLE");

  const res10e = validateActivityEligibility(
    { hostId: "host1" },
    { uid: "user_expired_suspension", accountStatus: "suspended", suspendedUntil: Date.now() - 3600000 }
  );
  assert.strictEqual(res10e.eligible, true);

  // 12. gender: [] treated as unrestricted ("Alle")
  const res11 = validateActivityEligibility(
    { requirements: { gender: [] }, hostId: "host1" },
    { uid: "user_m", gender: "male" }
  );
  assert.strictEqual(res11.eligible, true);

  // 13. Host Male trying to fulfill Women-Only requirements -> fails for host
  const res12 = validateActivityEligibility(
    { requirements: { gender: ["female"] }, hostId: "host_male" },
    { uid: "host_male", gender: "male" }
  );
  assert.strictEqual(res12.eligible, false);
  assert.strictEqual(res12.errorCode, "GENDER_REQUIREMENT_NOT_MET");

  // 15. Men-Only requirement ['male']
  const resMaleHost = validateActivityEligibility(
    { requirements: { gender: ["male"] }, hostId: "host_male" },
    { uid: "host_male", gender: "male" }
  );
  assert.strictEqual(resMaleHost.eligible, true);

  const resFemaleUserOnMaleEvent = validateActivityEligibility(
    { requirements: { gender: ["male"] }, hostId: "host_male" },
    { uid: "user_female", gender: "female" }
  );
  assert.strictEqual(resFemaleUserOnMaleEvent.eligible, false);
  assert.strictEqual(resFemaleUserOnMaleEvent.errorCode, "GENDER_REQUIREMENT_NOT_MET");

  // 16. Diverse-Only requirement ['diverse']
  const resDiverseHost = validateActivityEligibility(
    { requirements: { gender: ["diverse"] }, hostId: "host_diverse" },
    { uid: "host_diverse", gender: "diverse" }
  );
  assert.strictEqual(resDiverseHost.eligible, true);

  const resMaleUserOnDiverseEvent = validateActivityEligibility(
    { requirements: { gender: ["diverse"] }, hostId: "host_diverse" },
    { uid: "user_male", gender: "male" }
  );
  assert.strictEqual(resMaleUserOnDiverseEvent.eligible, false);
  assert.strictEqual(resMaleUserOnDiverseEvent.errorCode, "GENDER_REQUIREMENT_NOT_MET");

  // 17. Custom combo ['female', 'diverse']
  const resFemaleOnCustom = validateActivityEligibility(
    { requirements: { gender: ["female", "diverse"] }, hostId: "host1" },
    { uid: "user_female", gender: "female" }
  );
  assert.strictEqual(resFemaleOnCustom.eligible, true);

  const resMaleOnCustom = validateActivityEligibility(
    { requirements: { gender: ["female", "diverse"] }, hostId: "host1" },
    { uid: "user_male", gender: "male" }
  );
  assert.strictEqual(resMaleOnCustom.eligible, false);
  assert.strictEqual(resMaleOnCustom.errorCode, "GENDER_REQUIREMENT_NOT_MET");

  // 18. Suspended fail-closed checks
  const resSuspendedMissingUntil = validateActivityEligibility(
    { hostId: "host1" },
    { uid: "user_suspended_no_until", accountStatus: "suspended" }
  );
  assert.strictEqual(resSuspendedMissingUntil.eligible, false);
  assert.strictEqual(resSuspendedMissingUntil.errorCode, "ACCOUNT_NOT_ELIGIBLE");

  const resSuspendedInvalidUntil = validateActivityEligibility(
    { hostId: "host1" },
    { uid: "user_suspended_bad_until", accountStatus: "suspended", suspendedUntil: "invalid-date" }
  );
  assert.strictEqual(resSuspendedInvalidUntil.eligible, false);
  assert.strictEqual(resSuspendedInvalidUntil.errorCode, "ACCOUNT_NOT_ELIGIBLE");

  console.log("✅ testValidateActivityEligibility passed successfully!");
}

async function testConcurrentJoinRequests() {
  console.log("Running testConcurrentJoinRequests...");
  resetMockDb();
  mockDbState["activities"] = {
    act1: { hostId: "host1", status: "active", participantIds: ["host1"], maxParticipants: 2 }
  };
  mockDbState["chats"] = {
    act1: { participantIds: ["host1"] }
  };
  mockDbState["users"] = {
    host1: { uid: "host1", username: "host1", displayName: "Host 1" },
    joiner1: { uid: "joiner1", username: "joiner1", displayName: "Joiner 1", gender: "female" },
    joiner2: { uid: "joiner2", username: "joiner2", displayName: "Joiner 2", gender: "female" }
  };
  mockDbState["notifications"] = {
    notif1: { type: "join_request", activityId: "act1", senderId: "joiner1", recipientId: "host1", isRead: true },
    notif2: { type: "join_request", activityId: "act1", senderId: "joiner2", recipientId: "host1", isRead: true }
  };

  // First accept fills remaining spot
  const res1 = await respondToJoinRequest({ notificationId: "notif1", activityId: "act1", userIdToJoin: "joiner1", action: "accept" }, { uid: "host1" });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(mockDbState["activities"]["act1"].participantIds.length, 2);

  // Second accept on full capacity must fail with ACTIVITY_FULL (failed-precondition)
  await assert.rejects(
    respondToJoinRequest({ notificationId: "notif2", activityId: "act1", userIdToJoin: "joiner2", action: "accept" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition"
  );

  console.log("✅ testConcurrentJoinRequests passed successfully!");
}

async function runAllTests() {
  try {
    await testValidateActivityEligibility();
    await testConcurrentJoinRequests();
    await testRespondToJoinRequest();
    await testSecureRequestJoinActivity();
    await testKickParticipant();
    console.log("🎉 ALL ACTIVITIES MODULE TESTS PASSED SUCCESSFULLY! 🎉");
    process.exit(0);
  } catch (error) {
    console.error("❌ TEST RUNNER FAILED:", error);
    process.exit(1);
  }
}

runAllTests();

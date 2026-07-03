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

    // Register under exact resolved path
    require.cache[resolvedPath] = mockEntry;

    // Register under lowercase drive letter
    const lowerDrive = resolvedPath.charAt(0).toLowerCase() + resolvedPath.slice(1);
    require.cache[lowerDrive] = mockEntry;

    // Register under uppercase drive letter
    const upperDrive = resolvedPath.charAt(0).toUpperCase() + resolvedPath.slice(1);
    require.cache[upperDrive] = mockEntry;

    // Register under forward slash variant
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
  get id() {
    return this.docId;
  }
  get path() {
    return `${this.collectionPath}/${this.docId}`;
  }
  collection(path: string) {
    return new MockCollectionReference(`${this.collectionPath}/${this.docId}/${path}`);
  }
  async set(data: any, options?: any) {
    if (!mockDbState[this.collectionPath]) {
      mockDbState[this.collectionPath] = {};
    }
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
    if (!mockDbState[this.collectionPath]) {
      mockDbState[this.collectionPath] = {};
    }
    mockDbState[this.collectionPath][docId] = JSON.parse(JSON.stringify(data));
    return new MockDocumentReference(this.collectionPath, docId);
  }

  limit(n: number) {
    return this;
  }

  async get() {
    const docsData = mockDbState[this.collectionPath] || {};
    const docs = Object.keys(docsData).map(docId => {
      return {
        id: docId,
        ref: new MockDocumentReference(this.collectionPath, docId),
        data: () => docsData[docId]
      };
    });
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs
    };
  }
}

const isServerTimestamp = (val: any) => val && val.__type === "serverTimestamp";
const isIncrement = (val: any) => val && val.__type === "increment";
const isArrayUnion = (val: any) => val && val.__type === "arrayUnion";
const isArrayRemove = (val: any) => val && val.__type === "arrayRemove";
const isDelete = (val: any) => val && val.__type === "delete";

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
    if (!mockDbState[ref.collectionPath]) {
      mockDbState[ref.collectionPath] = {};
    }
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
      console.log(`DEBUG UPDATE key: ${key}, val:`, val, "isArrayUnion:", isArrayUnion(val));

      if (isDelete(val)) {
        if (key.includes(".")) {
          const parts = key.split(".");
          let obj = current;
          for (let i = 0; i < parts.length - 1; i++) {
            obj = obj?.[parts[i]];
          }
          if (obj) delete obj[parts[parts.length - 1]];
        } else {
          delete current[key];
        }
        continue;
      }

      if (isIncrement(val)) {
        current[key] = (current[key] || 0) + val.value;
        continue;
      }

      if (isArrayUnion(val)) {
        current[key] = current[key] || [];
        for (const el of val.value) {
          if (!current[key].includes(el)) {
            current[key].push(el);
          }
        }
        console.log("DEBUG UPDATE arrayUnion result:", current[key]);
        continue;
      }

      if (isArrayRemove(val)) {
        current[key] = current[key] || [];
        current[key] = current[key].filter((el: any) => !val.value.includes(el));
        continue;
      }

      if (key.includes(".")) {
        const parts = key.split(".");
        let obj = current;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
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

class MockWriteBatch {
  delete(ref: MockDocumentReference) {
    if (mockDbState[ref.collectionPath]) {
      delete mockDbState[ref.collectionPath][ref.docId];
    }
  }
  async commit() {
    return Promise.resolve();
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

// Mock firebase-admin
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
      const request = {
        data,
        auth: auth || null,
      };
      return handler(request);
    };
  },
  HttpsError,
};

// Mock firebase-functions/v2/https
mockModule("firebase-functions/v2/https", mockFunctionsHttps);

const mockFunctionsFirestore = {
  onDocumentCreated: (path: string, handler: any) => handler,
  onDocumentUpdated: (path: string, handler: any) => handler,
};

// Mock firebase-functions/v2/firestore
mockModule("firebase-functions/v2/firestore", mockFunctionsFirestore);

// Mock Stripe SDK for unit tests
process.env.STRIPE_SECRET_KEY = "sk_test_mock";

const mockStripe = class {
  constructor(public apiKey: string) {
    if (!apiKey) {
      throw new Error("Stripe API key is required");
    }
  }
  paymentIntents = {
    retrieve: async (id: string) => {
      if (id === "pi_failed") {
        return { id, status: "requires_payment_method", amount: 1500, currency: "eur", metadata: {} };
      }
      if (id === "pi_wrong_currency") {
        return { id, status: "succeeded", amount: 1500, currency: "usd", metadata: { activityId: "paid_act", userId: "user1" } };
      }
      if (id === "pi_wrong_amount") {
        return { id, status: "succeeded", amount: 500, currency: "eur", metadata: { activityId: "paid_act", userId: "user1" } };
      }
      if (id === "pi_wrong_metadata") {
        return { id, status: "succeeded", amount: 1500, currency: "eur", metadata: { activityId: "other_act", userId: "user1" } };
      }
      
      const testCases = ["cancelled_act", "completed_act", "free_act", "full_act", "missing_act"];
      let actId = "paid_act";
      if (id.startsWith("pi_test_")) {
        const suffix = id.replace("pi_test_", "");
        if (testCases.includes(suffix)) {
          actId = suffix;
        }
      }
      
      const amount = actId === "paid_act" ? 1500 : 1000;
      return {
        id,
        status: "succeeded",
        amount: amount,
        currency: "eur",
        metadata: {
          activityId: actId,
          userId: "user1"
        }
      };
    }
  };
  checkout = {
    sessions: {
      retrieve: async (id: string) => {
        if (id === "cs_failed") {
          return { id, payment_status: "unpaid", amount_total: 1500, currency: "eur", metadata: {} };
        }
        if (id === "cs_wrong_currency") {
          return { id, payment_status: "paid", amount_total: 1500, currency: "usd", metadata: { activityId: "paid_act", userId: "user1" } };
        }
        if (id === "cs_wrong_amount") {
          return { id, payment_status: "paid", amount_total: 500, currency: "eur", metadata: { activityId: "paid_act", userId: "user1" } };
        }
        if (id === "cs_wrong_metadata") {
          return { id, payment_status: "paid", amount_total: 1500, currency: "eur", metadata: { activityId: "other_act", userId: "user1" } };
        }
        
        const testCases = ["cancelled_act", "completed_act", "free_act", "full_act", "missing_act"];
        let actId = "paid_act";
        if (id.startsWith("cs_test_")) {
          const suffix = id.replace("cs_test_", "");
          if (testCases.includes(suffix)) {
            actId = suffix;
          }
        }
        
        return {
          id,
          payment_status: "paid",
          amount_total: 1500,
          currency: "eur",
          metadata: {
            activityId: actId,
            userId: "user1"
          }
        };
      }
    }
  };
};
mockModule("stripe", mockStripe);

// ─── IMPORTS UNDER TEST ──────────────────────────────────────────────────────

const {
  getUserBalancesInCents,
  assertBalanceInvariants,
  secureJoinPaidActivity,
  secureRequestPayout,
  secureCompleteActivity,
  secureLeaveActivity,
  secureCancelActivity,
} = require("./payments");

// ─── TEST SUITES ─────────────────────────────────────────────────────────────

console.log("--- RUNNING AKTIVA PAYMENTS PIPELINE TESTS (PHASE 1) ---");

// 1. Test getUserBalancesInCents helper
function testGetUserBalancesInCents() {
  console.log("Running testGetUserBalancesInCents...");

  // Legacy float format
  const balances1 = getUserBalancesInCents({
    fiatBalance: 24.50,
    escrowBalance: 10.00
  });
  assert.strictEqual(balances1.fiatBalanceCents, 2450);
  assert.strictEqual(balances1.escrowBalanceCents, 1000);

  // Modern cents format
  const balances2 = getUserBalancesInCents({
    fiatBalance: 2450,
    escrowBalance: 1000,
    balancesInCents: true
  });
  assert.strictEqual(balances2.fiatBalanceCents, 2450);
  assert.strictEqual(balances2.escrowBalanceCents, 1000);

  // Missing/undefined balances
  const balances3 = getUserBalancesInCents({});
  assert.strictEqual(balances3.fiatBalanceCents, 0);
  assert.strictEqual(balances3.escrowBalanceCents, 0);

  console.log("✅ testGetUserBalancesInCents passed");
}

// 2. Test assertBalanceInvariants helper
function testAssertBalanceInvariants() {
  console.log("Running testAssertBalanceInvariants...");

  // Zero balances should pass
  assertBalanceInvariants("test-zero", 0, 0);

  // Positive balances should pass
  assertBalanceInvariants("test-pos", 100, 200);

  // Negative fiat balance should throw
  try {
    assertBalanceInvariants("test-neg-fiat", -1, 100);
    assert.fail("Should have thrown an error");
  } catch (err: any) {
    assert.strictEqual(err.code, "internal");
    assert.ok(err.message.includes("fiatBalance would be negative"));
  }

  // Negative escrow balance should throw
  try {
    assertBalanceInvariants("test-neg-escrow", 100, -1);
    assert.fail("Should have thrown an error");
  } catch (err: any) {
    assert.strictEqual(err.code, "internal");
    assert.ok(err.message.includes("escrowBalance would be negative"));
  }

  console.log("✅ testAssertBalanceInvariants passed");
}

// 3. Test secureJoinPaidActivity HTTPS Callable
async function testSecureJoinPaidActivity() {
  console.log("Running testSecureJoinPaidActivity...");

  // Test Case A: unauthenticated request
  resetMockDb();
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "act1", transactionToken: "pi_test_act1" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // Test Case B: missing arguments
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "act1" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // Test Case C: activity not found
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "missing_act", transactionToken: "pi_test_missing_act" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found" && err.message.includes("Aktivität nicht gefunden")
  );

  // Test Case D: activity cancelled or completed (CAS lock)
  mockDbState["activities"] = {
    cancelled_act: { status: "cancelled", isPaid: true, hostId: "host1", participantIds: [] },
    completed_act: { status: "completed", isPaid: true, hostId: "host1", participantIds: [] }
  };
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "cancelled_act", transactionToken: "pi_test_cancelled_act" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("nicht mehr aktiv")
  );
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "completed_act", transactionToken: "pi_test_completed_act" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("nicht mehr aktiv")
  );

  // Test Case E: activity not paid
  mockDbState["activities"] = {
    free_act: { status: "active", isPaid: false, hostId: "host1", participantIds: [] }
  };
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "free_act", transactionToken: "pi_test_free_act" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("keine Zahlung")
  );

  // Test Case F: capacity limit reached
  mockDbState["activities"] = {
    full_act: { status: "active", isPaid: true, hostId: "host1", participantIds: ["user_other"], maxParticipants: 1 }
  };
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "full_act", transactionToken: "pi_test_full_act" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "resource-exhausted"
  );

  // Test Case G: duplicate transactionToken (idempotency check inside transaction)
  mockDbState["activities"] = {
    paid_act: { status: "active", isPaid: true, price: 10.0, hostId: "host1", participantIds: [] }
  };
  mockDbState["processed_payments"] = {
    pi_test_dup_token: { status: "completed" }
  };
  const dupResult = await (secureJoinPaidActivity as any)({ activityId: "paid_act", transactionToken: "pi_test_dup_token" }, { uid: "user1" });
  assert.deepStrictEqual(dupResult, { success: true, duplicated: true });

  // Test Case H: Already participant (idempotent success)
  mockDbState["activities"] = {
    paid_act: { status: "active", isPaid: true, price: 10.0, hostId: "host1", participantIds: ["user1"] }
  };
  delete mockDbState["processed_payments"]["pi_test_dup_token"];
  const alreadyParticipantResult = await (secureJoinPaidActivity as any)({ activityId: "paid_act", transactionToken: "pi_test_already_participant" }, { uid: "user1" });
  assert.deepStrictEqual(alreadyParticipantResult, { success: true, message: "Bereits Teilnehmer." });

  // Test Case I: Valid join moves participant and host escrow
  mockDbState["activities"] = {
    paid_act: { status: "active", isPaid: true, price: 15.0, hostId: "host1", participantIds: [] }
  };
  mockDbState["users"] = {
    user1: { displayName: "User One", fiatBalance: 50.0, escrowBalance: 0.0, balancesInCents: false },
    host1: { displayName: "Host One", fiatBalance: 100.0, escrowBalance: 20.0, balancesInCents: true },
    referrer1: { displayName: "Referrer One", successfulReferrals: 2 }
  };
  mockDbState["chats"] = {
    paid_act: { participantIds: [] }
  };

  const validResult = await (secureJoinPaidActivity as any)(
    { activityId: "paid_act", transactionToken: "pi_test_valid", referralId: "referrer1" },
    { uid: "user1" }
  );
  assert.deepStrictEqual(validResult, { success: true });

  // Check user added to activity
  const updatedAct = mockDbState["activities"]["paid_act"];
  assert.ok(updatedAct.participantIds.includes("user1"));
  assert.strictEqual(updatedAct.participantDetails["user1"].displayName, "User One");

  // Check host escrow increased by net amount (90% of 15.00 EUR = 13.50 EUR = 1350 cents)
  // Host balancesInCents was true, initial escrow was 20. Total: 1370 cents.
  const updatedHost = mockDbState["users"]["host1"];
  assert.strictEqual(updatedHost.escrowBalance, 1370);

  // Check user balances migrated to cents
  const updatedUser = mockDbState["users"]["user1"];
  assert.strictEqual(updatedUser.balancesInCents, true);
  assert.strictEqual(updatedUser.fiatBalance, 5000);

  // Check referral incremented
  const updatedReferrer = mockDbState["users"]["referrer1"];
  assert.strictEqual(updatedReferrer.successfulReferrals, 3);

  // Check idempotency record created
  assert.ok(mockDbState["processed_payments"]["pi_test_valid"]);

  // Check ledger entry written
  const ledgerEntries = Object.values(mockDbState["financial_ledger"] || {});
  assert.strictEqual(ledgerEntries.length, 1);
  const entry = ledgerEntries[0] as any;
  assert.strictEqual(entry.operationType, "join_activity");
  assert.strictEqual(entry.amountCents, 1500);
  assert.strictEqual(entry.fromUser, "user1");
  assert.strictEqual(entry.toUser, "host1");

  // Test Case J: DLQ logging on transaction failure
  resetMockDb();
  mockDbState["activities"] = {
    paid_act: { status: "active", isPaid: true, price: 15.0, hostId: "host1", participantIds: [] }
  };
  const originalRunTransaction = mockDb.runTransaction;
  mockDb.runTransaction = async () => {
    throw new Error("Simulated Firestore Failure");
  };

  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "paid_act", transactionToken: "pi_test_dlq_token" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "internal" && err.message.includes("Transaktionsfehler")
  );

  mockDb.runTransaction = originalRunTransaction;

  const dlqEntries = Object.values(mockDbState["failed_operations"] || {});
  assert.strictEqual(dlqEntries.length, 1);
  const dlqEntry = dlqEntries[0] as any;
  assert.strictEqual(dlqEntry.operationId, "pi_test_dlq_token");
  assert.strictEqual(dlqEntry.userId, "user1");
  assert.strictEqual(dlqEntry.source, "secureJoinPaidActivity");
  assert.strictEqual(dlqEntry.errorMessage, "Simulated Firestore Failure");

  // Test Case K: Wrong metadata, currency, amount, and failed payment
  resetMockDb();
  mockDbState["activities"] = {
    paid_act: { status: "active", isPaid: true, price: 15.0, hostId: "host1", participantIds: [] }
  };
  
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "paid_act", transactionToken: "pi_failed" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("Zahlung nicht erfolgreich")
  );
  
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "paid_act", transactionToken: "pi_wrong_currency" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("Zahlungswährung")
  );
  
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "paid_act", transactionToken: "pi_wrong_amount" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("Zahlungsbetrag")
  );
  
  await assert.rejects(
    (secureJoinPaidActivity as any)({ activityId: "paid_act", transactionToken: "pi_wrong_metadata" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("Aktivitäts-ID")
  );

  console.log("✅ testSecureJoinPaidActivity passed");
}

// 4. Test secureRequestPayout HTTPS Callable
async function testSecureRequestPayout() {
  console.log("Running testSecureRequestPayout...");

  // Test Case A: unauthenticated request
  resetMockDb();
  await assert.rejects(
    (secureRequestPayout as any)({ amount: 60.0, operationId: "op1" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // Test Case B: missing operationId
  await assert.rejects(
    (secureRequestPayout as any)({ amount: 60.0 }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // Test Case C: user not found
  await assert.rejects(
    (secureRequestPayout as any)({ amount: 60.0, operationId: "op1" }, { uid: "missing_user" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found"
  );

  // Test Case D: KYC status not verified
  mockDbState["users"] = {
    user1: { kycStatus: "pending", fiatBalance: 10000, escrowBalance: 0, balancesInCents: true }
  };
  await assert.rejects(
    (secureRequestPayout as any)({ amount: 60.0, operationId: "op1" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("KYC")
  );

  // Test Case E: amount below minimum (minimum is 50.00 EUR = 5000 cents)
  mockDbState["users"]["user1"].kycStatus = "verified";
  await assert.rejects(
    (secureRequestPayout as any)({ amount: 49.99, operationId: "op1" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("50,00")
  );

  // Test Case F: insufficient fiat balance
  await assert.rejects(
    (secureRequestPayout as any)({ amount: 150.0, operationId: "op1" }, { uid: "user1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("Ungenügendes Guthaben")
  );

  // Test Case G: valid payout request
  const validResult = await (secureRequestPayout as any)({ amount: 60.0, operationId: "op_valid" }, { uid: "user1" });
  assert.ok(validResult.success);
  assert.ok(validResult.payoutRequestId);

  // Verify user fiat balance reduced: 10000 - 6000 = 4000 cents
  const updatedUser = mockDbState["users"]["user1"];
  assert.strictEqual(updatedUser.fiatBalance, 4000);

  // Verify payoutRequest document was created
  const reqId = validResult.payoutRequestId;
  const payoutReq = mockDbState["payoutRequests"][reqId];
  assert.ok(payoutReq);
  assert.strictEqual(payoutReq.userId, "user1");
  assert.strictEqual(payoutReq.amount, 60.0);
  assert.strictEqual(payoutReq.amountCents, 6000);
  assert.strictEqual(payoutReq.status, "pending");

  // Verify ledger entry created
  const ledgerEntries = Object.values(mockDbState["financial_ledger"] || {});
  assert.strictEqual(ledgerEntries.length, 1);
  const entry = ledgerEntries[0] as any;
  assert.strictEqual(entry.operationType, "payout_request");
  assert.strictEqual(entry.amountCents, 6000);
  assert.strictEqual(entry.fromUser, "user1");
  assert.strictEqual(entry.toUser, "system");

  // Test Case H: idempotency on duplicate operationId
  const dupResult = await (secureRequestPayout as any)({ amount: 60.0, operationId: "op_valid" }, { uid: "user1" });
  assert.deepStrictEqual(dupResult, { success: true, duplicated: true });

  console.log("✅ testSecureRequestPayout passed");
}

// 5. Test secureCompleteActivity HTTPS Callable
async function testSecureCompleteActivity() {
  console.log("Running testSecureCompleteActivity...");

  // Test Case A: rejects unauthenticated request
  resetMockDb();
  await assert.rejects(
    (secureCompleteActivity as any)({ activityId: "act1", operationId: "op1" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // Test Case B: rejects missing required arguments
  await assert.rejects(
    (secureCompleteActivity as any)({ activityId: "act1" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // Test Case C: rejects non-existent activity
  await assert.rejects(
    (secureCompleteActivity as any)({ activityId: "missing_act", operationId: "op1" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found" && err.message.includes("Aktivität nicht gefunden")
  );

  // Test Case D: rejects non-host caller
  mockDbState["activities"] = {
    act1: { status: "active", isPaid: true, hostId: "host1", participantIds: ["host1", "user2"] }
  };
  await assert.rejects(
    (secureCompleteActivity as any)({ activityId: "act1", operationId: "op1" }, { uid: "user2" }),
    (err: any) => err.name === "HttpsError" && err.code === "permission-denied"
  );

  // Test Case E1: already completed activity is idempotent or safely no-op success
  mockDbState["activities"] = {
    act1: { status: "completed", isPaid: true, hostId: "host1", participantIds: ["host1", "user2"] }
  };
  const compResult = await (secureCompleteActivity as any)({ activityId: "act1", operationId: "op1" }, { uid: "host1" });
  assert.deepStrictEqual(compResult, { success: true, message: "Aktivität bereits abgeschlossen." });

  // Test Case E2: cancelled activity rejects
  mockDbState["activities"] = {
    act1: { status: "cancelled", isPaid: true, hostId: "host1", participantIds: ["host1", "user2"] }
  };
  await assert.rejects(
    (secureCompleteActivity as any)({ activityId: "act1", operationId: "op1" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("bereits storniert")
  );

  // Test Case F: paid activity escrow release math is correct
  resetMockDb();
  mockDbState["activities"] = {
    act1: { status: "active", isPaid: true, price: 20.0, hostId: "host1", participantIds: ["host1", "user2", "user3"], placeId: "place1" }
  };
  mockDbState["users"] = {
    host1: { fiatBalance: 100.0, escrowBalance: 50.0, balancesInCents: false }
  };
  mockDbState["places"] = {
    place1: { activityCount: 5 }
  };
  
  // payingParticipants = user2, user3 (length = 2)
  // priceCents = 2000. 90% of priceCents = 1800.
  // releaseAmountCents = 2 * 1800 = 3600 cents.
  // host has 50.0 escrow (which converts to 5000 cents).
  // escrowDeduction = min(5000, 3600) = 3600 cents.
  // newEscrow = 5000 - 3600 = 1400 cents.
  // newFiat = 10000 + 3600 = 13600 cents.
  const completeResult = await (secureCompleteActivity as any)({ activityId: "act1", operationId: "op_complete" }, { uid: "host1" });
  assert.deepStrictEqual(completeResult, { success: true });

  // verify state updates
  assert.strictEqual(mockDbState["activities"]["act1"].status, "completed");
  assert.strictEqual(mockDbState["places"]["place1"].activityCount, 4); // decremented
  assert.strictEqual(mockDbState["users"]["host1"].escrowBalance, 1400);
  assert.strictEqual(mockDbState["users"]["host1"].fiatBalance, 13600);
  assert.strictEqual(mockDbState["users"]["host1"].balancesInCents, true);

  // verify ledger entry
  const ledgerEntries = Object.values(mockDbState["financial_ledger"] || {});
  assert.strictEqual(ledgerEntries.length, 1);
  const entry = ledgerEntries[0] as any;
  assert.strictEqual(entry.operationType, "complete_activity");
  assert.strictEqual(entry.amountCents, 3600);
  assert.strictEqual(entry.fromUser, "escrow");
  assert.strictEqual(entry.toUser, "host1");
  assert.strictEqual(entry.operationId, "op_complete_release");

  // Test Case G: host escrow never becomes negative (lower-bound cap)
  resetMockDb();
  mockDbState["activities"] = {
    act1: { status: "active", isPaid: true, price: 20.0, hostId: "host1", participantIds: ["host1", "user2", "user3"] }
  };
  mockDbState["users"] = {
    host1: { fiatBalance: 100.0, escrowBalance: 20.0, balancesInCents: false }
  };
  // required release amount = 3600 cents. host escrow is 20.0 (2000 cents).
  // deduction capped at 2000 cents. newEscrow = 0, newFiat = 10000 + 2000 = 12000 cents.
  await (secureCompleteActivity as any)({ activityId: "act1", operationId: "op_cap" }, { uid: "host1" });
  assert.strictEqual(mockDbState["users"]["host1"].escrowBalance, 0);
  assert.strictEqual(mockDbState["users"]["host1"].fiatBalance, 12000);

  // Test Case H: free activity completion path follows production behavior
  resetMockDb();
  mockDbState["activities"] = {
    act1: { status: "active", isPaid: false, price: 0.0, hostId: "host1", participantIds: ["host1", "user2"] }
  };
  mockDbState["users"] = {
    host1: { successfulFreeHosts: 10 }
  };
  await (secureCompleteActivity as any)({ activityId: "act1", operationId: "op_free" }, { uid: "host1" });
  assert.strictEqual(mockDbState["users"]["host1"].successfulFreeHosts, 11);
  assert.strictEqual(Object.keys(mockDbState["financial_ledger"] || {}).length, 0); // no ledger entries

  // Test Case I: duplicate operationId is idempotent
  mockDbState["processed_operations"] = {
    op_dup: { operationType: "complete_activity" }
  };
  const dupResult = await (secureCompleteActivity as any)({ activityId: "act1", operationId: "op_dup" }, { uid: "host1" });
  assert.deepStrictEqual(dupResult, { success: true, duplicated: true });

  // Test Case J: DLQ logging occurs on transaction failure
  resetMockDb();
  mockDbState["activities"] = {
    act1: { status: "active", isPaid: true, price: 20.0, hostId: "host1", participantIds: ["host1"] }
  };
  const originalRunTransaction = mockDb.runTransaction;
  mockDb.runTransaction = async () => {
    throw new Error("Complete Failure");
  };
  await assert.rejects(
    (secureCompleteActivity as any)({ activityId: "act1", operationId: "op_fail" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "internal" && err.message.includes("Fehler beim Abschließen")
  );
  mockDb.runTransaction = originalRunTransaction;

  const dlqEntries = Object.values(mockDbState["failed_operations"] || {});
  assert.strictEqual(dlqEntries.length, 1);
  const dlqEntry = dlqEntries[0] as any;
  assert.strictEqual(dlqEntry.operationId, "op_fail");
  assert.strictEqual(dlqEntry.source, "secureCompleteActivity");
  assert.strictEqual(dlqEntry.errorMessage, "Complete Failure");

  console.log("✅ testSecureCompleteActivity passed");
}

// 6. Test secureLeaveActivity HTTPS Callable
async function testSecureLeaveActivity() {
  console.log("Running testSecureLeaveActivity...");

  // Test Case A: rejects unauthenticated/missing arguments
  resetMockDb();
  await assert.rejects(
    (secureLeaveActivity as any)({ activityId: "act1", operationId: "op1" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );
  await assert.rejects(
    (secureLeaveActivity as any)({ activityId: "act1" }, { uid: "user2" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // Test Case B: allows leaving completed/cancelled activity if user is a participant
  mockDbState["activities"] = {
    comp_act: { status: "completed", hostId: "host1", participantIds: ["host1", "user2"] },
    canc_act: { status: "cancelled", hostId: "host1", participantIds: ["host1", "user2"] }
  };
  mockDbState["chats"] = {
    comp_act: { participantIds: ["host1", "user2"] },
    canc_act: { participantIds: ["host1", "user2"] }
  };

  const leaveCompResult = await (secureLeaveActivity as any)(
    { activityId: "comp_act", operationId: "op_comp_leave" },
    { uid: "user2" }
  );
  assert.deepStrictEqual(leaveCompResult, { success: true });
  assert.deepStrictEqual(mockDbState["activities"]["comp_act"].participantIds, ["host1"]);

  const leaveCancResult = await (secureLeaveActivity as any)(
    { activityId: "canc_act", operationId: "op_canc_leave" },
    { uid: "user2" }
  );
  assert.deepStrictEqual(leaveCancResult, { success: true });
  assert.deepStrictEqual(mockDbState["activities"]["canc_act"].participantIds, ["host1"]);

  // Test Case C: rejects user not in participants
  mockDbState["activities"] = {
    act1: { status: "active", hostId: "host1", participantIds: ["host1", "user2"] }
  };
  await assert.rejects(
    (secureLeaveActivity as any)({ activityId: "act1", operationId: "op1" }, { uid: "user3" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found" && err.message.includes("kein Teilnehmer")
  );

  // Test Case D: host leaving own activity (host transfer)
  mockDbState["users"] = {
    user2: { displayName: "User 2 New Host", photoURL: "http://photo.url" }
  };
  mockDbState["chats"] = {
    act1: { participantIds: ["host1", "user2"], participantDetails: { host1: {}, user2: {} } }
  };
  const hostLeaveResult = await (secureLeaveActivity as any)(
    { activityId: "act1", operationId: "op_host_leave" },
    { uid: "host1" }
  );
  assert.deepStrictEqual(hostLeaveResult, { success: true });
  assert.strictEqual(mockDbState["activities"]["act1"].hostId, "user2");
  assert.strictEqual(mockDbState["activities"]["act1"].hostName, "User 2 New Host");
  assert.strictEqual(mockDbState["activities"]["act1"].hostPhotoURL, "http://photo.url");
  assert.strictEqual(mockDbState["chats"]["act1"].hostId, "user2");
  assert.strictEqual(mockDbState["chats"]["act1"].hostName, "User 2 New Host");
  assert.strictEqual(mockDbState["chats"]["act1"].hostPhotoURL, "http://photo.url");

  // Test Case E: free activity leave path
  resetMockDb();
  mockDbState["activities"] = {
    act1: {
      status: "active",
      isPaid: false,
      hostId: "host1",
      participantIds: ["host1", "user2"],
      participantsPreview: [{ uid: "host1" }, { uid: "user2" }],
      participantDetails: {
        host1: { displayName: "Host" },
        user2: { displayName: "User 2" }
      }
    }
  };
  mockDbState["chats"] = {
    act1: {
      participantIds: ["host1", "user2"],
      participantDetails: {
        host1: { displayName: "Host" },
        user2: { displayName: "User 2" }
      },
      unreadCount: {
        host1: 0,
        user2: 5
      }
    }
  };
  mockDbState["activities/act1/participants"] = {
    user2: { joinedAt: "some-date" }
  };

  const leaveFreeResult = await (secureLeaveActivity as any)({ activityId: "act1", operationId: "op_leave_free" }, { uid: "user2" });
  assert.deepStrictEqual(leaveFreeResult, { success: true });

  // verify state updates for free leave
  const actFree = mockDbState["activities"]["act1"];
  assert.deepStrictEqual(actFree.participantIds, ["host1"]);
  assert.deepStrictEqual(actFree.participantsPreview, [{ uid: "host1" }]);
  assert.ok(actFree.participantDetails.user2 === undefined);

  // verify chat updates
  const chatFree = mockDbState["chats"]["act1"];
  assert.deepStrictEqual(chatFree.participantIds, ["host1"]);
  assert.ok(chatFree.participantDetails.user2 === undefined);
  assert.ok(chatFree.unreadCount.user2 === undefined);

  // verify subcollection deletion
  assert.ok(mockDbState["activities/act1/participants"]["user2"] === undefined);

  // verify no ledger entry and no refund
  assert.strictEqual(Object.keys(mockDbState["refunds"] || {}).length, 0);
  assert.strictEqual(Object.keys(mockDbState["financial_ledger"] || {}).length, 0);

  // Test Case F: paid activity refund math is correct
  resetMockDb();
  mockDbState["activities"] = {
    act1: {
      status: "active",
      isPaid: true,
      price: 15.0,
      hostId: "host1",
      participantIds: ["host1", "user2"],
      participantsPreview: [{ uid: "host1" }, { uid: "user2" }],
      participantDetails: {
        host1: { displayName: "Host" },
        user2: { displayName: "User 2" }
      }
    }
  };
  mockDbState["users"] = {
    host1: { fiatBalance: 100.0, escrowBalance: 20.0, balancesInCents: false }
  };
  mockDbState["chats"] = {
    act1: { participantIds: ["host1", "user2"] }
  };

  // priceCents = 1500. netAmountCents = 1350.
  // host escrow is 20.0 (2000 cents). newHostEscrow = 2000 - 1350 = 650 cents.
  // pending refund: amount = 15.0 (float), amountCents = 1500.
  // ledger: refund_created, amountCents = 1500, from host1 to user2, status = pending, operationId = op_leave_paid_refund_user2
  const leavePaidResult = await (secureLeaveActivity as any)({ activityId: "act1", operationId: "op_leave_paid" }, { uid: "user2" });
  assert.deepStrictEqual(leavePaidResult, { success: true });

  assert.strictEqual(mockDbState["users"]["host1"].escrowBalance, 650);
  assert.strictEqual(mockDbState["users"]["host1"].balancesInCents, true);

  // refund document check
  const refunds = Object.values(mockDbState["refunds"] || {});
  assert.strictEqual(refunds.length, 1);
  const refund = refunds[0] as any;
  assert.strictEqual(refund.activityId, "act1");
  assert.strictEqual(refund.userId, "user2");
  assert.strictEqual(refund.amount, 15.0);
  assert.strictEqual(refund.amountCents, 1500);
  assert.strictEqual(refund.status, "pending");

  // ledger write check
  const ledgers = Object.values(mockDbState["financial_ledger"] || {});
  assert.strictEqual(ledgers.length, 1);
  const ledger = ledgers[0] as any;
  assert.strictEqual(ledger.operationType, "refund_created");
  assert.strictEqual(ledger.amountCents, 1500);
  assert.strictEqual(ledger.fromUser, "host1");
  assert.strictEqual(ledger.toUser, "user2");
  assert.strictEqual(ledger.status, "pending");
  assert.strictEqual(ledger.operationId, "op_leave_paid_refund_user2");

  // Test Case G: host escrow lower-bound protection (fails hard if host escrow is less than net slot refund)
  resetMockDb();
  mockDbState["activities"] = {
    act1: {
      status: "active",
      isPaid: true,
      price: 15.0,
      hostId: "host1",
      participantIds: ["host1", "user2"]
    }
  };
  mockDbState["users"] = {
    host1: { fiatBalance: 100.0, escrowBalance: 10.0, balancesInCents: false }
  };
  // host escrow is 10.0 (1000 cents). Required net refund is 1350 cents.
  // This must throw because host escrow < 1350.
  await assert.rejects(
    (secureLeaveActivity as any)({ activityId: "act1", operationId: "op_leave_insufficient" }, { uid: "user2" }),
    (err: any) => err.name === "HttpsError" && err.code === "internal" && err.message.includes("insufficient to refund")
  );

  // Test Case H: duplicate operationId is idempotent
  mockDbState["processed_operations"] = {
    op_leave_dup: { operationType: "leave_activity" }
  };
  const leaveDupResult = await (secureLeaveActivity as any)({ activityId: "act1", operationId: "op_leave_dup" }, { uid: "user2" });
  assert.deepStrictEqual(leaveDupResult, { success: true, duplicated: true });

  // Test Case I: DLQ logging occurs on transaction failure
  resetMockDb();
  mockDbState["activities"] = {
    act1: {
      status: "active",
      isPaid: true,
      price: 15.0,
      hostId: "host1",
      participantIds: ["host1", "user2"]
    }
  };
  const originalRunTransaction = mockDb.runTransaction;
  mockDb.runTransaction = async () => {
    throw new Error("Leave Failure");
  };
  await assert.rejects(
    (secureLeaveActivity as any)({ activityId: "act1", operationId: "op_leave_fail" }, { uid: "user2" }),
    (err: any) => err.name === "HttpsError" && err.code === "internal"
  );
  mockDb.runTransaction = originalRunTransaction;

  const dlqEntries = Object.values(mockDbState["failed_operations"] || {});
  assert.strictEqual(dlqEntries.length, 1);
  const dlqEntry = dlqEntries[0] as any;
  assert.strictEqual(dlqEntry.operationId, "op_leave_fail");
  assert.strictEqual(dlqEntry.source, "secureLeaveActivity");
  assert.strictEqual(dlqEntry.errorMessage, "Leave Failure");

  // Test Case J: Last participant leaves (non-host)
  resetMockDb();
  mockDbState["activities"] = {
    act1: {
      status: "active",
      hostId: "host1",
      participantIds: ["user2"],
      placeId: "place1"
    }
  };
  mockDbState["chats"] = {
    act1: {
      participantIds: ["user2"]
    }
  };
  mockDbState["places"] = {
    place1: {
      activityCount: 2
    }
  };
  mockDbState["activities/act1/participants"] = {
    user2: { joinedAt: "some-date" }
  };
  mockDbState["chats/act1/messages"] = {
    msg1: { content: "hello" }
  };

  const leaveLastResult = await (secureLeaveActivity as any)(
    { activityId: "act1", operationId: "op_leave_last" },
    { uid: "user2" }
  );
  assert.deepStrictEqual(leaveLastResult, { success: true });

  assert.ok(mockDbState["activities"]?.["act1"] === undefined);
  assert.ok(mockDbState["chats"]?.["act1"] === undefined);
  assert.ok(mockDbState["activities/act1/participants"]?.["user2"] === undefined);
  assert.ok(mockDbState["chats/act1/messages"]?.["msg1"] === undefined);
  assert.strictEqual(mockDbState["places"]["place1"].activityCount, 1);

  // Test Case K: Last participant is host
  resetMockDb();
  mockDbState["activities"] = {
    act1: {
      status: "active",
      hostId: "host1",
      participantIds: ["host1"]
    }
  };
  mockDbState["chats"] = {
    act1: {
      hostId: "host1",
      participantIds: ["host1"]
    }
  };
  mockDbState["activities/act1/participants"] = {
    host1: { joinedAt: "some-date" }
  };

  const leaveLastHostResult = await (secureLeaveActivity as any)(
    { activityId: "act1", operationId: "op_leave_last_host" },
    { uid: "host1" }
  );
  assert.deepStrictEqual(leaveLastHostResult, { success: true });

  assert.ok(mockDbState["activities"]?.["act1"] === undefined);
  assert.ok(mockDbState["chats"]?.["act1"] === undefined);
  assert.ok(mockDbState["activities/act1/participants"]?.["host1"] === undefined);

  // Test Case L: Completed status, user is last participant (Test C)
  resetMockDb();
  mockDbState["activities"] = {
    act1: {
      status: "completed",
      hostId: "host1",
      participantIds: ["user2"]
    }
  };
  mockDbState["chats"] = {
    act1: {
      participantIds: ["user2"]
    }
  };
  mockDbState["activities/act1/participants"] = {
    user2: { joinedAt: "some-date" }
  };
  mockDbState["chats/act1/messages"] = {
    msg1: { content: "hello" }
  };

  const leaveLastCompResult = await (secureLeaveActivity as any)(
    { activityId: "act1", operationId: "op_leave_last_comp" },
    { uid: "user2" }
  );
  assert.deepStrictEqual(leaveLastCompResult, { success: true });
  assert.ok(mockDbState["activities"]?.["act1"] === undefined);
  assert.ok(mockDbState["chats"]?.["act1"] === undefined);
  assert.ok(mockDbState["activities/act1/participants"]?.["user2"] === undefined);
  assert.ok(mockDbState["chats/act1/messages"]?.["msg1"] === undefined);

  // Test Case M: Cancelled status, user is last participant, place activityCount is not decremented (Test D)
  resetMockDb();
  mockDbState["activities"] = {
    act1: {
      status: "cancelled",
      hostId: "host1",
      participantIds: ["user2"],
      placeId: "place1"
    }
  };
  mockDbState["chats"] = {
    act1: {
      participantIds: ["user2"]
    }
  };
  mockDbState["places"] = {
    place1: {
      activityCount: 2
    }
  };
  mockDbState["activities/act1/participants"] = {
    user2: { joinedAt: "some-date" }
  };

  const leaveLastCancResult = await (secureLeaveActivity as any)(
    { activityId: "act1", operationId: "op_leave_last_canc" },
    { uid: "user2" }
  );
  assert.deepStrictEqual(leaveLastCancResult, { success: true });
  assert.ok(mockDbState["activities"]?.["act1"] === undefined);
  assert.ok(mockDbState["chats"]?.["act1"] === undefined);
  assert.ok(mockDbState["activities/act1/participants"]?.["user2"] === undefined);
  // Verify place count remains 2 (not decremented since activity status was already cancelled)
  assert.strictEqual(mockDbState["places"]["place1"].activityCount, 2);

  console.log("✅ testSecureLeaveActivity passed");
}

// 7. Test secureCancelActivity HTTPS Callable
async function testSecureCancelActivity() {
  console.log("Running testSecureCancelActivity...");

  // Test Case A: rejects unauthenticated requests
  resetMockDb();
  await assert.rejects(
    (secureCancelActivity as any)({ activityId: "act1", operationId: "op1" }, null),
    (err: any) => err.name === "HttpsError" && err.code === "unauthenticated"
  );

  // Test Case B: rejects missing arguments
  await assert.rejects(
    (secureCancelActivity as any)({ activityId: "act1" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "invalid-argument"
  );

  // Test Case C: rejects non-existent activity
  await assert.rejects(
    (secureCancelActivity as any)({ activityId: "missing_act", operationId: "op1" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "not-found" && err.message.includes("Aktivität nicht gefunden")
  );

  // Test Case D: rejects non-host caller
  mockDbState["activities"] = {
    act1: { status: "active", hostId: "host1", participantIds: ["host1", "user2"] }
  };
  await assert.rejects(
    (secureCancelActivity as any)({ activityId: "act1", operationId: "op1" }, { uid: "user2" }),
    (err: any) => err.name === "HttpsError" && err.code === "permission-denied"
  );

  // Test Case E: already cancelled activity returns early success
  mockDbState["activities"] = {
    act1: { status: "cancelled", hostId: "host1", participantIds: ["host1", "user2"] }
  };
  const cancelDupStateResult = await (secureCancelActivity as any)({ activityId: "act1", operationId: "op1" }, { uid: "host1" });
  assert.deepStrictEqual(cancelDupStateResult, { success: true, message: "Aktivität bereits storniert." });

  // Test Case F: already completed activity rejects with failed-precondition
  mockDbState["activities"] = {
    act1: { status: "completed", hostId: "host1", participantIds: ["host1", "user2"] }
  };
  await assert.rejects(
    (secureCancelActivity as any)({ activityId: "act1", operationId: "op1" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "failed-precondition" && err.message.includes("bereits abgeschlossen")
  );

  // Test Case G: free activity cancellation flow
  resetMockDb();
  mockDbState["activities"] = {
    act1: { status: "active", isPaid: false, price: 0.0, hostId: "host1", participantIds: ["host1", "user2"], placeId: "place1" }
  };
  mockDbState["places"] = {
    place1: { activityCount: 3 }
  };
  const cancelFreeResult = await (secureCancelActivity as any)({ activityId: "act1", operationId: "op_cancel_free" }, { uid: "host1" });
  assert.deepStrictEqual(cancelFreeResult, { success: true });
  assert.strictEqual(mockDbState["activities"]["act1"].status, "cancelled");
  assert.strictEqual(mockDbState["places"]["place1"].activityCount, 2);
  // Free activities do not write refund documents or ledger entries
  assert.strictEqual(Object.keys(mockDbState["refunds"] || {}).length, 0);
  assert.strictEqual(Object.keys(mockDbState["financial_ledger"] || {}).length, 0);

  // Test Case H & I & J (part 1) & K: paid activity cancellation refund math, host self-refund prevention
  resetMockDb();
  mockDbState["activities"] = {
    act1: { status: "active", isPaid: true, price: 20.0, hostId: "host1", participantIds: ["host1", "user2", "user3"] }
  };
  mockDbState["users"] = {
    host1: { fiatBalance: 100.0, escrowBalance: 50.0, balancesInCents: false }
  };

  // payingParticipants = user2, user3 (length = 2)
  // priceCents = 2000. netPerParticipant = 1800.
  // total escrowDeduction = 2 * 1800 = 3600 cents.
  // host escrow balance starts at 50.0 (5000 cents).
  // host escrow final = 5000 - 3600 = 1400 cents.
  const cancelPaidResult = await (secureCancelActivity as any)({ activityId: "act1", operationId: "op_cancel_paid" }, { uid: "host1" });
  assert.deepStrictEqual(cancelPaidResult, { success: true });
  assert.strictEqual(mockDbState["activities"]["act1"].status, "cancelled");
  assert.strictEqual(mockDbState["users"]["host1"].escrowBalance, 1400);
  assert.strictEqual(mockDbState["users"]["host1"].balancesInCents, true);

  // refund documents check: created ONLY for user2, user3. NOT host1.
  const refunds = Object.values(mockDbState["refunds"] || {});
  assert.strictEqual(refunds.length, 2);
  // Verify host did not receive refund
  assert.ok(refunds.every((r: any) => r.userId !== "host1"));
  
  const refundUser2 = refunds.find((r: any) => r.userId === "user2") as any;
  assert.ok(refundUser2);
  assert.strictEqual(refundUser2.amount, 20.0); // Full slot price
  assert.strictEqual(refundUser2.amountCents, 2000);
  assert.strictEqual(refundUser2.status, "pending");

  const refundUser3 = refunds.find((r: any) => r.userId === "user3") as any;
  assert.ok(refundUser3);
  assert.strictEqual(refundUser3.amount, 20.0);
  assert.strictEqual(refundUser3.amountCents, 2000);

  // ledger write check: created ONLY for user2, user3. NOT host1.
  const ledgers = Object.values(mockDbState["financial_ledger"] || {});
  assert.strictEqual(ledgers.length, 2);
  assert.ok(ledgers.every((l: any) => l.toUser !== "host1"));
  
  const ledgerUser2 = ledgers.find((l: any) => l.toUser === "user2") as any;
  assert.ok(ledgerUser2);
  assert.strictEqual(ledgerUser2.operationType, "refund_created");
  assert.strictEqual(ledgerUser2.amountCents, 2000); // Full slot price
  assert.strictEqual(ledgerUser2.fromUser, "host1");
  assert.strictEqual(ledgerUser2.status, "pending");
  assert.strictEqual(ledgerUser2.operationId, "op_cancel_paid_refund_user2");

  // Test Case J (part 2): host escrow lower-bound soft capping behavior
  resetMockDb();
  mockDbState["activities"] = {
    act1: { status: "active", isPaid: true, price: 20.0, hostId: "host1", participantIds: ["host1", "user2", "user3"] }
  };
  mockDbState["users"] = {
    host1: { fiatBalance: 100.0, escrowBalance: 20.0, balancesInCents: false }
  };

  // total escrowDeduction = 3600 cents. host escrow starts at 20.0 (2000 cents).
  // host escrow should cap at 0 instead of throwing an error or going negative.
  // Verify refund documents are still created for full amounts.
  // Verify whether any deficit is tracked or recorded anywhere (no deficit fields in production code).
  await (secureCancelActivity as any)({ activityId: "act1", operationId: "op_cancel_softcap" }, { uid: "host1" });
  assert.strictEqual(mockDbState["users"]["host1"].escrowBalance, 0); // Capped at 0
  assert.strictEqual(mockDbState["users"]["host1"].balancesInCents, true);

  const softcapRefunds = Object.values(mockDbState["refunds"] || {});
  assert.strictEqual(softcapRefunds.length, 2);
  // Full slot price (€20.00 / 2000 cents) is still refunded despite host escrow deficiency!
  assert.strictEqual(softcapRefunds[0].amount, 20.0);
  assert.strictEqual(softcapRefunds[0].amountCents, 2000);
  assert.strictEqual(softcapRefunds[1].amount, 20.0);
  assert.strictEqual(softcapRefunds[1].amountCents, 2000);

  // Verify that NO deficit is written to any collections (no 'deficit' field in refunds, ledger or activities)
  assert.ok(softcapRefunds.every((r: any) => r.deficit === undefined));
  assert.ok(Object.values(mockDbState["financial_ledger"] || {}).every((l: any) => l.deficit === undefined));

  // Test Case K: duplicate operationId is idempotent
  mockDbState["processed_operations"] = {
    op_cancel_dup: { operationType: "cancel_activity" }
  };
  const cancelDupResult = await (secureCancelActivity as any)({ activityId: "act1", operationId: "op_cancel_dup" }, { uid: "host1" });
  assert.deepStrictEqual(cancelDupResult, { success: true, duplicated: true });

  // Test Case L: DLQ logging on transaction failure
  resetMockDb();
  mockDbState["activities"] = {
    act1: { status: "active", isPaid: true, price: 20.0, hostId: "host1", participantIds: ["host1"] }
  };
  const originalRunTransaction = mockDb.runTransaction;
  mockDb.runTransaction = async () => {
    throw new Error("Cancel Failure");
  };
  await assert.rejects(
    (secureCancelActivity as any)({ activityId: "act1", operationId: "op_cancel_fail" }, { uid: "host1" }),
    (err: any) => err.name === "HttpsError" && err.code === "internal"
  );
  mockDb.runTransaction = originalRunTransaction;

  const dlqEntries = Object.values(mockDbState["failed_operations"] || {});
  assert.strictEqual(dlqEntries.length, 1);
  const dlqEntry = dlqEntries[0] as any;
  assert.strictEqual(dlqEntry.operationId, "op_cancel_fail");
  assert.strictEqual(dlqEntry.source, "secureCancelActivity");
  assert.strictEqual(dlqEntry.errorMessage, "Cancel Failure");

  console.log("✅ testSecureCancelActivity passed");
}

// ─── RUNNER ──────────────────────────────────────────────────────────────────

async function runAllTests() {
  try {
    testGetUserBalancesInCents();
    testAssertBalanceInvariants();
    await testSecureJoinPaidActivity();
    await testSecureRequestPayout();
    await testSecureCompleteActivity();
    await testSecureLeaveActivity();
    await testSecureCancelActivity();
    console.log("🎉 ALL PHASE 1, 2A & 2B PAYMENTS TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (error) {
    console.error("❌ TEST RUNNER FAILED:", error);
    process.exit(1);
  }
}

runAllTests();

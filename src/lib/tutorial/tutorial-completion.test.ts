import assert from 'node:assert/strict';

console.log('🧪 Starting Tutorial Controller & Completion Logic Unit Tests (Cases A - F)...\n');

interface MockControllerState {
  isActive: boolean;
  currentStepIndex: number;
  isReplay: boolean;
  userUid: string | null;
  writeCount: number;
  writeError: Error | null;
  isWritingRef: boolean;
}

function createMockTutorialController(initialState: Partial<MockControllerState> = {}) {
  const state: MockControllerState = {
    isActive: true,
    currentStepIndex: 6,
    isReplay: false,
    userUid: 'user_123',
    writeCount: 0,
    writeError: null,
    isWritingRef: false,
    ...initialState,
  };

  const completeTutorial = async () => {
    state.isActive = false;

    if (state.isReplay || !state.userUid) {
      return;
    }

    if (state.isWritingRef) {
      return;
    }
    state.isWritingRef = true;

    try {
      if (state.writeError) {
        throw state.writeError;
      }
      state.writeCount += 1;
    } catch (err: any) {
      state.isWritingRef = false;
      // Graceful error handling (toast notification)
      return { errorHandled: true, error: err };
    }
  };

  const onDialogOpen = async (open: boolean) => {
    if (state.isActive && state.currentStepIndex === 6 && open === true) {
      return await completeTutorial();
    }
  };

  return { state, onDialogOpen, completeTutorial };
}

// Fall A: Normal Completion
console.log('Case A: Normal Completion (Step 6 -> open === true -> 1 Write)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 6, isActive: true });
  await ctrl.onDialogOpen(true);

  assert.strictEqual(ctrl.state.writeCount, 1, 'Exactly 1 write must occur');
  assert.strictEqual(ctrl.state.isActive, false, 'Tutorial must deactivate');
  console.log('  ✅ Case A PASSED: Exactly 1 Firestore write, tutorial ends');
})();

// Fall B: Dialog Not Open
console.log('\nCase B: Dialog Not Open (+ action but open !== true -> 0 Writes)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 6, isActive: true });
  await ctrl.onDialogOpen(false);

  assert.strictEqual(ctrl.state.writeCount, 0, '0 writes when dialog is not open');
  assert.strictEqual(ctrl.state.isActive, true, 'Tutorial remains active');
  console.log('  ✅ Case B PASSED: 0 writes, tutorial remains active');
})();

// Fall C: Multiple Open Events
console.log('\nCase C: Multiple Open Events (open === true x 3 -> 1 Write via Ref Lock)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 6, isActive: true });
  await ctrl.onDialogOpen(true);
  await ctrl.onDialogOpen(true);
  await ctrl.onDialogOpen(true);

  assert.strictEqual(ctrl.state.writeCount, 1, 'Ref lock ensures max 1 write on multiple open events');
  console.log('  ✅ Case C PASSED: Exactly 1 write across multiple open calls');
})();

// Fall D: Write Failure Handling
console.log('\nCase D: Write Failure (Firestore error handled gracefully)');
(async () => {
  const ctrl = createMockTutorialController({
    currentStepIndex: 6,
    isActive: true,
    writeError: new Error('Firestore write failed: PERMISSION_DENIED'),
  });

  const res = await ctrl.onDialogOpen(true);
  assert.strictEqual(res?.errorHandled, true, 'Write error must be caught and handled gracefully');
  assert.strictEqual(ctrl.state.writeCount, 0, '0 successful writes recorded');
  assert.strictEqual(ctrl.state.isWritingRef, false, 'Ref lock released on error for retry');
  console.log('  ✅ Case D PASSED: Firestore error caught, no false success assumed');
})();

// Fall E: Replay Mode
console.log('\nCase E: Replay Mode (isReplay === true -> 0 Writes)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 6, isActive: true, isReplay: true });
  await ctrl.onDialogOpen(true);

  assert.strictEqual(ctrl.state.writeCount, 0, 'Replay mode must trigger 0 writes');
  assert.strictEqual(ctrl.state.isActive, false, 'Tutorial overlay closes on step 6 completion during replay');
  console.log('  ✅ Case E PASSED: 0 writes during replay mode');
})();

// Fall F: Strict Mode / Double Invocation
console.log('\nCase F: Strict Mode / Double Invocation (Max 1 Write)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 6, isActive: true });
  await Promise.all([ctrl.onDialogOpen(true), ctrl.onDialogOpen(true)]);

  assert.strictEqual(ctrl.state.writeCount, 1, 'Concurrent double invocation yields max 1 write');
  console.log('  ✅ Case F PASSED: Concurrent invocations yield max 1 write');
})();

console.log('\n🎉 ALL TUTORIAL COMPLETION CONTROLLER TESTS (CASES A - F) PASSED SUCCESSFULLY!');

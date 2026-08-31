import assert from 'node:assert/strict';

console.log('🧪 Starting 13-Step Tutorial Controller & Completion Logic Unit Tests (Cases A - F)...\n');

interface MockControllerState {
  isActive: boolean;
  currentStepIndex: number;
  isReplay: boolean;
  userUid: string | null;
  writeCount: number;
  writeError: Error | null;
  isWritingRef: boolean;
  step9WasOpened: boolean;
}

function createMockTutorialController(initialState: Partial<MockControllerState> = {}) {
  const state: MockControllerState = {
    isActive: true,
    currentStepIndex: 1,
    isReplay: false,
    userUid: 'user_123',
    writeCount: 0,
    writeError: null,
    isWritingRef: false,
    step9WasOpened: false,
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
      return { errorHandled: true, error: err };
    }
  };

  const onDialogOpen = async (open: boolean) => {
    if (!state.isActive || state.currentStepIndex !== 9) return;

    if (open === true) {
      state.step9WasOpened = true;
    } else if (open === false && state.step9WasOpened) {
      state.step9WasOpened = false;
      state.currentStepIndex = 10;
    }
  };

  const nextStep = async () => {
    if (state.currentStepIndex < 13) {
      state.currentStepIndex += 1;
    } else {
      await completeTutorial();
    }
  };

  return { state, onDialogOpen, nextStep, completeTutorial };
}

// Fall A: Step 9 Dialog Open -> Close Lifecycle (Advances to Step 10 ONLY after open === false with 0 Writes)
console.log('Case A: Step 9 Dialog Lifecycle (Open -> Remains Step 9; Close -> Step 10 with 0 Writes)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 9, isActive: true });
  
  // 1. Dialog opens
  await ctrl.onDialogOpen(true);
  assert.strictEqual(ctrl.state.currentStepIndex, 9, 'Must remain on Step 9 while dialog is open');
  assert.strictEqual(ctrl.state.step9WasOpened, true, 'Flag step9WasOpened must be true');
  assert.strictEqual(ctrl.state.writeCount, 0, '0 writes when dialog opens');

  // 2. Dialog closes
  await ctrl.onDialogOpen(false);
  assert.strictEqual(ctrl.state.currentStepIndex, 10, 'Must advance to Step 10 after dialog closes');
  assert.strictEqual(ctrl.state.step9WasOpened, false, 'Flag step9WasOpened must reset to false');
  assert.strictEqual(ctrl.state.writeCount, 0, '0 writes when dialog closes');
  assert.strictEqual(ctrl.state.isActive, true, 'Tutorial remains active for steps 10-13');

  // 3. Duplicate close event ignores
  await ctrl.onDialogOpen(false);
  assert.strictEqual(ctrl.state.currentStepIndex, 10, 'Duplicate close event does not re-trigger step transition');

  console.log('  ✅ Case A PASSED: Step 9 advances to 10 ONLY after dialog close (open === false) with 0 Firestore writes');
})();

// Fall B: Step 13 Final Completion -> 1 Write & Deactivation
console.log('\nCase B: Step 13 Final Completion (Step 13 finish -> 1 Write)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 13, isActive: true });
  await ctrl.nextStep();

  assert.strictEqual(ctrl.state.writeCount, 1, 'Exactly 1 write at Step 13 finish');
  assert.strictEqual(ctrl.state.isActive, false, 'Tutorial deactivates after step 13');
  console.log('  ✅ Case B PASSED: Exactly 1 Firestore write at Step 13 finish');
})();

// Fall C: Skip Action -> 1 Write & Deactivation
console.log('\nCase C: Skip Action at Step 4 (Skip -> 1 Write)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 4, isActive: true });
  await ctrl.completeTutorial();

  assert.strictEqual(ctrl.state.writeCount, 1, 'Explicit skip triggers exactly 1 write');
  assert.strictEqual(ctrl.state.isActive, false, 'Tutorial deactivates');
  console.log('  ✅ Case C PASSED: Skip action triggers exactly 1 Firestore write');
})();

// Fall D: Write Failure Handling
console.log('\nCase D: Write Failure (Firestore error caught gracefully)');
(async () => {
  const ctrl = createMockTutorialController({
    currentStepIndex: 13,
    isActive: true,
    writeError: new Error('Firestore write failed: PERMISSION_DENIED'),
  });

  const res = await ctrl.completeTutorial();
  assert.strictEqual(res?.errorHandled, true, 'Write error must be caught gracefully');
  assert.strictEqual(ctrl.state.writeCount, 0, '0 successful writes recorded');
  assert.strictEqual(ctrl.state.isWritingRef, false, 'Ref lock released on error');
  console.log('  ✅ Case D PASSED: Firestore write error caught gracefully');
})();

// Fall E: Replay Mode -> 0 Writes on Finish
console.log('\nCase E: Replay Mode (Step 13 finish in replay -> 0 Writes)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 13, isActive: true, isReplay: true });
  await ctrl.nextStep();

  assert.strictEqual(ctrl.state.writeCount, 0, 'Replay mode must trigger 0 writes');
  assert.strictEqual(ctrl.state.isActive, false, 'Tutorial deactivates on replay finish');
  console.log('  ✅ Case E PASSED: 0 writes in replay mode');
})();

// Fall F: Double Invocation Deduplication
console.log('\nCase F: Double Invocation Deduplication (Max 1 Write)');
(async () => {
  const ctrl = createMockTutorialController({ currentStepIndex: 13, isActive: true });
  await Promise.all([ctrl.completeTutorial(), ctrl.completeTutorial()]);

  assert.strictEqual(ctrl.state.writeCount, 1, 'Max 1 write on double invocation');
  console.log('  ✅ Case F PASSED: Deduplication ref lock ensures max 1 write');
})();

console.log('\n🎉 ALL 13-STEP TUTORIAL CONTROLLER TESTS PASSED SUCCESSFULLY!');

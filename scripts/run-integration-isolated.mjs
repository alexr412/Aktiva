import { spawn } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);

export const FORBIDDEN_PATTERNS = [
  'secretmanager.googleapis.com',
  'generativelanguage.googleapis.com',
  'api.geoapify.com',
  'API key not valid',
  'Unable to access secret environment variables',
];

/**
 * Resolves the project-local firebase-tools entry point.
 * Fail-Closed: Exits immediately with exit code 1 if the local entry point cannot be resolved.
 * @returns {string}
 */
export function getLocalFirebaseCliPath() {
  try {
    const entryPath = require.resolve('firebase-tools/lib/bin/firebase.js');
    if (!entryPath || !fs.existsSync(entryPath)) {
      throw new Error(`Resolved path does not exist on disk: ${entryPath}`);
    }
    return entryPath;
  } catch (err) {
    console.error('\n❌ FAIL-CLOSED ERROR: Local firebase-tools entry point could not be resolved!');
    console.error('Details:', err instanceof Error ? err.message : String(err));
    console.error('Ensure firebase-tools is installed as a root devDependency in node_modules.');
    process.exit(1);
  }
}

/**
 * Pure function that checks full log output for forbidden external endpoints or secret error strings.
 * @param {string} fullLogOutput
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function checkLogsForForbiddenPatterns(fullLogOutput) {
  const violations = [];
  if (typeof fullLogOutput !== 'string') {
    return { valid: true, violations };
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (fullLogOutput.includes(pattern)) {
      violations.push(pattern);
    }
  }
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Self-test suite verifying the pure log checker function and fail-closed CLI resolution without network activity.
 */
export function runSelfTest() {
  console.log('🧪 Running Log Guard Self-Test...');

  // 1. Verify fail-closed CLI resolution
  const cliPath = getLocalFirebaseCliPath();
  console.log(`📌 Self-test resolved local Firebase CLI: ${cliPath}`);

  // 2. Harmless emulator output must pass
  const harmlessLog = `
i  emulators: Starting emulators: auth, functions, firestore
i  functions: Loaded environment variables from functions\\.env
Signed in as emulator test user: user_integration_test_12345
✅ Test 1: Custom Activity Creation PASSED
🎉 ALL INTEGRATION TESTS PASSED CLEANLY!
`;
  const harmlessResult = checkLogsForForbiddenPatterns(harmlessLog);
  if (!harmlessResult.valid) {
    console.error('❌ Self-test failed: Harmless log was rejected:', harmlessResult.violations);
    process.exit(1);
  }

  // 3. Synthetic string with generativelanguage.googleapis.com must be rejected
  const syntheticLog = `
i  functions: Beginning execution of "us-central1-generateActivityEmbeddingOnCreate"
FetchError: request to https://generativelanguage.googleapis.com/v1beta/models failed
`;
  const syntheticResult = checkLogsForForbiddenPatterns(syntheticLog);
  if (syntheticResult.valid || !syntheticResult.violations.includes('generativelanguage.googleapis.com')) {
    console.error('❌ Self-test failed: Synthetic log containing forbidden pattern was not detected!');
    process.exit(1);
  }

  console.log('✅ Log Guard Self-Test PASSED (Local CLI resolved, harmless log accepted, synthetic forbidden log rejected with 0 network calls)!');
}

async function runIsolatedIntegration() {
  console.log('🚀 [Parent Runner] Resolving local firebase-tools entry point...');
  const firebaseCliEntry = getLocalFirebaseCliPath();
  console.log(`📌 Using project-local Firebase CLI: ${firebaseCliEntry}`);

  const nodeExec = process.execPath;
  const testCommand = `"${nodeExec}" --import tsx functions/src/activity-create.integration.test.ts`;

  const args = [
    firebaseCliEntry,
    'emulators:exec',
    '--only',
    'auth,firestore,functions',
    testCommand
  ];

  let accumulatedLogs = '';

  const child = spawn(nodeExec, args, {
    shell: false,
    cwd: process.cwd(),
    env: { ...process.env }
  });

  child.stdout?.on('data', (data) => {
    const chunk = data.toString();
    accumulatedLogs += chunk;
    process.stdout.write(chunk);
  });

  child.stderr?.on('data', (data) => {
    const chunk = data.toString();
    accumulatedLogs += chunk;
    process.stderr.write(chunk);
  });

  child.on('close', (code) => {
    const exitCode = code ?? 1;
    console.log('\n🔍 [Parent Runner Log Guard] Analyzing full Firebase CLI & Emulator log output...');

    const logCheck = checkLogsForForbiddenPatterns(accumulatedLogs);

    if (!logCheck.valid) {
      console.error('\n❌ LOG GUARD FAILURE: Forbidden external endpoint or secret error detected in Firebase CLI output!');
      console.error('Detected forbidden patterns:', logCheck.violations.join(', '));
      process.exit(1);
    }

    if (exitCode !== 0) {
      console.error(`\n❌ Integration test failed with exit code ${exitCode}`);
      process.exit(exitCode);
    }

    console.log('✅ LOG GUARD PASSED: Zero forbidden external network calls or secret errors detected in full Firebase CLI output.');
    process.exit(0);
  });

  child.on('error', (err) => {
    console.error('❌ Failed to spawn local Firebase CLI process:', err);
    process.exit(1);
  });
}

// If invoked directly with --self-test flag
if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  runIsolatedIntegration();
}

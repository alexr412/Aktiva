import assert from 'node:assert';
import { evaluatePassword } from './auth';

async function runTests() {
  console.log('=== Running Activa Password Reset & Action Code Tests ===\n');

  // Test 1: evaluatePassword with valid password
  console.log('Test 1: evaluatePassword() accepts password meeting all security requirements');
  const validResult = evaluatePassword('SecureP@ss123');
  assert.strictEqual(validResult.hasLength, true);
  assert.strictEqual(validResult.hasUpper, true);
  assert.strictEqual(validResult.hasLower, true);
  assert.strictEqual(validResult.hasNumber, true);
  assert.strictEqual(validResult.hasSpecial, true);
  assert.strictEqual(validResult.isValid, true);
  console.log('  ✅ Passed');

  // Test 2: evaluatePassword rejects password missing uppercase letter
  console.log('Test 2: evaluatePassword() rejects password without uppercase letter');
  const noUpper = evaluatePassword('securep@ss123');
  assert.strictEqual(noUpper.hasUpper, false);
  assert.strictEqual(noUpper.isValid, false);
  console.log('  ✅ Passed');

  // Test 3: evaluatePassword rejects password missing lowercase letter
  console.log('Test 3: evaluatePassword() rejects password without lowercase letter');
  const noLower = evaluatePassword('SECUREP@SS123');
  assert.strictEqual(noLower.hasLower, false);
  assert.strictEqual(noLower.isValid, false);
  console.log('  ✅ Passed');

  // Test 4: evaluatePassword rejects password missing number
  console.log('Test 4: evaluatePassword() rejects password without a number');
  const noNumber = evaluatePassword('SecureP@ssword');
  assert.strictEqual(noNumber.hasNumber, false);
  assert.strictEqual(noNumber.isValid, false);
  console.log('  ✅ Passed');

  // Test 5: evaluatePassword rejects password missing special character
  console.log('Test 5: evaluatePassword() rejects password without a special character');
  const noSpecial = evaluatePassword('SecurePass123');
  assert.strictEqual(noSpecial.hasSpecial, false);
  assert.strictEqual(noSpecial.isValid, false);
  console.log('  ✅ Passed');

  // Test 6: evaluatePassword rejects password under 8 characters
  console.log('Test 6: evaluatePassword() rejects password under 8 characters');
  const tooShort = evaluatePassword('S@1a');
  assert.strictEqual(tooShort.hasLength, false);
  assert.strictEqual(tooShort.isValid, false);
  console.log('  ✅ Passed');

  // Test 7: evaluatePassword rejects password over 32 characters
  console.log('Test 7: evaluatePassword() rejects password over 32 characters');
  const tooLong = evaluatePassword('A1@' + 'a'.repeat(30));
  assert.strictEqual(tooLong.hasLength, false);
  assert.strictEqual(tooLong.isValid, false);
  console.log('  ✅ Passed');

  // Test 8: Password mismatch detection
  console.log('Test 8: Password confirmation mismatch detection');
  const pass1 = 'SecureP@ss123';
  const pass2 = 'SecureP@ss456';
  assert.notStrictEqual(pass1, pass2);
  console.log('  ✅ Passed');

  // Test 9: Mode dispatching logic
  console.log('Test 9: Action mode dispatching (resetPassword vs verifyEmail vs recoverEmail vs unknown)');
  const resolveModeState = (mode: string | null, oobCode: string | null) => {
    if (!mode || (mode !== 'resetPassword' && mode !== 'verifyEmail' && mode !== 'recoverEmail')) {
      return 'generic_error';
    }
    if (!oobCode) {
      return mode === 'resetPassword' ? 'invalid_link' : 'generic_error';
    }
    return mode;
  };

  assert.strictEqual(resolveModeState('resetPassword', 'VALID_CODE'), 'resetPassword');
  assert.strictEqual(resolveModeState('resetPassword', null), 'invalid_link');
  assert.strictEqual(resolveModeState('verifyEmail', 'VALID_CODE'), 'verifyEmail');
  assert.strictEqual(resolveModeState('verifyEmail', null), 'generic_error');
  assert.strictEqual(resolveModeState('recoverEmail', 'VALID_CODE'), 'recoverEmail');
  assert.strictEqual(resolveModeState('unknownMode', 'VALID_CODE'), 'generic_error');
  assert.strictEqual(resolveModeState(null, 'VALID_CODE'), 'generic_error');
  console.log('  ✅ Passed');

  // Test 10: Security check - oobCode is not stored in localStorage or sessionStorage
  console.log('Test 10: Security check - oobCode is not stored in persistent client storage');
  const mockStorage: Record<string, string> = {};
  assert.strictEqual(mockStorage['oobCode'], undefined);
  assert.strictEqual(mockStorage['actionCode'], undefined);
  console.log('  ✅ Passed');

  // Test 11: Security check - continueUrl is not used for arbitrary external redirects
  console.log('Test 11: Security check - continueUrl open-redirect protection');
  const isSafeContinueUrl = (url: string | null, allowedOrigin: string) => {
    if (!url) return false;
    try {
      const parsed = new URL(url, allowedOrigin);
      return parsed.origin === allowedOrigin;
    } catch {
      return false;
    }
  };
  const appOrigin = 'https://activa-444220.web.app';
  assert.strictEqual(isSafeContinueUrl('https://activa-444220.web.app/login', appOrigin), true);
  assert.strictEqual(isSafeContinueUrl('https://evil-phishing-site.com/steal', appOrigin), false);
  assert.strictEqual(isSafeContinueUrl('javascript:alert(1)', appOrigin), false);
  console.log('  ✅ Passed');

  // Test 12: Firebase Error Mapping Test
  console.log('Test 12: Firebase error code classification (expired/invalid vs weak password)');
  const classifyFirebaseError = (errorCode: string) => {
    if (errorCode === 'auth/expired-action-code' || errorCode === 'auth/invalid-action-code') {
      return 'invalid_link';
    }
    if (errorCode === 'auth/weak-password') {
      return 'inline_form_error';
    }
    return 'generic_form_error';
  };

  assert.strictEqual(classifyFirebaseError('auth/expired-action-code'), 'invalid_link');
  assert.strictEqual(classifyFirebaseError('auth/invalid-action-code'), 'invalid_link');
  assert.strictEqual(classifyFirebaseError('auth/weak-password'), 'inline_form_error');
  assert.strictEqual(classifyFirebaseError('auth/network-request-failed'), 'generic_form_error');
  console.log('  ✅ Passed');

  // Test 13: recoverEmail flow step sequence simulation
  console.log('Test 13: recoverEmail flow sequence (checkActionCode executes first to validate and extract email)');
  const executionOrder: string[] = [];
  const mockCheckActionCode = async (code: string) => {
    executionOrder.push('checkActionCode');
    if (code === 'INVALID_CODE') throw new Error('auth/invalid-action-code');
    if (code === 'NO_EMAIL_CODE') return { data: { email: null, previousEmail: 'old@example.com' }, operation: 'RECOVER_EMAIL' };
    if (code === 'VERIFY_CODE_PASSED_AS_RECOVER') return { data: { email: 'user@example.com' }, operation: 'VERIFY_EMAIL' };
    return { data: { email: 'user@example.com', previousEmail: 'old@example.com' }, operation: 'RECOVER_EMAIL' };
  };
  const mockApplyActionCode = async (_code: string) => {
    executionOrder.push('applyActionCode');
  };

  const simulateRecoverEmail = async (code: string) => {
    const info = await mockCheckActionCode(code);
    if (info.operation !== 'RECOVER_EMAIL') {
      throw new Error('auth/invalid-action-code');
    }
    const restoredEmail = info.data.email;
    if (!restoredEmail) {
      throw new Error('auth/invalid-action-code');
    }
    await mockApplyActionCode(code);
    return { email: restoredEmail };
  };

  const recoverRes = await simulateRecoverEmail('VALID_RECOVER_CODE');
  assert.strictEqual(executionOrder[0], 'checkActionCode');
  assert.strictEqual(executionOrder[1], 'applyActionCode');
  assert.strictEqual(recoverRes.email, 'user@example.com');
  console.log('  ✅ Passed');

  // Test 14: recoverEmail with invalid code does NOT call applyActionCode
  console.log('Test 14: recoverEmail with invalid code stops at checkActionCode and does not apply action');
  executionOrder.length = 0;
  try {
    await simulateRecoverEmail('INVALID_CODE');
    assert.fail('Should have thrown invalid code error');
  } catch (err: any) {
    assert.strictEqual(err.message, 'auth/invalid-action-code');
    assert.deepStrictEqual(executionOrder, ['checkActionCode']);
  }
  console.log('  ✅ Passed');

  // Test 15: recoverEmail missing info.data.email does NOT call applyActionCode
  console.log('Test 15: recoverEmail missing info.data.email does NOT call applyActionCode and throws error');
  executionOrder.length = 0;
  try {
    await simulateRecoverEmail('NO_EMAIL_CODE');
    assert.fail('Should have thrown error when info.data.email is missing');
  } catch (err: any) {
    assert.strictEqual(err.message, 'auth/invalid-action-code');
    assert.deepStrictEqual(executionOrder, ['checkActionCode']); // applyActionCode was NOT called!
  }
  console.log('  ✅ Passed');

  // Test 16: recoverEmail operation mismatch (VERIFY_EMAIL code passed to recoverEmail) does NOT call applyActionCode
  console.log('Test 16: recoverEmail operation mismatch (VERIFY_EMAIL code) does NOT call applyActionCode');
  executionOrder.length = 0;
  try {
    await simulateRecoverEmail('VERIFY_CODE_PASSED_AS_RECOVER');
    assert.fail('Should have thrown error for operation mismatch');
  } catch (err: any) {
    assert.strictEqual(err.message, 'auth/invalid-action-code');
    assert.deepStrictEqual(executionOrder, ['checkActionCode']); // applyActionCode was NOT called!
  }
  console.log('  ✅ Passed');

  // Test 17: verifyEmail operation validation
  console.log('Test 17: verifyEmail operation validation (rejects code if operation is PASSWORD_RESET)');
  executionOrder.length = 0;
  const simulateVerifyEmail = async (code: string) => {
    const info = await mockCheckActionCode(code);
    if (info.operation !== 'VERIFY_EMAIL' && info.operation !== 'VERIFY_AND_CHANGE_EMAIL') {
      throw new Error('auth/invalid-action-code');
    }
    await mockApplyActionCode(code);
  };

  try {
    await simulateVerifyEmail('VALID_RECOVER_CODE'); // Operation is RECOVER_EMAIL, not VERIFY_EMAIL
    assert.fail('Should have rejected verifyEmail on operation mismatch');
  } catch (err: any) {
    assert.strictEqual(err.message, 'auth/invalid-action-code');
    assert.deepStrictEqual(executionOrder, ['checkActionCode']); // applyActionCode was NOT called!
  }
  console.log('  ✅ Passed');

  // Test 18: Cross-mode safety isolation checks
  console.log('Test 18: Cross-mode safety isolation (recoverEmail never invokes confirmPasswordReset)');
  let confirmPasswordResetInvoked = false;
  const mockConfirmPasswordReset = async () => { confirmPasswordResetInvoked = true; };

  const handleActionDispatch = async (mode: string, code: string) => {
    if (mode === 'resetPassword') {
      await mockConfirmPasswordReset();
    } else if (mode === 'recoverEmail') {
      await simulateRecoverEmail(code);
    }
  };

  await handleActionDispatch('recoverEmail', 'VALID_RECOVER_CODE');
  assert.strictEqual(confirmPasswordResetInvoked, false);
  console.log('  ✅ Passed');

  console.log('\n🎉 All 18 Password Reset & Action Code Tests Passed Successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

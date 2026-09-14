import { runFirestoreRulesTests } from './firestore.rules.test';
import { runStorageRulesTests } from './storage.rules.test';

async function runAllRulesTests() {
  console.log('=== STARTING ALL SECURITY RULES TEST SUITES ===\n');
  
  console.log('>>> [1/2] RUNNING FIRESTORE SECURITY RULES TESTS...');
  await runFirestoreRulesTests();
  
  console.log('\n>>> [2/2] RUNNING STORAGE SECURITY RULES TESTS...');
  await runStorageRulesTests();
  
  console.log('\n=== ALL FIRESTORE AND STORAGE SECURITY RULES TESTS COMPLETED SUCCESSFULLY! ===');
  process.exit(0);
}

runAllRulesTests().catch(err => {
  console.error('Rules test runner failed:', err);
  process.exit(1);
});

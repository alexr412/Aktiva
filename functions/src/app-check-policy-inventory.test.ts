import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * DOCUMENTED POLICY FOR CLOUD FUNCTIONS V2 APP CHECK:
 * In Cloud Functions v2, an omitted `enforceAppCheck` option in trigger options does NOT enforce App Check.
 * It resolves to `implicit_not_enforced`. App Check is ONLY enforced when `{ enforceAppCheck: true }` is explicitly provided.
 */

export type SourceHandlerType = 'callable' | 'http' | 'firestore' | 'auth' | 'scheduler';
export type DeploymentState = 'deployed' | 'source_only' | 'stale_lib_only';
export type ClientReferenceState = 'referenced' | 'not_referenced';
export type CurrentAppCheck = 'enforced' | 'explicitly_disabled' | 'implicit_not_enforced' | 'exempt';
export type TargetStage = 'C' | 'D' | 'exempt';

export interface EndpointPolicyManifestEntry {
  name: string;
  sourceHandlerType: SourceHandlerType;
  deploymentState: DeploymentState;
  clientReferenceState: ClientReferenceState;
  currentAppCheck: CurrentAppCheck;
  targetStage: TargetStage;
  description: string;
}

export const ENDPOINT_POLICY_MANIFEST: Record<string, EndpointPolicyManifestEntry> = {
  // Callables & Express Handlers (Deployed)
  triggerWeeklyReportManual: { name: 'triggerWeeklyReportManual', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to manually trigger host report' },
  getSearchVector: { name: 'getSearchVector', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable for vector embeddings search' },
  requireSocialEmailVerification: { name: 'requireSocialEmailVerification', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Callable for social email verification' },
  verifyEmailStatus: { name: 'verifyEmailStatus', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Callable for checking email verification status' },
  checkAndRecordVerificationEmail: { name: 'checkAndRecordVerificationEmail', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Callable for recording verification email' },
  cleanupEmptyChats: { name: 'cleanupEmptyChats', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Callable for empty chat cleanup' },
  applyReferralCode: { name: 'applyReferralCode', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable for applying referral code' },
  getPublicProfile: { name: 'getPublicProfile', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to fetch user public profile' },
  searchUserByUsername: { name: 'searchUserByUsername', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to search user by username' },
  checkUsernameAvailability: { name: 'checkUsernameAvailability', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to check username availability' },
  claimUsername: { name: 'claimUsername', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to claim username' },
  earnToken: { name: 'earnToken', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to earn token rewards' },
  resolveLoginIdentifier: { name: 'resolveLoginIdentifier', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to resolve login identifier' },
  secureSendFriendRequest: { name: 'secureSendFriendRequest', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to send friend request' },
  secureAcceptFriendRequest: { name: 'secureAcceptFriendRequest', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to accept friend request' },
  secureDeclineFriendRequest: { name: 'secureDeclineFriendRequest', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to decline friend request' },
  secureCancelFriendRequest: { name: 'secureCancelFriendRequest', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to cancel friend request' },
  submitCreatorApplication: { name: 'submitCreatorApplication', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to submit creator application' },
  adminListUsers: { name: 'adminListUsers', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to list users' },
  adminGetUserDetail: { name: 'adminGetUserDetail', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to get user detail' },
  adminSetUserRole: { name: 'adminSetUserRole', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to set user role' },
  adminSetOrganizerStatus: { name: 'adminSetOrganizerStatus', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to set organizer status' },
  adminSetUserPremium: { name: 'adminSetUserPremium', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to set user premium' },
  adminSuspendUser: { name: 'adminSuspendUser', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to suspend user' },
  adminUnsuspendUser: { name: 'adminUnsuspendUser', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to unsuspend user' },
  adminBanUser: { name: 'adminBanUser', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to ban user' },
  adminUnbanUser: { name: 'adminUnbanUser', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to unban user' },
  adminDeleteUser: { name: 'adminDeleteUser', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable to delete user' },
  adminBulkUpdateUsers: { name: 'adminBulkUpdateUsers', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable for bulk updating users' },
  adminBackfillUsers: { name: 'adminBackfillUsers', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Admin callable for backfilling users' },
  respondToJoinRequest: { name: 'respondToJoinRequest', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to respond to join request' },
  secureRequestJoinActivity: { name: 'secureRequestJoinActivity', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to request joining activity' },
  kickParticipant: { name: 'kickParticipant', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to kick participant' },
  secureCreateActivity: { name: 'secureCreateActivity', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'explicitly_disabled', targetStage: 'C', description: 'Callable to create activity securely (target Stage C enforcement)' },
  secureBoostEntity: { name: 'secureBoostEntity', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'explicitly_disabled', targetStage: 'C', description: 'Callable to boost entity (target Stage C enforcement)' },
  secureJoinPaidActivity: { name: 'secureJoinPaidActivity', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to join paid activity' },
  secureCompleteActivity: { name: 'secureCompleteActivity', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to complete activity' },
  secureVoteToCompleteActivity: { name: 'secureVoteToCompleteActivity', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to vote for completion' },
  secureCancelActivity: { name: 'secureCancelActivity', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to cancel activity' },
  secureRequestPayout: { name: 'secureRequestPayout', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to request payout' },
  secureLeaveActivity: { name: 'secureLeaveActivity', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to leave activity' },
  secureVotePlace: { name: 'secureVotePlace', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to vote place' },
  secureVoteActivity: { name: 'secureVoteActivity', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to vote activity' },
  sendChatMessage: { name: 'sendChatMessage', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to send chat message' },
  setRadarSettings: { name: 'setRadarSettings', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to set radar settings' },
  updateRadarLocation: { name: 'updateRadarLocation', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to update radar location' },
  disableRadar: { name: 'disableRadar', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to disable radar' },
  getNearbyFriends: { name: 'getNearbyFriends', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to get nearby friends' },
  markNotificationRead: { name: 'markNotificationRead', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to mark notification read' },
  markAllNotificationsRead: { name: 'markAllNotificationsRead', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to mark all notifications read' },
  deleteNotification: { name: 'deleteNotification', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Callable to delete notification' },
  submitSupportTicket: { name: 'submitSupportTicket', sourceHandlerType: 'callable', deploymentState: 'deployed', clientReferenceState: 'referenced', currentAppCheck: 'enforced', targetStage: 'C', description: 'Callable to submit support ticket' },

  // Non-Callable Triggers & Webhooks (Deployed)
  weeklyHostReport: { name: 'weeklyHostReport', sourceHandlerType: 'scheduler', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Scheduled weekly host report cron' },
  chatRetentionPolicy: { name: 'chatRetentionPolicy', sourceHandlerType: 'scheduler', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Scheduled chat retention cron' },
  validateCreatorStatus: { name: 'validateCreatorStatus', sourceHandlerType: 'scheduler', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Scheduled creator status validation cron' },
  telemetryAggregationWorker: { name: 'telemetryAggregationWorker', sourceHandlerType: 'scheduler', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Scheduled telemetry aggregation worker cron' },
  generateActivityEmbeddingOnCreate: { name: 'generateActivityEmbeddingOnCreate', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on activity creation' },
  generateActivityEmbeddingOnUpdate: { name: 'generateActivityEmbeddingOnUpdate', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on activity update' },
  syncUserProfileUpdates: { name: 'syncUserProfileUpdates', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on user profile update' },
  onUserCreated: { name: 'onUserCreated', sourceHandlerType: 'auth', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on user doc creation' },
  onUserDeleted: { name: 'onUserDeleted', sourceHandlerType: 'auth', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on user doc deletion' },
  onActivityCreated: { name: 'onActivityCreated', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on activity creation' },
  onActivityUpdated: { name: 'onActivityUpdated', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on activity update' },
  notifyNearbyUsers: { name: 'notifyNearbyUsers', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on activity document creation' },
  onKycRequestCreated: { name: 'onKycRequestCreated', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on KYC request creation' },
  onPayoutRequestUpdated: { name: 'onPayoutRequestUpdated', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on payout request update' },
  onRefundUpdated: { name: 'onRefundUpdated', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on refund update' },
  onChatUpdated: { name: 'onChatUpdated', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on chat update' },
  processReferralOnboardingCompletion: { name: 'processReferralOnboardingCompletion', sourceHandlerType: 'firestore', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Background trigger on user document update for referral onboarding completion' },
  revenueCatWebhook: { name: 'revenueCatWebhook', sourceHandlerType: 'http', deploymentState: 'deployed', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Server-to-server webhook endpoint for RevenueCat events' },

  // Non-deployed source functions (Source Only)
  matchContacts: { name: 'matchContacts', sourceHandlerType: 'callable', deploymentState: 'source_only', clientReferenceState: 'referenced', currentAppCheck: 'enforced', targetStage: 'C', description: 'Not currently exported in index.js' },
  getOrganizerAnalytics: { name: 'getOrganizerAnalytics', sourceHandlerType: 'callable', deploymentState: 'source_only', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Not currently exported in index.js' },
  adminListUsageStats: { name: 'adminListUsageStats', sourceHandlerType: 'callable', deploymentState: 'source_only', clientReferenceState: 'referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'D', description: 'Not currently exported in index.js' },
  sendTestNotification: { name: 'sendTestNotification', sourceHandlerType: 'callable', deploymentState: 'source_only', clientReferenceState: 'not_referenced', currentAppCheck: 'implicit_not_enforced', targetStage: 'C', description: 'Test function, intentionally not exported in index.js' },
  sendScheduledEngagementReminders: { name: 'sendScheduledEngagementReminders', sourceHandlerType: 'scheduler', deploymentState: 'source_only', clientReferenceState: 'not_referenced', currentAppCheck: 'exempt', targetStage: 'exempt', description: 'Scheduled engagement reminder cron, intentionally not exported in index.js' },
};

test('TypeScript Compiler API Endpoint Inventory & App Check Policy Parity Test', async (t) => {
  // 1. Parse functions/src/*.ts with TypeScript Compiler API
  const srcDir = path.resolve(__dirname);
  const srcExports = new Map<string, { file: string; handlerType: SourceHandlerType; enforceAppCheck: boolean | undefined }>();

  const srcFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  for (const file of srcFiles) {
    const filePath = path.join(srcDir, file);
    const code = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

    function visitSrcNode(node: ts.Node) {
      if (ts.isVariableStatement(node)) {
        const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        if (isExported) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name) && decl.initializer && ts.isCallExpression(decl.initializer)) {
              const funcName = decl.name.text;
              const callExpr = decl.initializer;

              let rawTrigger = '';
              if (ts.isIdentifier(callExpr.expression)) {
                rawTrigger = callExpr.expression.text;
              } else if (ts.isPropertyAccessExpression(callExpr.expression)) {
                rawTrigger = callExpr.expression.name.text;
              }

              let handlerType: SourceHandlerType | null = null;
              const exprText = callExpr.expression.getText(sourceFile);
              if (rawTrigger === 'onCall') handlerType = 'callable';
              else if (rawTrigger === 'onRequest') handlerType = 'http';
              else if (rawTrigger === 'onSchedule') handlerType = 'scheduler';
              else if (rawTrigger.startsWith('onDocument')) handlerType = 'firestore';
              else if (rawTrigger.startsWith('beforeUser') || rawTrigger.startsWith('onUser') || rawTrigger === 'onCreate' || rawTrigger === 'onDelete' || exprText.includes('functions.auth')) handlerType = 'auth';

              if (!handlerType) continue;

              let enforceAppCheck: boolean | undefined = undefined;
              if (callExpr.arguments.length > 0 && ts.isObjectLiteralExpression(callExpr.arguments[0])) {
                for (const prop of callExpr.arguments[0].properties) {
                  if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'enforceAppCheck') {
                    if (prop.initializer.kind === ts.SyntaxKind.FalseKeyword) enforceAppCheck = false;
                    if (prop.initializer.kind === ts.SyntaxKind.TrueKeyword) enforceAppCheck = true;
                  }
                }
              }

              srcExports.set(funcName, { file: `functions/src/${file}`, handlerType, enforceAppCheck });
            }
          }
        }
      }
      ts.forEachChild(node, visitSrcNode);
    }
    visitSrcNode(sourceFile);
  }

  // 2. Parse functions/index.js with TypeScript Compiler API (Direct Exports & Lazy Exports)
  const indexPath = path.resolve(__dirname, '../index.js');
  const indexCode = fs.readFileSync(indexPath, 'utf8');
  const indexSourceFile = ts.createSourceFile(indexPath, indexCode, ts.ScriptTarget.Latest, true);

  const indexExports = new Set<string>();

  function visitIndexNode(node: ts.Node) {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'exports') {
      const funcName = node.name.text;
      indexExports.add(funcName);

      // Check if direct export initialization uses onSchedule or onDocumentCreated
      const parent = node.parent;
      if (ts.isBinaryExpression(parent) && ts.isCallExpression(parent.right)) {
        const callExpr = parent.right;
        let rawTrigger = '';
        if (ts.isIdentifier(callExpr.expression)) {
          rawTrigger = callExpr.expression.text;
        } else if (ts.isPropertyAccessExpression(callExpr.expression)) {
          rawTrigger = callExpr.expression.name.text;
        }

        let handlerType: SourceHandlerType | null = null;
        if (rawTrigger === 'onCall') handlerType = 'callable';
        else if (rawTrigger === 'onRequest') handlerType = 'http';
        else if (rawTrigger === 'onSchedule') handlerType = 'scheduler';
        else if (rawTrigger.startsWith('onDocument')) handlerType = 'firestore';
        else if (rawTrigger.startsWith('beforeUser') || rawTrigger.startsWith('onUser')) handlerType = 'auth';

        if (handlerType) {
          srcExports.set(funcName, { file: 'functions/index.js', handlerType, enforceAppCheck: undefined });
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'lazyExport') {
      if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
        const exportName = node.arguments[0].text;
        indexExports.add(exportName);

        // If targetName alias is provided, map targetName's AST info to exportName
        if (node.arguments.length >= 3 && ts.isStringLiteral(node.arguments[2])) {
          const targetName = node.arguments[2].text;
          const targetInfo = srcExports.get(targetName);
          if (targetInfo) {
            srcExports.set(exportName, targetInfo);
          }
        }
      }
    }
    ts.forEachChild(node, visitIndexNode);
  }
  visitIndexNode(indexSourceFile);

  // 3. Scan Client httpsCallable Invocations in src/ with TypeScript Compiler API
  const clientDir = path.resolve(__dirname, '../../src');
  const clientCallables = new Set<string>();
  let hasDynamicCallable = false;

  function scanClientDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanClientDir(fullPath);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        const code = fs.readFileSync(fullPath, 'utf8');
        const sf = ts.createSourceFile(fullPath, code, ts.ScriptTarget.Latest, true);

        function visitClientNode(node: ts.Node) {
          if (ts.isCallExpression(node)) {
            let isHttpsCallable = false;
            if (ts.isIdentifier(node.expression) && node.expression.text === 'httpsCallable') {
              isHttpsCallable = true;
            } else if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'httpsCallable') {
              isHttpsCallable = true;
            }

            if (isHttpsCallable && node.arguments.length >= 2) {
              const arg1 = node.arguments[1];
              if (ts.isStringLiteral(arg1)) {
                clientCallables.add(arg1.text);
              } else {
                hasDynamicCallable = true;
              }
            }
          }
          ts.forEachChild(node, visitClientNode);
        }
        visitClientNode(sf);
      }
    }
  }
  scanClientDir(clientDir);

  await t.test('fail-closed: rejects unresolvable dynamic httpsCallable names', () => {
    assert.strictEqual(hasDynamicCallable, false, 'Client contains unresolvable dynamic httpsCallable invocation!');
  });

  await t.test('verifies bidirectional parity between AST source exports and Endpoint Policy Manifest', () => {
    const srcExportKeys = Array.from(srcExports.keys());
    const manifestKeys = Object.keys(ENDPOINT_POLICY_MANIFEST);

    const missingInManifest = srcExportKeys.filter(k => !(k in ENDPOINT_POLICY_MANIFEST));
    const extraInManifest = manifestKeys.filter(k => !srcExports.has(k));

    assert.deepStrictEqual(missingInManifest, [], `Source exports missing in manifest: ${missingInManifest.join(', ')}`);
    assert.deepStrictEqual(extraInManifest, [], `Extra manifest entries not found in source AST: ${extraInManifest.join(', ')}`);
    assert.strictEqual(srcExports.size, manifestKeys.length, 'Source AST export count does not equal manifest key count!');
  });

  await t.test('derives currentAppCheck and sourceHandlerType from AST and verifies exact parity with manifest for every single handler', () => {
    for (const [funcName, srcData] of srcExports.entries()) {
      const entry = ENDPOINT_POLICY_MANIFEST[funcName];
      assert.ok(entry !== undefined, `Missing manifest entry for ${funcName}`);

      assert.strictEqual(
        entry.sourceHandlerType,
        srcData.handlerType,
        `sourceHandlerType mismatch for '${funcName}': AST derived=${srcData.handlerType}, manifest=${entry.sourceHandlerType}`
      );

      let expectedAppCheck: CurrentAppCheck;
      if (srcData.handlerType !== 'callable') {
        expectedAppCheck = 'exempt';
      } else if (srcData.enforceAppCheck === true) {
        expectedAppCheck = 'enforced';
      } else if (srcData.enforceAppCheck === false) {
        expectedAppCheck = 'explicitly_disabled';
      } else {
        expectedAppCheck = 'implicit_not_enforced';
      }

      assert.strictEqual(
        entry.currentAppCheck,
        expectedAppCheck,
        `currentAppCheck mismatch for '${funcName}': AST derived=${expectedAppCheck}, manifest=${entry.currentAppCheck}`
      );
    }
  });

  await t.test('verifies bidirectional parity for deploymentState against functions/index.js', () => {
    for (const [funcName, entry] of Object.entries(ENDPOINT_POLICY_MANIFEST)) {
      const isExportedInIndex = indexExports.has(funcName);
      const expectedState: DeploymentState = isExportedInIndex ? 'deployed' : 'source_only';
      assert.strictEqual(
        entry.deploymentState,
        expectedState,
        `deploymentState mismatch for '${funcName}': index.js exported=${isExportedInIndex}, manifest=${entry.deploymentState}`
      );
    }

    for (const exportedName of indexExports) {
      const entry = ENDPOINT_POLICY_MANIFEST[exportedName];
      assert.ok(entry !== undefined, `Exported function '${exportedName}' in index.js is missing from manifest!`);
      assert.strictEqual(entry.deploymentState, 'deployed', `Export '${exportedName}' is in index.js but manifest state is ${entry.deploymentState}`);
    }
  });

  await t.test('verifies bidirectional parity for clientReferenceState against client httpsCallable AST scan', () => {
    for (const [funcName, entry] of Object.entries(ENDPOINT_POLICY_MANIFEST)) {
      if (entry.sourceHandlerType === 'callable') {
        const isReferencedInClient = clientCallables.has(funcName);
        const expectedRefState: ClientReferenceState = isReferencedInClient ? 'referenced' : 'not_referenced';
        assert.strictEqual(
          entry.clientReferenceState,
          expectedRefState,
          `clientReferenceState mismatch for callable '${funcName}': client AST=${isReferencedInClient}, manifest=${entry.clientReferenceState}`
        );
      }
    }

    for (const callableName of clientCallables) {
      const entry = ENDPOINT_POLICY_MANIFEST[callableName];
      assert.ok(entry !== undefined, `Client calls httpsCallable('${callableName}') but it is missing from manifest!`);
      assert.strictEqual(entry.clientReferenceState, 'referenced', `Callable '${callableName}' is invoked by client but manifest marks it as ${entry.clientReferenceState}`);
    }
  });

  await t.test('verifies exact overall App Check distribution assertion (enforced:2, explicitly_disabled:2, implicit_not_enforced:52, exempt:19, total:75)', () => {
    const counts = {
      enforced: 0,
      explicitly_disabled: 0,
      implicit_not_enforced: 0,
      exempt: 0,
    };

    const manifestEntries = Object.values(ENDPOINT_POLICY_MANIFEST);
    for (const entry of manifestEntries) {
      counts[entry.currentAppCheck]++;
    }

    assert.strictEqual(manifestEntries.length, 75, 'Total inventory count must be exactly 75');
    assert.strictEqual(counts.enforced, 2, 'Must have exactly 2 enforced handlers (submitSupportTicket, matchContacts)');
    assert.strictEqual(counts.explicitly_disabled, 2, 'Must have exactly 2 explicitly_disabled handlers (secureCreateActivity, secureBoostEntity)');
    assert.strictEqual(counts.implicit_not_enforced, 52, 'Must have exactly 52 implicit_not_enforced handlers');
    assert.strictEqual(counts.exempt, 19, 'Must have exactly 19 exempt non-callable handlers');

    // Document & assert that of the 2 enforced handlers, submitSupportTicket is deployed and matchContacts is source_only
    const submitEntry = ENDPOINT_POLICY_MANIFEST['submitSupportTicket'];
    const matchEntry = ENDPOINT_POLICY_MANIFEST['matchContacts'];
    assert.strictEqual(submitEntry.deploymentState, 'deployed', 'submitSupportTicket must be deployed');
    assert.strictEqual(matchEntry.deploymentState, 'source_only', 'matchContacts must be source_only');
  });

  await t.test('verifies exact overall Handler Type distribution assertion (callable: 56, firestore: 11, auth: 2, scheduler: 5, http: 1, total: 75)', () => {
    const counts = {
      callable: 0,
      firestore: 0,
      auth: 0,
      scheduler: 0,
      http: 0,
    };

    const manifestEntries = Object.values(ENDPOINT_POLICY_MANIFEST);
    for (const entry of manifestEntries) {
      counts[entry.sourceHandlerType]++;
    }

    assert.strictEqual(manifestEntries.length, 75, 'Total inventory count must be exactly 75');
    assert.strictEqual(counts.callable, 56, 'Must have exactly 56 callable handlers');
    assert.strictEqual(counts.firestore, 11, 'Must have exactly 11 firestore handlers');
    assert.strictEqual(counts.auth, 2, 'Must have exactly 2 auth handlers (onUserCreated, onUserDeleted)');
    assert.strictEqual(counts.scheduler, 5, 'Must have exactly 5 scheduler handlers');
    assert.strictEqual(counts.http, 1, 'Must have exactly 1 http handler');
  });
});




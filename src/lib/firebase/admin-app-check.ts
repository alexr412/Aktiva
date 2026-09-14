import { NextRequest, NextResponse } from 'next/server';
import { adminAppCheck } from './admin-server';

export interface AppCheckVerificationResult {
  valid: boolean;
  errorResponse?: NextResponse;
  reason?: 'missing' | 'invalid' | 'uninitialized' | 'config_error';
}

export interface VerifyAppCheckOptions {
  enforceOverride?: boolean;
  adminAppCheckOverride?: any;
  routeId?: string;
  logger?: {
    info: (obj: any) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * Server-side App Check Token Verifier for Next.js API Routes.
 * Supports Observation Mode (APP_CHECK_ENFORCEMENT_MODE=observe) and Fail-Closed Enforcement Mode (APP_CHECK_ENFORCEMENT_MODE=enforce).
 */
export async function verifyNextRequestAppCheck(
  req: NextRequest,
  options: VerifyAppCheckOptions = {}
): Promise<AppCheckVerificationResult> {
  const activeAdminAppCheck = options.adminAppCheckOverride !== undefined ? options.adminAppCheckOverride : adminAppCheck;
  const mode = process.env.APP_CHECK_ENFORCEMENT_MODE || 'observe';
  const logInfo = options.logger?.info || console.info;
  const logWarn = options.logger?.warn || console.warn;
  const logError = options.logger?.error || console.error;

  if (mode !== 'observe' && mode !== 'enforce') {
    logError(`[AppCheck Admin Server] Invalid APP_CHECK_ENFORCEMENT_MODE: '${mode}'`);
    const errRes = NextResponse.json(
      { error: 'Server Misconfiguration: Invalid App Check enforcement mode' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
    return { valid: false, errorResponse: errRes, reason: 'config_error' };
  }

  const shouldEnforce = options.enforceOverride !== undefined ? options.enforceOverride : (mode === 'enforce');
  const token = req.headers.get('x-firebase-appcheck');

  const route = options.routeId || 'API_UNKNOWN';

  // 1. Uninitialized Admin App Check Guard (Fail-Closed)
  if (!activeAdminAppCheck) {
    logError('[AppCheck Admin Server] Fail-Closed: Firebase Admin App Check service is not initialized');
    const errRes = NextResponse.json(
      { error: 'Service Unavailable: App Check service uninitialized' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
    return { valid: false, errorResponse: errRes, reason: 'uninitialized' };
  }

  // 2. Missing Token
  if (!token || token.trim() === '') {
    logInfo({ event: 'app_check_verification', route, status: 'missing' });
    if (shouldEnforce) {
      logWarn('[AppCheck Admin Server] Rejected request: Missing App Check token header');
      const errRes = NextResponse.json(
        { error: 'Unauthorized: Missing X-Firebase-AppCheck header' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
      return { valid: false, errorResponse: errRes, reason: 'missing' };
    }
    // Observation Mode: Log low-cardinality indicator without blocking request
    return { valid: false, reason: 'missing' };
  }

  // 3. Verify Token
  try {
    await activeAdminAppCheck.verifyToken(token);
    logInfo({ event: 'app_check_verification', route, status: 'valid' });
    return { valid: true };
  } catch (verifyErr) {
    logInfo({ event: 'app_check_verification', route, status: 'invalid' });
    if (shouldEnforce) {
      logWarn('[AppCheck Admin Server] Rejected request: Invalid or expired App Check token');
      const errRes = NextResponse.json(
        { error: 'Forbidden: App Check verification failed' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
      return { valid: false, errorResponse: errRes, reason: 'invalid' };
    }
    // Observation Mode: Log low-cardinality indicator without blocking request
    return { valid: false, reason: 'invalid' };
  }
}


import { db } from '@/lib/firebase/client';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

export interface RecordTokenUsageParams {
  uid: string;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string;
  isPremium?: boolean;
  promptTokens: number;
  completionTokens: number;
  feature?: string; // e.g. 'intent_parsing' | 'activity_generator' | 'chat_bot'
}

// Average pricing estimation per 1k tokens (Gemini / GPT-4o-mini scale)
const PROMPT_COST_PER_1K = 0.00015;
const COMPLETION_COST_PER_1K = 0.00060;

export function calculateEstimatedCost(promptTokens: number, completionTokens: number): number {
  const promptCost = (promptTokens / 1000) * PROMPT_COST_PER_1K;
  const completionCost = (completionTokens / 1000) * COMPLETION_COST_PER_1K;
  return Number((promptCost + completionCost).toFixed(6));
}

export function getCurrentYearMonth(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}_${month}`;
}

/**
 * Log or update token usage stats for a user in Firestore.
 */
export async function recordUserTokenUsage(params: RecordTokenUsageParams): Promise<void> {
  if (!db || !params.uid) return;

  try {
    const yearMonth = getCurrentYearMonth();
    const docId = `${yearMonth}_${params.uid}`;
    const usageRef = doc(db, 'user_usage', docId);

    const promptTokens = Math.max(0, params.promptTokens || 0);
    const completionTokens = Math.max(0, params.completionTokens || 0);
    const totalTokens = promptTokens + completionTokens;
    const estimatedCost = calculateEstimatedCost(promptTokens, completionTokens);

    const snap = await getDoc(usageRef);

    if (snap.exists()) {
      await updateDoc(usageRef, {
        promptTokens: increment(promptTokens),
        completionTokens: increment(completionTokens),
        totalTokens: increment(totalTokens),
        requestCount: increment(1),
        estimatedCostUsd: increment(estimatedCost),
        lastUsedAt: serverTimestamp(),
        feature: params.feature || 'ai_service',
        ...(params.displayName ? { displayName: params.displayName } : {}),
        ...(params.username ? { username: params.username } : {}),
        ...(params.email ? { email: params.email } : {}),
        ...(params.role ? { role: params.role } : {}),
        ...(params.isPremium !== undefined ? { isPremium: params.isPremium } : {}),
      });
    } else {
      await setDoc(usageRef, {
        uid: params.uid,
        yearMonth,
        displayName: params.displayName || 'Activa User',
        username: params.username || null,
        email: params.email || null,
        role: params.role || 'user',
        isPremium: params.isPremium ?? false,
        promptTokens,
        completionTokens,
        totalTokens,
        requestCount: 1,
        estimatedCostUsd: estimatedCost,
        createdAt: serverTimestamp(),
        lastUsedAt: serverTimestamp(),
        feature: params.feature || 'ai_service',
      });
    }
  } catch (err) {
    console.error('[Usage Tracker] Failed to record token usage:', err);
  }
}

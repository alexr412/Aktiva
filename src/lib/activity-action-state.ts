'use client';

export type ActivityActionStatus = 'idle' | 'submitting' | 'requested' | 'joined' | 'failed';

// Synchronous in-flight locks set
const activityInFlightLocks = new Set<string>();

// Persistent action status store by activityId
const activityStatusStore = new Map<string, ActivityActionStatus>();

/**
 * Synchronously checks if an activity action is currently in flight or locked.
 */
export function isActivityActionLocked(activityId?: string): boolean {
  if (!activityId) return false;
  return activityInFlightLocks.has(activityId);
}

/**
 * Synchronously acquires an action lock for the given activity.
 * Returns true if acquired, or false if already locked/in-flight.
 */
export function tryAcquireActivityActionLock(activityId?: string): boolean {
  if (!activityId) return false;
  if (activityInFlightLocks.has(activityId)) {
    return false;
  }
  activityInFlightLocks.add(activityId);
  return true;
}

/**
 * Releases an in-flight lock for the given activity.
 */
export function releaseActivityActionLock(activityId?: string): void {
  if (activityId) {
    activityInFlightLocks.delete(activityId);
  }
}

/**
 * Gets the current activity action status for an activity.
 */
export function getActivityActionStatus(activityId?: string): ActivityActionStatus {
  if (!activityId) return 'idle';
  return activityStatusStore.get(activityId) || 'idle';
}

/**
 * Sets the persistent activity action status.
 */
export function setActivityActionStatus(activityId: string | undefined, status: ActivityActionStatus): void {
  if (!activityId) return;
  activityStatusStore.set(activityId, status);

  if (status === 'requested' || status === 'joined') {
    // Keep locked permanently in this session so double clicks / re-clicks are blocked
    activityInFlightLocks.add(activityId);
  } else if (status === 'failed' || status === 'idle') {
    activityInFlightLocks.delete(activityId);
  }
}

/**
 * Clears all activity locks (useful for test resets).
 */
export function resetActivityActionLocks(): void {
  activityInFlightLocks.clear();
  activityStatusStore.clear();
}

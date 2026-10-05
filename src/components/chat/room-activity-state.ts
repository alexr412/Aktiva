import type { Activity } from '@/lib/types';
import { toDateObject } from '@/lib/utils';

export function hasRoomActivityEnded(activity: Activity | null, now = new Date()): boolean {
  if (!activity) return false;
  if (activity.status === 'completed') return true;
  const end = toDateObject(activity.activityEndDate);
  if (end) return end.getTime() <= now.getTime();
  const start = toDateObject(activity.activityDate);
  if (!start) return false;
  // Legacy date-only activities have no explicit end. Keep them available
  // through their final local calendar day, including daylight-saving changes.
  if (activity.isTimeFlexible) {
    const nextDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    return nextDay.getTime() <= now.getTime();
  }
  // A fixed-time activity without an end remains active on its start day.
  return start < now && start.toDateString() !== now.toDateString();
}

import type { Activity } from './types';
import { toDateObject } from './utils';

/** The shared invitation uses the complete date range and suppresses midnight for all-day plans. */
export function formatActivityInvitation(activity: Partial<Activity>, title: string, spotsLeft: number, language: string): string {
  const german = language === 'de';
  const locale = german ? 'de-DE' : 'en-GB';
  const start = toDateObject(activity.activityDate);
  const end = toDateObject(activity.activityEndDate);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  let when = '';
  if (start) {
    const first = start.toLocaleDateString(locale, options);
    const last = end?.toLocaleDateString(locale, options);
    const multipleDays = last && last !== first;
    const time = (date: Date) => date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (activity.isTimeFlexible) {
      when = `${multipleDays ? `${first} – ${last}` : first}, ${german ? 'ganztägig' : 'all day'}`;
    } else if (multipleDays && end) {
      when = `${first}, ${time(start)} – ${last}, ${time(end)}`;
    } else {
      when = `${first}, ${time(start)}${end && end.getTime() > start.getTime() ? `–${time(end)}` : ''}`;
    }
  }
  const place = activity.placeName ? `${german ? ' in' : ' at'} ${activity.placeName}` : '';
  const date = when ? `${german ? ' am' : ' on'} ${when}` : '';
  return german
    ? `Komm dazu: ${title}${place}${date}. Noch ${Math.max(0, spotsLeft)} Plätze frei.`
    : `Join us: ${title}${place}${date}. ${Math.max(0, spotsLeft)} spots left.`;
}

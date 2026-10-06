import { addDays, format, isSameDay } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import type { Activity } from '@/lib/types';

export function getPlaceActivityPreview(activity: Activity, language: string, now = new Date()) {
  const german = language === 'de';
  const start = activity.activityDate?.toDate?.();
  const end = activity.activityEndDate?.toDate?.();
  const validDate = (value: Date | undefined): value is Date => value instanceof Date && Number.isFinite(value.getTime());
  const dayLabel = (date: Date) => isSameDay(date, now)
    ? (german ? 'Heute' : 'Today')
    : isSameDay(date, addDays(now, 1))
      ? (german ? 'Morgen' : 'Tomorrow')
      : format(date, 'd. MMM', { locale: german ? de : enUS });
  let schedule = german ? 'Termin flexibel' : 'Flexible date';
  if (validDate(start)) {
    schedule = activity.isDateFlexible && validDate(end) && !isSameDay(start, end)
      ? `${dayLabel(start)} – ${dayLabel(end)}`
      : dayLabel(start);
    schedule += activity.isTimeFlexible
      ? (german ? ' · ganztägig' : ' · all day')
      : ` · ${format(start, 'HH:mm')}`;
  }
  const ids = [...new Set([activity.hostId, ...(activity.participantIds || [])].filter(Boolean))];
  const max = activity.maxParticipants;
  const seats = typeof max === 'number' && Number.isFinite(max) && max > 0
    ? Math.max(0, max - ids.length) : null;
  const availability = seats === null
    ? (german ? 'Offene Gruppe' : 'Open group')
    : german ? `${seats} ${seats === 1 ? 'Platz' : 'Plätze'} frei` : `${seats} ${seats === 1 ? 'spot' : 'spots'} left`;
  const initials = ids.slice(0, 2).flatMap(uid => {
    const name = activity.participantsPreview?.find(person => person.uid === uid)?.displayName
      || activity.participantDetails?.[uid]?.displayName
      || (uid === activity.hostId ? activity.hostName : null);
    if (!name?.trim()) return [];
    return [name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase(language)];
  });
  return {
    title: activity.title || activity.name || (german ? 'Gemeinsame Aktivität' : 'Activity together'),
    schedule,
    availability,
    initials,
  };
}

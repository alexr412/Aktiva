import type { Chat } from './types';

/** Search the same person the list displays, never the current user's own name. */
export function matchesChatSearch(chat: Chat, userId: string | undefined, query: string): boolean {
  const term = query.trim().toLocaleLowerCase().replace(/^@/, '');
  if (!term) return true;
  if (chat.activityId) return (chat.placeName || '').toLocaleLowerCase().includes(term);
  const otherId = chat.participantIds?.find(id => id !== userId);
  const username = otherId ? chat.participantDetails?.[otherId]?.username : null;
  return (username || '').toLocaleLowerCase().replace(/^@/, '').includes(term);
}

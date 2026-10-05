import type { Activity, Chat } from './types';

// Older activity chats may only contain membership data. Recover display metadata
// from the activity without changing membership or direct-message data.
export async function hydrateActivityChatMetadata(
  chat: Chat,
  readActivity: (activityId: string) => Promise<Partial<Activity> | null>,
): Promise<Chat> {
  if (!chat.activityId || (chat.placeName && (chat.placeCategories?.length || chat.categories?.length))) {
    return chat;
  }
  const activity = await readActivity(chat.activityId);
  if (!activity) return chat;
  const isPlaceBased = activity.creationSource === 'place_activity' || Boolean(activity.placeId && activity.placeId !== 'custom');
  const categories = activity.placeCategories?.length ? activity.placeCategories
    : activity.categories?.length ? activity.categories
    : activity.category ? [activity.category] : [];
  return {
    ...chat,
    placeName: chat.placeName || activity.title || activity.placeName,
    placeId: chat.placeId || activity.placeId,
    creationSource: chat.creationSource || activity.creationSource || (isPlaceBased ? 'place_activity' : 'community'),
    categories: chat.categories?.length ? chat.categories : categories,
    placeCategories: chat.placeCategories?.length ? chat.placeCategories : (isPlaceBased ? categories : []),
  };
}

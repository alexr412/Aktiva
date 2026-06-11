import { getPublicProfileClient } from "@/lib/firebase/firestore";
import type { UserProfile } from "@/lib/types";

export const fetchFriendsProfiles = async (friendIds: string[]): Promise<UserProfile[]> => {
  if (!friendIds || friendIds.length === 0) return [];

  const profiles = await Promise.all(
    friendIds.map(async (id) => {
      try {
        return await getPublicProfileClient(id);
      } catch (err) {
        console.error(`Failed to fetch friend profile ${id}:`, err);
        return null;
      }
    })
  );
  return profiles.filter((p): p is UserProfile => p !== null);
};

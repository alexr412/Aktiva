'use client';

import { collection, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { UserProfile } from "@/lib/types";

/**
 * Ruft die Profile einer Liste von User-IDs ab.
 * Implementiert Chunking (max 10 IDs pro Query), um Firestore-Beschränkungen einzuhalten.
 */
export const fetchFriendsProfiles = async (friendIds: string[]): Promise<UserProfile[]> => {
  if (!db) throw new Error("Firestore not initialized");
  if (!friendIds || friendIds.length === 0) return [];
  
  const chunkedIds = [];
  for (let i = 0; i < friendIds.length; i += 10) {
    chunkedIds.push(friendIds.slice(i, i + 10));
  }

  const profiles: UserProfile[] = [];
  for (const chunk of chunkedIds) {
    try {
      const q = query(collection(db, "users"), where(documentId(), "in", chunk));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        profiles.push(doc.data() as UserProfile);
      });
    } catch (error) {
      console.error("Error fetching profile chunk:", error);
    }
  }
  return profiles;
};

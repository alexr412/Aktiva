"use client";

import { useEffect, useState } from "react";
import { fetchFriendsProfiles } from "@/lib/friends";
import type { UserProfile } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface FriendListProps {
  friendIds: string[];
}

export default function FriendList({ friendIds }: FriendListProps) {
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFriends = async () => {
      if (!friendIds || friendIds.length === 0) {
        setFriends([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await fetchFriendsProfiles(friendIds);
        setFriends(data);
      } catch (error) {
        console.error("Failed to load friends:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadFriends();
  }, [friendIds]);

  if (isLoading) {
    return (
      <div className="space-y-4 mt-8 w-full px-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="px-6 mt-8">
        <div className="text-sm text-muted-foreground border border-dashed border-border p-8 rounded-xl text-center">
          Noch keine Freunde hinzugefügt.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-8 w-full px-6">
      <h3 className="font-bold text-xl border-b border-border pb-2">Freunde ({friends.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {friends.map(friend => (
          <Link href={`/users/${friend.uid}`} key={friend.uid}>
            <Card className="flex items-center gap-4 p-4 border border-border rounded-xl bg-card hover:bg-secondary/50 transition-colors cursor-pointer">
              <Avatar className="h-12 w-12 border border-primary/10">
                <AvatarImage src={friend.photoURL || undefined} />
                <AvatarFallback>{friend.displayName?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold truncate">{friend.displayName || "Unbekannter Nutzer"}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {friend.location || "Kein Standort"}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

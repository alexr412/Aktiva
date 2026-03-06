'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import type { Chat } from '@/lib/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Users, UserPlus } from 'lucide-react';
import { AddFriendDialog } from '@/components/friends/AddFriendDialog';
import { NotificationBell } from '@/components/notifications/NotificationBell';

const ChatListItemSkeleton = () => (
    <div className="flex items-center gap-4 p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
        </div>
    </div>
);

const EmptyState = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center h-full">
    <div className="bg-primary/10 p-4 rounded-full">
      <Users className="h-10 w-10 text-primary" />
    </div>
    <h2 className="text-xl font-semibold">No Chats Yet</h2>
    <p className="text-muted-foreground">
      Join an activity or add a friend to start chatting.
    </p>
    <Button asChild>
      <Link href="/">Find an Activity</Link>
    </Button>
  </div>
);

export default function ChatPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userChats = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Chat));
      
      const visibleChats = userChats.filter(chat => {
          if (!userProfile?.hiddenEntityIds) return true;

          if (chat.activityId && userProfile.hiddenEntityIds.includes(chat.activityId)) {
              return false;
          }

          const isDM = !chat.activityId;
          if (isDM) {
              const otherUserId = chat.participantIds.find(id => id !== user.uid);
              if (otherUserId && userProfile.hiddenEntityIds.includes(otherUserId)) {
                  return false;
              }
          }
          
          return true;
      });

      visibleChats.sort((a, b) => {
        const aTime = a.lastMessage?.sentAt?.toMillis() || a.createdAt?.toMillis() || 0;
        const bTime = b.lastMessage?.sentAt?.toMillis() || b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });

      setChats(visibleChats);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching chats: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userProfile, authLoading, router]);

  const renderContent = () => {
    if (loading || authLoading) {
      return (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <ChatListItemSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (chats.length === 0) {
      return <EmptyState />;
    }

    return (
      <ul className="divide-y divide-border">
        {chats.map((chat) => {
          const isDM = !chat.activityId;
          let otherUser: { displayName: string | null; photoURL: string | null; } | undefined;
          let chatName = chat.placeName;
          let avatarUrl: string | undefined;
          let avatarFallback = chat.placeName?.charAt(0).toUpperCase();

          if (isDM && user) {
              const otherUserId = chat.participantIds.find(id => id !== user.uid);
              if (otherUserId && chat.participantDetails) {
                  otherUser = chat.participantDetails[otherUserId];
                  chatName = otherUser?.displayName || 'Chat';
                  avatarUrl = otherUser?.photoURL || undefined;
                  avatarFallback = otherUser?.displayName?.charAt(0).toUpperCase();
              }
          }

          const unreadCount = user ? (chat.unreadCount?.[user.uid] || 0) : 0;
          const hasUnread = unreadCount > 0;

          return (
            <li key={chat.id}>
              <Link href={`/chat/${chat.id}`} className="block p-4 transition-colors hover:bg-muted/50">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    {avatarUrl && <AvatarImage src={avatarUrl} />}
                    <AvatarFallback className={isDM ? '' : 'bg-primary/10 text-xl font-bold text-primary'}>
                      {avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="truncate font-semibold text-base">{chatName}</p>
                       {chat.lastMessage?.sentAt && (
                        <time className={`shrink-0 text-xs ${hasUnread ? 'text-green-500 font-bold' : 'text-muted-foreground'}`}>
                          {formatDistanceToNow(chat.lastMessage.sentAt.toDate(), { addSuffix: true, includeSeconds: true }).replace('about ', '')}
                        </time>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${hasUnread ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                        {chat.lastMessage ? (
                            <>
                            <span className="font-medium">{chat.lastMessage.senderName?.split(' ')[0]}:</span> {chat.lastMessage.text}
                            </>
                        ) : 'No messages yet.'}
                        </p>
                        {hasUnread && (
                            <div className="bg-green-500 text-white text-[10px] font-bold min-w-[18px] h-4 rounded-full flex items-center justify-center px-1.5 shrink-0 shadow-sm">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                        )}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    );
  };

  return (
    <>
      <div className="flex h-full flex-col">
          <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm">
            <div className="px-4 flex h-16 items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">Chats</h1>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setShowAddFriendDialog(true)}>
                    <UserPlus className="h-5 w-5" />
                    <span className="sr-only">Freund hinzufügen</span>
                </Button>
                <NotificationBell />
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto">
              {renderContent()}
          </div>
      </div>
      <AddFriendDialog open={showAddFriendDialog} onOpenChange={setShowAddFriendDialog} />
    </>
  );
}

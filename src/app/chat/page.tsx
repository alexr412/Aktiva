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
import { Users } from 'lucide-react';

const ChatListItemSkeleton = () => (
    <div className="flex items-center gap-4 p-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-3 w-16" />
    </div>
);

const EmptyState = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center h-full">
    <div className="bg-primary/10 p-4 rounded-full">
      <Users className="h-10 w-10 text-primary" />
    </div>
    <h2 className="text-xl font-semibold">No Activities Yet</h2>
    <p className="text-muted-foreground">
      Looks like you haven't joined or created any activities.
    </p>
    <Button asChild>
      <Link href="/">Find an Activity</Link>
    </Button>
  </div>
);

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
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
      
      userChats.sort((a, b) => {
        const aTime = a.lastMessage?.sentAt?.toMillis() || a.createdAt?.toMillis() || 0;
        const bTime = b.lastMessage?.sentAt?.toMillis() || b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });

      setChats(userChats);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching chats: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, router]);

  const renderContent = () => {
    if (loading || authLoading) {
      return (
        <div className="space-y-1 p-2">
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
      <ul className="space-y-1 p-2">
        {chats.map((chat) => (
          <li key={chat.id}>
            <Link href={`/chat/${chat.id}`} className="block rounded-xl p-3 transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                   <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
                    {chat.placeName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{chat.placeName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {chat.lastMessage ? (
                      <>
                        <span className="font-medium">{chat.lastMessage.senderName?.split(' ')[0]}:</span> {chat.lastMessage.text}
                      </>
                    ) : 'No messages yet.'}
                  </p>
                </div>
                {chat.lastMessage?.sentAt && (
                  <time className="ml-2 shrink-0 self-start text-xs text-muted-foreground">
                    {formatDistanceToNow(chat.lastMessage.sentAt.toDate(), { addSuffix: true })}
                  </time>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm">
          <div className="container-main flex h-16 items-center">
            <h1 className="text-xl font-bold tracking-tight">Chats</h1>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
            {renderContent()}
        </div>
    </div>
  );
}

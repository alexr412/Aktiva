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
import { cn } from '@/lib/utils';

const ChatListItemSkeleton = () => (
    <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm flex items-center gap-4 border border-slate-100/50">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-3/4" />
        </div>
    </div>
);

const EmptyState = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center h-full">
    <div className="bg-primary/10 p-6 rounded-[2.5rem]">
      <Users className="h-12 w-12 text-primary" />
    </div>
    <h2 className="text-xl font-black text-slate-900">Noch keine Chats</h2>
    <p className="text-slate-500 font-medium max-w-xs">
      Tritt einer Aktivität bei oder füge Freunde hinzu, um loszulegen.
    </p>
    <Button asChild className="rounded-2xl h-12 px-8 font-black shadow-lg shadow-primary/20">
      <Link href="/">Aktivitäten finden</Link>
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

  const getGradient = (chatId: string) => {
    const gradients = [
      'from-teal-400 to-emerald-500',
      'from-indigo-400 to-cyan-400',
      'from-orange-400 to-pink-500',
      'from-blue-400 to-indigo-500',
      'from-purple-400 to-pink-400'
    ];
    const index = (chatId.charCodeAt(0) + chatId.charCodeAt(chatId.length - 1)) % gradients.length;
    return gradients[index];
  };

  const renderContent = () => {
    if (loading || authLoading) {
      return (
        <div className="p-4">
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
      <div className="p-4 pb-24">
        {chats.map((chat) => {
          const isDM = !chat.activityId;
          let otherUser: { displayName: string | null; photoURL: string | null; } | undefined;
          let chatName = chat.placeName;
          let avatarUrl: string | undefined;
          let avatarFallback = chat.placeName?.charAt(0).toUpperCase() || 'C';

          if (isDM && user) {
              const otherUserId = chat.participantIds.find(id => id !== user.uid);
              if (otherUserId && chat.participantDetails) {
                  otherUser = chat.participantDetails[otherUserId];
                  chatName = otherUser?.displayName || 'Chat';
                  avatarUrl = otherUser?.photoURL || undefined;
                  avatarFallback = otherUser?.displayName?.charAt(0).toUpperCase() || 'U';
              }
          }

          const unreadCount = user ? (chat.unreadCount?.[user.uid] || 0) : 0;
          const hasUnread = unreadCount > 0;

          return (
            <Link 
              key={chat.id} 
              href={`/chat/${chat.id}`} 
              className={cn(
                "bg-white rounded-2xl p-4 mb-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex items-center gap-4 border border-slate-100/50",
                hasUnread && "border-primary/20 bg-primary/[0.02]"
              )}
            >
              {/* Avatar Container */}
              <div className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm relative overflow-hidden",
                !avatarUrl && `bg-gradient-to-br ${getGradient(chat.id)}`
              )}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={chatName || ''} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-white font-black text-lg">{avatarFallback}</span>
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className={cn(
                    "text-base font-black text-slate-900 truncate pr-2",
                    hasUnread && "text-primary"
                  )}>
                    {chatName}
                  </h3>
                  {chat.lastMessage?.sentAt && (
                    <time className={cn(
                      "shrink-0 text-[10px] font-bold uppercase tracking-wider",
                      hasUnread ? "text-primary" : "text-slate-400"
                    )}>
                      {formatDistanceToNow(chat.lastMessage.sentAt.toDate(), { addSuffix: false }).replace('about ', '')}
                    </time>
                  )}
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <p className={cn(
                    "truncate text-sm font-medium",
                    hasUnread ? "text-slate-700" : "text-slate-500"
                  )}>
                    {chat.lastMessage ? (
                      <>
                        <span className="font-bold">{chat.lastMessage.senderName?.split(' ')[0]}:</span> {chat.lastMessage.text}
                      </>
                    ) : 'Noch keine Nachrichten.'}
                  </p>
                  
                  {hasUnread && (
                    <div className="bg-primary text-white text-[10px] font-black min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5 shrink-0 shadow-lg shadow-primary/20">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    );
  };

  return (
    <>
      <div className="flex h-full flex-col bg-slate-50">
          <header className="sticky top-0 z-10 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md shrink-0">
            <div className="px-4 flex h-16 items-center justify-between max-w-7xl mx-auto w-full">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Chats</h1>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-2xl bg-slate-100/50 hover:bg-slate-100 text-slate-600" 
                  onClick={() => setShowAddFriendDialog(true)}
                >
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

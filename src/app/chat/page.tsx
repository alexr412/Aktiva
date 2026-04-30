'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import type { Chat } from '@/lib/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Search, Bell, MessageCircle, MoreHorizontal } from 'lucide-react';
import { AddFriendDialog } from '@/components/friends/AddFriendDialog';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getPrimaryIconData } from '@/lib/tag-config';

const ChatListItemSkeleton = () => (
    <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-5 mb-3 shadow-sm flex items-center gap-5 border border-slate-100/50 dark:border-neutral-800">
        <Skeleton className="h-20 w-20 rounded-[2rem] shrink-0" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2 rounded-full" />
            <Skeleton className="h-4 w-3/4 rounded-full" />
            <Skeleton className="h-4 w-1/4 rounded-full" />
        </div>
    </div>
);

const EmptyState = ({ language }: { language: string }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center h-full">
    <div className="bg-primary/10 p-6 rounded-[2.5rem]">
      <Users className="h-12 w-12 text-primary" />
    </div>
    <h2 className="text-xl font-black text-slate-900 dark:text-neutral-100">{language === 'de' ? 'Noch keine Chats' : 'No chats yet'}</h2>
    <p className="text-slate-500 dark:text-neutral-400 font-medium max-w-xs">
      {language === 'de' ? 'Tritt einer Aktivität bei oder füge Freunde hinzu, um loszulegen.' : 'Join an activity or add friends to get started.'}
    </p>
    <Button asChild className="rounded-2xl h-12 px-8 font-black shadow-lg shadow-primary/20">
      <Link href="/">{language === 'de' ? 'Aktivitäten finden' : 'Find activities'}</Link>
    </Button>
  </div>
);

export default function ChatPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const language = useLanguage();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'places' | 'people'>('all');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
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
          if (chat.activityId && userProfile.hiddenEntityIds.includes(chat.activityId)) return false;
          const isDM = !chat.activityId;
          if (isDM) {
              const otherUserId = chat.participantIds.find(id => id !== user.uid);
              if (otherUserId && userProfile.hiddenEntityIds.includes(otherUserId)) return false;
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

  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", user.uid),
      where("isRead", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifications(snapshot.docs.length);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredChats = chats.filter(chat => {
    const chatName = chat.placeName?.toLowerCase() || "";
    if (searchQuery && !chatName.includes(searchQuery.toLowerCase())) return false;
    if (filter === 'unread') {
        const unreadCount = user ? (chat.unreadCount?.[user.uid] || 0) : 0;
        return unreadCount > 0;
    }
    if (filter === 'places') return !!chat.activityId;
    if (filter === 'people') return !chat.activityId;
    return true;
  });

  const getGradient = (chatId: string) => {
    const gradients = ['from-teal-400 to-emerald-500', 'from-indigo-400 to-cyan-400', 'from-orange-400 to-pink-500', 'from-blue-400 to-indigo-500', 'from-purple-400 to-pink-400'];
    const index = (chatId.charCodeAt(0) + (chatId.charCodeAt(chatId.length - 1) || 0)) % gradients.length;
    return gradients[index];
  };

  const renderContent = () => {
    if (loading || authLoading) {
      return (
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <ChatListItemSkeleton key={i} />)}
        </div>
      );
    }

    if (filteredChats.length === 0) {
      return <EmptyState language={language} />;
    }

    return (
      <div className="px-4 py-2 space-y-3 pb-32">
        {filteredChats.map((chat) => {
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
          
          // Mocking category data based on place icons if possible
          const primaryStyle = chat.placeName ? getPrimaryIconData({ name: chat.placeName } as any, language) : null;
          
          // Generate a consistent color for DMs or places without style
          const fallbackColor = isDM ? ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'][chat.id.charCodeAt(0) % 5] : '#94a3b8';
          const displayColor = primaryStyle?.color || fallbackColor;
          const CategoryIcon = isDM ? User : (primaryStyle?.icon || MessageCircle);

          return (
            <Link 
              key={chat.id} 
              href={`/chat/${chat.id}`} 
              className={cn(
                "bg-white dark:bg-neutral-900 rounded-[2.5rem] p-5 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all duration-300 flex items-center gap-5 border border-transparent active:scale-95",
                hasUnread && "ring-2 ring-emerald-500/20 bg-emerald-50/10"
              )}
            >
              {/* Square Icon Container */}
              <div className={cn(
                "h-20 w-20 rounded-[2rem] flex items-center justify-center flex-shrink-0 relative overflow-hidden",
                !isDM && primaryStyle ? primaryStyle.gradientClass : (isDM ? "bg-white" : "bg-neutral-100")
              )}
              style={isDM ? { 
                  backgroundColor: displayColor + '25',
                  boxShadow: `inset 0 0 0 1px ${displayColor}10`
              } : undefined}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={chatName || ''} className="h-full w-full object-cover" />
                ) : (
                  <CategoryIcon className={cn("h-10 w-10 drop-shadow-md", !isDM && primaryStyle ? "text-white" : "")} style={isDM ? { color: displayColor } : undefined} />
                )}
                {/* Active Indicator */}
                {!isDM && <div className="absolute bottom-3 right-3 w-3.5 h-3.5 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />}
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-xl font-black text-[#0f172a] dark:text-neutral-100 truncate pr-2 font-heading tracking-tight leading-none pt-1">
                    {chatName}
                  </h3>
                  {chat.lastMessage?.sentAt && (
                    <time className="shrink-0 text-[11px] font-bold text-neutral-400 uppercase tracking-tighter">
                      {formatDistanceToNow(chat.lastMessage.sentAt.toDate(), { addSuffix: false, locale: language === 'de' ? de : enUS })
                        .replace('about ', '')
                        .replace('Stunden', 'h')
                        .replace('Stunde', 'h')
                        .replace('Minuten', 'm')
                        .replace('Minute', 'm')
                        .replace('Tage', 'd')
                        .replace('Tag', 'd')
                        .replace(' hours', 'h')
                        .replace(' hour', 'h')
                        .replace(' minutes', 'm')
                        .replace(' minute', 'm')
                        .replace(' days', 'd')
                        .replace(' day', 'd')}
                    </time>
                  )}
                </div>
                
                <p className="truncate text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2 leading-tight">
                  {chat.lastMessage ? (
                    <>
                      {chat.lastMessage.senderId === user?.uid && <span className="text-neutral-400 mr-1">{language === 'de' ? 'Du:' : 'You:'}</span>}
                      {chat.lastMessage.text}
                    </>
                  ) : (language === 'de' ? 'Noch keine Nachrichten.' : 'No messages yet.')}
                </p>

                <div className="flex items-center justify-between">
                   <div className="text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full"
                   style={{ color: displayColor, backgroundColor: displayColor + '10' }}
                   >
                     {isDM ? (language === 'de' ? 'Person' : 'Person') : (primaryStyle?.label || (language === 'de' ? 'Ort' : 'Place'))}
                   </div>

                    {hasUnread && (
                        <div className="bg-emerald-500 text-white text-[11px] font-black min-w-[24px] h-6 rounded-full flex items-center justify-center px-1.5 shadow-lg shadow-emerald-200">
                            {unreadCount}
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
      <div className="flex h-full flex-col bg-[#fcfcfb] dark:bg-neutral-950">
          <header className="sticky top-0 z-30 w-full bg-[#fcfcfb]/80 dark:bg-neutral-950/80 backdrop-blur-xl shrink-0 pt-8 pb-4">
            <div className="px-6 flex items-center justify-between max-w-7xl mx-auto w-full mb-6">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tighter text-[#0f172a] dark:text-neutral-100 font-heading">Chats</h1>
                <MessageCircle className="h-6 w-6 text-violet-400 fill-current opacity-30" />
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-12 w-12 rounded-2xl bg-white dark:bg-neutral-900 border-none shadow-xl shadow-slate-200/40 text-[#0f172a] dark:text-neutral-100" 
                  onClick={() => setShowAddFriendDialog(true)}
                >
                    <Users className="h-6 w-6" />
                </Button>
                <div className="relative">
                    <Button 
                        variant="secondary" 
                        size="icon" 
                        className="h-12 w-12 rounded-2xl bg-[#ffeedd] border-none shadow-xl shadow-orange-200/20 text-orange-400" 
                    >
                        <Bell className="h-6 w-6 fill-current" />
                    </Button>
                    {unreadNotifications > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full shadow-sm" />
                    )}
                </div>
              </div>
            </div>

            <div className="px-6 space-y-4">
                <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                    <Input 
                        placeholder={language === 'de' ? "Chats durchsuchen..." : "Search chats..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-14 w-full rounded-3xl border-none bg-neutral-100/60 pl-14 font-bold text-neutral-600 focus-visible:ring-offset-0 focus-visible:ring-emerald-500/20"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
                    {[
                        { id: 'all', label: language === 'de' ? 'Alle' : 'All' },
                        { id: 'unread', label: language === 'de' ? 'Ungelesen' : 'Unread' },
                        { id: 'places', label: language === 'de' ? 'Orte' : 'Places' },
                        { id: 'people', label: language === 'de' ? 'Personen' : 'People' }
                    ].map((btn) => (
                        <button
                            key={btn.id}
                            onClick={() => setFilter(btn.id as any)}
                            className={cn(
                                "flex-shrink-0 px-6 py-2.5 rounded-full text-[13px] font-black transition-all",
                                filter === btn.id 
                                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" 
                                    : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200/50"
                            )}
                        >
                            {btn.label}
                        </button>
                    ))}
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

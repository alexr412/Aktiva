'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import type { Chat } from '@/lib/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import { useChatSync } from '@/contexts/chat-sync-context';
import { MAIN_NAV_ITEMS, getIsActiveNav } from '@/lib/navigation-config';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Search, Bell, MessageCircle, User, Building } from 'lucide-react';
import { AddFriendDialog } from '@/components/friends/AddFriendDialog';
import { Input } from '@/components/ui/input';
import { cn, formatLabel } from '@/lib/utils';
import { getPrimaryIconData, getRoomVisualCategory } from '@/lib/tag-config';

const ChatListItemSkeleton = () => (
  <div className="bg-white dark:bg-neutral-900 rounded-3xl p-3.5 mb-2.5 shadow-xs flex items-center gap-3.5 border border-slate-100 dark:border-neutral-800">
    <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-1/2 rounded-full" />
      <Skeleton className="h-3 w-3/4 rounded-full" />
    </div>
  </div>
);

interface ChatListSidebarProps {
  activeChatId?: string;
  className?: string;
}

export function ChatListSidebar({ activeChatId, className }: ChatListSidebarProps) {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { chats, loading: syncLoading } = useChatSync();
  const language = useLanguage();
  const pathname = usePathname();
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'places' | 'people'>('all');
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db!, "notifications"),
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

  const renderContent = () => {
    if ((syncLoading && chats.length === 0) || authLoading) {
      return (
        <div className="p-3 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <ChatListItemSkeleton key={i} />)}
        </div>
      );
    }

    if (filteredChats.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center my-auto text-slate-400">
          <MessageCircle className="h-10 w-10 text-slate-300 dark:text-neutral-700 mb-3 stroke-1" />
          <p className="text-xs font-bold text-slate-500 dark:text-neutral-400">
            {language === 'de' ? 'Keine Chats gefunden' : 'No chats found'}
          </p>
        </div>
      );
    }

    return (
      <div className="px-3 py-2 space-y-2 pb-24">
        {filteredChats.map((chat) => {
          const isDM = !chat.activityId;
          const isActive = activeChatId === chat.id;

          let otherUser: { 
            displayName: string | null; 
            username?: string | null;
            photoURL: string | null; 
            isPremium?: boolean;
            isCreator?: boolean;
            isSupporter?: boolean;
          } | undefined;
          let chatName = chat.placeName;
          let avatarUrl: string | undefined;

          if (isDM && user) {
            const otherUserId = chat.participantIds.find(id => id !== user.uid);
            if (otherUserId && chat.participantDetails) {
              otherUser = chat.participantDetails[otherUserId];
              const otherUsername = otherUser?.username || null;
              chatName = otherUsername ? `@${otherUsername.replace(/^@/, '')}` : (language === 'de' ? 'Aktiva-Nutzer' : 'Aktiva user');
              avatarUrl = otherUser?.photoURL || undefined;
            }
          }

          const unreadCount = user ? (chat.unreadCount?.[user.uid] || 0) : 0;
          const hasUnread = unreadCount > 0;
          
          const visualCategoryData = getRoomVisualCategory({ activity: null, place: null, chat });
          const primaryStyle = chat.placeName ? getPrimaryIconData(visualCategoryData, language) : null;
          
          const fallbackColor = isDM ? ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'][chat.id.charCodeAt(0) % 5] : '#94a3b8';
          const displayColor = primaryStyle?.color || fallbackColor;
          const CategoryIcon = isDM ? User : (primaryStyle?.icon || MessageCircle);

          return (
            <Link 
              key={chat.id} 
              href={`/chat/${chat.id}`} 
              className={cn(
                "bg-white dark:bg-neutral-900 rounded-2xl p-3 shadow-2xs transition-all duration-200 flex items-center gap-3 border border-slate-100 dark:border-neutral-800/80 hover:border-slate-300 dark:hover:border-neutral-700 active:scale-[0.99]",
                isActive && "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/40 dark:border-emerald-500/40 shadow-sm",
                hasUnread && !isActive && "ring-2 ring-emerald-500/20 bg-emerald-50/10"
              )}
            >
              <div 
                className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden",
                  !isDM && primaryStyle ? primaryStyle.gradientClass : (isDM ? "bg-white dark:bg-neutral-800" : "bg-neutral-100 dark:bg-neutral-800")
                )}
                style={isDM ? { 
                  backgroundColor: displayColor + '25',
                } : undefined}
              >
                <Avatar 
                  className="h-12 w-12 rounded-xl"
                  isPremium={otherUser?.isPremium}
                  isCreator={otherUser?.isCreator}
                  isSupporter={otherUser?.isSupporter}
                >
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={chatName || ''} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-transparent">
                      {!isDM && primaryStyle?.icon === Building ? (
                        <span className="text-base font-black text-white drop-shadow-xs">{chatName?.charAt(0).toUpperCase()}</span>
                      ) : (
                        <CategoryIcon className={cn("h-6 w-6 drop-shadow-xs", !isDM && primaryStyle ? "text-white" : "")} style={isDM ? { color: displayColor } : undefined} />
                      )}
                    </AvatarFallback>
                  )}
                </Avatar>
                {!isDM && <div className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 border border-white shadow-xs" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5 gap-2 min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-neutral-100 truncate pr-1 tracking-tight leading-tight flex-1 min-w-0">
                    {chatName}
                  </h3>
                  {chat.lastMessage?.sentAt && (
                    <time className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase">
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
                
                <p className="truncate text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1 leading-tight">
                  {chat.lastMessage ? (
                    <>
                      {chat.lastMessage.senderId === user?.uid && <span className="text-slate-400 mr-1">{language === 'de' ? 'Du:' : 'You:'}</span>}
                      {chat.lastMessage.text}
                    </>
                  ) : (language === 'de' ? 'Erste Nachricht senden' : 'Send first message')}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] font-black px-2 py-0.5 rounded-full truncate max-w-full"
                    style={{ color: displayColor, backgroundColor: displayColor + '15' }}
                  >
                    {isDM ? formatLabel(language === 'de' ? 'Person' : 'Person') : formatLabel(primaryStyle?.label || (language === 'de' ? 'Ort' : 'Place'))}
                  </div>

                  {hasUnread && (
                    <div className="bg-emerald-500 text-white text-[10px] font-black min-w-[18px] h-4.5 rounded-full flex items-center justify-center px-1 shadow-xs shrink-0">
                      {unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full w-full bg-[#fcfcfb] dark:bg-neutral-950 border-r border-slate-200/80 dark:border-neutral-800/80 overflow-hidden", className)}>
      <header className="px-4 pt-4 pb-2 shrink-0 border-b border-slate-100 dark:border-neutral-900 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href="/profile" title={language === 'de' ? 'Mein Profil' : 'My Profile'} className="hover:opacity-85 transition-opacity shrink-0">
              <ProfileAvatar 
                className="h-9 w-9 border border-white dark:border-neutral-800 shadow-2xs shrink-0"
                photoURL={userProfile?.photoURL || user?.photoURL}
                displayName={userProfile?.displayName || user?.displayName}
                isPremium={userProfile?.isPremium}
                isCreator={userProfile?.isCreator}
                isSupporter={userProfile?.isSupporter}
              />
            </Link>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-neutral-100 truncate">Chats</h1>
            <MessageCircle className="h-5 w-5 text-violet-500 fill-current opacity-30 shrink-0" />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8.5 w-8.5 rounded-full text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800" 
                aria-label={language === 'de' ? 'Benachrichtigungen' : 'Notifications'}
              >
                <Bell className="h-4.5 w-4.5" />
              </Button>
              {unreadNotifications > 0 && (
                <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-neutral-950 rounded-full shadow-xs" />
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8.5 w-8.5 rounded-full text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800" 
              aria-label={language === 'de' ? 'Freund hinzufügen' : 'Add friend'}
              onClick={() => setShowAddFriendDialog(true)}
            >
              <UserPlus className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={language === 'de' ? "Chats durchsuchen..." : "Search chats..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border-none bg-slate-100 dark:bg-neutral-900 pl-10 text-xs font-semibold text-slate-800 dark:text-neutral-100 focus-visible:ring-emerald-500/20 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
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
                  "flex-shrink-0 px-3.5 h-8 rounded-full text-[11px] font-black transition-all",
                  filter === btn.id 
                    ? "bg-emerald-500 text-white shadow-xs" 
                    : "bg-slate-100 dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 hover:bg-slate-200/60 dark:hover:bg-neutral-800"
                )}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 w-full overflow-y-auto">
        {renderContent()}
      </div>

      <AddFriendDialog open={showAddFriendDialog} onOpenChange={setShowAddFriendDialog} />
    </div>
  );
}

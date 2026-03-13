'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { sendMessage, checkIfUserReviewed, markChatAsRead } from '@/lib/firebase/firestore';
import type { Message, Chat, Activity, UserProfile } from '@/lib/types';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInfoSheet } from '@/components/aktvia/chat-info-sheet';
import { ArrowLeft, Send, MoreVertical } from 'lucide-react';
import { CompletionBanner } from '@/components/aktvia/CompletionBanner';
import { ReviewDialog } from '@/components/reviews/ReviewDialog';
import { UserBadge } from '@/components/common/UserBadge';
import { cn } from '@/lib/utils';

const DateSeparator = ({ date }: { date: Date }) => {
  const formatDate = (d: Date) => {
    if (isToday(d)) return 'Heute';
    if (isYesterday(d)) return 'Gestern';
    return format(d, 'd. MMMM yyyy');
  };

  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black">
        <span className="bg-slate-50 px-3 text-slate-400">
          {formatDate(date)}
        </span>
      </div>
    </div>
  );
};

const MessageBubble = ({
  message,
  isOwnMessage,
  currentUserProfile,
  participantDetails,
  isFirstInGroup,
}: {
  message: Message;
  isOwnMessage: boolean;
  currentUserProfile?: UserProfile | null;
  participantDetails?: Chat['participantDetails'];
  isFirstInGroup: boolean;
}) => {
  // Hard-Bypass für den eigenen Status, Fallback für Fremde (inklusive Nachricht-Level Flags)
  const badgePremium = isOwnMessage 
    ? Boolean(currentUserProfile?.isPremium) 
    : Boolean(message.isPremium || (message as any).IsPremium || participantDetails?.[message.senderId]?.isPremium);

  const badgeSupporter = isOwnMessage 
    ? Boolean(currentUserProfile?.isSupporter) 
    : Boolean(message.isSupporter || (message as any).IsSupporter || participantDetails?.[message.senderId]?.isSupporter);

  return (
    <div className={cn(
      "w-full flex px-4 mb-1",
      isOwnMessage ? "justify-end" : "justify-start",
      isFirstInGroup ? "mt-4" : "mt-0.5"
    )}>
      <div className={cn(
        "flex flex-col max-w-[85%]",
        isOwnMessage ? "items-end" : "items-start"
      )}>
        {isFirstInGroup && (
          <Link 
            href={isOwnMessage ? '/profile' : `/profile/${message.senderId}`} 
            className="flex items-center gap-1 mb-1 mx-1 hover:opacity-80 transition-opacity cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider group-hover:underline">
              {isOwnMessage ? 'Du' : message.senderName}
            </span>
            <UserBadge isPremium={badgePremium} isSupporter={badgeSupporter} size="sm" />
          </Link>
        )}
        
        <div className={cn(
          "max-w-full px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-all inline-block shadow-sm",
          isOwnMessage 
            ? "self-end bg-primary text-white rounded-tr-sm" 
            : "self-start bg-white dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 border border-slate-100 dark:border-neutral-700 rounded-tl-sm"
        )}>
          {message.text}
          <div className="flex justify-end mt-1">
            <span className={cn(
              "text-[9px] font-bold uppercase",
              isOwnMessage ? "text-white/60" : "text-slate-400"
            )}>
              {message.sentAt ? format(message.sentAt.toDate(), 'p') : '...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ChatRoomPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isInfoSheetOpen, setInfoSheetOpen] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(true);
  
  const [otherUser, setOtherUser] = useState<Partial<UserProfile> & { uid?: string; isPremium?: boolean; isSupporter?: boolean } | null>(null);
  const [isDirectMessage, setIsDirectMessage] = useState(false);
  
  const router = useRouter();
  const params = useParams();
  const chatId = params.chatId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  useEffect(() => {
    if (!chatId || !user) return;

    let activityUnsubscribe: (() => void) | undefined;

    const chatUnsubscribe = onSnapshot(doc(db, 'chats', chatId), (chatDoc) => {
      if (chatDoc.exists()) {
        const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
        setChat(chatData);

        const isDM = !chatData.activityId;
        setIsDirectMessage(isDM);

        if (isDM) {
          const otherUserId = chatData.participantIds.find(id => id !== user.uid);
          if (otherUserId && chatData.participantDetails) {
            setOtherUser({ ...chatData.participantDetails[otherUserId], uid: otherUserId });
          }
          setActivity(null);
          if (activityUnsubscribe) activityUnsubscribe();
        } else {
          setOtherUser(null);
          if (activityUnsubscribe) activityUnsubscribe();
          
          activityUnsubscribe = onSnapshot(doc(db, 'activities', chatData.activityId!), (activityDoc) => {
              if (activityDoc.exists()) {
                  const activityData = { id: activityDoc.id, ...activityDoc.data() } as Activity;
                  setActivity(activityData);

                  if (activityData.status === 'completed' && activityData.id) {
                      checkIfUserReviewed(activityData.id, user.uid).then(setHasReviewed);
                  }
              } else {
                setActivity(null);
              }
          });
        }
      } else {
        setLoading(false);
        setChat(null);
        router.replace('/chat');
      }
    });

    const messagesQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('sentAt', 'asc'));
    const messagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(newMessages);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      toast({ title: "Fehler", description: "Nachrichten konnten nicht geladen werden.", variant: 'destructive'});
      setLoading(false);
    });

    return () => {
      chatUnsubscribe();
      messagesUnsubscribe();
      if (activityUnsubscribe) {
        activityUnsubscribe();
      }
    };
  }, [chatId, router, toast, user]);

  useEffect(() => {
    if (chat && user && chat.unreadCount?.[user.uid] && chat.unreadCount[user.uid] > 0) {
        markChatAsRead(chat.id, user.uid);
    }
  }, [chat, user]);

  useEffect(() => {
    if (activity?.status === 'completed' && !hasReviewed && user) {
        const otherParticipants = activity.participantIds.filter(id => id !== user.uid);
        if (otherParticipants.length > 0) {
            setShowReviewDialog(true);
        }
    }
  }, [activity, hasReviewed, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user) return;

    const currentMessage = newMessage;
    setNewMessage('');
    try {
      await sendMessage(chatId, currentMessage, user, userProfile);
    } catch (error) {
      console.error(error);
      setNewMessage(currentMessage);
      toast({ title: "Fehler", description: "Nachricht konnte nicht gesendet werden.", variant: 'destructive'});
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-white/80 px-4 backdrop-blur-sm shadow-sm">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-xl" />
        </header>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-12 w-3/4 rounded-2xl" />
          <Skeleton className="h-12 w-1/2 self-end rounded-2xl" />
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!chat && !loading) return null;

  return (
    <>
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-white/90 px-2 backdrop-blur-md shadow-sm">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1 truncate">
            {isDirectMessage && otherUser ? (
                <Link href={`/profile/${otherUser.uid}`} className="flex items-center gap-2.5 truncate hover:opacity-80 transition-opacity cursor-pointer">
                    <Avatar className={cn(
                      "h-9 w-9 shadow-sm border border-white",
                      otherUser.isPremium ? "ring-2 ring-amber-400" : (otherUser.isSupporter ? "ring-2 ring-pink-400" : "")
                    )}>
                        <AvatarImage src={otherUser.photoURL || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">{otherUser.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1.5 truncate">
                      <h2 className="font-black text-slate-900 truncate tracking-tight">{otherUser.displayName}</h2>
                      <UserBadge isPremium={otherUser.isPremium} isSupporter={otherUser.isSupporter} size="sm" />
                    </div>
                </Link>
            ) : (
                <div className="flex items-center gap-2.5 truncate">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-black text-xs uppercase">{chat?.placeName?.charAt(0)}</span>
                  </div>
                  <h2 className="font-black text-slate-900 truncate tracking-tight">{chat?.placeName}</h2>
                </div>
            )}
          </div>

          {!isDirectMessage && (
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500" onClick={() => setInfoSheetOpen(true)}>
                <MoreVertical className="h-5 w-5" />
                <span className='sr-only'>Chat Info</span>
              </Button>
          )}
        </header>

        {!isDirectMessage && activity && user && chat && activity.status === 'active' && activity.completionVotes && activity.completionVotes.length > 0 && (
          <CompletionBanner activity={activity} currentUser={user} participantDetails={chat.participantDetails} />
        )}

        <div className="flex-1 overflow-y-auto pt-4 pb-32">
          <div className="flex flex-col w-full max-w-3xl mx-auto">
            {messages.map((message, index) => {
              const prevMessage = messages[index - 1];
              const isOwnMessage = message.senderId === user?.uid;
              
              const showDateSeparator = !prevMessage || !prevMessage.sentAt || !message.sentAt || !isSameDay(message.sentAt.toDate(), prevMessage.sentAt.toDate());
              const isFirstInGroup = !prevMessage || prevMessage.senderId !== message.senderId || showDateSeparator;
              
              return (
                <div key={message.id} className="w-full">
                  {showDateSeparator && message.sentAt && <DateSeparator date={message.sentAt.toDate()} />}
                  <MessageBubble
                    message={message}
                    isOwnMessage={isOwnMessage}
                    isFirstInGroup={isFirstInGroup}
                    currentUserProfile={userProfile}
                    participantDetails={chat?.participantDetails}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <footer className="fixed bottom-[72px] left-0 right-0 z-10 mx-auto w-full max-w-3xl bg-white shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.05)] border-t border-slate-100">
        <div className="p-3 sm:p-4">
          <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Nachricht schreiben..."
              autoComplete="off"
              className="w-full rounded-full bg-slate-50 border-slate-200 pr-12 h-12 text-sm font-medium focus-visible:ring-primary/20"
              disabled={activity?.status === 'completed'}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || activity?.status === 'completed'}
              className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 flex-shrink-0 transition-transform active:scale-95"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Senden</span>
            </Button>
          </form>
        </div>
      </footer>

      {!isDirectMessage && chat && (
        <ChatInfoSheet
            chat={chat}
            activity={activity}
            open={isInfoSheetOpen}
            onOpenChange={setInfoSheetOpen}
        />
      )}
      
      {!isDirectMessage && activity && user && chat && (
        <ReviewDialog 
            open={showReviewDialog}
            onOpenChange={setShowReviewDialog}
            activity={activity}
            currentUser={user}
            onReviewSubmitted={() => setHasReviewed(true)}
            participantDetails={chat.participantDetails}
        />
      )}
    </>
  );
}

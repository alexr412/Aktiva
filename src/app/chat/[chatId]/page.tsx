'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { sendMessage, checkIfUserReviewed, markChatAsRead, removeUserFromChat } from '@/lib/firebase/firestore';
import type { Message, Chat, Activity, UserProfile } from '@/lib/types';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInfoSheet } from '@/components/aktvia/chat-info-sheet';
import { ArrowLeft, Send, MoreVertical, Loader2 } from 'lucide-react';
import { CompletionBanner } from '@/components/aktvia/CompletionBanner';
import { MultiPeerReviewDialog } from '@/components/aktvia/multi-peer-review-dialog';
import { UserBadge } from '@/components/common/UserBadge';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DateSeparator = ({ date, language }: { date: Date, language: string }) => {
  const formatDate = (d: Date) => {
    if (isToday(d)) return language === 'de' ? 'Heute' : 'Today';
    if (isYesterday(d)) return language === 'de' ? 'Gestern' : 'Yesterday';
    return format(d, 'd. MMMM yyyy', { locale: language === 'de' ? de : enUS });
  };

  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-slate-200 dark:border-neutral-800" />
      </div>
      <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black">
        <span className="bg-slate-50 dark:bg-black/95 px-3 text-slate-400">
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
  language: string;
}) => {
  const badgePremium = isOwnMessage 
    ? Boolean(currentUserProfile?.isPremium) 
    : Boolean(message.isPremium || participantDetails?.[message.senderId]?.isPremium);

  const badgeSupporter = isOwnMessage 
    ? Boolean(currentUserProfile?.isSupporter) 
    : Boolean(message.isSupporter || participantDetails?.[message.senderId]?.isSupporter);

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
              {isOwnMessage ? (language === 'de' ? 'Du' : 'You') : message.senderName}
            </span>
            <UserBadge isPremium={badgePremium} isSupporter={badgeSupporter} size="sm" />
          </Link>
        )}
        
        <div className={cn(
          "max-w-full px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-all inline-block shadow-sm",
          isOwnMessage 
            ? "self-end bg-primary text-primary-foreground rounded-tr-sm" 
            : "self-start bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 border border-slate-100 dark:border-neutral-700 rounded-tl-sm"
        )}>
          {message.text}
          <div className="flex justify-end mt-1">
            <span className={cn(
              "text-[9px] font-bold uppercase",
              isOwnMessage ? "text-primary-foreground/60" : "text-muted-foreground"
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
  const language = useLanguage();
  const [chat, setChat] = useState<Chat | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isInfoSheetOpen, setInfoSheetOpen] = useState(false);
  const [showMultiReviewDialog, setShowMultiReviewDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
      toast({ 
        title: language === 'de' ? "Fehler" : "Error", 
        description: language === 'de' ? "Nachrichten konnten nicht geladen werden." : "Messages could not be loaded.", 
        variant: 'destructive'
      });
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
        setShowMultiReviewDialog(true);
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
      toast({ 
        title: language === 'de' ? "Fehler" : "Error", 
        description: language === 'de' ? "Nachricht konnte nicht gesendet werden." : "Message could not be sent.", 
        variant: 'destructive'
      });
    }
  };

  /**
   * MODUL 20 ARCHITEKTUR-UPDATE:
   * removeUserFromChat entfernt den Nutzer NUR aus dem Chat-Kontext.
   * Der Attendance-Record in der Aktivität bleibt für Reviews erhalten.
   */
  const handleCleanup = async () => {
    if (!chatId || !user) return;
    setIsDeleting(true);
    try {
      await removeUserFromChat(chatId, user.uid);
      toast({ 
        title: language === 'de' ? "Chat entfernt" : "Chat removed", 
        description: language === 'de' ? "Vielen Dank für dein Feedback." : "Thank you for your feedback." 
      });
      router.push('/');
    } catch (error: any) {
      toast({ variant: 'destructive', title: language === 'de' ? "Fehler beim Entfernen" : "Error removing chat", description: error.message });
      setIsDeleting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-white/80 dark:bg-neutral-900/80 px-4 backdrop-blur-sm shadow-sm">
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
      <div className="flex flex-col h-full bg-slate-50 dark:bg-black/95 overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-white/90 dark:bg-neutral-900/90 px-2 backdrop-blur-md shadow-sm">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500 dark:text-neutral-400" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1 truncate">
            {isDirectMessage && otherUser ? (
                <Link href={`/profile/${otherUser.uid}`} className="flex items-center gap-2.5 truncate hover:opacity-80 transition-opacity cursor-pointer">
                    <Avatar className={cn(
                      "h-9 w-9 shadow-sm border border-white dark:border-neutral-800",
                      otherUser.isPremium ? "ring-2 ring-amber-400" : (otherUser.isSupporter ? "ring-2 ring-pink-400" : "")
                    )}>
                        <AvatarImage src={otherUser.photoURL || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">{otherUser.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1.5 truncate">
                      <h2 className="font-black text-slate-900 dark:text-neutral-100 truncate tracking-tight">{otherUser.displayName}</h2>
                      <UserBadge isPremium={otherUser.isPremium} isSupporter={otherUser.isSupporter} size="sm" />
                    </div>
                </Link>
            ) : (
                <div className="flex items-center gap-2.5 truncate">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-black text-xs uppercase">{chat?.placeName?.charAt(0)}</span>
                  </div>
                  <h2 className="font-black text-slate-900 dark:text-neutral-100 truncate tracking-tight">{chat?.placeName}</h2>
                </div>
            )}
          </div>

          {!isDirectMessage && (
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500 dark:text-neutral-400" onClick={() => setInfoSheetOpen(true)}>
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
                  {showDateSeparator && message.sentAt && <DateSeparator date={message.sentAt.toDate()} language={language} />}
                  <MessageBubble
                    message={message}
                    isOwnMessage={isOwnMessage}
                    isFirstInGroup={isFirstInGroup}
                    currentUserProfile={userProfile}
                    participantDetails={chat?.participantDetails}
                    language={language}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <footer className="fixed bottom-[72px] left-0 right-0 z-10 mx-auto w-full max-w-3xl bg-white dark:bg-neutral-900 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.05)] border-t border-slate-200 dark:border-neutral-800 transition-colors">
        <div className="p-3 sm:p-4">
          <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={language === 'de' ? "Nachricht schreiben..." : "Write a message..."}
              autoComplete="off"
              className="w-full rounded-full bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 pr-12 h-12 text-sm font-medium focus-visible:ring-primary/20 text-foreground"
              disabled={activity?.status === 'completed'}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || activity?.status === 'completed'}
              className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 flex-shrink-0 transition-transform active:scale-95"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">{language === 'de' ? 'Senden' : 'Send'}</span>
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
      
      {!isDirectMessage && activity && user && (
        <MultiPeerReviewDialog 
            open={showMultiReviewDialog}
            onOpenChange={setShowMultiReviewDialog}
            activity={activity}
            currentUser={user}
            onReviewSubmitted={() => {
                setHasReviewed(true);
                setShowCleanupDialog(true);
            }}
        />
      )}

      {/* MODUL 20: Post-Review Cleanup AlertDialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl dark:bg-neutral-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-center dark:text-neutral-100">{language === 'de' ? 'Treffen beendet' : 'Meetup finished'}</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base font-medium dark:text-neutral-400">
              {language === 'de' ? 'Möchtest du den zugehörigen Chat jetzt aus deiner Liste entfernen?' : 'Would you like to remove the associated chat from your list now?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-3 sm:gap-0 mt-6">
            <AlertDialogCancel className="rounded-xl font-bold h-12 dark:bg-neutral-800 dark:text-neutral-300">{language === 'de' ? 'Später' : 'Later'}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCleanup} 
              disabled={isDeleting}
              className="rounded-xl font-black h-12 bg-slate-900 dark:bg-primary hover:bg-black dark:hover:bg-primary/90 shadow-xl"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === 'de' ? "Ja, jetzt entfernen" : "Yes, remove now")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { sendMessage, checkIfUserReviewed, markChatAsRead, removeUserFromChat, editMessage, pinMessage, unpinMessage } from '@/lib/firebase/firestore';
import { validateChatMessage } from '@/lib/moderation/blacklist';
import type { Message, Chat, Activity, UserProfile, Place } from '@/lib/types';
import { collection, doc, onSnapshot, orderBy, query, limitToLast } from 'firebase/firestore';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import Link from 'next/link';
import { getPrimaryIconData, getRoomVisualCategory } from '@/lib/tag-config';

import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInfoSheet } from '@/components/aktiva/chat-info-sheet';
import { PlaceDetails } from '@/components/aktiva/place-details';
import { RoomInfoSheet } from '@/components/chat/room-info-sheet';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, Send, MoreVertical, Loader2, Users, Info, Reply, Edit3, Pin, Copy, CornerUpLeft, X, PinOff, Check } from 'lucide-react';
import { CompletionBanner } from '@/components/aktiva/CompletionBanner';
import { MultiPeerReviewDialog } from '@/components/aktiva/multi-peer-review-dialog';
import { UserBadge } from '@/components/common/UserBadge';
import { cn, formatFirstName } from '@/lib/utils';
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

const getColorForUser = (userId: string) => {
  const colors = [
    'text-red-500', 'text-blue-500', 'text-emerald-500', 'text-amber-500', 
    'text-purple-500', 'text-pink-500', 'text-indigo-500', 'text-cyan-500',
    'text-rose-500', 'text-teal-500', 'text-sky-500', 'text-fuchsia-500'
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const MessageBubble = ({
  message,
  isOwnMessage,
  currentUserProfile,
  participantDetails,
  isFirstInGroup,
  language,
  isDirectMessage,
  activeMenuMessageId,
  onToggleMenu,
  onReply,
  onEdit,
  onPin,
  onCopy,
}: {
  message: Message;
  isOwnMessage: boolean;
  currentUserProfile?: UserProfile | null;
  participantDetails?: Chat['participantDetails'];
  isFirstInGroup: boolean;
  language: string;
  isDirectMessage: boolean;
  activeMenuMessageId: string | null;
  onToggleMenu: (messageId: string | null) => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onPin: (message: Message) => void;
  onCopy: (message: Message) => void;
}) => {
  const badgePremium = isOwnMessage 
    ? Boolean(currentUserProfile?.isPremium) 
    : Boolean(message.isPremium || participantDetails?.[message.senderId]?.isPremium);

  const badgeSupporter = isOwnMessage 
    ? Boolean(currentUserProfile?.isSupporter) 
    : Boolean(message.isSupporter || participantDetails?.[message.senderId]?.isSupporter);

  const badgeCreator = isOwnMessage
    ? Boolean(currentUserProfile?.isCreator)
    : Boolean(message.isCreator || participantDetails?.[message.senderId]?.isCreator);

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
        {isFirstInGroup && !isDirectMessage && !isOwnMessage && (
          <Link 
            href={`/users/${message.senderId}`} 
            className="flex items-center gap-1 mb-1 mx-1 hover:opacity-80 transition-opacity cursor-pointer group h-4"
          >
            <span className={cn("text-[10px] font-black uppercase tracking-wider group-hover:underline leading-none flex items-center", getColorForUser(message.senderId))}>
              {formatFirstName(message.senderName, "User")}
            </span>
            <UserBadge isPremium={badgePremium} isSupporter={badgeSupporter} isCreator={badgeCreator} size="sm" />
          </Link>
        )}
        
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu(message.id);
          }}
          className={cn(
            "max-w-full rounded-2xl text-sm whitespace-pre-wrap break-all inline-block shadow-sm relative overflow-hidden cursor-pointer select-none transition-all duration-250 active:scale-[0.99]",
            isOwnMessage 
              ? "self-end bg-primary text-primary-foreground rounded-tr-sm" 
              : "self-start bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 border border-slate-100 dark:border-neutral-700 rounded-tl-sm"
          )}
        >
          {/* Reply Quote Block */}
          {message.replyToText && (
            <div className={cn(
              "px-3 py-2 border-l-4 text-xs truncate max-w-full bg-black/10 dark:bg-white/5",
              isOwnMessage 
                ? "border-primary-foreground/50 text-primary-foreground/90" 
                : "border-primary text-slate-700 dark:text-neutral-305"
            )}>
              <div className="font-black uppercase tracking-wider text-[9px] mb-0.5 opacity-80">
                {message.replyToSenderName}
              </div>
              <div className="italic truncate">{message.replyToText}</div>
            </div>
          )}

          <div className="px-4 py-2">
            <div>{message.text}</div>
            <div className="flex justify-end items-center gap-1.5 mt-1">
              {message.isEdited && (
                <span className={cn(
                  "text-[8px] font-black uppercase opacity-60",
                  isOwnMessage ? "text-primary-foreground/70" : "text-slate-450 dark:text-neutral-500"
                )}>
                  {language === 'de' ? 'bearbeitet' : 'edited'}
                </span>
              )}
              <span className={cn(
                "text-[9px] font-bold uppercase",
                isOwnMessage ? "text-primary-foreground/60" : "text-muted-foreground"
              )}>
                {message.sentAt ? format(message.sentAt.toDate(), 'p') : '...'}
              </span>
            </div>
          </div>
        </div>

        {/* WhatsApp-like Context Action Menu */}
        {activeMenuMessageId === message.id && (
          <div className={cn(
            "flex items-center gap-1.5 p-1 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200 dark:border-neutral-800 z-20 mt-1.5 transition-all animate-in fade-in slide-in-from-top-1 duration-150",
            isOwnMessage ? "self-end" : "self-start"
          )}>
            <button 
              onClick={(e) => { e.stopPropagation(); onReply(message); }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full text-slate-600 dark:text-neutral-300 hover:text-primary dark:hover:text-primary transition-colors"
              title={language === 'de' ? 'Antworten' : 'Reply'}
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
            </button>
            
            {isOwnMessage && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(message); }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full text-slate-600 dark:text-neutral-300 hover:text-primary dark:hover:text-primary transition-colors"
                title={language === 'de' ? 'Bearbeiten' : 'Edit'}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}

            {!isDirectMessage && (
              <button 
                onClick={(e) => { e.stopPropagation(); onPin(message); }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full text-slate-600 dark:text-neutral-300 hover:text-primary dark:hover:text-primary transition-colors"
                title={language === 'de' ? 'Anpinnen' : 'Pin'}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
            )}

            <button 
              onClick={(e) => { e.stopPropagation(); onCopy(message); }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full text-slate-600 dark:text-neutral-300 hover:text-primary dark:hover:text-primary transition-colors"
              title={language === 'de' ? 'Kopieren' : 'Copy'}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function ChatRoomPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const language = useLanguage();
  const [chat, setChat] = useState<Chat | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [isPlaceDetailsOpen, setPlaceDetailsOpen] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sentMessageTimestamps, setSentMessageTimestamps] = useState<number[]>([]);
  
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInfoSheetOpen, setInfoSheetOpen] = useState(false);
  const [showMultiReviewDialog, setShowMultiReviewDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(true);
  
  const [otherUser, setOtherUser] = useState<Partial<UserProfile> & { uid?: string; isPremium?: boolean; isSupporter?: boolean; isCreator?: boolean } | null>(null);
  const [isDirectMessage, setIsDirectMessage] = useState(false);
  
  const router = useRouter();
  const params = useParams();
  const chatId = params.chatId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const messagesUnsubscribeRef = useRef<(() => void) | null>(null);
  const leavingChatIdRef = useRef<string | null>(null);
  const chatScopedUnsubscribesRef = useRef<Set<() => void>>(new Set());

  const prepareLeave = (targetChatId: string) => {
    leavingChatIdRef.current = targetChatId;
    
    if (messagesUnsubscribeRef.current) {
      messagesUnsubscribeRef.current();
      messagesUnsubscribeRef.current = null;
    }

    chatScopedUnsubscribesRef.current.forEach((unsub) => {
      try {
        unsub();
      } catch (err) {
        console.error("Error during unsubscribe:", err);
      }
    });
    chatScopedUnsubscribesRef.current.clear();
    
    setMessages([]);
    setChat(null);
    setInfoSheetOpen(false);
    setShowRoomInfo(false);
    setPlaceDetailsOpen(false);
  };

  const handleLeaveError = () => {
    leavingChatIdRef.current = null;
  };

  // Auth & Onboarding Guards
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/login?redirect=/chat/${chatId}`);
      return;
    }
    if (userProfile && !userProfile.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }
  }, [user, userProfile, authLoading, chatId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  useEffect(() => {
    if (!chatId || !user) return;

    const currentChatId = chatId;
    let activityUnsubscribe: (() => void) | undefined;
    let placeUnsubscribe: (() => void) | undefined;

    const handleListenerError = (listenerName: string, targetChatId: string, customMsg?: string) => (error: any) => {
      const isLeavingThisChat = leavingChatIdRef.current === targetChatId;
      const isPermissionDenied = error?.code === 'permission-denied' || 
                                 error?.message?.includes('permission-denied') || 
                                 error?.message?.includes('insufficient permissions');

      if (isLeavingThisChat && isPermissionDenied) {
        console.log(`Suppressed expected permission-denied error for ${listenerName} while leaving chat:`, targetChatId);
        return;
      }

      console.error(`Error in ${listenerName}:`, error);
      toast({ 
        title: language === 'de' ? "Fehler" : "Error", 
        description: customMsg || (language === 'de' ? "Daten konnten nicht geladen werden." : "Data could not be loaded."), 
        variant: 'destructive'
      });
    };

    const chatUnsubscribe = onSnapshot(doc(db!, 'chats', currentChatId), (chatDoc) => {
      if (chatDoc.exists()) {
        // Reset leavingChatIdRef only on successful chat load
        leavingChatIdRef.current = null;

        const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;

        // Access Control: Only allow participants of the chat to enter
        const isParticipant = chatData.participantIds?.includes(user?.uid || '');
        if (!isParticipant) {
          toast({
            variant: "destructive",
            title: language === "de" ? "Zugriff verweigert" : "Access Denied",
            description: language === "de" ? "Du bist kein Teilnehmer dieses Chats." : "You are not a participant in this chat."
          });
          router.replace("/chat");
          return;
        }

        setChat(chatData);

        const isDM = !chatData.activityId;
        setIsDirectMessage(isDM);

        if (isDM) {
          const otherUserId = chatData.participantIds.find(id => id !== user.uid);
          if (otherUserId && chatData.participantDetails) {
            setOtherUser({ ...chatData.participantDetails[otherUserId], uid: otherUserId });
          }
          setActivity(null);
          setPlace(null);
          if (activityUnsubscribe) {
            activityUnsubscribe();
            chatScopedUnsubscribesRef.current.delete(activityUnsubscribe);
            activityUnsubscribe = undefined;
          }
          if (placeUnsubscribe) {
            placeUnsubscribe();
            chatScopedUnsubscribesRef.current.delete(placeUnsubscribe);
            placeUnsubscribe = undefined;
          }
        } else {
          setOtherUser(null);
          if (activityUnsubscribe) {
            activityUnsubscribe();
            chatScopedUnsubscribesRef.current.delete(activityUnsubscribe);
            activityUnsubscribe = undefined;
          }
          
          const rawActivityUnsubscribe = onSnapshot(doc(db!, 'activities', chatData.activityId!), (activityDoc) => {
              if (activityDoc.exists()) {
                  const activityData = { id: activityDoc.id, ...activityDoc.data() } as Activity;
                  setActivity(activityData);

                  if (activityData.status === 'completed' && activityData.id) {
                      checkIfUserReviewed(activityData.id, user.uid).then(setHasReviewed);
                  }

                  if (placeUnsubscribe) {
                      placeUnsubscribe();
                      chatScopedUnsubscribesRef.current.delete(placeUnsubscribe);
                      placeUnsubscribe = undefined;
                  }
                  if (activityData.placeId) {
                      const rawPlaceUnsubscribe = onSnapshot(doc(db!, 'places', activityData.placeId), (placeDoc) => {
                          if (placeDoc.exists()) {
                              setPlace({ id: placeDoc.id, ...placeDoc.data() } as Place);
                          } else {
                              setPlace(null);
                          }
                      }, handleListenerError('places', currentChatId));
                      placeUnsubscribe = rawPlaceUnsubscribe;
                      chatScopedUnsubscribesRef.current.add(rawPlaceUnsubscribe);
                  }
              } else {
                setActivity(null);
                setPlace(null);
              }
          }, handleListenerError('activities', currentChatId));
          activityUnsubscribe = rawActivityUnsubscribe;
          chatScopedUnsubscribesRef.current.add(rawActivityUnsubscribe);
        }
      } else {
        setLoading(false);
        setChat(null);
        router.replace('/chat');
      }
    }, handleListenerError('chats', currentChatId));
    chatScopedUnsubscribesRef.current.add(chatUnsubscribe);

    if (messagesUnsubscribeRef.current) {
      messagesUnsubscribeRef.current();
      messagesUnsubscribeRef.current = null;
    }

    const messagesQuery = query(
      collection(db!, 'chats', currentChatId, 'messages'), 
      orderBy('sentAt', 'asc'), 
      limitToLast(100)
    );
    const messagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(newMessages);
      setLoading(false);
    }, handleListenerError('messages', currentChatId, language === 'de' ? "Nachrichten konnten nicht geladen werden." : "Messages could not be loaded."));

    messagesUnsubscribeRef.current = messagesUnsubscribe;

    return () => {
      chatUnsubscribe();
      chatScopedUnsubscribesRef.current.delete(chatUnsubscribe);
      if (messagesUnsubscribeRef.current === messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribeRef.current = null;
      }
      if (activityUnsubscribe) {
        activityUnsubscribe();
        chatScopedUnsubscribesRef.current.delete(activityUnsubscribe);
      }
      if (placeUnsubscribe) {
        placeUnsubscribe();
        chatScopedUnsubscribesRef.current.delete(placeUnsubscribe);
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

  const handlePinMessage = async (msg: Message) => {
    setActiveMenuMessageId(null);
    try {
      await pinMessage(chatId, msg.id, msg.text, msg.senderName || "Anonymer Nutzer");
      toast({
        title: language === 'de' ? 'Nachricht angepinnt' : 'Message pinned',
        description: language === 'de' ? 'Die Nachricht wurde oben angepinnt.' : 'The message was pinned at the top.'
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message
      });
    }
  };

  const handleCopyMessage = (msg: Message) => {
    setActiveMenuMessageId(null);
    navigator.clipboard.writeText(msg.text);
    toast({
      title: language === 'de' ? 'Kopiert!' : 'Copied!',
      description: language === 'de' ? 'Nachricht in Zwischenablage kopiert.' : 'Message copied to clipboard.'
    });
  };

  const handleStartEditMessage = (msg: Message) => {
    setActiveMenuMessageId(null);
    setReplyingToMessage(null);
    setEditingMessage(msg);
    setNewMessage(msg.text);
  };

  const handleStartReplyMessage = (msg: Message) => {
    setActiveMenuMessageId(null);
    setEditingMessage(null);
    setReplyingToMessage(msg);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user || isSending) return;

    if (newMessage.trim().length > 2000) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? "Nachricht zu lang" : "Message too long",
        description: language === 'de' ? "Die Nachricht darf maximal 2000 Zeichen lang sein." : "The message cannot exceed 2000 characters."
      });
      return;
    }

    // 1. Client-side moderation check
    if (!validateChatMessage(newMessage)) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? "Inhalt blockiert" : "Content Blocked",
        description: language === 'de' ? "Diese Nachricht enthält nicht erlaubte Inhalte." : "This message contains disallowed content."
      });
      return;
    }

    // 2. Chat rate limiting: max 5 messages in 10 seconds
    const now = Date.now();
    const tenSecondsAgo = now - 10000;
    const recentTimestamps = sentMessageTimestamps.filter(t => t > tenSecondsAgo);

    if (recentTimestamps.length >= 5) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? "Spam-Schutz" : "Spam Protection",
        description: language === 'de' ? "Bitte warte einen Moment, bevor du weitere Nachrichten sendest." : "Please wait a moment before sending more messages."
      });
      return;
    }

    const currentMessage = newMessage;
    setNewMessage('');

    setIsSending(true);
    if (editingMessage) {
      const msgId = editingMessage.id;
      setEditingMessage(null);
      try {
        await editMessage(chatId, msgId, currentMessage);
      } catch (error: any) {
        console.error(error);
        toast({ 
          title: language === 'de' ? "Fehler" : "Error", 
          description: error.message || (language === 'de' ? "Nachricht konnte nicht bearbeitet werden." : "Message could not be edited."), 
          variant: 'destructive'
        });
      } finally {
        setIsSending(false);
      }
    } else {
      const replyPayload = replyingToMessage ? {
        id: replyingToMessage.id,
        text: replyingToMessage.text,
        senderName: replyingToMessage.senderName || "Anonymer Nutzer"
      } : null;
      setReplyingToMessage(null);
      try {
        await sendMessage(chatId, currentMessage, user, userProfile, replyPayload);
        setSentMessageTimestamps([...recentTimestamps, now]);
      } catch (error: any) {
        console.error(error);
        setNewMessage(currentMessage);
        toast({ 
          title: language === 'de' ? "Fehler" : "Error", 
          description: error.message || (language === 'de' ? "Nachricht konnte nicht gesendet werden." : "Message could not be sent."), 
          variant: 'destructive'
        });
      } finally {
        setIsSending(false);
      }
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
      prepareLeave(chatId);
      await removeUserFromChat(chatId, user.uid);
      toast({ 
        title: language === 'de' ? "Chat entfernt" : "Chat removed", 
        description: language === 'de' ? "Vielen Dank für dein Feedback." : "Thank you for your feedback." 
      });
      router.push('/');
    } catch (error: any) {
      handleLeaveError();
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
      <div onClick={() => setActiveMenuMessageId(null)} className="flex flex-col h-full bg-slate-50 dark:bg-black/95 overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-white/90 dark:bg-neutral-900/90 px-2 backdrop-blur-md shadow-sm">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500 dark:text-neutral-400" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1 truncate">
            {isDirectMessage && otherUser ? (
                <Link href={`/users/${otherUser.uid}`} className="flex items-center gap-2.5 truncate hover:opacity-80 transition-opacity cursor-pointer">
                    <ProfileAvatar 
                      className="h-9 w-9 shadow-sm border border-white dark:border-neutral-800"
                      photoURL={otherUser.photoURL}
                      displayName={otherUser.displayName}
                      isPremium={otherUser.isPremium}
                      isCreator={otherUser.isCreator}
                      isSupporter={otherUser.isSupporter}
                    />
                    <div className="flex items-center gap-1.5 truncate">
                      <h1 className="">{formatFirstName(otherUser.displayName, "User")}</h1>
                      <UserBadge isPremium={otherUser.isPremium} isSupporter={otherUser.isSupporter} isCreator={otherUser.isCreator} size="sm" />
                    </div>
                </Link>
            ) : (
                <div 
                  className="flex items-center gap-2.5 truncate"
                >
                  {activity ? (
                    (() => {
                      const visualCategoryData = getRoomVisualCategory({ activity, place, chat });
                      const primaryStyle = getPrimaryIconData(visualCategoryData, language);
                      const PrimaryIcon = primaryStyle.icon;
                      return (
                        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm", primaryStyle.gradientClass || "bg-primary/10")}>
                          <PrimaryIcon className="text-white h-5 w-5 text-white drop-shadow-sm" />
                        </div>
                      );
                    })()
                  ) : (
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <h1 className="font-black text-lg text-slate-900 dark:text-neutral-100 truncate flex items-center gap-1.5">
                    {activity?.title || chat?.placeName}
                    {place && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowRoomInfo(true);
                        }}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-450 hover:text-primary hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors shrink-0 outline-none"
                        title={language === 'de' ? 'Raum-Info' : 'Room Info'}
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </h1>
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

        {/* Pinned Messages Bar */}
        {chat?.pinnedMessages && chat.pinnedMessages.length > 0 && (
          <div className="sticky top-0 z-10 w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-slate-200 dark:border-neutral-800 px-4 py-2 flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-250">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Pin className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'de' ? 'Angepinnte Nachricht' : 'Pinned Message'}
                </span>
                <span className="block text-xs text-slate-850 dark:text-neutral-250 truncate font-semibold">
                  <strong>{formatFirstName(chat.pinnedMessages[chat.pinnedMessages.length - 1].senderName, "User")}:</strong> {chat.pinnedMessages[chat.pinnedMessages.length - 1].text}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 rounded-full text-[10px] font-black uppercase text-primary hover:bg-primary/5"
                onClick={() => {
                  const msgId = chat.pinnedMessages![chat.pinnedMessages!.length - 1].id;
                  const el = document.getElementById(`msg-${msgId}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('bg-primary/10', 'dark:bg-primary/20');
                    setTimeout(() => {
                      el.classList.remove('bg-primary/10', 'dark:bg-primary/20');
                    }, 2000);
                  } else {
                    toast({
                      description: language === 'de' ? 'Nachricht ist weiter oben' : 'Message is further up'
                    });
                  }
                }}
              >
                {language === 'de' ? 'Anzeigen' : 'View'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-slate-400 hover:text-rose-500"
                onClick={async () => {
                  const lastPin = chat.pinnedMessages![chat.pinnedMessages!.length - 1];
                  try {
                    await unpinMessage(chatId, lastPin.id);
                    toast({
                      title: language === 'de' ? 'Nachricht losgelöst' : 'Message unpinned'
                    });
                  } catch (error: any) {
                    toast({
                      variant: 'destructive',
                      title: language === 'de' ? 'Fehler' : 'Error',
                      description: error.message
                    });
                  }
                }}
              >
                <PinOff className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pt-4 pb-32">
          <div className="flex flex-col w-full max-w-3xl mx-auto">
            {messages.map((message, index) => {
              const prevMessage = messages[index - 1];
              const isOwnMessage = message.senderId === user?.uid;
              
              const showDateSeparator = !prevMessage || !prevMessage.sentAt || !message.sentAt || !isSameDay(message.sentAt.toDate(), prevMessage.sentAt.toDate());
              const isFirstInGroup = !prevMessage || prevMessage.senderId !== message.senderId || showDateSeparator;
              
              return (
                <div key={message.id} id={`msg-${message.id}`} className="w-full transition-all duration-300 rounded-xl">
                  {showDateSeparator && message.sentAt && <DateSeparator date={message.sentAt.toDate()} language={language} />}
                  <MessageBubble
                    message={message}
                    isOwnMessage={isOwnMessage}
                    isFirstInGroup={isFirstInGroup}
                    currentUserProfile={userProfile}
                    participantDetails={chat?.participantDetails}
                    language={language}
                    isDirectMessage={isDirectMessage}
                    activeMenuMessageId={activeMenuMessageId}
                    onToggleMenu={(id) => setActiveMenuMessageId(activeMenuMessageId === id ? null : id)}
                    onReply={handleStartReplyMessage}
                    onEdit={handleStartEditMessage}
                    onPin={handlePinMessage}
                    onCopy={handleCopyMessage}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <footer className="fixed bottom-[72px] left-0 right-0 z-10 mx-auto w-full max-w-3xl bg-white dark:bg-neutral-900 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.05)] border-t border-slate-200 dark:border-neutral-800 transition-colors">
        {/* Reply Preview */}
        {replyingToMessage && (
          <div className="px-4 py-2 bg-slate-50 dark:bg-neutral-800/50 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex-1 min-w-0 border-l-4 border-primary pl-2.5">
              <span className="block text-[9px] font-black uppercase text-primary tracking-wider truncate">
                {language === 'de' ? 'Antworten auf' : 'Replying to'} {formatFirstName(replyingToMessage.senderName, "User")}
              </span>
              <span className="block text-xs text-slate-500 dark:text-neutral-400 truncate">
                {replyingToMessage.text}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
              onClick={() => setReplyingToMessage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Edit Preview */}
        {editingMessage && (
          <div className="px-4 py-2 bg-amber-500/5 dark:bg-amber-500/10 border-b border-amber-500/10 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex-1 min-w-0 border-l-4 border-amber-500 pl-2.5">
              <span className="block text-[9px] font-black uppercase text-amber-500 tracking-wider truncate">
                {language === 'de' ? 'Nachricht bearbeiten' : 'Edit message'}
              </span>
              <span className="block text-xs text-slate-500 dark:text-neutral-400 truncate">
                {editingMessage.text}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
              onClick={() => {
                setEditingMessage(null);
                setNewMessage('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="p-3 sm:p-4">
          {activity && (activity.status === 'completed' || activity.status === 'cancelled' || activity.status === 'blacklisted') ? (
            <div className="text-center text-xs font-bold text-slate-400 py-3 bg-slate-50 dark:bg-neutral-850/20 rounded-2xl border border-slate-100 dark:border-neutral-800">
              {language === 'de'
                ? 'Dieser Chat ist archiviert, da die Aktivität beendet oder abgesagt wurde.'
                : 'This chat is archived because the activity has ended or been cancelled.'}
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={(e) => {
                  if (e.target.value.length <= 2000) {
                    setNewMessage(e.target.value);
                  }
                }}
                placeholder={language === 'de' ? "Nachricht schreiben..." : "Write a message..."}
                autoComplete="off"
                className="w-full rounded-full bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 pr-12 h-12 text-sm font-medium focus-visible:ring-primary/20 text-foreground"
                disabled={isSending}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newMessage.trim() || isSending}
                className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 flex-shrink-0 transition-transform active:scale-95"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">{language === 'de' ? 'Senden' : 'Send'}</span>
              </Button>
            </form>
          )}
        </div>
      </footer>

      {!isDirectMessage && chat && (
        <ChatInfoSheet
            chat={chat}
            activity={activity}
            open={isInfoSheetOpen}
            onOpenChange={setInfoSheetOpen}
            onBeforeLeave={() => prepareLeave(chatId)}
            onLeaveError={handleLeaveError}
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

      {/* Room specific Info Sheet */}
      {!isDirectMessage && chat && (
        <RoomInfoSheet
          open={showRoomInfo}
          onOpenChange={setShowRoomInfo}
          chat={chat}
          activity={activity}
          place={place}
          participants={chat.participantDetails}
          currentUserId={user?.uid}
          onViewPlace={() => {
            setShowRoomInfo(false);
            setPlaceDetailsOpen(true);
          }}
          onBeforeLeave={() => prepareLeave(chatId)}
          onLeaveError={handleLeaveError}
        />
      )}

      {/* Place/Spot Details Sheet */}
      {place && (
        <Sheet open={isPlaceDetailsOpen} onOpenChange={setPlaceDetailsOpen}>
          <SheetContent side="bottom" className="p-0 h-[92vh] w-full border-none rounded-t-[2.5rem] overflow-hidden outline-none bg-white dark:bg-neutral-900">
            <SheetHeader className="sr-only">
              <SheetTitle>{place.name}</SheetTitle>
            </SheetHeader>
            <div className="h-full w-full">
              {isPlaceDetailsOpen && (
                <PlaceDetails 
                  place={place} 
                  onClose={() => setPlaceDetailsOpen(false)} 
                  onCreateActivity={() => {}} 
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

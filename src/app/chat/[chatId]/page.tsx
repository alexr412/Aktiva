'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { sendMessage, checkIfUserReviewed } from '@/lib/firebase/firestore';
import type { Message, Chat, Activity } from '@/lib/types';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInfoSheet } from '@/components/aktvia/chat-info-sheet';
import { ArrowLeft, Send, MoreVertical, Star } from 'lucide-react';
import { CompletionBanner } from '@/components/aktvia/CompletionBanner';
import { ReviewDialog } from '@/components/reviews/ReviewDialog';

const DateSeparator = ({ date }: { date: Date }) => {
  const formatDate = (d: Date) => {
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
  };

  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-muted/30 px-2 text-muted-foreground font-semibold">
          {formatDate(date)}
        </span>
      </div>
    </div>
  );
};

const MessageBubble = ({
  message,
  isOwnMessage,
  showAvatar,
  isFirstInGroup,
  showSenderName,
}: {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  isFirstInGroup: boolean;
  showSenderName: boolean;
}) => {
  const bubbleClasses = isOwnMessage
    ? 'bg-primary text-primary-foreground rounded-l-xl rounded-t-xl'
    : 'bg-card text-card-foreground border shadow-sm rounded-r-xl rounded-t-xl';

  const wrapperClasses = `flex items-start gap-3 ${
    isOwnMessage ? 'justify-end' : ''
  } ${isFirstInGroup ? 'mt-4' : 'mt-1'}`;

  return (
    <div className={wrapperClasses}>
      {!isOwnMessage && (
        <div className="w-8 flex-shrink-0 self-end">
          {showAvatar && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={message.senderPhotoURL || undefined} />
              <AvatarFallback>{message.senderName?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
        </div>
      )}
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {showSenderName && (
          <p className="text-xs text-muted-foreground ml-2 mb-0.5">{message.senderName}</p>
        )}
        <div className={`relative max-w-xs md:max-w-md px-4 py-2 ${bubbleClasses}`}>
          <p className="text-sm pb-1 pr-12 break-words">{message.text}</p>
          <span className="absolute bottom-1.5 right-3 text-xs opacity-70">
            {message.sentAt ? format(message.sentAt.toDate(), 'p') : '...'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function ChatRoomPage() {
  const { user, loading: authLoading } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isInfoSheetOpen, setInfoSheetOpen] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(true); // Default to true to prevent flash
  
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

    // Listen to Chat document
    const chatUnsubscribe = onSnapshot(doc(db, 'chats', chatId), (chatDoc) => {
      if (chatDoc.exists()) {
        const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
        setChat(chatData);

        // Once we have the chat, listen to the associated Activity document
        const activityUnsubscribe = onSnapshot(doc(db, 'activities', chatData.activityId), (activityDoc) => {
            if (activityDoc.exists()) {
                const activityData = { id: activityDoc.id, ...activityDoc.data() } as Activity;
                setActivity(activityData);

                // Check if user has reviewed if activity is completed
                if (activityData.status === 'completed') {
                    checkIfUserReviewed(activityData.id!, user.uid).then(setHasReviewed);
                }

            } else {
              setActivity(null);
            }
        });
        return () => activityUnsubscribe();

      } else {
        toast({ title: "Chat not found", description: "This chat may have been deleted.", variant: 'destructive'});
        router.push('/chat');
      }
    });

    // Listen to Messages subcollection
    const messagesQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('sentAt', 'asc'));
    const messagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(newMessages);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      toast({ title: "Error", description: "Could not load messages.", variant: 'destructive'});
      setLoading(false);
    });

    return () => {
      chatUnsubscribe();
      messagesUnsubscribe();
    };
  }, [chatId, router, toast, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user) return;

    const currentMessage = newMessage;
    setNewMessage('');
    try {
      await sendMessage(chatId, currentMessage, user);
    } catch (error) {
      console.error(error);
      setNewMessage(currentMessage);
      toast({ title: "Error", description: "Could not send message.", variant: 'destructive'});
    }
  };

  const renderReviewTrigger = () => {
    if (activity?.status !== 'completed' || hasReviewed || !user) return null;
    
    const otherParticipants = activity.participantIds.filter(id => id !== user.uid);
    if (otherParticipants.length === 0) return null;

    return (
      <div className="p-4">
        <Button onClick={() => setShowReviewDialog(true)} className="w-full">
            <Star className="mr-2 h-4 w-4" />
            Bewerten Sie die Aktivität
        </Button>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="flex flex-col h-full bg-muted/30">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </header>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-12 w-1/2 self-end" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full bg-muted/30">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/90 px-2 backdrop-blur-sm sm:px-4">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <div className="flex-1 truncate">
            <h2 className="font-bold truncate">{chat?.placeName}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setInfoSheetOpen(true)}>
            <MoreVertical />
            <span className='sr-only'>Chat Info</span>
          </Button>
        </header>

        {activity && user && activity.status === 'active' && activity.completionVotes.length > 0 && (
          <CompletionBanner activity={activity} currentUser={user} />
        )}

        {renderReviewTrigger()}

        <div className="flex-1 overflow-y-auto p-4 pb-40">
          <div className="flex flex-col">
            {messages.map((message, index) => {
              const prevMessage = messages[index - 1];
              const nextMessage = messages[index + 1];
              const isOwnMessage = message.senderId === user?.uid;
              
              const showDateSeparator = !prevMessage || !prevMessage.sentAt || !message.sentAt || !isSameDay(message.sentAt.toDate(), prevMessage.sentAt.toDate());
              
              const isFirstInGroup = !prevMessage || prevMessage.senderId !== message.senderId || showDateSeparator;
              
              const isLastInGroup = !nextMessage || nextMessage.senderId !== message.senderId || !nextMessage.sentAt || !message.sentAt || !isSameDay(message.sentAt.toDate(), nextMessage.sentAt.toDate());

              const showAvatar = !isOwnMessage && isLastInGroup;
              const showSenderName = !isOwnMessage && isFirstInGroup;

              return (
                <div key={message.id}>
                  {showDateSeparator && message.sentAt && <DateSeparator date={message.sentAt.toDate()} />}
                  <MessageBubble
                    message={message}
                    isOwnMessage={isOwnMessage}
                    showAvatar={showAvatar}
                    isFirstInGroup={isFirstInGroup}
                    showSenderName={showSenderName}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <footer className="fixed bottom-[72px] left-0 right-0 z-10 mx-auto w-full max-w-3xl border-t bg-background/95 backdrop-blur-sm">
        <div className="p-2 sm:p-4">
          <form onSubmit={handleSendMessage} className="relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message"
              autoComplete="off"
              className="w-full rounded-full bg-muted pr-12 h-12 text-base"
              disabled={activity?.status === 'completed'}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || activity?.status === 'completed'}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
            >
              <Send className="h-5 w-5" />
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </div>
      </footer>

      <ChatInfoSheet
        chat={chat}
        activity={activity}
        open={isInfoSheetOpen}
        onOpenChange={setInfoSheetOpen}
      />
      
      {activity && user && (
        <ReviewDialog 
            open={showReviewDialog}
            onOpenChange={setShowReviewDialog}
            activity={activity}
            currentUser={user}
            onReviewSubmitted={() => setHasReviewed(true)}
        />
      )}
    </>
  );
}

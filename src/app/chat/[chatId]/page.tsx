'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { sendMessage } from '@/lib/firebase/firestore';
import type { Message, Chat } from '@/lib/types';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { format } from 'date-fns';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send } from 'lucide-react';

const MessageBubble = ({ message, isOwnMessage }: { message: Message; isOwnMessage: boolean }) => {
  return (
    <div className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      {!isOwnMessage && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.senderPhotoURL || undefined} />
          <AvatarFallback>{message.senderName?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`group relative max-w-xs md:max-w-md rounded-2xl px-3.5 py-2.5 flex flex-col shadow-sm ${
          isOwnMessage
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-background rounded-bl-none'
        }`}
      >
        {!isOwnMessage && message.senderName && (
          <p className="text-xs font-bold text-primary mb-1">{message.senderName}</p>
        )}
        
        <div className="flex items-end">
            {/* The mr-10 gives space for the absolute positioned timestamp */}
            <p className="text-sm whitespace-pre-wrap mr-10">{message.text}</p>
            <span className={`absolute bottom-1.5 right-2.5 text-xs ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {message.sentAt ? format(message.sentAt.toDate(), 'p') : ''}
            </span>
        </div>
      </div>
    </div>
  );
};

export default function ChatRoomPage() {
  const { user, loading: authLoading } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const chatId = params.chatId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!chatId) return;

    const chatUnsubscribe = onSnapshot(doc(db, 'chats', chatId), (doc) => {
      if (doc.exists()) {
        setChat({ id: doc.id, ...doc.data() } as Chat);
      } else {
        // Handle chat not found
        router.push('/chat');
      }
    });

    const messagesQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('sentAt', 'asc'));
    const messagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(newMessages);
      setLoading(false);
    });

    return () => {
      chatUnsubscribe();
      messagesUnsubscribe();
    };
  }, [chatId, router]);

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
    }
  };
  
  if (loading || authLoading) {
      return (
        <div className="flex flex-col h-full">
            <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-6 w-32" />
            </header>
            <div className="flex-1 p-4 space-y-4">
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-12 w-1/2 self-end" />
                <Skeleton className="h-16 w-2/3" />
            </div>
        </div>
      )
  }

  return (
    <div className="flex flex-col h-full max-h-dvh">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b bg-background/80 px-2 backdrop-blur-sm sm:px-4">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <div className="flex-1 truncate">
            <h2 className="font-bold truncate">{chat?.placeName}</h2>
        </div>
        <div className="flex -space-x-2">
            {chat && Object.values(chat.participantDetails).slice(0,3).map((p, i) => (
                <Avatar key={i} className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={p.photoURL || undefined} />
                    <AvatarFallback>{p.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
            ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} isOwnMessage={message.senderId === user?.uid} />
          ))}
           <div ref={messagesEndRef} />
        </div>
      </div>

      <footer className="bg-background/95 backdrop-blur-sm sticky bottom-0">
        <div className="p-4">
            <form onSubmit={handleSendMessage} className="relative">
            <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                autoComplete="off"
                className="w-full rounded-full pr-12 h-12"
            />
            <Button 
                type="submit" 
                size="icon" 
                disabled={!newMessage.trim()} 
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full"
            >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send message</span>
            </Button>
            </form>
        </div>
      </footer>
    </div>
  );
}

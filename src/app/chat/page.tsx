'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { ChatListSidebar } from '@/components/chat/chat-list-sidebar';
import { MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ChatPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const language = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/chat');
      return;
    }
    if (userProfile && !userProfile.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }
  }, [user, userProfile, authLoading, router]);

  return (
    <div className="flex h-full w-full bg-[#fcfcfb] dark:bg-black/95 overflow-hidden">
      {/* Sidebar: Full width on mobile, 380px-420px fixed column on desktop */}
      <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 h-full">
        <ChatListSidebar />
      </div>

      {/* Desktop Placeholder: Hidden on mobile, flex-1 on desktop */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 text-center h-full bg-slate-50/50 dark:bg-neutral-900/30">
        <div className="bg-emerald-500/10 p-6 rounded-3xl mb-4 border border-emerald-500/20 shadow-sm">
          <MessageSquare className="h-12 w-12 text-emerald-500" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-neutral-100 mb-2">
          {language === 'de' ? 'Deine Unterhaltungen' : 'Your Conversations'}
        </h2>
        <p className="text-sm font-medium text-slate-500 dark:text-neutral-400 max-w-sm mb-6 leading-relaxed">
          {language === 'de' 
            ? 'Wähle links einen Chat aus, um Nachrichten zu lesen oder eine neue Unterhaltung zu beginnen.' 
            : 'Select a chat from the left sidebar to read messages or start a new conversation.'}
        </p>
        <Button asChild className="rounded-2xl h-11 px-6 font-bold shadow-md shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-600">
          <Link href="/">{language === 'de' ? 'Aktivitäten entdecken' : 'Discover activities'}</Link>
        </Button>
      </div>
    </div>
  );
}

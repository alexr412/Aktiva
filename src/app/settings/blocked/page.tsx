'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

export default function BlockedUsersPage() {
    const router = useRouter();
    const language = useLanguage();
    const { userProfile } = useAuth();

    const blockedCount = (userProfile?.blacklist?.hard?.length || 0) + (userProfile?.blacklist?.soft?.length || 0);

    return (
        <div className="flex flex-col h-full w-full bg-secondary overflow-y-auto pb-32">
            <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
                <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="flex items-center gap-2 text-xl font-bold">
                    <Ban className="h-6 w-6 text-primary shrink-0" />
                    <span className="truncate">{language === 'de' ? 'Blockierte Nutzer' : 'Blocked Users'}</span>
                </h1>
            </header>

            <div className="p-6 space-y-4 max-w-2xl mx-auto w-full">
                    {blockedCount === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">
                                {language === 'de' 
                                    ? 'Du hast derzeit keine Nutzer blockiert.' 
                                    : 'You currently have no blocked users.'}
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">
                                {language === 'de' 
                                    ? `Du hast ${blockedCount} Nutzer blockiert.` 
                                    : `You have ${blockedCount} blocked users.`}
                            </p>
                            {/* TODO: Implement list of blocked users and unblock functionality */}
                        </div>
                    )}
                </div>
        </div>
    );
}

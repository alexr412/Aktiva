'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { updateUserProfile } from '@/lib/firebase/firestore';
import { cn } from '@/lib/utils';

export default function LanguageSettingsPage() {
    const router = useRouter();
    const { user, userProfile, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const currentLanguage = useLanguage();

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace('/login?redirect=/settings/language');
            return;
        }
        if (userProfile && userProfile.onboardingCompleted === false) {
            router.replace('/onboarding');
            return;
        }
    }, [user, userProfile, authLoading, router]);

    if (authLoading || !user || (userProfile && userProfile.onboardingCompleted === false)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const handleSelectLanguage = async (lang: 'de' | 'en') => {
        if (!user || lang === currentLanguage) return;
        setIsSaving(true);
        try {
            await updateUserProfile(user.uid, { language: lang });
            toast({
                title: lang === 'en' ? 'Language updated' : 'Sprache aktualisiert',
                description: lang === 'en' ? 'Successfully switched to English.' : 'Erfolgreich auf Deutsch gewechselt.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: currentLanguage === 'de' ? 'Fehler' : 'Error',
                description: currentLanguage === 'de' ? 'Sprache konnte nicht aktualisiert werden.' : 'Failed to update language.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-secondary overflow-y-auto pb-32">
            <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
                <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()} aria-label={currentLanguage === 'de' ? 'Zurück' : 'Back'}>
                    <ArrowLeft />
                </Button>
                <h1 className="flex items-center gap-2">
                    <Globe className="h-7 w-7 text-primary shrink-0" />
                    <span className="truncate">{currentLanguage === 'de' ? 'Spracheinstellungen' : 'Language Settings'}</span>
                </h1>
            </header>

            <div className="p-6 space-y-4 max-w-2xl mx-auto w-full">
                    <div className="space-y-3">
                        <button 
                            disabled={isSaving}
                            onClick={() => handleSelectLanguage('de')} 
                            className={cn(
                                "flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all",
                                currentLanguage === 'de' ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:bg-muted"
                            )}
                        >
                            <div className="flex flex-col">
                                <span className={cn("font-bold text-lg", currentLanguage === 'de' && "text-primary")}>Deutsch</span>
                                <span className="text-sm text-muted-foreground">{currentLanguage === 'de' ? 'App UI und Labels auf Deutsch' : 'App tags and text in German'}</span>
                            </div>
                            {currentLanguage === 'de' && <Check className="h-6 w-6 text-primary" />}
                        </button>

                        <button 
                            disabled={isSaving}
                            onClick={() => handleSelectLanguage('en')} 
                            className={cn(
                                "flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all",
                                currentLanguage === 'en' ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:bg-muted"
                            )}
                        >
                            <div className="flex flex-col">
                                <span className={cn("font-bold text-lg", currentLanguage === 'en' && "text-primary")}>English</span>
                                <span className="text-sm text-muted-foreground">{currentLanguage === 'de' ? 'App UI und Labels auf Englisch' : 'App tags and text in English'}</span>
                            </div>
                            {currentLanguage === 'en' && <Check className="h-6 w-6 text-primary" />}
                        </button>
                    </div>
                    
                    <p className="text-xs text-muted-foreground text-center mt-6">
                        {currentLanguage === 'de' ? 'Diese Einstellung ändert die Sprache der gesamten Benutzeroberfläche und dynamischer Tags.' : 'This language setting primarily affects dynamically generated tags and localized place content.'}
                    </p>
                </div>
        </div>
    );
}

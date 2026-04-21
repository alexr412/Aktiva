'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { updateUserProfile } from '@/lib/firebase/firestore';
import { cn } from '@/lib/utils';

export default function LanguageSettingsPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const currentLanguage = useLanguage();

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
        <div className="flex flex-col h-full bg-secondary">
            <header className="flex h-16 items-center border-b bg-background px-4 shrink-0">
                <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    {currentLanguage === 'de' ? 'Spracheinstellungen' : 'Language Settings'}
                </h1>
            </header>

            <main className="flex-1 overflow-y-auto pb-20">
                <div className="p-6 space-y-4 max-w-2xl mx-auto">
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
            </main>
        </div>
    );
}

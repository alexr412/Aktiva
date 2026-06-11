'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Scale, ChevronRight, FileText, Shield, Gavel, RotateCcw, Code, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

export default function LegalSettingsPage() {
    const router = useRouter();
    const language = useLanguage();

    const legalLinks = [
        {
            title: language === 'de' ? 'Impressum' : 'Imprint',
            icon: FileText,
            href: '/imprint',
            description: language === 'de' ? 'Anbieterkennzeichnung gemäß TMG.' : 'Provider identification according to TMG.'
        },
        {
            title: language === 'de' ? 'Datenschutzerklärung' : 'Privacy Policy',
            icon: Shield,
            href: '/privacy',
            description: language === 'de' ? 'Informationen zur Datenverarbeitung.' : 'Information on data processing.'
        },
        {
            title: language === 'de' ? 'AGB / Nutzungsbedingungen' : 'Terms of Service',
            icon: Gavel,
            href: '/terms',
            description: language === 'de' ? 'Die rechtliche Basis für die Nutzung von Aktiva.' : 'The legal basis for using Aktiva.'
        },
        {
            title: language === 'de' ? 'Widerrufsbelehrung' : 'Cancellation Policy',
            icon: RotateCcw,
            href: '/cancellation',
            description: language === 'de' ? 'Deine Rechte zum Widerruf bei Käufen.' : 'Your rights to cancel purchases.'
        },
        {
            title: language === 'de' ? 'Open-Source-Lizenzen' : 'Open Source Licenses',
            icon: Code,
            href: '/licenses',
            description: language === 'de' ? 'Hinweise zu verwendeten Drittanbieter-Bibliotheken.' : 'Information on third-party libraries used.'
        },
        {
            title: language === 'de' ? 'Barrierefreiheitserklärung' : 'Accessibility Statement',
            icon: Eye,
            href: '/accessibility',
            description: language === 'de' ? 'Dokumentation gemäß BFSG.' : 'Documentation according to BFSG.'
        }
    ];

    return (
        <div className="flex flex-col h-full w-full bg-secondary overflow-y-auto pb-32">
            <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
                <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()} aria-label={language === 'de' ? 'Zurück' : 'Back'}>
                    <ArrowLeft />
                </Button>
                <h1 className="flex items-center gap-2 text-xl font-bold">
                    <Scale className="h-5 w-5 text-primary" />
                    <span>{language === 'de' ? 'Rechtliches' : 'Legal'}</span>
                </h1>
            </header>

            <div className="p-6 space-y-4 max-w-2xl mx-auto w-full">
                <div className="space-y-2">
                    {legalLinks.map((link) => (
                        <button 
                            key={link.href}
                            onClick={() => router.push(link.href)}
                            className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted"
                        >
                            <div className="flex items-start gap-4">
                                <div className="mt-1 bg-primary/10 p-2 rounded-xl">
                                    <link.icon className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{link.title}</p>
                                    <p className="text-xs text-muted-foreground">{link.description}</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </button>
                    ))}
                </div>

                <div className="pt-8 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        Aktiva Version 1.0.0 • 2026
                    </p>
                </div>
            </div>
        </div>
    );
}

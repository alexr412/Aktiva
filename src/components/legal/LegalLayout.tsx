import React from 'react';
import Link from 'next/link';
import { ArrowLeft, LucideIcon } from 'lucide-react';

interface LegalLayoutProps {
  title: string;
  versionText?: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export function LegalLayout({
  title,
  versionText,
  icon: Icon,
  children
}: LegalLayoutProps) {
  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-neutral-950 overflow-y-auto pb-32">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/80 backdrop-blur-md px-4 shrink-0 shadow-sm">
        <Link 
          href="/" 
          className="mr-2 inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none" 
          aria-label="Zurück zur Startseite"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <h1 
          className="flex items-center gap-2 text-lg md:text-xl font-black text-slate-900 dark:text-white outline-none"
        >
          <Icon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </h1>
      </header>

      <main className="p-4 md:p-8 space-y-6 flex-1">
        <div className="max-w-3xl mx-auto space-y-12">
          <article className="p-6 md:p-10 bg-white dark:bg-neutral-900 rounded-[2rem] border border-slate-100 dark:border-neutral-800 shadow-sm">
            <div className="flex gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{title}</h2>
                {versionText && (
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{versionText}</p>
                )}
              </div>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              {children}
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}

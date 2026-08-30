'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  HelpCircle,
  PlayCircle,
  Scale,
  Search,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Shield,
  Gavel,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { FAQ_DATA, type FAQItem } from '@/lib/faq-data';
import { cn } from '@/lib/utils';

export default function HelpSettingsPage() {
  const router = useRouter();
  const language = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  // Support Form state
  const [category, setCategory] = useState<'bug' | 'feedback' | 'account' | 'safety' | 'other'>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // FAQ filtering
  const filteredFaqs = FAQ_DATA.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const questionText = (item.question[language] || item.question.de).toLowerCase();
    const answerText = (item.answer[language] || item.answer.de).toLowerCase();
    return questionText.includes(q) || answerText.includes(q);
  });

  const handleReplayTutorial = () => {
    router.push('/?tutorial=replay');
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Nicht angemeldet' : 'Not logged in',
        description: language === 'de' ? 'Bitte melde dich an, um eine Supportanfrage zu senden.' : 'Please log in to submit a support request.',
      });
      return;
    }

    if (subject.trim().length < 3 || subject.trim().length > 100) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Ungültiger Betreff' : 'Invalid subject',
        description: language === 'de' ? 'Der Betreff muss zwischen 3 und 100 Zeichen lang sein.' : 'Subject must be between 3 and 100 characters.',
      });
      return;
    }

    if (message.trim().length < 10 || message.trim().length > 2000) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Ungültige Nachricht' : 'Invalid message',
        description: language === 'de' ? 'Die Nachricht muss zwischen 10 und 2000 Zeichen lang sein.' : 'Message must be between 10 and 2000 characters.',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmittedSuccess(false);

    try {
      const { functions: clientFunctions } = await import('@/lib/firebase/client');
      if (!clientFunctions) {
        throw new Error('Firebase Functions client not initialized.');
      }
      const { httpsCallable } = await import('firebase/functions');
      const submitFn = httpsCallable(clientFunctions, 'submitSupportTicket');

      const res = await submitFn({
        category,
        subject: subject.trim(),
        message: message.trim(),
        platform: 'web',
        appVersion: '1.0.0',
      });

      const data = res.data as { success: boolean; message: string };

      toast({
        title: language === 'de' ? 'Erfolg' : 'Success',
        description: data.message || (language === 'de' ? 'Deine Supportanfrage wurde erfolgreich übermittelt.' : 'Your support request has been submitted successfully.'),
      });

      setSubject('');
      setMessage('');
      setSubmittedSuccess(true);
    } catch (err: any) {
      console.error('Support ticket submission failed:', err);
      let errMsg = language === 'de' ? 'Senden der Supportanfrage fehlgeschlagen.' : 'Failed to submit support request.';
      if (err.code === 'functions/resource-exhausted') {
        errMsg = language === 'de' ? 'Zu viele Anfragen. Bitte versuche es später noch einmal.' : 'Too many requests. Please try again later.';
      }
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-secondary overflow-y-auto pb-32">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2"
          onClick={() => router.back()}
          aria-label={language === 'de' ? 'Zurück' : 'Back'}
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <HelpCircle className="h-5 w-5 text-primary" />
          <span>{language === 'de' ? 'Hilfe & Support' : 'Help & Support'}</span>
        </h1>
      </header>

      <div className="p-6 space-y-8 max-w-2xl mx-auto w-full">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleReplayTutorial}
            className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-all hover:bg-slate-50 dark:hover:bg-neutral-800 shadow-sm cursor-pointer"
          >
            <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0">
              <PlayCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">
                {language === 'de' ? 'Tutorial erneut ansehen' : 'Watch Tutorial Again'}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === 'de' ? 'Durchlaufe die App-Führung erneut.' : 'Replay the app walkthrough.'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push('/settings/legal')}
            className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-all hover:bg-slate-50 dark:hover:bg-neutral-800 shadow-sm cursor-pointer"
          >
            <div className="p-3 bg-slate-100 dark:bg-neutral-800 rounded-xl text-slate-600 dark:text-neutral-300 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">
                {language === 'de' ? 'Rechtliches & AGB' : 'Legal & Terms'}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === 'de' ? 'Impressum, Datenschutz & AGB.' : 'Imprint, Privacy & Terms.'}
              </p>
            </div>
          </button>
        </div>

        {/* FAQ Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            {language === 'de' ? 'Häufig gestellte Fragen (FAQ)' : 'Frequently Asked Questions (FAQ)'}
          </h2>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'de'
                  ? 'FAQ durchsuchen (z. B. Radar, Standort, Passwort)...'
                  : 'Search FAQ (e.g. radar, location, password)...'
              }
              className="pl-10 h-12 rounded-xl bg-card border shadow-sm font-medium"
            />
          </div>

          {/* FAQ Accordion List */}
          <div className="space-y-2">
            {filteredFaqs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {language === 'de' ? 'Keine passenden FAQ-Einträge gefunden.' : 'No matching FAQ entries found.'}
              </p>
            ) : (
              filteredFaqs.map((faq) => {
                const isOpen = openFaqId === faq.id;
                const questionText = faq.question[language] || faq.question.de;
                const answerText = faq.answer[language] || faq.answer.de;

                return (
                  <Collapsible
                    key={faq.id}
                    open={isOpen}
                    onOpenChange={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="rounded-xl border bg-card overflow-hidden shadow-sm transition-all"
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left font-bold text-sm text-foreground hover:bg-muted/50 transition-colors">
                      <span>{questionText}</span>
                      <span className={cn('text-muted-foreground transition-transform duration-200 ml-2 shrink-0', isOpen && 'rotate-180')}>
                        ▼
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-slate-100 dark:border-neutral-800">
                      {answerText}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </div>

        {/* Support Ticket Form Section */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-neutral-800">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">
              {language === 'de' ? 'Support-Anfrage senden' : 'Submit Support Request'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {language === 'de'
                ? 'Hast du ein Problem oder Feedback? Unser Team hilft dir gerne weiter.'
                : 'Have a problem or feedback? Our team is here to help.'}
            </p>
          </div>

          <form onSubmit={handleSubmitTicket} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            {submittedSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {language === 'de'
                    ? 'Deine Supportanfrage wurde erfolgreich übermittelt.'
                    : 'Your support request has been submitted successfully.'}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {language === 'de' ? 'Kategorie' : 'Category'}
              </Label>
              <Select
                value={category}
                onValueChange={(val: any) => setCategory(val)}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">{language === 'de' ? 'Fehler melden (Bug)' : 'Report a Bug'}</SelectItem>
                  <SelectItem value="feedback">{language === 'de' ? 'Feedback & Idee' : 'Feedback & Idea'}</SelectItem>
                  <SelectItem value="account">{language === 'de' ? 'Account & Profil' : 'Account & Profile'}</SelectItem>
                  <SelectItem value="safety">{language === 'de' ? 'Sicherheit & Missbrauch' : 'Safety & Abuse'}</SelectItem>
                  <SelectItem value="other">{language === 'de' ? 'Sonstiges' : 'Other'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-subject" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {language === 'de' ? 'Betreff' : 'Subject'}
              </Label>
              <Input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={language === 'de' ? 'Kurze Zusammenfassung deines Anliegens...' : 'Short summary of your request...'}
                maxLength={100}
                required
                className="h-11 rounded-xl bg-background font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {language === 'de' ? 'Nachricht / Beschreibung' : 'Message / Description'}
              </Label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  language === 'de'
                    ? 'Beschreibe dein Anliegen möglichst genau (z. B. Schritte zur Wiederholung bei einem Fehler)...'
                    : 'Describe your issue in detail...'
                }
                rows={5}
                maxLength={2000}
                required
                className="rounded-xl bg-background font-medium resize-none"
              />
            </div>

            {/* Privacy Note */}
            <p className="text-[10px] text-muted-foreground leading-normal italic">
              {language === 'de'
                ? 'Deine Angaben werden vertraulich zur Bearbeitung deines Anliegens verarbeitet. Bitte gib keine vertraulichen Passwörter oder Zahlungsdaten ein.'
                : 'Your details are processed confidentially to resolve your request. Please do not enter sensitive passwords or payment details.'}
            </p>

            <Button
              type="submit"
              disabled={isSubmitting || !subject.trim() || !message.trim()}
              className="w-full h-12 rounded-xl font-bold text-xs uppercase tracking-widest"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {language === 'de' ? 'Anfrage absenden' : 'Submit Request'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

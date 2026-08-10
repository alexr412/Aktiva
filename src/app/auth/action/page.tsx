'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PasswordResetUI } from '@/components/auth/password-reset-ui';
import { verifyEmailCode, recoverEmailCode } from '@/lib/firebase/auth';
import { useLanguage } from '@/hooks/use-language';
import { MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-white dark:bg-neutral-950">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <AuthActionContent />
    </Suspense>
  );
}

function AuthActionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const language = useLanguage();

  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  const [verifyState, setVerifyState] = useState<'loading' | 'success' | 'error'>('loading');
  const [recoveredEmail, setRecoveredEmail] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'verifyEmail' || mode === 'recoverEmail') {
      if (!oobCode) {
        setVerifyState('error');
        return;
      }
      let isMounted = true;

      if (mode === 'verifyEmail') {
        verifyEmailCode(oobCode)
          .then(() => {
            if (isMounted) setVerifyState('success');
          })
          .catch((err) => {
            if (process.env.NODE_ENV !== 'production') {
              console.warn("verifyEmailCode error:", err?.code || err);
            }
            if (isMounted) setVerifyState('error');
          });
      } else if (mode === 'recoverEmail') {
        recoverEmailCode(oobCode)
          .then((res) => {
            if (isMounted) {
              setRecoveredEmail(res.email);
              setVerifyState('success');
            }
          })
          .catch((err) => {
            if (process.env.NODE_ENV !== 'production') {
              console.warn("recoverEmailCode error:", err?.code || err);
            }
            if (isMounted) setVerifyState('error');
          });
      }

      return () => { isMounted = false; };
    }
  }, [mode, oobCode]);

  // 1. Modus: resetPassword -> Gebrandeter Passwort-Reset Flow
  if (mode === 'resetPassword') {
    return <PasswordResetUI oobCode={oobCode} mode={mode} />;
  }

  // 2. Modus: verifyEmail oder recoverEmail
  if (mode === 'verifyEmail' || mode === 'recoverEmail') {
    return (
      <main className="flex-1 min-h-0 w-full bg-white dark:bg-neutral-950 flex flex-col items-center justify-start sm:justify-center px-4 py-8 sm:py-12 antialiased overflow-y-auto">
        <div className="w-full max-w-[400px] flex flex-col items-center my-auto">
          {/* Logo Section */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <MapPin className="w-9 h-9 sm:w-10 sm:h-10 text-primary" />
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">activa<span className="text-primary">.</span></h1>
            </div>
            <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Connect. Explore. Live.</p>
          </motion.div>

          {verifyState === 'loading' && (
            <div className="text-center py-10 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="text-sm font-bold text-slate-600 dark:text-neutral-400">
                {language === 'de' ? 'Link wird verarbeitet...' : 'Processing link...'}
              </p>
            </div>
          )}

          {verifyState === 'success' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center space-y-6 bg-zinc-50 dark:bg-neutral-900/40 p-6 sm:p-8 rounded-3xl border border-slate-200/60 dark:border-neutral-800/60"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {mode === 'verifyEmail' 
                    ? (language === 'de' ? 'E-Mail verifiziert' : 'Email Verified')
                    : (language === 'de' ? 'E-Mail wiederhergestellt' : 'Email Recovered')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium leading-relaxed break-words max-w-full">
                  {mode === 'verifyEmail'
                    ? (language === 'de' ? 'Deine E-Mail-Adresse wurde erfolgreich verifiziert.' : 'Your email address has been successfully verified.')
                    : (language === 'de' 
                        ? (recoveredEmail 
                            ? `Deine E-Mail-Adresse (${recoveredEmail}) wurde erfolgreich wiederhergestellt.` 
                            : 'Deine E-Mail-Adresse wurde erfolgreich wiederhergestellt.')
                        : (recoveredEmail 
                            ? `Your email address (${recoveredEmail}) has been successfully recovered.` 
                            : 'Your email address has been successfully recovered.'))}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => router.push('/login?verification=success')}
                className="w-full h-14 text-sm font-black rounded-full transition-all active:scale-[0.98] uppercase tracking-widest bg-primary text-white hover:bg-primary/90 shadow-none border-none"
              >
                {language === 'de' ? 'Zum Login' : 'Go to Login'}
              </Button>
            </motion.div>
          )}

          {verifyState === 'error' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center space-y-6 bg-zinc-50 dark:bg-neutral-900/40 p-6 sm:p-8 rounded-3xl border border-slate-200/60 dark:border-neutral-800/60"
            >
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {language === 'de' ? 'Link nicht mehr gültig' : 'Link no longer valid'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium leading-relaxed">
                  {language === 'de'
                    ? 'Dieser Link ist ungültig oder bereits abgelaufen.'
                    : 'This link is invalid or has expired.'}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full h-14 text-sm font-black rounded-full transition-all active:scale-[0.98] uppercase tracking-widest bg-primary text-white hover:bg-primary/90 shadow-none border-none"
              >
                {language === 'de' ? 'Zum Login' : 'Go to Login'}
              </Button>
            </motion.div>
          )}
        </div>
      </main>
    );
  }

  // 3. Unbekannter oder fehlender mode
  return (
    <main className="flex-1 min-h-0 w-full bg-white dark:bg-neutral-950 flex flex-col items-center justify-start sm:justify-center px-4 py-8 sm:py-12 antialiased overflow-y-auto">
      <div className="w-full max-w-[400px] flex flex-col items-center my-auto">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <MapPin className="w-9 h-9 sm:w-10 sm:h-10 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">activa<span className="text-primary">.</span></h1>
          </div>
          <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Connect. Explore. Live.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full text-center space-y-6 bg-zinc-50 dark:bg-neutral-900/40 p-6 sm:p-8 rounded-3xl border border-slate-200/60 dark:border-neutral-800/60"
        >
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {language === 'de' ? 'Link nicht gültig' : 'Link not valid'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium leading-relaxed">
              {language === 'de'
                ? 'Dieser Link ist ungültig, unvollständig oder wird nicht unterstützt.'
                : 'This link is invalid, incomplete, or unsupported.'}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full h-14 text-sm font-black rounded-full transition-all active:scale-[0.98] uppercase tracking-widest bg-primary text-white hover:bg-primary/90 shadow-none border-none"
          >
            {language === 'de' ? 'Zum Login' : 'Go to Login'}
          </Button>
        </motion.div>
      </div>
    </main>
  );
}

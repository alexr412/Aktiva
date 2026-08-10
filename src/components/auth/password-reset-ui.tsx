'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/hooks/use-language';
import { 
  verifyResetCode, 
  confirmResetPassword, 
  evaluatePassword 
} from '@/lib/firebase/auth';
import { 
  MapPin, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Link2Off, 
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasswordResetUIProps {
  oobCode?: string | null;
  mode?: string | null;
}

type ResetState = 'loading' | 'invalid_link' | 'valid_code' | 'submitting' | 'success' | 'generic_error';

export function PasswordResetUI({ oobCode, mode = 'resetPassword' }: PasswordResetUIProps) {
  const router = useRouter();
  const language = useLanguage();

  const [state, setState] = useState<ResetState>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Falls der Modus nicht resetPassword ist oder oobCode fehlt
    if (mode && mode !== 'resetPassword') {
      setState('generic_error');
      return;
    }

    if (!oobCode) {
      setState('invalid_link');
      return;
    }

    let isMounted = true;
    setState('loading');

    verifyResetCode(oobCode)
      .then(() => {
        if (isMounted) {
          setState('valid_code');
        }
      })
      .catch((error) => {
        if (isMounted) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn("verifyResetCode failed:", error?.code || error);
          }
          setState('invalid_link');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [oobCode, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!oobCode || isSubmitting) return;

    // 1. Abgleich der beiden Passwörter
    if (newPassword !== confirmPassword) {
      setErrorMessage(
        language === 'de' 
          ? 'Passwörter stimmen nicht überein.' 
          : 'Passwords do not match.'
      );
      return;
    }

    // 2. Bestehende Passwort-Policy prüfen
    const validation = evaluatePassword(newPassword);
    if (!validation.isValid) {
      setErrorMessage(
        language === 'de'
          ? 'Das Passwort erfüllt nicht die Sicherheitsanforderungen (mindestens 8 Zeichen, Groß- und Kleinbuchstaben, Zahl und Sonderzeichen).'
          : 'Password does not meet security requirements (at least 8 characters, uppercase and lowercase letters, number, and special character).'
      );
      return;
    }

    setIsSubmitting(true);
    setState('submitting');

    try {
      await confirmResetPassword(oobCode, newPassword);
      setState('success');
    } catch (error: any) {
      setIsSubmitting(false);
      const code = error?.code;

      if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
        setState('invalid_link');
      } else if (code === 'auth/weak-password') {
        setState('valid_code');
        setErrorMessage(
          language === 'de' 
            ? 'Das Passwort ist zu schwach.' 
            : 'The password is too weak.'
        );
      } else {
        setState('valid_code');
        setErrorMessage(
          language === 'de'
            ? 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.'
            : 'An error occurred. Please try again.'
        );
      }
    }
  };

  const handleRequestNewLink = () => {
    router.push('/login?reset=forgot');
  };

  const handleGoToLogin = () => {
    router.push('/login?reset=success');
  };

  return (
    <main className="min-h-dvh w-full bg-white dark:bg-neutral-950 flex flex-col items-center justify-start sm:justify-center px-4 py-8 sm:py-12 antialiased overflow-y-auto">
      <div className="w-full max-w-[400px] flex flex-col items-center relative z-10 my-auto">
        
        {/* Logo Section */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-10 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <MapPin className="w-9 h-9 sm:w-10 sm:h-10 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">activa<span className="text-primary">.</span></h1>
          </div>
          <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Connect. Explore. Live.</p>
        </motion.div>

        {/* 1. Loading State */}
        {state === 'loading' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center py-12 space-y-4"
          >
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-sm font-bold text-slate-600 dark:text-neutral-400">
              {language === 'de' ? 'Link wird überprüft...' : 'Verifying link...'}
            </p>
          </motion.div>
        )}

        {/* 2. Invalid Link State */}
        {state === 'invalid_link' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center space-y-6 bg-zinc-50 dark:bg-neutral-900/40 p-6 sm:p-8 rounded-3xl border border-slate-200/60 dark:border-neutral-800/60"
          >
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center mx-auto">
              <Link2Off className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {language === 'de' ? 'Link nicht mehr gültig' : 'Link no longer valid'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium leading-relaxed">
                {language === 'de'
                  ? 'Dieser Link ist ungültig oder abgelaufen. Fordere einen neuen Link zum Zurücksetzen deines Passworts an.'
                  : 'This link is invalid or expired. Please request a new password reset link.'}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleRequestNewLink}
              className="w-full h-14 text-sm font-black rounded-full transition-all active:scale-[0.98] uppercase tracking-widest bg-primary text-white hover:bg-primary/90 shadow-none border-none"
            >
              {language === 'de' ? 'Neuen Link anfordern' : 'Request new link'}
            </Button>
          </motion.div>
        )}

        {/* 3. Generic Error State (Falscher / Fehlender Mode) */}
        {state === 'generic_error' && (
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
        )}

        {/* 4. Valid Code / Formular State */}
        {(state === 'valid_code' || state === 'submitting') && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full space-y-6"
          >
            <div className="text-center space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {language === 'de' ? 'Passwort zurücksetzen' : 'Reset Password'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium leading-relaxed">
                {language === 'de'
                  ? 'Lege ein neues Passwort für dein Activa-Konto fest.'
                  : 'Set a new password for your Activa account.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-5">
              {/* Neues Passwort Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                  {language === 'de' ? 'Neues Passwort' : 'New Password'}
                </label>
                <div className="relative group">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary transition-colors z-10" />
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••" 
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    required
                    className="h-14 sm:h-16 pl-16 pr-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                    aria-label={showPassword ? (language === 'de' ? 'Passwort ausblenden' : 'Hide password') : (language === 'de' ? 'Passwort anzeigen' : 'Show password')}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Passwort wiederholen Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                  {language === 'de' ? 'Passwort wiederholen' : 'Repeat Password'}
                </label>
                <div className="relative group">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary transition-colors z-10" />
                  <Input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" 
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    required
                    className="h-14 sm:h-16 pl-16 pr-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                    aria-label={showConfirmPassword ? (language === 'de' ? 'Passwort ausblenden' : 'Hide password') : (language === 'de' ? 'Passwort anzeigen' : 'Show password')}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Inline Fehlermeldung */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100/50 dark:border-rose-950/50 flex items-start gap-3 text-xs font-bold"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    {errorMessage}
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full h-14 text-base font-black rounded-full transition-all active:scale-[0.98] uppercase tracking-widest !shadow-none !border-none" 
                  disabled={isSubmitting || !newPassword || !confirmPassword}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {language === 'de' ? 'Wird gespeichert...' : 'Saving...'}
                    </span>
                  ) : (
                    language === 'de' ? 'Neues Passwort speichern' : 'Save new password'
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* 5. Success State */}
        {state === 'success' && (
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
                {language === 'de' ? 'Passwort geändert' : 'Password changed'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium leading-relaxed">
                {language === 'de'
                  ? 'Dein Passwort wurde erfolgreich geändert.'
                  : 'Your password has been changed successfully.'}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleGoToLogin}
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

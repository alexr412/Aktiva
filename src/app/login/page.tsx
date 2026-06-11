'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/hooks/use-language';
import { signIn, signOut, sendPasswordReset, signInWithGoogle, signInWithApple } from '@/lib/firebase/auth';
import { sendEmailVerification, type User } from 'firebase/auth';
import { debugLog } from '@/lib/debug';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  MapPin,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const language = useLanguage();
  const { toast } = useToast();
  const { user, userProfile, loading: authLoading, setSocialLegalConsentPending } = useAuth();

  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [loginError, setLoginError] = useState<{
    title: string;
    description: string;
    variant: 'error' | 'info';
  } | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && typeof window !== 'undefined') {
      import('firebase/auth').then(({ signInWithCustomToken }) => {
        import('@/lib/firebase/client').then(({ auth }) => {
          (window as any).__AKTIVA_DEBUG_AUTH__ = {
            signInWithCustomToken,
            auth
          };
          debugLog("auth", "Exposed __AKTIVA_DEBUG_AUTH__ on window");
        });
      });
    }
  }, []);

  // Bereits eingeloggte Nutzer weiterleiten
  useEffect(() => {
    if (user && userProfile && !authLoading && userProfile.legalAcceptedAt) {
      if (user.emailVerified) {
        if (userProfile.onboardingCompleted) {
          router.replace('/');
        } else {
          router.replace('/onboarding');
        }
      }
    }
  }, [user, userProfile, authLoading, router]);

  useEffect(() => {
    const registration = searchParams.get('registration');
    const verification = searchParams.get('verification');
    if (registration === 'success') {
      setLoginError({
        title: language === 'de' ? 'Registrierung erfolgreich' : 'Registration successful',
        description: language === 'de'
          ? "Dein Konto wurde erfolgreich erstellt. Bitte bestätige deine E-Mail-Adresse (prüfe auch den Spam-Ordner), um dich einzuloggen."
          : "Your account was successfully created. Please verify your email address (check your spam folder) to log in.",
        variant: 'info'
      });
    } else if (verification === 'required') {
      setLoginError({
        title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
        description: language === 'de'
          ? "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Wir haben dir einen Bestätigungs-Link an deine E-Mail-Adresse gesendet. Prüfe bitte auch deinen Spam-Ordner."
          : "Please verify your email address to log in. We have sent a verification link to your email address. Please check your spam folder as well.",
        variant: 'info'
      });
    }
  }, [searchParams, language]);

  const formSchema = z.object({
    email: z.string().min(1, { message: language === 'de' ? 'Email oder Username ist erforderlich.' : 'Email or username is required.' }),
    password: z.string().min(6, { message: language === 'de' ? 'Das Passwort muss mindestens 6 Zeichen lang sein.' : 'Password must be at least 6 characters.' }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    
    setIsLoading(true);
    setLoginError(null);
    try {
      let loginEmail = values.email.trim();

      if (!loginEmail.includes('@')) {
        if (!db) throw new Error("Database not initialized");
        const usersRef = collection(db, 'users');
        // Search exact username
        const q = query(usersRef, where('username', '==', loginEmail));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          // Fallback check: maybe it's saved in lowercase or some other way, but mostly exact match.
          throw new Error('auth/user-not-found');
        }
        
        const userData = querySnapshot.docs[0].data();
        if (!userData.email) {
           throw new Error('auth/user-not-found');
        }
        loginEmail = userData.email;
      }

      const user = await signIn(loginEmail, values.password);

      if (!user.emailVerified) {
        let verificationEmailSent = false;
        try {
          const { httpsCallable } = await import('firebase/functions');
          const { functions: clientFunctions } = await import('@/lib/firebase/client');
          if (clientFunctions) {
            const checkThrottle = httpsCallable(clientFunctions, 'checkAndRecordVerificationEmail');
            const res = await checkThrottle();
            const { allowed } = res.data as { allowed: boolean };
            if (allowed) {
              await sendEmailVerification(user);
              verificationEmailSent = true;
            }
          }
        } catch (verifError: any) {
          console.warn("Could not check/resend email verification link:", verifError);
        }

        console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
          source: "onSubmit credentials login - email unverified",
          target: "signOut & show verification required error",
          uid: user.uid,
          timestamp: Date.now()
        });
        // ALWAYS sign out to prevent the user from remaining authenticated
        await signOut(); 

        setLoginError({
          title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
          description: language === 'de' 
            ? (verificationEmailSent
                ? "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Wir haben dir einen neuen Bestätigungs-Link an deine E-Mail-Adresse gesendet. Prüfe bitte auch deinen Spam-Ordner."
                : "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Ein neuer Bestätigungs-Link konnte erst vor kurzem gesendet werden, bitte prüfe dein Postfach (auch Spam-Ordner).")
            : (verificationEmailSent
                ? "Please verify your email address to log in. We have sent a new verification link to your email address. Please check your spam folder as well."
                : "Please verify your email address to log in. A new verification link could not be sent recently, please check your inbox."),
          variant: 'info'
        });
        setIsLoading(false);
        return;
      }

      let onboardingCompleted = false;
      try {
        const userDocRef = doc(db!, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          onboardingCompleted = !!userDocSnap.data().onboardingCompleted;
        }
      } catch (err) {
        console.warn("Could not fetch onboarding status in onSubmit:", err);
      }

      toast({
        title: language === 'de' ? 'Login erfolgreich' : 'Login successful',
        description: language === 'de' ? "Willkommen zurück!" : "Welcome back!",
      });
      
      if (onboardingCompleted) {
        router.push('/');
      } else {
        router.push('/onboarding');
      }
    } catch (error: any) {
      console.error(error);
      let errorMessage = language === 'de' ? 'Ein unerwarteter Fehler ist aufgetreten.' : 'An unexpected error occurred.';

      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = language === 'de' ? 'E-Mail oder Passwort ist falsch.' : 'Invalid email or password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = language === 'de' ? 'Die E-Mail-Adresse ist ungültig.' : 'The email address is invalid.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = language === 'de' ? 'Zu viele Fehlversuche. Bitte versuche es später erneut.' : 'Too many attempts. Please try again later.';
      } else if (error.message && error.message.includes(language === 'de' ? "Zugriff verweigert" : "Access Denied")) {
        errorMessage = error.message;
      } else if (error.message === 'auth/user-not-found') {
        errorMessage = language === 'de' ? 'Benutzername oder E-Mail wurde nicht gefunden.' : 'Username or email not found.';
      }

      setLoginError({
        title: language === 'de' ? 'Login fehlgeschlagen' : 'Login failed',
        description: errorMessage,
        variant: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handlePasswordReset = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: language === 'de' ? 'Bitte gib eine gültige E-Mail-Adresse ein.' : 'Please enter a valid email address.' });
      return;
    }
    
    setIsResetting(true);
    try {
      await sendPasswordReset(resetEmail);
      toast({ title: language === 'de' ? 'E-Mail gesendet' : 'Email sent', description: language === 'de' ? 'Wenn diese E-Mail registriert ist, erhältst du in Kürze einen Link zum Zurücksetzen deines Passworts.' : 'If this email is registered, you will receive a password reset link shortly.' });
      setIsResetDialogOpen(false);
      setResetEmail('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: language === 'de' ? 'Es gab ein Problem. Bitte versuche es später erneut.' : 'Something went wrong. Please try again later.' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    
    
    setLoginError(null);
    setIsLoading(true);
    try {
      
      const { user, isNewUser } = await signInWithGoogle();
      
      
      
      const userDocRef = doc(db!, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const profileData = userDocSnap.exists() ? userDocSnap.data() : null;
      const hasAcceptedLegal = !!profileData?.legalAcceptedAt;
      

      if (isNewUser || !hasAcceptedLegal) {
        
        setSocialLegalConsentPending(true);
        
        setIsLoading(false);
        return;
      }

      await user.reload();
      
      if (!user.emailVerified) {
        let verificationEmailSent = false;
        try {
          const { httpsCallable } = await import('firebase/functions');
          const { functions: clientFunctions } = await import('@/lib/firebase/client');
          if (clientFunctions) {
            const checkThrottle = httpsCallable(clientFunctions, 'checkAndRecordVerificationEmail');
            const res = await checkThrottle();
            const { allowed } = res.data as { allowed: boolean };
            if (allowed) {
              await sendEmailVerification(user);
              verificationEmailSent = true;
            }
          }
        } catch (verifError: any) {
          console.warn("Could not check/resend email verification link:", verifError);
        }

        console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
          source: "handleGoogleSignIn - email unverified",
          target: "signOut & redirect /login?verification=required",
          uid: user.uid,
          timestamp: Date.now()
        });
        await signOut();

        router.replace('/login?verification=required');
        setLoginError({
          title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
          description: language === 'de' 
            ? (verificationEmailSent
                ? "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Wir haben dir einen neuen Bestätigungs-Link an deine E-Mail-Adresse gesendet. Prüfe bitte auch deinen Spam-Ordner."
                : "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Ein neuer Bestätigungs-Link konnte erst vor kurzem gesendet werden, bitte prüfe dein Postfach (auch Spam-Ordner).")
            : (verificationEmailSent
                ? "Please verify your email address to log in. We have sent a new verification link to your email address. Please check your spam folder as well."
                : "Please verify your email address to log in. A new verification link could not be sent recently, please check your inbox."),
          variant: 'info'
        });
        setIsLoading(false);
        return;
      }

      const onboardingCompleted = !!profileData?.onboardingCompleted;

      toast({
        title: language === 'de' ? 'Login erfolgreich' : 'Login successful',
        description: language === 'de' ? "Willkommen zurück!" : "Welcome back!",
      });

      console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
        source: "handleGoogleSignIn - flow completed",
        target: onboardingCompleted ? "/" : "/onboarding",
        uid: user.uid,
        onboardingCompleted,
        timestamp: Date.now()
      });
      if (onboardingCompleted) {
        router.push('/');
      } else {
        router.push('/onboarding');
      }
    } catch (error: any) {
      console.error("[LEGAL DEBUG] Google login failed", {
        error: error.message || error,
        timestamp: Date.now()
      });
      let desc = language === 'de' ? 'Google-Login konnte nicht abgeschlossen werden.' : 'Google login could not be completed.';
      if (error.code === 'auth/popup-closed-by-user') {
        desc = language === 'de' ? 'Das Anmeldefenster wurde geschlossen.' : 'The sign-in popup was closed.';
      }
      setLoginError({
        title: language === 'de' ? 'Login fehlgeschlagen' : 'Login failed',
        description: desc,
        variant: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (isLoading) return;
    
    
    setLoginError(null);
    setIsLoading(true);
    try {
      
      const { user, isNewUser } = await signInWithApple();
      
      
      
      const userDocRef = doc(db!, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const profileData = userDocSnap.exists() ? userDocSnap.data() : null;
      const hasAcceptedLegal = !!profileData?.legalAcceptedAt;
      

      if (isNewUser || !hasAcceptedLegal) {
        
        setSocialLegalConsentPending(true);
        
        setIsLoading(false);
        return;
      }

      await user.reload();
      
      if (!user.emailVerified) {
        let verificationEmailSent = false;
        try {
          const { httpsCallable } = await import('firebase/functions');
          const { functions: clientFunctions } = await import('@/lib/firebase/client');
          if (clientFunctions) {
            const checkThrottle = httpsCallable(clientFunctions, 'checkAndRecordVerificationEmail');
            const res = await checkThrottle();
            const { allowed } = res.data as { allowed: boolean };
            if (allowed) {
              await sendEmailVerification(user);
              verificationEmailSent = true;
            }
          }
        } catch (verifError: any) {
          console.warn("Could not check/resend email verification link:", verifError);
        }

        console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
          source: "handleAppleSignIn - email unverified",
          target: "signOut & redirect /login?verification=required",
          uid: user.uid,
          timestamp: Date.now()
        });
        await signOut();

        router.replace('/login?verification=required');
        setLoginError({
          title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
          description: language === 'de' 
            ? (verificationEmailSent
                ? "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Wir haben dir einen neuen Bestätigungs-Link an deine E-Mail-Adresse gesendet. Prüfe bitte auch deinen Spam-Ordner."
                : "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Ein neuer Bestätigungs-Link konnte erst vor kurzem gesendet werden, bitte prüfe dein Postfach (auch Spam-Ordner).")
            : (verificationEmailSent
                ? "Please verify your email address to log in. We have sent a new verification link to your email address. Please check your spam folder as well."
                : "Please verify your email address to log in. A new verification link could not be sent recently, please check your inbox."),
          variant: 'info'
        });
        setIsLoading(false);
        return;
      }

      const onboardingCompleted = !!profileData?.onboardingCompleted;

      toast({
        title: language === 'de' ? 'Login erfolgreich' : 'Login successful',
        description: language === 'de' ? "Willkommen zurück!" : "Welcome back!",
      });

      console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
        source: "handleAppleSignIn - flow completed",
        target: onboardingCompleted ? "/" : "/onboarding",
        uid: user.uid,
        onboardingCompleted,
        timestamp: Date.now()
      });
      if (onboardingCompleted) {
        router.push('/');
      } else {
        router.push('/onboarding');
      }
    } catch (error: any) {
      console.error("[LEGAL DEBUG] Apple login failed", {
        error: error.message || error,
        timestamp: Date.now()
      });
      let desc = language === 'de' ? 'Apple-Login konnte nicht abgeschlossen werden.' : 'Apple login could not be completed.';
      if (error.code === 'auth/popup-closed-by-user') {
        desc = language === 'de' ? 'Das Anmeldefenster wurde geschlossen.' : 'The sign-in popup was closed.';
      }
      setLoginError({
        title: language === 'de' ? 'Login fehlgeschlagen' : 'Login failed',
        description: desc,
        variant: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };




  return (
    <main className="min-h-screen w-full bg-white dark:bg-neutral-950 flex flex-col items-center justify-center p-6 antialiased">
      
      <div className="w-full max-w-[400px] flex flex-col items-center relative z-10">
        
        {/* Logo Section */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-10">
              <MapPin className="w-10 h-10 text-primary" />
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">aktiva<span className="text-primary">.</span></h1>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-neutral-100 font-heading leading-tight mb-2">EXPLORE MORE</h1>
          <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Connect. Explore. Live.</p>
        </motion.div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-8">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                    {language === 'de' ? 'Email oder Username' : 'Email or Username'}
                  </FormLabel>
                  <FormControl>
                    <div className="relative group">
                      <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary transition-colors z-10" />
                      <Input 
                        placeholder={language === 'de' ? 'E-Mail / Benutzername' : 'Email / Username'} 
                        autoComplete="username"
                        {...field} 
                        className="h-16 pl-16 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm tracking-wider shadow-none" 
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold text-rose-500 px-1" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <div className="flex items-baseline justify-between px-1">
                    <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{language === 'de' ? 'Passwort' : 'Password'}</FormLabel>
                    <button 
                      type="button" 
                      onClick={() => {
                        
                        setIsResetDialogOpen(true);
                      }}
                      className="text-xs font-black text-primary hover:underline underline-offset-2 transition-all uppercase tracking-widest"
                    >
                      {language === 'de' ? 'Passwort vergessen?' : 'Forgot Password?'}
                    </button>
                  </div>
                  <FormControl>
                    <div className="relative group">
                      <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary transition-colors z-10" />
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        autoComplete="current-password"
                        {...field} 
                        className="h-16 pl-16 pr-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" 
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
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold text-rose-500 px-1" />
                </FormItem>
              )}
            />

            {/* Inline Error Alert */}
            {loginError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "p-4 rounded-3xl flex items-start gap-3 text-sm font-bold transition-all border",
                  loginError.variant === 'error'
                    ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100/50 dark:border-rose-950/50"
                    : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-950/50"
                )}
              >
                {loginError.variant === 'error' ? (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <Mail className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1 text-left">
                  <p className="font-black uppercase tracking-wider text-xs">
                    {loginError.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium leading-relaxed">
                    {loginError.description}
                  </p>
                </div>
              </motion.div>
            )}

            <div className="pt-4">
              <Button 
                type="submit" 
                className="w-full h-14 text-base font-black rounded-full transition-all active:scale-[0.98] uppercase tracking-widest !shadow-none !border-none" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  language === 'de' ? 'Anmelden' : 'Sign in'
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Separator */}
        <div className="w-full flex items-center gap-4 my-10 px-4">
          <div className="flex-1 h-[1px] bg-slate-100 dark:bg-neutral-900" />
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">{language === 'de' ? 'Oder' : 'Or'}</span>
          <div className="flex-1 h-[1px] bg-slate-100 dark:bg-neutral-900" />
        </div>

        {/* Socials */}
        <div className="w-full grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            onClick={handleAppleSignIn}
            disabled={isLoading}
            className="h-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 text-slate-900 dark:text-white font-black text-[11px] uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-neutral-800 transition-all shadow-none flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 384 512">
              <path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            <span className="leading-none pt-0.5">Apple</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="h-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 text-slate-900 dark:text-white font-black text-[11px] uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-neutral-800 transition-all shadow-none flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="leading-none pt-0.5">Google</span>
          </Button>
        </div>


        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            {language === 'de' ? 'Neu hier?' : 'New here?'} 
            <button 
              onClick={() => {
                
                router.push('/signup');
              }}
              className="text-primary ml-2 hover:underline underline-offset-4 font-black"
            >
              {language === 'de' ? 'Registrieren' : 'Sign up'}
            </button>
          </p>
        </div>

      </div>

      {/* Dialog for Reset */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl p-8 bg-white dark:bg-neutral-950">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase">
              {language === 'de' ? 'Passwort zurücksetzen' : 'Password Recovery'}
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500 pt-2">
               {language === 'de' 
                 ? 'Gib deine E-Mail-Adresse ein und wir senden dir einen Link zur Wiederherstellung.' 
                 : 'Enter your email and we will send you a recovery link.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                {language === 'de' ? 'Deine E-Mail-Adresse' : 'Your Email'}
              </label>
              <div className="relative group mt-2">
                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <Input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={resetEmail} 
                  onChange={(e) => setResetEmail(e.target.value)} 
                  className="h-14 pl-14 pr-4 rounded-full bg-slate-100 dark:bg-neutral-900 border-none font-bold text-sm focus-visible:ring-primary/20"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="ghost" 
              onClick={() => setIsResetDialogOpen(false)} 
              className="rounded-xl h-14 font-black text-slate-400 hover:bg-slate-50 uppercase tracking-widest"
            >
              {language === 'de' ? 'Abbrechen' : 'Cancel'}
            </Button>
            <Button 
              onClick={handlePasswordReset} 
              className="rounded-full h-14 font-black flex-1 uppercase tracking-widest" 
              disabled={isResetting || !resetEmail}
            >
              {isResetting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                language === 'de' ? 'Link anfordern' : 'Request Link'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xl">
          <div className="mx-6 flex max-w-sm flex-col items-center rounded-3xl border border-white/20 bg-white/10 px-8 py-7 text-center shadow-2xl">
            <div className="mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            <h2 className="text-lg font-semibold text-white">
              {language === 'de' ? 'Verifizierung läuft' : 'Verification in progress'}
            </h2>
            <p className="mt-2 text-sm text-white/75">
              {language === 'de' 
                ? 'Wir prüfen deine Anmeldung und bereiten die E-Mail-Verifizierung vor.' 
                : 'We are verifying your credentials and preparing the email verification.'}
            </p>
          </div>
        </div>
      )}

    </main>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/hooks/use-language';
import { signUp, signOut, signInWithGoogle, signInWithApple } from '@/lib/firebase/auth';
import { isUsernameTaken } from '@/lib/firebase/firestore';
import { validateUsername } from '@/lib/moderation/blacklist';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { sendEmailVerification } from 'firebase/auth';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  AGBText, 
  TermsOfUseText, 
  PrivacyPolicyText, 
  CookiePolicyText,
  LegalPlaceholderNotice
} from '@/components/auth/LegalTexts';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  User, 
  Lock, 
  Loader2,
  CheckCircle2,
  MapPin,
  Calendar,
  Shield,
  X,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageContent />
    </Suspense>
  );
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const language = useLanguage();
  const { toast } = useToast();
  const { user, userProfile, loading: authLoading, setSocialLegalConsentPending } = useAuth();
  
  const [submitError, setSubmitError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<'available' | 'taken' | 'invalid' | null>(null);
  
  const [isTermsDialogOpen, setIsTermsDialogOpen] = useState(false);
  const [isUseTermsDialogOpen, setIsUseTermsDialogOpen] = useState(false);
  const [isPrivacyDialogOpen, setIsPrivacyDialogOpen] = useState(false);
  const [isCookiesDialogOpen, setIsCookiesDialogOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const formSchema = z.object({
    email: z.string().email({ message: language === 'de' ? 'Ungültige E-Mail-Adresse.' : 'Invalid email address.' })
      .refine((val) => {
        const domain = val.split('@')[1]?.toLowerCase();
        const disposableDomains = [
          'yopmail.com', 'mailinator.com', 'tempmail.com', 'guerrillamail.com', 'sharklasers.com',
          '10minutemail.com', 'trashmail.com', 'dispostable.com', 'getairmail.com', 'burnermail.io',
          'temp-mail.org', 'maildrop.cc', 'fakeinbox.com', 'generator.email', 'moakt.com',
          'pokemail.net', 'temporary-mail.net', 'duck.com', 'yopmail.fr', 'yopmail.net',
          'cool.fr.nf', 'jetable.org', 'tempmailo.com', 'temp-mail.io', 'mailnesia.com',
          'mailcatch.com', 'disposable.com', 'tempmailaddress.com', 'mintemail.com',
          'spambox.us', 'discard.email', 'anonymousemail.me', 'boun.cr'
        ];
        return !disposableDomains.includes(domain);
      }, { message: language === 'de' ? 'Temporäre E-Mail-Dienste sind nicht erlaubt.' : 'Disposable email services are not allowed.' }),
    fullName: z.string().min(2, { message: language === 'de' ? 'Bitte gib deinen Namen an.' : 'Please provide your name.' }),
    birthday: z.string()
      .min(1, { message: language === 'de' ? 'Geburtsdatum ist erforderlich.' : 'Birthday is required.' })
      .regex(/^\d{2}\/\d{2}\/\d{4}$/, { message: language === 'de' ? 'Format muss DD/MM/YYYY sein.' : 'Format must be DD/MM/YYYY.' })
      .refine((val) => {
        const parts = val.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
      }, { message: language === 'de' ? 'Ungültiges Datum.' : 'Invalid date.' })
      .refine((val) => {
        const parts = val.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        const now = new Date();
        let age = now.getFullYear() - date.getFullYear();
        const m = now.getMonth() - date.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
          age--;
        }
        return age >= 12;
      }, { message: language === 'de' ? 'Du musst mindestens 12 Jahre alt sein.' : 'You must be at least 12 years old.' }),
    password: z.string()
      .min(8, { message: language === 'de' ? 'Mindestens 8 Zeichen.' : 'Minimum 8 characters.' })
      .max(32, { message: language === 'de' ? 'Maximal 32 Zeichen.' : 'Maximum 32 characters.' })
      .regex(/[A-Z]/, { message: language === 'de' ? 'Ein Großbuchstabe.' : 'One uppercase letter.' })
      .regex(/[a-z]/, { message: language === 'de' ? 'Ein Kleinbuchstabe.' : 'One lowercase letter.' })
      .regex(/[0-9]/, { message: language === 'de' ? 'Eine Zahl.' : 'One number.' })
      .regex(/[^A-Za-z0-9]/, { message: language === 'de' ? 'Ein Sonderzeichen.' : 'One special character.' }),
    confirmPassword: z.string(),
    termsAccepted: z.boolean().refine(val => val === true, { message: language === 'de' ? 'Bitte akzeptiere die AGB.' : 'Please accept the Terms of Service.' }),
    useTermsAccepted: z.boolean().refine(val => val === true, { message: language === 'de' ? 'Bitte akzeptiere die Nutzungsbedingungen.' : 'Please accept the Terms of Use.' }),
    privacyAccepted: z.boolean().refine(val => val === true, { message: language === 'de' ? 'Bitte akzeptiere die Datenschutzerklärung.' : 'Please accept the Privacy Policy.' }),
    cookiesAccepted: z.boolean().refine(val => val === true, { message: language === 'de' ? 'Bitte akzeptiere die Cookie-Richtlinie.' : 'Please accept the Cookie Policy.' }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: language === 'de' ? "Passwörter stimmen nicht überein." : "Passwords do not match.",
    path: ["confirmPassword"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      fullName: '',
      birthday: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false,
      useTermsAccepted: false,
      privacyAccepted: false,
      cookiesAccepted: false,
    },
  });

  const passwordValue = form.watch('password');
  const fullNameValue = form.watch('fullName') || '';
  const birthdayValue = form.watch('birthday') || '';
  const emailValue = form.watch('email') || '';
  const termsAcceptedValue = form.watch('termsAccepted');
  const useTermsAcceptedValue = form.watch('useTermsAccepted');
  const privacyAcceptedValue = form.watch('privacyAccepted');
  const cookiesAcceptedValue = form.watch('cookiesAccepted');


  const evaluatePassword = (pass: string) => {
    return {
      hasLength: pass.length >= 8 && pass.length <= 32,
      hasUpper: /[A-Z]/.test(pass),
      hasLower: /[a-z]/.test(pass),
      hasNumber: /[0-9]/.test(pass),
      hasSpecial: /[^A-Za-z0-9]/.test(pass)
    };
  };

  const validation = evaluatePassword(passwordValue || '');
  const passwordsMatch = passwordValue && passwordValue === form.watch('confirmPassword');

  const strengthScore = [
    validation.hasLength, 
    validation.hasLength && (passwordValue?.length || 0) >= 12, 
    validation.hasLength && (passwordValue?.length || 0) >= 16, 
    validation.hasUpper, 
    validation.hasLower, 
    validation.hasNumber, 
    validation.hasSpecial
  ].filter(Boolean).length;
  
  const getStrengthColor = (score: number) => {
    if (score <= 2) return 'bg-rose-500';
    if (score === 3) return 'bg-amber-500';
    if (score === 4) return 'bg-yellow-400';
    if (score === 5) return 'bg-lime-500';
    return 'bg-emerald-500';
  };
  // E-Mail aus Query-Parameter vorausfüllen falls syntaktisch plausibel
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      try {
        const decoded = decodeURIComponent(emailParam).trim();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (emailRegex.test(decoded) && decoded.length <= 254) {
          form.setValue('email', decoded, { shouldValidate: true });
        }
      } catch (e) {
        // Ignoriere fehlerhafte URI-Komponenten
      }
    }
  }, [searchParams, form]);

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

  const handleStep1Next = async () => {
    const isValid = await form.trigger(['email', 'termsAccepted', 'useTermsAccepted', 'privacyAccepted', 'cookiesAccepted']);
    if (isValid) {
      setStep(2);
    }
  };

  const handleStep2Next = async () => {
    const isValid = await form.trigger(['password', 'confirmPassword']);
    if (isValid) {
      setStep(3);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    
    
    setSubmitError('');
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
          source: "handleGoogleSignIn (signup) - email unverified",
          target: "signOut & redirect /login?verification=required",
          uid: user.uid,
          timestamp: Date.now()
        });
        await signOut();

        router.push('/login?verification=required');
        toast({
          title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
          description: language === 'de' 
            ? (verificationEmailSent
                ? "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Wir haben dir einen neuen Bestätigungs-Link an deine E-Mail-Adresse gesendet. Prüfe bitte auch deinen Spam-Ordner."
                : "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Ein neuer Bestätigungs-Link konnte erst vor kurzem gesendet werden, bitte prüfe dein Postfach (auch Spam-Ordner).")
            : (verificationEmailSent
                ? "Please verify your email address to log in. We have sent a new verification link to your email address. Please check your spam folder as well."
                : "Please verify your email address to log in. A new verification link could not be sent recently, please check your inbox."),
        });
        setIsLoading(false);
        return;
      }

      const onboardingCompleted = !!profileData?.onboardingCompleted;

      toast({
        title: language === 'de' ? 'Erfolgreich eingeloggt' : 'Logged in successfully',
        description: language === 'de' ? 'Willkommen zurück bei Aktiva!' : 'Welcome back to Aktiva!',
      });

      console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
        source: "handleGoogleSignIn (signup) - flow completed",
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
      console.error("[LEGAL DEBUG] Google login (signup) failed", {
        error: error.message || error,
        timestamp: Date.now()
      });
      let desc = language === 'de' ? 'Google-Anmeldung fehlgeschlagen.' : 'Google sign-in failed.';
      if (error.code === 'auth/popup-closed-by-user') {
        desc = language === 'de' ? 'Das Anmeldefenster wurde geschlossen.' : 'The sign-in popup was closed.';
      }
      setSubmitError(desc);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (isLoading) return;
    
    
    setSubmitError('');
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
          source: "handleAppleSignIn (signup) - email unverified",
          target: "signOut & redirect /login?verification=required",
          uid: user.uid,
          timestamp: Date.now()
        });
        await signOut();

        router.push('/login?verification=required');
        toast({
          title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
          description: language === 'de' 
            ? (verificationEmailSent
                ? "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Wir haben dir einen neuen Bestätigungs-Link an deine E-Mail-Adresse gesendet. Prüfe bitte auch deinen Spam-Ordner."
                : "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Ein neuer Bestätigungs-Link konnte erst vor kurzem gesendet werden, bitte prüfe dein Postfach (auch Spam-Ordner).")
            : (verificationEmailSent
                ? "Please verify your email address to log in. We have sent a new verification link to your email address. Please check your spam folder as well."
                : "Please verify your email address to log in. A new verification link could not be sent recently, please check your inbox."),
        });
        setIsLoading(false);
        return;
      }

      const onboardingCompleted = !!profileData?.onboardingCompleted;

      toast({
        title: language === 'de' ? 'Erfolgreich eingeloggt' : 'Logged in successfully',
        description: language === 'de' ? 'Willkommen zurück bei Aktiva!' : 'Welcome back to Aktiva!',
      });

      console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
        source: "handleAppleSignIn (signup) - flow completed",
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
      console.error("[LEGAL DEBUG] Apple login (signup) failed", {
        error: error.message || error,
        timestamp: Date.now()
      });
      let desc = language === 'de' ? 'Apple-Anmeldung fehlgeschlagen.' : 'Apple sign-in failed.';
      if (error.code === 'auth/popup-closed-by-user') {
        desc = language === 'de' ? 'Das Anmeldefenster wurde geschlossen.' : 'The sign-in popup was closed.';
      }
      setSubmitError(desc);
    } finally {
      setIsLoading(false);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError('');
    try {
      const newUser = await signUp(
        values.fullName, 
        values.email, 
        values.password,
        undefined,
        values.birthday
      );

      // Save legal timestamps to user profile in Firestore
      const { serverTimestamp } = await import('firebase/firestore');
      const userDocRef = doc(db!, 'users', newUser.uid);
      console.warn("[LEGAL DEBUG] Legal consent write detected", {
        source: "signup page onSubmit (credentials signup)",
        uid: newUser.uid,
        isExplicitAcceptFlow: true,
        data: {
          legalAcceptedAt: 'serverTimestamp()',
          termsAcceptedAt: 'serverTimestamp()',
          useTermsAcceptedAt: 'serverTimestamp()',
          privacyAcceptedAt: 'serverTimestamp()',
          cookiesAcceptedAt: 'serverTimestamp()',
          legalVersion: '1.0',
          legalLocale: language
        },
        timestamp: Date.now()
      });
      await setDoc(userDocRef, {
        legalAcceptedAt: serverTimestamp(),
        termsAcceptedAt: serverTimestamp(),
        useTermsAcceptedAt: serverTimestamp(),
        privacyAcceptedAt: serverTimestamp(),
        cookiesAcceptedAt: serverTimestamp(),
        legalVersion: '1.0',
        legalLocale: language
      }, { merge: true });
      
      console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
        source: "signup page onSubmit (credentials signup) - signing out for email verification",
        target: "signOut & redirect /login?verification=required",
        uid: newUser.uid,
        timestamp: Date.now()
      });
      await signOut();
      
      toast({
        title: language === 'de' ? 'Fast geschafft!' : 'Almost done!',
        description: language === 'de' ? "Bitte bestätige deine E-Mail-Adresse (prüfe auch den Spam-Ordner), um dich einzuloggen." : "Please verify your email address (check your spam folder) to log in.",
      });
      
      router.push('/login?verification=required');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        setSubmitError(language === 'de' ? 'Diese E-Mail-Adresse ist bereits registriert.' : 'This email address is already registered.');
      } else if (error.code === 'auth/invalid-email') {
        setSubmitError(language === 'de' ? 'Die E-Mail-Adresse ist ungültig.' : 'The email address is invalid.');
      } else if (error.code === 'auth/weak-password') {
        setSubmitError(language === 'de' ? 'Das Passwort ist zu schwach.' : 'The password is too weak.');
      } else if (error.code === 'auth/too-many-requests') {
        setSubmitError(language === 'de' ? 'Zu viele Fehlversuche. Bitte versuche es später erneut.' : 'Too many attempts. Please try again later.');
      } else if (error.code === 'auth/network-request-failed') {
        const isEmulatorEnabled = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' || 
                                  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
        if (isEmulatorEnabled) {
          setSubmitError(language === 'de' 
            ? 'Auth emulator nicht erreichbar. Bitte Emulator starten oder Emulator-Modus deaktivieren.' 
            : 'Auth emulator not reachable. Please start the emulator or disable emulator mode.');
        } else {
          setSubmitError(language === 'de' ? 'Netzwerkfehler. Bitte überprüfe deine Internetverbindung.' : 'Network error. Please check your internet connection.');
        }
      } else {
        setSubmitError(language === 'de' ? 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.' : 'An unexpected error occurred. Please try again later.');
      }
    }
  }

  return (
    <main className="min-h-screen w-full bg-white dark:bg-neutral-950 flex flex-col items-center justify-center p-6 antialiased">
      
      <div className="w-full max-w-[400px] flex flex-col items-center relative z-10">
        
        {/* Logo Section */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-10">
              <MapPin className="w-10 h-10 text-primary" />
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">aktiva<span className="text-primary">.</span></h1>
          </div>
          
          <div className="mb-4">
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                {language === 'de' ? 'SCHRITT' : 'STEP'} <span className="text-primary">{step}</span> {language === 'de' ? 'VON' : 'OF'} <span className="text-primary">3</span>
             </p>
             <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-neutral-100 font-heading leading-tight">
                {step === 1 && (language === 'de' ? "Willkommen!" : "Welcome!")}
                {step === 2 && (language === 'de' ? "Sicherheit" : "Security")}
                {step === 3 && (language === 'de' ? "Über dich" : "About You")}
             </h1>
          </div>
          <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Connect. Explore. Live.</p>
        </motion.div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{language === 'de' ? 'E-Mail Adresse' : 'Email Address'}</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary transition-colors z-10" />
                            <Input 
                              placeholder="your@email.com" 
                              {...field} 
                              className="h-16 pl-16 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm tracking-wider shadow-none" 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px] font-bold text-rose-500 px-1" />
                      </FormItem>
                    )}
                  />

                  {/* 4 Legal Checkboxes in Step 1 */}
                  <div className="space-y-4 px-2 my-4">
                    <FormField
                      control={form.control}
                      name="termsAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <input 
                              type="checkbox" 
                              id="signup-terms"
                              checked={field.value} 
                              onChange={field.onChange} 
                              className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-primary cursor-pointer" 
                            />
                          </FormControl>
                          <FormLabel htmlFor="signup-terms" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                             {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                             <button 
                               type="button"
                               onClick={() => setIsTermsDialogOpen(true)}
                               className="text-primary hover:underline font-bold"
                             >
                               {language === 'de' ? 'Allgemeinen Geschäftsbedingungen (AGB)' : 'Terms of Service'}
                             </button>
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="useTermsAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <input 
                              type="checkbox" 
                              id="signup-useterms"
                              checked={field.value} 
                              onChange={field.onChange} 
                              className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-primary cursor-pointer" 
                            />
                          </FormControl>
                          <FormLabel htmlFor="signup-useterms" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                             {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                             <button 
                               type="button"
                               onClick={() => setIsUseTermsDialogOpen(true)}
                               className="text-primary hover:underline font-bold"
                             >
                               {language === 'de' ? 'Nutzungsbedingungen' : 'Terms of Use'}
                             </button>
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="privacyAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <input 
                              type="checkbox" 
                              id="signup-privacy"
                              checked={field.value} 
                              onChange={field.onChange} 
                              className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-primary cursor-pointer" 
                            />
                          </FormControl>
                          <FormLabel htmlFor="signup-privacy" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                             {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                             <button 
                               type="button"
                               onClick={() => setIsPrivacyDialogOpen(true)}
                               className="text-primary hover:underline font-bold"
                             >
                               {language === 'de' ? 'Datenschutzerklärung' : 'Privacy Policy'}
                             </button>
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cookiesAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <input 
                              type="checkbox" 
                              id="signup-cookies"
                              checked={field.value} 
                              onChange={field.onChange} 
                              className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-primary cursor-pointer" 
                            />
                          </FormControl>
                          <FormLabel htmlFor="signup-cookies" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                             {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                             <button 
                               type="button"
                               onClick={() => setIsCookiesDialogOpen(true)}
                               className="text-primary hover:underline font-bold"
                             >
                               {language === 'de' ? 'Cookie-Richtlinie' : 'Cookie Policy'}
                             </button>
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-4">
                    <Button 
                      type="button" 
                      onClick={handleStep1Next}
                      className="w-full h-14 text-base font-black rounded-full transition-all active:scale-[0.98] uppercase tracking-widest !shadow-none !border-none" 
                      disabled={!emailValue.includes('@') || !termsAcceptedValue || !useTermsAcceptedValue || !privacyAcceptedValue || !cookiesAcceptedValue}
                    >
                      {language === 'de' ? 'WEITER' : 'CONTINUE'}
                    </Button>
                  </div>

                  {/* Separator */}
                  <div className="w-full flex items-center gap-4 my-6">
                    <div className="flex-1 h-[1px] bg-slate-100 dark:bg-neutral-900" />
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">{language === 'de' ? 'Oder' : 'Or'}</span>
                    <div className="flex-1 h-[1px] bg-slate-100 dark:bg-neutral-900" />
                  </div>

                  {/* Socials */}
                  <div className="w-full grid grid-cols-2 gap-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={handleAppleSignIn}
                      disabled={isLoading || !termsAcceptedValue || !useTermsAcceptedValue || !privacyAcceptedValue || !cookiesAcceptedValue}
                      className="h-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 text-slate-900 dark:text-white font-black text-[11px] uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-neutral-800 transition-all shadow-none flex items-center justify-center disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 384 512">
                        <path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                      </svg>
                      <span className="leading-none pt-0.5">Apple</span>
                    </Button>
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={handleGoogleSignIn}
                      disabled={isLoading || !termsAcceptedValue || !useTermsAcceptedValue || !privacyAcceptedValue || !cookiesAcceptedValue}
                      className="h-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 text-slate-900 dark:text-white font-black text-[11px] uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-neutral-800 transition-all shadow-none flex items-center justify-center disabled:opacity-50"
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
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{language === 'de' ? 'Passwort wählen' : 'Choose Password'}</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary z-10" />
                            <Input type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" {...field} className="h-16 pl-16 pr-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors" aria-label={showPassword ? (language === 'de' ? 'Passwort ausblenden' : 'Hide password') : (language === 'de' ? 'Passwort anzeigen' : 'Show password')}>
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Strength Meter */}
                  <div className="flex gap-1 px-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all duration-500", strengthScore >= i ? getStrengthColor(strengthScore) : "bg-slate-100 dark:bg-white/10")} />
                    ))}
                  </div>

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{language === 'de' ? 'Bestätigen' : 'Confirm'}</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary z-10" />
                            <Input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" {...field} className="h-16 pl-16 pr-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors" aria-label={showConfirmPassword ? (language === 'de' ? 'Passwort ausblenden' : 'Hide password') : (language === 'de' ? 'Passwort anzeigen' : 'Show password')}>
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex gap-4">
                    <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1 h-14 rounded-full font-black text-slate-400 uppercase tracking-widest text-[11px]">{language === 'de' ? 'ZURÜCK' : 'BACK'}</Button>
                    <Button type="button" onClick={handleStep2Next} className="flex-[2] h-14 rounded-full font-black uppercase tracking-widest" disabled={!validation.hasLength || !validation.hasUpper || !validation.hasLower || !validation.hasNumber || !validation.hasSpecial || !passwordsMatch}>{language === 'de' ? 'WEITER' : 'CONTINUE'}</Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{language === 'de' ? 'Vollständiger Name' : 'Full Name'}</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary z-10" />
                            <Input placeholder={language === 'de' ? 'Max Mustermann' : 'John Doe'} {...field} className="h-16 pl-16 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="birthday"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{language === 'de' ? 'Geburtsdatum' : 'Birthday'}</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary z-10" />
                            <Input 
                              placeholder="DD/MM/YYYY" 
                              {...field} 
                              maxLength={10}
                              className="h-16 pl-16 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" 
                              onChange={(e) => {
                                let v = e.target.value.replace(/\D/g, '');
                                if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
                                if (v.length > 5) v = v.substring(0, 5) + '/' + v.substring(5, 9);
                                field.onChange(v);
                              }}
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="pt-4 flex gap-4">
                    <Button type="button" variant="ghost" onClick={() => setStep(2)} className="flex-1 h-14 rounded-full font-black text-slate-400 uppercase tracking-widest text-[11px]">{language === 'de' ? 'ZURÜCK' : 'BACK'}</Button>
                    <Button type="submit" className="flex-[2] h-14 rounded-full font-black uppercase tracking-widest" disabled={form.formState.isSubmitting || fullNameValue.length < 2 || birthdayValue.length !== 10}>
                      {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (language === 'de' ? "KONTO ERSTELLEN" : "CREATE ACCOUNT")}
                    </Button>
                  </div>
                  {submitError && <p className="text-[10px] font-black text-rose-500 text-center uppercase tracking-widest">{submitError}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </Form>

        {/* Legal Dialogs */}
        <LegalDialog
          open={isTermsDialogOpen}
          onOpenChange={setIsTermsDialogOpen}
          title={language === 'de' ? "AGB" : "AGB / Terms of Service"}
          subtitle={language === 'de' ? "Vertragliche Grundlagen für die Nutzung von Aktiva." : "Contractual framework for using Aktiva."}
          icon={<FileText className="w-5 h-5 text-primary" />}
          closeText={language === 'de' ? "Schließen" : "Close"}
        >
          <LegalPlaceholderNotice />
          <AGBText language={language} />
        </LegalDialog>

        <LegalDialog
          open={isUseTermsDialogOpen}
          onOpenChange={setIsUseTermsDialogOpen}
          title={language === 'de' ? "Nutzungsbedingungen" : "Terms of Use"}
          subtitle={language === 'de' ? "Regeln für ein sicheres und respektvolles Miteinander auf Aktiva." : "Rules for a safe and respectful community on Aktiva."}
          icon={<FileText className="w-5 h-5 text-primary" />}
          closeText={language === 'de' ? "Schließen" : "Close"}
        >
          <LegalPlaceholderNotice />
          <TermsOfUseText language={language} />
        </LegalDialog>

        <LegalDialog
          open={isPrivacyDialogOpen}
          onOpenChange={setIsPrivacyDialogOpen}
          title={language === 'de' ? "Datenschutzerklärung" : "Datenschutzerklärung / Privacy Policy"}
          subtitle={language === 'de' ? "Informationen darüber, wie Aktiva personenbezogene Daten verarbeitet." : "Information on how Aktiva processes personal data."}
          icon={<Shield className="w-5 h-5 text-primary" />}
          closeText={language === 'de' ? "Schließen" : "Close"}
        >
          <LegalPlaceholderNotice />
          <PrivacyPolicyText language={language} />
        </LegalDialog>

        <LegalDialog
          open={isCookiesDialogOpen}
          onOpenChange={setIsCookiesDialogOpen}
          title={language === 'de' ? "Cookie-Richtlinie" : "Cookie Policy"}
          subtitle={language === 'de' ? "Informationen zu Cookies, lokaler Speicherung und ähnlichen Technologien." : "Information about cookies, local storage and similar technologies."}
          icon={<Shield className="w-5 h-5 text-primary" />}
          closeText={language === 'de' ? "Schließen" : "Close"}
        >
          <LegalPlaceholderNotice />
          <CookiePolicyText language={language} />
        </LegalDialog>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            {language === 'de' ? 'Schon ein Konto?' : 'Already have an account?'} 
            <button 
              onClick={() => {
                
                router.push('/login');
              }}
              className="text-primary ml-2 hover:underline underline-offset-4 font-black"
            >
              {language === 'de' ? 'Einloggen' : 'Sign in'}
            </button>
          </p>
        </div>

      </div>
    </main>
  );
}

// Helper components for Legal Dialogs
interface LegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  closeText: string;
}

function LegalDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  children,
  closeText
}: LegalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-neutral-900">
        <div className="shrink-0 border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {icon}
              </div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                {title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
              {subtitle}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
          <div className="space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {children}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-neutral-900">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full h-12 rounded-full font-black uppercase tracking-widest transition-all"
          >
            {closeText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

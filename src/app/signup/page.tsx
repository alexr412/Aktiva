'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/hooks/use-language';
import { signUp, signOut } from '@/lib/firebase/auth';
import { isUsernameTaken } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  ArrowRight, 
  User, 
  Lock, 
  Loader2,
  CheckCircle2,
  MapPin,
  Calendar,
  Shield,
  X,
  Check,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

export default function SignupPage() {
  const router = useRouter();
  const language = useLanguage();
  const { toast } = useToast();
  
  const [isRegistered, setIsRegistered] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<'available' | 'taken' | 'invalid' | null>(null);
  
  const [isTermsDialogOpen, setIsTermsDialogOpen] = useState(false);
  const [isPrivacyDialogOpen, setIsPrivacyDialogOpen] = useState(false);

  const formSchema = z.object({
    username: z.string()
      .min(4, { message: language === 'de' ? 'Mindestens 4 Zeichen.' : 'Minimum 4 characters.' })
      .max(32, { message: language === 'de' ? 'Maximal 32 Zeichen.' : 'Maximum 32 characters.' })
      .regex(/^[a-zA-Z0-9._]+$/, { message: language === 'de' ? 'Nur Buchstaben, Zahlen, Punkte und Unterstriche.' : 'Only letters, numbers, dots and underscores.' })
      .transform(val => val.toLowerCase()),
    email: z.string().email({ message: language === 'de' ? 'Ungültige E-Mail-Adresse.' : 'Invalid email address.' }),
    fullName: z.string().min(2, { message: language === 'de' ? 'Bitte gib deinen Namen an.' : 'Please provide your name.' }),
    birthday: z.string().refine((val) => {
      const date = new Date(val);
      const now = new Date();
      const age = now.getFullYear() - date.getFullYear();
      return age >= 16;
    }, { message: language === 'de' ? 'Du musst mindestens 16 Jahre alt sein.' : 'You must be at least 16 years old.' }),
    password: z.string()
      .min(8, { message: language === 'de' ? 'Mindestens 8 Zeichen.' : 'Minimum 8 characters.' })
      .max(32, { message: language === 'de' ? 'Maximal 32 Zeichen.' : 'Maximum 32 characters.' })
      .regex(/[A-Z]/, { message: language === 'de' ? 'Ein Großbuchstabe.' : 'One uppercase letter.' })
      .regex(/[a-z]/, { message: language === 'de' ? 'Ein Kleinbuchstabe.' : 'One lowercase letter.' })
      .regex(/[0-9]/, { message: language === 'de' ? 'Eine Zahl.' : 'One number.' })
      .regex(/[^A-Za-z0-9]/, { message: language === 'de' ? 'Ein Sonderzeichen.' : 'One special character.' }),
    confirmPassword: z.string(),
    termsAccepted: z.boolean().refine(val => val === true, { message: language === 'de' ? 'Bitte akzeptiere die AGB.' : 'Please accept the Terms.' }),
    privacyAccepted: z.boolean().refine(val => val === true, { message: language === 'de' ? 'Bitte akzeptiere die Datenschutzbestimmungen.' : 'Please accept the Privacy Policy.' }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: language === 'de' ? "Passwörter stimmen nicht überein." : "Passwords do not match.",
    path: ["confirmPassword"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      fullName: '',
      birthday: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false,
      privacyAccepted: false,
    },
  });

  const passwordValue = form.watch('password');
  const usernameValue = form.watch('username') || '';
  const fullNameValue = form.watch('fullName') || '';
  const birthdayValue = form.watch('birthday') || '';
  const emailValue = form.watch('email') || '';
  const termsAcceptedValue = form.watch('termsAccepted');
  const privacyAcceptedValue = form.watch('privacyAccepted');

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

  const forbiddenWords = ['sex', 'porn', 'fuck', 'bitch', 'schlampe', 'fotze', 'hurensohn', 'wichser', 'nazi', 'hitler', 'admin', 'support']; 
  const hasProfanity = forbiddenWords.some(word => usernameValue.toLowerCase().includes(word));

  useEffect(() => {
    if (step !== 4 || usernameValue.length < 4 || usernameValue.length > 32 || hasProfanity) {
      if (usernameAvailability !== null) setUsernameAvailability(null);
      return;
    }

    const checkAvailability = async () => {
      setIsUsernameChecking(true);
      try {
        const isTaken = await isUsernameTaken(usernameValue);
        setUsernameAvailability(isTaken ? 'taken' : 'available');
      } catch (err) {
        console.error(err);
      } finally {
        setIsUsernameChecking(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 600);
    return () => clearTimeout(timeoutId);
  }, [usernameValue, step, hasProfanity]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError('');
    try {
      const isTaken = await isUsernameTaken(values.username);
      if (isTaken) {
         setSubmitError(language === 'de' ? 'Dieser Username ist leider schon vergeben.' : 'This username is already taken.');
         return;
      }

      await signUp(
        values.fullName, 
        values.email, 
        values.password,
        values.username,
        values.birthday
      );
      
      await signOut();
      
      toast({
        title: language === 'de' ? 'Fast geschafft!' : 'Almost done!',
        description: language === 'de' ? "Bitte bestätige deine E-Mail-Adresse (prüfe auch den Spam-Ordner), um dich einzuloggen." : "Please verify your email address (check your spam folder) to log in.",
      });
      
      router.push('/login');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        setSubmitError(language === 'de' ? 'Diese E-Mail-Adresse ist bereits registriert.' : 'This email address is already registered.');
      } else {
        setSubmitError((language === 'de' ? 'Fehler bei der Registrierung: ' : 'Registration error: ') + (error.message || (language === 'de' ? 'Ein unerwarteter Fehler ist aufgetreten.' : 'An unexpected error occurred.')));
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
              <MapPin className="w-10 h-10 text-[#10b981]" />
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">aktiva<span className="text-[#10b981]">.</span></h1>
          </div>
          
          <div className="mb-4">
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                {language === 'de' ? 'SCHRITT' : 'STEP'} <span className="text-[#10b981]">{step}</span> {language === 'de' ? 'VON' : 'OF'} <span className="text-[#10b981]">5</span>
             </p>
             <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-neutral-100 font-heading leading-tight">
                {step === 1 && (language === 'de' ? "Willkommen!" : "Welcome!")}
                {step === 2 && (language === 'de' ? "Sicherheit" : "Security")}
                {step === 3 && (language === 'de' ? "Über dich" : "About You")}
                {step === 4 && "@handle"}
                {step === 5 && (language === 'de' ? "Fast fertig" : "Almost done")}
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
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#10b981] transition-colors z-10" />
                            <Input 
                              placeholder="your@email.com" 
                              {...field} 
                              className="h-16 pl-16 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-emerald-500/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm tracking-wider shadow-none" 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px] font-bold text-rose-500 px-1" />
                      </FormItem>
                    )}
                  />
                  <div className="pt-4">
                    <Button 
                      type="button" 
                      onClick={() => emailValue.includes('@') && setStep(2)}
                      className="w-full h-14 text-base font-black rounded-full bg-[#10b981] hover:bg-emerald-600 text-white transition-all active:scale-[0.98] uppercase tracking-widest !shadow-none !border-none" 
                      disabled={!emailValue.includes('@')}
                    >
                      {language === 'de' ? 'WEITER' : 'CONTINUE'}
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
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#10b981] z-10" />
                            <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="h-16 pl-16 pr-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-emerald-500/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#10b981] transition-colors">
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
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#10b981] z-10" />
                            <Input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" {...field} className="h-16 pl-16 pr-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-emerald-500/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#10b981] transition-colors">
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex gap-4">
                    <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1 h-14 rounded-full font-black text-slate-400 uppercase tracking-widest text-[11px]">{language === 'de' ? 'ZURÜCK' : 'BACK'}</Button>
                    <Button type="button" onClick={() => setStep(3)} className="flex-[2] h-14 rounded-full bg-[#10b981] text-white font-black uppercase tracking-widest" disabled={!validation.hasLength || !validation.hasUpper || !validation.hasLower || !validation.hasNumber || !validation.hasSpecial || !passwordsMatch}>{language === 'de' ? 'WEITER' : 'CONTINUE'}</Button>
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
                            <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#10b981] z-10" />
                            <Input placeholder={language === 'de' ? 'Max Mustermann' : 'John Doe'} {...field} className="h-16 pl-16 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-emerald-500/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" />
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
                            <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#10b981] z-10" />
                            <Input 
                              placeholder="DD/MM/YYYY" 
                              {...field} 
                              maxLength={10}
                              className="h-16 pl-16 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-emerald-500/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" 
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
                    <Button type="button" onClick={() => fullNameValue.length >= 2 && birthdayValue.length === 10 && setStep(4)} className="flex-[2] h-14 rounded-full bg-[#10b981] text-white font-black uppercase tracking-widest" disabled={fullNameValue.length < 2 || birthdayValue.length !== 10}>{language === 'de' ? 'WEITER' : 'CONTINUE'}</Button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{language === 'de' ? 'Username wählen' : 'Choose Username'}</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2">
                              <span className="text-[#10b981] font-black text-lg">@</span>
                            </div>
                            <Input 
                              placeholder="username" 
                              {...field} 
                              className={cn(
                                "h-16 pl-12 pr-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-emerald-500/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none",
                                usernameAvailability === 'taken' && "focus-visible:ring-rose-500/50"
                              )} 
                              onChange={(e) => field.onChange(e.target.value.replace(/\s/g, '').toLowerCase())} 
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2">
                              {isUsernameChecking && <Loader2 className="h-5 w-5 animate-spin text-slate-300" />}
                              {!isUsernameChecking && usernameAvailability === 'available' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                              {!isUsernameChecking && usernameAvailability === 'taken' && <X className="h-5 w-5 text-rose-500" />}
                            </div>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="pt-4 flex gap-4">
                    <Button type="button" variant="ghost" onClick={() => setStep(3)} className="flex-1 h-14 rounded-full font-black text-slate-400 uppercase tracking-widest text-[11px]">{language === 'de' ? 'ZURÜCK' : 'BACK'}</Button>
                    <Button type="button" onClick={() => usernameValue.length >= 4 && usernameAvailability === 'available' && setStep(5)} className="flex-[2] h-14 rounded-full bg-[#10b981] text-white font-black uppercase tracking-widest" disabled={usernameValue.length < 4 || usernameAvailability !== 'available' || isUsernameChecking}>{language === 'de' ? 'WEITER' : 'CONTINUE'}</Button>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div key="step5" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                   <div className="p-6 bg-slate-50 dark:bg-neutral-900 rounded-[2.5rem] space-y-6">
                    <div className="flex gap-4">
                      <Shield className="w-6 h-6 text-[#10b981] shrink-0" />
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">{language === 'de' ? 'RECHTLICHES' : 'LEGAL'}</p>
                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                          {language === 'de' ? 'Bitte bestätige deine Zustimmung zu unseren Richtlinien.' : 'Please confirm your agreement to our policies.'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="termsAccepted"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-[#10b981]" />
                            </FormControl>
                            <FormLabel className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                               {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                               <button 
                                 type="button"
                                 onClick={() => setIsTermsDialogOpen(true)}
                                 className="text-[#10b981] hover:underline"
                               >
                                 {language === 'de' ? 'Allgemeinen Geschäftsbedingungen (AGB)' : 'Terms of Service'}
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
                              <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-[#10b981]" />
                            </FormControl>
                            <FormLabel className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                               {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                               <button 
                                 type="button"
                                 onClick={() => setIsPrivacyDialogOpen(true)}
                                 className="text-[#10b981] hover:underline"
                               >
                                 {language === 'de' ? 'Datenschutzerklärung' : 'Privacy Policy'}
                               </button>
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <Button type="button" variant="ghost" onClick={() => setStep(4)} className="flex-1 h-14 rounded-full font-black text-slate-400 uppercase tracking-widest text-[11px]">{language === 'de' ? 'ZURÜCK' : 'BACK'}</Button>
                    <Button type="submit" className="flex-[2] h-14 rounded-full bg-[#10b981] text-white font-black uppercase tracking-widest" disabled={form.formState.isSubmitting || !termsAcceptedValue || !privacyAcceptedValue}>
                      {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (language === 'de' ? "FERTIGSTELLEN" : "FINISH")}
                    </Button>
                  </div>
                  {submitError && <p className="text-[10px] font-black text-rose-500 text-center uppercase tracking-widest">{submitError}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </Form>

        {/* Legal Dialogs */}
        <Dialog open={isTermsDialogOpen} onOpenChange={setIsTermsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-[2.5rem] p-0 border-none">
            <div className="p-8">
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#10b981]" />
                  </div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight">Terms of Service</DialogTitle>
                </div>
                <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Version 2.0 • Stand 05.05.2026</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 text-sm font-medium text-slate-600 leading-relaxed">
                <p>Willkommen bei Aktvia. Durch die Nutzung unserer App erklärst du dich mit den folgenden Bedingungen einverstanden.</p>
                
                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase text-xs">1. Nutzung der Plattform</h4>
                  <p>Aktvia ist eine Plattform zur Vernetzung von Menschen für Freizeitaktivitäten. Die Nutzung ist ab 16 Jahren gestattet. Du bist für die Sicherheit deines Kontos verantwortlich.</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase text-xs">2. Verhaltenskodex</h4>
                  <p>Respekt und Sicherheit stehen an erster Stelle. Belästigung oder illegale Aktivitäten führen zum sofortigen Ausschluss.</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase text-xs">3. Haftung</h4>
                  <p>Aktvia vermittelt Kontakte, haftet jedoch nicht für Vorfälle während physischer Aktivitäten. Die Teilnahme erfolgt auf eigene Gefahr.</p>
                </div>
              </div>
              
              <div className="mt-8">
                <Button onClick={() => setIsTermsDialogOpen(false)} className="w-full h-12 rounded-full bg-[#10b981] text-white font-black uppercase tracking-widest">Schließen</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isPrivacyDialogOpen} onOpenChange={setIsPrivacyDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-[2.5rem] p-0 border-none">
            <div className="p-8">
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[#10b981]" />
                  </div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight">Privacy Policy</DialogTitle>
                </div>
                <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Safety Standard • Stand 05.05.2026</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 text-sm font-medium text-slate-600 leading-relaxed">
                <p>Deine Privatsphäre ist unser höchstes Gut. Hier erfährst du, wie wir deine Daten schützen.</p>
                
                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase text-xs">1. Datenerhebung</h4>
                  <p>Wir erheben nur notwendige Daten: E-Mail, Name, Geburtsdatum und Standort (nur bei Nutzung), um Aktivitäten anzuzeigen.</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase text-xs">2. Datenweitergabe</h4>
                  <p>Aktvia verkauft niemals Daten an Dritte. Daten werden nur für Dienstleistungen (z.B. Hosting) geteilt.</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase text-xs">3. Deine Rechte</h4>
                  <p>Du hast jederzeit das Recht auf Auskunft oder Löschung deiner Daten in den Profileinstellungen.</p>
                </div>
              </div>
              
              <div className="mt-8">
                <Button onClick={() => setIsPrivacyDialogOpen(false)} className="w-full h-12 rounded-full bg-[#10b981] text-white font-black uppercase tracking-widest">Schließen</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            {language === 'de' ? 'Schon ein Konto?' : 'Already have an account?'} 
            <button 
              onClick={() => router.push('/login')}
              className="text-[#10b981] ml-2 hover:underline underline-offset-4 font-black"
            >
              {language === 'de' ? 'Einloggen' : 'Sign in'}
            </button>
          </p>
        </div>

      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
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
  Compass,
  Loader2,
  CheckCircle2,
  MapPin,
  Calendar,
  Shield,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';



export default function SignupPage() {
  const router = useRouter();
  const language = useLanguage();
  const { toast } = useToast();
  
  const [isRegistered, setIsRegistered] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: '', color: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('signup');
  const [step, setStep] = useState(1);

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
    termsAccepted: z.boolean().refine(val => val === true, { message: language === 'de' ? 'Bitte akzeptiere die Bedingungen.' : 'Please accept the terms.' }),
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
    },
  });

  const passwordValue = form.watch('password');
  const usernameValue = form.watch('username') || '';
  const fullNameValue = form.watch('fullName') || '';
  const birthdayValue = form.watch('birthday') || '';
  const emailValue = form.watch('email') || '';
  const termsAcceptedValue = form.watch('termsAccepted');

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

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError('');
    
    if (strengthScore < 1) {
        setSubmitError(language === 'de' ? 'Dein Passwort ist zu einfach.' : 'Your password is too simple.');
        return;
    }

    if (hasProfanity) {
        setSubmitError(language === 'de' ? 'Bitte wähle einen anderen Usernamen.' : 'Please choose a different username.');
        return;
    }

    try {
      const isTaken = await isUsernameTaken(values.username);
      if (isTaken) {
         setSubmitError(language === 'de' ? 'Dieser Username ist leider schon vergeben.' : 'This username is already taken.');
         return;
      }

      const user = await signUp(
        values.fullName, 
        values.email, 
        values.password,
        values.username,
        values.birthday
      );
      
      toast({
        title: language === 'de' ? 'Account erstellt!' : 'Account created!',
        description: language === 'de' ? "Willkommen bei Aktiva!" : "Welcome to Aktiva!",
      });
      
      router.push('/onboarding');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        setSubmitError(language === 'de' ? 'Diese E-Mail-Adresse ist bereits registriert.' : 'This email address is already registered.');
      } else {
        setSubmitError((language === 'de' ? 'Fehler bei der Registrierung: ' : 'Registration error: ') + (error.message || (language === 'de' ? 'Ein unerwarteter Fehler ist aufgetreten.' : 'An unexpected error occurred.')));
      }
    }
  }

  if (isRegistered) {
    return (
      <main className="relative h-screen w-full flex items-center justify-center p-6 bg-[#E8EEFF]">
        {/* Success Effects */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-emerald-400/10 blur-[120px]" />
        </div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[3rem] shadow-2xl p-8 text-center relative z-10"
        >
          <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mb-6 shadow-inner ring-4 ring-emerald-50">
            <Check className="w-10 h-10 text-emerald-500" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-black text-neutral-800 mb-3">{language === 'de' ? 'Fast fertig!' : 'Almost done!'}</h2>
          <p className="text-neutral-500 font-bold mb-8 leading-relaxed text-sm">
            {language === 'de' ? 'Wir haben einen Bestätigungslink an' : 'We have sent a verification link to'} <br />
            <span className="text-[#4E89E3] font-black">{emailValue}</span> <br />
            {language === 'de' ? 'gesendet. Bitte aktiviere dein Konto.' : 'sent. Please activate your account.'}
          </p>
          <Button asChild className="w-full h-14 text-base font-black rounded-2xl bg-gradient-to-r from-[#5BA17F] to-[#4E89E3] shadow-xl shadow-blue-500/30">
            <Link href="/login">
              {language === 'de' ? 'Zum Login' : 'To Login'}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#FAF7FF] dark:bg-[#050505] selection:bg-emerald-500/30 font-sans tracking-tight transition-colors duration-1000">
      {/* --- Chromatic Environmental Layers --- */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Saturated Mesh Gradients - High Energy */}
        <motion.div 
          animate={{ scale: [1, 1.4, 1], x: [-80, 80, -80], y: [-40, 40, -40], rotate: [0, 45, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -right-[10%] w-[100%] h-[100%] rounded-full bg-emerald-400/30 dark:bg-emerald-500/15 blur-[120px]" 
        />
        <motion.div 
          animate={{ scale: [1.4, 1, 1.4], x: [80, -80, 80], y: [40, -40, 40], rotate: [45, 0, 45] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] -left-[20%] w-[110%] h-[110%] rounded-full bg-blue-500/30 dark:bg-blue-600/15 blur-[140px]" 
        />

        {/* Dynamic Pattern Layer */}
        <div className="absolute -top-[20%] -right-[10%] w-[100%] h-[100%] rounded-full bg-emerald-400/30 blur-[120px]" />
        <div className="absolute top-[20%] -left-[20%] w-[110%] h-[110%] rounded-full bg-blue-500/30 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.2]" style={{ backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      <div className="relative z-[100] flex flex-col items-center justify-center min-h-screen px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-[460px] bg-white/60 dark:bg-[#0a0a0b]/40 backdrop-blur-[60px] rounded-[3rem] border border-white/80 shadow-[0_60px_120px_-20px_rgba(0,0,0,0.12)] p-8 md:p-14"
        >
            <div className="mb-8 md:mb-12 text-center">
              <div className="flex justify-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className={cn("h-1.5 rounded-full transition-all duration-500", step === s ? "w-8 bg-emerald-500" : "w-2 bg-slate-200 dark:bg-white/10")} />
                ))}
              </div>
              <h2 className="text-3xl md:text-4xl font-[1000] text-slate-950 dark:text-white tracking-tighter mb-2">
                {step === 1 && (language === 'de' ? "Willkommen!" : "Welcome!")}
                {step === 2 && (language === 'de' ? "Sicherheit" : "Security")}
                {step === 3 && (language === 'de' ? "Über dich" : "About You")}
                {step === 4 && "@handle"}
                {step === 5 && (language === 'de' ? "Fast fertig" : "Almost done")}
              </h2>
              <p className="text-slate-500 dark:text-emerald-400 font-bold uppercase tracking-[0.2em] text-[10px]">
                {language === 'de' ? 'Schritt' : 'Step'} {step} {language === 'de' ? 'von' : 'of'} 5
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                       <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-[1000] dark:text-emerald-400 uppercase tracking-[0.3em] px-1">{language === 'de' ? 'E-Mail Adresse' : 'Email Address'}</FormLabel>
                            <FormControl>
                              <div className="relative group/input">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600/60 transition-colors" />
                                <Input placeholder={language === 'de' ? 'E-Mail-Adresse' : 'Email Address'} {...field} className="h-18 pl-14 rounded-3xl bg-white dark:bg-white/[0.05] border-2 border-slate-100 dark:border-white/10 focus-visible:border-emerald-500 focus-visible:ring-0 font-black text-slate-950 dark:text-white" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" onClick={() => form.getValues('email').includes('@') && setStep(2)} className="w-full h-18 text-sm font-black rounded-3xl bg-emerald-500 text-black shadow-lg" disabled={!form.getValues('email').includes('@')}>
                        {language === 'de' ? 'WEITER' : 'CONTINUE'} <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                       <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-[1000] dark:text-emerald-400 uppercase tracking-[0.3em] px-1">{language === 'de' ? 'Passwort wählen' : 'Choose Password'}</FormLabel>
                            <FormControl>
                              <div className="relative group/input">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600/60 transition-colors" />
                                <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="h-18 pl-14 pr-12 rounded-3xl bg-white dark:bg-white/[0.05] border-2 border-slate-100 dark:border-white/10 focus-visible:border-emerald-500 focus-visible:ring-0 font-black text-slate-950 dark:text-white" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors">
                                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      {/* Password Strength Meter (7 segments) */}
                      <div className="flex gap-1 px-1 mt-[-8px]">
                        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                          <div 
                            key={i} 
                            className={cn(
                              "h-1.5 flex-1 rounded-full transition-all duration-500",
                              strengthScore >= i ? getStrengthColor(strengthScore) : "bg-slate-100 dark:bg-white/10"
                            )} 
                          />
                        ))}
                      </div>

                       <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-[1000] dark:text-emerald-400 uppercase tracking-[0.3em] px-1">{language === 'de' ? 'Bestätigen' : 'Confirm'}</FormLabel>
                            <FormControl>
                              <div className="relative group/input">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600/60 transition-colors" />
                                <Input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" {...field} className="h-18 pl-14 pr-12 rounded-3xl bg-white dark:bg-white/[0.05] border-2 border-slate-100 dark:border-white/10 focus-visible:border-emerald-500 focus-visible:ring-0 font-black text-slate-950 dark:text-white" />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors">
                                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                       <div className="space-y-2 px-2">
                        {[
                          { val: validation.hasLength, label: language === 'de' ? '8-32 Zeichen' : '8-32 Characters' },
                          { val: validation.hasUpper && validation.hasLower, label: language === 'de' ? 'Groß & Klein' : 'Upper & Lower' },
                          { val: validation.hasNumber, label: language === 'de' ? 'Eine Zahl' : 'One Number' },
                          { val: validation.hasSpecial, label: language === 'de' ? 'Sonderzeichen' : 'Special Char' },
                          { val: passwordsMatch, label: language === 'de' ? 'Passwörter gleich' : 'Passwords match' },
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className={cn("w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all", item.val ? "bg-emerald-500 border-emerald-500" : "border-slate-200")}>
                              {item.val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className={cn("text-[10px] font-black uppercase tracking-wider", item.val ? "text-emerald-600" : "text-slate-400")}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                       <div className="pt-4 flex gap-4">
                        <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1 h-18 rounded-3xl font-black text-slate-400">{language === 'de' ? 'ZURÜCK' : 'BACK'}</Button>
                        <Button type="button" onClick={() => setStep(3)} className="flex-[2] h-18 rounded-3xl bg-emerald-500 text-black font-black" disabled={!validation.hasLength || !validation.hasUpper || !validation.hasLower || !validation.hasNumber || !validation.hasSpecial || !passwordsMatch}>{language === 'de' ? 'WEITER' : 'CONTINUE'}</Button>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                       <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-[1000] dark:text-emerald-400 uppercase tracking-[0.3em] px-1">{language === 'de' ? 'Name' : 'Name'}</FormLabel>
                            <FormControl>
                              <div className="relative group/input">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600/60 transition-colors" />
                                <Input placeholder={language === 'de' ? 'Name' : 'Name'} {...field} className="h-18 pl-14 rounded-3xl bg-white dark:bg-white/[0.05] border-2 border-slate-100 dark:border-white/10 focus-visible:border-emerald-500 focus-visible:ring-0 font-black text-slate-950 dark:text-white" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="birthday"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-[1000] dark:text-emerald-400 uppercase tracking-[0.3em] px-1">{language === 'de' ? 'Geburtsdatum' : 'Birthday'}</FormLabel>
                            <FormControl>
                              <div className="relative group/input">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600/60 transition-colors" />
                                <Input 
                                  placeholder="DD/MM/YYYY" 
                                  {...field} 
                                  maxLength={10}
                                  className="h-18 pl-14 rounded-3xl bg-white dark:bg-white/[0.05] border-2 border-slate-100 dark:border-white/10 focus-visible:border-emerald-500 focus-visible:ring-0 font-black text-slate-950 dark:text-white" 
                                  onChange={(e) => {
                                    let v = e.target.value.replace(/\D/g, '');
                                    if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
                                    if (v.length > 5) v = v.substring(0, 5) + '/' + v.substring(5, 9);
                                    field.onChange(v);
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <div className="pt-4 flex gap-4">
                        <Button type="button" variant="ghost" onClick={() => setStep(2)} className="flex-1 h-18 rounded-3xl font-black text-slate-400">{language === 'de' ? 'ZURÜCK' : 'BACK'}</Button>
                        <Button type="button" onClick={() => fullNameValue.length >= 2 && birthdayValue.length === 10 && setStep(4)} className="flex-[2] h-18 rounded-3xl bg-emerald-500 text-black font-black" disabled={fullNameValue.length < 2 || birthdayValue.length !== 10}>{language === 'de' ? 'WEITER' : 'CONTINUE'}</Button>
                      </div>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div key="step4" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                       <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-[1000] dark:text-emerald-400 uppercase tracking-[0.3em] px-1">{language === 'de' ? 'Username wählen' : 'Choose Username'}</FormLabel>
                            <FormControl>
                              <div className="relative group/input">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2">
                                  <span className="text-emerald-600 font-black text-lg">@</span>
                                </div>
                                <Input 
                                  placeholder="username" 
                                  {...field} 
                                  maxLength={32}
                                  className="h-18 pl-10 rounded-3xl bg-white dark:bg-white/[0.05] border-2 border-slate-100 dark:border-white/10 focus-visible:border-emerald-500 focus-visible:ring-0 font-black text-slate-950 dark:text-white" 
                                  onChange={(e) => field.onChange(e.target.value.replace(/\s/g, '').toLowerCase())} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <div className="pt-4 flex gap-4">
                        <Button type="button" variant="ghost" onClick={() => setStep(3)} className="flex-1 h-18 rounded-3xl font-black text-slate-400">{language === 'de' ? 'ZURÜCK' : 'BACK'}</Button>
                        <Button 
                          type="button" 
                          onClick={() => usernameValue.length >= 4 && usernameValue.length <= 32 && !hasProfanity && setStep(5)} 
                          className="flex-[2] h-18 rounded-3xl bg-emerald-500 text-black font-black" 
                          disabled={usernameValue.length < 4 || usernameValue.length > 32 || hasProfanity}
                        >
                          {language === 'de' ? 'WEITER' : 'CONTINUE'}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {step === 5 && (
                    <motion.div key="step5" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                      <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border-2 border-slate-100 dark:border-white/10 space-y-6">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-6 h-6 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">{language === 'de' ? 'Nutzung & Datenschutz' : 'Usage & Privacy'}</p>
                            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                              {language === 'de' ? 'Bitte bestätige, dass du unsere' : 'Please confirm that you have read our'}{' '}
                              <Link href="/terms" className="text-emerald-500 hover:text-emerald-400 underline underline-offset-2">{language === 'de' ? 'AGB' : 'Terms'}</Link>{' '}
                              {language === 'de' ? 'und' : 'and'}{' '}
                              <Link href="/privacy" className="text-emerald-500 hover:text-emerald-400 underline underline-offset-2">{language === 'de' ? 'Datenschutzrichtlinien' : 'Privacy Policy'}</Link>{' '}
                              {language === 'de' ? 'gelesen hast.' : 'read.'}
                            </p>
                          </div>
                        </div>

                        <FormField
                          control={form.control}
                          name="termsAccepted"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-6 h-6 rounded-lg border-2 border-slate-200 checked:bg-emerald-500 transition-all cursor-pointer" />
                              </FormControl>
                               <FormLabel className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                                 {language === 'de' ? 'Ich akzeptiere die' : 'I accept the'} <Link href="/terms" className="text-emerald-500 hover:text-emerald-400 underline underline-offset-2">{language === 'de' ? 'Bedingungen' : 'Terms'}</Link>
                               </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>

                       <div className="pt-4 flex gap-4">
                        <Button type="button" variant="ghost" onClick={() => setStep(4)} className="flex-1 h-18 rounded-3xl font-black text-slate-400">{language === 'de' ? 'ZURÜCK' : 'BACK'}</Button>
                        <Button type="submit" className="flex-[2] h-18 rounded-3xl bg-emerald-500 text-black font-black shadow-xl" disabled={form.formState.isSubmitting || !termsAcceptedValue}>
                          {form.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : (language === 'de' ? "FERTIGSTELLEN" : "FINISH")}
                        </Button>
                      </div>
                      {submitError && (
                        <div className="mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-center">
                          <p className="text-xs font-black text-rose-600 dark:text-rose-400">{submitError}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </Form>
        </motion.div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 w-full h-40 bg-gradient-to-t from-[#FAF7FF] via-[#FAF7FF]/80 to-transparent z-10 pointer-events-none" />
    </main>
  );
}

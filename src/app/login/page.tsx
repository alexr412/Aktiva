'use client';

import { useState } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/hooks/use-language';
import { signIn, signOut, sendPasswordReset } from '@/lib/firebase/auth';
import { sendEmailVerification } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  MapPin, 
  Users, 
  Compass,
  Apple
} from 'lucide-react';



export default function LoginPage() {
  const router = useRouter();
  const language = useLanguage();
  const { toast } = useToast();

  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  const formSchema = z.object({
    email: z.string().email({ message: language === 'de' ? 'Ungültige E-Mail-Adresse.' : 'Invalid email address.' }),
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
    try {
      const user = await signIn(values.email, values.password);

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        await signOut(); 
        throw new Error(language === 'de' ? "Zugriff verweigert: Ein neuer Bestätigungs-Link wurde an deine E-Mail-Adresse gesendet. Bitte prüfe deinen Posteingang und Spam-Ordner." : "Access Denied: A new verification link has been sent. Please check your inbox and spam folder.");
      }

      toast({
        title: language === 'de' ? 'Login erfolgreich' : 'Login successful',
        description: language === 'de' ? "Willkommen zurück!" : "Welcome back!",
      });
      router.push('/');
    } catch (error: any) {
      console.error(error);
      let errorMessage = language === 'de' ? 'Ein unerwarteter Fehler ist aufgetreten.' : 'An unexpected error occurred.';

      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = language === 'de' ? 'E-Mail oder Passwort ist falsch.' : 'Invalid email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = language === 'de' ? 'Zu viele Fehlversuche. Bitte versuche es später erneut.' : 'Too many attempts. Please try again later.';
      } else if (error.message && error.message.includes(language === 'de' ? "Zugriff verweigert" : "Access Denied")) {
        errorMessage = error.message;
      }

      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Login fehlgeschlagen' : 'Login failed',
        description: errorMessage,
      });
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

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#f0f4f8] dark:bg-[#050505] selection:bg-emerald-500/30 font-sans tracking-tight transition-colors duration-1000">
      {/* --- Chromatic Environmental Layers --- */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Saturated Mesh Gradients - High Energy */}
        <motion.div 
          animate={{ 
            scale: [1, 1.4, 1],
            x: [-100, 100, -100],
            y: [-50, 50, -50],
            rotate: [0, 45, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[100%] h-[100%] rounded-full bg-emerald-400/30 dark:bg-emerald-500/20 blur-[120px]" 
        />
        <motion.div 
          animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute top-[20%] right-[10%] w-[60%] h-[60%] rounded-full bg-purple-500/20 dark:bg-purple-600/15 blur-[100px]" 
        />

        {/* Dynamic Pattern Layer */}
        <div className="absolute inset-0 opacity-[0.2] dark:opacity-[0.1]" 
             style={{ backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        {/* Texture: Grain */}
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-110 contrast-125" />
      </div>

      <div className="relative z-[100] flex flex-col items-center justify-center min-h-screen px-4 pb-48 pt-4 md:px-6">
        {/* Brand Identity - Vibrant & Energetic */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 md:mb-12 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4 md:mb-6">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-[1.75rem] md:rounded-[2.25rem] bg-white/80 dark:bg-white/5 border border-white dark:border-white/10 backdrop-blur-3xl flex items-center justify-center shadow-[0_20px_40px_rgba(16,185,129,0.15)] dark:shadow-emerald-500/10">
              <MapPin className="w-6 h-6 md:w-8 md:h-8 text-emerald-500 fill-emerald-500/20" />
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-[-0.07em] flex items-center justify-center">
            aktiva<span className="text-emerald-500 ml-0.5 animate-pulse">.</span>
          </h1>
          <div className="h-0.5 w-12 bg-emerald-500/30 mx-auto mt-4 rounded-full" />
        </motion.div>

        {/* The Chromatic Glass Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 80 }}
          className="w-full max-w-[440px] bg-white/60 dark:bg-[#0a0a0b]/40 backdrop-blur-[60px] rounded-[3rem] md:rounded-[4rem] border border-white/80 dark:border-white/10 shadow-[0_60px_120px_-20px_rgba(0,0,0,0.12)] p-8 md:p-14 relative overflow-hidden group"
        >
          {/* Chromatic Accent Glows */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/[0.08] blur-[80px] group-hover:bg-emerald-500/[0.12] transition-colors duration-1000" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/[0.08] blur-[80px] group-hover:bg-blue-500/[0.12] transition-colors duration-1000" />
          
          <div className="relative z-10 w-full">
            <div className="mb-10 md:mb-14 text-center text-balance">
              <h2 className="text-3xl md:text-4xl font-[1000] text-slate-950 dark:text-white tracking-tighter mb-3">{language === 'de' ? 'Entdecke mehr' : 'Explore more'}</h2>
              <p className="text-slate-600 dark:text-emerald-400 font-extrabold uppercase tracking-[0.2em] text-[13px] md:text-[15px]">Connect. Explore. Live.</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[11px] font-[1000] text-slate-950 dark:text-emerald-400 uppercase tracking-[0.2em] px-1">{language === 'de' ? 'E-Mail Adresse' : 'Email Address'}</FormLabel>
                      <FormControl>
                        <div className="relative group/input">
                          <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600/60 group-focus-within/input:text-emerald-600 transition-colors" />
                          <Input 
                            placeholder={language === 'de' ? 'E-Mail-Adresse' : 'Email Address'} 
                            {...field} 
                            className="h-16 md:h-18 pl-14 rounded-2xl md:rounded-3xl bg-white dark:bg-white/[0.05] border-2 border-slate-100 dark:border-white/10 focus-visible:border-emerald-500 focus-visible:ring-0 font-black text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 transition-all text-base shadow-sm" 
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[11px] font-black text-rose-600 px-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[11px] font-[1000] text-slate-950 dark:text-emerald-400 uppercase tracking-[0.2em] px-1">{language === 'de' ? 'Passwort' : 'Password'}</FormLabel>
                      <FormControl>
                        <div className="relative group/input">
                          <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600/60 transition-colors" />
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            {...field} 
                            className="h-16 md:h-18 pl-14 pr-12 rounded-2xl md:rounded-3xl bg-white dark:bg-white/[0.05] border-2 border-slate-100 dark:border-white/10 focus-visible:border-emerald-500 focus-visible:ring-0 font-black text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 transition-all text-base shadow-sm" 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/20 hover:text-emerald-600 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end px-1">
                  <button 
                    type="button" 
                    onClick={() => setIsResetDialogOpen(true)}
                    className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-400 dark:hover:text-white transition-colors uppercase tracking-widest"
                  >
                    {language === 'de' ? 'Vergessen?' : 'Forgot?'}
                  </button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 md:h-16 text-sm font-black rounded-2xl md:rounded-3xl bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_20px_40px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] mt-4 md:mt-8 tracking-[0.1em]" 
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    language === 'de' ? "ANMELDEN" : "SIGN IN"
                  )}
                </Button>
              </form>
            </Form>

            <div className="relative my-8 md:my-12">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200/50 dark:border-white/5"></span>
              </div>
              <div className="relative flex justify-center text-[8px] uppercase tracking-[0.5em]">
                <span className="bg-white/10 dark:bg-[#0f0f11] px-6 text-emerald-600/50 dark:text-emerald-400/20 font-black">Social Connect</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:gap-6">
              <Button variant="outline" className="h-12 md:h-14 rounded-2xl bg-white/90 dark:bg-white/5 border-white dark:border-white/5 text-slate-900 dark:text-white font-black text-[9px] uppercase tracking-widest shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all">
                <Apple className="w-4 h-4 mr-2" />
                Apple
              </Button>
              <Button variant="outline" className="h-12 md:h-14 rounded-2xl bg-white/90 dark:bg-white/5 border-white dark:border-white/5 text-slate-900 dark:text-white font-black text-[9px] uppercase tracking-widest shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all">
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" opacity="0.8" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                </svg>
                Google
              </Button>
            </div>

            <div className="mt-8 md:mt-12 text-center">
              <button 
                onClick={() => router.push('/signup')}
                className="text-[10px] font-black text-slate-950 uppercase tracking-[0.3em] hover:text-emerald-600 transition-colors"
                type="button"
              >
                {language === 'de' ? 'Neu hier?' : 'New here?'} <span className="text-emerald-900 underline underline-offset-[12px] ml-2 font-black">{language === 'de' ? 'Registrieren' : 'Sign up'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Passwort vergessen Dialog */}
       <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-neutral-800">{language === 'de' ? 'Passwort vergessen?' : 'Forgot password?'}</DialogTitle>
            <DialogDescription className="font-semibold text-neutral-500 pt-2">
              {language === 'de' ? 'Kein Problem! Gib deine E-Mail-Adresse ein und wir senden dir einen Link.' : 'No problem! Enter your email and we will send you a link.'}
            </DialogDescription>
          </DialogHeader>
           <div className="py-6">
            <FormItem>
              <FormLabel className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">{language === 'de' ? 'Deine E-Mail' : 'Your Email'}</FormLabel>
              <div className="relative group mt-2">
               <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                <Input 
                    type="email" 
                    placeholder={language === 'de' ? "name@beispiel.de" : "name@example.com"} 
                    value={resetEmail} 
                    onChange={(e) => setResetEmail(e.target.value)} 
                    className="h-14 pl-12 rounded-2xl bg-neutral-50 border-none font-bold text-lg px-4 focus-visible:ring-[#4E89E3]/20"
                />
              </div>
            </FormItem>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <Button 
                 variant="ghost" 
                onClick={() => setIsResetDialogOpen(false)} 
                className="rounded-2xl h-14 font-bold text-neutral-400 hover:bg-neutral-50"
            >
                {language === 'de' ? 'Abbrechen' : 'Cancel'}
            </Button>
            <Button 
                 onClick={handlePasswordReset} 
                className="rounded-2xl h-14 font-black bg-[#4E89E3] hover:bg-[#3d7edb] text-white flex-1" 
                disabled={isResetting || !resetEmail}
            >
                {isResetting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : (language === 'de' ? "Link anfordern" : "Request Link")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- System Navigation Transition (The Fade) --- */}
      <div className="fixed bottom-0 left-0 right-0 w-full h-40 bg-gradient-to-t from-[#FAF7FF] via-[#FAF7FF]/80 to-transparent z-10 pointer-events-none" />
    </main>
  );
}

'use client';

import { useState } from 'react';
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
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/hooks/use-language';
import { signIn, signOut, sendPasswordReset, signInWithGoogle, signInWithApple } from '@/lib/firebase/auth';
import { sendEmailVerification } from 'firebase/auth';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const language = useLanguage();
  const { toast } = useToast();

  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
      } else if (error.message === 'auth/user-not-found') {
        errorMessage = language === 'de' ? 'Benutzername oder E-Mail wurde nicht gefunden.' : 'Username or email not found.';
      }

      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Login fehlgeschlagen' : 'Login failed',
        description: errorMessage,
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
    try {
      await signInWithGoogle();
      toast({
        title: language === 'de' ? 'Login erfolgreich' : 'Login successful',
        description: language === 'de' ? "Willkommen zurück!" : "Welcome back!",
      });
      router.push('/');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Login fehlgeschlagen' : 'Login failed',
        description: language === 'de' ? 'Google-Login konnte nicht abgeschlossen werden.' : 'Google login could not be completed.',
      });
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
      toast({
        title: language === 'de' ? 'Login erfolgreich' : 'Login successful',
        description: language === 'de' ? "Willkommen zurück!" : "Welcome back!",
      });
      router.push('/');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Login fehlgeschlagen' : 'Login failed',
        description: language === 'de' ? 'Apple-Login konnte nicht abgeschlossen werden.' : 'Apple login could not be completed.',
      });
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
              <MapPin className="w-10 h-10 text-[#10b981]" />
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">aktiva<span className="text-[#10b981]">.</span></h1>
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
                      <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#10b981] transition-colors z-10" />
                      <Input 
                        placeholder="Email / Username" 

                        {...field} 
                        className="h-16 pl-16 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-emerald-500/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm tracking-wider shadow-none" 
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
                    <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</FormLabel>
                    <button 
                      type="button" 
                      onClick={() => setIsResetDialogOpen(true)}
                      className="text-[10px] font-black text-[#10b981] hover:opacity-80 transition-opacity uppercase tracking-widest"
                    >
                      Forgot?
                    </button>
                  </div>
                  <FormControl>
                    <div className="relative group">
                      <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#10b981] transition-colors z-10" />
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        {...field} 
                        className="h-16 pl-16 pr-14 rounded-full border-none bg-zinc-100/80 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-emerald-500/20 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all text-sm shadow-none" 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#10b981] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold text-rose-500 px-1" />
                </FormItem>
              )}
            />

            <div className="pt-4">
              <Button 
                type="submit" 
                className="w-full h-14 text-base font-black rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition-all active:scale-[0.98] uppercase tracking-widest !shadow-none !border-none" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  "Sign in"
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Separator */}
        <div className="w-full flex items-center gap-4 my-10 px-4">
          <div className="flex-1 h-[1px] bg-slate-100 dark:bg-neutral-900" />
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Or</span>
          <div className="flex-1 h-[1px] bg-slate-100 dark:bg-neutral-900" />
        </div>

        {/* Socials */}
        <div className="w-full grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            onClick={handleAppleSignIn}
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
              onClick={() => router.push('/signup')}
              className="text-[#10b981] ml-2 hover:underline underline-offset-4 font-black"
            >
              {language === 'de' ? 'Registrieren' : 'Sign up'}
            </button>
          </p>
        </div>

      </div>

      {/* Dialog for Reset */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase">Password Recovery</DialogTitle>
            <DialogDescription className="font-bold text-slate-500 pt-2">
               Enter your email and we will send you a recovery link.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <FormItem className="space-y-1">
              <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Your Email</FormLabel>
              <div className="relative group mt-2">
                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[#10b981]" />
                <Input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={resetEmail} 
                  onChange={(e) => setResetEmail(e.target.value)} 
                  className="h-14 pl-14 rounded-full bg-slate-100 dark:bg-neutral-900 border-none font-bold text-sm px-4 focus-visible:ring-emerald-500/20"
                />
              </div>
            </FormItem>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="ghost" 
              onClick={() => setIsResetDialogOpen(false)} 
              className="rounded-xl h-14 font-black text-slate-400 hover:bg-slate-50 uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePasswordReset} 
              className="rounded-full h-14 font-black bg-emerald-500 hover:opacity-90 text-white flex-1 uppercase tracking-widest" 
              disabled={isResetting || !resetEmail}
            >
              {isResetting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Request Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </main>
  );
}

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp, signOut } from '@/lib/firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  name: z.string().min(4, { message: 'Der Name muss mindestens 4 Zeichen lang sein.' }).max(64),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein.",
  path: ["confirmPassword"],
});

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [isRegistered, setIsRegistered] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: '', color: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const evaluatePassword = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++; 
    if (/[A-Z]/.test(pass)) score++; 
    if (/[a-z]/.test(pass)) score++; 
    if (/[0-9]/.test(pass)) score++; 
    if (/[^A-Za-z0-9]/.test(pass)) score++; 

    let text = '';
    let color = '';

    switch (score) {
      case 0:
      case 1: text = 'Sehr Schwach'; color = 'bg-red-600'; break;
      case 2: text = 'Schwach'; color = 'bg-red-500'; break;
      case 3: text = 'Mittel'; color = 'bg-amber-500'; break;
      case 4: text = 'Gut'; color = 'bg-blue-500'; break;
      case 5: text = 'Stark'; color = 'bg-green-500'; break;
    }
    setPasswordStrength({ score, text, color });
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = form.watch('password');
  const confirmPasswordValue = form.watch('confirmPassword');
  const nameValue = form.watch('name') || '';
  const emailValue = form.watch('email') || '';

  const forbiddenWords = ['sex', 'porn', 'fuck', 'bitch', 'schlampe', 'fotze', 'hurensohn', 'wichser', 'nazi', 'hitler', 'admin', 'support']; 
  const hasProfanity = forbiddenWords.some(word => nameValue.toLowerCase().includes(word));

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError('');
    
    if (passwordStrength.score < 5) {
        setSubmitError('Dein Passwort muss alle Sicherheitsanforderungen erfüllen.');
        return;
    }

    if (hasProfanity) {
        setSubmitError('Bitte wähle einen anderen Namen.');
        return;
    }

    try {
      await signUp(values.name, values.email, values.password);
      await signOut();
      setIsRegistered(true);
      
      toast({
        title: 'Account erstellt!',
        description: "Bitte bestätige deine Email-Adresse.",
      });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        setSubmitError('Diese E-Mail-Adresse ist bereits registriert.');
      } else {
        setSubmitError('Fehler bei der Registrierung: ' + (error.message || 'Ein unerwarteter Fehler ist aufgetreten.'));
      }
    }
  }

  if (isRegistered) {
    return (
      <div className="flex min-h-full items-center justify-center p-4 bg-secondary/30">
        <Card className="w-full max-w-md border-none shadow-xl rounded-3xl overflow-hidden text-center">
          <CardHeader className="bg-primary/5 pb-8">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Mail className="h-12 w-12 text-primary animate-pulse" />
              </div>
            </div>
            <CardTitle className="text-3xl font-black tracking-tight">Verifizierung erforderlich</CardTitle>
            <CardDescription className="font-medium text-base">Fast geschafft!</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="space-y-2">
              <p className="text-neutral-600 dark:text-neutral-400 font-medium">
                Wir haben einen Bestätigungslink an <br />
                <strong className="text-foreground">{emailValue}</strong> <br />
                gesendet.
              </p>
              <p className="text-sm text-neutral-500">
                Bitte überprüfe deinen Posteingang und klicke auf den Link, um dein Konto zu aktivieren.
              </p>
            </div>
            
            <div className="pt-4">
              <Button asChild className="w-full h-14 text-base font-black rounded-2xl">
                <Link href="/login">
                  Zum Login
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4 bg-secondary/30">
      <Card className="w-full max-w-md border-none shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary/5 pb-8">
          <CardTitle className="text-3xl font-black tracking-tight text-center">Registrieren</CardTitle>
          <CardDescription className="text-center font-medium">Erstelle dein Konto für Aktvia.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-neutral-700 dark:text-neutral-300">Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Dein Name" 
                        {...field} 
                        minLength={4}
                        maxLength={64}
                        className={cn(
                          "h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold",
                          hasProfanity && "ring-2 ring-red-500"
                        )} 
                      />
                    </FormControl>
                    {nameValue.length > 0 && nameValue.length < 4 && (
                      <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-tight">Der Name muss mindestens 4 Zeichen lang sein.</p>
                    )}
                    {hasProfanity && (
                      <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-tight">Dieser Name enthält unzulässige Begriffe.</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-neutral-700 dark:text-neutral-300">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@beispiel.de" {...field} autoComplete="email" className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-neutral-700 dark:text-neutral-300">Passwort</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••" 
                          {...field} 
                          autoComplete="new-password"
                          className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold pr-10"
                          onChange={(e) => {
                              field.onChange(e);
                              evaluatePassword(e.target.value);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 focus:outline-none"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    
                    {passwordValue && passwordValue.length > 0 && (
                        <div className="mt-3 px-1">
                            <div className="flex justify-between text-[10px] uppercase tracking-widest font-black mb-1.5">
                                <span className="text-neutral-400">Sicherheit</span>
                                <span className={passwordStrength.color.replace('bg-', 'text-')}>{passwordStrength.text}</span>
                            </div>
                            <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ease-out ${passwordStrength.color}`}
                                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                                ></div>
                            </div>
                            {passwordStrength.score < 5 && (
                                <p className="text-[10px] text-neutral-500 mt-2 font-bold leading-relaxed">
                                    Muss enthalten: Min. 8 Zeichen, Groß- & Kleinbuchstaben, Zahl und Sonderzeichen.
                                </p>
                            )}
                        </div>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-neutral-700 dark:text-neutral-300">Passwort bestätigen</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showConfirmPassword ? "text" : "password"} 
                          placeholder="••••••••" 
                          {...field} 
                          autoComplete="new-password"
                          className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold pr-10" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 focus:outline-none"
                        >
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    {confirmPasswordValue && passwordValue !== confirmPasswordValue && (
                        <p className="text-[10px] text-red-500 mt-1 font-black uppercase tracking-tight">Passwörter stimmen nicht überein.</p>
                    )}
                  </FormItem>
                )}
              />

              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold text-center">
                  {submitError}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-14 text-base font-black rounded-2xl shadow-lg shadow-primary/20 transition-transform active:scale-95 mt-4" 
                disabled={form.formState.isSubmitting || passwordStrength.score < 5 || passwordValue !== confirmPasswordValue || nameValue.length < 4 || hasProfanity}
              >
                {form.formState.isSubmitting ? 'Wird erstellt...' : 'Konto erstellen'}
              </Button>
            </form>
          </Form>
          <div className="mt-8 text-center text-sm font-bold text-neutral-500">
            Du hast bereits ein Konto?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Anmelden
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

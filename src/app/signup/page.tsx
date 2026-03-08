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
import { signUp } from '@/lib/firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

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
  
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: '', color: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const evaluatePassword = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++; // Längen-Validierung
    if (/[A-Z]/.test(pass)) score++; // Großbuchstabe
    if (/[a-z]/.test(pass)) score++; // Kleinbuchstabe
    if (/[0-9]/.test(pass)) score++; // Zahl
    if (/[^A-Za-z0-9]/.test(pass)) score++; // Sonderzeichen

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
  const nameValue = form.watch('name');

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (passwordStrength.score < 5) {
        toast({
            variant: 'destructive',
            title: 'Sicherheit',
            description: 'Dein Passwort muss alle Sicherheitsanforderungen erfüllen.',
        });
        return;
    }

    try {
      await signUp(values.name, values.email, values.password);
      toast({
        title: 'Account erstellt!',
        description: "Registrierung erfolgreich. Bitte bestätige deine Email-Adresse über den zugesandten Link.",
      });
      router.push('/profile');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    }
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
                        className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold" 
                      />
                    </FormControl>
                    {nameValue.length > 0 && nameValue.length < 4 && (
                      <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-tight">Der Name muss mindestens 4 Zeichen lang sein.</p>
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
                      <Input placeholder="name@beispiel.de" {...field} className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold" />
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
                    
                    {/* Stärke-Indikator */}
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

              <Button 
                type="submit" 
                className="w-full h-14 text-base font-black rounded-2xl shadow-lg shadow-primary/20 transition-transform active:scale-95 mt-4" 
                disabled={form.formState.isSubmitting || passwordStrength.score < 5 || passwordValue !== confirmPasswordValue || nameValue.length < 4}
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

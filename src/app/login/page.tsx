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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, signOut, sendPasswordReset } from '@/lib/firebase/auth';
import { sendEmailVerification } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email({ message: 'Ungültige E-Mail-Adresse.' }),
  password: z.string().min(6, { message: 'Das Passwort muss mindestens 6 Zeichen lang sein.' }),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

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

      // STRIKTE VERIFIKATIONS-SCHRANKE mit automatischem Neuversand:
      // Wir prüfen den Status unmittelbar nach dem Login.
      if (!user.emailVerified) {
        // 1. Verifizierungs-E-Mail explizit anfordern
        await sendEmailVerification(user);
        
        // 2. Session sofort atomar terminieren
        await signOut(); 
        
        // 3. Fehler werfen für Catch-Block Integration
        throw new Error("Zugriff verweigert: Ein neuer Bestätigungs-Link wurde an deine E-Mail-Adresse gesendet. Bitte prüfe deinen Posteingang und Spam-Ordner.");
      }

      toast({
        title: 'Login erfolgreich',
        description: "Willkommen zurück!",
      });
      router.push('/');
    } catch (error: any) {
      console.error(error);
      let errorMessage = 'Ein unerwarteter Fehler ist aufgetreten.';
      
      // Nutzerspezifische Fehlermeldungen für bessere UX
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'E-Mail oder Passwort ist falsch.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Zu viele Fehlversuche. Bitte versuche es später erneut.';
      } else if (error.message && error.message.includes("Zugriff verweigert")) {
        // Nutze die Nachricht aus dem manuell geworfenen Error
        errorMessage = error.message;
      }

      toast({
        variant: 'destructive',
        title: 'Login fehlgeschlagen',
        description: errorMessage,
      });
    }
  }

  const handlePasswordReset = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
      return;
    }
    
    setIsResetting(true);
    try {
      await sendPasswordReset(resetEmail);
      toast({ title: 'E-Mail gesendet', description: 'Wenn diese E-Mail registriert ist, erhältst du in Kürze einen Link zum Zurücksetzen deines Passworts.' });
      setIsResetDialogOpen(false);
      setResetEmail('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Es gab ein Problem. Bitte versuche es später erneut.' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4 bg-secondary/30">
      <Card className="w-full max-w-md border-none shadow-xl rounded-3xl overflow-hidden mt-8">
        <CardHeader className="bg-primary/5 pb-8">
          <CardTitle className="text-3xl font-black tracking-tight text-center">Anmelden</CardTitle>
          <CardDescription className="text-center font-medium">Schön, dass du wieder da bist!</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-neutral-700 dark:text-neutral-300">Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="name@beispiel.de" 
                        {...field} 
                        autoComplete="email"
                        className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold" 
                      />
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
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                        autoComplete="current-password"
                        className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-14 text-base font-black rounded-2xl shadow-lg shadow-primary/20 transition-transform active:scale-95 mt-4" 
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {form.formState.isSubmitting ? 'Wird angemeldet...' : 'Anmelden'}
              </Button>
            </form>
          </Form>
          <div className="mt-8 flex flex-col space-y-4 text-center text-sm font-bold text-neutral-500">
            <button 
                type="button" 
                onClick={() => {
                    setResetEmail(form.getValues('email') || '');
                    setIsResetDialogOpen(true);
                }}
                className="text-neutral-500 hover:text-primary transition-colors"
            >
                Passwort vergessen?
            </button>
            <div>
              Du hast noch kein Konto?{' '}
              <Link href="/signup" className="text-primary hover:underline">
                Registrieren
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passwort vergessen Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Passwort zurücksetzen</DialogTitle>
            <DialogDescription className="font-medium text-neutral-500">
              Gib deine E-Mail-Adresse ein und wir senden dir einen Link, um ein neues Passwort zu vergeben.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
                type="email" 
                placeholder="name@beispiel.de" 
                value={resetEmail} 
                onChange={(e) => setResetEmail(e.target.value)} 
                className="h-14 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold text-lg px-4"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
                variant="ghost" 
                onClick={() => setIsResetDialogOpen(false)} 
                className="rounded-2xl h-12 font-bold w-full sm:w-auto"
            >
                Abbrechen
            </Button>
            <Button 
                onClick={handlePasswordReset} 
                className="rounded-2xl h-12 font-black w-full" 
                disabled={isResetting || !resetEmail}
            >
                {isResetting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Link anfordern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

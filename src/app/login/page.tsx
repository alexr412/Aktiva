'use client';

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
import { signIn, signOut } from '@/lib/firebase/auth';
import { sendEmailVerification } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  email: z.string().email({ message: 'Ungültige E-Mail-Adresse.' }),
  password: z.string().min(6, { message: 'Das Passwort muss mindestens 6 Zeichen lang sein.' }),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

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

  return (
    <div className="flex min-h-full items-center justify-center p-4 bg-secondary/30">
      <Card className="w-full max-w-md border-none shadow-xl rounded-3xl overflow-hidden">
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
                {form.formState.isSubmitting ? 'Wird angemeldet...' : 'Anmelden'}
              </Button>
            </form>
          </Form>
          <div className="mt-8 text-center text-sm font-bold text-neutral-500">
            Du hast noch kein Konto?{' '}
            <Link href="/signup" className="text-primary hover:underline">
              Registrieren
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

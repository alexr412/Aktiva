'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Activity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { CreditCard, ArrowLeft, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CheckoutPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();
    const activityId = params.activityId as string;

    const [activity, setActivity] = useState<Activity | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        if (!activityId || !db) return;

        const unsubscribe = onSnapshot(doc(db, 'activities', activityId), (docSnap) => {
            if (docSnap.exists()) {
                setActivity({ id: docSnap.id, ...docSnap.data() } as Activity);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [activityId]);

    const handlePayment = async () => {
        setIsProcessing(true);
        
        // Simulation eines Stripe-Checkouts / Zahlungs-Vorgangs
        setTimeout(() => {
            setIsProcessing(false);
            setIsSuccess(true);
            toast({
                title: "Zahlung erfolgreich!",
                description: "Du wirst in Kürze zum Chat weitergeleitet.",
            });

            // Hinweis: In einer echten App würde hier ein Cloud Function Webhook 
            // den Nutzer sicher zur participantIds Liste hinzufügen.
            // Für diesen Prototyp simulieren wir den Erfolg und leiten um.
            setTimeout(() => {
                router.push(`/chat/${activityId}`);
            }, 2000);
        }, 2000);
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!activity) {
        return (
            <div className="p-10 text-center">
                <h1 className="text-xl font-bold">Aktivität nicht gefunden.</h1>
                <Button onClick={() => router.back()} className="mt-4">Zurück</Button>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="flex h-screen w-full items-center justify-center p-4 bg-emerald-50">
                <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] text-center p-8">
                    <div className="mx-auto bg-emerald-100 p-4 rounded-full w-fit mb-6">
                        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                    </div>
                    <CardTitle className="text-2xl font-black mb-2">Zahlung bestätigt!</CardTitle>
                    <CardDescription className="text-base font-medium">
                        Vielen Dank für deine Buchung für <strong>{activity.placeName}</strong>. 
                        Du wirst jetzt zum Gruppenchat hinzugefügt.
                    </CardDescription>
                    <div className="mt-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600" />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full flex-col bg-slate-50 overflow-y-auto">
            <header className="flex h-16 shrink-0 items-center px-4 bg-white border-b border-slate-100">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="font-black text-lg">Checkout</h1>
            </header>

            <main className="flex-1 p-4 sm:p-8 flex flex-col items-center">
                <div className="w-full max-w-md space-y-6">
                    <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-900 text-white p-6">
                            <CardTitle className="text-xl font-black">Zusammenfassung</CardTitle>
                            <CardDescription className="text-slate-400 font-medium">Aktivität bei {activity.placeName}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Teilnahmebeitrag</span>
                                <span className="text-lg font-black">€{activity.price!.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-slate-900 font-black">Gesamtbetrag</span>
                                <span className="text-2xl font-black text-primary">€{activity.price!.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm rounded-3xl p-6 space-y-6 bg-white">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-900">
                                <CreditCard className="h-5 w-5 text-primary" />
                                <span className="font-black">Zahlungsmethode</span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3">
                                <button className="flex items-center justify-between p-4 rounded-2xl border-2 border-primary bg-primary/5 text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-12 bg-slate-200 rounded flex items-center justify-center font-bold text-[10px]">VISA</div>
                                        <span className="font-bold">•••• 4242</span>
                                    </div>
                                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                        <div className="h-2 w-2 rounded-full bg-white" />
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl flex items-start gap-3">
                            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                Deine Zahlung wird sicher verarbeitet. Der Betrag wird dem Host nach erfolgreichem Abschluss der Aktivität gutgeschrieben.
                            </p>
                        </div>

                        <Button 
                            onClick={handlePayment} 
                            disabled={isProcessing}
                            className="w-full h-16 rounded-2xl text-lg font-black bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-200 transition-transform active:scale-95"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Wird verarbeitet...
                                </>
                            ) : (
                                `Jetzt bezahlen (€${activity.price!.toFixed(2)})`
                            )}
                        </Button>
                    </Card>
                </div>
            </main>
        </div>
    );
}

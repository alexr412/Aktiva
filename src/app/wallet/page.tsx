'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

import { requestPayout } from '@/lib/firebase/firestore';
import { submitKYCDocument } from '@/lib/firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Wallet, ArrowUpCircle, Info, Loader2, CheckCircle2, History, Banknote, ShieldAlert, Upload, ShieldCheck, Lock, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { format } from 'date-fns';


const MIN_PAYOUT = 50;

export default function WalletPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const language = useLanguage();
    const router = useRouter();
    const { toast } = useToast();

    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [activeTab, setActiveTab] = useState<'fiat' | 'points'>('fiat');
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [loadingLedger, setLoadingLedger] = useState(true);
    const [fiatTransactions, setFiatTransactions] = useState<any[]>([]);
    const [loadingFiat, setLoadingFiat] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login?redirect=/wallet');
            return;
        }
        if (userProfile && userProfile.onboardingCompleted === false) {
            router.replace('/onboarding');
            return;
        }
    }, [user, userProfile, authLoading, router]);

    useEffect(() => {
        if (!user || !db) return;

        // Points Ledger
        const ledgerRef = collection(db, 'users', user.uid, 'pointsLedger');
        const pointsQ = query(ledgerRef, orderBy('createdAt', 'desc'));
        const unsubPoints = onSnapshot(pointsQ, (snapshot) => {
            const entries = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));
            setLedgerEntries(entries);
            setLoadingLedger(false);
        }, (error) => {
            console.error('Error fetching points ledger:', error);
            setLoadingLedger(false);
        });

        // Fiat Transactions (Payout Requests & Refunds)
        const payoutQ = query(
            collection(db, 'payoutRequests'),
            where('userId', '==', user.uid)
        );
        const refundQ = query(
            collection(db, 'refunds'),
            where('userId', '==', user.uid)
        );

        let payouts: any[] = [];
        let refunds: any[] = [];

        const updateUnifiedTransactions = () => {
            const unified = [...payouts, ...refunds].sort((a, b) => {
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
            setFiatTransactions(unified);
            setLoadingFiat(false);
        };

        const unsubPayout = onSnapshot(payoutQ, (snap) => {
            payouts = snap.docs.map(docSnap => ({
                id: docSnap.id,
                transactionType: 'payout',
                ...docSnap.data()
            }));
            updateUnifiedTransactions();
        }, (err) => {
            console.error("Error loading payouts:", err);
            setLoadingFiat(false);
        });

        const unsubRefund = onSnapshot(refundQ, (snap) => {
            refunds = snap.docs.map(docSnap => ({
                id: docSnap.id,
                transactionType: 'refund',
                ...docSnap.data()
            }));
            updateUnifiedTransactions();
        }, (err) => {
            console.error("Error loading refunds:", err);
            setLoadingFiat(false);
        });

        return () => {
            unsubPoints();
            unsubPayout();
            unsubRefund();
        };
    }, [user]);

    const getLedgerTypeDetails = (type: string, metadata?: any) => {
        switch (type) {
            case 'friend_invite_completed':
            case 'referral_activation_bonus':
                return {
                    label: language === 'de' ? 'Freund geworben' : 'Referred Friend',
                    desc: metadata?.message || (language === 'de' ? 'Einladung abgeschlossen' : 'Referral completed'),
                    icon: '🎁'
                };
            case 'referral_milestone_bonus':
                return {
                    label: language === 'de' ? 'Referral Meilenstein' : 'Referral Milestone',
                    desc: metadata?.message || (language === 'de' ? 'Belohnung für Meilenstein erhalten' : 'Milestone reward unlocked'),
                    icon: '👑'
                };
            case 'invite_signup_bonus':
                return {
                    label: language === 'de' ? 'Willkommensbonus' : 'Welcome Bonus',
                    desc: metadata?.message || (language === 'de' ? 'Registrierung über Referral-Code' : 'Signed up with referral code'),
                    icon: '🔑'
                };
            case 'event_created':
                return {
                    label: language === 'de' ? 'Event erstellt' : 'Event Created',
                    desc: metadata?.message || (language === 'de' ? 'Neue Aktivität erstellt' : 'Created new activity'),
                    icon: '📍'
                };
            case 'event_joined_first':
                return {
                    label: language === 'de' ? 'Erster Teilnehmer' : 'First Participant',
                    desc: metadata?.message || (language === 'de' ? 'Erster Teilnehmer beigetreten' : 'First participant joined'),
                    icon: '⭐'
                };
            case 'first_activity_bonus':
                return {
                    label: language === 'de' ? 'Erste Aktivität' : 'First Activity Bonus',
                    desc: metadata?.message || (language === 'de' ? 'Erfolgreiche erste Aktivität' : 'Successful first activity'),
                    icon: '🔥'
                };
            default:
                return {
                    label: language === 'de' ? 'Bonus' : 'Bonus',
                    desc: metadata?.message || '',
                    icon: '🏆'
                };
        }
    };

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return format(date, 'dd.MM.yyyy, HH:mm');
        } catch (e) {
            return '';
        }
    };

    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploadingKYC, setIsUploadingKYC] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const currentBalance = userProfile?.balancesInCents
        ? (userProfile.fiatBalance || 0) / 100
        : (userProfile?.fiatBalance || 0);
    const escrowBalance = userProfile?.balancesInCents
        ? (userProfile.escrowBalance || 0) / 100
        : (userProfile?.escrowBalance || 0);
    const kycStatus = userProfile?.kycStatus || 'unverified';
    const canWithdraw = currentBalance >= MIN_PAYOUT && kycStatus === 'verified';

    const handlePayoutRequest = async () => {
        if (!user || !canWithdraw) return;
        
        setIsProcessing(true);
        try {
            await requestPayout(user.uid, currentBalance);
            setShowSuccess(true);
            toast({
                title: language === 'de' ? "Auszahlung angefordert!" : "Payout requested!",
                description: language === 'de' ? "Deine Anfrage wird innerhalb von 3 Werktagen geprüft." : "Your request will be reviewed within 3 business days.",
            });

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Fehler' : 'Error',
                description: error.message || (language === 'de' ? 'Die Auszahlung konnte nicht angefordert werden.' : 'The payout could not be requested.'),
            });

        } finally {
            setIsProcessing(false);
        }
    };

    const handleKYCUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (file.size > 5 * 1024 * 1024) {
            toast({ 
                variant: 'destructive', 
                title: language === 'de' ? "Datei zu groß" : "File too large", 
                description: language === 'de' ? "Das Dokument darf maximal 5MB groß sein." : "The document must be 5MB maximum." 
            });
            return;
        }


        setIsUploadingKYC(true);
        try {
            await submitKYCDocument(user.uid, file);
            toast({ 
                title: language === 'de' ? "Dokument hochgeladen" : "Document uploaded", 
                description: language === 'de' ? "Wir prüfen deine Identität nun." : "We are now verifying your identity." 
            });

        } catch (err: any) {
            toast({ 
                variant: 'destructive', 
                title: language === 'de' ? "Upload fehlgeschlagen" : "Upload failed", 
                description: err.message 
            });

        } finally {
            setIsUploadingKYC(false);
        }
    };

    if (showSuccess) {
        return (
            <div className="flex h-full w-full items-center justify-center p-4 bg-emerald-50">
                <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] text-center p-8">
                    <div className="mx-auto bg-emerald-100 p-4 rounded-full w-fit mb-6">
                        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                    </div>
                    <CardTitle className="text-2xl font-black mb-2 text-slate-900">{language === 'de' ? 'Anfrage erhalten!' : 'Request received!'}</CardTitle>
                    <CardDescription className="text-base font-medium text-emerald-800">
                        {language === 'de' ? 'Wir überweisen' : 'We will transfer'} <strong>€{currentBalance.toFixed(2)}</strong> {language === 'de' ? 'auf dein hinterlegtes Konto.' : 'to your account.'}
                    </CardDescription>
                    <Button onClick={() => router.replace('/profile')} className="mt-8 w-full h-14 rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100">
                        {language === 'de' ? 'Zum Profil' : 'Back to Profile'}
                    </Button>

                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col bg-slate-50 overflow-y-auto">
            <header className="flex h-16 shrink-0 items-center px-4 bg-white border-b border-slate-100 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2 rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="font-black text-lg">{language === 'de' ? 'Mein Wallet' : 'My Wallet'}</h1>

            </header>

            <main className="flex-1 p-4 sm:p-8 flex flex-col items-center">
                <div className="w-full max-w-md space-y-6">
                    {/* Tab Selection */}
                    <div className="flex bg-slate-100 dark:bg-neutral-900 p-1.5 rounded-2xl w-full">
                        <button
                            onClick={() => setActiveTab('fiat')}
                            className={cn(
                                "flex-1 py-3 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all border-none outline-none",
                                activeTab === 'fiat'
                                    ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm"
                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                        >
                            {language === 'de' ? 'Guthaben (€)' : 'Balance (€)'}
                        </button>
                        <button
                            onClick={() => setActiveTab('points')}
                            className={cn(
                                "flex-1 py-3 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all border-none outline-none",
                                activeTab === 'points'
                                    ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm"
                                    : "text-slate-405 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                        >
                            {language === 'de' ? 'Aktiva Points' : 'Aktiva Points'}
                        </button>
                    </div>

                    {activeTab === 'fiat' ? (
                        <>
                            {/* KYC Indicator Section */}
                            <div className={cn(
                                "p-4 rounded-2xl border flex items-center gap-4",
                                kycStatus === 'verified' ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                kycStatus === 'pending' ? "bg-blue-50 border-blue-100 text-blue-700" :
                                "bg-amber-50 border-amber-100 text-amber-700"
                            )}>
                                <div className={cn(
                                    "p-2 rounded-xl bg-white shadow-sm",
                                    kycStatus === 'verified' ? "text-emerald-600" :
                                    kycStatus === 'pending' ? "text-blue-600" :
                                    "text-amber-600"
                                )}>
                                    {kycStatus === 'verified' ? <ShieldCheck className="h-5 w-5" /> : 
                                     kycStatus === 'pending' ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                                     <ShieldAlert className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{language === 'de' ? 'Identitätsstatus' : 'Identity Status'}</p>
                                    <p className="text-sm font-black uppercase">{kycStatus}</p>
                                </div>

                                {kycStatus === 'unverified' && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploadingKYC}
                                        className="rounded-xl font-black text-[10px] uppercase bg-white/50"
                                    >
                                        {isUploadingKYC ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                                        {language === 'de' ? 'Verifizieren' : 'Verify'}
                                    </Button>
                                )}
                                <input type="file" ref={fileInputRef} onChange={handleKYCUpload} className="hidden" accept="image/*,.pdf" />
                            </div>

                            {/* Balance Card */}
                            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden text-left w-full">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2 opacity-60">
                                        <Wallet className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{language === 'de' ? 'Verfügbares Guthaben' : 'Available Balance'}</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black">€{currentBalance.toFixed(2)}</span>
                                    </div>

                                    {/* Modul 16: Escrow Display */}
                                    <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center backdrop-blur-sm">
                                        <div className="flex items-center gap-2">
                                            <Lock className="h-3.5 w-3.5 text-blue-400" />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{language === 'de' ? 'Ausstehend (Escrow)' : 'Pending (Escrow)'}</span>
                                        </div>
                                        <span className="text-sm font-black text-blue-400">€{escrowBalance.toFixed(2)}</span>
                                    </div>
                                    
                                    <div className="mt-8 flex gap-2">
                                        <Button 
                                            onClick={handlePayoutRequest} 
                                            disabled={!canWithdraw || isProcessing}
                                            className={cn(
                                                "flex-1 h-14 rounded-2xl font-black transition-all shadow-xl",
                                                canWithdraw 
                                                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-900/20" 
                                                    : "bg-white/10 text-white/40 cursor-not-allowed border-none"
                                            )}
                                        >
                                            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUpCircle className="h-5 w-5 mr-2" />}
                                            {canWithdraw ? (language === 'de' ? 'Auszahlen' : 'Withdraw') : kycStatus !== 'verified' ? (language === 'de' ? 'KYC erforderlich' : 'KYC Required') : `Minimum: €${MIN_PAYOUT}`}
                                        </Button>
                                    </div>
                                </div>
                                <Banknote className="absolute -bottom-6 -right-6 h-40 w-40 text-white/5 rotate-12" />
                            </div>

                            {/* KYC Warning Box */}
                            {kycStatus !== 'verified' && (
                                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-start gap-3 text-left">
                                    <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black text-destructive uppercase tracking-tight">{language === 'de' ? 'Aktion erforderlich' : 'Action Required'}</p>
                                        <p className="text-[11px] text-destructive/80 font-medium leading-relaxed mt-1">
                                            {language === 'de' ? 'Aus regulatorischen Gründen ist für die Auszahlung von Fiat-Guthaben eine einmalige Identitätsprüfung (KYC) erforderlich. Bitte lade ein Foto deines Personalausweises hoch.' : 'For regulatory reasons, a one-time identity verification (KYC) is required to withdraw fiat balances. Please upload a photo of your ID.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Modul 16: Escrow Info */}
                            <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-start gap-4 text-left">
                                <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
                                    <Lock className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="font-black text-blue-900 text-sm mb-1">{language === 'de' ? 'Über ausstehende Zahlungen' : 'About pending payments'}</h4>
                                    <p className="text-xs text-blue-800/70 font-medium leading-relaxed">
                                        {language === 'de' ? 'Einnahmen aus Ticketverkäufen werden in Treuhand (Escrow) gehalten, bis du die Aktivität erfolgreich abgeschlossen hast. Dies schützt Teilnehmer und sichert faire Rückerstattungen bei Absagen.' : 'Earnings from ticket sales are held in escrow until you have successfully completed the activity. This protects participants and ensures fair refunds in case of cancellations.'}
                                    </p>
                                </div>
                            </div>

                            {/* Progress to Payout */}
                            {kycStatus === 'verified' && !canWithdraw && currentBalance > 0 && (
                                <Card className="border-none shadow-sm rounded-3xl p-6 bg-white text-left">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                                            <span>{language === 'de' ? 'Auszahlungsziel' : 'Payout Goal'}</span>
                                            <span>{((currentBalance / MIN_PAYOUT) * 100).toFixed(0)}%</span>
                                        </div>

                                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                                                style={{ width: `${(currentBalance / MIN_PAYOUT) * 100}%` }}
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                            {language === 'de' ? `Du kannst dein Guthaben ab einem Betrag von <strong>€${MIN_PAYOUT}.00</strong> anfordern. Sammle weitere Teilnahmen bei deinen Events, um das Ziel zu erreichen.` : `You can request your balance starting from <strong>€${MIN_PAYOUT}.00</strong>. Collect more participations in your events to reach the goal.`}
                                        </p>
                                    </div>
                                </Card>
                            )}

                            {/* Transaction History List */}
                            <div className="space-y-4 pt-4 w-full text-left">
                                <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <History className="h-3 w-3" /> {language === 'de' ? 'Zahlungs-Verlauf' : 'Payment History'}
                                </h3>
                                {loadingFiat ? (
                                    <div className="flex items-center justify-center py-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : fiatTransactions.length === 0 ? (
                                    <div className="text-center p-10 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                        <p className="text-slate-400 text-sm font-medium">{language === 'de' ? 'Noch keine Transaktionen vorhanden.' : 'No transactions yet.'}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {fiatTransactions.map((tx) => {
                                            const isPayout = tx.transactionType === 'payout';
                                            const statusLabel = 
                                                tx.status === 'completed' ? (language === 'de' ? 'Erfolgreich' : 'Completed') :
                                                tx.status === 'failed' ? (language === 'de' ? 'Fehlgeschlagen' : 'Failed') :
                                                (language === 'de' ? 'Ausstehend' : 'Pending');
                                                
                                            return (
                                                <div 
                                                    key={tx.id} 
                                                    className="p-4 rounded-2xl bg-white border border-slate-100 flex items-center justify-between shadow-sm hover:scale-[1.01] transition-all"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center text-lg",
                                                            isPayout ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
                                                        )}>
                                                            {isPayout ? '📤' : '📥'}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-slate-800 dark:text-neutral-100 text-sm leading-snug">
                                                                {isPayout 
                                                                    ? (language === 'de' ? 'Auszahlung' : 'Withdrawal Payout') 
                                                                    : (language === 'de' ? 'Rückerstattung' : 'Refund')}
                                                            </h4>
                                                            <p className="text-slate-450 text-[10px] font-bold mt-0.5">
                                                                {formatTimestamp(tx.createdAt)}
                                                            </p>
                                                            <p className={cn(
                                                                "text-[10px] font-black uppercase tracking-wider mt-1",
                                                                tx.status === 'completed' ? "text-emerald-500" :
                                                                tx.status === 'failed' ? "text-rose-500" :
                                                                "text-blue-500"
                                                            )}>
                                                                {statusLabel}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className={cn(
                                                            "font-mono font-black text-sm px-3 py-1 rounded-full border",
                                                            isPayout 
                                                                ? "text-rose-500 bg-rose-50/50 border-rose-100" 
                                                                : "text-emerald-500 bg-emerald-50/50 border-emerald-100"
                                                        )}>
                                                            {isPayout ? '-' : '+'}€{tx.amount?.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Points Balance Card */}
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden text-left w-full">
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-2 opacity-80">
                                        <div className="flex items-center gap-2">
                                            🏆
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{language === 'de' ? 'Aktiva Points Kontostand' : 'Aktiva Points Balance'}</span>
                                        </div>
                                        <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase">
                                            {language === 'de' ? `Level ${userProfile?.level || 1}` : `Level ${userProfile?.level || 1}`}
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-4">
                                        <span className="text-5xl font-black">{userProfile?.pointsBalance || 0}</span>
                                        <span className="text-lg font-black uppercase tracking-wider text-emerald-200">Points</span>
                                    </div>

                                    <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center backdrop-blur-sm">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">{language === 'de' ? 'Gesammelte XP (Lifetime)' : 'Earned XP (Lifetime)'}</span>
                                        <span className="text-sm font-black text-white">{userProfile?.pointsLifetime || 0} XP</span>
                                    </div>
                                </div>
                                <Wallet className="absolute -bottom-6 -right-6 h-40 w-40 text-white/5 rotate-12" />
                            </div>

                            {/* Points Ledger List */}
                            <div className="space-y-4 pt-4 w-full text-left">
                                <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <History className="h-3 w-3" /> {language === 'de' ? 'Punkte-Verlauf' : 'Points Ledger'}
                                </h3>

                                {loadingLedger ? (
                                    <div className="flex items-center justify-center py-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-[#10b981]" />
                                    </div>
                                ) : ledgerEntries.length === 0 ? (
                                    <div className="text-center p-10 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                        <p className="text-slate-400 text-sm font-bold">
                                            {language === 'de' ? 'Bisher keine Punkte gesammelt.' : 'No points earned yet.'}
                                        </p>
                                        <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                                            {language === 'de' 
                                                ? 'Erstelle Aktivitäten oder nimm daran teil, um Aktiva Points zu erhalten!' 
                                                : 'Create or join activities to earn Aktiva Points!'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {ledgerEntries.map(entry => {
                                            const details = getLedgerTypeDetails(entry.type, entry.metadata);
                                            return (
                                                <div 
                                                    key={entry.id} 
                                                    className="p-4 rounded-2xl bg-white border border-slate-100 flex items-center justify-between shadow-sm hover:scale-[1.01] transition-transform"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-neutral-800 flex items-center justify-center text-lg">
                                                            {details.icon}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-slate-800 dark:text-neutral-100 text-sm leading-snug">
                                                                {details.label}
                                                            </h4>
                                                            <p className="text-slate-450 text-[10px] font-bold mt-0.5">
                                                                {formatTimestamp(entry.createdAt)}
                                                            </p>
                                                            {details.desc && (
                                                                <p className="text-slate-500 text-xs font-semibold mt-1">
                                                                    {details.desc}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="text-emerald-500 font-black text-sm bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/50">
                                                            +{entry.points}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

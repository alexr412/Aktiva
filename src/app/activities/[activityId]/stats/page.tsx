'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Activity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, BarChart3, Users, Eye, Target, TrendingUp, Sparkles, Flame, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ActivityStatsPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const activityId = params.activityId as string;

    const [activity, setActivity] = useState<Activity | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activityId || !db || !user) return;

        const unsubscribe = onSnapshot(doc(db, 'activities', activityId), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as Activity;
                
                // RBAC: Nur der Ersteller darf Statistiken sehen
                if (data.creatorId !== user.uid) {
                    router.replace('/');
                    return;
                }
                
                setActivity(data);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [activityId, user, router]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!activity) return null;

    const impressions = activity.stats?.impressions || 0;
    const participants = activity.participantIds.length;
    const pushJoins = activity.stats?.pushJoins || 0;
    const conversionRate = impressions > 0 ? (participants / impressions) * 100 : 0;

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-y-auto">
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center px-4 bg-white border-b border-slate-100 backdrop-blur-md">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2 rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="font-black text-lg">Boost Insights</h1>
            </header>

            <main className="flex-1 p-4 sm:p-8 max-w-2xl mx-auto w-full space-y-6 pb-24">
                <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-[2.5rem] p-8 text-white shadow-xl shadow-orange-200 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Flame className="h-5 w-5 fill-white" />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Aktiver Boost</span>
                        </div>
                        <h2 className="text-3xl font-black leading-tight mb-4">{activity.placeName}</h2>
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 flex-1 text-center">
                                <p className="text-[10px] font-bold uppercase opacity-70 mb-1">Status</p>
                                <p className="text-sm font-black uppercase">{activity.status}</p>
                            </div>
                            <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 flex-1 text-center">
                                <p className="text-[10px] font-bold uppercase opacity-70 mb-1">Booster</p>
                                <p className="text-sm font-black uppercase">Aktiv</p>
                            </div>
                        </div>
                    </div>
                    <Sparkles className="absolute -bottom-4 -right-4 h-32 w-32 text-white/10" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 text-slate-400 mb-3">
                                <Eye className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Impressions</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900">{impressions.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">Ansichten im Feed</p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 text-primary mb-3">
                                <Users className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Teilnehmer</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900">{participants}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">Aktuelle Gruppe</p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-orange-500">
                            <Target className="h-5 w-5" />
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Push-Effektivität</CardTitle>
                        </div>
                        <CardDescription className="font-medium">Nutzer, die über die 2km-Radar-Benachrichtigung beigetreten sind.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 pb-8">
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-slate-900">{pushJoins}</span>
                            <span className="text-lg font-bold text-slate-400">Erfolge</span>
                        </div>
                        <div className="mt-6 space-y-2">
                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-orange-500 rounded-full transition-all duration-1000" 
                                    style={{ width: `${participants > 0 ? (pushJoins / participants) * 100 : 0}%` }}
                                />
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 text-right uppercase">
                                {participants > 0 ? ((pushJoins / participants) * 100).toFixed(0) : 0}% der Gruppe via Push
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-[2rem] bg-slate-900 text-white overflow-hidden">
                    <CardContent className="p-8 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                <TrendingUp className="h-5 w-5" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Conversion Rate</span>
                            </div>
                            <p className="text-4xl font-black">{conversionRate.toFixed(1)}%</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-[140px]">
                                Effizienz deiner Aktivität im Vergleich zur Gesamtsichtbarkeit.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-start gap-4">
                    <div className="bg-white p-2 rounded-xl shadow-sm">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h4 className="font-black text-blue-900 text-sm mb-1">Optimierungs-Tipp</h4>
                        <p className="text-xs text-blue-800/70 font-medium leading-relaxed">
                            Deine Conversion Rate liegt über dem Durchschnitt. Ein präziserer Titel oder ein attraktiverer Ort könnten die Impressions noch weiter steigern.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

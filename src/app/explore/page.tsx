'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { joinActivity } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';

import { ActivityListItem } from '@/components/aktvia/activity-list-item';
import { Skeleton } from '@/components/ui/skeleton';
import { Compass } from 'lucide-react';

const ActivitySkeleton = () => (
    <div className="p-4 border-b">
        <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
        </div>
    </div>
);

const EmptyState = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center h-full">
    <div className="bg-primary/10 p-4 rounded-full">
      <Compass className="h-10 w-10 text-primary" />
    </div>
    <h2 className="text-xl font-semibold">No Upcoming Activities</h2>
    <p className="text-muted-foreground">
      There are no activities scheduled right now. Why not create one?
    </p>
  </div>
);


export default function ExplorePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [joiningActivityId, setJoiningActivityId] = useState<string|null>(null);

    useEffect(() => {
        if (!db) return;

        const activitiesQuery = query(
            collection(db, 'activities'),
            where('activityDate', '>=', Timestamp.now()),
            orderBy('activityDate', 'asc')
        );

        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            const fetchedActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setActivities(fetchedActivities);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching activities: ", error);
            toast({ title: "Error", description: "Could not load upcoming activities.", variant: 'destructive'});
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    const handleJoin = async (activityId: string) => {
        if (!user) {
            toast({ title: 'Login Required', description: 'You must be logged in to join an activity.' });
            router.push('/login');
            return;
        }
        setJoiningActivityId(activityId);
        try {
            await joinActivity(activityId, user);
            toast({ title: 'Success!', description: 'You have joined the activity. You can find it in your chats.' });
            router.push(`/chat/${activityId}`);
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Error', description: error.message || 'Failed to join activity.', variant: 'destructive' });
        } finally {
            setJoiningActivityId(null);
        }
    };


    const renderContent = () => {
        if (loading) {
            return (
                <div className="divide-y divide-border">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <ActivitySkeleton key={i} />
                    ))}
                </div>
            );
        }

        if (activities.length === 0) {
            return <EmptyState />;
        }

        return (
             <ul className="divide-y divide-border">
                {activities.map(activity => (
                    <li key={activity.id}>
                        <ActivityListItem
                            activity={activity}
                            user={user}
                            onJoin={handleJoin}
                            isJoining={joiningActivityId === activity.id}
                        />
                    </li>
                ))}
             </ul>
        );
    }
    
    return (
        <div className="flex h-full flex-col">
            <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm">
              <div className="px-4 flex h-16 items-center">
                <h1 className="text-2xl font-bold tracking-tight">Explore Activities</h1>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto pb-20">
                {renderContent()}
            </div>
        </div>
    );
}

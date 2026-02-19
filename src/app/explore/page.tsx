'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { joinActivity } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { ActivityListItem } from '@/components/aktvia/activity-list-item';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Compass, Bell } from 'lucide-react';
import { CategoryFilters, categories as defaultCategories } from '@/components/aktvia/category-filters';

const ActivitySkeleton = () => (
    <div className="p-4 border-b">
        <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
    </div>
);

const EmptyState = () => (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center h-full">
        <div className="bg-primary/10 p-4 rounded-full">
            <Compass className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Keine Aktivitäten geplant</h2>
        <p className="text-muted-foreground">
            Erstelle jetzt einen Spieleabend oder Sport-Treff!
        </p>
        <Button asChild>
            <Link href="/">Jetzt entdecken</Link>
        </Button>
    </div>
);


export default function ExplorePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [allActivities, setAllActivities] = useState<Activity[]>([]);
    const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string[]>(defaultCategories[0].id);

    useEffect(() => {
        if (!db) return;

        const activitiesQuery = query(
            collection(db, 'activities'),
            where('activityDate', '>=', Timestamp.now()),
            orderBy('activityDate', 'asc')
        );

        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            const fetchedActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setAllActivities(fetchedActivities);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching activities: ", error);
            toast({ title: "Error", description: "Could not load upcoming activities.", variant: 'destructive'});
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    useEffect(() => {
        let newFiltered: Activity[];
        if (activeCategory.includes('user_event')) {
            // Handles "Community" filter
            newFiltered = allActivities.filter(act => act.categories?.includes('user_event'));
        } else {
            // Handles all other Geo-based filters (Highlights, Sport, etc.)
            newFiltered = allActivities.filter(act => 
                !act.isCustomActivity && act.categories?.some(cat => activeCategory.includes(cat) || activeCategory.includes(cat.split('.')[0]))
            );
        }
        setFilteredActivities(newFiltered);
    }, [allActivities, activeCategory]);

    const handleJoin = async (activityId: string) => {
        if (!user) {
            toast({ title: 'Login Required', description: 'You must be logged in to join an activity.' });
            router.push('/login');
            throw new Error('Login Required');
        }
        try {
            await joinActivity(activityId, user);
            toast({ title: 'Success!', description: 'You have joined the activity. You can find it in your chats.' });
            router.push(`/chat/${activityId}`);
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Error', description: error.message || 'Failed to join activity.', variant: 'destructive' });
            throw error;
        }
    };
    
    const handleCategoryChange = (categoryId: string[]) => {
      setActiveCategory(categoryId);
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

        if (filteredActivities.length === 0) {
            return <EmptyState />;
        }

        return (
             <ul className="divide-y divide-border">
                {filteredActivities.map(activity => (
                    <li key={activity.id}>
                        <ActivityListItem
                            activity={activity}
                            user={user}
                            onJoin={handleJoin}
                        />
                    </li>
                ))}
             </ul>
        );
    }
    
    return (
        <div className="flex h-full flex-col">
            <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm">
              <div className="px-4 py-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Explore Activities</h1>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                        <Bell className="h-5 w-5" />
                        <span className="sr-only">Benachrichtigungen</span>
                    </Button>
                </div>
                <CategoryFilters activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
              </div>
            </header>
            <div className="flex-1 overflow-y-auto pb-20">
                {renderContent()}
            </div>
        </div>
    );
}

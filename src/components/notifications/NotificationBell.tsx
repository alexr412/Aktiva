'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import type { Notification } from '@/lib/types';
import { NotificationItem } from './NotificationItem';
import { Separator } from '../ui/separator';

export function NotificationBell() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!user || !db) return;

        const notificationsQuery = query(
            collection(db, "notifications"),
            where("recipientId", "==", user.uid),
            where("isRead", "==", false),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            const newNotifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Notification));
            setNotifications(newNotifications);
        }, (error) => {
            console.error("Error fetching notifications:", error);
        });

        return () => unsubscribe();
    }, [user]);

    const unreadCount = notifications.length;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-2.5 w-2.5 items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                    )}
                    <span className="sr-only">Benachrichtigungen</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
                <div className="p-4 pb-2">
                    <h4 className="font-medium leading-none">Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                        You have {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}.
                    </p>
                </div>
                <Separator />
                <div className="p-2 max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                        notifications.map(notification => (
                            <NotificationItem key={notification.id} notification={notification} onAction={() => setIsOpen(false)} />
                        ))
                    ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No new notifications.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

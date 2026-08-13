'use client';

import { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useNotifications } from '@/contexts/notification-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import { Separator } from '../ui/separator';

export function NotificationBell() {
    const language = useLanguage();
    const { notifications, unreadCount, unreadBadgeLabel, markAllAsRead } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [isMarking, setIsMarking] = useState(false);

    const handleMarkAllAsRead = async () => {
        if (isMarking || unreadCount === 0) return;
        setIsMarking(true);
        try {
            await markAllAsRead();
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        } finally {
            setIsMarking(false);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="secondary-header-button relative"
                    aria-label={language === 'de' ? `Benachrichtigungen (${unreadCount} ungelesen)` : `Notifications (${unreadCount} unread)`}
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex min-w-[18px] h-4 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-[9px] px-1 shadow-sm">
                            {unreadBadgeLabel}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 sm:w-96 p-0 shadow-lg rounded-2xl border border-slate-200/80 dark:border-neutral-800" align="end">
                <div className="p-4 pb-3 flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-sm leading-none">
                            {language === 'de' ? 'Benachrichtigungen' : 'Notifications'}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {language === 'de'
                                ? `${unreadCount} ungelesene Nachricht${unreadCount !== 1 ? 'en' : ''}`
                                : `You have ${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleMarkAllAsRead}
                            disabled={isMarking}
                            className="text-xs h-8 px-2 text-primary hover:text-primary/80 font-bold"
                        >
                            {language === 'de' ? 'Alle lesen' : 'Read all'}
                        </Button>
                    )}
                </div>
                <Separator />
                <div className="p-2 max-h-80 overflow-y-auto space-y-1">
                    {notifications.length > 0 ? (
                        notifications.map((notification) => (
                            <NotificationItem 
                                key={notification.id} 
                                notification={notification} 
                                onAction={() => setIsOpen(false)} 
                            />
                        ))
                    ) : (
                        <div className="p-6 text-center text-xs text-muted-foreground font-medium">
                            {language === 'de' ? 'Keine neuen Benachrichtigungen.' : 'No new notifications.'}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

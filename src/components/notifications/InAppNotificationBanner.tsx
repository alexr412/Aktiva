'use client';

import { useEffect, useState } from 'react';
import type { Notification } from '@/lib/types';
import { getNotificationTargetUrl } from '@/lib/types';
import { useNotifications } from '@/contexts/notification-context';
import { useRouter } from 'next/navigation';
import { ProfileAvatar } from '../ui/profile-avatar';
import { X, Bell, UserPlus, MessageSquare, MapPin, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InAppNotificationBannerProps {
  notification: Notification;
  onClose: (id: string) => void;
}

export function InAppNotificationBanner({ notification, onClose }: InAppNotificationBannerProps) {
  const router = useRouter();
  const { markAsRead } = useNotifications();
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 200);
  };

  const handleClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    handleDismiss();
    try {
      await markAsRead(notification.id);
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }

    const url = getNotificationTargetUrl(notification);
    if (url) {
      router.push(url);
    }
  };

  const sender = notification.senderProfile;

  const renderTypeIcon = () => {
    switch (notification.type) {
      case 'friend_request':
      case 'friend_accepted':
        return <UserPlus className="h-4 w-4 text-primary shrink-0" />;
      case 'chat_message':
      case 'chat_request':
        return <MessageSquare className="h-4 w-4 text-blue-500 shrink-0" />;
      case 'nearby_spot':
        return <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />;
      case 'recommendation':
      case 'engagement_reminder':
        return <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />;
      default:
        return <Bell className="h-4 w-4 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div
      onClick={handleClick}
      role="alert"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as any);
        } else if (e.key === 'Escape') {
          handleDismiss();
        }
      }}
      className={cn(
        "group relative flex items-start gap-3.5 p-4 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg border border-slate-200/80 dark:border-neutral-800 shadow-2xl transition-all duration-300 transform cursor-pointer w-full max-w-sm shrink-0",
        isDismissing ? "opacity-0 translate-y-[-10px] scale-95" : "opacity-100 translate-y-0 scale-100"
      )}
    >
      {sender?.photoURL || sender?.displayName ? (
        <ProfileAvatar 
          className="mt-0.5 shrink-0"
          photoURL={sender?.photoURL}
          displayName={sender?.displayName}
        />
      ) : (
        <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 shrink-0 mt-0.5">
          {renderTypeIcon()}
        </div>
      )}

      <div className="flex-1 min-w-0 pr-6 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h5 className="font-bold text-xs text-foreground truncate">
            {notification.title}
          </h5>
          <span className="text-[9px] font-bold text-primary shrink-0 uppercase tracking-wider">
            Jetzt
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-medium">
          {notification.body || notification.message}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        className="absolute top-3.5 right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Subtle Bottom Accent Bar */}
      <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-primary/80 to-primary/20 rounded-full" />
    </div>
  );
}

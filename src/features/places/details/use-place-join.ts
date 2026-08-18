'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { joinActivity } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';

export function usePlaceJoin(user: User | null, language: 'de' | 'en') {
  const router = useRouter();
  const { toast } = useToast();
  const [joiningActivityId, setJoiningActivityId] = useState<string | null>(null);
  const [requestedActivityIds, setRequestedActivityIds] = useState<Record<string, boolean>>({});

  const handleJoin = async (activity: Activity) => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (activity.isPaid && activity.price && activity.price > 0) {
      router.push(`/checkout/${activity.id}`);
      return;
    }
    if (joiningActivityId === activity.id || requestedActivityIds[activity.id!]) return;

    setJoiningActivityId(activity.id!);
    try {
      const status = await joinActivity(
        activity.id!,
        user,
        null,
        null,
        activity.joinMode
      );
      if (status === 'joined') {
        toast({
          title: language === 'de' ? 'Erfolgreich beigetreten!' : 'Successfully joined!',
        });
      } else if (status === 'already_requested') {
        setRequestedActivityIds((prev) => ({
          ...prev,
          [activity.id!]: true,
        }));
        toast({
          title:
            language === 'de'
              ? 'Du hast bereits eine Anfrage gesendet.'
              : 'You already sent a request.',
          description:
            language === 'de'
              ? 'Der Host hat deine Anfrage bereits erhalten.'
              : 'The host has already received your request.',
        });
      } else {
        setRequestedActivityIds((prev) => ({
          ...prev,
          [activity.id!]: true,
        }));
        toast({
          title: language === 'de' ? 'Anfrage gesendet!' : 'Request sent!',
          description:
            language === 'de'
              ? 'Der Host wird benachrichtigt.'
              : 'The host will be notified.',
        });
      }
      return status;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message || String(error),
      });
    } finally {
      setJoiningActivityId(null);
    }
  };

  return {
    joiningActivityId,
    requestedActivityIds,
    handleJoin,
  };
}

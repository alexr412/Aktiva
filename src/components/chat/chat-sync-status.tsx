'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useChatSync } from '@/contexts/chat-sync-context';

export function ChatSyncStatus({ language }: { language: string }) {
  const { error, retry, remoteLoading, chats } = useChatSync();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (!error && !offline && !(remoteLoading && chats.length)) return null;
  return <div role={error ? 'alert' : 'status'} className="mx-4 my-3 rounded-2xl border border-slate-200 dark:border-neutral-700 p-4 text-sm text-slate-600 dark:text-neutral-300">
    <p>{error
      ? (language === 'de' ? 'Chats konnten nicht aktualisiert werden. Bitte versuche es erneut.' : 'Could not refresh chats. Please try again.')
      : offline
        ? (language === 'de' ? 'Du bist offline. Gespeicherte Chats bleiben sichtbar.' : 'You are offline. Saved chats remain visible.')
        : (language === 'de' ? 'Gespeicherte Chats werden aktualisiert …' : 'Refreshing saved chats …')}
    </p>
    {(error || offline) && <Button type="button" variant="outline" className="mt-3" onClick={retry}>{language === 'de' ? 'Erneut versuchen' : 'Try again'}</Button>}
  </div>;
}

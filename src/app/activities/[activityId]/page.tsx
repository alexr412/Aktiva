import { Metadata } from 'next';
import { db } from '@/lib/firebase/server';
import { doc, getDoc } from 'firebase/firestore';
import ActivityDetailClient from './activity-detail-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ activityId: string }>;
};

/**
 * MODUL 13: Dynamische Open Graph Metadaten für externe Wachstumszyklen.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { activityId } = await params;
  if (!db || !activityId) return { title: 'Aktivität Details | Aktiva' };

  try {
    const activityRef = doc(db, 'activities', activityId);
    
    // Safety timeout for build process
    const fetchWithTimeout = Promise.race([
      getDoc(activityRef),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);

    const activitySnap = await fetchWithTimeout as any;

    if (!activitySnap || !activitySnap.exists()) {
      return { title: 'Aktivität nicht gefunden | Aktiva' };
    }

    const activity = activitySnap.data();

    // Check for global blacklisted status
    if (activity.status === 'blacklisted') {
      return {
        title: 'Aktivität nicht verfügbar | Aktiva',
        description: 'Diese Aktivität ist nicht mehr verfügbar.',
      };
    }

    const dateObj = activity.activityDate && typeof activity.activityDate.toDate === 'function'
      ? activity.activityDate.toDate()
      : null;
    const dateStr = dateObj ? dateObj.toLocaleDateString('de-DE') : '';
    const isPast = dateObj ? dateObj.getTime() < Date.now() : false;

    // Check for cancelled or completed status
    const isCancelled = activity.status === 'cancelled';
    const isCompleted = activity.status === 'completed' || isPast;

    let titlePrefix = '';
    if (isCancelled) {
      titlePrefix = '[Abgesagt] ';
    } else if (isCompleted) {
      titlePrefix = '[Beendet] ';
    }

    const title = `${titlePrefix}${activity.placeName || 'Treffen'} | Aktiva`;
    const description = isCancelled
      ? `Die Aktivität bei ${activity.placeName || 'uns'} am ${dateStr} wurde abgesagt.`
      : isCompleted
      ? `Diese Aktivität bei ${activity.placeName || 'uns'} fand am ${dateStr} statt.`
      : `Wird veranstaltet von ${activity.hostName || 'einem Entdecker'}. Sei dabei am ${dateStr}!`;

    return {
      title,
      description,
      openGraph: {
        title: `Einladung: Treffen bei ${activity.placeName || 'Aktiva'}`,
        description: `Join uns auf Aktiva für ein Event in der Kategorie ${activity.category || 'Sonstiges'}.`,
        url: `https://aktiva.app/activities/${activityId}`,
        siteName: 'Aktiva',
        images: [
          {
            url: activity.hostPhotoURL || 'https://picsum.photos/seed/aktiva/1200/630',
            width: 1200,
            height: 630,
          },
        ],
        type: 'website',
      },
    };
  } catch (err) {
    return { title: 'Aktivität Details | Aktiva' };
  }
}

export default async function ActivityPage({ params }: Props) {
  const { activityId } = await params;
  return <ActivityDetailClient activityId={activityId} />;
}

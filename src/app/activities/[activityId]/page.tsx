import { Metadata } from 'next';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import ActivityDetailClient from './activity-detail-client';

type Props = {
  params: Promise<{ activityId: string }>;
};

/**
 * MODUL 13: Dynamische Open Graph Metadaten für externe Wachstumszyklen.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { activityId } = await params;
  if (!db) return { title: 'Aktivität Details' };

  try {
    const activityRef = doc(db, 'activities', activityId);
    const activitySnap = await getDoc(activityRef);
    
    if (!activitySnap.exists()) {
      return { title: 'Aktivität nicht gefunden' };
    }

    const activity = activitySnap.data();
    
    return {
      title: `${activity.placeName} | Aktvia`,
      description: `Wird veranstaltet von ${activity.creatorName}. Sei dabei am ${activity.activityDate?.toDate().toLocaleDateString('de-DE')}!`,
      openGraph: {
        title: `Einladung: Treffen bei ${activity.placeName}`,
        description: `Join uns auf Aktvia für ein Event in der Kategorie ${activity.category || 'Sonstiges'}.`,
        url: `https://aktvia.app/activities/${activityId}`,
        siteName: 'Aktvia',
        images: [
          {
            url: activity.creatorPhotoURL || 'https://picsum.photos/seed/aktvia/1200/630',
            width: 1200,
            height: 630,
          },
        ],
        type: 'website',
      },
    };
  } catch (err) {
    return { title: 'Aktivität Details' };
  }
}

export default async function ActivityPage({ params }: Props) {
  const { activityId } = await params;
  return <ActivityDetailClient activityId={activityId} />;
}

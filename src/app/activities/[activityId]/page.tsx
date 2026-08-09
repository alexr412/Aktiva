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


export default async function ActivityPage({ params }: Props) {
  const { activityId } = await params;
  return <ActivityDetailClient activityId={activityId} />;
}

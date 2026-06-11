import { db } from './firebase/client';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { TELEMETRY_EVENTS_COLLECTION } from './firebase/collections';

export interface TelemetryInteraction {
  placeId: string;
  category: string[];
  interactionType: 'card_open' | 'card_click' | 'favorite' | 'share' | 'directions' | 'impression' | 'dwell';
  timestamp: number;
  value?: number; // event value (dwell duration in ms)
  userId?: string;
}

const interactionQueue: TelemetryInteraction[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 5000; // Buffer writes for 5 seconds

const EVENT_TYPE_MAP: Record<TelemetryInteraction['interactionType'], string> = {
  card_click: 'click',
  impression: 'impression',
  dwell: 'dwell',
  card_open: 'card_open',
  favorite: 'favorite',
  share: 'share',
  directions: 'directions',
};

export function trackInteraction(
  placeId: string,
  category: string[],
  interactionType: TelemetryInteraction['interactionType'],
  userId?: string,
  value?: number
) {
  if (typeof window === 'undefined' || !db) return;

  interactionQueue.push({
    placeId,
    category,
    interactionType,
    timestamp: Date.now(),
    userId: userId || undefined,
    value,
  });

  if (!flushTimeout) {
    flushTimeout = setTimeout(flushTelemetry, FLUSH_INTERVAL_MS);
  }
}

async function flushTelemetry() {
  flushTimeout = null;
  if (interactionQueue.length === 0 || !db) return;

  const batch = writeBatch(db);
  const interactionsToFlush = [...interactionQueue];
  interactionQueue.length = 0; // Clear the queue

  try {
    const colRef = collection(db, TELEMETRY_EVENTS_COLLECTION);
    interactionsToFlush.forEach(interaction => {
      const docRef = doc(colRef);
      
      // Map event type for aggregation.ts expected value using explicit EVENT_TYPE_MAP
      const eventType = EVENT_TYPE_MAP[interaction.interactionType] || interaction.interactionType;

      const eventData = {
        // Canonical Fields
        entity_id: interaction.placeId,
        event_type: eventType,
        event_value: interaction.value ?? 0,
        timestamp: new Date(interaction.timestamp).toISOString(),
        user_id: interaction.userId ?? null,

        // Legacy Compatibility Fields
        placeId: interaction.placeId,
        interactionType: interaction.interactionType,
        value: interaction.value ?? 0,
        userId: interaction.userId ?? null,

        // Shared metadata
        category: interaction.category,
      };

      batch.set(docRef, eventData);
    });
    await batch.commit();
  } catch (error: any) {
    console.error('[Telemetry] Failed to flush interactions:', error);
    // Transient error check: do not requeue on permission-denied errors
    const isPermissionError = error?.code === 'permission-denied' || error?.message?.toLowerCase().includes('permission') || false;
    if (!isPermissionError) {
      interactionQueue.unshift(...interactionsToFlush);
    }
  }
}

if (typeof window !== 'undefined') {
  const handleVisibilityOrUnload = () => {
    if (document.visibilityState === 'hidden') {
      flushTelemetry();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityOrUnload);
  window.addEventListener('beforeunload', () => {
    flushTelemetry();
  });
}


// Compatibility layer for existing hooks (useDwellTracker, useImpressionTracker)
class TelemetryCompat {
  track(
    eventType: 'impression' | 'click' | 'dwell',
    entityId: string,
    eventValue: number = 0,
    userId: string | null = null
  ) {
    // Map existing eventType to TelemetryInteraction['interactionType']
    const typeMap: Record<string, TelemetryInteraction['interactionType']> = {
      impression: 'impression',
      click: 'card_click',
      dwell: 'dwell',
    };
    
    trackInteraction(
      entityId,
      [], // Category is not available in hook context
      typeMap[eventType] || 'card_click',
      userId || undefined,
      eventValue
    );
  }
}

export const telemetry = new TelemetryCompat();

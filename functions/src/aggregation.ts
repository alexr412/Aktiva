import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Berechnet die untere Grenze des Wilson-Score-Konfidenzintervalls (Normalisierung)
function calculateWilsonScore(clicks: number, impressions: number, z: number = 1.96): number {
  if (impressions === 0) return 0;
  const n = impressions;
  const p = Math.min(clicks, impressions) / n; 
  const denominator = 1 + (z * z) / n;
  const term1 = p + (z * z) / (2 * n);
  const term2 = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return (term1 - term2) / denominator;
}

/**
 * Worker operiert stündlich: 
 * Sammelt Telemetrie roh via Streaming-Pagination, berechnet statistisch belastbares $I_score$, 
 * und forciert TTL für veraltete Datensätze nach exakt 7 Tagen in sicheren Batches.
 */
export const telemetryAggregationWorker = onSchedule({
  schedule: 'every 1 hours',
  memory: '512MiB', // Erhöhter Speicher für Aggregation
  timeoutSeconds: 300
}, async (event) => {
  const db = admin.firestore();
  console.log('Initiating hourly telemetry aggregation worker (Stability Edition)...');

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const retentionTimestampISO = sevenDaysAgo.toISOString();

  const entityStats = new Map<string, {
    impressions: number,
    clicks: number,
    dwellSum: number,
    dwellCount: number
  }>();

  // 1. STREAMING AGGREGATION: Verhindert OOM bei großen Datenmengen
  let lastDoc = null;
  let hasMore = true;
  const PAGE_SIZE = 1000;

  while (hasMore) {
    let query = db.collection('telemetry_events')
      .orderBy('timestamp')
      .where('timestamp', '>=', retentionTimestampISO)
      .limit(PAGE_SIZE);
    
    if (lastDoc) query = query.startAfter(lastDoc);
    
    const snapshot = await query.get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const entityId = data.entity_id;
      if (!entityId) return;

      if (!entityStats.has(entityId)) {
        entityStats.set(entityId, { impressions: 0, clicks: 0, dwellSum: 0, dwellCount: 0 });
      }
      const stats = entityStats.get(entityId)!;
      
      if (data.event_type === 'impression') stats.impressions++;
      else if (data.event_type === 'click') stats.clicks++;
      else if (data.event_type === 'dwell') {
        const ms = data.event_value;
        if (ms >= 100 && ms <= 3600000) {
          stats.dwellSum += ms;
          stats.dwellCount++;
        }
      }
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) hasMore = false;
  }

  // 2. BATCH UPDATES: In Chunks von 400 (Sicherheitsmarge)
  const statsArray = Array.from(entityStats.entries());
  for (let i = 0; i < statsArray.length; i += 400) {
    const batch = db.batch();
    const chunk = statsArray.slice(i, i + 400);

    chunk.forEach(([entityId, stats]) => {
      const i_score = calculateWilsonScore(stats.clicks, stats.impressions);
      const dq_score = stats.dwellCount > 0 ? stats.dwellSum / stats.dwellCount : 0;
      
      const entityRef = db.collection('entities').doc(entityId);
      batch.set(entityRef, {
        metrics: {
          base_raw_events: stats.impressions + stats.clicks + stats.dwellCount,
          i_score: i_score,
          dq_score: dq_score,
          last_aggregated: FieldValue.serverTimestamp()
        }
      }, { merge: true });
    });

    await batch.commit();
  }

  // 3. CHUNKED DELETE: Löscht veraltete Daten ohne Batch-Limit-Fehler
  let deletedTotal = 0;
  while (true) {
    const obsoleteSnap = await db.collection('telemetry_events')
      .where('timestamp', '<', retentionTimestampISO)
      .limit(400)
      .get();
    
    if (obsoleteSnap.empty) break;

    const deleteBatch = db.batch();
    obsoleteSnap.forEach(doc => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();
    deletedTotal += obsoleteSnap.size;
  }

  console.log(`Aggregation successful. Metrics updated for ${entityStats.size} entities. Truncated ${deletedTotal} events.`);
});

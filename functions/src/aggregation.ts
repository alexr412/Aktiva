import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// Berechnet die untere Grenze des Wilson-Score-Konfidenzintervalls (Normalisierung)
function calculateWilsonScore(clicks: number, impressions: number, z: number = 1.96): number {
  if (impressions === 0) return 0;
  
  // Guard-Clause für Fraud-Detection & Crawler: Clicks dürfen logisch max = Impressions sein
  const n = impressions;
  const p = Math.min(clicks, impressions) / n; 

  const denominator = 1 + (z * z) / n;
  const term1 = p + (z * z) / (2 * n);
  const term2 = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));

  return (term1 - term2) / denominator;
}

/**
 * Worker operiert stündlich: 
 * Sammelt Telemetrie roh, bereinigt Outlier, berechnet statistisch belastbares $I_score$, 
 * und forciert Time-To-Live (TTL) für veraltete Datensätze nach exakt 7 Tagen.
 */
export const telemetryAggregationWorker = onSchedule('every 1 hours', async (event) => {
  const db = admin.firestore();
  console.log('Initiating hourly telemetry aggregation and normalization worker...');

  const now = new Date();
  
  // 7-Tage Fallback/Retention für ML und Fraud Detection festlegen
  const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const retentionTimestampISO = sevenDaysAgo.toISOString();

  // 1. Hole alle Telemetrie-Events, die innerhalb der aktiven Sliding-Window 7-Tage Frist liegen.
  // Das gewährt ein echtes gleitendes Metrik-Ranking. Altdaten werden im Cleanup-Prozess entfernt.
  const eventsSnap = await db.collection('telemetry_events').get();
  
  if (eventsSnap.empty) {
    console.log('No active telemetry events found for smoothing.');
    return;
  }

  // Gruppierung über entity_id
  const entityStats = new Map<string, {
    impressions: number,
    clicks: number,
    dwellValues: number[]
  }>();

  eventsSnap.forEach((doc) => {
    const data = doc.data();
    const entityId = data.entity_id;
    if (!entityId) return;

    if (!entityStats.has(entityId)) {
      entityStats.set(entityId, { impressions: 0, clicks: 0, dwellValues: [] });
    }
    
    const stats = entityStats.get(entityId)!;
    
    // Ignoriere Events, die bereinigt werden, um keine Geister-Reste zu mappen
    if (data.timestamp && data.timestamp < retentionTimestampISO) {
      return; 
    }

    if (data.event_type === 'impression') {
      stats.impressions += 1;
    } else if (data.event_type === 'click') {
      stats.clicks += 1;
    } else if (data.event_type === 'dwell') {
      const ms = data.event_value;
      // Dwell-Quality (DQ): Statistische Outlier Exklusion
      if (ms >= 100 && ms <= 3600000) {
        stats.dwellValues.push(ms);
      }
    }
  });

  let updateCount = 0;
  const updatePromises: Promise<any>[] = [];

  // 2. Mathematische Transformation & Datenbank Injection
  for (const [entityId, stats] of entityStats.entries()) {
    if (stats.impressions === 0 && stats.clicks === 0 && stats.dwellValues.length === 0) {
      continue;
    }

    // Statistisch signifikante Normalisierung via Konfidenzintervall
    const i_score = calculateWilsonScore(stats.clicks, stats.impressions, 1.96);

    // Bereinigtes Arithmetisches Mittel
    let dq_score = 0;
    if (stats.dwellValues.length > 0) {
      const dwellSum = stats.dwellValues.reduce((a, b) => a + b, 0);
      dq_score = dwellSum / stats.dwellValues.length;
    }

    const entityRef = db.collection('entities').doc(entityId);
    
    updatePromises.push(
      entityRef.set({
        metrics: {
          base_raw_events: stats.impressions + stats.clicks + stats.dwellValues.length,
          i_score: i_score,
          dq_score: dq_score,
          last_aggregated: admin.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true })
    );

    updateCount++;
  }

  // 3. Batch Delete Job zur konsequenten Durchsetzung der Data Retention Policy
  const deleteBatch = db.batch();
  let deletedCount = 0;
  
  const obsoleteEventsSnap = await db.collection('telemetry_events')
    .where('timestamp', '<', retentionTimestampISO)
    .get();

  obsoleteEventsSnap.forEach(doc => {
    deleteBatch.delete(doc.ref);
    deletedCount++;
  });

  // Alles atomar absenden
  await Promise.all([
    ...updatePromises,
    deleteBatch.commit()
  ]);

  console.log(`Aggregation successful. Normalization metrics injected for ${updateCount} targets.`);
  console.log(`GC Data Retention: Truncated ${deletedCount} obsolete historic telemetry events.`);
});

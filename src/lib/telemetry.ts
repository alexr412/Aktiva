export type TelemetryEventType = 'impression' | 'click' | 'dwell';

export interface TelemetryEvent {
  event_id: string;      // UUID
  entity_id: string;     // Referenz zur Entität
  user_id: string | null;
  session_hash: string;  // Anonymisierter Fingerprint zur Sitzungsverfolgung
  event_type: TelemetryEventType;
  event_value: number;   // Metrik-Wert (Dauer in ms für 'dwell', sonst 0)
  timestamp: string;     // UTC
}

class TelemetryService {
  private queue: TelemetryEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 5000; // Batch-Intervall (5 Sekunden)
  private readonly ENDPOINT = '/api/telemetry'; 

  private sessionHash: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSession();
      this.startInterval();
      this.registerLifecycleHooks();
    }
  }

  // Generiert einfachen UUID-Fallback, falls crypto.randomUUID im non-secure Kontext fehlt
  private generateId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private initSession() {
    let hash = sessionStorage.getItem('telemetry_session_hash');
    if (!hash) {
      hash = this.generateId();
      sessionStorage.setItem('telemetry_session_hash', hash);
    }
    this.sessionHash = hash;
  }

  public track(
    eventType: TelemetryEventType,
    entityId: string,
    eventValue: number = 0,
    userId: string | null = null
  ) {
    const event: TelemetryEvent = {
      event_id: this.generateId(),
      entity_id: entityId,
      user_id: userId,
      session_hash: this.sessionHash,
      event_type: eventType,
      event_value: eventValue,
      timestamp: new Date().toISOString()
    };

    this.queue.push(event);

    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  private startInterval() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  public flush() {
    if (this.queue.length === 0) return;

    const payload = [...this.queue];
    this.queue = []; 

    // Bevorzuge Navigator Beacon API für zuverlässigen Transport bei Page Unload
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(this.ENDPOINT, blob);
    } else {
      fetch(this.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(err => console.error('Telemetry flush failed:', err));
    }
  }

  private registerLifecycleHooks() {
    // Flush the queue when the page unloads or is hidden
    window.addEventListener('beforeunload', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}

export const telemetry = new TelemetryService();

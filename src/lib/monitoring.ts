export const monitoring = {
  enabled: process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && localStorage.getItem('aktiva_debug') === 'true'),
  
  metrics: {
    totalRequests: 0,
    totalDurationMs: 0,
    cacheHits: 0,
    failedRequests: 0,
    activeFeedSize: 0,
  },

  logRequest(durationMs: number, success: boolean) {
    if (!this.enabled) return;
    this.metrics.totalRequests++;
    this.metrics.totalDurationMs += durationMs;
    if (!success) this.metrics.failedRequests++;
    this.print();
  },

  logCacheHit() {
    if (!this.enabled) return;
    this.metrics.cacheHits++;
    this.print();
  },

  logFeedSize(size: number) {
    if (!this.enabled) return;
    this.metrics.activeFeedSize = size;
    this.print();
  },

  print() {
    // Disabled debug printing to clean up console output
  }
};

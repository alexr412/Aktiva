export type FeedLoadAction = 'reveal' | 'fetch' | null;

/** Observe the actual feed scroller, including a short final row at its bottom. */
export function observeFeedEnd(node: HTMLElement, onLoadMore: () => void): () => void {
  let triggered = false;
  const observer = new IntersectionObserver(entries => {
    if (triggered || !entries.some(entry => entry.isIntersecting)) return;
    triggered = true;
    observer.disconnect();
    onLoadMore();
  }, { root: node.closest('main'), rootMargin: '0px 0px 200px 0px', threshold: 0 });
  observer.observe(node);
  return () => observer.disconnect();
}

/** Exhausting provider pages must not hide already loaded, filtered spots. */
export function getFeedLoadAction({ loadedCount, visibleCount, hasMorePages, loading = false }: {
  loadedCount: number;
  visibleCount: number;
  hasMorePages: boolean;
  loading?: boolean;
}): FeedLoadAction {
  if (loading) return null;
  if (visibleCount < loadedCount) return 'reveal';
  return hasMorePages ? 'fetch' : null;
}

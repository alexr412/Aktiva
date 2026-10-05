export function parseHiddenFeedCategories(raw: string | null, knownIds: readonly string[]): string[] {
  try {
    const stored: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.filter((id): id is string => typeof id === 'string' && knownIds.includes(id)))];
  } catch {
    return [];
  }
}

/** Category roots match their descendants, but never similarly named sibling categories. */
export function isFeedCategoryHidden(categories: readonly string[], hiddenQueries: readonly string[]): boolean {
  return categories.some(category => typeof category === 'string' && hiddenQueries.some(query =>
    category === query || category.startsWith(`${query}.`)
  ));
}

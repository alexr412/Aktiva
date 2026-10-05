/** Geoapify expects one comma-separated categories parameter. */
export function buildGeoapifyRequestUrl(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): URL {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) {
    if (key === 'categories') {
      // Accept legacy serialized values as well as raw category lists.
      const categories = value.split(/[,&]+/)
        .map(category => category.replace(/^categories=/, '').trim())
        .filter(Boolean);
      url.searchParams.set(key, categories.join(','));
    } else {
      url.searchParams.set(key, value);
    }
  }
  url.searchParams.set('apiKey', apiKey);
  return url;
}

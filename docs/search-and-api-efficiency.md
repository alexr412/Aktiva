# Feed search and provider usage

## Setup

Set `GROQ_API_KEY` in the Vercel project's server environment for Production (and Preview if needed), then deploy. Never use a `NEXT_PUBLIC_` prefix. Default model: `openai/gpt-oss-20b`; optional `GROQ_MODEL` must support strict JSON-schema output. Groq free-plan quotas are account-specific: https://console.groq.com/docs/rate-limits. No paid-provider fallback or automatic retries are enabled. There are no Google AI model calls remaining.

## Search

Typing produces a local preview, without AI or place requests. Enter/the search button submits a query. Common categories, synonyms, single-word venue names and explicit radii (0.1–100 km) resolve locally. Free-form text uses one Groq request, a compact taxonomy prompt, at most 512 completion tokens (including reasoning), low reasoning effort and a five-second abort timeout. Provider output is validated and restricted to allowed tags. Unsupported constraints such as opening hours/prices are not claimed as applied filters. Name search remains available if the provider is unavailable or a request cannot be expressed. Filters show the categories/radius actually applied; clearing the search restores the chosen browsing radius.

Successful AI interpretations are cached for 24 hours by hashed normalized text, model and schema version. Only actual provider token counts are recorded, including invalid/truncated outputs. Cache hits and local search do not count as AI calls. The unused recommendation flow now creates a factual place summary without a model request.

## Place requests and cache coverage

No eager place-detail requests are issued for the first eight name results; the existing details dialog still loads the selected place’s activities and ratings. Name-search keys include the text, centre and radius. Results retain their returned categories; unavailable categories are not guessed.

IndexedDB caches complete raw response pages for the exact request (centre, radius, categories, limit, offset and query), including empty responses. A partial discovery response is displayed but never saved as a complete local query. Mixed spatial tiles remain usable as a local search index, but cannot satisfy complete feed queries. Cache hits continue normal pagination. Empty results expire after five minutes; other local pages after 24 hours. Storage is capped at 100 queries.

The Geoapify gateway authenticates and rate-limits before cache access. A bounded instance cache and server-only Firestore collection `api_response_cache` share successful provider responses. Keys cover every sanitized parameter and service; user identity and API keys are not stored in cache entries. Cached data is public provider place data/intent filters, never live activities or participants. Geoapify response TTL: 24 hours, details six hours, empty responses five minutes. Concurrent identical Geoapify requests within one instance share one provider request. Errors are not cached. Cross-instance cold requests can still overlap.

For storage cleanup, optionally enable a Firestore TTL policy on `api_response_cache.expiresAt`; expiry is enforced by application code even without that policy. Existing Firestore rules grant no client access to this collection. Cache storage failures fall back to ordinary provider requests.

## Verify savings without mixing units

- **AI:** actual prompt/completion tokens and `aiRequests` in usage tracking. No character-based token estimates.
- **Geoapify:** existing server transactions and service-specific credit calculation run only for actual provider requests. `X-Aktiva-Cache: hit/shared/miss` identifies avoided requests in the browser Network panel. A cached response does not generate another credit transaction.
- **Firebase:** cache misses use one cache-document read and successful new responses one write; warm instance hits need neither. Authentication, distributed rate-limit operations and existing usage transactions still incur their own operations. Firestore console metrics show overall reads/writes; no guessed per-search savings percentage is displayed.

After deployment, test `Kino`, `Museum in 5 km`, a free-form category request, and a named venue. Repeat a query, remove a category/radius chip, clear it, switch category tabs, and verify that typing alone makes no parse-intent/geocoding requests. Test provider quota exhaustion with the ordinary name-search fallback.

// IMPORTANT: In a real-world application, these keys should be stored in
// environment variables (.env.local) to prevent them from being exposed
// in the source code.
// For example:
// NEXT_PUBLIC_GEOAPIFY_API_KEY=your_geoapify_api_key

export const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || 'ee537d684cc640eca4fdbb21b8601dda';
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

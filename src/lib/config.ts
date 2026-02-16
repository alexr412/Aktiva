// IMPORTANT: In a real-world application, these keys should be stored in
// environment variables (.env.local) to prevent them from being exposed
// in the source code.
// For example:
// NEXT_PUBLIC_GEOAPIFY_API_KEY=your_geoapify_api_key

export const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || 'a2647722239d48c78a6ac13dfc694656';
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

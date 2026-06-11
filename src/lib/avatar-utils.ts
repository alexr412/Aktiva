'use client';

/**
 * Maps MIME types explicitly to file extensions (jpg, png, webp).
 */
export const getExtensionFromMimeType = (mimeType: string): string => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
};

/**
 * Validates the profile picture file (size and type).
 */
export const validateAvatarFile = (
  file: File,
  language: 'de' | 'en' = 'de'
): { isValid: boolean; error?: string } => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: language === 'de'
        ? 'Ungültiges Dateiformat. Erlaubt sind: JPEG, PNG, WebP.'
        : 'Invalid file format. Allowed types: JPEG, PNG, WebP.',
    };
  }

  const maxSize = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: language === 'de'
        ? 'Datei zu groß. Das Bild darf maximal 5 MB groß sein.'
        : 'File too large. Maximum size is 5 MB.',
    };
  }

  return { isValid: true };
};

/**
 * Decodes and verifies whether a given photoURL is a valid Firebase Storage path
 * for the user's avatar. This prevents deletion of DiceBear, external, or default assets.
 */
export function isStorageAvatarPath(photoURL: any, userId: string): boolean {
  if (!photoURL || typeof photoURL !== 'string') return false;
  if (photoURL === 'null' || photoURL === 'undefined') return false;
  
  // Explicitly exclude DiceBear URLs, external URLs, default assets
  if (photoURL.includes('dicebear.com') || photoURL.includes('api.dicebear.com')) return false;
  if (photoURL.startsWith('/') || photoURL.startsWith('assets/') || photoURL.startsWith('images/')) return false;
  if (photoURL.startsWith('data:')) return false;
  
  try {
    const decoded = decodeURIComponent(photoURL);
    
    // 1. Must contain firebasestorage.googleapis.com
    const isStorageDomain = decoded.includes('firebasestorage.googleapis.com');
    if (!isStorageDomain) return false;
    
    // 2. Must contain /o/ and verify the path part starts with users/{userId}/avatar/
    const oIndex = decoded.indexOf('/o/');
    if (oIndex === -1) return false;
    
    const pathAndQuery = decoded.substring(oIndex + 3);
    const qIndex = pathAndQuery.indexOf('?');
    const filePath = qIndex !== -1 ? pathAndQuery.substring(0, qIndex) : pathAndQuery;
    
    return filePath.startsWith(`users/${userId}/avatar/`);
  } catch (e) {
    return false;
  }
}


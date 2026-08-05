/**
 * Storage Migration Helper for Activa Rebranding
 * Reads from new key if present. If missing, checks legacy key, copies value to new key,
 * and removes legacy key for seamless data preservation.
 */

function getStorage(storageType: 'local' | 'session'): Storage | null {
  if (typeof window !== 'undefined') {
    const winStorage = storageType === 'local' ? window.localStorage : window.sessionStorage;
    if (winStorage) return winStorage;
  }
  const glob = globalThis as any;
  if (glob) {
    const globStorage = storageType === 'local' ? glob.localStorage : glob.sessionStorage;
    if (globStorage) return globStorage;
  }
  return null;
}

export function getMigratedItem(newKey: string, oldKey: string, storageType: 'local' | 'session' = 'local'): string | null {
  const storage = getStorage(storageType);
  if (!storage) return null;
  
  try {
    const newValue = storage.getItem(newKey);
    // Requirement 7: New key ALWAYS takes precedence
    if (newValue !== null) {
      return newValue;
    }
    
    const oldValue = storage.getItem(oldKey);
    if (oldValue !== null) {
      try {
        // Requirement 8: Copy to new key, keep old key for rollback compatibility
        storage.setItem(newKey, oldValue);
      } catch (e) {
        // Ignore write errors if storage is restricted
      }
      return oldValue;
    }
  } catch (error) {
    console.warn(`[ACTIVA MIGRATION] Error reading key ${oldKey} / ${newKey}:`, error);
  }
  
  return null;
}

export function setMigratedItem(newKey: string, oldKey: string, value: string, storageType: 'local' | 'session' = 'local'): void {
  const storage = getStorage(storageType);
  if (!storage) return;
  
  storage.setItem(newKey, value);
  try {
    // Requirement 8: Keep old key in sync for rollback compatibility in first release
    storage.setItem(oldKey, value);
  } catch (e) {
    // Ignore legacy sync errors
  }
}

export function removeMigratedItem(newKey: string, oldKey: string, storageType: 'local' | 'session' = 'local'): void {
  const storage = getStorage(storageType);
  if (!storage) return;
  
  try {
    storage.removeItem(newKey);
  } catch (e) {}
  try {
    storage.removeItem(oldKey);
  } catch (e) {}
}

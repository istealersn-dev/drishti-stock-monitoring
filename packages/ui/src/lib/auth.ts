const STORAGE_KEY = "drishti:key";

/**
 * Retrieve the stored access key.
 * @returns The stored key, or null if not set
 */
export function getStoredKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Persist the access key to localStorage.
 * @param key - The validated access key
 */
export function storeKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

/**
 * Clear the stored access key (logout).
 */
export function clearKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Returns true if an access key is stored.
 * @returns Whether the user is authenticated
 */
export function isAuthenticated(): boolean {
  return getStoredKey() !== null;
}

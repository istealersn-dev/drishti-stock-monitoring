import { useNavigate } from "@tanstack/react-router";

const STORAGE_KEY = "drishti:key";

/**
 * Retrieve the stored access key from localStorage or sessionStorage.
 * @returns The stored key, or null if not set in either
 */
export function getStoredKey(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
}

/**
 * Persist the access key.
 * @param key - The validated access key
 * @param persist - true = localStorage (survives browser restart), false = sessionStorage
 */
export function storeKey(key: string, persist: boolean): void {
  if (persist) {
    localStorage.setItem(STORAGE_KEY, key);
  } else {
    sessionStorage.setItem(STORAGE_KEY, key);
  }
}

/**
 * Clear the stored access key from both storages (logout).
 */
export function clearKey(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Returns true if an access key is stored in either storage.
 * @returns Whether the user is authenticated
 */
export function isAuthenticated(): boolean {
  return getStoredKey() !== null;
}

/**
 * Logout action shared by every entry point (Sidebar's "Log out", Settings'
 * "Sign out") so the sequence — clear the key, redirect to /login — can't
 * drift between call sites if it ever needs a third step.
 * @returns a function that clears the stored key and navigates to /login
 */
export function useLogout(): () => void {
  const navigate = useNavigate();
  return (): void => {
    clearKey();
    void navigate({ to: "/login" });
  };
}

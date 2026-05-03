import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Firestore sometimes stores a single country as a string; the UI expects an array. */
export function normalizeServiceCountriesToArray(serviceCountries: unknown): string[] {
  if (Array.isArray(serviceCountries)) {
    return serviceCountries.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof serviceCountries === "string" && serviceCountries.trim()) {
    return [serviceCountries.trim()];
  }
  return [];
}

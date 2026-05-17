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

/** Converts a string to Title Case (e.g. "cordon pharma eu" -> "Cordon Pharma Eu") */
export function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

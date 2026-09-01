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

/** Format event location to City, State / Region, or "Virtual" if online/virtual/empty */
export function formatEventLocation(city?: string | null, stateRegion?: string | null): string {
  const rawCity = (city || "").trim();
  const rawState = (stateRegion || "").trim();

  const isVirtualCity = /^(virtual|online|remote|webinar|n\/a)$/i.test(rawCity);
  const isVirtualState = /^(virtual|online|remote|webinar|n\/a)$/i.test(rawState);

  // If both are virtual/online/empty or one is virtual and other is empty
  if ((isVirtualCity && isVirtualState) || (isVirtualCity && !rawState) || (isVirtualState && !rawCity) || (!rawCity && !rawState)) {
    return "Virtual";
  }

  // If city is virtual but state is a location (or vice versa)
  if (isVirtualCity && rawState) return toTitleCase(rawState);
  if (isVirtualState && rawCity) return toTitleCase(rawCity);

  // If both are identical (e.g. "Virtual, Virtual" or "Boston, Boston")
  if (rawCity.toLowerCase() === rawState.toLowerCase()) {
    return isVirtualCity ? "Virtual" : toTitleCase(rawCity);
  }

  return [toTitleCase(rawCity), toTitleCase(rawState)].filter(Boolean).join(", ");
}

/** Format job location to City, State / Region, or "Remote" if remote/virtual/empty */
export function formatJobLocation(city?: string | null, stateRegion?: string | null): string {
  const rawCity = (city || "").trim();
  const rawState = (stateRegion || "").trim();

  const isRemoteCity = /^(remote|virtual|online|n\/a)$/i.test(rawCity);
  const isRemoteState = /^(remote|virtual|online|n\/a)$/i.test(rawState);

  if ((isRemoteCity && isRemoteState) || (isRemoteCity && !rawState) || (isRemoteState && !rawCity) || (!rawCity && !rawState)) {
    return "Remote";
  }
  if (isRemoteCity && rawState) return toTitleCase(rawState);
  if (isRemoteState && rawCity) return toTitleCase(rawCity);
  if (rawCity.toLowerCase() === rawState.toLowerCase()) {
    return isRemoteCity ? "Remote" : toTitleCase(rawCity);
  }

  return [toTitleCase(rawCity), toTitleCase(rawState)].filter(Boolean).join(", ");
}

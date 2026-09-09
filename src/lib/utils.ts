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

/** Format event location to City, State / Region, Country, or "Virtual" if online/virtual/empty */
export function formatEventLocation(city?: string | null, stateRegion?: string | null, country?: string | null): string {
  const rawCity = (city || "").trim();
  const rawState = (stateRegion || "").trim();
  const rawCountry = (country || "").trim();

  const isVirtualCity = /^(virtual|online|remote|webinar|n\/a)$/i.test(rawCity);
  const isVirtualState = /^(virtual|online|remote|webinar|n\/a)$/i.test(rawState);
  const isVirtualCountry = /^(virtual|online|remote|webinar|n\/a)$/i.test(rawCountry);

  const hasRealCity = rawCity && !isVirtualCity;
  const hasRealState = rawState && !isVirtualState;
  const hasRealCountry = rawCountry && !isVirtualCountry;

  if (!hasRealCity && !hasRealState && !hasRealCountry) {
    return "Virtual";
  }

  const parts: string[] = [];
  if (hasRealCity) {
    parts.push(toTitleCase(rawCity));
  }
  if (hasRealState && rawState.toLowerCase() !== rawCity.toLowerCase()) {
    parts.push(toTitleCase(rawState));
  }
  if (hasRealCountry && rawCountry.toLowerCase() !== rawState.toLowerCase() && rawCountry.toLowerCase() !== rawCity.toLowerCase()) {
    parts.push(toTitleCase(rawCountry));
  }

  return parts.length > 0 ? parts.join(", ") : "Virtual";
}

/** Format job location to City, State / Region, Country, or "Remote" if remote/virtual/empty */
export function formatJobLocation(city?: string | null, stateRegion?: string | null, country?: string | null): string {
  const rawCity = (city || "").trim();
  const rawState = (stateRegion || "").trim();
  const rawCountry = (country || "").trim();

  const isRemoteCity = /^(remote|virtual|online|n\/a)$/i.test(rawCity);
  const isRemoteState = /^(remote|virtual|online|n\/a)$/i.test(rawState);
  const isRemoteCountry = /^(remote|virtual|online|n\/a)$/i.test(rawCountry);

  const hasRealCity = rawCity && !isRemoteCity;
  const hasRealState = rawState && !isRemoteState;
  const hasRealCountry = rawCountry && !isRemoteCountry;

  if (!hasRealCity && !hasRealState && !hasRealCountry) {
    return "Remote";
  }

  const parts: string[] = [];
  if (hasRealCity) {
    parts.push(toTitleCase(rawCity));
  }
  if (hasRealState && rawState.toLowerCase() !== rawCity.toLowerCase()) {
    parts.push(toTitleCase(rawState));
  }
  if (hasRealCountry && rawCountry.toLowerCase() !== rawState.toLowerCase() && rawCountry.toLowerCase() !== rawCity.toLowerCase()) {
    parts.push(toTitleCase(rawCountry));
  }

  return parts.length > 0 ? parts.join(", ") : "Remote";
}

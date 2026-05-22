import { REGION_COUNTRY_MAP } from "@/constants/regions";

/** Flat sorted country list for community pickers and filters. */
export function getAllCommunityCountries(): string[] {
  const set = new Set<string>();
  Object.values(REGION_COUNTRY_MAP).forEach((countries) => {
    countries.forEach((c) => set.add(c));
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";

export type SavedCommunityFilters = {
  countries: string[];
  filterKeys: string[];
};

export function parseSavedFilters(data: Record<string, unknown> | undefined): SavedCommunityFilters {
  const countries = Array.isArray(data?.savedFilterCountries)
    ? (data.savedFilterCountries as string[]).filter((c) => typeof c === "string" && c.trim())
    : [];
  const filterKeys = Array.isArray(data?.savedFilterKeys)
    ? (data.savedFilterKeys as string[]).filter((k) => typeof k === "string" && k.trim())
    : [];
  return { countries, filterKeys };
}

export async function saveCommunityFilters(userId: string, filters: SavedCommunityFilters) {
  await updateDoc(doc(db, "membersCollection", userId), {
    savedFilterCountries: filters.countries,
    savedFilterKeys: filters.filterKeys,
  });
}

/** Human-readable label for a filter key (main:/sub:/ss:). */
export function filterKeyToLabel(
  key: string,
  categoryDoc: { mains?: Array<{ label: string; subs?: Array<{ label: string; subSubs?: Array<{ label: string }> }> }> } | null,
): string {
  if (key.startsWith("main:")) return key.slice(5);
  if (key.startsWith("sub:")) {
    const rest = key.slice(4);
    const i = rest.indexOf(":");
    if (i < 0) return rest;
    const sub = rest.slice(i + 1);
    const main = rest.slice(0, i);
    return `${sub} (${main})`;
  }
  if (key.startsWith("ss:")) {
    const rest = key.slice(3);
    const i = rest.indexOf(":");
    if (i < 0) return rest;
    const ss = rest.slice(i + 1);
    const main = rest.slice(0, i);
    if (categoryDoc?.mains) {
      for (const m of categoryDoc.mains) {
        if (m.label !== main) continue;
        for (const s of m.subs ?? []) {
          if (s.subSubs?.some((x) => x.label === ss)) return `${ss} (${main})`;
        }
      }
    }
    return `${ss} (${main})`;
  }
  return key;
}

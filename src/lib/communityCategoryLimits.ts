import type { CommunityCategoryDoc, CommunitySub } from "./communityTypes";
import {
  POST_MAIN_CAT_MAX,
  POST_SUB_PER_MAIN_MAX,
  POST_SUBSUB_PER_SUB_MAX,
} from "./community";

/** Distinct main labels with any main / sub / sub-sub filter key selected. */
export function activeMainLabelsFromFilterKeys(keys: string[]): Set<string> {
  const set = new Set<string>();
  for (const k of keys) {
    if (k.startsWith("main:")) {
      set.add(k.slice(5));
    } else if (k.startsWith("sub:")) {
      const rest = k.slice(4);
      const colon = rest.indexOf(":");
      if (colon >= 0) set.add(rest.slice(0, colon));
    } else if (k.startsWith("ss:")) {
      const rest = k.slice(3);
      const colon = rest.indexOf(":");
      if (colon >= 0) set.add(rest.slice(0, colon));
    }
  }
  return set;
}

/** Subs under a main that are selected via `sub:` key or any of their `ss:` keys. */
export function activeSubLabelsForMainFilterKeys(
  keys: string[],
  mainLabel: string,
  mainSubs: CommunitySub[] = [],
): Set<string> {
  const set = new Set<string>();
  const prefix = `sub:${mainLabel}:`;
  for (const k of keys) {
    if (k.startsWith(prefix)) set.add(k.slice(prefix.length));
  }
  for (const sub of mainSubs) {
    for (const ss of sub.subSubs ?? []) {
      if (keys.includes(`ss:${mainLabel}:${ss.label}`)) {
        set.add(sub.label);
        break;
      }
    }
  }
  return set;
}

export function countSubsForMainFilterKeys(
  keys: string[],
  mainLabel: string,
  mainSubs: CommunitySub[] = [],
): number {
  return activeSubLabelsForMainFilterKeys(keys, mainLabel, mainSubs).size;
}

export function countSubSubsForSubFilterKeys(
  keys: string[],
  mainLabel: string,
  sub: CommunitySub,
): number {
  return (sub.subSubs ?? []).filter((ss) => keys.includes(`ss:${mainLabel}:${ss.label}`)).length;
}

export function isMainActiveInFilterKeys(keys: string[], mainLabel: string): boolean {
  return activeMainLabelsFromFilterKeys(keys).has(mainLabel);
}

export function canEnableMainFilterKey(keys: string[], mainLabel: string): boolean {
  if (isMainActiveInFilterKeys(keys, mainLabel)) return true;
  return activeMainLabelsFromFilterKeys(keys).size < POST_MAIN_CAT_MAX;
}

export function canEnableSubFilterKey(
  keys: string[],
  mainLabel: string,
  subLabel: string,
  mainSubs: CommunitySub[] = [],
): boolean {
  const subKey = `sub:${mainLabel}:${subLabel}`;
  const already =
    keys.includes(subKey) ||
    activeSubLabelsForMainFilterKeys(keys, mainLabel, mainSubs).has(subLabel);
  if (already) return true;
  if (!isMainActiveInFilterKeys(keys, mainLabel) && activeMainLabelsFromFilterKeys(keys).size >= POST_MAIN_CAT_MAX) {
    return false;
  }
  return countSubsForMainFilterKeys(keys, mainLabel, mainSubs) < POST_SUB_PER_MAIN_MAX;
}

export function canEnableSubSubFilterKey(
  keys: string[],
  mainLabel: string,
  sub: CommunitySub,
  subSubLabel: string,
  mainSubs: CommunitySub[] = [],
): boolean {
  const ssKey = `ss:${mainLabel}:${subSubLabel}`;
  if (keys.includes(ssKey)) return true;
  if (!canEnableSubFilterKey(keys, mainLabel, sub.label, mainSubs)) return false;
  return countSubSubsForSubFilterKeys(keys, mainLabel, sub) < POST_SUBSUB_PER_SUB_MAX;
}

export function categoryLimitHelpText(): string {
  return `Up to ${POST_MAIN_CAT_MAX} main categories, ${POST_SUB_PER_MAIN_MAX} sub-categories per main, and ${POST_SUBSUB_PER_SUB_MAX} sub-sub-categories per sub when available.`;
}

export function filterLimitBlockReason(
  keys: string[],
  kind: "main" | "sub" | "subsub",
  mainLabel: string,
  opts?: {
    subLabel?: string;
    subSubLabel?: string;
    sub?: CommunitySub;
    mainSubs?: CommunitySub[];
  },
): string | null {
  const mainSubs = opts?.mainSubs ?? [];
  if (kind === "main") {
    if (canEnableMainFilterKey(keys, mainLabel)) return null;
    return `You can select at most ${POST_MAIN_CAT_MAX} main categories. Uncheck one to choose another.`;
  }
  if (kind === "sub") {
    const subLabel = opts?.subLabel || "";
    if (canEnableSubFilterKey(keys, mainLabel, subLabel, mainSubs)) return null;
    if (!isMainActiveInFilterKeys(keys, mainLabel) && activeMainLabelsFromFilterKeys(keys).size >= POST_MAIN_CAT_MAX) {
      return `You can select at most ${POST_MAIN_CAT_MAX} main categories. Uncheck one to choose another.`;
    }
    return `You can select at most ${POST_SUB_PER_MAIN_MAX} sub-categories under “${mainLabel}”.`;
  }
  const sub = opts?.sub;
  if (!sub) return "Invalid sub-category.";
  const subSubLabel = opts?.subSubLabel || "";
  if (canEnableSubSubFilterKey(keys, mainLabel, sub, subSubLabel, mainSubs)) return null;
  if (!canEnableSubFilterKey(keys, mainLabel, sub.label, mainSubs)) {
    return filterLimitBlockReason(keys, "sub", mainLabel, { subLabel: sub.label, mainSubs });
  }
  return `You can select at most ${POST_SUBSUB_PER_SUB_MAX} sub-sub-categories under “${sub.label}”.`;
}

export function summarizeFilterSelection(doc: CommunityCategoryDoc, keys: string[]): string {
  const mains = activeMainLabelsFromFilterKeys(keys).size;
  return `${mains}/${POST_MAIN_CAT_MAX} main · up to ${POST_SUB_PER_MAIN_MAX} subs each · up to ${POST_SUBSUB_PER_SUB_MAX} sub-subs each`;
}

export function countActiveMainsInPicker(subsByMain: Map<string, Set<string>>): number {
  let n = 0;
  for (const subs of subsByMain.values()) {
    if (subs && subs.size > 0) n += 1;
  }
  return n;
}

export function canActivateMainInPicker(
  subsByMain: Map<string, Set<string>>,
  mainLabel: string,
): boolean {
  const existing = subsByMain.get(mainLabel);
  if (existing && existing.size > 0) return true;
  return countActiveMainsInPicker(subsByMain) < POST_MAIN_CAT_MAX;
}

export function canAddSubInPicker(
  subsByMain: Map<string, Set<string>>,
  mainLabel: string,
  subLabel: string,
): boolean {
  const subs = subsByMain.get(mainLabel);
  if (subs?.has(subLabel)) return true;
  if (!canActivateMainInPicker(subsByMain, mainLabel)) return false;
  const realSubs = subs ? [...subs].filter((x) => x !== "__main_only__").length : 0;
  return realSubs < POST_SUB_PER_MAIN_MAX;
}

export function canAddSubSubInPicker(
  subsByMain: Map<string, Set<string>>,
  subSubsByMainSub: Map<string, Set<string>>,
  mainLabel: string,
  subLabel: string,
  subSubLabel: string,
): boolean {
  const msKey = `${mainLabel}|||${subLabel}`;
  const picked = subSubsByMainSub.get(msKey);
  if (picked?.has(subSubLabel)) return true;
  if (!canAddSubInPicker(subsByMain, mainLabel, subLabel)) return false;
  return (picked?.size ?? 0) < POST_SUBSUB_PER_SUB_MAX;
}

export function pickerLimitBlockReason(
  kind: "main" | "sub" | "subsub",
  subsByMain: Map<string, Set<string>>,
  subSubsByMainSub: Map<string, Set<string>>,
  mainLabel: string,
  opts?: { subLabel?: string; subSubLabel?: string },
): string | null {
  if (kind === "main") {
    if (canActivateMainInPicker(subsByMain, mainLabel)) return null;
    return `You can select at most ${POST_MAIN_CAT_MAX} main categories. Uncheck one to choose another.`;
  }
  if (kind === "sub") {
    const subLabel = opts?.subLabel || "";
    if (canAddSubInPicker(subsByMain, mainLabel, subLabel)) return null;
    if (!canActivateMainInPicker(subsByMain, mainLabel)) {
      return `You can select at most ${POST_MAIN_CAT_MAX} main categories. Uncheck one to choose another.`;
    }
    return `You can select at most ${POST_SUB_PER_MAIN_MAX} sub-categories under “${mainLabel}”.`;
  }
  const subLabel = opts?.subLabel || "";
  const subSubLabel = opts?.subSubLabel || "";
  if (canAddSubSubInPicker(subsByMain, subSubsByMainSub, mainLabel, subLabel, subSubLabel)) return null;
  if (!canAddSubInPicker(subsByMain, mainLabel, subLabel)) {
    return pickerLimitBlockReason("sub", subsByMain, subSubsByMainSub, mainLabel, { subLabel });
  }
  return `You can select at most ${POST_SUBSUB_PER_SUB_MAX} sub-sub-categories under “${subLabel}”.`;
}

export function summarizePickerSelection(doc: CommunityCategoryDoc, subsByMain: Map<string, Set<string>>): string {
  const mains = countActiveMainsInPicker(subsByMain);
  return `${mains}/${POST_MAIN_CAT_MAX} main · up to ${POST_SUB_PER_MAIN_MAX} subs each · up to ${POST_SUBSUB_PER_SUB_MAX} sub-subs each`;
}

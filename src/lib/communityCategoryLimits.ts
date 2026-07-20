import type { CommunityCategoryDoc, CommunitySub } from "./communityTypes";
import {
  POST_MAIN_CAT_MAX,
  POST_SUB_PER_MAIN_MAX,
  POST_SUBSUB_PER_SUB_MAX,
} from "./community";

function knownMainLabelSet(doc?: CommunityCategoryDoc): Set<string> | null {
  if (!doc?.mains?.length) return null;
  return new Set(doc.mains.map((m) => m.label));
}

/** Distinct main labels with any main / sub / sub-sub filter key selected. */
export function activeMainLabelsFromFilterKeys(
  keys: string[],
  doc?: CommunityCategoryDoc,
): Set<string> {
  const known = knownMainLabelSet(doc);
  const set = new Set<string>();
  for (const k of keys) {
    let label: string | null = null;
    if (k.startsWith("main:")) {
      label = k.slice(5);
    } else if (k.startsWith("sub:")) {
      const rest = k.slice(4);
      const colon = rest.indexOf(":");
      if (colon >= 0) label = rest.slice(0, colon);
    } else if (k.startsWith("ss:")) {
      const rest = k.slice(3);
      const colon = rest.indexOf(":");
      if (colon >= 0) label = rest.slice(0, colon);
    }
    if (!label) continue;
    // Only count labels that are real mains when the tree is available.
    // Prevents a mis-parsed sub/sub-sub key from consuming a main slot.
    if (known && !known.has(label)) continue;
    set.add(label);
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

export function isMainActiveInFilterKeys(
  keys: string[],
  mainLabel: string,
  doc?: CommunityCategoryDoc,
): boolean {
  return activeMainLabelsFromFilterKeys(keys, doc).has(mainLabel);
}

export function canEnableMainFilterKey(
  keys: string[],
  mainLabel: string,
  doc?: CommunityCategoryDoc,
): boolean {
  if (isMainActiveInFilterKeys(keys, mainLabel, doc)) return true;
  return activeMainLabelsFromFilterKeys(keys, doc).size < POST_MAIN_CAT_MAX;
}

export function canEnableSubFilterKey(
  keys: string[],
  mainLabel: string,
  subLabel: string,
  mainSubs: CommunitySub[] = [],
  doc?: CommunityCategoryDoc,
): boolean {
  const subKey = `sub:${mainLabel}:${subLabel}`;
  const already =
    keys.includes(subKey) ||
    activeSubLabelsForMainFilterKeys(keys, mainLabel, mainSubs).has(subLabel);
  if (already) return true;
  if (
    !isMainActiveInFilterKeys(keys, mainLabel, doc) &&
    activeMainLabelsFromFilterKeys(keys, doc).size >= POST_MAIN_CAT_MAX
  ) {
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
  doc?: CommunityCategoryDoc,
): boolean {
  const ssKey = `ss:${mainLabel}:${subSubLabel}`;
  if (keys.includes(ssKey)) return true;
  if (!canEnableSubFilterKey(keys, mainLabel, sub.label, mainSubs, doc)) return false;
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
    doc?: CommunityCategoryDoc;
  },
): string | null {
  const mainSubs = opts?.mainSubs ?? [];
  const doc = opts?.doc;
  if (kind === "main") {
    if (canEnableMainFilterKey(keys, mainLabel, doc)) return null;
    return `You can select at most ${POST_MAIN_CAT_MAX} main categories. Uncheck one to choose another.`;
  }
  if (kind === "sub") {
    const subLabel = opts?.subLabel || "";
    if (canEnableSubFilterKey(keys, mainLabel, subLabel, mainSubs, doc)) return null;
    if (
      !isMainActiveInFilterKeys(keys, mainLabel, doc) &&
      activeMainLabelsFromFilterKeys(keys, doc).size >= POST_MAIN_CAT_MAX
    ) {
      return `You can select at most ${POST_MAIN_CAT_MAX} main categories. Uncheck one to choose another.`;
    }
    return `You can select at most ${POST_SUB_PER_MAIN_MAX} sub-categories under “${mainLabel}”.`;
  }
  const sub = opts?.sub;
  if (!sub) return "Invalid sub-category.";
  const subSubLabel = opts?.subSubLabel || "";
  if (canEnableSubSubFilterKey(keys, mainLabel, sub, subSubLabel, mainSubs, doc)) return null;
  if (!canEnableSubFilterKey(keys, mainLabel, sub.label, mainSubs, doc)) {
    return filterLimitBlockReason(keys, "sub", mainLabel, { subLabel: sub.label, mainSubs, doc });
  }
  return `You can select at most ${POST_SUBSUB_PER_SUB_MAX} sub-sub-categories under “${sub.label}”.`;
}

export function summarizeFilterSelection(doc: CommunityCategoryDoc, keys: string[]): string {
  const mains = [...activeMainLabelsFromFilterKeys(keys, doc)];
  if (mains.length === 0) {
    return `0/${POST_MAIN_CAT_MAX} mains selected`;
  }
  const parts = mains.map((mainLabel) => {
    const main = doc.mains.find((m) => m.label === mainLabel);
    const subs = activeSubLabelsForMainFilterKeys(keys, mainLabel, main?.subs ?? []);
    let ssCount = 0;
    for (const sub of main?.subs ?? []) {
      if (!subs.has(sub.label)) continue;
      ssCount += countSubSubsForSubFilterKeys(keys, mainLabel, sub);
    }
    const detail =
      subs.size === 0
        ? "whole main"
        : `${subs.size} sub${subs.size === 1 ? "" : "s"}${ssCount ? `, ${ssCount} sub-sub${ssCount === 1 ? "" : "s"}` : ""}`;
    return `${mainLabel} (${detail})`;
  });
  return `${mains.length}/${POST_MAIN_CAT_MAX} mains: ${parts.join("; ")}`;
}

/** Active main labels in the post picker (only labels that exist on the category tree). */
export function activeMainLabelsInPicker(
  doc: CommunityCategoryDoc,
  subsByMain: Map<string, Set<string>>,
): string[] {
  const out: string[] = [];
  for (const main of doc.mains) {
    const subs = subsByMain.get(main.label);
    if (subs && subs.size > 0) out.push(main.label);
  }
  return out;
}

export function countActiveMainsInPicker(
  subsByMain: Map<string, Set<string>>,
  doc?: CommunityCategoryDoc,
): number {
  if (doc) return activeMainLabelsInPicker(doc, subsByMain).length;
  let n = 0;
  for (const subs of subsByMain.values()) {
    if (subs && subs.size > 0) n += 1;
  }
  return n;
}

export function canActivateMainInPicker(
  subsByMain: Map<string, Set<string>>,
  mainLabel: string,
  doc?: CommunityCategoryDoc,
): boolean {
  const existing = subsByMain.get(mainLabel);
  if (existing && existing.size > 0) return true;
  return countActiveMainsInPicker(subsByMain, doc) < POST_MAIN_CAT_MAX;
}

export function canAddSubInPicker(
  subsByMain: Map<string, Set<string>>,
  mainLabel: string,
  subLabel: string,
  doc?: CommunityCategoryDoc,
): boolean {
  const subs = subsByMain.get(mainLabel);
  if (subs?.has(subLabel)) return true;
  if (!canActivateMainInPicker(subsByMain, mainLabel, doc)) return false;
  const realSubs = subs ? [...subs].filter((x) => x !== "__main_only__").length : 0;
  return realSubs < POST_SUB_PER_MAIN_MAX;
}

export function canAddSubSubInPicker(
  subsByMain: Map<string, Set<string>>,
  subSubsByMainSub: Map<string, Set<string>>,
  mainLabel: string,
  subLabel: string,
  subSubLabel: string,
  doc?: CommunityCategoryDoc,
): boolean {
  const msKey = `${mainLabel}|||${subLabel}`;
  const picked = subSubsByMainSub.get(msKey);
  if (picked?.has(subSubLabel)) return true;
  if (!canAddSubInPicker(subsByMain, mainLabel, subLabel, doc)) return false;
  return (picked?.size ?? 0) < POST_SUBSUB_PER_SUB_MAX;
}

export function pickerLimitBlockReason(
  kind: "main" | "sub" | "subsub",
  subsByMain: Map<string, Set<string>>,
  subSubsByMainSub: Map<string, Set<string>>,
  mainLabel: string,
  opts?: { subLabel?: string; subSubLabel?: string; doc?: CommunityCategoryDoc },
): string | null {
  const doc = opts?.doc;
  if (kind === "main") {
    if (canActivateMainInPicker(subsByMain, mainLabel, doc)) return null;
    return `You can select at most ${POST_MAIN_CAT_MAX} main categories. Uncheck one to choose another.`;
  }
  if (kind === "sub") {
    const subLabel = opts?.subLabel || "";
    if (canAddSubInPicker(subsByMain, mainLabel, subLabel, doc)) return null;
    if (!canActivateMainInPicker(subsByMain, mainLabel, doc)) {
      return `You can select at most ${POST_MAIN_CAT_MAX} main categories. Uncheck one to choose another.`;
    }
    return `You can select at most ${POST_SUB_PER_MAIN_MAX} sub-categories under “${mainLabel}”.`;
  }
  const subLabel = opts?.subLabel || "";
  const subSubLabel = opts?.subSubLabel || "";
  if (canAddSubSubInPicker(subsByMain, subSubsByMainSub, mainLabel, subLabel, subSubLabel, doc)) {
    return null;
  }
  if (!canAddSubInPicker(subsByMain, mainLabel, subLabel, doc)) {
    return pickerLimitBlockReason("sub", subsByMain, subSubsByMainSub, mainLabel, { subLabel, doc });
  }
  return `You can select at most ${POST_SUBSUB_PER_SUB_MAX} sub-sub-categories under “${subLabel}”.`;
}

export function summarizePickerSelection(
  doc: CommunityCategoryDoc,
  subsByMain: Map<string, Set<string>>,
  subSubsByMainSub: Map<string, Set<string>> = new Map(),
): string {
  const mains = activeMainLabelsInPicker(doc, subsByMain);
  if (mains.length === 0) {
    return `0/${POST_MAIN_CAT_MAX} mains selected`;
  }
  const parts = mains.map((mainLabel) => {
    const subs = subsByMain.get(mainLabel) ?? new Set<string>();
    const realSubs = [...subs].filter((x) => x !== "__main_only__");
    if (realSubs.length === 0) return `${mainLabel} (whole main)`;
    let ssCount = 0;
    for (const subLabel of realSubs) {
      ssCount += subSubsByMainSub.get(`${mainLabel}|||${subLabel}`)?.size ?? 0;
    }
    return `${mainLabel} (${realSubs.length} sub${realSubs.length === 1 ? "" : "s"}${
      ssCount ? `, ${ssCount} sub-sub${ssCount === 1 ? "" : "s"}` : ""
    })`;
  });
  return `${mains.length}/${POST_MAIN_CAT_MAX} mains: ${parts.join("; ")}`;
}

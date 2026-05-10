import type { CommunityCategoryDoc, CommunityMain, CommunitySub, CommunitySubSub } from "./communityTypes";

export function slugifyCategoryId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.slice(0, 64) || "category";
}

function newNodeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export function createEmptyMain(): CommunityMain {
  return {
    id: newNodeId("main"),
    label: "",
    subs: [],
  };
}

export function createEmptySub(): CommunitySub {
  return {
    id: newNodeId("sub"),
    label: "",
    subSubs: [],
  };
}

export function createEmptySubSub(): CommunitySubSub {
  return {
    id: newNodeId("subsub"),
    label: "",
  };
}

/** Normalize Firestore / loose JSON into a strict in-memory shape. */
export function ensureCommunityCategoryDoc(raw: unknown): CommunityCategoryDoc {
  const obj = raw as CommunityCategoryDoc | null | undefined;
  const mains = Array.isArray(obj?.mains) ? obj.mains : [];
  return {
    mains: mains.map((m) => ({
      id: String(m?.id ?? "").trim(),
      label: String(m?.label ?? "").trim(),
      subs: Array.isArray(m?.subs)
        ? m.subs.map((s) => ({
            id: String(s?.id ?? "").trim(),
            label: String(s?.label ?? "").trim(),
            subSubs: Array.isArray(s?.subSubs)
              ? s.subSubs.map((ss) => ({
                  id: String(ss?.id ?? "").trim(),
                  label: String(ss?.label ?? "").trim(),
                }))
              : [],
          }))
        : [],
    })),
  };
}

export function validateCommunityCategoryDoc(doc: CommunityCategoryDoc): string | null {
  if (!doc.mains?.length) return "Add at least one main category.";
  const mainIds = new Set<string>();
  for (const m of doc.mains) {
    if (!m.label?.trim()) return "Every main category needs a display label.";
    if (!m.id?.trim()) return `Main category "${m.label || "(unnamed)"}" needs an id (internal key).`;
    if (mainIds.has(m.id)) return `Duplicate main category id: ${m.id}`;
    mainIds.add(m.id);
    const subIds = new Set<string>();
    for (const s of m.subs ?? []) {
      if (!s.label?.trim())
        return `A sub-category under "${m.label}" needs a display label.`;
      if (!s.id?.trim())
        return `Sub-category "${s.label || "(unnamed)"}" under "${m.label}" needs an id.`;
      if (subIds.has(s.id)) return `Duplicate sub-category id "${s.id}" under "${m.label}".`;
      subIds.add(s.id);
      const ssIds = new Set<string>();
      for (const ss of s.subSubs ?? []) {
        if (!ss.label?.trim())
          return `A sub-sub category under "${m.label}" → "${s.label}" needs a label.`;
        if (!ss.id?.trim())
          return `Sub-sub "${ss.label || "(unnamed)"}" needs an id.`;
        if (ssIds.has(ss.id))
          return `Duplicate sub-sub id "${ss.id}" under "${m.label}" → "${s.label}".`;
        ssIds.add(ss.id);
      }
    }
  }
  return null;
}

/** Trim strings; ensure `subs` / `subSubs` arrays exist for Firestore. */
export function normalizeForFirestore(doc: CommunityCategoryDoc): CommunityCategoryDoc {
  return {
    mains: doc.mains.map((m) => ({
      id: m.id.trim(),
      label: m.label.trim(),
      subs: (m.subs ?? []).map((s) => ({
        id: s.id.trim(),
        label: s.label.trim(),
        subSubs: (s.subSubs ?? []).map((ss) => ({
          id: ss.id.trim(),
          label: ss.label.trim(),
        })),
      })),
    })),
  };
}

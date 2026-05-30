import type { CommunityCategoryDoc } from "./communityTypes";
import { buildFilterKeys, type SelectedCategoryBranch } from "./community";

export type CategoryDisplaySegment = {
  main: string;
  bracket: string[];
};

/**
 * Display spec: main only → main; main+sub → main [sub]; main+sub+subSub → main [subSub] (sub hidden).
 */
export function formatCommunityCategorySegments(
  doc: CommunityCategoryDoc | null,
  mainLabels: string[],
  subLabels: string[],
  subSubLabels: string[],
): CategoryDisplaySegment[] {
  if (!mainLabels.length) return [];
  const mains = doc?.mains ?? [];
  const segments: CategoryDisplaySegment[] = [];

  for (const mainLabel of mainLabels) {
    const mainNode = mains.find((m) => m.label === mainLabel);
    const bracket: string[] = [];

    if (subSubLabels.length && mainNode) {
      for (const ss of subSubLabels) {
        for (const sub of mainNode.subs ?? []) {
          if (sub.subSubs?.some((x) => x.label === ss)) {
            bracket.push(ss);
          }
        }
      }
    }

    if (bracket.length === 0 && subLabels.length && mainNode) {
      for (const s of subLabels) {
        const subNode = (mainNode.subs ?? []).find((sub) => sub.label === s);
        const hasSubSubs = (subNode?.subSubs?.length ?? 0) > 0;
        if (hasSubSubs) continue;
        if (subNode) bracket.push(s);
      }
    }

    segments.push({ main: mainLabel, bracket: [...new Set(bracket)] });
  }

  return segments;
}

export function segmentsToPlainLine(segments: CategoryDisplaySegment[]): string {
  return segments
    .map((seg) => {
      const bracket = seg.bracket.length ? ` [${seg.bracket.join(", ")}]` : "";
      return `${seg.main}${bracket}`;
    })
    .join(", ");
}

/** Build all plausible filter keys from stored post category arrays (for older posts). */
export function legacyFilterKeysFromPost(post: {
  mainCategories?: string[];
  subCategories?: string[];
  subSubCategories?: string[];
}): string[] {
  const keys: string[] = [];
  const mains = post.mainCategories ?? [];
  const subs = post.subCategories ?? [];
  const subSubs = post.subSubCategories ?? [];
  for (const m of mains) {
    keys.push(`main:${m}`);
  }
  for (const s of subs) {
    for (const m of mains) {
      keys.push(`sub:${m}:${s}`);
    }
  }
  for (const ss of subSubs) {
    for (const m of mains) {
      keys.push(`ss:${m}:${ss}`);
    }
  }
  return [...new Set(keys)];
}

/** Match post filterKeys against selected filter keys (OR). Supports main / sub / sub-sub via keys or legacy post fields. */
export function postMatchesFilterKeys(
  postFilterKeys: string[] | undefined,
  selectedFilterKeys: string[],
  post?: {
    mainCategories?: string[];
    subCategories?: string[];
    subSubCategories?: string[];
  },
): boolean {
  if (selectedFilterKeys.length === 0) return true;
  const postKeys =
    postFilterKeys?.length ? postFilterKeys : post ? legacyFilterKeysFromPost(post) : [];
  const mains = post?.mainCategories ?? [];
  const subs = post?.subCategories ?? [];
  const subSubs = post?.subSubCategories ?? [];

  return selectedFilterKeys.some((fk) => {
    if (postKeys.includes(fk)) return true;

    if (fk.startsWith("main:")) {
      const main = fk.slice(5);
      return mains.includes(main);
    }
    if (fk.startsWith("sub:")) {
      const rest = fk.slice(4);
      const colon = rest.indexOf(":");
      if (colon < 0) return false;
      const main = rest.slice(0, colon);
      const sub = rest.slice(colon + 1);
      return mains.includes(main) && subs.includes(sub);
    }
    if (fk.startsWith("ss:")) {
      const rest = fk.slice(3);
      const colon = rest.indexOf(":");
      if (colon < 0) return false;
      const main = rest.slice(0, colon);
      const ss = rest.slice(colon + 1);
      return mains.includes(main) && subSubs.includes(ss);
    }
    return false;
  });
}

export { buildFilterKeys, type SelectedCategoryBranch };

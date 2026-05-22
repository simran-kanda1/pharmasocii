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

/** Build filter keys from stored post fields (for posts created before filterKeys existed). */
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
    const main = mains[0];
    if (main) keys.push(`sub:${main}:${s}`);
  }
  for (const ss of subSubs) {
    const main = mains[0];
    if (main) keys.push(`ss:${main}:${ss}`);
  }
  return keys;
}

/** Match post filterKeys against selected filter keys (OR within selection). */
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
  return selectedFilterKeys.some((fk) => postKeys.includes(fk));
}

export { buildFilterKeys, type SelectedCategoryBranch };

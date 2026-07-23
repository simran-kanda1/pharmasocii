import type { CommunityCategoryDoc, SelectedCategoryBranch } from "./communityTypes";
import { formatCommunityCategorySegments } from "./communityCategoryDisplay";

export type { SelectedCategoryBranch } from "./communityTypes";

export const POST_TITLE_MAX = 100;
export const POST_BODY_MAX = 800;
export const COMMENT_MAX = 500;
export const REPLY_MAX = 300;
export const POST_COUNTRIES_MAX = 5;
export const POST_MAIN_CAT_MIN = 1;
export const POST_MAIN_CAT_MAX = 3;
export const POST_SUB_PER_MAIN_MAX = 2;
export const POST_SUBSUB_PER_SUB_MAX = 2;
export const EXTERNAL_LINKS_MAX = 15;
export const COMMENT_EXTERNAL_LINK_MAX = 1;

/** Normalize http(s) URL; returns null if empty or invalid. */
export function normalizeExternalLink(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

export function normalizeExternalLinks(raw: string[]): string[] {
  const out: string[] = [];
  for (const line of raw) {
    const n = normalizeExternalLink(line);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= EXTERNAL_LINKS_MAX) break;
  }
  return out;
}

export function normalizeUserNameKey(userName: string): string {
  return userName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function formatRelativeTime(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (d < 30) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (d < 365) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

/** Bold main + [lowest tier labels] per display spec. */
export function formatCategoryDisplayLine(
  doc: CommunityCategoryDoc | null,
  mainLabels: string[],
  subLabels: string[],
  subSubLabels: string[],
): string {
  if (!mainLabels.length) return "";
  const mains = doc?.mains ?? [];
  const parts: string[] = [];

  for (const mainLabel of mainLabels) {
    const mainNode = mains.find((m) => m.label === mainLabel);
    const bracket: string[] = [];

    if (subSubLabels.length && mainNode) {
      for (const ss of subSubLabels) {
        for (const sub of mainNode.subs ?? []) {
          const hit = sub.subSubs?.find((x) => x.label === ss);
          if (hit) bracket.push(ss);
        }
      }
    }
    if (bracket.length === 0 && subLabels.length && mainNode) {
      for (const s of subLabels) {
        const has = (mainNode.subs ?? []).some((sub) => sub.label === s);
        if (has) bracket.push(s);
      }
    }

    const bracketStr = bracket.length ? ` [${bracket.join(", ")}]` : "";
    parts.push(`**${mainLabel}**${bracketStr}`);
  }

  return parts.join(", ");
}

/** Plain text category line for cards (no markdown). Uses display spec (main+subSub hides sub). */
export function formatCategoryPlain(
  doc: CommunityCategoryDoc | null,
  mainLabels: string[],
  subLabels: string[],
  subSubLabels: string[],
): { segments: Array<{ main: string; bracket: string[] }> } {
  return { segments: formatCommunityCategorySegments(doc, mainLabels, subLabels, subSubLabels) };
}

export function buildFilterKeys(branches: SelectedCategoryBranch[]): string[] {
  const keys: string[] = [];
  for (const b of branches) {
    keys.push(`main:${b.mainLabel}`);
    for (const s of b.subLabels ?? []) keys.push(`sub:${b.mainLabel}:${s}`);
    for (const ss of b.subSubLabels ?? []) keys.push(`ss:${b.mainLabel}:${ss}`);
  }
  return keys;
}

export function validatePostPayload(input: {
  title: string;
  text: string;
  mainCategories: string[];
  subCategories: string[];
  subSubCategories: string[];
  countries: string[];
  externalLinks: string[];
}): string | null {
  const t = input.title.trim();
  if (!t || t.length > POST_TITLE_MAX) return `Title must be 1–${POST_TITLE_MAX} characters.`;
  if (input.text.length > POST_BODY_MAX) return `Body must be at most ${POST_BODY_MAX} characters.`;
  if (input.mainCategories.length < POST_MAIN_CAT_MIN || input.mainCategories.length > POST_MAIN_CAT_MAX) {
    return `Pick ${POST_MAIN_CAT_MIN}–${POST_MAIN_CAT_MAX} main categories.`;
  }
  if (input.countries.length > POST_COUNTRIES_MAX) return `At most ${POST_COUNTRIES_MAX} countries.`;
  if (input.externalLinks.length > EXTERNAL_LINKS_MAX) return `At most ${EXTERNAL_LINKS_MAX} links.`;
  return null;
}

import type { NavigateFunction } from "react-router-dom";

const STORAGE_KEY = "pharmasocii:community-feed-scroll";

export type CommunityFeedScrollSnapshot = {
  scrollY: number;
  pathname: string;
  search: string;
  postId?: string;
};

function isCommunityFeedPath(pathname: string): boolean {
  return pathname === "/community";
}

/** Call before navigating from the feed to a post (card, comments, etc.). */
export function saveCommunityFeedScroll(postId?: string): void {
  if (typeof window === "undefined") return;
  if (!isCommunityFeedPath(window.location.pathname)) return;

  const snapshot: CommunityFeedScrollSnapshot = {
    scrollY: window.scrollY,
    pathname: window.location.pathname,
    search: window.location.search,
    postId,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekCommunityFeedScroll(): CommunityFeedScrollSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CommunityFeedScrollSnapshot;
  } catch {
    return null;
  }
}

export function clearCommunityFeedScroll(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Restore feed scroll after returning from a post; returns true if a snapshot was applied. */
export function restoreCommunityFeedScroll(): boolean {
  const snap = peekCommunityFeedScroll();
  if (!snap || !isCommunityFeedPath(window.location.pathname)) return false;

  const current = window.location.pathname + window.location.search;
  const saved = snap.pathname + snap.search;
  if (current !== saved) return false;

  clearCommunityFeedScroll();

  let attempts = 0;
  const maxAttempts = 16;
  const targetY = snap.scrollY;

  const tryScroll = () => {
    window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
    const closeEnough = Math.abs(window.scrollY - targetY) <= 2;
    const canGrow = document.documentElement.scrollHeight >= targetY + window.innerHeight * 0.25;
    if ((!closeEnough || !canGrow) && attempts < maxAttempts) {
      attempts += 1;
      requestAnimationFrame(tryScroll);
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(tryScroll));
  return true;
}

/** Back from post detail — return to saved feed URL/scroll when possible. */
export function goBackToCommunityFeed(navigate: NavigateFunction): void {
  const snap = peekCommunityFeedScroll();
  if (snap && isCommunityFeedPath(snap.pathname)) {
    navigate(`${snap.pathname}${snap.search}`);
    return;
  }
  if (typeof window !== "undefined" && window.history.length > 1) {
    navigate(-1);
    return;
  }
  navigate("/community");
}

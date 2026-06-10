/** Share text omits author usernames (LinkedIn / clipboard). */
export function buildPostShareUrl(postId: string): string {
  if (typeof window === "undefined") return `/community/post/${postId}`;
  return `${window.location.origin}/community/post/${postId}`;
}

export function buildLinkedInShareUrl(postId: string, title: string): string {
  const url = buildPostShareUrl(postId);
  const safeTitle = (title || "Pharmasocii community post").trim();
  const text = `${safeTitle}\n${url}`;
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

export async function copyPostLink(postId: string): Promise<boolean> {
  const url = buildPostShareUrl(postId);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

export function buildCommentShareUrl(postId: string, commentId: string): string {
  if (typeof window === "undefined") return `/community/post/${postId}?highlight=${commentId}`;
  return `${window.location.origin}/community/post/${postId}?highlight=${commentId}`;
}

export function buildLinkedInCommentShareUrl(postId: string, commentId: string, preview: string): string {
  const url = buildCommentShareUrl(postId, commentId);
  const text = `${(preview || "Community comment").trim().slice(0, 200)}\n${url}`;
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

export async function copyCommentLink(postId: string, commentId: string): Promise<boolean> {
  const url = buildCommentShareUrl(postId, commentId);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

export function formatPostCategoriesDisplay(
  mainCategories: string[] = [],
  subCategories: string[] = [],
  subSubCategories: string[] = [],
): string {
  if (mainCategories.length === 0) return "—";
  const parts: string[] = [];
  for (const main of mainCategories) {
    const subs = subCategories.length ? subCategories.join(", ") : "";
    const ss = subSubCategories.length ? subSubCategories.join(", ") : "";
    const bracket = [subs, ss].filter(Boolean).join("; ");
    parts.push(bracket ? `${main} [${bracket}]` : main);
  }
  return parts.join(" · ");
}

export function memberStatusLabel(status?: string, spamBlockUntil?: Date | null): string {
  if (status === "spam_blocked") {
    return spamBlockUntil
      ? `Blocked until ${spamBlockUntil.toLocaleDateString(undefined, { dateStyle: "medium" })}`
      : "Blocked";
  }
  if (status === "admin_hold") return "On hold";
  return "Active";
}

export function commentFrontEndUrl(postId: string, commentId?: string): string {
  const base = `/community/post/${postId}`;
  return commentId ? `${base}?highlight=${commentId}` : base;
}

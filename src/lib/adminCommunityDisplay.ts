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

const SPAM_BLOCK_DAYS = 30;

/** Prefer stored start; for legacy blocked members, infer from the 3rd report in the list. */
export function resolveSpamBlockStartedAt(
  member: {
    accountStatus?: string;
    spamBlockStartedAt?: { toDate: () => Date };
    spamActiveReportCount?: number;
  },
  reports: { createdAt?: { toDate: () => Date } }[],
): Date | null {
  const stored = member.spamBlockStartedAt?.toDate?.() ?? null;
  if (stored) return stored;
  if (member.accountStatus !== "spam_blocked") return null;
  if ((member.spamActiveReportCount ?? 0) < 3) return null;
  const sorted = [...reports].sort(
    (a, b) => (a.createdAt?.toDate?.()?.getTime() ?? 0) - (b.createdAt?.toDate?.()?.getTime() ?? 0),
  );
  return sorted[2]?.createdAt?.toDate?.() ?? null;
}

export function resolveSpamBlockUntil(
  member: { spamBlockUntil?: { toDate: () => Date } },
  blockStarted: Date | null,
): Date | null {
  const stored = member.spamBlockUntil?.toDate?.() ?? null;
  if (stored) return stored;
  if (!blockStarted) return null;
  const until = new Date(blockStarted.getTime());
  until.setDate(until.getDate() + SPAM_BLOCK_DAYS);
  return until;
}

export function commentFrontEndUrl(postId: string, commentId?: string): string {
  const base = `/community/post/${postId}`;
  return commentId ? `${base}?highlight=${commentId}` : base;
}

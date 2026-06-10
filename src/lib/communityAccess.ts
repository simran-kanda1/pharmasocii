/** Verified member with a community profile (includes view-only / restricted accounts). */
export function canAccessCommunity(
  user: { uid: string } | null | undefined,
  verified: boolean,
  hasMemberProfile: boolean,
): boolean {
  return Boolean(user && verified && hasMemberProfile);
}

/** Active member — can post, comment, report, share, and filter. */
export function canEngageCommunity(
  user: { uid: string } | null | undefined,
  verified: boolean,
  hasMemberProfile: boolean,
  memberRestricted: boolean,
): boolean {
  return canAccessCommunity(user, verified, hasMemberProfile) && !memberRestricted;
}

/** Save posts/comments while view-only. */
export function canSaveCommunityContent(
  user: { uid: string } | null | undefined,
  verified: boolean,
  hasMemberProfile: boolean,
): boolean {
  return canAccessCommunity(user, verified, hasMemberProfile);
}

export function communityAccessHint(
  memberRestricted: boolean,
  user: { uid: string } | null | undefined,
  verified: boolean,
  hasMemberProfile: boolean,
): string {
  if (memberRestricted) return "Your account is view-only.";
  if (!user) return "Log in with a verified member profile.";
  if (!verified) return "Verify your email first.";
  if (!hasMemberProfile) return "Create your community profile.";
  return "";
}

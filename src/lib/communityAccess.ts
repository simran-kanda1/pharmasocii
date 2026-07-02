/** Anyone can browse posts and comments (signed out or signed in). */
export function canViewCommunityContent(): boolean {
  return true;
}

/** Verified member with a community profile (includes view-only / restricted accounts). */
export function canAccessCommunity(
  user: { uid: string } | null | undefined,
  verified: boolean,
  hasMemberProfile: boolean,
): boolean {
  return Boolean(user && verified && hasMemberProfile);
}

/** Active member — can post, comment, save, helpful, report, and filter. */
export function canEngageCommunity(
  user: { uid: string } | null | undefined,
  verified: boolean,
  hasMemberProfile: boolean,
  memberRestricted: boolean,
): boolean {
  return canAccessCommunity(user, verified, hasMemberProfile) && !memberRestricted;
}

/** Public posts can be shared by anyone; members retain the same access. */
export function canShareCommunityContent(): boolean {
  return canViewCommunityContent();
}

/** Report spam — active members only. */
export function canReportCommunitySpam(
  user: { uid: string } | null | undefined,
  verified: boolean,
  hasMemberProfile: boolean,
  memberRestricted: boolean,
): boolean {
  return canEngageCommunity(user, verified, hasMemberProfile, memberRestricted);
}

/** Save posts/comments — verified members (including view-only). */
export function canSaveCommunityContent(
  user: { uid: string } | null | undefined,
  verified: boolean,
  hasMemberProfile: boolean,
  _memberRestricted: boolean,
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

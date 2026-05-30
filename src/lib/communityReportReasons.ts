/** Single-select report reasons (community post / comment). */
export const COMMUNITY_REPORT_REASONS = [
  "Spam",
  "Frequent Off Topic Content",
  "Harassment / Bullying",
  "Hate / Discrimination",
  "Violence / Threats",
  "Misinformation / Misleading Content",
  "Sexually Explicit / Exploitive Content",
  "Fraud / Illegal Activity",
  "Impersonation / Privacy Violation",
  "Other",
] as const;

export type CommunityReportReason = (typeof COMMUNITY_REPORT_REASONS)[number];

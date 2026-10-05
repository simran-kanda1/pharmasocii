/**
 * Shared status calculation helpers for admin tables and modals.
 */

export function parseTimestampMs(val: any): number | null {
  if (!val) return null;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (typeof val.toDate === "function") return val.toDate().getTime();
  if (val.seconds != null) return val.seconds * 1000;
  if (val._seconds != null) return val._seconds * 1000;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.getTime();
  if (typeof val === "number") return val > 1e12 ? val : val * 1000;
  if (typeof val === "string") {
    const t = new Date(val).getTime();
    return isNaN(t) ? null : t;
  }
  return null;
}

export function getEffectiveListingStatus(listing: any, insight?: any): string {
  if (!listing) return "Active";
  const plan = insight?.plan;

  if (listing.status === "Cancelled" || listing.status === "Canceled") {
    return "Cancelled";
  }

  // 1. Incomplete Payment / Payment Error
  const stripeStatus = String(plan?.stripeSubscriptionStatus || listing.stripeSubscriptionStatus || "").toLowerCase();
  const isPaymentFailed = 
    ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(stripeStatus) ||
    listing.paymentStatus === "failed" ||
    listing.paymentStatus === "past_due" ||
    listing.status === "Incomplete Payment" ||
    listing.status === "incomplete_payment" ||
    listing.status === "Payment Error" ||
    listing.status === "payment_error" ||
    listing.status === "past_due" ||
    Boolean(plan?.paymentError) ||
    Boolean(plan?.paymentFailed) ||
    String(plan?.status || "").toLowerCase() === "incomplete payment" ||
    String(plan?.status || "").toLowerCase() === "incomplete_payment" ||
    String(plan?.status || "").toLowerCase() === "payment_error" ||
    String(plan?.status || "").toLowerCase() === "past_due" ||
    Boolean(plan?.lastPaymentError);

  if (isPaymentFailed) {
    return "Incomplete Payment";
  }

  // 2. Cancelled
  const isCancelled =
    listing.status === "Cancelled" ||
    listing.status === "Canceled" ||
    stripeStatus === "canceled" ||
    stripeStatus === "cancelled" ||
    String(plan?.status || "").toLowerCase() === "cancelled" ||
    String(plan?.status || "").toLowerCase() === "canceled" ||
    Boolean(plan?.cancelAtPeriodEnd) ||
    insight?.cancelledOn != null ||
    plan?.cancelAt != null ||
    plan?.canceledAt != null;

  if (isCancelled) {
    return "Cancelled";
  }

  // 3. Expired
  const isExplicitExpired = 
    listing.status === "Expired" || 
    String(plan?.status || "").toLowerCase() === "expired";

  const expiryMs = parseTimestampMs(insight?.expiryDate || plan?.billingPeriodEnd || listing.expiryDate);
  const isDateExpired = expiryMs != null && expiryMs < Date.now();
  const isAdminGranted = Boolean(plan?.isTrial || plan?.source === "admin_granted" || (listing as any)?.createdByAdmin);

  if (isExplicitExpired || (isDateExpired && (isAdminGranted || (stripeStatus !== "active" && stripeStatus !== "trialing")))) {
    return "Expired";
  }

  // 4. Disabled / Inactive by admin
  if (listing.status === "Disabled" || listing.active === false) {
    return "Disabled";
  }

  // 5. Pending Review
  if (listing.status === "Pending Review" || listing.status === "Pending") {
    return "Pending Review";
  }

  // 6. Extended
  if (listing.status === "Extended") {
    return "Active";
  }

  // 7. Approved / Active
  if (listing.status === "Approved" || listing.status === "Active" || listing.active === true) {
    return "Active";
  }

  return listing.status || "Active";
}

export function getEffectiveFeatureStatus(feature?: any, listing?: any): string {
  const explicitStatus = listing?.featureStatus || feature?.status;

  const hasFeature = Boolean(
    feature ||
    listing?.isFeatured ||
    listing?.featureSpotlightPaidThrough ||
    listing?.selectedAddon ||
    listing?.featuredPlan ||
    (listing?.featureStatus && listing.featureStatus !== "-")
  );

  if (!hasFeature) {
    return "-";
  }

  // Check explicit admin or document status override first
  if (explicitStatus) {
    const norm = String(explicitStatus).trim().toLowerCase();
    if (norm === "disabled") return "Disabled";
    if (norm === "cancelled" || norm === "canceled") return "Cancelled";
    if (norm === "expired") return "Expired";
    if (norm === "incomplete payment" || norm === "incomplete_payment" || norm === "payment error" || norm === "payment_error") return "Incomplete Payment";
    if (norm === "active" || norm === "approved") return "Active";
  }

  // 1. Incomplete Payment / Payment Error
  const stripeStatus = String(feature?.stripeSubscriptionStatus || listing?.stripeSubscriptionStatus || "").toLowerCase();
  const isPaymentFailed =
    ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(stripeStatus) ||
    feature?.paymentStatus === "failed" ||
    feature?.paymentStatus === "past_due" ||
    feature?.status === "Incomplete Payment" ||
    feature?.status === "incomplete_payment" ||
    feature?.status === "Payment Error" ||
    feature?.status === "payment_error" ||
    feature?.status === "past_due" ||
    Boolean(feature?.paymentError) ||
    Boolean(feature?.paymentFailed) ||
    String(feature?.status || "").toLowerCase() === "incomplete payment" ||
    String(feature?.status || "").toLowerCase() === "incomplete_payment" ||
    String(feature?.status || "").toLowerCase() === "payment_error" ||
    String(feature?.status || "").toLowerCase() === "past_due" ||
    Boolean(feature?.lastPaymentError);

  if (isPaymentFailed) {
    return "Incomplete Payment";
  }

  // 2. Cancelled
  const isCancelled =
    feature?.status === "Cancelled" ||
    feature?.status === "Canceled" ||
    stripeStatus === "canceled" ||
    stripeStatus === "cancelled" ||
    String(feature?.status || "").toLowerCase() === "cancelled" ||
    String(feature?.status || "").toLowerCase() === "canceled" ||
    Boolean(feature?.cancelAtPeriodEnd) ||
    feature?.cancelAt != null ||
    feature?.canceledAt != null;

  if (isCancelled) {
    return "Cancelled";
  }

  // 3. Expired
  const isExplicitExpired =
    feature?.status === "Expired" ||
    String(feature?.status || "").toLowerCase() === "expired";

  const expiryMs = parseTimestampMs(feature?.accessThrough || feature?.billingPeriodEnd || listing?.featureSpotlightPaidThrough || feature?.expiryDate);
  const isDateExpired = expiryMs != null && expiryMs < Date.now();
  const isAdminGranted = Boolean(feature?.isTrial || feature?.source === "admin_granted" || (listing as any)?.createdByAdmin);

  if (isExplicitExpired || (isDateExpired && (isAdminGranted || (stripeStatus !== "active" && stripeStatus !== "trialing")))) {
    return "Expired";
  }

  // 4. Disabled
  if (feature?.status === "Disabled" || feature?.active === false || listing?.isFeatured === false) {
    return "Disabled";
  }

  // 5. Active
  if (feature?.active === true || feature?.status === "Active" || feature?.status === "active" || feature?.status === "succeeded" || listing?.isFeatured === true || (expiryMs != null && expiryMs > Date.now())) {
    return "Active";
  }

  return feature?.status || "Active";
}

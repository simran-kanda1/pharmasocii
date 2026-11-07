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

  const normListingStatus = String(listing.status || "").trim().toLowerCase();
  const normPlanStatus = String(plan?.status || "").trim().toLowerCase();

  // 0. Pending Payment (checkout started and never finished, or waiting in Stripe queue)
  const hasPaidPlan = Boolean(
    plan &&
    (plan.lastPaymentReceivedAt ||
      plan.stripeSubscriptionId ||
      plan.sessionId ||
      plan.isTrial ||
      plan.source === "admin_granted")
  );
  if (
    (normListingStatus === "pending_payment" ||
      normListingStatus === "pending payment" ||
      normPlanStatus === "pending_payment" ||
      normPlanStatus === "pending payment") &&
    !hasPaidPlan
  ) {
    return "Pending Payment";
  }

  // 1. Incomplete Payment (charge did not go through, including expired card)
  const stripeStatus = String(
    plan?.stripeSubscriptionStatus || listing.stripeSubscriptionStatus || ""
  ).toLowerCase();
  const isPaymentFailed =
    ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(stripeStatus) ||
    Boolean(plan?.endedForNonpayment) ||
    Boolean(listing.endedForNonpayment) ||
    listing.paymentStatus === "failed" ||
    listing.paymentStatus === "past_due" ||
    ["incomplete payment", "incomplete_payment", "payment error", "payment_error", "past_due"].includes(
      normListingStatus
    ) ||
    ["incomplete payment", "incomplete_payment", "payment error", "payment_error", "past_due"].includes(
      normPlanStatus
    ) ||
    Boolean(plan?.paymentError) ||
    Boolean(plan?.paymentFailed) ||
    Boolean(plan?.lastPaymentError);

  if (isPaymentFailed) {
    return "Incomplete Payment";
  }

  // 2. Disabled (explicit admin or inactive flag)
  if (normListingStatus === "disabled" || normPlanStatus === "disabled") {
    return "Disabled";
  }

  // 3. Expired vs Cancelled
  // Cancelled means partner turned it off and it runs through the day already paid.
  // Expired means the paid window is over and Stripe is not still billing (happens after cancelled period ends).
  const expiryMs = parseTimestampMs(
    insight?.expiryDate || plan?.billingPeriodEnd || plan?.cancelAt || listing.expiryDate
  );
  const isDateExpired = expiryMs != null && expiryMs <= Date.now();
  const isAdminGranted = Boolean(
    plan?.isTrial || plan?.source === "admin_granted" || (listing as any)?.createdByAdmin
  );

  const isCancelledSignal =
    normListingStatus === "cancelled" ||
    normListingStatus === "canceled" ||
    stripeStatus === "canceled" ||
    stripeStatus === "cancelled" ||
    normPlanStatus === "cancelled" ||
    normPlanStatus === "canceled" ||
    Boolean(plan?.cancelAtPeriodEnd) ||
    insight?.cancelledOn != null ||
    plan?.cancelAt != null ||
    plan?.canceledAt != null ||
    plan?.cancelledAt != null;

  const isExplicitExpired =
    normListingStatus === "expired" ||
    normPlanStatus === "expired" ||
    plan?.expiredAt != null;

  if (
    isExplicitExpired ||
    (isDateExpired &&
      (isCancelledSignal ||
        isAdminGranted ||
        (stripeStatus !== "active" && stripeStatus !== "trialing")))
  ) {
    return "Expired";
  }

  if (isCancelledSignal) {
    return "Cancelled";
  }

  // 4. Inactive flag by admin
  if (listing.active === false) {
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
  const normExplicit = String(explicitStatus || "").trim().toLowerCase();
  const normListingStatus = String(listing?.status || "").trim().toLowerCase();

  const hasFeature = Boolean(
    feature ||
    listing?.isFeatured ||
    listing?.featureSpotlightPaidThrough ||
    listing?.featureSpotlightAccessEnd ||
    (listing?.selectedAddon && listing.selectedAddon !== "none") ||
    (listing?.featuredPlacement && listing.featuredPlacement !== "none") ||
    listing?.featuredPlan ||
    (listing?.featureStatus && listing.featureStatus !== "-")
  );

  if (!hasFeature) {
    return "-";
  }

  // 0. Pending Payment (checkout started and never finished)
  const hasPaidFeature = Boolean(
    feature &&
    (feature.lastPaymentReceived ||
      feature.stripeSubscriptionId ||
      feature.sessionId ||
      feature.isTrial ||
      feature.source === "admin_granted" ||
      feature.source === "included_plan")
  );
  if (
    normExplicit === "pending_payment" ||
    normExplicit === "pending payment" ||
    ((normListingStatus === "pending_payment" || normListingStatus === "pending payment") && !hasPaidFeature)
  ) {
    return "Pending Payment";
  }

  // 1. Disabled (explicit admin flag)
  if (normExplicit === "disabled" || String(feature?.status || "").trim().toLowerCase() === "disabled") {
    return "Disabled";
  }

  // 2. Incomplete Payment / Payment Error
  const stripeStatus = String(
    feature?.stripeSubscriptionStatus || listing?.featureSpotlightSubscriptionStatus || ""
  ).toLowerCase();
  const isPaymentFailed =
    ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(stripeStatus) ||
    Boolean(feature?.endedForNonpayment) ||
    feature?.paymentStatus === "failed" ||
    feature?.paymentStatus === "past_due" ||
    ["incomplete payment", "incomplete_payment", "payment error", "payment_error", "past_due"].includes(
      normExplicit
    ) ||
    Boolean(feature?.paymentError) ||
    Boolean(feature?.paymentFailed) ||
    Boolean(feature?.lastPaymentError);

  if (isPaymentFailed) {
    return "Incomplete Payment";
  }

  // 3. Expired vs Cancelled
  const expiryMs = parseTimestampMs(
    feature?.accessThrough ||
    feature?.billingPeriodEnd ||
    listing?.featureSpotlightAccessEnd ||
    listing?.featureSpotlightPaidThrough ||
    feature?.expiryDate
  );
  const isDateExpired = expiryMs != null && expiryMs <= Date.now();
  const isAdminGranted = Boolean(
    feature?.isTrial || feature?.source === "admin_granted" || (listing as any)?.createdByAdmin
  );

  const isCancelledSignal =
    normExplicit === "cancelled" ||
    normExplicit === "canceled" ||
    stripeStatus === "canceled" ||
    stripeStatus === "cancelled" ||
    Boolean(feature?.cancelPending) ||
    Boolean(feature?.cancelAtPeriodEnd) ||
    Boolean(listing?.featureSpotlightCancelPending) ||
    feature?.cancelAt != null ||
    feature?.canceledAt != null ||
    feature?.cancelledAt != null;

  const isExplicitExpired =
    normExplicit === "expired" ||
    feature?.expiredAt != null ||
    (feature?.active === false && Boolean(feature?.deactivatedAt) && !feature?.supersededBy);

  if (
    isExplicitExpired ||
    (isDateExpired &&
      (isCancelledSignal ||
        isAdminGranted ||
        (stripeStatus !== "active" && stripeStatus !== "trialing")))
  ) {
    return "Expired";
  }

  if (isCancelledSignal) {
    return "Cancelled";
  }

  if (feature?.active === false && !feature?.supersededBy) {
    return "Expired";
  }

  // 4. Active
  if (
    feature?.active === true ||
    normExplicit === "active" ||
    normExplicit === "approved" ||
    normExplicit === "succeeded" ||
    listing?.isFeatured === true ||
    (expiryMs != null && expiryMs > Date.now())
  ) {
    return "Active";
  }

  return feature?.status || "Active";
}

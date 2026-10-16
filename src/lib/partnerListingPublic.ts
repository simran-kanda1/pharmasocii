/** Shared rules for whether a partner listing should appear on public pages. */

/**
 * Temporary preview toggle:
 * Set to true to hide all business offerings, consulting services, events, and jobs
 * from the public-facing preview site, while keeping all data intact in the backend.
 */
export const HIDE_DIRECTORY_DATA_PREVIEW = false;

export function toDateValue(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof (value as { toDate?: () => Date }).toDate === "function") {
        const converted = (value as { toDate: () => Date }).toDate();
        return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
    }
    if (typeof value === "number") {
        const millis = value > 1e12 ? value : value * 1000;
        const converted = new Date(millis);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    if (typeof value === "string") {
        const converted = new Date(value);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    if (typeof (value as { seconds?: number }).seconds === "number") {
        const converted = new Date((value as { seconds: number }).seconds * 1000);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    return null;
}

export function isPlanBillingLive(plan: Record<string, unknown>): boolean {
    if (plan?.active === false) return false;
    if (plan?.endedForNonpayment) return false;

    const stripeStatus = String(plan?.stripeSubscriptionStatus || "").toLowerCase();
    if (["past_due", "unpaid", "canceled", "cancelled", "incomplete_expired"].includes(stripeStatus)) {
        return false;
    }

    const end = toDateValue(plan?.billingPeriodEnd) || toDateValue(plan?.cancelAt);
    if (end && end.getTime() < Date.now()) {
        return false;
    }

    if (["active", "trialing"].includes(stripeStatus)) {
        return true;
    }

    if (plan?.isTrial || plan?.source === "admin_granted" || Boolean(plan?.createdByAdmin)) {
        return true;
    }

    return true;
}

export function partnerIdFromPlanDocPath(path: string): string {
    const match = path.match(/^partnersCollection\/([^/]+)\/planCollection\//);
    return match ? match[1] : "";
}

export function liveListingKey(partnerId: string, collectionName: string, listingId: string): string {
    return `${partnerId}:${collectionName}:${listingId}`;
}

const CONSULTING_COLLECTION_ALIASES = ["consultingServicesCollection", "consultingCollection"] as const;

function addLiveListingKeys(
    keys: Set<string>,
    partnerId: string,
    collectionName: string,
    listingId: string,
): void {
    keys.add(liveListingKey(partnerId, collectionName, listingId));
    if (
        CONSULTING_COLLECTION_ALIASES.includes(
            collectionName as (typeof CONSULTING_COLLECTION_ALIASES)[number],
        )
    ) {
        for (const alias of CONSULTING_COLLECTION_ALIASES) {
            if (alias !== collectionName) {
                keys.add(liveListingKey(partnerId, alias, listingId));
            }
        }
    }
}

export function hasLiveListingKey(
    liveKeys: Set<string>,
    partnerId: string,
    collectionName: string,
    listingId: string,
): boolean {
    if (liveKeys.has(liveListingKey(partnerId, collectionName, listingId))) return true;
    if (
        CONSULTING_COLLECTION_ALIASES.includes(
            collectionName as (typeof CONSULTING_COLLECTION_ALIASES)[number],
        )
    ) {
        for (const alias of CONSULTING_COLLECTION_ALIASES) {
            if (alias !== collectionName && liveKeys.has(liveListingKey(partnerId, alias, listingId))) {
                return true;
            }
        }
    }
    return false;
}

export function buildLiveListingKeySet(
    plans: Array<{ path?: string; data: Record<string, unknown> }>,
): Set<string> {
    const keys = new Set<string>();
    for (const { path = "", data } of plans) {
        if (!isPlanBillingLive(data)) continue;
        const listingId = data.listingId;
        const collectionName = data.collectionName;
        if (typeof listingId !== "string" || !listingId) continue;
        if (typeof collectionName !== "string" || !collectionName) continue;
        const partnerId =
            (typeof data.partnerId === "string" && data.partnerId) ||
            partnerIdFromPlanDocPath(path);
        if (!partnerId) continue;
        addLiveListingKeys(keys, partnerId, collectionName, listingId);
    }
    return keys;
}

const INACTIVE_LISTING_STATUSES = new Set([
    "cancelled",
    "canceled",
    "expired",
    "inactive",
    "rejected",
]);

/** Field-level visibility (active flag and explicit status). */
export function isListingStatusPublic(data: Record<string, unknown>): boolean {
    if (data.active === false) return false;
    const status = String(data.status || "").trim().toLowerCase();
    if (status && INACTIVE_LISTING_STATUSES.has(status)) return false;
    return true;
}

/**
 * A listing is public when its status fields allow it (active !== false and not inactive status).
 */
export function isPartnerListingPublic(
    listing: Record<string, unknown> & { id?: string; partnerId?: string },
    collectionName?: string,
    liveKeys?: Set<string>,
): boolean {
    if (HIDE_DIRECTORY_DATA_PREVIEW) return false;
    if (!isListingStatusPublic(listing)) return false;
    if (!liveKeys || !collectionName || !listing?.id) return true;
    const partnerId = typeof listing.partnerId === "string" ? listing.partnerId : "";
    if (!partnerId) return false;
    return hasLiveListingKey(liveKeys, partnerId, collectionName, listing.id);
}

/** Plan IDs that include a spotlight tier (events/jobs). */
export const PLAN_INCLUDED_SPOTLIGHT: Record<string, string> = {
    premium_event: "landing_page",
    premium_job: "landing_page",
    premium_plus_event: "home_page",
    premium_plus_job: "home_page",
};

export function inferIncludedSpotlightFromPlan(item: Record<string, unknown>): string {
    const planId = String(item?.selectedPlan || "").trim().toLowerCase();
    return PLAN_INCLUDED_SPOTLIGHT[planId] || "";
}

/**
 * Resolve where a listing should appear in Featured carousels.
 * Uses the higher of plan-included vs add-on fields across all plans.
 */
export function resolveSpotlightPlacement(item: Record<string, unknown>): string {
    const rawPlacement = String(item?.featuredPlacement || "").trim().toLowerCase();
    const rawAddon = String(item?.selectedAddon || "").trim().toLowerCase();

    const addon = (rawPlacement && rawPlacement !== "none")
        ? rawPlacement
        : (rawAddon && rawAddon !== "none" && rawAddon !== "spotlight_addon")
            ? rawAddon
            : "";

    const planIncluded = inferIncludedSpotlightFromPlan(item);

    if (
        (addon === "home_page" && planIncluded === "landing_page") ||
        (addon === "landing_page" && planIncluded === "home_page") ||
        addon === "both" ||
        planIncluded === "both"
    ) {
        return "both";
    }

    if (addon === "home_page" || addon === "landing_page") {
        return addon;
    }
    if (planIncluded === "home_page" || planIncluded === "landing_page") {
        return planIncluded;
    }

    if (rawAddon === "spotlight_addon") {
        return rawPlacement || "home_page";
    }

    return "";
}

/** Spotlight stays visible until its paid/access window ends. */
export function spotlightDisplayActive(item: Record<string, unknown>): boolean {
    if (item.active === false) return false;
    const status = String(item.status || "").trim().toLowerCase();
    if (status === "cancelled" || status === "canceled" || status === "expired" || status === "inactive") {
        return false;
    }
    const cancelEnd =
        toDateValue(item.featureSpotlightAccessEnd) ||
        toDateValue(item.featureSpotlightPaidThrough);
    // Once the paid window is over, treat as inactive so repurchase unlocks
    // (even if cancel-pending cleanup lagged or fields were left behind).
    if (cancelEnd && cancelEnd.getTime() < Date.now()) {
        return false;
    }
    return true;
}

/** True when a cancelled spotlight's paid window has ended (public + dashboard). */
export function isSpotlightAccessEnded(item: Record<string, unknown> | null | undefined): boolean {
    if (!item) return false;
    return !spotlightDisplayActive(item);
}

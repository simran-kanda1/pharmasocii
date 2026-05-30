/** Shared rules for whether a partner listing should appear on public pages. */

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
    const end =
        toDateValue(plan?.billingPeriodEnd) ||
        toDateValue(plan?.cancelAt);
    if (end && end.getTime() < Date.now()) return false;
    return true;
}

export function partnerIdFromPlanDocPath(path: string): string {
    const match = path.match(/^partnersCollection\/([^/]+)\/planCollection\//);
    return match ? match[1] : "";
}

export function liveListingKey(partnerId: string, collectionName: string, listingId: string): string {
    return `${partnerId}:${collectionName}:${listingId}`;
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
        keys.add(liveListingKey(partnerId, collectionName, listingId));
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
 * A listing is public only when its status fields allow it and a billing-live plan backs it.
 * Listings without partner linkage keep the legacy `active !== false` behavior.
 */
export function isPartnerListingPublic(
    listing: Record<string, unknown> & { id?: string; partnerId?: string },
    collectionName: string,
    liveKeys: Set<string>,
): boolean {
    if (!isListingStatusPublic(listing)) return false;

    const partnerId = listing.partnerId;
    const listingId = listing.id;
    if (!partnerId || !listingId) {
        return listing.active !== false;
    }

    return liveKeys.has(liveListingKey(partnerId, collectionName, listingId));
}

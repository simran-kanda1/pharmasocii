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

    if (hasLiveListingKey(liveKeys, partnerId, collectionName, listingId)) return true;

    // Allow partners on the "none" (free/pending) plan to be publicly visible if approved
    if (String(listing.selectedPlan || "").trim().toLowerCase() === "none") {
        return true;
    }

    // Plans could not be loaded (e.g. rules not deployed yet) — fall back to listing fields.
    if (liveKeys.size === 0) {
        const status = String(listing.status || "").trim().toLowerCase();
        const approved =
            !status || status === "approved" || status === "active" || status === "published";
        return listing.active !== false && approved;
    }

    return false;
}

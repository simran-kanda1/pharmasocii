/** Partner billing rows from `transactionsCollection` — shared shape for table, detail modal, and exports. */

export type CompanyRep = { firstName?: string; lastName?: string; email?: string };

export type PartnerTransactionRow = {
    id: string;
    partnerId: string | null;
    createdAtIso: string;
    dateDisplay: string;
    type: string;
    typeLabel: string;
    description: string;
    planDisplay: string;
    eventDisplay: string;
    planId: string | null;
    featureId: string | null;
    group: string | null;
    businessName: string | null;
    taxId: string | null;
    targetTitle: string | null;
    upgradeFor: string | null;
    amountDisplay: string;
    amountNumeric: number;
    subtotalDisplay: string;
    subtotalNumeric: number;
    taxAmountDisplay: string;
    taxAmountNumeric: number;
    currency: string;
    statusRaw: string;
    statusLabel: string;
    paymentMethod: string;
    sessionId: string | null;
    invoiceId: string | null;
    stripeSubscriptionId: string | null;
    listingId: string | null;
    collectionName: string | null;
    customerEmail: string | null;
    selectedCategories: string[];
    selectedSubcategories: string[];
    selectedSubSubcategories: string[];
    serviceCountries: string[];
    serviceRegions: string[];
    companyRepresentatives: CompanyRep[];
};

function firestoreDateToDate(createdAt: { seconds?: number } | null | undefined): Date | null {
    if (!createdAt || typeof createdAt.seconds !== "number") return null;
    return new Date(createdAt.seconds * 1000);
}

function formatPaddedDate(d: Date | null): string {
    if (!d) return "N/A";
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
}

function cleanTitleCase(str: string): string {
    if (!str) return "";
    return str
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function cleanPlanCycle(str: string): string {
    const s = str
        .replace(/\bYr\b/g, "Yearly")
        .replace(/\bMo\b/g, "Monthly")
        .replace(/\byr\b/g, "Yearly")
        .replace(/\bmo\b/g, "Monthly");
    return cleanTitleCase(s);
}

function formatCleanPlanName(
    type: string,
    planId: string | null,
    featureId: string | null,
    rawDesc?: string | null,
    planName?: string | null
): string {
    if (type === "feature" || featureId) {
        const f = (featureId || "").toLowerCase();
        if (f === "home_page" || /home page/i.test(rawDesc || "")) return "Home Page Spotlight";
        if (f === "landing_page" || /landing page/i.test(rawDesc || "")) return "Landing Page Spotlight";
        if (f === "both" || /both/i.test(rawDesc || "")) return "Both (Module & Home Page)";
        if (f) return `${cleanTitleCase(f.replace(/_/g, " "))} Spotlight`;
        return "Spotlight Feature";
    }

    if (planName && typeof planName === "string" && planName.trim()) {
        const pn = planName.trim();
        if (!/^(Plan|Feature):/i.test(pn)) {
            return cleanPlanCycle(pn);
        }
    }

    if (planId) {
        const p = planId.toLowerCase();
        const isYearly = p.endsWith("_yr") || p.endsWith("_yearly") || p.includes("year");
        const isMonthly = p.endsWith("_mo") || p.endsWith("_monthly") || p.includes("month");
        const cycle = isYearly ? "Yearly" : isMonthly ? "Monthly" : "";

        const baseTier = p
            .replace(/_yr$/, "")
            .replace(/_mo$/, "")
            .replace(/_yearly$/, "")
            .replace(/_monthly$/, "");

        let tierLabel = "";
        if (baseTier === "basic_event") tierLabel = "Basic Event";
        else if (baseTier === "standard_event") tierLabel = "Standard Event";
        else if (baseTier === "premium_event") tierLabel = "Premium Event";
        else if (baseTier === "premium_plus_event") tierLabel = "Premium Plus Event";
        else if (baseTier === "basic_job") tierLabel = "Basic Job";
        else if (baseTier === "standard_job") tierLabel = "Standard Job";
        else if (baseTier === "premium_job") tierLabel = "Premium Job";
        else if (baseTier === "premium_plus_job") tierLabel = "Premium Plus Job";
        else if (baseTier === "premium_plus") tierLabel = "Premium Plus";
        else if (baseTier === "premium") tierLabel = "Premium";
        else if (baseTier === "standard") tierLabel = "Standard";
        else if (baseTier === "basic") tierLabel = "Basic";
        else if (baseTier === "enterprise") tierLabel = "Enterprise";
        else tierLabel = cleanTitleCase(baseTier.replace(/_/g, " "));

        if (cycle && !tierLabel.toLowerCase().includes(cycle.toLowerCase())) {
            return `${tierLabel} ${cycle}`;
        }
        return tierLabel;
    }

    if (rawDesc && typeof rawDesc === "string" && rawDesc.trim()) {
        const cleaned = rawDesc
            .replace(/^Plan upgrade:\s*/i, "")
            .replace(/\(prorated\)/i, "")
            .replace(/^Spotlight:\s*/i, "")
            .trim();
        if (cleaned) return cleanPlanCycle(cleaned);
    }

    return "Standard Monthly";
}

function formatCleanEvent(
    _type: string,
    isUpgrade: boolean,
    rawDesc?: string | null,
    eventType?: string | null,
    previousPlanId?: string | null,
    previousFeatureId?: string | null
): string {
    const desc = (rawDesc || "").toLowerCase();
    const evt = (eventType || "").toLowerCase();
    if (isUpgrade || previousPlanId || previousFeatureId || desc.includes("upgrade") || evt.includes("upgrade")) {
        return desc.includes("prorated") || isUpgrade ? "Upgrade (prorated)" : "Upgrade";
    }
    if (desc.includes("renewal") || evt.includes("renewal")) {
        return "Renewal";
    }
    return "Initial";
}

function formatCleanDescription(type: string, planId: string | null, featureId: string | null, rawDesc?: string | null, previousFeatureId?: string | null, previousPlanId?: string | null, isUpgrade?: boolean): string {
    if (rawDesc && typeof rawDesc === "string" && rawDesc.trim()) {
        const trimmed = rawDesc.trim();
        // Prefer explicit upgrade / spotlight copy written by the billing server.
        if (/spotlight upgrade|plan upgrade|spotlight:|plan renewal|spotlight renewal/i.test(trimmed)) {
            return trimmed;
        }
        const stripped = trimmed.replace(/^(Plan|Feature):\s*/i, "").trim();
        if (stripped && !stripped.toLowerCase().startsWith("plan") && !stripped.toLowerCase().startsWith("feature")) {
            return cleanTitleCase(stripped.replace(/_/g, " "));
        }
    }
    if (type === "feature" || featureId) {
        const f = (featureId || "").toLowerCase();
        const featureLabel =
            f === "landing_page" ? "Landing Page"
            : f === "home_page" ? "Home Page"
            : f === "both" ? "Both (Module & Home Page)"
            : f ? cleanTitleCase(f.replace(/_/g, " "))
            : "Spotlight Feature";
        const prev = (previousFeatureId || "").toLowerCase();
        if (isUpgrade || prev) {
            const prevLabel =
                prev === "landing_page" ? "Landing Page"
                : prev === "home_page" ? "Home Page"
                : prev === "both" ? "Both (Module & Home Page)"
                : prev ? cleanTitleCase(prev.replace(/_/g, " "))
                : "Previous Spotlight";
            return `Spotlight upgrade: ${prevLabel} → ${featureLabel} (prorated)`;
        }
        return `Spotlight: ${featureLabel}`;
    }
    if (planId) {
        const p = planId.toLowerCase().replace(/_mo$/, "");
        const planLabel =
            p === "basic_event" ? "Basic Event"
            : p === "standard_job" ? "Standard Job"
            : p === "basic_job" ? "Basic Job"
            : p === "premium_plus" || p === "premium_plus_event" || p === "premium_plus_job" ? "Premium Plus"
            : p === "premium" || p === "premium_event" || p === "premium_job" ? "Premium"
            : p === "standard" ? "Standard"
            : p === "basic" ? "Basic"
            : p === "enterprise" ? "Enterprise"
            : cleanTitleCase(p.replace(/_/g, " "));
        if (isUpgrade || previousPlanId) {
            const from = String(previousPlanId || "").toLowerCase().replace(/_mo$/, "");
            const fromLabel = from
                ? cleanTitleCase(from.replace(/_/g, " "))
                : "Previous Plan";
            return `Plan upgrade: ${fromLabel} → ${planLabel} (prorated)`;
        }
        return planLabel;
    }
    return type === "feature" ? "Spotlight Feature" : "Listing Plan";
}

function resolveCleanGroup(t: Record<string, unknown>, collectionName: string | null, planId: string | null): string {
    let raw = t.group ? String(t.group) : (t.targetGroup ? String(t.targetGroup) : null);
    if (!raw && collectionName) {
        if (collectionName.includes("businessOfferings")) raw = "business_offerings";
        else if (collectionName.includes("consulting")) raw = "consulting";
        else if (collectionName.includes("events")) raw = "events";
        else if (collectionName.includes("jobs")) raw = "jobs";
        else raw = collectionName;
    }
    if (!raw && planId) {
        const p = String(planId).toLowerCase();
        if (p.includes("event")) raw = "events";
        else if (p.includes("job")) raw = "jobs";
        else if (p.includes("consulting")) raw = "consulting";
        else raw = "business_offerings";
    }
    if (!raw && t.featureId) {
        raw = "business_offerings";
    }
    if (!raw) {
        raw = "business_offerings";
    }
    const clean = raw.toLowerCase().replace(/collection/i, "").replace(/services/i, "").trim();
    if (clean === "events" || clean === "event") return "Events";
    if (clean === "jobs" || clean === "job") return "Jobs";
    if (clean === "consulting") return "Consulting";
    if (clean.includes("business")) return "Business Offerings";
    return cleanTitleCase(clean.replace(/_/g, " "));
}

export function formatPartnerTransaction(doc: { id: string } & Record<string, unknown>): PartnerTransactionRow {
    const t = doc as Record<string, unknown>;
    const created = firestoreDateToDate(t.createdAt as { seconds?: number } | undefined);
    const createdAtIso = created ? created.toISOString() : "";
    const dateDisplay = formatPaddedDate(created);

    const type = String(t.type || "");
    const planId = (t.planId as string) || null;
    const featureId = (t.featureId as string) || null;
    const previousFeatureId = (t.previousFeatureId as string) || null;
    const previousPlanId = (t.previousPlanId as string) || (t.fromPlanId as string) || null;
    const isUpgrade = t.isUpgrade === true || Boolean(previousFeatureId) || Boolean(previousPlanId) || Boolean(t.upgradeFlow);
    const rawDesc = t.description ? String(t.description) : null;
    const planName = t.planName ? String(t.planName) : null;
    const description = formatCleanDescription(type, planId, featureId, rawDesc, previousFeatureId, previousPlanId, isUpgrade);
    const planDisplay = formatCleanPlanName(type, planId, featureId, rawDesc, planName);
    const eventDisplay = formatCleanEvent(type, isUpgrade, rawDesc, t.eventType as string, previousPlanId, previousFeatureId);

    const amountNumeric = typeof t.amount === "number" && Number.isFinite(t.amount) ? t.amount : 0;
    const taxAmountNumeric = typeof t.taxAmount === "number" && Number.isFinite(t.taxAmount)
        ? t.taxAmount
        : typeof t.tax === "number" && Number.isFinite(t.tax)
            ? t.tax
            : 0;
    const subtotalNumeric = typeof t.subtotal === "number" && Number.isFinite(t.subtotal)
        ? t.subtotal
        : Math.max(0, amountNumeric - taxAmountNumeric);

    const currency = String(t.currency || "usd").toUpperCase();
    const statusRaw = String(t.status || "");
    const statusLabel = statusRaw === "succeeded" ? "Completed" : statusRaw || "—";

    const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]).map(String) : []);
    const reps = Array.isArray(t.companyRepresentatives) ? (t.companyRepresentatives as CompanyRep[]) : [];

    const collectionName = t.collectionName ? String(t.collectionName) : null;
    const groupDisplay = resolveCleanGroup(t, collectionName, planId);

    const targetTitle = (t.listingTitle as string) ||
        (t.eventName as string) ||
        (t.jobTitle as string) ||
        (t.businessName as string) ||
        (t.companyName as string) ||
        null;

    const upgradeFor = targetTitle || (t.listingId ? `Listing (${String(t.listingId).slice(0, 8)})` : null);

    const taxId = (t.taxId as string) ||
        (t.VAT_ABN_EIN_businessId as string) ||
        (t.businessId as string) ||
        (t.tax_id as string) ||
        null;

    return {
        id: doc.id,
        partnerId: t.partnerId ? String(t.partnerId) : null,
        createdAtIso,
        dateDisplay,
        type,
        typeLabel: type === "feature" ? "Feature" : type === "listing" ? "Listing" : type || "—",
        description,
        planDisplay,
        eventDisplay,
        planId,
        featureId,
        group: groupDisplay,
        businessName: t.businessName ? String(t.businessName) : null,
        taxId,
        targetTitle,
        upgradeFor,
        amountDisplay: `$${amountNumeric.toFixed(2)}`,
        amountNumeric,
        subtotalDisplay: `$${subtotalNumeric.toFixed(2)}`,
        subtotalNumeric,
        taxAmountDisplay: `$${taxAmountNumeric.toFixed(2)}`,
        taxAmountNumeric,
        currency,
        statusRaw,
        statusLabel,
        paymentMethod: "Stripe Checkout (Auto)",
        sessionId: t.sessionId ? String(t.sessionId) : null,
        invoiceId: (t.invoiceId as string) || (t.stripeInvoiceId as string) || null,
        stripeSubscriptionId: t.stripeSubscriptionId ? String(t.stripeSubscriptionId) : null,
        listingId: t.listingId ? String(t.listingId) : null,
        collectionName,
        customerEmail: t.customerEmail ? String(t.customerEmail) : null,
        selectedCategories: arr(t.selectedCategories),
        selectedSubcategories: arr(t.selectedSubcategories),
        selectedSubSubcategories: arr(t.selectedSubSubcategories),
        serviceCountries: arr(t.serviceCountries),
        serviceRegions: arr(t.serviceRegions),
        companyRepresentatives: reps,
    };
}

export function sortPartnerTransactionsNewestFirst(a: PartnerTransactionRow, b: PartnerTransactionRow): number {
    return (b.createdAtIso || "").localeCompare(a.createdAtIso || "");
}

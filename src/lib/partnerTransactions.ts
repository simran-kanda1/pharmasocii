/** Partner billing rows from `transactionsCollection` — shared shape for table, detail modal, and exports. */

export type CompanyRep = { firstName?: string; lastName?: string; email?: string };

export type PartnerTransactionRow = {
    id: string;
    createdAtIso: string;
    dateDisplay: string;
    type: string;
    typeLabel: string;
    description: string;
    planId: string | null;
    featureId: string | null;
    group: string | null;
    businessName: string | null;
    amountDisplay: string;
    amountNumeric: number;
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

export function formatPartnerTransaction(doc: { id: string } & Record<string, unknown>): PartnerTransactionRow {
    const t = doc as Record<string, unknown>;
    const created = firestoreDateToDate(t.createdAt as { seconds?: number } | undefined);
    const createdAtIso = created ? created.toISOString() : "";
    const dateDisplay = created ? created.toLocaleDateString() : "N/A";

    const type = String(t.type || "");
    const planId = (t.planId as string) || null;
    const featureId = (t.featureId as string) || null;
    const description =
        type === "feature"
            ? `Feature: ${(featureId || "").replace(/_/g, " ") || "N/A"}`
            : `Plan: ${(planId || "").replace(/_/g, " ").toUpperCase() || "N/A"}`;

    const amountNumeric = typeof t.amount === "number" && Number.isFinite(t.amount) ? t.amount : 0;
    const currency = String(t.currency || "usd").toUpperCase();
    const statusRaw = String(t.status || "");
    const statusLabel = statusRaw === "succeeded" ? "Completed" : statusRaw || "—";

    const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]).map(String) : []);
    const reps = Array.isArray(t.companyRepresentatives) ? (t.companyRepresentatives as CompanyRep[]) : [];

    return {
        id: doc.id,
        createdAtIso,
        dateDisplay,
        type,
        typeLabel: type === "feature" ? "Feature" : type === "listing" ? "Listing" : type || "—",
        description,
        planId,
        featureId,
        group: t.group ? String(t.group).replace(/_/g, " ") : null,
        businessName: t.businessName ? String(t.businessName) : null,
        amountDisplay: `$${amountNumeric.toFixed(2)}`,
        amountNumeric,
        currency,
        statusRaw,
        statusLabel,
        paymentMethod: "Stripe Checkout",
        sessionId: t.sessionId ? String(t.sessionId) : null,
        invoiceId: (t.invoiceId as string) || (t.stripeInvoiceId as string) || null,
        stripeSubscriptionId: t.stripeSubscriptionId ? String(t.stripeSubscriptionId) : null,
        listingId: t.listingId ? String(t.listingId) : null,
        collectionName: t.collectionName ? String(t.collectionName) : null,
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

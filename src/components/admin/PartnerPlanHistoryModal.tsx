import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Copy,
  Check,
  AlertCircle,
  ArrowUpCircle,
} from "lucide-react";
import {
  formatPartnerTransaction,
  sortPartnerTransactionsNewestFirst,
  type PartnerTransactionRow,
} from "@/lib/partnerTransactions";
import {
  getEffectiveListingStatus,
  getEffectiveFeatureStatus,
} from "@/lib/adminEffectiveStatus";

interface Props {
  partner: any | null;
  isOpen: boolean;
  onClose: () => void;
  partnerPlans?: any[];
  featuredPlans?: any[];
  listings?: any[];
  transactions?: any[];
  listingInsights?: Record<string, any>;
}

function formatDate(val: any): string {
  if (!val) return "—";
  try {
    let d: Date | null = null;
    if (typeof val.toDate === "function") d = val.toDate();
    else if (val.seconds != null) d = new Date(val.seconds * 1000);
    else if (val._seconds != null) d = new Date(val._seconds * 1000);
    else if (val instanceof Date) d = val;
    else if (typeof val === "string" || typeof val === "number") {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    if (!d || isNaN(d.getTime())) return "—";
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  } catch {
    return "—";
  }
}

export function formatPlanName(planId?: string | null, planName?: string | null): string {
  if (!planId && !planName) return "Standard Plan";
  const id = String(planId || planName || "").trim().toLowerCase();

  const map: Record<string, string> = {
    standard_mo: "Standard Monthly",
    standard_yr: "Standard Yearly",
    basic_mo: "Basic Monthly",
    basic_yr: "Basic Yearly",
    premium_mo: "Premium Monthly",
    premium_yr: "Premium Yearly",
    premium_plus_mo: "Premium Plus Monthly",
    premium_plus_yr: "Premium Plus Yearly",
    basic_job: "Basic Job",
    standard_job: "Standard Job",
    premium_job: "Premium Job",
    premium_plus_job: "Premium Plus Job",
    basic_event: "Basic Event",
    standard_event: "Standard Event",
    premium_event: "Premium Event",
    premium_plus_event: "Premium Plus Event",
    pp_monthly: "Premium Plus Monthly",
    pp_yearly: "Premium Plus Yearly",
    "standard mo": "Standard Monthly",
    "standard yr": "Standard Yearly",
    "basic mo": "Basic Monthly",
    "basic yr": "Basic Yearly",
    "premium mo": "Premium Monthly",
    "premium yr": "Premium Yearly",
    "premium plus mo": "Premium Plus Monthly",
    "premium plus yr": "Premium Plus Yearly",
    "premium plus job": "Premium Plus Job",
    "premium job": "Premium Job",
  };

  if (map[id]) return map[id];

  return id
    .replace(/_mo$/i, " Monthly")
    .replace(/_yr$/i, " Yearly")
    .replace(/_month$/i, " Monthly")
    .replace(/_year$/i, " Yearly")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatFeatureName(featureId?: string | null, featureName?: string | null): string {
  if (!featureId && !featureName) return "Feature Spotlight";
  const id = String(featureId || featureName || "").trim().toLowerCase();

  const map: Record<string, string> = {
    landing_page: "Landing Page Spotlight",
    home_page: "Home Page Spotlight",
    "landing page": "Landing Page Spotlight",
    "home page": "Home Page Spotlight",
    category: "Category Spotlight",
    module: "Module Spotlight",
    both: "Both (Module & Home Page)",
  };

  if (map[id]) return map[id];

  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveItemType(
  item: any,
  listings: any[] = [],
  transactions: any[] = []
): {
  key: "business_offerings" | "consulting" | "jobs" | "events" | "unknown";
  label: string;
  badgeClass: string;
  listingName: string;
} {
  const listingId = String(item?.listingId || "").trim();
  const matchedListing = listingId ? listings.find((l) => String(l?.id) === listingId) : null;

  // Find transaction matching this listingId or item docId
  const matchedTxn = (listingId || item?.id)
    ? transactions.find(
        (t) =>
          (listingId && String(t?.listingId) === listingId) ||
          (item?.id && String(t?.planId) === String(item?.id)) ||
          (item?.sessionId && t?.sessionId === item?.sessionId)
      )
    : null;

  // Resolve listing name
  let listingName = "";
  if (matchedListing) {
    listingName =
      matchedListing.eventName ||
      matchedListing.jobTitle ||
      matchedListing.businessName ||
      matchedListing.title ||
      "";
  }
  if (!listingName && matchedTxn) {
    listingName =
      matchedTxn.eventName ||
      matchedTxn.jobTitle ||
      matchedTxn.listingName ||
      matchedTxn.businessName ||
      "";
  }
  if (!listingName && item?.listingName) {
    listingName = item.listingName;
  }
  if (!listingName && listingId) {
    listingName = `Listing (${listingId.slice(0, 8)}...)`;
  }

  // Resolve Category / Group
  const rawCol = String(
    item?.collectionName ||
    matchedListing?.__col ||
    matchedListing?.__collection ||
    matchedListing?.selectedGroup ||
    matchedTxn?.collectionName ||
    matchedTxn?.group ||
    ""
  ).toLowerCase();

  const rawPlanId = String(item?.planId || item?.featureId || "").toLowerCase();

  if (
    rawCol.includes("business") ||
    rawCol === "business_offerings" ||
    rawCol === "businessofferingscollection"
  ) {
    return {
      key: "business_offerings",
      label: "Business Offerings",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      listingName,
    };
  }

  if (
    rawCol.includes("consult") ||
    rawCol === "consulting" ||
    rawCol === "consultingcollection"
  ) {
    return {
      key: "consulting",
      label: "Consulting",
      badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
      listingName,
    };
  }

  if (
    rawCol.includes("job") ||
    rawCol === "jobs" ||
    rawCol === "jobscollection" ||
    rawPlanId.includes("job")
  ) {
    return {
      key: "jobs",
      label: "Job Listing",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
      listingName,
    };
  }

  if (
    rawCol.includes("event") ||
    rawCol === "events" ||
    rawCol === "eventscollection" ||
    rawPlanId.includes("event")
  ) {
    return {
      key: "events",
      label: "Event Listing",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      listingName,
    };
  }

  return {
    key: "unknown",
    label: "Standard Plan",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    listingName,
  };
}

function CopyableText({ text, label }: { text?: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);
  const display = String(text || "").trim();
  if (!display || display === "—") return <span className="text-slate-400">—</span>;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  };

  return (
    <span
      onClick={handleCopy}
      title={label ? `Click to copy ${label}` : "Click to copy"}
      className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 hover:text-slate-900 cursor-pointer bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors group"
    >
      <span className="truncate max-w-[160px]">{display}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
      ) : (
        <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
      )}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "active" || s === "approved" || s === "extended" || s === "succeeded") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
        Active
      </Badge>
    );
  }
  if (s === "pending payment" || s === "pending_payment") {
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-medium">
        Pending Payment
      </Badge>
    );
  }
  if (s === "pending review" || s === "pending") {
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-medium">
        Pending
      </Badge>
    );
  }
  if (s === "cancelled" || s === "canceled") {
    return (
      <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-medium">
        Cancelled
      </Badge>
    );
  }
  if (s === "expired") {
    return (
      <Badge className="bg-orange-50 text-orange-700 border-orange-200 font-medium">
        Expired
      </Badge>
    );
  }
  if (s.includes("failed")) {
    return (
      <Badge className="bg-red-50 text-red-700 border-red-200 font-medium">
        Failed Payment
      </Badge>
    );
  }
  if (s.includes("incomplete") || s.includes("error") || s.includes("past_due")) {
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-medium">
        Incomplete Payment
      </Badge>
    );
  }
  if (s === "disabled") {
    return (
      <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-medium">
        Disabled
      </Badge>
    );
  }
  return <Badge variant="outline" className="font-medium">{status || "Unknown"}</Badge>;
}

class ModalErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Error in PartnerPlanHistoryModal:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-white rounded-lg border border-red-200 m-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">Could not load history details</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            An unexpected error occurred while parsing this partner's data: {this.state.error?.message}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
              Try Again
            </Button>
            <Button onClick={this.props.onClose}>Close</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PartnerPlanHistoryModal({
  partner,
  isOpen,
  onClose,
  partnerPlans = [],
  featuredPlans = [],
  listings = [],
  transactions = [],
  listingInsights = {},
}: Props) {
  const [activeTab, setActiveTab] = useState<"plans" | "features">("plans");

  // 1. Partner's Plans (Processed with upgrade detection and deduplication)
  const {
    allPlans: partnerPlansList,
    distinctPlans,
    activePlansCount,
    upgradedPlansCount,
  } = useMemo(() => {
    if (!partner || !Array.isArray(partnerPlans)) {
      return { allPlans: [], distinctPlans: [], activePlansCount: 0, upgradedPlansCount: 0 };
    }

    const rawPlans = partnerPlans
      .filter((p) => p && p.partnerId === partner.id)
      .sort((a, b) => {
        const aTs = a.startDate?.seconds || a.createdAt?.seconds || 0;
        const bTs = b.startDate?.seconds || b.createdAt?.seconds || 0;
        return bTs - aTs;
      });

    // Group plans by listingId (or stripeSubscriptionId) to detect superseded plans
    const listingPlansMap = new Map<string, any[]>();
    rawPlans.forEach((plan) => {
      const key = String(plan.listingId || plan.stripeSubscriptionId || plan.id);
      if (!listingPlansMap.has(key)) listingPlansMap.set(key, []);
      listingPlansMap.get(key)!.push(plan);
    });

    const processedPlans = rawPlans.map((plan) => {
      const listingKey = String(plan.listingId || plan.stripeSubscriptionId || plan.id);
      const siblings = listingPlansMap.get(listingKey) || [plan];

      const hasUpgradedAt = Boolean(plan.upgradedAt);
      const isExplicitUpgrade = Boolean(plan.isUpgrade || plan.previousPlanId);

      // Check transactions for upgrade matching listing or sessionId
      const upgradeTxn = transactions?.find((t) => {
        if (!t) return false;
        const matchListing = plan.listingId && t.listingId === plan.listingId;
        const matchSession = plan.sessionId && t.sessionId === plan.sessionId;
        const isTxnUpgrade =
          t.isUpgrade === true ||
          String(t.eventType).toLowerCase() === "upgrade" ||
          String(t.event).toLowerCase() === "upgrade" ||
          String(t.description || "").toLowerCase().includes("upgrade");
        return (matchListing || matchSession) && isTxnUpgrade;
      });

      // Check if this plan is superseded by a newer sibling plan
      const isSuperseded = Boolean(
        plan.supersededBy ||
        (siblings.length > 1 && siblings[0].id !== plan.id && (siblings[0].upgradedAt || siblings[0].isUpgrade || upgradeTxn))
      );

      // Check if this plan is an upgraded plan
      const isUpgraded = Boolean(
        hasUpgradedAt ||
        isExplicitUpgrade ||
        upgradeTxn ||
        (siblings.length > 1 && siblings[0].id === plan.id && siblings.length > 1)
      );

      const supersededPlan = siblings.find((s) => s.id !== plan.id && s.id !== plan.supersededBy);

      return {
        ...plan,
        isUpgraded,
        isSuperseded,
        upgradeTxn,
        supersededPlan,
        upgradedAtDate: plan.upgradedAt || upgradeTxn?.createdAt || upgradeTxn?.date,
        upgradeDesc:
          upgradeTxn?.description ||
          (isUpgraded ? `Plan upgrade: ${formatPlanName(plan.planId, plan.planName)}` : null),
      };
    });

    // Deduplicate: only non-superseded plans count towards total
    const distinct = processedPlans.filter((p) => !p.isSuperseded);

    const activeCount = distinct.filter((p) => {
      const effectivePlanStatus = getEffectiveListingStatus(
        { status: p.status, active: p.active !== false },
        { plan: p, expiryDate: p.billingPeriodEnd }
      );
      return effectivePlanStatus === "Active" || effectivePlanStatus === "Approved" || effectivePlanStatus === "Extended";
    }).length;

    const upgradedCount = distinct.filter((p) => p.isUpgraded).length;

    return {
      allPlans: processedPlans,
      distinctPlans: distinct,
      activePlansCount: activeCount,
      upgradedPlansCount: upgradedCount,
    };
  }, [partnerPlans, partner?.id, transactions]);

  // 2. Partner's Features (Processed with upgrade detection and deduplication)
  const {
    distinctFeatures,
    activeFeaturesCount,
    supersededFeaturesCount,
  } = useMemo(() => {
    if (!partner || !Array.isArray(featuredPlans)) {
      return { allFeatures: [], distinctFeatures: [], activeFeaturesCount: 0, supersededFeaturesCount: 0 };
    }

    const rawFeatures = featuredPlans
      .filter((f) => f && f.partnerId === partner.id)
      .sort((a, b) => {
        const aTs = a.lastPaymentReceived?.seconds || a.createdAt?.seconds || 0;
        const bTs = b.lastPaymentReceived?.seconds || b.createdAt?.seconds || 0;
        return bTs - aTs;
      });

    // Group features by listingId to link older superseded features with active upgraded features
    const listingFeatsMap = new Map<string, any[]>();
    rawFeatures.forEach((feat) => {
      const key = String(feat.listingId || feat.id);
      if (!listingFeatsMap.has(key)) listingFeatsMap.set(key, []);
      listingFeatsMap.get(key)!.push(feat);
    });

    const processedFeatures = rawFeatures.map((feat) => {
      const key = String(feat.listingId || feat.id);
      const siblings = listingFeatsMap.get(key) || [feat];

      // If multiple siblings exist for the same listing, only the newest is primary; older ones are superseded
      const isNewestSibling = siblings[0]?.id === feat.id;
      const isExplicitSuperseded = Boolean(feat.supersededBy || feat.supersededAt);
      const isSuperseded = siblings.length > 1 ? !isNewestSibling : Boolean(isExplicitSuperseded && feat.active === false);

      // Is upgraded if an older sibling exists with supersededBy/supersededAt or active=false
      const olderSupersededSibling = siblings.find(
        (s) => s.id !== feat.id && (s.supersededBy || s.supersededAt || s.active === false)
      );

      // Check transactions for spotlight upgrade
      const upgradeTxn = transactions?.find((t) => {
        if (!t) return false;
        const matchListing = feat.listingId && t.listingId === feat.listingId;
        const isTxnUpgrade =
          t.isUpgrade === true ||
          String(t.eventType).toLowerCase() === "upgrade" ||
          String(t.event).toLowerCase() === "upgrade" ||
          String(t.description || "").toLowerCase().includes("upgrade");
        return matchListing && isTxnUpgrade;
      });

      const isUpgraded = !isSuperseded && Boolean(olderSupersededSibling || upgradeTxn || feat.isUpgrade);

      const previousFeatureId =
        olderSupersededSibling?.featureId ||
        olderSupersededSibling?.featureName ||
        olderSupersededSibling?.supersededBy;
      const upgradedAtDate =
        olderSupersededSibling?.supersededAt || feat.lastPaymentReceived || upgradeTxn?.createdAt;

      return {
        ...feat,
        isSuperseded,
        isUpgraded,
        olderSupersededSibling,
        previousFeatureId,
        upgradedAtDate,
        upgradeTxn,
      };
    });

    // Deduplicate: only non-superseded features count towards total
    const distinct = processedFeatures.filter((f) => !f.isSuperseded);

    const activeCount = distinct.filter((f) => {
      const effStatus = getEffectiveFeatureStatus(f);
      return effStatus === "Active";
    }).length;

    const supersededCount = processedFeatures.filter((f) => f.isSuperseded).length;

    return {
      allFeatures: processedFeatures,
      distinctFeatures: distinct,
      activeFeaturesCount: activeCount,
      supersededFeaturesCount: supersededCount,
    };
  }, [featuredPlans, partner?.id, transactions]);

  // 3. Partner's Listings (All-time paid listings; exclude unpaid Pending Payment)
  const partnerListingsList = useMemo(() => {
    if (!partner || !Array.isArray(listings)) return [];
    return listings
      .filter((l) => {
        if (!l) return false;
        const pId = l.partnerId || (typeof l.__path === "string" && l.__path.startsWith("partnersCollection/") ? l.__path.split("/")[1] : "");
        if (pId !== partner.id) return false;
        const insight = listingInsights && l?.id ? listingInsights[l.id] : null;
        const status = getEffectiveListingStatus(l, insight);
        return status !== "Pending Payment";
      })
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [listings, partner?.id, listingInsights]);

  // 4. Partner's Transactions (All-time)
  const partnerTransactionsList = useMemo(() => {
    if (!partner || !Array.isArray(transactions)) return [];
    const partnerEmail = typeof partner.primaryEmail === "string" ? partner.primaryEmail.toLowerCase().trim() : "";
    const partnerBillEmail = typeof partner.billingEmailAddress === "string" ? partner.billingEmailAddress.toLowerCase().trim() : "";
    const raw = transactions.filter((t) => {
      if (!t) return false;
      const matchId = t.partnerId === partner.id;
      const custEmail = typeof t.customerEmail === "string" ? t.customerEmail.toLowerCase().trim() : "";
      const matchEmail = Boolean(partnerEmail && custEmail && custEmail === partnerEmail);
      const matchBillEmail = Boolean(partnerBillEmail && custEmail && custEmail === partnerBillEmail);
      return matchId || matchEmail || matchBillEmail;
    });

    const parsed: PartnerTransactionRow[] = [];
    raw.forEach((d) => {
      try {
        if (d) parsed.push(formatPartnerTransaction(d));
      } catch (e) {
        console.error("Failed to format transaction:", d, e);
      }
    });

    return parsed.sort(sortPartnerTransactionsNewestFirst);
  }, [transactions, partner]);

  if (!partner) return null;

  // Calculated Stats
  const activeListingsCount = partnerListingsList.filter((l) => {
    const insight = listingInsights && l?.id ? listingInsights[l.id] : null;
    const status = getEffectiveListingStatus(l, insight);
    return status === "Active" || status === "Approved" || status === "Extended";
  }).length;

  const totalSpent = partnerTransactionsList.reduce((acc, t) => {
    if (t.statusRaw === "succeeded" || String(t.statusLabel || "").toLowerCase() === "completed") {
      return acc + (t.amountNumeric || 0);
    }
    return acc;
  }, 0);

  const latestPlan = distinctPlans[0] || partnerPlansList[0];
  const latestPlanType = resolveItemType(latestPlan, listings, transactions);
  const latestPlanDisplayTitle = latestPlan
    ? formatPlanName(latestPlan.planId, latestPlan.planName)
    : partner.selectedPlan
    ? formatPlanName(partner.selectedPlan)
    : "No Active Plan";

  const latestFeature = distinctFeatures[0];
  const latestFeatureDisplayTitle = latestFeature
    ? formatFeatureName(latestFeature.featureId, latestFeature.featureName)
    : "No Active Features";

  const totalPlansCount = Math.max(distinctPlans.length, partnerListingsList.length);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-slate-50 border-slate-200">
        <DialogHeader className="sr-only">
          <DialogTitle>{partner.businessName || "Partner"} - Plan & Feature History</DialogTitle>
          <DialogDescription>Full history of plans, features, listings, and invoices.</DialogDescription>
        </DialogHeader>

        <ModalErrorBoundary onClose={onClose}>
          {/* Header */}
          <div className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">
                    {partner.businessName || "Unnamed Business"}
                  </h2>
                  <StatusBadge status={partner.partnerStatus || "Pending"} />
                  {partner.createdByAdmin && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                      Admin Created
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span>Contact: <strong className="text-slate-700 font-medium">{partner.primaryName || "—"}</strong></span>
                  <span>•</span>
                  <span>Email: <strong className="text-slate-700 font-medium">{partner.primaryEmail || "—"}</strong></span>
                  {partner.businessCountry && (
                    <>
                      <span>•</span>
                      <span>Country: <strong className="text-slate-700 font-medium">{partner.businessCountry}</strong></span>
                    </>
                  )}
                </p>
              </div>
              <div className="text-xs text-slate-400 self-start sm:text-right">
                <div>Joined {formatDate(partner.createdAt || partner.registeredAt)}</div>
                <div className="mt-1">
                  <CopyableText text={partner.id} label="Partner ID" />
                </div>
              </div>
            </div>

            {/* Top 3 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              <Card className="bg-slate-50/70 border-slate-200 shadow-none">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">Plans</p>
                    {latestPlan && (
                      <Badge className={`${latestPlanType.badgeClass} text-[10px] py-0 px-1.5`}>
                        {latestPlanType.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={latestPlanDisplayTitle}>
                    {latestPlanDisplayTitle}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={latestPlan?.status || (latestPlan ? "Active" : "None")} />
                    {latestPlan?.isUpgraded && (
                      <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] py-0 px-1.5">
                        Upgraded
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-2">
                    <span className="text-emerald-700">{activePlansCount || activeListingsCount} active</span>
                    <span className="text-slate-400 font-normal text-xs ml-1.5">/ {totalPlansCount} total</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {totalPlansCount === 0
                      ? "No plans subscribed"
                      : `${totalPlansCount} total plan${totalPlansCount === 1 ? "" : "s"}${
                          upgradedPlansCount > 0 ? ` (${upgradedPlansCount} upgraded)` : ""
                        }`}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-50/70 border-slate-200 shadow-none">
                <CardContent className="p-3.5">
                  <p className="text-xs font-medium text-slate-500">Features</p>
                  <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={latestFeatureDisplayTitle}>
                    {latestFeatureDisplayTitle}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusBadge status={activeFeaturesCount > 0 ? "Active" : "None"} />
                    {supersededFeaturesCount > 0 && (
                      <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] py-0 px-1.5">
                        {supersededFeaturesCount} Upgraded
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-2">
                    <span className="text-amber-700">{activeFeaturesCount} active</span>
                    <span className="text-slate-400 font-normal text-xs ml-1.5">/ {distinctFeatures.length} total</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {distinctFeatures.length === 0
                      ? "No features granted"
                      : `${distinctFeatures.length} total feature${distinctFeatures.length === 1 ? "" : "s"}${
                          supersededFeaturesCount > 0 ? ` (deduplicated upgrades)` : ""
                        }`}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-50/70 border-slate-200 shadow-none">
                <CardContent className="p-3.5">
                  <p className="text-xs font-medium text-slate-500">Lifetime Invoiced</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    ${(totalSpent || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                      Stripe
                    </Badge>
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-2">
                    {partnerTransactionsList.length} transaction{partnerTransactionsList.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    All-time checkout payments
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Content Body with Tabs */}
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
              <TabsList className="bg-white border border-slate-200 p-1 w-full sm:w-auto grid grid-cols-2 h-auto">
                <TabsTrigger value="plans" className="text-xs sm:text-sm py-2">
                  Plans ({distinctPlans.length})
                </TabsTrigger>
                <TabsTrigger value="features" className="text-xs sm:text-sm py-2">
                  Features ({distinctFeatures.length})
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: PLANS HISTORY */}
              <TabsContent value="plans" className="space-y-3 focus-visible:outline-none">
                {distinctPlans.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <p className="font-semibold text-slate-700">No plan subscriptions found</p>
                    <p className="text-xs text-slate-500 mt-1">This partner does not currently have any active plan records in planCollection.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {distinctPlans.map((plan, idx) => {
                      const isLatest = idx === 0;
                      const isTrial = Boolean(plan.isTrial || plan.source === "admin_granted");
                      const startFormatted = formatDate(plan.startDate || plan.createdAt);
                      const endFormatted = formatDate(plan.billingPeriodEnd || plan.accessThrough);
                      const effectivePlanStatus = getEffectiveListingStatus(
                        { status: plan.status, active: plan.active !== false },
                        { plan, expiryDate: plan.billingPeriodEnd }
                      );
                      const planType = resolveItemType(plan, listings, transactions);

                      return (
                        <Card key={plan.id || idx} className={`bg-white border ${isLatest ? "border-emerald-300 shadow-sm" : "border-slate-200"}`}>
                          <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-slate-900 text-base">
                                  {formatPlanName(plan.planId, plan.planName)}
                                </h3>
                                {/* Type / Category Indicator Badge */}
                                <Badge className={`${planType.badgeClass} text-xs font-medium`}>
                                  {planType.label}
                                </Badge>
                                {isLatest && (
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
                                    Latest Plan
                                  </Badge>
                                )}
                                {plan.isUpgraded && (
                                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-semibold">
                                    Upgraded Plan
                                  </Badge>
                                )}
                                {isTrial && (
                                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[11px]">
                                    Admin Trial
                                  </Badge>
                                )}
                                {(plan.isExtended || plan.status === "Extended") && (
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
                                    Extended
                                  </Badge>
                                )}
                                <StatusBadge status={effectivePlanStatus} />
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <span>Plan Doc ID:</span> <CopyableText text={plan.id} label="Plan ID" />
                              </div>
                            </div>

                            {/* Plan Upgrade Notice Banner */}
                            {plan.isUpgraded && (
                              <div className="mt-3 p-3 bg-purple-50/70 border border-purple-200/80 rounded-lg text-xs text-purple-950 flex items-start gap-2.5">
                                <ArrowUpCircle className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="font-semibold text-purple-900 flex items-center gap-2">
                                    <span>Plan Upgraded</span>
                                    {plan.upgradedAtDate && (
                                      <span className="text-[11px] font-normal text-purple-600">
                                        on {formatDate(plan.upgradedAtDate)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-purple-800 text-[11px] mt-0.5">
                                    {plan.upgradeDesc || `Upgraded to ${formatPlanName(plan.planId, plan.planName)}`}
                                  </p>
                                  {plan.supersededPlan && (
                                    <div className="mt-1 text-[11px] text-purple-700 flex items-center gap-1.5 flex-wrap">
                                      <span>
                                        Previous Plan: <strong>{formatPlanName(plan.supersededPlan.planId, plan.supersededPlan.planName)}</strong>
                                      </span>
                                      <span>•</span>
                                      <span>Previous Doc ID:</span>
                                      <CopyableText text={plan.supersededPlan.id} label="Previous Plan ID" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Plan Key Details */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                              <div>
                                <span className="text-slate-400 block mb-0.5">Start Date</span>
                                <span className="font-medium text-slate-800">{startFormatted}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Expiry / Billing End</span>
                                <span className="font-medium text-slate-800">{endFormatted}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Billing Interval</span>
                                <span className="font-medium text-slate-800 capitalize">
                                  {plan.billingInterval === "annual"
                                    ? "Yearly"
                                    : plan.billingInterval ||
                                      plan.interval ||
                                      (typeof plan.planName === "string" && plan.planName.toLowerCase().includes("yr")
                                        ? "Yearly"
                                        : "Monthly")}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Category</span>
                                <span className="font-medium text-slate-800">{planType.label}</span>
                              </div>
                            </div>

                            {/* Target Listing Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                              <div>
                                <span className="text-slate-400 block mb-0.5">Target Listing</span>
                                <span className="font-semibold text-slate-800 text-xs block truncate" title={planType.listingName || "Account-level Plan"}>
                                  {planType.listingName || "Account-level Plan"}
                                </span>
                                {plan.listingId && (
                                  <div className="mt-0.5">
                                    <CopyableText text={plan.listingId} label="Listing ID" />
                                  </div>
                                )}
                              </div>
                              {(plan.cancelledAt || plan.canceledAt) && (
                                <div>
                                  <span className="text-slate-400 block mb-0.5">Cancelled On</span>
                                  <span className="text-rose-600 font-medium">{formatDate(plan.cancelledAt || plan.canceledAt)}</span>
                                </div>
                              )}
                              {plan.price != null && !isNaN(Number(plan.price)) && (
                                <div>
                                  <span className="text-slate-400 block mb-0.5">Plan Price</span>
                                  <span className="font-medium text-slate-800">${Number(plan.price).toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: FEATURES */}
              <TabsContent value="features" className="space-y-3 focus-visible:outline-none">
                {distinctFeatures.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <p className="font-semibold text-slate-700">No features recorded</p>
                    <p className="text-xs text-slate-500 mt-1">This partner has not purchased or been granted any features.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {distinctFeatures.map((feat, idx) => {
                      const isTrial = Boolean(feat.isTrial || feat.source === "admin_granted");
                      const startFormatted = formatDate(feat.lastPaymentReceived || feat.createdAt);
                      const endFormatted = formatDate(feat.accessThrough || feat.billingPeriodEnd);
                      const effectiveFeatStatus = getEffectiveFeatureStatus(feat);
                      const featType = resolveItemType(feat, listings, transactions);

                      return (
                        <Card key={feat.id || idx} className="bg-white border border-slate-200">
                          <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-slate-900 text-base">
                                  {formatFeatureName(feat.featureId, feat.featureName)}
                                </h3>
                                {/* Category / Type Indicator Badge */}
                                <Badge className={`${featType.badgeClass} text-xs font-medium`}>
                                  {featType.label}
                                </Badge>
                                {feat.isUpgraded && (
                                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-semibold">
                                    Upgraded Feature
                                  </Badge>
                                )}
                                {isTrial && (
                                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[11px]">
                                    Admin Granted
                                  </Badge>
                                )}
                                <StatusBadge status={effectiveFeatStatus} />
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <span>Feature Doc ID:</span> <CopyableText text={feat.id} label="Feature ID" />
                              </div>
                            </div>

                            {/* Feature Upgrade Notice Banner */}
                            {feat.isUpgraded && (
                              <div className="mt-3 p-3 bg-purple-50/70 border border-purple-200/80 rounded-lg text-xs text-purple-950 flex items-start gap-2.5">
                                <ArrowUpCircle className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="font-semibold text-purple-900 flex items-center gap-2">
                                    <span>Feature Upgraded</span>
                                    {feat.upgradedAtDate && (
                                      <span className="text-[11px] font-normal text-purple-600">
                                        on {formatDate(feat.upgradedAtDate)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-purple-800 text-[11px] mt-0.5">
                                    Upgraded from <strong>{formatFeatureName(feat.previousFeatureId)}</strong>
                                    {feat.upgradeTxn?.description ? ` • ${feat.upgradeTxn.description}` : ""}
                                  </p>
                                  {feat.olderSupersededSibling?.id && (
                                    <div className="mt-1 text-[11px] text-purple-700 flex items-center gap-1.5 flex-wrap">
                                      <span>Previous Doc ID:</span>
                                      <CopyableText text={feat.olderSupersededSibling.id} label="Previous Feature ID" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Feature Key Details */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                              <div>
                                <span className="text-slate-400 block mb-0.5">Purchased / Granted</span>
                                <span className="font-medium text-slate-800">{startFormatted}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Access Through</span>
                                <span className="font-medium text-slate-800">{endFormatted}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Category</span>
                                <span className="font-medium text-slate-800">{featType.label}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Source</span>
                                <span className="font-medium text-slate-800 capitalize">
                                  {feat.source ? String(feat.source).replace(/_/g, " ") : "Standard Feature"}
                                </span>
                              </div>
                            </div>

                            {/* Target Listing Details */}
                            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                              <div>
                                <span className="text-slate-400 block mb-0.5">Target Listing</span>
                                <span className="font-semibold text-slate-800 text-xs block truncate" title={featType.listingName || "Primary Account"}>
                                  {featType.listingName || "Primary Account"}
                                </span>
                                {feat.listingId && (
                                  <div className="mt-0.5">
                                    <CopyableText text={feat.listingId} label="Listing ID" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Collapsible Previous Version if Available */}
                            {feat.olderSupersededSibling && (
                              <details className="mt-3 pt-2 border-t border-slate-100 text-xs group">
                                <summary className="cursor-pointer text-purple-700 hover:text-purple-900 font-medium list-none flex items-center justify-between py-1 select-none">
                                  <span>View Prior Version ({formatFeatureName(feat.olderSupersededSibling.featureId)})</span>
                                  <span className="text-slate-400 text-[10px] group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-800">
                                      {formatFeatureName(feat.olderSupersededSibling.featureId)}
                                    </span>
                                    <Badge className="bg-slate-200 text-slate-700 border-slate-300 text-[10px]">
                                      Superseded by Upgrade
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                                    <div>
                                      <span className="text-slate-400 block">Doc ID</span>
                                      <CopyableText text={feat.olderSupersededSibling.id} label="Superseded Feature Doc ID" />
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block">Superseded On</span>
                                      <span className="font-medium text-slate-700">
                                        {formatDate(feat.olderSupersededSibling.supersededAt || feat.upgradedAtDate)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </details>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ModalErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

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
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
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
  if (s.includes("incomplete") || s.includes("error") || s.includes("past_due") || s.includes("failed")) {
    return (
      <Badge className="bg-red-50 text-red-700 border-red-200 font-medium">
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

  // 1. Partner's Plans (All-time)
  const partnerPlansList = useMemo(() => {
    if (!partner || !Array.isArray(partnerPlans)) return [];
    return partnerPlans
      .filter((p) => p && p.partnerId === partner.id)
      .sort((a, b) => {
        const aTs = a.startDate?.seconds || a.createdAt?.seconds || 0;
        const bTs = b.startDate?.seconds || b.createdAt?.seconds || 0;
        return bTs - aTs;
      });
  }, [partnerPlans, partner?.id]);

  // 2. Partner's Features (All-time — every feature plan record, not just the latest)
  const partnerFeaturesList = useMemo(() => {
    if (!partner || !Array.isArray(featuredPlans)) return [];
    return featuredPlans
      .filter((f) => f && f.partnerId === partner.id)
      .sort((a, b) => {
        const aTs = a.lastPaymentReceived?.seconds || a.createdAt?.seconds || 0;
        const bTs = b.lastPaymentReceived?.seconds || b.createdAt?.seconds || 0;
        return bTs - aTs;
      });
  }, [featuredPlans, partner?.id]);

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

  // Calculated Stats - accurately synchronized with AdminDashboard getEffectiveListingStatus
  const activeListingsCount = partnerListingsList.filter((l) => {
    const insight = listingInsights && l?.id ? listingInsights[l.id] : null;
    const status = getEffectiveListingStatus(l, insight);
    return status === "Active" || status === "Approved" || status === "Extended";
  }).length;

  let activeFeaturesCount = 0;
  partnerListingsList.forEach((listing) => {
    const insight = listingInsights && listing?.id ? listingInsights[listing.id] : null;
    const status = getEffectiveListingStatus(listing, insight);
    const isActiveListing = status === "Active" || status === "Approved" || status === "Extended";
    if (isActiveListing) {
      const featStatus = insight?.featureStatus || getEffectiveFeatureStatus(insight?.feature, listing);
      if (featStatus === "Active") {
        activeFeaturesCount += 1;
      }
    }
  });

  const totalSpent = partnerTransactionsList.reduce((acc, t) => {
    if (t.statusRaw === "succeeded" || String(t.statusLabel || "").toLowerCase() === "completed") {
      return acc + (t.amountNumeric || 0);
    }
    return acc;
  }, 0);

  const latestPlan = partnerPlansList[0];

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
                  <p className="text-xs font-medium text-slate-500">
                    Plans
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={latestPlan?.planName || latestPlan?.planId || partner.selectedPlan || "None"}>
                    {latestPlan?.planName || latestPlan?.planId || partner.selectedPlan || "No Active Plan"}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    <StatusBadge status={latestPlan?.status || (latestPlan ? "Active" : "None")} />
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-2">
                    <span className="text-emerald-700">{activeListingsCount} active</span>
                    <span className="text-slate-400 font-normal text-xs ml-1.5">/ {partnerListingsList.length} total</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {partnerListingsList.length === 0 ? "No listings created" : `${partnerListingsList.length} all-time listings`}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-50/70 border-slate-200 shadow-none">
                <CardContent className="p-3.5">
                  <p className="text-xs font-medium text-slate-500">
                    Features
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    <span className="text-amber-700">{activeFeaturesCount} active</span>
                    <span className="text-slate-400 font-normal text-xs ml-1.5">/ {partnerFeaturesList.length} total</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {partnerFeaturesList.length === 0 ? "No features granted" : `${partnerFeaturesList.length} all-time features`}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-50/70 border-slate-200 shadow-none">
                <CardContent className="p-3.5">
                  <p className="text-xs font-medium text-slate-500">
                    Lifetime Invoiced
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    ${(totalSpent || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {partnerTransactionsList.length} transaction{partnerTransactionsList.length === 1 ? "" : "s"}
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
                  Plans ({partnerPlansList.length})
                </TabsTrigger>
                <TabsTrigger value="features" className="text-xs sm:text-sm py-2">
                  Features ({partnerFeaturesList.length})
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: PLANS HISTORY */}
              <TabsContent value="plans" className="space-y-3 focus-visible:outline-none">
                {partnerPlansList.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <p className="font-semibold text-slate-700">No plan subscriptions found</p>
                    <p className="text-xs text-slate-500 mt-1">This partner does not currently have any plan records in planCollection.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {partnerPlansList.map((plan, idx) => {
                      const isLatest = idx === 0;
                      const isTrial = Boolean(plan.isTrial || plan.source === "admin_granted");
                      const startFormatted = formatDate(plan.startDate || plan.createdAt);
                      const endFormatted = formatDate(plan.billingPeriodEnd || plan.accessThrough);
                      const effectivePlanStatus = getEffectiveListingStatus(
                        { status: plan.status, active: plan.active !== false },
                        { plan, expiryDate: plan.billingPeriodEnd }
                      );

                      return (
                        <Card key={plan.id || idx} className={`bg-white border ${isLatest ? "border-emerald-300 shadow-sm" : "border-slate-200"}`}>
                          <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-slate-900 text-base">
                                  {plan.planName || plan.planId || "Standard Plan"}
                                </h3>
                                {isLatest && (
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
                                    Latest Plan
                                  </Badge>
                                )}
                                {isTrial && (
                                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[11px]">
                                    Admin Trial
                                  </Badge>
                                )}
                                <StatusBadge status={effectivePlanStatus} />
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <span>Plan Doc ID:</span> <CopyableText text={plan.id} label="Plan ID" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 text-xs">
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
                                  {plan.billingInterval === "annual" ? "Yearly" : (plan.billingInterval || plan.interval || (typeof plan.planName === "string" && plan.planName.toLowerCase().includes("yr") ? "Yearly" : "Monthly"))}
                                </span>
                              </div>
                            </div>

                            {(plan.listingId || plan.cancelAt || plan.canceledAt || plan.price != null) && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                                {plan.listingId && (
                                  <div>
                                    <span className="text-slate-400 block mb-0.5">Target Listing ID</span>
                                    <CopyableText text={plan.listingId} label="Listing ID" />
                                  </div>
                                )}
                                {(plan.cancelAt || plan.canceledAt) && (
                                  <div>
                                    <span className="text-slate-400 block mb-0.5">Cancelled On</span>
                                    <span className="text-rose-600 font-medium">{formatDate(plan.cancelAt || plan.canceledAt)}</span>
                                  </div>
                                )}
                                {plan.price != null && !isNaN(Number(plan.price)) && (
                                  <div>
                                    <span className="text-slate-400 block mb-0.5">Plan Price</span>
                                    <span className="font-medium text-slate-800">${Number(plan.price).toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: FEATURES */}
              <TabsContent value="features" className="space-y-3 focus-visible:outline-none">
                {partnerFeaturesList.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <p className="font-semibold text-slate-700">No features recorded</p>
                    <p className="text-xs text-slate-500 mt-1">This partner has not purchased or been granted any features.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {partnerFeaturesList.map((feat, idx) => {
                      const isTrial = Boolean(feat.isTrial || feat.source === "admin_granted");
                      const startFormatted = formatDate(feat.lastPaymentReceived || feat.createdAt);
                      const endFormatted = formatDate(feat.accessThrough || feat.billingPeriodEnd);
                      const effectiveFeatStatus = getEffectiveFeatureStatus(feat);

                      return (
                        <Card key={feat.id || idx} className="bg-white border border-slate-200">
                          <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-slate-900 text-base">
                                  {feat.featureName || feat.featureId || "Feature"}
                                </h3>
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

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 text-xs">
                              <div>
                                <span className="text-slate-400 block mb-0.5">Purchased / Granted</span>
                                <span className="font-medium text-slate-800">{startFormatted}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Access Through</span>
                                <span className="font-medium text-slate-800">{endFormatted}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Target Listing</span>
                                <CopyableText text={feat.listingId || "Primary Account"} label="Listing ID" />
                              </div>
                            </div>
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

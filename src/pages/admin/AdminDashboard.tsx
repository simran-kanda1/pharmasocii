import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  XCircle,
  Clock,
  Download,
  ExternalLink,
  Flag,
  Eye,
  FileText,
  FileSpreadsheet,
  Globe,
  History,
  HelpCircle,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquare,
  MoreVertical,
  MoveHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
  SearchX,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  User,
  Users,
  Mail,
  Trash2,
  Info,
} from "lucide-react";
import { db, auth, storage } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { onAuthStateChanged, signOut } from "firebase/auth";
import PlansCMS from "./PlansCMS";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { useDirectoryCategories } from "@/hooks/useDirectoryCategories";
import {
  normalizeGroupKey,
  type SubcategoryEntry,
} from "@/lib/defaultDirectoryCategories";
import { DEFAULT_COMMUNITY_CATEGORIES } from "@/lib/defaultCommunityCategories";
import type { CommunityCategoryDoc } from "@/lib/communityTypes";
import {
  ensureCommunityCategoryDoc,
  normalizeForFirestore,
  validateCommunityCategoryDoc,
} from "@/lib/communityCategoryEditorUtils";
import { CommunityCategoryTreeEditor } from "@/components/admin/CommunityCategoryTreeEditor";
import { VerificationMirrorsPanel } from "@/components/admin/VerificationMirrorsPanel";
import { AdminMembersPanel } from "@/components/admin/AdminMembersPanel";
import { AdminMemberPostsPanel } from "@/components/admin/AdminMemberPostsPanel";
import { AdminArchivedPostsPanel } from "@/components/admin/AdminArchivedPostsPanel";
import { AdminReportedCommentsPanel } from "@/components/admin/AdminReportedCommentsPanel";
import { AdminEmailLogPanel } from "@/components/admin/AdminEmailLogPanel";
import { seedCommunityCategoriesIfMissing } from "@/lib/seedCommunityCategories";
import { AdminAddPartner } from "@/components/admin/AdminAddPartner";

const getSubLabel = (entry: SubcategoryEntry): string =>
  typeof entry === "string" ? entry : entry.label;

const hasSubSub = (entry: SubcategoryEntry): entry is { label: string; subSubcategories: string[] } =>
  typeof entry !== "string";
import { AdminAddCategory } from "@/components/admin/AdminAddCategory";

import { AdminAddFeaturedPlan } from "@/components/admin/AdminAddFeaturedPlan";
import { useFeaturedPlansConfig, type FeaturedPlanOption, type FeaturedPlansConfig } from "@/hooks/useFeaturedPlansConfig";
import { AdminSitePoliciesPanel } from "@/components/admin/AdminSitePoliciesPanel";
import { AdminFaqsPanel } from "@/components/admin/AdminFaqsPanel";
import { AdminContactPanel } from "@/components/admin/AdminContactPanel";
import { AdminHealthAuthoritiesPanel } from "@/components/admin/AdminHealthAuthoritiesPanel";
import { AdminEditCategoryModal } from "@/components/admin/AdminEditCategoryModal";

import { SERVICE_COUNTRIES, SERVICE_REGIONS } from "@/constants/regions";
import {
  formatPartnerTransaction,
  sortPartnerTransactionsNewestFirst,
  type PartnerTransactionRow,
} from "@/lib/partnerTransactions";
import {
  downloadPartnerTransactionsCsv,
  downloadPartnerTransactionsExcel,
  downloadPartnerTransactionsPdf,
} from "@/lib/transactionExport";

type AdminTab =
  | "overview"
  | "partners"
  | "listings"
  | "plans"
  | "featuredPlans"
  | "categories"
  | "healthAuthorities"
  | "policies"
  | "faqs"
  | "contact"
  | "communityMembers"
  | "communityPosts"
  | "communityArchivePosts"
  | "communityReportedComments"
  | "communityCategories"
  | "emailLog"
  | "settings"
  | "transactions"
  | "audit";
type ListingFilter = "all" | "active" | "approved" | "cancelled" | "expired" | "incomplete_payment" | "payment_error" | "disabled" | "pending";
const COMPANY_PROFILE_MAX_LENGTH = 1000;

type PartnerRecord = {
  id: string;
  businessName?: string;
  primaryName?: string;
  primaryEmail?: string;
  companyWebsite?: string;
  phoneNumber?: string;
  businessAddress?: string;
  partnerStatus?: string;
  [key: string]: any;
};

type ListingRecord = {
  id: string;
  businessName?: string;
  companyWebsite?: string;
  selectedPlan?: string;
  status?: string;
  active?: boolean;
  selectedCategories?: string[];
  serviceCountries?: string[];
  serviceRegions?: string[];
  companyProfileText?: string;
  businessAddress?: string;
  createdAt?: { seconds?: number };
  __col: string;
  __path: string;
  [key: string]: any;
};

type PartnerPlanRecord = {
  id: string;
  partnerId: string;
  planId?: string;
  planName?: string;
  isTrial?: boolean;
  startDate?: any;
  billingPeriodEnd?: any;
  createdAt?: { seconds?: number };
  active?: boolean;
};

type FeaturedPlanPurchase = {
  id: string;
  partnerId: string;
  featureId?: string;
  featureName?: string;
  active?: boolean;
  accessThrough?: any;
  lastPaymentReceived?: any;
  isTrial?: boolean;
  trialPeriod?: string | null;
  createdAt?: { seconds?: number };
};

type AdminSettingsRecord = {
  email?: string;
  phone?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  instagram?: string;
  logoUrl?: string;
};

function MultiSelectDropdown({
  label,
  items,
  selected,
  onToggle,
  placeholder,
  disabled,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  return (
    <div className="space-y-1 relative">
      <p className={`text-sm font-medium ${disabled ? "text-slate-500" : "text-slate-700"}`}>{label}</p>
      
      {/* Selector Box */}
      <div
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
        className={`flex min-h-[40px] w-full items-center justify-between gap-2 flex-wrap rounded-md border border-slate-200 px-3 py-2 text-sm transition-colors ${
          disabled ? "bg-slate-50 cursor-not-allowed text-slate-500" : "bg-white cursor-pointer hover:border-slate-300"
        }`}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {selected.length === 0 ? (
            <span className="text-slate-400">{placeholder || `Select ${label.toLowerCase()}...`}</span>
          ) : (
            [...selected].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })).map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-100"
              >
                {item}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(item);
                    }}
                    className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        {!disabled && <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </div>

      {/* Dropdown Menu */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setSearch("");
            }}
          />
          <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1">
            <div className="px-2 py-1.5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <Input
                placeholder="Search options..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            {filteredItems.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400 text-center">No options found</div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selected.includes(item);
                return (
                  <div
                    key={item}
                    onClick={() => onToggle(item)}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      isSelected ? "bg-slate-50 text-blue-600 font-medium" : "text-slate-700"
                    }`}
                  >
                    <span>{item}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CategoryTreeDropdown({
  selectedGroup,
  selectedCategories = [],
  selectedSubcategories = [],
  selectedSubSubcategories = [],
  onChange,
  disabled,
}: {
  selectedGroup: string;
  selectedCategories?: string[];
  selectedSubcategories?: string[];
  selectedSubSubcategories?: string[];
  onChange: (updates: {
    selectedCategories: string[];
    selectedSubcategories: string[];
    selectedSubSubcategories: string[];
  }) => void;
  disabled?: boolean;
}) {
  const { getCategoriesForGroup } = useDirectoryCategories();
  const [open, setOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [expandedSubs, setExpandedSubs] = useState<string[]>([]);

  const catDict = useMemo(() => {
    return getCategoriesForGroup(selectedGroup);
  }, [selectedGroup, getCategoriesForGroup]);

  // Auto-expand parents based on initial selection when opening the dropdown
  useEffect(() => {
    if (open && catDict) {
      const autoCats: string[] = [];
      const autoSubs: string[] = [];
      Object.entries(catDict).forEach(([cat, subs]) => {
        const hasSubs = subs.length > 0;
        if (hasSubs) {
          const anySubSelected = subs.some((subEntry) => {
            const subLabel = getSubLabel(subEntry);
            const subSubSelected =
              hasSubSub(subEntry) &&
              subEntry.subSubcategories?.some((ss) => selectedSubSubcategories.includes(ss));
            const subSelected = selectedSubcategories.includes(subLabel);
            if (subSelected || subSubSelected) {
              if (hasSubSub(subEntry) && subSubSelected) {
                autoSubs.push(subLabel);
              }
              return true;
            }
            return false;
          });
          if (anySubSelected || selectedCategories.includes(cat)) {
            autoCats.push(cat);
          }
        }
      });
      setExpandedCats(autoCats);
      setExpandedSubs(autoSubs);
    }
  }, [open, catDict]);

  if (!catDict) return null;

  const isBusinessGroup =
    selectedGroup.toLowerCase().replace(" ", "_") === "business_offerings" ||
    selectedGroup.toLowerCase().replace(" ", "_") === "business";

  const toggleCategorySelection = (cat: string, hasSubs: boolean) => {
    if (hasSubs) {
      setExpandedCats((prev) =>
        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
      );
    } else {
      const current = [...selectedCategories];
      const updated = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat];
      onChange({
        selectedCategories: updated,
        selectedSubcategories,
        selectedSubSubcategories,
      });
    }
  };

  const toggleSubcategorySelection = (cat: string, sub: string, hasSubSubs: boolean) => {
    const compositeKey = `${cat} > ${sub}`;
    if (hasSubSubs) {
      setExpandedSubs((prev) =>
        prev.includes(compositeKey) || prev.includes(sub)
          ? prev.filter((s) => s !== compositeKey && s !== sub)
          : [...prev, compositeKey]
      );
    } else {
      const current = [...selectedSubcategories];
      const isChecked = current.includes(compositeKey) || current.includes(sub);
      const updated = isChecked
        ? current.filter((s) => s !== compositeKey && s !== sub)
        : [...current, compositeKey];
      onChange({
        selectedCategories,
        selectedSubcategories: updated,
        selectedSubSubcategories,
      });
    }
  };

  const toggleSubSubcategorySelection = (cat: string, sub: string, subSub: string) => {
    const compositeKey = `${cat} > ${sub} > ${subSub}`;
    const current = [...selectedSubSubcategories];
    const isChecked = current.includes(compositeKey) || current.includes(subSub);
    const updated = isChecked
      ? current.filter((ss) => ss !== compositeKey && ss !== subSub)
      : [...current, compositeKey];
    onChange({
      selectedCategories,
      selectedSubcategories,
      selectedSubSubcategories: updated,
    });
  };

  const hasAnySelection =
    selectedCategories.length > 0 ||
    selectedSubcategories.length > 0 ||
    selectedSubSubcategories.length > 0;

  return (
    <div className="space-y-1 relative">
      <p className="text-sm font-medium text-slate-700">Categories, Subcategories & Sub-Subcategories</p>

      {/* Selector Box */}
      <div
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
        className={`flex min-h-[40px] w-full items-center justify-between gap-2 flex-wrap rounded-md border border-slate-200 px-3 py-2 text-sm transition-colors ${
          disabled ? "bg-slate-50 cursor-not-allowed text-slate-500" : "bg-white cursor-pointer hover:border-slate-300"
        }`}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {!hasAnySelection ? (
            <span className="text-slate-400">Select categories & specializations...</span>
          ) : (
            <>
              {selectedCategories.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded border border-blue-100 animate-fadeIn"
                >
                  {c}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategorySelection(c, false);
                      }}
                      className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {selectedSubcategories.map((s) => {
                const parts = s.split(" > ");
                const leaf = parts[parts.length - 1];
                return (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded border border-green-100 animate-fadeIn"
                  >
                    {leaf}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (parts.length >= 2) toggleSubcategorySelection(parts[0], parts[1], false);
                          else toggleSubcategorySelection("", s, false);
                        }}
                        className="hover:bg-green-100 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}
              {selectedSubSubcategories.map((ss) => {
                const parts = ss.split(" > ");
                const leaf = parts[parts.length - 1];
                return (
                  <span
                    key={ss}
                    className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded border border-purple-100 animate-fadeIn"
                  >
                    {leaf}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (parts.length >= 3) toggleSubSubcategorySelection(parts[0], parts[1], parts[2]);
                          else toggleSubSubcategorySelection("", "", ss);
                        }}
                        className="hover:bg-purple-100 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </>
          )}
        </div>
        {!disabled && <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </div>

      {/* Dropdown Menu */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 mt-1 w-full max-h-[380px] overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg p-4 space-y-2">
            {Object.entries(catDict).map(([cat, subs]) => {
              const hasSubs = subs.length > 0;
              const isExpanded = expandedCats.includes(cat);
              const isParentSelected = selectedCategories.includes(cat);

              const isAnySubSelected = hasSubs && subs.some((entry) => {
                const subLabel = getSubLabel(entry);
                const isNested = isBusinessGroup && hasSubSub(entry);
                const compositeSubKey = `${cat} > ${subLabel}`;
                if (selectedSubcategories.includes(compositeSubKey) || selectedSubcategories.includes(subLabel)) return true;
                if (isNested && entry.subSubcategories) {
                  return entry.subSubcategories.some((ss) => {
                    const compositeSsKey = `${cat} > ${subLabel} > ${ss}`;
                    return selectedSubSubcategories.includes(compositeSsKey) || selectedSubSubcategories.includes(ss);
                  });
                }
                return false;
              });

              return (
                <div key={cat} className="flex flex-col">
                  {/* Category Row */}
                  <div className="flex items-start gap-2 py-1">
                    {hasSubs ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategorySelection(cat, true);
                        }}
                        className="mt-0.5 flex-shrink-0 text-slate-500 hover:text-slate-900"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    ) : (
                      <span className="w-4 h-4 flex-shrink-0" />
                    )}

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`admin-cat-${cat}`}
                        checked={hasSubs ? isAnySubSelected : isParentSelected}
                        onCheckedChange={() => toggleCategorySelection(cat, hasSubs)}
                        className={hasSubs && isAnySubSelected ? "border-green-500 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}
                      />
                      <label
                        htmlFor={`admin-cat-${cat}`}
                        className={`text-sm leading-none cursor-pointer select-none ${
                          hasSubs ? "font-semibold text-slate-900" : "font-medium text-slate-700"
                        }`}
                      >
                        {cat}
                      </label>
                    </div>
                  </div>

                  {hasSubs && isExpanded && (
                    <div className="ml-8 pl-3 border-l-2 border-green-500/30 space-y-1 mb-2">
                      {subs.map((entry: SubcategoryEntry) => {
                        const subLabel = getSubLabel(entry);
                        const isNested = isBusinessGroup && hasSubSub(entry);
                        const compositeSubKey = `${cat} > ${subLabel}`;
                        const isSubChecked = selectedSubcategories.includes(compositeSubKey) || selectedSubcategories.includes(subLabel);
                        const isSubExpanded = expandedSubs.includes(compositeSubKey) || expandedSubs.includes(subLabel);

                        return (
                          <div key={subLabel} className="flex flex-col">
                            {/* Subcategory Row */}
                            <div className="flex items-center gap-1.5 py-0.5">
                              {isNested ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSubcategorySelection(cat, subLabel, true);
                                  }}
                                  className="flex-shrink-0 text-slate-500 hover:text-slate-900"
                                >
                                  {isSubExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                              ) : (
                                <span className="w-3.5 h-3.5 flex-shrink-0" />
                              )}

                              <Checkbox
                                id={`admin-sub-${cat}-${subLabel}`}
                                checked={isNested ? isSubExpanded : isSubChecked}
                                onCheckedChange={() => toggleSubcategorySelection(cat, subLabel, isNested)}
                                className={`${isSubChecked ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`}
                              />
                              <label
                                htmlFor={`admin-sub-${cat}-${subLabel}`}
                                className="text-sm text-green-700 cursor-pointer select-none"
                              >
                                {subLabel}
                              </label>
                            </div>

                            {/* Sub-Subcategories (Indented) */}
                            {isNested && isSubExpanded && hasSubSub(entry) && (
                              <div className="ml-6 pl-3 border-l border-blue-500/20 space-y-0.5 mb-1">
                                {entry.subSubcategories.map((ssLabel: string) => {
                                  const compositeSsKey = `${cat} > ${subLabel} > ${ssLabel}`;
                                  const isSsChecked = selectedSubSubcategories.includes(compositeSsKey) || selectedSubSubcategories.includes(ssLabel);
                                  return (
                                    <div key={ssLabel} className="flex items-center gap-2 py-0.5">
                                      <Checkbox
                                        id={`admin-ssub-${cat}-${subLabel}-${ssLabel}`}
                                        checked={isSsChecked}
                                        onCheckedChange={() => toggleSubSubcategorySelection(cat, subLabel, ssLabel)}
                                        className={`${isSsChecked ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`}
                                      />
                                      <label
                                        htmlFor={`admin-ssub-${cat}-${subLabel}-${ssLabel}`}
                                        className="text-xs text-slate-500 cursor-pointer select-none"
                                      >
                                        {ssLabel}
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const getCollectionLabel = (collectionName: string) => {
  switch (collectionName) {
    case "businessOfferingsCollection":
      return "Business Offering";
    case "consultingServicesCollection":
    case "consultingCollection":
      return "Consulting Service";
    case "eventsCollection":
      return "Event";
    case "jobsCollection":
      return "Job";
    default:
      return collectionName;
  }
};

const formatAdminDate = (val: any) => {
  if (!val) return "-";
  let d: Date;
  if (val.seconds) {
    d = new Date(val.seconds * 1000);
  } else if (typeof val.toDate === "function") {
    d = val.toDate();
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return "-";
  // Format as dd-mm-yyyy
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

function parseTimestampMs(val: any): number | null {
  if (!val) return null;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (typeof val.toDate === "function") return val.toDate().getTime();
  if (val.seconds != null) return val.seconds * 1000;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.getTime();
  if (typeof val === "number") return val > 1e12 ? val : val * 1000;
  if (typeof val === "string") {
    const t = new Date(val).getTime();
    return isNaN(t) ? null : t;
  }
  return null;
}

function getEffectiveListingStatus(listing: ListingRecord, insight?: any): string {
  const plan = insight?.plan;

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

  if (isExplicitExpired || (isDateExpired && stripeStatus !== "active" && stripeStatus !== "trialing")) {
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

function getEffectiveFeatureStatus(feature?: any, listing?: any): string {
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

  if (isExplicitExpired || (isDateExpired && stripeStatus !== "active" && stripeStatus !== "trialing")) {
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

const getStatusBadge = (status?: string) => {
  const norm = String(status || "").trim().toLowerCase();
  switch (norm) {
    case "approved":
    case "active":
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
    case "pending review":
    case "pending":
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>;
    case "disabled":
      return <Badge className="bg-slate-200 text-slate-700 border-slate-300">Disabled</Badge>;
    case "cancelled":
    case "canceled":
      return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Cancelled</Badge>;
    case "expired":
      return <Badge className="bg-orange-50 text-orange-700 border-orange-200">Expired</Badge>;
    case "incomplete payment":
    case "incomplete_payment":
    case "payment error":
    case "payment_error":
    case "past due":
    case "past_due":
    case "unpaid":
      return <Badge className="bg-red-50 text-red-700 border-red-200">Incomplete Payment</Badge>;
    case "extended":
      return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Active</Badge>;
    default:
      return <Badge variant="outline">{status || "Unknown"}</Badge>;
  }
};

function formatUserPlan(planRaw?: string, planRecord?: any): string {
  const candidate = (
    planRaw ||
    planRecord?.planName ||
    planRecord?.planId ||
    planRecord?.name ||
    ""
  ).trim();

  if (!candidate || candidate === "-" || candidate.toLowerCase() === "none") {
    return "-";
  }

  const lower = candidate.toLowerCase().replace(/_/g, " ");

  // Determine interval / duration
  let duration = "";
  if (
    lower.includes("yr") ||
    lower.includes("year") ||
    lower.includes("annual") ||
    lower.includes("annually") ||
    planRecord?.billingInterval === "year" ||
    planRecord?.billingInterval === "yr" ||
    planRecord?.interval === "year" ||
    planRecord?.interval === "yr"
  ) {
    duration = "yr";
  } else if (
    lower.includes("mo") ||
    lower.includes("month") ||
    lower.includes("monthly") ||
    lower.includes("job") ||
    lower.includes("event") ||
    planRecord?.billingInterval === "month" ||
    planRecord?.billingInterval === "mo" ||
    planRecord?.interval === "month" ||
    planRecord?.interval === "mo"
  ) {
    duration = "mo";
  } else {
    // Default fallback interval for listings/plans if not specified
    duration = "mo";
  }

  // Determine tier
  let tier = "";
  if (lower.includes("premium plus") || lower.includes("premiumplus")) {
    tier = "premium plus";
  } else if (lower.includes("premium") || lower.includes("prem")) {
    tier = "premium";
  } else if (lower.includes("standard") || lower.includes("std")) {
    tier = "standard";
  } else if (lower.includes("basic")) {
    tier = "basic";
  } else if (lower.includes("free")) {
    return "free";
  } else {
    // Clean out known extraneous words (job, event, offering, dollar signs, amounts, parentheses, etc.)
    const cleaned = lower
      .replace(/\b(job|jobs|event|events|offering|offerings|consulting|service|services|business|listing|listings)\b/gi, "")
      .replace(/\b(mo|month|monthly|yr|year|yearly|annual|annually)\b/gi, "")
      .replace(/[\$\(\)\-\,\d\.\/]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    tier = cleaned;
  }

  if (!tier) return duration || "-";
  return `${tier} ${duration}`.trim();
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    businessCategories,
    consultingCategories,
    eventsCategories,
    jobsCategories,
    allBusinessCategories,
    allConsultingCategories,
    allEventsCategories,
    allJobsCategories,
    categoryMetadataMap,
  } = useDirectoryCategories();

  const { config: featuredPlansConfig, saveConfig: saveFeaturedPlansConfig } = useFeaturedPlansConfig();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [partnerPlans, setPartnerPlans] = useState<PartnerPlanRecord[]>([]);
  const [featuredPlans, setFeaturedPlans] = useState<FeaturedPlanPurchase[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [partnerAdminFilter, setPartnerAdminFilter] = useState<"all" | "admin" | "non-admin">("all");
  const [listingSearchTerm, setListingSearchTerm] = useState("");
  const [listingFilter, setListingFilter] = useState<ListingFilter>("all");
  const [listingTypeFilter, setListingTypeFilter] = useState<string>("all");
  const [isAddingPartner, setIsAddingPartner] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [isAddingFeaturedPlan, setIsAddingFeaturedPlan] = useState(false);
  const [editingFeaturedPlan, setEditingFeaturedPlan] = useState<(FeaturedPlanOption & { groupName?: string }) | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState("");
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<"all" | "partner" | "listing">("all");
  const [settingsData, setSettingsData] = useState<AdminSettingsRecord>({
    email: "",
    phone: "",
    facebook: "",
    twitter: "",
    linkedin: "",
    youtube: "",
    instagram: "",
    logoUrl: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [communityCategoriesDraft, setCommunityCategoriesDraft] = useState<CommunityCategoryDoc | null>(null);
  const [communityCategoriesLoading, setCommunityCategoriesLoading] = useState(false);
  const [communityCategoriesSaving, setCommunityCategoriesSaving] = useState(false);
  const [communityCategoriesError, setCommunityCategoriesError] = useState("");

  const [selectedPartner, setSelectedPartner] = useState<PartnerRecord | null>(null);
  const [partnerEditor, setPartnerEditor] = useState<Record<string, any>>({});
  const [partnerEditorOpen, setPartnerEditorOpen] = useState(false);
  const [lastTrialEndMs, setLastTrialEndMs] = useState<number | null>(null); // for undo last extension

  const [selectedListing, setSelectedListing] = useState<ListingRecord | null>(null);
  const [listingEditor, setListingEditor] = useState<Record<string, any>>({});
  const [listingEditorOpen, setListingEditorOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/admin");
        return;
      }

      const adminDoc = await getDoc(doc(db, "adminCollection", user.uid));
      if (!adminDoc.exists()) {
        navigate("/admin");
        return;
      }

      const adminData = adminDoc.data();
      setIsAuthorized(true);
      setAdminEmail(user.email || "");
      setAdminName(adminData?.name || "Administrator");
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!isAuthorized) return;

    const qPartners = query(collection(db, "partnersCollection"), orderBy("createdAt", "desc"));
    const unsubPartners = onSnapshot(qPartners, (snap) => {
      setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PartnerRecord)));
    });

    const qTransactions = query(collection(db, "transactionsCollection"), orderBy("createdAt", "desc"), limit(2000));
    const unsubTransactions = onSnapshot(qTransactions, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qPartnerPlans = query(collectionGroup(db, "planCollection"));
    const unsubPartnerPlans = onSnapshot(
      qPartnerPlans,
      (snap) => {
        const plans = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, any>),
          partnerId: d.ref.path.split("/")[1] || "",
        })) as PartnerPlanRecord[];

        // Automatically cancel trials that have expired
        const now = Date.now();
        plans.forEach(async (plan) => {
          if (plan.isTrial && plan.active !== false && plan.billingPeriodEnd) {
            const endMs = typeof plan.billingPeriodEnd.toMillis === 'function'
              ? plan.billingPeriodEnd.toMillis()
              : (plan.billingPeriodEnd.seconds ? plan.billingPeriodEnd.seconds * 1000 : new Date(plan.billingPeriodEnd).getTime());
            
            if (endMs < now) {
              try {
                const planRef = doc(db, "partnersCollection", plan.partnerId, "planCollection", plan.id);
                await updateDoc(planRef, { active: false });
                console.log(`Auto-cancelled expired trial plan ${plan.id} for partner ${plan.partnerId}`);
              } catch (e) {
                console.error("Error auto-cancelling expired trial plan:", e);
              }
            }
          }
        });

        setPartnerPlans(plans);
      },
      (error) => {
        console.error("Failed to fetch partnerPlans:", error);
      }
    );

    const qFeatured = query(collectionGroup(db, "featuresCollection"));
    const unsubFeatured = onSnapshot(
      qFeatured,
      (snap) => {
        setFeaturedPlans(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Record<string, any>),
            partnerId: d.ref.path.split("/")[1] || "",
          })) as FeaturedPlanPurchase[],
        );
      },
      (error) => {
        console.error("Failed to fetch featuredPlans:", error);
      }
    );

    const fetchListings = async () => {
      const collectionNames = [
        "businessOfferingsCollection",
        "consultingServicesCollection",
        "consultingCollection",
        "eventsCollection",
        "jobsCollection",
      ];
      const allListings: ListingRecord[] = [];

      for (const colName of collectionNames) {
        try {
          const map = new Map<string, any>();

          // 1. Fetch group subcollections (nested under partners)
          try {
            const groupSnap = await getDocs(collectionGroup(db, colName));
            groupSnap.docs.forEach((d) => {
              map.set(d.id, {
                id: d.id,
                ...d.data(),
                __col: colName,
                __path: d.ref.path,
              });
            });
          } catch (e) {
            console.warn(`Failed to fetch collectionGroup for ${colName}:`, e);
          }

          // 2. Fetch root collections (global)
          try {
            const rootSnap = await getDocs(collection(db, colName));
            rootSnap.docs.forEach((d) => {
              map.set(d.id, {
                id: d.id,
                ...d.data(),
                __col: colName,
                __path: d.ref.path,
              });
            });
          } catch (e) {
            console.warn(`Failed to fetch root collection for ${colName}:`, e);
          }

          Array.from(map.values()).forEach((data) => {
            if (data.status !== "pending_payment") {
              allListings.push(data as ListingRecord);
            }
          });
        } catch (error) {
          console.error(`Failed to fetch ${colName}:`, error);
        }
      }

      allListings.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setListings(allListings);
    };

    fetchListings();
    const listingsInterval = setInterval(fetchListings, 30000);

    const qAudit = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(2000));
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const settingsRef = doc(db, "adminSettingsCollection", "platformSettings");
    const unsubSettings = onSnapshot(settingsRef, (settingsSnap) => {
      const settings = settingsSnap.data() as AdminSettingsRecord | undefined;
      setSettingsData((prev) => ({ ...prev, ...(settings || {}) }));
    });

    return () => {
      unsubPartners();
      unsubTransactions();
      unsubPartnerPlans();
      unsubFeatured();
      unsubAudit();
      unsubSettings();
      clearInterval(listingsInterval);
    };
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized || activeTab !== "communityCategories") return;
    let cancelled = false;
    (async () => {
      setCommunityCategoriesError("");
      setCommunityCategoriesLoading(true);
      try {
        const ref = doc(db, "config", "communityCategories");
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          setCommunityCategoriesDraft(ensureCommunityCategoryDoc(snap.data()));
        } else {
          setCommunityCategoriesDraft(
            ensureCommunityCategoryDoc(JSON.parse(JSON.stringify(DEFAULT_COMMUNITY_CATEGORIES))),
          );
        }
      } catch (e: unknown) {
        if (!cancelled) setCommunityCategoriesError(String(e));
      } finally {
        if (!cancelled) setCommunityCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized, activeTab]);

  const saveCommunityCategories = async () => {
    if (!communityCategoriesDraft) return;
    setCommunityCategoriesSaving(true);
    setCommunityCategoriesError("");
    try {
      const err = validateCommunityCategoryDoc(communityCategoriesDraft);
      if (err) throw new Error(err);
      const normalized = normalizeForFirestore(communityCategoriesDraft);
      await setDoc(doc(db, "config", "communityCategories"), {
        mains: normalized.mains,
        updatedAt: serverTimestamp(),
      });
      setCommunityCategoriesDraft(normalized);
      setSaveNotice("Community categories saved.");
      setTimeout(() => setSaveNotice(""), 3000);
    } catch (e: unknown) {
      setCommunityCategoriesError(e instanceof Error ? e.message : String(e));
    } finally {
      setCommunityCategoriesSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/admin");
  };

  const openPartnerEditor = (partner: PartnerRecord) => {
    setSelectedPartner(partner);
    setPartnerEditor({
      // Primary Info
      firstName: partner.firstName || "",
      lastName: partner.lastName || "",
      primaryName: partner.primaryName || "",
      primaryEmail: partner.primaryEmail || "",
      phoneNumber: partner.phoneNumber || "",
      
      // Company Info
      businessName: partner.businessName || "",
      companyWebsite: partner.companyWebsite || "",
      businessPhone: partner.businessPhone || "",
      linkedinProfile: partner.linkedinProfile || "",
      businessAddress: partner.businessAddress || "",
      businessCountry: partner.businessCountry || "",
      companyProfileText: partner.companyProfileText || "",
      
      // Billing & Admin
      partnerStatus: partner.partnerStatus || "Pending",
      billingEmailAddress: partner.billingEmailAddress || "",
      VAT_ABN_EIN_businessId: partner.VAT_ABN_EIN_businessId || "",
      altContactName: partner.altContactName || "",
      altEmail: partner.altEmail || "",
      selectedGroup: partner.selectedGroup || "business_offerings",
      selectedPlan: partner.selectedPlan || "none",
      
      // Taxonomy Arrays
      selectedCategories: partner.selectedCategories || [],
      selectedSubcategories: partner.selectedSubcategories || [],
      selectedSubSubcategories: partner.selectedSubSubcategories || [],
      serviceCountries: partner.serviceCountries || [],
      serviceRegions: partner.serviceRegions || [],
      certifications: partner.certifications || [],
      bioSafetyLevel: partner.bioSafetyLevel || [],

      // Event-specific
      eventName: partner.eventName || "",
      eventLink: partner.eventLink || "",
      startDate: partner.startDate || "",
      endDate: partner.endDate || "",
      eventCountry: partner.eventCountry || "",
      stateRegion: partner.stateRegion || "",
      city: partner.city || "",
      location: partner.location || "",
      eventProfile: partner.eventProfile || "",
      agendaHighlights: partner.agendaHighlights || "",
      agendaPdfUrl: partner.agendaPdfUrl || "",

      // Job-specific
      jobTitle: partner.jobTitle || "",
      industry: partner.industry || "",
      positionType: partner.positionType || "",
      experienceLevel: partner.experienceLevel || "",
      positionLink: partner.positionLink || "",
      jobCountry: partner.jobCountry || "",
      jobSummary: partner.jobSummary || "",
      education: partner.education || "",
      workModel: partner.workModel || "",
      applicationDeadline: partner.applicationDeadline || "",
      jobDescriptionPdfUrl: partner.jobDescriptionPdfUrl || "",
    });
    setPartnerEditorOpen(true);
    setLastTrialEndMs(null); // reset undo state for this partner
  };

  const savePartnerEdits = async () => {
    if (!selectedPartner) return;
    const isPartnerAdminCreated = Boolean((selectedPartner as any)?.createdByAdmin);
    const pPrimaryName = (partnerEditor.primaryName || `${partnerEditor.firstName || ""} ${partnerEditor.lastName || ""}`).trim();
    const pPrimaryEmail = (partnerEditor.primaryEmail || "").trim();
    const pBusinessName = (partnerEditor.businessName || "").trim();

    if (!pPrimaryName || !pBusinessName) {
      setSaveNotice("Company Name and Contact Name cannot be empty.");
      return;
    }

    if (isPartnerAdminCreated && !pPrimaryEmail) {
      setSaveNotice("Primary Email cannot be empty.");
      return;
    }

    try {
      let payload: Record<string, any>;

      if (!isPartnerAdminCreated) {
        payload = {
          businessName: pBusinessName,
          companyName: pBusinessName,
          primaryName: pPrimaryName,
          ...(partnerEditor.firstName !== undefined ? { firstName: partnerEditor.firstName } : {}),
          ...(partnerEditor.lastName !== undefined ? { lastName: partnerEditor.lastName } : {}),
        };
      } else {
        payload = {
          // Primary Info
          firstName: partnerEditor.firstName || "",
          lastName: partnerEditor.lastName || "",
          primaryName: pPrimaryName,
          primaryEmail: pPrimaryEmail,
          phoneNumber: partnerEditor.phoneNumber || "",
          
          // Company Info
          businessName: pBusinessName,
          companyName: pBusinessName,
          companyWebsite: partnerEditor.companyWebsite || "",
          businessPhone: partnerEditor.businessPhone || "",
          linkedinProfile: partnerEditor.linkedinProfile || "",
          businessAddress: partnerEditor.businessAddress || "",
          addressHtml: partnerEditor.businessAddress || "",
          businessCountry: partnerEditor.businessCountry || "",
          companyProfileText: partnerEditor.companyProfileText || "",
          profileHtml: partnerEditor.companyProfileText || "",
          
          // Billing & Admin
          partnerStatus: partnerEditor.partnerStatus || "Pending",
          status: partnerEditor.partnerStatus || "Pending",
          billingEmailAddress: partnerEditor.billingEmailAddress || "",
          VAT_ABN_EIN_businessId: partnerEditor.VAT_ABN_EIN_businessId || "",
          altContactName: partnerEditor.altContactName || "",
          altEmail: partnerEditor.altEmail || "",
          selectedGroup: partnerEditor.selectedGroup || "business_offerings",
          selectedPlan: partnerEditor.selectedPlan || "none",
          
          // Taxonomy arrays
          selectedCategories: partnerEditor.selectedCategories || [],
          selectedSubcategories: partnerEditor.selectedSubcategories || [],
          selectedSubSubcategories: partnerEditor.selectedSubSubcategories || [],
          serviceCountries: partnerEditor.serviceCountries || [],
          serviceRegions: partnerEditor.serviceRegions || [],
          certifications: Array.from<string>(
            new Set(
              (partnerEditor.certifications || [])
                .map((c: string) => c.trim().replace(/^other:\s*/i, ""))
                .filter((c: string) => c && c !== "Others")
            )
          ).sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })),
          bioSafetyLevel: partnerEditor.bioSafetyLevel || [],
        };

        // Conditionally add Event fields
        if (partnerEditor.selectedGroup === "events") {
          Object.assign(payload, {
            eventName: partnerEditor.eventName || "",
            eventLink: partnerEditor.eventLink || "",
            startDate: partnerEditor.startDate || "",
            endDate: partnerEditor.endDate || "",
            eventCountry: partnerEditor.eventCountry || "",
            stateRegion: partnerEditor.stateRegion || "",
            city: partnerEditor.city || "",
            location: partnerEditor.location || "",
            eventProfile: partnerEditor.eventProfile || "",
            agendaHighlights: partnerEditor.agendaHighlights || "",
            agendaPdfUrl: partnerEditor.agendaPdfUrl || "",
          });
        }

        // Conditionally add Job fields
        if (partnerEditor.selectedGroup === "jobs") {
          Object.assign(payload, {
            jobTitle: partnerEditor.jobTitle || "",
            industry: partnerEditor.industry || "",
            positionType: partnerEditor.positionType || "",
            experienceLevel: partnerEditor.experienceLevel || "",
            positionLink: partnerEditor.positionLink || "",
            jobCountry: partnerEditor.jobCountry || "",
            jobSummary: partnerEditor.jobSummary || "",
            education: partnerEditor.education || "",
            workModel: partnerEditor.workModel || "",
            applicationDeadline: partnerEditor.applicationDeadline || "",
            jobDescriptionPdfUrl: partnerEditor.jobDescriptionPdfUrl || "",
          });
        }
      }

      await updateDoc(doc(db, "partnersCollection", selectedPartner.id), payload);
      setPartners((prev) =>
        prev.map((p) => (p.id === selectedPartner.id ? { ...p, ...payload } : p)),
      );

      // Log to Audit Trail
      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: payload.businessName || selectedPartner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Profile updated by admin: ${payload.businessName || selectedPartner.businessName} (Contact: ${payload.primaryName || selectedPartner.primaryName}). Admin: ${adminEmail}`,
        category: "admin",
        performedBy: "admin",
        metadata: { adminEmail, updatedFields: payload, performedBy: "admin" }
      });

      setSaveNotice("Partner profile updated.");
      setPartnerEditorOpen(false);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update partner profile.");
    }
  };

  const extendTrial = async (days: number) => {
    if (!selectedPartner || !(selectedPartner as any).createdByAdmin) return;
    try {
      const latestPlan = partnerPlans
        .filter((plan) => plan.partnerId === selectedPartner.id)
        .sort((a, b) => {
          const aTs = a.startDate?.seconds || a.createdAt?.seconds || 0;
          const bTs = b.startDate?.seconds || b.createdAt?.seconds || 0;
          return bTs - aTs;
        })[0];

      if (!latestPlan) {
        alert("No plan document found for this partner to extend.");
        return;
      }

      const currentEnd = latestPlan.billingPeriodEnd;
      let endMs = 0;
      if (currentEnd) {
        endMs = typeof currentEnd.toMillis === 'function' 
          ? currentEnd.toMillis() 
          : (currentEnd.seconds ? currentEnd.seconds * 1000 : new Date(currentEnd).getTime());
      } else {
        endMs = Date.now();
      }

      // Save the current end date before modifying — enables undo
      setLastTrialEndMs(endMs);

      const baseMs = endMs < Date.now() ? Date.now() : endMs;
      const extensionMs = days * 24 * 60 * 60 * 1000;
      const newEnd = new Date(baseMs + extensionMs);

      const planDocRef = doc(db, "partnersCollection", selectedPartner.id, "planCollection", latestPlan.id);
      await updateDoc(planDocRef, {
        billingPeriodEnd: newEnd,
        isTrial: true,
        active: true
      });

      // Synchronize featuresCollection if partner has an active feature spotlight
      try {
        const featSnap = await getDocs(collection(db, "partnersCollection", selectedPartner.id, "featuresCollection"));
        for (const fDoc of featSnap.docs) {
          await updateDoc(fDoc.ref, {
            accessThrough: newEnd,
            active: true,
            isTrial: true
          });
        }
      } catch (e) {
        console.warn("Failed to synchronize featuresCollection on trial extend:", e);
      }

      // Sync status and feature spotlight to the associated listing if present
      const listingId = (latestPlan as any).listingId;
      const collectionName = (latestPlan as any).collectionName;
      if (listingId && collectionName) {
        let listingRef;
        if (collectionName === "businessOfferingsCollection") {
          listingRef = doc(db, "partnersCollection", selectedPartner.id, "businessOfferingsCollection", listingId);
        } else {
          listingRef = doc(db, collectionName, listingId);
        }
        try {
          await updateDoc(listingRef, { 
            status: "Extended",
            ...(selectedPartner.selectedAddon || selectedPartner.isFeatured ? { featureSpotlightPaidThrough: newEnd } : {})
          });
        } catch (e) {
          console.warn("Failed to sync listing status to Extended:", e);
        }
      }

      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: selectedPartner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Trial extended by ${days} days (New expiry: ${newEnd.toLocaleDateString()}). Admin: ${adminEmail}`,
        category: "admin",
        performedBy: "admin",
        metadata: { adminEmail, extendedDays: days, newExpiryDate: newEnd, performedBy: "admin" }
      });

    } catch (err: any) {
      console.error("Error extending trial:", err);
      alert("Failed to extend trial: " + err.message);
    }
  };

  const extendFeature = async (days: number) => {
    if (!selectedPartner || !(selectedPartner as any).createdByAdmin) return;
    try {
      const featSnap = await getDocs(collection(db, "partnersCollection", selectedPartner.id, "featuresCollection"));
      if (featSnap.empty) {
        alert("No feature spotlight document found for this partner to extend.");
        return;
      }

      let currentEndMs = Date.now();
      featSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const end = data.accessThrough || data.billingPeriodEnd;
        if (end) {
          const ms = typeof end.toMillis === "function" ? end.toMillis() : (end.seconds ? end.seconds * 1000 : new Date(end).getTime());
          if (ms > currentEndMs) currentEndMs = ms;
        }
      });

      const baseMs = currentEndMs < Date.now() ? Date.now() : currentEndMs;
      const extensionMs = days * 24 * 60 * 60 * 1000;
      const newEnd = new Date(baseMs + extensionMs);

      for (const fDoc of featSnap.docs) {
        await updateDoc(fDoc.ref, {
          accessThrough: newEnd,
          active: true,
          isTrial: true
        });
      }

      // Sync listing's featureSpotlightPaidThrough
      const partnerListing = listings.find((l) => l.partnerId === selectedPartner.id);
      if (partnerListing) {
        let listingRef;
        const col = partnerListing.selectedGroup === "business_offerings" ? "businessOfferingsCollection" : (
          partnerListing.selectedGroup === "events" ? "eventsCollection" : (
            partnerListing.selectedGroup === "jobs" ? "jobsCollection" : "consultingServicesCollection"
          )
        );
        if (partnerListing.selectedGroup === "business_offerings") {
          listingRef = doc(db, "partnersCollection", selectedPartner.id, "businessOfferingsCollection", partnerListing.id);
        } else {
          listingRef = doc(db, col, partnerListing.id);
        }
        try {
          await updateDoc(listingRef, {
            isFeatured: true,
            featureSpotlightPaidThrough: newEnd
          });
        } catch (e) {
          console.warn("Failed to sync listing featureSpotlightPaidThrough:", e);
        }
      }

      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: selectedPartner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Feature spotlight extended by ${days} days (New expiry: ${newEnd.toLocaleDateString()}). Admin: ${adminEmail}`,
        category: "admin",
        performedBy: "admin",
        metadata: { adminEmail, extendedDays: days, newExpiryDate: newEnd, performedBy: "admin" }
      });

      setSaveNotice(`Feature spotlight extended by ${days} days (New expiry: ${newEnd.toLocaleDateString()})`);
      alert(`Feature spotlight successfully extended by ${days} days (New expiry: ${newEnd.toLocaleDateString()})`);
    } catch (err: any) {
      console.error("Error extending feature:", err);
      alert("Failed to extend feature: " + err.message);
    }
  };

  const undoExtension = async () => {
    if (!selectedPartner || !(selectedPartner as any).createdByAdmin || lastTrialEndMs === null) return;
    try {
      const latestPlan = partnerPlans
        .filter((plan) => plan.partnerId === selectedPartner.id)
        .sort((a, b) => {
          const aTs = a.startDate?.seconds || a.createdAt?.seconds || 0;
          const bTs = b.startDate?.seconds || b.createdAt?.seconds || 0;
          return bTs - aTs;
        })[0];

      if (!latestPlan) return;

      const previousEnd = new Date(lastTrialEndMs);
      const planDocRef = doc(db, "partnersCollection", selectedPartner.id, "planCollection", latestPlan.id);
      await updateDoc(planDocRef, { billingPeriodEnd: previousEnd });

      // Sync status to the associated listing if present
      const listingId = (latestPlan as any).listingId;
      const collectionName = (latestPlan as any).collectionName;
      if (listingId && collectionName) {
        let listingRef;
        if (collectionName === "businessOfferingsCollection") {
          listingRef = doc(db, "partnersCollection", selectedPartner.id, "businessOfferingsCollection", listingId);
        } else {
          listingRef = doc(db, collectionName, listingId);
        }
        try {
          await updateDoc(listingRef, { status: "Approved" });
        } catch (e) {
          console.warn("Failed to revert listing status on undo:", e);
        }
      }

      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: selectedPartner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Trial extension undone. Expiry reverted to ${previousEnd.toLocaleDateString()}. Admin: ${adminEmail}`,
        category: "admin",
        performedBy: "admin",
        metadata: { adminEmail, revertedTo: previousEnd, performedBy: "admin" }
      });

      setLastTrialEndMs(null);
    } catch (err: any) {
      console.error("Error undoing extension:", err);
      alert("Failed to undo: " + err.message);
    }
  };

  const cancelTrial = async () => {
    if (!selectedPartner || !(selectedPartner as any).createdByAdmin) return;
    if (!window.confirm("Are you sure you want to cancel this partner's trial? Their plan will be deactivated immediately.")) return;
    try {
      const latestPlan = partnerPlans
        .filter((plan) => plan.partnerId === selectedPartner.id)
        .sort((a, b) => {
          const aTs = a.startDate?.seconds || a.createdAt?.seconds || 0;
          const bTs = b.startDate?.seconds || b.createdAt?.seconds || 0;
          return bTs - aTs;
        })[0];

      if (!latestPlan) {
        alert("No plan document found for this partner.");
        return;
      }

      const planDocRef = doc(db, "partnersCollection", selectedPartner.id, "planCollection", latestPlan.id);
      await updateDoc(planDocRef, {
        active: false,
        billingPeriodEnd: new Date(),
      });

      // Sync status to the associated listing if present
      const listingId = (latestPlan as any).listingId;
      const collectionName = (latestPlan as any).collectionName;
      if (listingId && collectionName) {
        let listingRef;
        if (collectionName === "businessOfferingsCollection") {
          listingRef = doc(db, "partnersCollection", selectedPartner.id, "businessOfferingsCollection", listingId);
        } else {
          listingRef = doc(db, collectionName, listingId);
        }
        try {
          await updateDoc(listingRef, { status: "Cancelled", active: false });
        } catch (e) {
          console.warn("Failed to sync listing status to Cancelled:", e);
        }
      }

      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: selectedPartner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Trial cancelled immediately by admin: ${adminEmail}`,
        category: "admin",
        performedBy: "admin",
        metadata: { adminEmail, cancelledAt: new Date(), performedBy: "admin" }
      });

      alert("Trial cancelled successfully.");
    } catch (err: any) {
      console.error("Error cancelling trial:", err);
      alert("Failed to cancel trial: " + err.message);
    }
  };

  const setPartnerStatus = async (partner: PartnerRecord, status: string) => {
    try {
      await updateDoc(doc(db, "partnersCollection", partner.id), { partnerStatus: status });
      setPartners((prev) => prev.map((p) => (p.id === partner.id ? { ...p, partnerStatus: status } : p)));
      if (selectedPartner?.id === partner.id) {
        setPartnerEditor((prev) => ({ ...prev, partnerStatus: status }));
      }

      // Log to Audit Trail
      await logActivity({
        partnerId: partner.id,
        partnerName: partner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Partner status changed to "${status}" (Business: ${partner.businessName}). Updated by admin: ${adminEmail}`,
        category: "admin",
        performedBy: "admin",
        metadata: { adminEmail, newStatus: status, performedBy: "admin" }
      });

      setSaveNotice(`Partner status set to ${status}.`);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update partner status.");
    }
  };

  const openListingEditor = (listing: ListingRecord) => {
    setSelectedListing(listing);

    // Normalize status to one of: "Active", "Expired", "Cancelled", "Incomplete Payment"
    const effective = getEffectiveListingStatus(listing, listingInsights[listing.id]);
    let initialStatus = "Active";
    if (effective === "Expired" || listing.status === "Expired") {
      initialStatus = "Expired";
    } else if (effective === "Cancelled" || listing.status === "Cancelled" || listing.status === "Canceled") {
      initialStatus = "Cancelled";
    } else if (effective === "Incomplete Payment" || effective === "Payment Error" || listing.status === "Incomplete Payment" || listing.status === "Payment Error" || listing.status === "past_due") {
      initialStatus = "Incomplete Payment";
    } else {
      initialStatus = "Active";
    }

    setListingEditor({
      // Core
      businessName: listing.businessName || "",
      companyWebsite: listing.companyWebsite || "",
      selectedPlan: listing.selectedPlan || "",
      selectedGroup: listing.selectedGroup || "",
      status: initialStatus,
      active: `${initialStatus === "Active"}`,
      // Taxonomy
      selectedCategories: listing.selectedCategories || [],
      selectedSubcategories: listing.selectedSubcategories || [],
      selectedSubSubcategories: listing.selectedSubSubcategories || [],
      serviceCountries: listing.serviceCountries || [],
      serviceRegions: listing.serviceRegions || [],
      // Business/Consulting
      companyProfileText: listing.companyProfileText || "",
      businessAddress: listing.businessAddress || "",
      businessCountry: listing.businessCountry || "",
      bioSafetyLevelCsv: (listing.bioSafetyLevel || []).join(", "),
      certificationsCsv: (listing.certifications || []).join(", "),
      companyRepresentativesJson: listing.companyRepresentatives ? JSON.stringify(listing.companyRepresentatives, null, 2) : "",
      // Event fields
      eventName: listing.eventName || "",
      eventLink: listing.eventLink || "",
      startDate: listing.startDate || "",
      endDate: listing.endDate || "",
      eventCountry: listing.eventCountry || "",
      stateRegion: listing.stateRegion || "",
      city: listing.city || "",
      location: listing.location || "",
      eventProfile: listing.eventProfile || "",
      agendaHighlights: listing.agendaHighlights || "",
      agendaPdfUrl: listing.agendaPdfUrl || "",
      // Job fields
      jobTitle: listing.jobTitle || "",
      industry: listing.industry || "",
      positionType: listing.positionType || "",
      experienceLevel: listing.experienceLevel || "",
      positionLink: listing.positionLink || "",
      jobCountry: listing.jobCountry || "",
      jobStateRegion: listing.stateRegion || "",
      jobCity: listing.city || "",
      jobLocation: listing.location || "",
      jobSummary: listing.jobSummary || "",
      education: listing.education || "",
      workModel: listing.workModel || "",
      applicationDeadline: listing.applicationDeadline || "",
      jobDescriptionPdfUrl: listing.jobDescriptionPdfUrl || "",
      companyWebsiteLink: listing.companyWebsiteLink || "",
      linkedInJob: listing.linkedInJob || "",
    });
    setListingEditorOpen(true);
  };

  const setListingStatus = async (listing: ListingRecord, status: string, active: boolean) => {
    try {
      await updateDoc(doc(db, listing.__path), { status, active });
      setListings((prev) =>
        prev.map((l) => (l.__path === listing.__path ? { ...l, status, active } : l)),
      );
      if (selectedListing?.__path === listing.__path) {
        setListingEditor((prev) => ({ ...prev, status, active: `${active}` }));
      }

      // Log to Audit Trail
      const partnerId = listing.__path.split('/')[1];

      await logActivity({
        partnerId,
        partnerName: listing.businessName || "Unnamed Business",
        action: "LISTING_UPDATED",
        details: `Listing status for "${listing.businessName || 'Listing'}" set to "${status}". Updated by admin: ${adminEmail}`,
        category: "listing",
        performedBy: "admin",
        metadata: { adminEmail, status, active, listingId: listing.id, performedBy: "admin" }
      });

      setSaveNotice(`Listing updated: ${status}.`);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update listing status.");
    }
  };

  const setFeatureStatus = async (listing: ListingRecord, status: string, active: boolean) => {
    try {
      const insight = listingInsights[listing.id];
      const feature = insight?.feature;

      if (feature && feature.partnerId) {
        const featDocRef = doc(db, "partnersCollection", feature.partnerId, "featuresCollection", feature.id);
        await updateDoc(featDocRef, { status, active });
        setFeaturedPlans((prev) =>
          prev.map((f) => (f.id === feature.id ? { ...f, status, active } : f))
        );
      }

      if (listing.__path) {
        await updateDoc(doc(db, listing.__path), {
          isFeatured: active,
          featureStatus: status,
        });
        setListings((prev) =>
          prev.map((l) => (l.__path === listing.__path ? { ...l, isFeatured: active, featureStatus: status } : l))
        );
      }

      const partnerId = listing.__path?.split("/")[1] || feature?.partnerId || "";
      await logActivity({
        partnerId,
        partnerName: listing.businessName || "Unnamed Business",
        action: "LISTING_UPDATED",
        details: `Feature status for "${listing.businessName || 'Listing'}" set to "${status}". Updated by admin: ${adminEmail}`,
        category: "listing",
        performedBy: "admin",
        metadata: { adminEmail, featureStatus: status, active, listingId: listing.id, performedBy: "admin" }
      });

      setSaveNotice(`Feature status updated: ${status}.`);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update feature status.");
    }
  };

  const saveListingEdits = async () => {
    if (!selectedListing) return;
    try {
      const newStatus = listingEditor.status || "Active";
      const newActive = newStatus === "Active";
      const payload = {
        status: newStatus,
        active: newActive,
      };

      await updateDoc(doc(db, selectedListing.__path), payload);

      setListings((prev) =>
        prev.map((l) => (l.__path === selectedListing.__path ? { ...l, ...payload } : l)),
      );

      // Log to Audit Trail
      const partnerId = selectedListing.__path.split('/')[1];
      await logActivity({
        partnerId,
        partnerName: selectedListing.businessName || "Unnamed Business",
        action: "LISTING_UPDATED",
        details: `Listing status for "${selectedListing.businessName || 'Listing'}" updated to "${newStatus}" by admin (${adminEmail}).`,
        category: "listing",
        performedBy: "admin",
        metadata: { adminEmail, listingId: selectedListing.id, status: newStatus, active: newActive, performedBy: "admin" }
      });

      setSaveNotice(`Listing status updated to ${newStatus}.`);
      setListingEditorOpen(false);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not save listing status.");
    }
  };

  const adminPartnerCount = useMemo(() => partners.filter((p) => Boolean((p as any).createdByAdmin)).length, [partners]);
  const nonAdminPartnerCount = useMemo(() => partners.filter((p) => !Boolean((p as any).createdByAdmin)).length, [partners]);

  const filteredPartners = useMemo(
    () =>
      partners.filter((p) => {
        const q = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !q ||
          p.businessName?.toLowerCase().includes(q) ||
          p.primaryEmail?.toLowerCase().includes(q) ||
          p.primaryName?.toLowerCase().includes(q);

        if (!matchesSearch) return false;

        const isAdmin = Boolean((p as any).createdByAdmin);
        if (partnerAdminFilter === "admin") return isAdmin;
        if (partnerAdminFilter === "non-admin") return !isAdmin;
        return true;
      }),
    [partners, searchTerm, partnerAdminFilter],
  );

  const typeFilteredListings = useMemo(() => {
    if (listingTypeFilter === "all") return listings;
    return listings.filter((l) => {
      if (listingTypeFilter === "business_offerings") return l.__col === "businessOfferingsCollection";
      if (listingTypeFilter === "consulting") return l.__col === "consultingServicesCollection" || l.__col === "consultingCollection";
      if (listingTypeFilter === "jobs") return l.__col === "jobsCollection";
      if (listingTypeFilter === "events") return l.__col === "eventsCollection";
      return true;
    });
  }, [listings, listingTypeFilter]);

  const pendingListings = typeFilteredListings.filter((l) => l.status === "Pending Review");

  const partnerInsights = useMemo(() => {
    const latestPlansByPartner = new Map<string, PartnerPlanRecord>();
    const listingCountByPartner = new Map<string, number>();
    const featuredCountByPartner = new Map<string, number>();

    listings.forEach((listing) => {
      const partnerId = listing.__path.split("/")[1] || "";
      if (!partnerId) return;
      listingCountByPartner.set(partnerId, (listingCountByPartner.get(partnerId) || 0) + 1);
    });

    featuredPlans.forEach((feature) => {
      if (!feature.partnerId) return;
      featuredCountByPartner.set(feature.partnerId, (featuredCountByPartner.get(feature.partnerId) || 0) + 1);
    });

    partnerPlans.forEach((plan) => {
      if (!plan.partnerId) return;
      const existing = latestPlansByPartner.get(plan.partnerId);
      const existingTs = (existing as any)?.startDate?.seconds || existing?.createdAt?.seconds || 0;
      const currentTs = (plan as any)?.startDate?.seconds || plan?.createdAt?.seconds || 0;
      if (!existing || currentTs >= existingTs) {
        latestPlansByPartner.set(plan.partnerId, plan);
      }
    });

    return partners.reduce((acc, partner) => {
      const latestPlan = latestPlansByPartner.get(partner.id);
      
      let trialInfo = null;
      if (partner.createdByAdmin && latestPlan && latestPlan.isTrial) {
        const startDate = latestPlan.startDate;
        const billingPeriodEnd = latestPlan.billingPeriodEnd;
        if (startDate && billingPeriodEnd) {
          const startMs = typeof startDate.toMillis === 'function' 
            ? startDate.toMillis() 
            : (startDate.seconds ? startDate.seconds * 1000 : new Date(startDate).getTime());
          const endMs = typeof billingPeriodEnd.toMillis === 'function' 
            ? billingPeriodEnd.toMillis() 
            : (billingPeriodEnd.seconds ? billingPeriodEnd.seconds * 1000 : new Date(billingPeriodEnd).getTime());
          const nowMs = Date.now();
          
          const durationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
          const elapsedDays = Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24));
          const currentDay = Math.max(1, elapsedDays + 1);
          
          trialInfo = {
            durationDays,
            currentDay: Math.min(currentDay, durationDays),
            isExpired: nowMs > endMs,
            daysLeft: Math.max(0, Math.round((endMs - nowMs) / (1000 * 60 * 60 * 24))),
            startDate: startMs,
            billingPeriodEnd: endMs,
          };
        }
      }

      const rawPlan = latestPlan?.planName || latestPlan?.planId || (partner as any).selectedPlan || "-";

      acc[partner.id] = {
        latestPlan: formatUserPlan(rawPlan, latestPlan),
        listingCount: listingCountByPartner.get(partner.id) || 0,
        featuredCount: featuredCountByPartner.get(partner.id) || 0,
        trialInfo,
      };
      return acc;
    }, {} as Record<string, { 
      latestPlan: string; 
      listingCount: number; 
      featuredCount: number; 
      trialInfo?: { 
        durationDays: number; 
        currentDay: number; 
        isExpired: boolean; 
        daysLeft: number; 
        startDate: number;
        billingPeriodEnd: number;
      } | null;
    }>);
  }, [partners, partnerPlans, listings, featuredPlans]);

  const listingInsights = useMemo(() => {
    const plansByListing = new Map<string, PartnerPlanRecord>();
    const plansByPartner = new Map<string, PartnerPlanRecord>();
    const featuresByListing = new Map<string, FeaturedPlanPurchase>();
    const featuresByPartner = new Map<string, FeaturedPlanPurchase>();

    partnerPlans.forEach((plan) => {
      const currentTs = (plan as any)?.startDate?.seconds || plan?.createdAt?.seconds || 0;

      const listingId = (plan as any).listingId;
      if (listingId) {
        const existing = plansByListing.get(listingId);
        const existingTs = (existing as any)?.startDate?.seconds || existing?.createdAt?.seconds || 0;
        if (!existing || currentTs >= existingTs) {
          plansByListing.set(listingId, plan);
        }
      }

      if (plan.partnerId) {
        const existing = plansByPartner.get(plan.partnerId);
        const existingTs = (existing as any)?.startDate?.seconds || existing?.createdAt?.seconds || 0;
        if (!existing || currentTs >= existingTs) {
          plansByPartner.set(plan.partnerId, plan);
        }
      }
    });

    featuredPlans.forEach((feature) => {
      const currentTs = (feature as any)?.lastPaymentReceived?.seconds || feature?.createdAt?.seconds || 0;

      const listingId = (feature as any).listingId;
      if (listingId) {
        const existing = featuresByListing.get(listingId);
        const existingTs = (existing as any)?.lastPaymentReceived?.seconds || existing?.createdAt?.seconds || 0;
        if (!existing || currentTs >= existingTs) {
          featuresByListing.set(listingId, feature);
        }
      }

      if (feature.partnerId) {
        const existing = featuresByPartner.get(feature.partnerId);
        const existingTs = (existing as any)?.lastPaymentReceived?.seconds || existing?.createdAt?.seconds || 0;
        if (!existing || currentTs >= existingTs) {
          featuresByPartner.set(feature.partnerId, feature);
        }
      }
    });

    return listings.reduce((acc, listing) => {
      let partnerId = listing.partnerId;
      if (!partnerId) {
        if (listing.__col === "businessOfferingsCollection" || listing.__path.includes("partnersCollection")) {
           partnerId = listing.__path.split("/")[1];
        }
      }

      const plan = plansByListing.get(listing.id) || (partnerId ? plansByPartner.get(partnerId) : undefined);
      const feature = featuresByListing.get(listing.id) || (partnerId ? featuresByPartner.get(partnerId) : undefined);
      const featureStatus = getEffectiveFeatureStatus(feature, listing);

      acc[listing.id] = {
        plan,
        subscribedOn: (plan as any)?.startDate || plan?.createdAt || null,
        upgradedOn: (plan as any)?.upgradedAt || null,
        cancelledOn: (plan as any)?.cancelAt || (plan as any)?.canceledAt || null,
        expiryDate: (plan as any)?.billingPeriodEnd || null,
        feature,
        featureStatus,
        isFeatured: featureStatus === "Active" || listing.isFeatured || feature?.active || false,
        featurePlan: (feature as any)?.featureName || feature?.featureId || (listing as any)?.featuredPlan || (listing as any)?.selectedAddon || "-",
        featureDate: feature?.createdAt || listing.lastFeaturePaymentReceivedAt || (feature as any)?.lastPaymentReceived || null,
        featureCancelDate: (feature as any)?.accessThrough || (feature as any)?.cancelAt || listing.featureSpotlightPaidThrough || null,
      };
      return acc;
    }, {} as Record<string, any>);
  }, [listings, partnerPlans, featuredPlans]);

  const categoryRows = useMemo(() => {
    const sources = [
      { group: "Business Offerings", data: allBusinessCategories || businessCategories },
      { group: "Consulting Services", data: allConsultingCategories || consultingCategories },
      { group: "Events", data: allEventsCategories || eventsCategories },
      { group: "Jobs", data: allJobsCategories || jobsCategories },
    ];
    const rows: Array<{
      id?: string;
      group: string;
      category: string;
      subcategory: string;
      subSubcategory: string;
      status?: string;
      imageUrl?: string;
      metaDescription?: string;
      metaKeywords?: string;
      description?: string;
    }> = [];

    const defaultImg = "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=100&h=80";

    sources.forEach(({ group, data }) => {
      const groupKey = normalizeGroupKey(group) || "";
      Object.entries(data).forEach(([category, subEntries]) => {
        const catMeta = categoryMetadataMap[`${groupKey}:${category}`] || {};
        const isCatInactive =
          (catMeta.status || "").toLowerCase() === "inactive" ||
          catMeta.isDeleted === true ||
          catMeta.deleted === true;

        if (isCatInactive) return;

        if (!Array.isArray(subEntries) || subEntries.length === 0) {
          rows.push({
            id: catMeta.id,
            group,
            category,
            subcategory: "-",
            subSubcategory: "-",
            status: catMeta.status || "Active",
            imageUrl: catMeta.imageUrl || defaultImg,
            metaDescription: catMeta.metaDescription || "",
            metaKeywords: catMeta.metaKeywords || "",
            description: catMeta.description || "",
          });
          return;
        }

        subEntries.forEach((sub: any) => {
          if (typeof sub === "string") {
            const subMeta = categoryMetadataMap[`${groupKey}:${category}:${sub}`] || catMeta;
            const isSubInactive =
              (subMeta.status || "").toLowerCase() === "inactive" ||
              subMeta.isDeleted === true ||
              subMeta.deleted === true;

            if (isSubInactive) return;

            rows.push({
              id: subMeta.id || catMeta.id,
              group,
              category,
              subcategory: sub,
              subSubcategory: "-",
              status: subMeta.status || catMeta.status || "Active",
              imageUrl: subMeta.imageUrl || catMeta.imageUrl || defaultImg,
              metaDescription: subMeta.metaDescription || catMeta.metaDescription || "",
              metaKeywords: subMeta.metaKeywords || catMeta.metaKeywords || "",
              description: subMeta.description || catMeta.description || "",
            });
            return;
          }
          const subLabel = sub.label || "-";
          const subSubs =
            Array.isArray(sub.subSubcategories) && sub.subSubcategories.length > 0
              ? sub.subSubcategories.join(", ")
              : "-";
          const subMeta = categoryMetadataMap[`${groupKey}:${category}:${subLabel}`] || catMeta;
          const isSubInactive =
            (subMeta.status || "").toLowerCase() === "inactive" ||
            subMeta.isDeleted === true ||
            subMeta.deleted === true;

          if (isSubInactive) return;

          rows.push({
            id: subMeta.id || catMeta.id,
            group,
            category,
            subcategory: subLabel,
            subSubcategory: subSubs,
            status: subMeta.status || catMeta.status || "Active",
            imageUrl: subMeta.imageUrl || catMeta.imageUrl || defaultImg,
            metaDescription: subMeta.metaDescription || catMeta.metaDescription || "",
            metaKeywords: subMeta.metaKeywords || catMeta.metaKeywords || "",
            description: subMeta.description || catMeta.description || "",
          });
        });
      });
    });

    return rows.filter((r) => (r.status || "").toLowerCase() !== "inactive").sort((a, b) => {
      const gComp = (a.group || "").localeCompare(b.group || "", undefined, { sensitivity: "base" });
      if (gComp !== 0) return gComp;
      const cComp = (a.category || "").localeCompare(b.category || "", undefined, { sensitivity: "base" });
      if (cComp !== 0) return cComp;
      const sComp = (a.subcategory || "").localeCompare(b.subcategory || "", undefined, { sensitivity: "base" });
      if (sComp !== 0) return sComp;
      return (a.subSubcategory || "").localeCompare(b.subSubcategory || "", undefined, { sensitivity: "base" });
    });
  }, [allBusinessCategories, allConsultingCategories, allEventsCategories, allJobsCategories, businessCategories, consultingCategories, eventsCategories, jobsCategories, categoryMetadataMap]);

  const filteredCategoryRows = useMemo(() => {
    const rawQuery = categorySearch.trim().toLowerCase();
    if (!rawQuery) return categoryRows;
    const clean = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    const cleanQuery = clean(rawQuery);
    if (!cleanQuery) return categoryRows;

    const allQueryWords = cleanQuery.split(" ").filter(Boolean);
    const metaWords = new Set(["sub", "category", "categories", "subcategory", "subcategories"]);
    const meaningfulWords = allQueryWords.filter((w) => !metaWords.has(w));
    const searchTerms = meaningfulWords.length > 0 ? meaningfulWords : allQueryWords;
    const meaningfulPhrase = searchTerms.join(" ");

    const groupRank: Record<string, number> = {
      "Business Offerings": 1,
      "Consulting Services": 2,
      "Events": 3,
      "Jobs": 4,
    };

    const getRelevanceScore = (row: (typeof categoryRows)[number]) => {
      const cat = clean(row.category || "");
      const sub = clean(row.subcategory === "-" ? "" : row.subcategory || "");
      const subSub = clean(row.subSubcategory === "-" ? "" : row.subSubcategory || "");
      const group = clean(row.group || "");

      const subSubItems = (row.subSubcategory && row.subSubcategory !== "-")
        ? row.subSubcategory.split(",").map((s) => clean(s))
        : [];

      // 1. Exact match on subcategory (e.g. "Patient Support") -> 1,000,000
      if (sub === cleanQuery || (meaningfulPhrase && sub === meaningfulPhrase)) return 1000000;

      // 2. Exact match on category (e.g. "Clinical Research") -> 900,000
      if (cat === cleanQuery || (meaningfulPhrase && cat === meaningfulPhrase)) return 900000;

      // 3. Exact match on an individual sub-subcategory (e.g. "Adventitious Agents") -> 800,000
      if (subSubItems.includes(cleanQuery) || (meaningfulPhrase && subSubItems.includes(meaningfulPhrase))) return 800000;

      // 4. Subcategory starts with query -> 700,000
      if (sub.startsWith(cleanQuery) || (meaningfulPhrase && sub.startsWith(meaningfulPhrase))) return 700000;

      // 5. Category starts with query -> 600,000
      if (cat.startsWith(cleanQuery) || (meaningfulPhrase && cat.startsWith(meaningfulPhrase))) return 600000;

      // 6. Any individual sub-subcategory starts with query -> 500,000
      if (subSubItems.some((item) => item.startsWith(cleanQuery) || (meaningfulPhrase && item.startsWith(meaningfulPhrase)))) return 500000;

      // 7. Subcategory contains exact query phrase -> 400,000
      if (sub.includes(cleanQuery) || (meaningfulPhrase && sub.includes(meaningfulPhrase))) return 400000;

      // 8. Category contains exact query phrase -> 300,000
      if (cat.includes(cleanQuery) || (meaningfulPhrase && cat.includes(meaningfulPhrase))) return 300000;

      // 9. Sub-subcategory string contains exact query phrase -> 200,000
      if (subSub.includes(cleanQuery) || (meaningfulPhrase && subSub.includes(meaningfulPhrase))) return 200000;

      // 10. Subcategory contains all search terms (e.g. "Patient Recruitment & Support") -> 100,000
      if (searchTerms.length > 1 && searchTerms.every((t) => sub.includes(t))) return 100000;

      // 11. Category contains all search terms -> 80,000
      if (searchTerms.length > 1 && searchTerms.every((t) => cat.includes(t))) return 80000;

      // 12. Sub-subcategory contains all search terms -> 60,000
      if (searchTerms.length > 1 && searchTerms.every((t) => subSub.includes(t))) return 60000;

      // 13. Subcategory contains any search term -> 30,000
      if (searchTerms.some((t) => sub.includes(t))) return 30000;

      // 14. Category contains any search term -> 20,000
      if (searchTerms.some((t) => cat.includes(t))) return 20000;

      // 15. Sub-subcategory contains any search term -> 10,000
      if (searchTerms.some((t) => subSub.includes(t))) return 10000;

      // 16. Metadata match (description, metaDescription, metaKeywords)
      const desc = clean(row.description || "");
      const mDesc = clean(row.metaDescription || "");
      const mKw = clean(row.metaKeywords || "");
      const metaText = `${desc} ${mDesc} ${mKw}`;
      if (metaText.includes(cleanQuery) || (meaningfulPhrase && metaText.includes(meaningfulPhrase))) return 3000;
      if (searchTerms.every((t) => metaText.includes(t))) return 2000;

      // 17. Group name match -> 1,000
      if (group.includes(cleanQuery) || (searchTerms.length > 1 && searchTerms.every((t) => group.includes(t)))) return 1000;

      return 100;
    };

    const matched = categoryRows.filter((row) => {
      const g = clean(row.group || "");
      const c = clean(row.category || "");
      const s = clean(row.subcategory || "");
      const ss = clean(row.subSubcategory || "");
      const st = clean(row.status || "Active");
      const desc = clean(row.description || "");
      const mDesc = clean(row.metaDescription || "");
      const mKw = clean(row.metaKeywords || "");
      const fullText = `${g} ${c} ${s} ${ss} ${st} ${desc} ${mDesc} ${mKw}`;
      return searchTerms.every((term) => fullText.includes(term));
    });

    return matched.sort((a, b) => {
      const scoreA = getRelevanceScore(a);
      const scoreB = getRelevanceScore(b);
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher relevance score first
      }
      const rankA = groupRank[a.group] || 99;
      const rankB = groupRank[b.group] || 99;
      if (rankA !== rankB) return rankA - rankB;

      const cComp = (a.category || "").localeCompare(b.category || "", undefined, { sensitivity: "base" });
      if (cComp !== 0) return cComp;
      const sComp = (a.subcategory || "").localeCompare(b.subcategory || "", undefined, { sensitivity: "base" });
      if (sComp !== 0) return sComp;
      return (a.subSubcategory || "").localeCompare(b.subSubcategory || "", undefined, { sensitivity: "base" });
    });
  }, [categoryRows, categorySearch]);

  const exportPartners = (format: "csv" | "excel") => {
    const headers = [
      "Business Name",
      "Primary Contact",
      "Email",
      "Phone",
      "Website",
      "Head Office Country",
      "Profile Created Date",
      "Profile Created Time",
      "Created By Admin",
      "Status",
      "Latest Plan",
      "Listings",
      "Featured",
    ];

    const rows = filteredPartners.map((partner) => {
      const insight = partnerInsights[partner.id];
      const created = formatPartnerCreatedAt(partner.createdAt || partner.created || partner.registeredAt);
      const country = partner.businessCountry || partner.headOfficeCountry || partner.headquartersCountry || partner.country || "";
      return [
        partner.businessName || "",
        partner.primaryName || "",
        partner.primaryEmail || "",
        partner.phoneNumber || "",
        partner.companyWebsite || "",
        country,
        created.date !== "-" ? created.date : "",
        created.time || "",
        (partner as any).createdByAdmin ? "Yes" : "No",
        partner.partnerStatus || "",
        insight?.latestPlan || "-",
        `${insight?.listingCount || 0}`,
        `${insight?.featuredCount || 0}`,
      ];
    });

    const separator = format === "excel" ? "\t" : ",";
    const escapedRows = rows.map((row) =>
      row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(separator),
    );
    const content = [headers.join(separator), ...escapedRows].join("\n");

    const blob = new Blob([content], {
      type: format === "excel" ? "application/vnd.ms-excel;charset=utf-8;" : "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `partners-export-${new Date().toISOString().slice(0, 10)}.${format === "excel" ? "xls" : "csv"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const saveAdminSettings = async () => {
    try {
      setSettingsSaving(true);
      await setDoc(
        doc(db, "adminSettingsCollection", "platformSettings"),
        { ...settingsData, updatedAt: new Date() },
        { merge: true },
      );
      setSaveNotice("Settings saved.");
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not save settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleLogoUpload = async (file?: File) => {
    if (!file) return;
    try {
      setLogoUploading(true);
      const fileRef = ref(storage, `admin/settings/logo-${Date.now()}-${file.name}`);
      await uploadBytes(fileRef, file);
      const logoUrl = await getDownloadURL(fileRef);
      setSettingsData((prev) => ({ ...prev, logoUrl }));
      setSaveNotice("Logo uploaded. Click submit to save settings.");
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not upload logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const listingStatusCounts = useMemo(() => {
    const counts = {
      all: typeFilteredListings.length,
      active: 0,
      cancelled: 0,
      expired: 0,
      incomplete_payment: 0,
      disabled: 0,
      pending: 0,
    };
    typeFilteredListings.forEach((l) => {
      const status = getEffectiveListingStatus(l, listingInsights[l.id]);
      if (status === "Active" || status === "Approved") counts.active++;
      else if (status === "Cancelled") counts.cancelled++;
      else if (status === "Expired") counts.expired++;
      else if (status === "Incomplete Payment" || status === "Payment Error") counts.incomplete_payment++;
      else if (status === "Disabled") counts.disabled++;
      else if (status === "Pending Review" || status === "Pending") counts.pending++;
      else counts.active++;
    });
    return counts;
  }, [typeFilteredListings, listingInsights]);

  const filteredListings = useMemo(() => {
    return typeFilteredListings.filter((l) => {
      const status = getEffectiveListingStatus(l, listingInsights[l.id]);
      if (listingFilter === "pending" && status !== "Pending Review") return false;
      if (listingFilter === "active" && status !== "Active") return false;
      if (listingFilter === "approved" && status !== "Active") return false;
      if (listingFilter === "disabled" && status !== "Disabled") return false;
      if (listingFilter === "cancelled" && status !== "Cancelled") return false;
      if (listingFilter === "expired" && status !== "Expired") return false;
      if (listingFilter === "incomplete_payment" && status !== "Incomplete Payment") return false;
      if (listingFilter === "payment_error" && status !== "Incomplete Payment") return false;

      if (!listingSearchTerm) return true;

      const q = listingSearchTerm.toLowerCase();
      return (
        l.businessName?.toLowerCase().includes(q) ||
        l.selectedCategories?.some((c) => c.toLowerCase().includes(q)) ||
        l.selectedPlan?.toLowerCase().includes(q) ||
        status.toLowerCase().includes(q)
      );
    });
  }, [listingFilter, listingSearchTerm, typeFilteredListings, listingInsights]);

  const stats = {
    totalRevenue: transactions.reduce((acc, t) => acc + (t.amount || 0), 0),
    totalPartners: partners.length,
    pendingApprovals: partners.filter((p) => p.partnerStatus === "Pending").length,
    pendingListings: listingStatusCounts.pending,
    activeListings: listingStatusCounts.active,
  };

  const activeTabLabelMap: Record<AdminTab, string> = {
    overview: "Overview",
    partners: "Partners",
    listings: "Listings",
    plans: "Plans",
    featuredPlans: "Featured Plans",
    categories: "Categories",
    healthAuthorities: "Health Authority Sites",
    policies: "Site Policies",
    faqs: "FAQs",
    contact: "Contact Page",
    communityMembers: "Members",
    communityPosts: "Member posts",
    communityArchivePosts: "Archive posts",
    communityReportedComments: "Reported comments",
    communityCategories: "Community categories",
    emailLog: "Email log",
    settings: "Settings",
    transactions: "Transactions",
    audit: "Audit Trail",
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-slate-500">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 text-slate-900 flex overflow-hidden">
      <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 h-full">
        <div className="px-6 pt-6 pb-4 shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <h1 className="font-semibold text-lg">Admin Console</h1>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-1 custom-scrollbar">
            <SidebarItem label="Overview" icon={LayoutDashboard} active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <SidebarItem label="Partners" icon={Users} active={activeTab === "partners"} onClick={() => setActiveTab("partners")} badge={stats.pendingApprovals > 0 ? stats.pendingApprovals : undefined} />
            <SidebarItem label="Listings" icon={FileText} active={activeTab === "listings"} onClick={() => setActiveTab("listings")} badge={stats.pendingListings > 0 ? stats.pendingListings : undefined} />
            <SidebarItem label="Plans" icon={Tags} active={activeTab === "plans"} onClick={() => setActiveTab("plans")} />
            <SidebarItem label="Featured Plans" icon={Sparkles} active={activeTab === "featuredPlans"} onClick={() => setActiveTab("featuredPlans")} />
            <SidebarItem label="Categories" icon={FileText} active={activeTab === "categories"} onClick={() => setActiveTab("categories")} />
            <SidebarItem label="Health Authority Sites" icon={Globe} active={activeTab === "healthAuthorities"} onClick={() => setActiveTab("healthAuthorities")} />
            <SidebarItem label="Site Policies" icon={ShieldCheck} active={activeTab === "policies"} onClick={() => setActiveTab("policies")} />
            <SidebarItem label="FAQs" icon={HelpCircle} active={activeTab === "faqs"} onClick={() => setActiveTab("faqs")} />
            <SidebarItem label="Contact Page" icon={Mail} active={activeTab === "contact"} onClick={() => setActiveTab("contact")} />
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 px-3 pt-4 pb-1">Community</p>
            <SidebarItem label="Members" icon={User} active={activeTab === "communityMembers"} onClick={() => setActiveTab("communityMembers")} />
            <SidebarItem label="Member posts" icon={MessageSquare} active={activeTab === "communityPosts"} onClick={() => setActiveTab("communityPosts")} />
            <SidebarItem label="Archive posts" icon={FileText} active={activeTab === "communityArchivePosts"} onClick={() => setActiveTab("communityArchivePosts")} />
            <SidebarItem label="Reported comments" icon={Flag} active={activeTab === "communityReportedComments"} onClick={() => setActiveTab("communityReportedComments")} />
            <SidebarItem label="Community categories" icon={Tags} active={activeTab === "communityCategories"} onClick={() => setActiveTab("communityCategories")} />
            <SidebarItem label="Email log" icon={History} active={activeTab === "emailLog"} onClick={() => setActiveTab("emailLog")} />
            <SidebarItem label="Settings" icon={Settings} active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
            <SidebarItem label="Transactions" icon={Receipt} active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")} />
            <SidebarItem label="Audit Trail" icon={History} active={activeTab === "audit"} onClick={() => setActiveTab("audit")} />
        </nav>

        <div className="shrink-0 p-4 border-t border-slate-200 space-y-2 bg-white">
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full justify-start text-slate-600">
            <ExternalLink className="w-4 h-4 mr-2 shrink-0" /> Back to site
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50">
            <LogOut className="w-4 h-4 mr-2 shrink-0" /> Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <header className="h-20 border-b border-slate-200 bg-white flex items-center justify-between px-10 sticky top-0 z-40">
          <h2 className="text-xl font-semibold">{activeTabLabelMap[activeTab]}</h2>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{adminName}</p>
              <p className="text-xs text-slate-500">{adminEmail}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-600" />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto space-y-6">
          {saveNotice && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-800">
              {saveNotice}
            </div>
          )}

          {activeTab === "overview" && (
            <div className="space-y-6">
              <OverviewTab
                stats={stats}
                transactions={transactions}
                pendingListings={pendingListings}
                onApproveListing={(listing: ListingRecord) => setListingStatus(listing, "Active", true)}
                onViewListing={openListingEditor}
              />
              <VerificationMirrorsPanel />
            </div>
          )}

          {activeTab === "partners" && (
            isAddingPartner ? (
              <AdminAddPartner 
                onCancel={() => setIsAddingPartner(false)} 
                onSuccess={() => {
                  setIsAddingPartner(false);
                  setSaveNotice("Partner added successfully!");
                  setTimeout(() => setSaveNotice(""), 5000);
                }} 
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search partners by business or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 bg-white border-slate-200"
                      />
                    </div>
                    <select
                      value={partnerAdminFilter}
                      onChange={(e) => setPartnerAdminFilter(e.target.value as any)}
                      className="flex h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[190px] text-slate-700 font-medium"
                    >
                      <option value="all">All Accounts ({partners.length})</option>
                      <option value="admin">Created by Admin ({adminPartnerCount})</option>
                      <option value="non-admin">Self-Registered / User ({nonAdminPartnerCount})</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => exportPartners("csv")}>
                      <Download className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                    <Button variant="outline" onClick={() => exportPartners("excel")}>
                      <Download className="w-4 h-4 mr-2" /> Export Excel
                    </Button>
                    <Button onClick={() => setIsAddingPartner(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Add Partner <Plus className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
                <PartnerList
                  partners={filteredPartners}
                  partnerInsights={partnerInsights}
                  onView={openPartnerEditor}
                  onSetStatus={setPartnerStatus}
                />
              </div>
            )
          )}

          {activeTab === "listings" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center w-full">
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search listings by business, category, or plan..."
                      value={listingSearchTerm}
                      onChange={(e) => setListingSearchTerm(e.target.value)}
                      className="pl-10 h-11 bg-white border-slate-200"
                    />
                  </div>
                  <select
                    value={listingTypeFilter}
                    onChange={(e) => setListingTypeFilter(e.target.value)}
                    className="flex h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[180px] text-slate-700"
                  >
                    <option value="all">All Types</option>
                    <option value="business_offerings">Business Offering</option>
                    <option value="consulting">Consulting Service</option>
                    <option value="jobs">Job</option>
                    <option value="events">Event</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant={listingFilter === "all" ? "default" : "outline"} onClick={() => setListingFilter("all")}>
                    All ({listingStatusCounts.all})
                  </Button>
                  <Button variant={listingFilter === "active" || listingFilter === "approved" ? "default" : "outline"} onClick={() => setListingFilter("active")}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Active ({listingStatusCounts.active})
                  </Button>
                  <Button variant={listingFilter === "expired" ? "default" : "outline"} onClick={() => setListingFilter("expired")}>
                    <Clock className="w-4 h-4 mr-2" /> Expired ({listingStatusCounts.expired})
                  </Button>
                  <Button variant={listingFilter === "cancelled" ? "default" : "outline"} onClick={() => setListingFilter("cancelled")}>
                    <XCircle className="w-4 h-4 mr-2" /> Cancelled ({listingStatusCounts.cancelled})
                  </Button>
                  <Button variant={listingFilter === "incomplete_payment" || listingFilter === "payment_error" ? "default" : "outline"} onClick={() => setListingFilter("incomplete_payment")}>
                    <AlertTriangle className="w-4 h-4 mr-2" /> Incomplete Payment ({listingStatusCounts.incomplete_payment})
                  </Button>
                  {listingStatusCounts.disabled > 0 && (
                    <Button variant={listingFilter === "disabled" ? "default" : "outline"} onClick={() => setListingFilter("disabled")}>
                      <Ban className="w-4 h-4 mr-2" /> Disabled ({listingStatusCounts.disabled})
                    </Button>
                  )}
                  {listingStatusCounts.pending > 0 && (
                    <Button variant={listingFilter === "pending" ? "default" : "outline"} onClick={() => setListingFilter("pending")}>
                      <Clock className="w-4 h-4 mr-2" /> Pending ({listingStatusCounts.pending})
                    </Button>
                  )}
                </div>
              </div>

              <ListingsList
                listings={filteredListings}
                listingInsights={listingInsights}
                onView={openListingEditor}
                onSetStatus={setListingStatus}
                onSetFeatureStatus={setFeatureStatus}
              />
            </div>
          )}

          {activeTab === "transactions" && <TransactionList transactions={transactions} />}

          {activeTab === "plans" && <PlansCMS />}

          {activeTab === "featuredPlans" && (
            (isAddingFeaturedPlan || editingFeaturedPlan) ? (
              <AdminAddFeaturedPlan 
                initialPlan={editingFeaturedPlan}
                onCancel={() => {
                  setIsAddingFeaturedPlan(false);
                  setEditingFeaturedPlan(null);
                }}
                onSuccess={() => {
                  setIsAddingFeaturedPlan(false);
                  setEditingFeaturedPlan(null);
                  setSaveNotice(editingFeaturedPlan ? "Featured plan updated successfully!" : "Featured plan added successfully!");
                  setTimeout(() => setSaveNotice(""), 5000);
                }}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => { setEditingFeaturedPlan(null); setIsAddingFeaturedPlan(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Add Featured Plan <Plus className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <FeaturedPlansTab 
                  featuredPlans={featuredPlans} 
                  partners={partners} 
                  featuredPlansConfig={featuredPlansConfig}
                  onEditPlan={(plan, groupName) => setEditingFeaturedPlan({ ...plan, groupName })}
                  onDeletePlan={async (plan, _groupName) => {
                    if (!window.confirm(`Are you sure you want to delete the featured plan "${plan.label}"?`)) return;
                    const newGroups = featuredPlansConfig.groups.map(g => ({
                      ...g,
                      options: g.options.filter(o => o.id !== plan.id)
                    })).filter(g => g.options.length > 0);
                    await saveFeaturedPlansConfig({ groups: newGroups });
                    setSaveNotice("Featured plan deleted successfully!");
                    setTimeout(() => setSaveNotice(""), 4000);
                  }}
                  onTogglePlanStatus={async (plan, _groupName) => {
                    const newStatus = plan.status === "Active" ? "Inactive" : "Active";
                    const newGroups = featuredPlansConfig.groups.map(g => ({
                      ...g,
                      options: g.options.map(o => o.id === plan.id ? { ...o, status: newStatus as "Active" | "Inactive" } : o)
                    }));
                    await saveFeaturedPlansConfig({ groups: newGroups });
                    setSaveNotice(`Featured plan "${plan.label}" is now ${newStatus}!`);
                    setTimeout(() => setSaveNotice(""), 4000);
                  }}
                />
              </div>
            )
          )}

          {activeTab === "categories" && (
            isAddingCategory ? (
              <AdminAddCategory 
                onCancel={() => setIsAddingCategory(false)}
                onSuccess={() => {
                  setIsAddingCategory(false);
                  setSaveNotice("Category added successfully!");
                  setTimeout(() => setSaveNotice(""), 5000);
                }}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search categories, subcategories..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="pl-10 pr-10 h-11 bg-white border-slate-200"
                    />
                    {categorySearch && (
                      <button
                        type="button"
                        onClick={() => setCategorySearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                        aria-label="Clear category search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <Button onClick={() => setIsAddingCategory(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Add Category <Plus className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <CategoryBreakdownTable
                  rows={filteredCategoryRows}
                  totalCount={categoryRows.length}
                  searchQuery={categorySearch}
                  onClearSearch={() => setCategorySearch("")}
                />
              </div>
            )
          )}

          {activeTab === "healthAuthorities" && <AdminHealthAuthoritiesPanel />}
          {activeTab === "policies" && <AdminSitePoliciesPanel />}
          {activeTab === "faqs" && <AdminFaqsPanel />}
          {activeTab === "contact" && <AdminContactPanel />}

          {activeTab === "communityMembers" && <AdminMembersPanel />}
          {activeTab === "communityPosts" && <AdminMemberPostsPanel />}
          {activeTab === "communityArchivePosts" && <AdminArchivedPostsPanel />}
          {activeTab === "communityReportedComments" && <AdminReportedCommentsPanel />}

          {activeTab === "emailLog" && <AdminEmailLogPanel />}

          {activeTab === "communityCategories" && (
            <Card>
              <CardHeader>
                <CardTitle>Community category tree</CardTitle>
                <CardDescription>
                  Edit the three-level tree below; changes are stored at{" "}
                  <code className="text-xs">config/communityCategories</code> and used on the community feed, post
                  composer, and filters. <strong className="text-foreground">Labels</strong> are shown to members;{" "}
                  <strong className="text-foreground">ids</strong> are internal keys.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {communityCategoriesError && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {communityCategoriesError}
                  </div>
                )}
                {communityCategoriesLoading || !communityCategoriesDraft ? (
                  <p className="text-sm text-muted-foreground py-8">Loading category tree…</p>
                ) : (
                  <CommunityCategoryTreeEditor
                    value={communityCategoriesDraft}
                    onChange={setCommunityCategoriesDraft}
                    disabled={communityCategoriesSaving}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={saveCommunityCategories}
                    disabled={communityCategoriesSaving || communityCategoriesLoading || !communityCategoriesDraft}
                  >
                    {communityCategoriesSaving ? "Saving…" : "Save to Firestore"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={communityCategoriesSaving}
                    onClick={async () => {
                      try {
                        const r = await seedCommunityCategoriesIfMissing();
                        setSaveNotice(
                          r === "seeded"
                            ? "Default main categories written to Firestore."
                            : "Config already exists — use Reset to load template into editor.",
                        );
                      } catch (e) {
                        console.error(e);
                        setCommunityCategoriesError("Seed failed.");
                      }
                    }}
                  >
                    Seed defaults (if empty)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={communityCategoriesSaving}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Replace the editor with the default main-category tree? Unsaved changes will be lost.",
                        )
                      ) {
                        setCommunityCategoriesDraft(
                          ensureCommunityCategoryDoc(JSON.parse(JSON.stringify(DEFAULT_COMMUNITY_CATEGORIES))),
                        );
                        setCommunityCategoriesError("");
                      }
                    }}
                  >
                    Reset to default template
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "settings" && (
            <AdminSettingsTab
              settingsData={settingsData}
              settingsSaving={settingsSaving}
              logoUploading={logoUploading}
              onChange={(patch) => setSettingsData((prev) => ({ ...prev, ...patch }))}
              onSave={saveAdminSettings}
              onLogoUpload={handleLogoUpload}
            />
          )}

          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search audit logs by company name or ID..."
                    value={auditSearchTerm}
                    onChange={(e) => setAuditSearchTerm(e.target.value)}
                    className="pl-10 h-11 bg-white border-slate-200"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAuditCategoryFilter("all")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      auditCategoryFilter === "all"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All Logs
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditCategoryFilter("partner")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      auditCategoryFilter === "partner"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Partner Accounts
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditCategoryFilter("listing")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      auditCategoryFilter === "listing"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Listings & Payments
                  </button>
                </div>
              </div>
              <AuditLogList
                logs={auditLogs.filter(log => {
                  if (auditCategoryFilter === "partner" && !isPartnerAccountLog(log)) {
                    return false;
                  }
                  if (auditCategoryFilter === "listing" && !isListingOrBillingLog(log)) {
                    return false;
                  }
                  if (!auditSearchTerm) return true;
                  const q = auditSearchTerm.toLowerCase();
                  return (
                    log.partnerName?.toLowerCase().includes(q) ||
                    log.action?.toLowerCase().includes(q) ||
                    log.details?.toLowerCase().includes(q) ||
                    log.partnerId?.toLowerCase().includes(q)
                  );
                })}
              />
            </div>
          )}
        </div>
      </main>

      <Sheet open={partnerEditorOpen} onOpenChange={setPartnerEditorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-slate-100 flex-row items-center justify-between space-y-0">
            <div>
              <SheetTitle>Edit Partner Profile</SheetTitle>
              <SheetDescription>Update partner's information and account status</SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                setActiveTab("audit");
                setAuditCategoryFilter("partner");
                setAuditSearchTerm(selectedPartner?.id || "");
                setPartnerEditorOpen(false);
              }}
            >
              <History className="w-4 h-4" />
              View History
            </Button>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {selectedPartner && !Boolean((selectedPartner as any).createdByAdmin) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Self-Registered Partner Account</span>
                  <p className="text-amber-700 mt-0.5">Only the Company Name and Primary Contact Name are editable by admins. Other profile fields are managed directly by the user.</p>
                </div>
              </div>
            )}

            {/* Section 1: Account Status & Plan */}
            <div className="border-b pb-2 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Account Status & Plan</h3>
            </div>

            <Field 
              label="Selected Group (business_offerings, consulting, events, jobs)" 
              value={partnerEditor.selectedGroup || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, selectedGroup: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />
            <Field 
              label="Selected Plan" 
              value={partnerEditor.selectedPlan || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, selectedPlan: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />

            {selectedPartner && Boolean((selectedPartner as any).createdByAdmin) && partnerInsights[selectedPartner.id]?.trialInfo && (() => {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const trial = partnerInsights[selectedPartner.id].trialInfo!;
              return (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wider text-slate-500">Trial Period Status</span>
                    {trial.isExpired ? (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">Expired</Badge>
                    ) : (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200">Active ({trial.currentDay}/{trial.durationDays} Days)</Badge>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>Start Date:</strong> {new Date(trial.startDate).toLocaleDateString()}</p>
                    <p><strong>Expiration:</strong> {new Date(trial.billingPeriodEnd).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-medium text-slate-500">Extend Trial Period:</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white hover:bg-slate-100 text-xs py-1"
                        onClick={() => extendTrial(7)}
                      >
                        +7 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white hover:bg-slate-100 text-xs py-1"
                        onClick={() => extendTrial(30)}
                      >
                        +30 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white hover:bg-slate-100 text-xs py-1"
                        onClick={() => extendTrial(90)}
                      >
                        +90 Days
                      </Button>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-200 space-y-2">
                    {lastTrialEndMs !== null && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs py-1 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-500"
                        onClick={undoExtension}
                      >
                        ↩ Undo Last Extension (revert to {new Date(lastTrialEndMs).toLocaleDateString()})
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs py-1 text-rose-600 border-rose-200 bg-white hover:bg-rose-50 hover:border-rose-400"
                      onClick={cancelTrial}
                    >
                      Cancel Trial
                    </Button>
                  </div>
                </div>
              );
            })()}

            {selectedPartner && Boolean((selectedPartner as any).createdByAdmin) && (() => {
              const partnerFeature = featuredPlans.find((f) => f.partnerId === selectedPartner.id);
              if (!partnerFeature && !selectedPartner.selectedAddon) return null;
              const accessDate = partnerFeature?.accessThrough ? new Date(typeof (partnerFeature.accessThrough as any).toDate === 'function' ? (partnerFeature.accessThrough as any).toDate() : partnerFeature.accessThrough) : null;
              const isExpired = accessDate ? accessDate.getTime() < Date.now() : false;
              const featureName = (partnerFeature?.featureName || partnerFeature?.featureId || selectedPartner.selectedAddon || "").replace(/_/g, ' ');
              return (
                <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-200 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Feature Spotlight Status
                    </span>
                    {isExpired ? (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">Expired</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300">Active Spotlight</Badge>
                    )}
                  </div>
                  <div className="text-sm text-slate-700 space-y-1">
                    <p><strong>Feature:</strong> {featureName}</p>
                    {accessDate && <p><strong>Expiration:</strong> {accessDate.toLocaleDateString()}</p>}
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-medium text-amber-900">Extend Feature Spotlight Period:</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white hover:bg-amber-100/60 text-xs py-1 border-amber-200"
                        onClick={() => extendFeature(7)}
                      >
                        +7 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white hover:bg-amber-100/60 text-xs py-1 border-amber-200"
                        onClick={() => extendFeature(30)}
                      >
                        +30 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white hover:bg-amber-100/60 text-xs py-1 border-amber-200"
                        onClick={() => extendFeature(90)}
                      >
                        +90 Days
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Section 2: Contact Information */}
            <div className="border-b pb-2 pt-4 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Contact Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" value={partnerEditor.firstName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, firstName: v }))} />
              <Field label="Last Name" value={partnerEditor.lastName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, lastName: v }))} />
            </div>
            <Field label="Primary Contact Name" value={partnerEditor.primaryName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, primaryName: v }))} />
            <Field 
              label="Primary Email" 
              value={partnerEditor.primaryEmail || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, primaryEmail: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />
            <Field 
              label="Phone Number" 
              value={partnerEditor.phoneNumber || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, phoneNumber: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />

            {/* Section 3: Company Details */}
            <div className="border-b pb-2 pt-4 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Company Details</h3>
            </div>
            <Field label="Business / Company Name" value={partnerEditor.businessName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, businessName: v }))} />
            <Field 
              label="Company Website" 
              value={partnerEditor.companyWebsite || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, companyWebsite: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />
            <Field 
              label="Business Phone" 
              value={partnerEditor.businessPhone || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, businessPhone: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />
            <Field 
              label="LinkedIn Profile" 
              value={partnerEditor.linkedinProfile || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, linkedinProfile: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />
            <Field 
              label="Business Country" 
              value={partnerEditor.businessCountry || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, businessCountry: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />
            <div className="space-y-1">
              <p className={`text-sm font-medium ${!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "text-slate-500" : "text-slate-700"}`}>Business Address</p>
              <Textarea
                value={partnerEditor.businessAddress || ""}
                onChange={(e) => setPartnerEditor((prev) => ({ ...prev, businessAddress: e.target.value }))}
                disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                className={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "min-h-20 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" : "min-h-20"}
              />
            </div>
            <div className="space-y-1">
              <p className={`text-sm font-medium ${!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "text-slate-500" : "text-slate-700"}`}>Company Profile Description</p>
              <Textarea
                value={partnerEditor.companyProfileText || ""}
                onChange={(e) => setPartnerEditor((prev) => ({ ...prev, companyProfileText: e.target.value }))}
                disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                className={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "min-h-20 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" : "min-h-20"}
              />
            </div>

            {/* Section 4: Billing & Registration */}
            <div className="border-b pb-2 pt-4 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Billing & Registration</h3>
            </div>
            <Field 
              label="Billing Email Address" 
              value={partnerEditor.billingEmailAddress || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, billingEmailAddress: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />
            <Field 
              label="VAT / ABN / EIN / Business ID" 
              value={partnerEditor.VAT_ABN_EIN_businessId || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, VAT_ABN_EIN_businessId: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />
            <Field 
              label="Alternate Contact Name" 
              value={partnerEditor.altContactName || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, altContactName: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />
            <Field 
              label="Alternate Contact Email" 
              value={partnerEditor.altEmail || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, altEmail: v }))} 
              disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
            />

            {/* Section 5: Event Specific Details */}
            {partnerEditor.selectedGroup === "events" && (
              <>
                <div className="border-b pb-2 pt-4 mb-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Event Details</h3>
                </div>
                <Field 
                  label="Event Name" 
                  value={partnerEditor.eventName || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, eventName: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Event Link" 
                  value={partnerEditor.eventLink || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, eventLink: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field 
                    label="Start Date" 
                    value={partnerEditor.startDate || ""} 
                    onChange={(v) => setPartnerEditor((prev) => ({ ...prev, startDate: v }))} 
                    disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                  />
                  <Field 
                    label="End Date" 
                    value={partnerEditor.endDate || ""} 
                    onChange={(v) => setPartnerEditor((prev) => ({ ...prev, endDate: v }))} 
                    disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                  />
                </div>
                <Field 
                  label="Event Country" 
                  value={partnerEditor.eventCountry || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, eventCountry: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="State / Region" 
                  value={partnerEditor.stateRegion || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, stateRegion: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="City" 
                  value={partnerEditor.city || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, city: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Location" 
                  value={partnerEditor.location || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, location: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <div className="space-y-1">
                  <p className={`text-sm font-medium ${!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "text-slate-500" : "text-slate-700"}`}>Event Profile</p>
                  <Textarea
                    value={partnerEditor.eventProfile || ""}
                    onChange={(e) => setPartnerEditor((prev) => ({ ...prev, eventProfile: e.target.value }))}
                    disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                    className={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "min-h-20 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" : "min-h-20"}
                  />
                </div>
                <div className="space-y-1">
                  <p className={`text-sm font-medium ${!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "text-slate-500" : "text-slate-700"}`}>Agenda Highlights</p>
                  <Textarea
                    value={partnerEditor.agendaHighlights || ""}
                    onChange={(e) => setPartnerEditor((prev) => ({ ...prev, agendaHighlights: e.target.value }))}
                    disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                    className={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "min-h-20 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" : "min-h-20"}
                  />
                </div>
                <Field 
                  label="Agenda PDF URL" 
                  value={partnerEditor.agendaPdfUrl || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, agendaPdfUrl: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
              </>
            )}

            {/* Section 7: Job Specific Details */}
            {partnerEditor.selectedGroup === "jobs" && (
              <>
                <div className="border-b pb-2 pt-4 mb-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Job Details</h3>
                </div>
                <Field 
                  label="Job Title" 
                  value={partnerEditor.jobTitle || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, jobTitle: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Industry" 
                  value={partnerEditor.industry || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, industry: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Position Type" 
                  value={partnerEditor.positionType || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, positionType: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Experience Level" 
                  value={partnerEditor.experienceLevel || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, experienceLevel: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Position Link" 
                  value={partnerEditor.positionLink || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, positionLink: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Job Country" 
                  value={partnerEditor.jobCountry || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, jobCountry: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="State / Region" 
                  value={partnerEditor.stateRegion || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, stateRegion: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="City" 
                  value={partnerEditor.city || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, city: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Location" 
                  value={partnerEditor.location || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, location: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <div className="space-y-1">
                  <p className={`text-sm font-medium ${!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "text-slate-500" : "text-slate-700"}`}>Job Summary</p>
                  <Textarea
                    value={partnerEditor.jobSummary || ""}
                    onChange={(e) => setPartnerEditor((prev) => ({ ...prev, jobSummary: e.target.value }))}
                    disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                    className={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) ? "min-h-20 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" : "min-h-20"}
                  />
                </div>
                <Field 
                  label="Education Required" 
                  value={partnerEditor.education || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, education: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Work Model" 
                  value={partnerEditor.workModel || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, workModel: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Application Deadline" 
                  value={partnerEditor.applicationDeadline || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, applicationDeadline: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
                <Field 
                  label="Job Description PDF URL" 
                  value={partnerEditor.jobDescriptionPdfUrl || ""} 
                  onChange={(v) => setPartnerEditor((prev) => ({ ...prev, jobDescriptionPdfUrl: v }))} 
                  disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)}
                />
              </>
            )}

            <Button 
              onClick={savePartnerEdits} 
              disabled={!((partnerEditor.primaryName?.trim() || (partnerEditor.firstName?.trim() && partnerEditor.lastName?.trim())) && partnerEditor.businessName?.trim())} 
              className="w-full"
            >
              Save Partner Changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={listingEditorOpen} onOpenChange={setListingEditorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-slate-100 flex-row items-center justify-between space-y-0">
            <div>
              <SheetTitle>Listing Details</SheetTitle>
              <SheetDescription>Inspect and manually edit listing information.</SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                if (selectedListing) {
                  const pId = selectedListing.__path?.split('/')[1] || selectedListing.partnerId || "";
                  setActiveTab("audit");
                  setAuditCategoryFilter("listing");
                  setAuditSearchTerm(pId || selectedListing.businessName || "");
                  setListingEditorOpen(false);
                }
              }}
            >
              <History className="w-4 h-4" />
              View Listing History
            </Button>
          </SheetHeader>
          <div className="mt-6 space-y-6 pb-6">
            {(() => {
              const col = selectedListing?.__col || "";
              const grp = (listingEditor.selectedGroup || selectedListing?.selectedGroup || "").toLowerCase();
              const isEvent = col === "eventsCollection" || grp === "events" || grp === "event";
              const isJob = col === "jobsCollection" || grp === "jobs" || grp === "job";
              const isConsulting = col === "consultingServicesCollection" || col === "consultingCollection" || grp === "consulting" || grp === "consulting_services";
              const isBusinessOffering = col === "businessOfferingsCollection" || grp === "business_offerings" || (!isEvent && !isJob && !isConsulting);
              const isBusinessOrConsulting = isBusinessOffering || isConsulting;

              const categoryGroup = isEvent ? "events" : isJob ? "jobs" : isConsulting ? "consulting" : "business_offerings";
              const typeLabel = isEvent ? "Event" : isJob ? "Job" : isConsulting ? "Consulting Service" : "Business Offering";

              return (
                <>
                  {/* Section 1: Listing Status & Plan */}
                  <div className="border-b pb-2 mb-2">
                    <h3 className="font-semibold text-slate-900 text-sm">Listing Status & Plan</h3>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">Status</p>
                    <select
                      value={listingEditor.status || "Active"}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        setListingEditor((prev) => ({ 
                          ...prev, 
                          status: newStatus,
                          active: `${newStatus === "Active"}` 
                        }));
                      }}
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                    >
                      <option value="Active">Active</option>
                      <option value="Expired">Expired</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Incomplete Payment">Incomplete Payment</option>
                    </select>
                  </div>
                  <Field label="Active (true or false)" value={listingEditor.active || "true"} onChange={() => {}} disabled={true} />
                  <Field label="Plan" value={listingEditor.selectedPlan || ""} onChange={() => {}} disabled={true} />
                  <Field label="Listing Type" value={typeLabel} onChange={() => {}} disabled={true} />
                  <Field 
                    label="Feature Status" 
                    value={selectedListing ? (listingInsights[selectedListing.id]?.featureStatus || "None") : "None"} 
                    onChange={() => {}} 
                    disabled={true} 
                  />
                  <Field 
                    label="Feature Plan" 
                    value={selectedListing ? (listingInsights[selectedListing.id]?.featurePlan || "-") : "-"} 
                    onChange={() => {}} 
                    disabled={true} 
                  />

                  {/* Section 2: Core Info */}
                  <div className="border-b pb-2 pt-2 mb-2">
                    <h3 className="font-semibold text-slate-900 text-sm">Core Information</h3>
                  </div>
                  <Field 
                    label={isJob ? "Company / Employer Name" : isEvent ? "Organizer / Business Name" : "Business Name"} 
                    value={listingEditor.businessName || ""} 
                    onChange={() => {}} 
                    disabled={true} 
                  />
                  <Field label="Company Website" value={listingEditor.companyWebsite || ""} onChange={() => {}} disabled={true} />
                  
                  {isBusinessOrConsulting && (
                    <>
                      <Field label="Business Country" value={listingEditor.businessCountry || ""} onChange={() => {}} disabled={true} />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-500">Business Address</p>
                        <Textarea value={listingEditor.businessAddress || ""} disabled={true} className="min-h-16 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-500">Company Profile</p>
                        <Textarea
                          value={listingEditor.companyProfileText || ""}
                          disabled={true}
                          className="min-h-24 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                        />
                        <p className="text-xs text-right text-slate-400">{(listingEditor.companyProfileText || "").length}/{COMPANY_PROFILE_MAX_LENGTH}</p>
                      </div>
                    </>
                  )}

                  {/* Section 3: Categories & Geography */}
                  <div className="border-b pb-2 pt-2 mb-2">
                    <h3 className="font-semibold text-slate-900 text-sm">Categories & Geography</h3>
                  </div>
                  <CategoryTreeDropdown
                    selectedGroup={categoryGroup}
                    selectedCategories={listingEditor.selectedCategories || []}
                    selectedSubcategories={listingEditor.selectedSubcategories || []}
                    selectedSubSubcategories={listingEditor.selectedSubSubcategories || []}
                    onChange={() => {}}
                    disabled={true}
                  />
                  {isBusinessOrConsulting && (
                    <>
                      <MultiSelectDropdown
                        label="Service Countries"
                        items={SERVICE_COUNTRIES}
                        selected={listingEditor.serviceCountries || []}
                        onToggle={() => {}}
                        placeholder="Select countries..."
                        disabled={true}
                      />
                      <MultiSelectDropdown
                        label="Service Regions"
                        items={SERVICE_REGIONS}
                        selected={listingEditor.serviceRegions || []}
                        onToggle={() => {}}
                        placeholder="Select regions..."
                        disabled={true}
                      />
                    </>
                  )}

                  {/* Section 4: Business Offering / Consulting specific */}
                  {isBusinessOrConsulting && (
                    <>
                      <div className="border-b pb-2 pt-2 mb-2">
                        <h3 className="font-semibold text-slate-900 text-sm">{isConsulting ? "Consulting Service Details" : "Business Offering Details"}</h3>
                      </div>
                      <Field label="Bio Safety Level (BSL) (comma separated, e.g. 1,2,3)" value={listingEditor.bioSafetyLevelCsv || ""} onChange={() => {}} disabled={true} />
                      <Field label="Certifications (comma separated, e.g. GMP,ISO 9001)" value={listingEditor.certificationsCsv || ""} onChange={() => {}} disabled={true} />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-500">Company Representatives (JSON)</p>
                        <Textarea
                          value={listingEditor.companyRepresentativesJson || ""}
                          disabled={true}
                          className="min-h-24 font-mono text-xs bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                          placeholder='[{"firstName":"","lastName":"","email":""}]'
                        />
                      </div>
                    </>
                  )}

                  {/* Section 5: Event Fields */}
                  {isEvent && (
                    <>
                      <div className="border-b pb-2 pt-2 mb-2">
                        <h3 className="font-semibold text-slate-900 text-sm">Event Details</h3>
                      </div>
                      <Field label="Event Name" value={listingEditor.eventName || ""} onChange={() => {}} disabled={true} />
                      <Field label="Event Link / Sign-up URL" value={listingEditor.eventLink || ""} onChange={() => {}} disabled={true} />
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Start Date" value={listingEditor.startDate || ""} onChange={() => {}} disabled={true} />
                        <Field label="End Date" value={listingEditor.endDate || ""} onChange={() => {}} disabled={true} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Event Country" value={listingEditor.eventCountry || ""} onChange={() => {}} disabled={true} />
                        <Field label="State / Region" value={listingEditor.stateRegion || ""} onChange={() => {}} disabled={true} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="City" value={listingEditor.city || ""} onChange={() => {}} disabled={true} />
                        <Field label="Location / Venue" value={listingEditor.location || ""} onChange={() => {}} disabled={true} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-500">Event Profile</p>
                        <Textarea value={listingEditor.eventProfile || ""} disabled={true} className="min-h-20 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-500">Agenda Highlights</p>
                        <Textarea value={listingEditor.agendaHighlights || ""} disabled={true} className="min-h-16 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" />
                      </div>
                      <Field label="Agenda PDF URL" value={listingEditor.agendaPdfUrl || ""} onChange={() => {}} disabled={true} />
                    </>
                  )}

                  {/* Section 6: Job Fields */}
                  {isJob && (
                    <>
                      <div className="border-b pb-2 pt-2 mb-2">
                        <h3 className="font-semibold text-slate-900 text-sm">Job Details</h3>
                      </div>
                      <Field label="Job Title" value={listingEditor.jobTitle || ""} onChange={() => {}} disabled={true} />
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Industry" value={listingEditor.industry || ""} onChange={() => {}} disabled={true} />
                        <Field label="Position Type" value={listingEditor.positionType || ""} onChange={() => {}} disabled={true} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Experience Level" value={listingEditor.experienceLevel || ""} onChange={() => {}} disabled={true} />
                        <Field label="Work Model" value={listingEditor.workModel || ""} onChange={() => {}} disabled={true} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Job Country" value={listingEditor.jobCountry || ""} onChange={() => {}} disabled={true} />
                        <Field label="Education" value={listingEditor.education || ""} onChange={() => {}} disabled={true} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Application Deadline" value={listingEditor.applicationDeadline || ""} onChange={() => {}} disabled={true} />
                        <Field label="Apply Link" value={listingEditor.positionLink || ""} onChange={() => {}} disabled={true} />
                      </div>
                      <Field label="Company Website Link (Job)" value={listingEditor.companyWebsiteLink || ""} onChange={() => {}} disabled={true} />
                      <Field label="LinkedIn Job URL" value={listingEditor.linkedInJob || ""} onChange={() => {}} disabled={true} />
                      <Field label="Job Description PDF URL" value={listingEditor.jobDescriptionPdfUrl || ""} onChange={() => {}} disabled={true} />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-500">Job Summary</p>
                        <Textarea value={listingEditor.jobSummary || ""} disabled={true} className="min-h-20 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" />
                      </div>
                      {listingEditor.companyRepresentativesJson && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">Company Representatives (JSON)</p>
                          <Textarea
                            value={listingEditor.companyRepresentativesJson}
                            disabled={true}
                            className="min-h-24 font-mono text-xs bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}

            <div className="flex items-center gap-3 mt-2">
              <Button onClick={saveListingEdits} className="w-full">Save Status Change</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarItem({
  label,
  icon: Icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: any;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors ${
        active ? "bg-slate-900 text-white font-semibold" : "text-slate-600 hover:bg-slate-100 font-medium"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0 text-current" />
      <span className="text-sm text-left truncate flex-1 leading-snug">{label}</span>
      {badge ? (
        <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 shrink-0">
          {badge}
        </span>
      ) : (
        active && <ChevronRight className="ml-auto w-4 h-4 text-white/80 shrink-0" />
      )}
    </button>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string | number;
  icon: any;
  iconClass: string;
}) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-wide text-slate-500">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
          <div className={`p-2 rounded-md ${iconClass}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({
  stats,
  transactions,
  pendingListings,
  onApproveListing,
  onViewListing,
}: {
  stats: any;
  transactions: any[];
  pendingListings: ListingRecord[];
  onApproveListing: (listing: ListingRecord) => void;
  onViewListing: (listing: ListingRecord) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Revenue" value={`$${Number(stats.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={Receipt} iconClass="bg-emerald-100 text-emerald-700" />
        <StatCard label="Partners" value={stats.totalPartners} icon={Users} iconClass="bg-sky-100 text-sky-700" />
        <StatCard label="Pending Partners" value={stats.pendingApprovals} icon={AlertCircle} iconClass="bg-amber-100 text-amber-700" />
        <StatCard label="Pending Listings" value={stats.pendingListings} icon={Clock} iconClass="bg-amber-100 text-amber-700" />
        <StatCard label="Live Listings" value={stats.activeListings} icon={BadgeCheck} iconClass="bg-indigo-100 text-indigo-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest 7 successful platform payments.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Partner</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right pr-6">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 7).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-6">{t.customerEmail || "-"}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">${t.amount?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell className="text-right pr-6 text-slate-500">
                      {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Listings Pending Review</CardTitle>
            <CardDescription>Approve or inspect before publishing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingListings.length === 0 ? (
              <p className="text-sm text-slate-500">No pending listings right now.</p>
            ) : (
              pendingListings.slice(0, 5).map((listing) => (
                <div key={listing.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-medium">{listing.businessName || "Unnamed"}</p>
                  <p className="text-xs text-slate-500 mb-3">{listing.selectedPlan?.replace(/_/g, " ") || "-"}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => onApproveListing(listing)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onViewListing(listing)}>
                      <Eye className="w-4 h-4 mr-1" /> Review
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatPartnerCreatedAt(raw: any) {
  if (!raw) return { date: "-", time: "" };
  let dateObj: Date | null = null;
  if (typeof raw.toDate === "function") {
    dateObj = raw.toDate();
  } else if (raw.seconds != null) {
    dateObj = new Date(raw.seconds * 1000);
  } else if (raw instanceof Date) {
    dateObj = raw;
  } else if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      dateObj = d;
    }
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return { date: "-", time: "" };
  }

  const dateStr = dateObj.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = dateObj.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return { date: dateStr, time: timeStr };
}

function PartnerList({
  partners,
  partnerInsights,
  onView,
  onSetStatus,
}: {
  partners: PartnerRecord[];
  partnerInsights: Record<
    string,
    {
      latestPlan: string;
      listingCount: number;
      featuredCount: number;
      trialInfo?: {
        durationDays: number;
        currentDay: number;
        isExpired: boolean;
        daysLeft: number;
      } | null;
    }
  >;
  onView: (partner: PartnerRecord) => void;
  onSetStatus: (partner: PartnerRecord, status: string) => void;
}) {
  if (partners.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <SearchX className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No partners found</h3>
        <p className="text-sm text-slate-500">Try a different business name or email.</p>
      </div>
    );
  }

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 pr-2 py-3 text-xs">Business</TableHead>
                <TableHead className="px-2 py-3 text-xs">Email</TableHead>
                <TableHead className="px-2 py-3 text-xs">Phone</TableHead>
                <TableHead className="px-2 py-3 text-xs">Profile Created</TableHead>
                <TableHead className="px-2 py-3 text-xs">User Plan</TableHead>
                <TableHead className="px-2 py-3 text-xs">Listings</TableHead>
                <TableHead className="px-2 py-3 text-xs">Featured</TableHead>
                <TableHead className="px-2 py-3 text-xs">Contact</TableHead>
                <TableHead className="px-2 py-3 text-xs">By Admin</TableHead>
                <TableHead className="pl-2 pr-4 py-3 text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((partner) => {
                const insight = partnerInsights[partner.id];
                const trial = insight?.trialInfo;
                const created = formatPartnerCreatedAt(partner.createdAt || partner.created || partner.registeredAt);

                let trialBadge = null;
                if (trial) {
                  if (trial.isExpired) {
                    trialBadge = (
                      <Badge className="w-fit bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0 font-normal">
                        Trial: Expired
                      </Badge>
                    );
                  } else {
                    const percentage = (trial.currentDay / trial.durationDays) * 100;
                    let colorClass = "bg-blue-50 text-blue-700 border-blue-200";
                    if (percentage >= 90) {
                      colorClass = "bg-rose-50 text-rose-700 border-rose-200";
                    } else if (percentage >= 50) {
                      colorClass = "bg-amber-50 text-amber-700 border-amber-200";
                    }
                    trialBadge = (
                      <Badge className={`w-fit border text-[10px] px-1.5 py-0 font-normal ${colorClass}`}>
                        Trial: {trial.currentDay}/{trial.durationDays}
                      </Badge>
                    );
                  }
                }

                return (
                  <TableRow key={partner.id}>
                    <TableCell className="pl-4 pr-2 py-2">
                      <p className="font-medium max-w-[130px] truncate text-sm" title={partner.businessName || "Unnamed Business"}>
                        {partner.businessName || "Unnamed Business"}
                      </p>
                      <p className="text-xs text-slate-500 max-w-[130px] truncate" title={partner.companyWebsite || ""}>
                        {partner.companyWebsite || "-"}
                      </p>
                    </TableCell>
                    <TableCell className="px-2 py-2 text-sm max-w-[110px] truncate" title={partner.primaryEmail || ""}>
                      {partner.primaryEmail || "-"}
                    </TableCell>
                    <TableCell className="px-2 py-2 text-sm max-w-[110px] truncate" title={partner.phoneNumber || ""}>
                      {partner.phoneNumber || "-"}
                    </TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">
                      {created.date !== "-" ? (
                        <div>
                          <p className="text-xs font-medium text-slate-800">{created.date}</p>
                          <p className="text-[11px] text-slate-500">{created.time}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>

                    <TableCell className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium truncate max-w-[120px]" title={insight?.latestPlan || ""}>
                          {insight?.latestPlan || "-"}
                        </span>
                        {trialBadge}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2 text-sm text-center">{insight?.listingCount || 0}</TableCell>
                    <TableCell className="px-2 py-2 text-sm text-center">{insight?.featuredCount || 0}</TableCell>
                    <TableCell className="px-2 py-2">
                      <p className="text-sm max-w-[110px] truncate font-medium text-slate-800" title={partner.primaryName || ""}>
                        {partner.primaryName || "-"}
                      </p>
                      <p className="text-xs text-slate-500 max-w-[130px] truncate" title={partner.businessCountry || partner.headOfficeCountry || partner.headquartersCountry || partner.country || ""}>
                        {partner.businessCountry || partner.headOfficeCountry || partner.headquartersCountry || partner.country || "-"}
                      </p>
                    </TableCell>
                    <TableCell className="px-2 py-2 text-sm text-center">
                      {(partner as any).createdByAdmin ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="pl-2 pr-4 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[190px]">
                          <DropdownMenuLabel>Partner Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onView(partner)}>
                            <Eye className="w-4 h-4 mr-2" /> View / Edit profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onSetStatus(partner, "Pending")}>
                            <Clock className="w-4 h-4 mr-2 text-amber-600" /> Unapprove (set pending)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSetStatus(partner, "Disabled")}>
                            <Ban className="w-4 h-4 mr-2 text-rose-600" /> Disable account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}



function FeaturedPlansTab({
  featuredPlans,
  partners,
  featuredPlansConfig,
  onEditPlan,
  onDeletePlan,
  onTogglePlanStatus,
}: {
  featuredPlans: FeaturedPlanPurchase[];
  partners: PartnerRecord[];
  featuredPlansConfig: FeaturedPlansConfig;
  onEditPlan: (plan: FeaturedPlanOption, groupName: string) => void;
  onDeletePlan: (plan: FeaturedPlanOption, groupName: string) => void;
  onTogglePlanStatus: (plan: FeaturedPlanOption, groupName: string) => void;
}) {
  const purchaseCountByFeature = useMemo(() => {
    return featuredPlans.reduce((acc, feature) => {
      const id = (feature.featureId || feature.featureName || "unknown").toLowerCase();
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [featuredPlans]);

  const recentPurchases = useMemo(() => {
    return featuredPlans.slice(0, 12).map((feature) => {
      const partner = partners.find((p) => p.id === feature.partnerId);
      return {
        ...feature,
        partnerName: partner?.businessName || "Unknown partner",
      };
    });
  }, [featuredPlans, partners]);

  const groups = featuredPlansConfig?.groups || [];

  return (
    <div className="space-y-6">
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Feature Plans</CardTitle>
          <CardDescription>Featured placements, information, and pricing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {groups.map((group) => (
            <div key={group.service} className="space-y-3">
              <h4 className="font-semibold text-slate-800">{group.service}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {group.options.map((option) => {
                  const pCount =
                    purchaseCountByFeature[option.id.toLowerCase()] ||
                    purchaseCountByFeature[option.label.toLowerCase()] ||
                    0;
                  const isActive = option.status !== "Inactive";

                  return (
                    <div
                      key={option.id}
                      className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white relative hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onTogglePlanStatus(option, group.service)}
                          title="Click to toggle Active/Inactive"
                          className="cursor-pointer"
                        >
                          <Badge
                            className={
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                            }
                          >
                            {isActive ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => onEditPlan(option, group.service)}
                            title="Edit Plan"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onDeletePlan(option, group.service)}
                            title="Delete Plan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="font-semibold text-slate-900 text-base">{option.label}</p>
                      <p className="text-sm text-slate-600">Specification : {option.specification || "—"}</p>
                      <p className="font-semibold text-slate-900">
                        Amount In $ : $
                        {Number(option.price || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-sm text-slate-700">For : {option.durationDays || 30} days</p>
                      <p className="text-sm text-slate-700">
                        Number of Country : {option.countryLimit === -1 ? "Unlimited" : (option.countryLimit ?? 1)}
                      </p>
                      <p className="text-sm text-slate-700">
                        Number of Category : {option.categoryLimit === -1 ? "Unlimited" : (option.categoryLimit ?? 1)}
                      </p>
                      {option.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 italic pt-1">{option.description}</p>
                      )}
                      <p className="text-xs text-slate-400 pt-1">Purchased: {pCount}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No featured plans configured. Click "Add Featured Plan" to create one.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Recent Featured Purchases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Partner</TableHead>
                <TableHead>Feature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPurchases.length === 0 ? (
                <TableRow>
                  <TableCell className="pl-6 text-slate-500" colSpan={4}>
                    No featured purchases yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentPurchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="pl-6">{purchase.partnerName}</TableCell>
                    <TableCell>{purchase.featureName || purchase.featureId || "-"}</TableCell>
                    <TableCell>
                      {getStatusBadge(getEffectiveFeatureStatus(purchase))}
                    </TableCell>
                    <TableCell className="pr-6 text-slate-500">
                      {purchase.createdAt?.seconds
                        ? new Date(purchase.createdAt.seconds * 1000).toLocaleDateString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminSettingsTab({
  settingsData,
  settingsSaving,
  logoUploading,
  onChange,
  onSave,
  onLogoUpload,
}: {
  settingsData: AdminSettingsRecord;
  settingsSaving: boolean;
  logoUploading: boolean;
  onChange: (patch: Partial<AdminSettingsRecord>) => void;
  onSave: () => void;
  onLogoUpload: (file?: File) => void;
}) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Website Logo</p>
          <Input type="file" accept="image/*" onChange={(e) => onLogoUpload(e.target.files?.[0])} />
          {logoUploading ? <p className="text-xs text-slate-500">Uploading logo...</p> : null}
          {settingsData.logoUrl ? (
            <img src={settingsData.logoUrl} alt="Website logo" className="h-20 w-auto object-contain border rounded-md p-2 bg-white" />
          ) : null}
        </div>
        <Field label="Email" value={settingsData.email || ""} onChange={(v) => onChange({ email: v })} />
        <Field label="Phone" value={settingsData.phone || ""} onChange={(v) => onChange({ phone: v })} />
        <Field label="Facebook" value={settingsData.facebook || ""} onChange={(v) => onChange({ facebook: v })} />
        <Field label="Twitter" value={settingsData.twitter || ""} onChange={(v) => onChange({ twitter: v })} />
        <Field label="Linkedin" value={settingsData.linkedin || ""} onChange={(v) => onChange({ linkedin: v })} />
        <Field label="Youtube" value={settingsData.youtube || ""} onChange={(v) => onChange({ youtube: v })} />
        <Field label="Instagram" value={settingsData.instagram || ""} onChange={(v) => onChange({ instagram: v })} />
        <Button onClick={onSave} disabled={settingsSaving}>
          {settingsSaving ? "Saving..." : "Submit"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CategoryBreakdownTable({
  rows,
  totalCount,
  searchQuery,
  onClearSearch,
}: {
  rows: Array<{ group: string; category: string; subcategory: string; subSubcategory: string; [key: string]: any }>;
  totalCount?: number;
  searchQuery?: string;
  onClearSearch?: () => void;
}) {
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const handleDeleteCategory = async (row: any) => {
    const isSubSub = row.subSubcategory && row.subSubcategory !== "-";
    const isSub = row.subcategory && row.subcategory !== "-";
    const displayName = isSubSub
      ? `${row.category} → ${row.subcategory} → ${row.subSubcategory}`
      : isSub
      ? `${row.category} → ${row.subcategory}`
      : row.category;

    if (!window.confirm(`Are you sure you want to delete "${displayName}" from ${row.group}?`)) {
      return;
    }

    const rowKey = `${row.group}__${row.category}__${row.subcategory}__${row.subSubcategory}`;
    setDeletingKey(rowKey);
    try {
      const sanitized = `${row.group}_${row.category}_${isSub ? row.subcategory : "all"}_${isSubSub ? row.subSubcategory : "all"}`
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .toLowerCase();
      const docId = row.id || `cat_${sanitized}`;

      await setDoc(
        doc(db, "categoriesCollection", docId),
        {
          group: row.group,
          parentCategory: row.group,
          category: row.category,
          categoryName: row.category,
          subcategory: row.subcategory === "-" ? "" : (row.subcategory || ""),
          subSubcategory: row.subSubcategory === "-" ? "" : (row.subSubcategory || ""),
          status: "Inactive",
          isDeleted: true,
          deleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (row.id && row.id !== docId) {
        try {
          await setDoc(
            doc(db, "categoriesCollection", row.id),
            {
              status: "Inactive",
              isDeleted: true,
              deleted: true,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch (_) {}
      }
    } catch (err: any) {
      console.error("Error deleting category:", err);
      alert(err.message || "Failed to delete category.");
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <>
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>All Categories</CardTitle>
              <CardDescription>
                {searchQuery?.trim()
                  ? `Showing ${rows.length} ${rows.length === 1 ? "category" : "categories"} matching "${searchQuery}" (out of ${totalCount || rows.length} total)`
                  : "Categories, sub categories, and sub sub categories. Click Edit to update details."}
              </CardDescription>
            </div>
            {searchQuery?.trim() && onClearSearch && (
              <Button variant="ghost" size="sm" onClick={onClearSearch} className="self-start text-xs text-slate-500 hover:text-slate-900">
                Clear filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Group</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sub Category</TableHead>
                <TableHead>Sub Sub Categories</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Featured Image</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell className="pl-6 py-12 text-center text-slate-500" colSpan={7}>
                    {searchQuery?.trim() ? (
                      <div className="space-y-2">
                        <p className="font-medium text-slate-700">No categories found matching "{searchQuery}"</p>
                        {onClearSearch && (
                          <Button variant="outline" size="sm" onClick={onClearSearch} className="text-emerald-700 border-emerald-200">
                            Clear search
                          </Button>
                        )}
                      </div>
                    ) : (
                      "No categories found."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const rowKey = `${row.group}__${row.category}__${row.subcategory}__${row.subSubcategory}`;
                  const isDeleting = deletingKey === rowKey;
                  return (
                    <TableRow key={rowKey}>
                      <TableCell className="pl-6 font-medium">{row.group}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.subcategory}</TableCell>
                      <TableCell>{row.subSubcategory}</TableCell>
                      <TableCell>
                        <Badge className={row.status === "Inactive" ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}>
                          {row.status || "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="w-10 h-8 mx-auto bg-slate-100 rounded border border-slate-200 flex items-center justify-center overflow-hidden">
                          <img src={row.imageUrl || "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=100&h=80"} alt="Thumbnail" className="w-full h-full object-cover opacity-80" />
                        </div>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingCategory(row)}
                            className="h-8 border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-emerald-700"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isDeleting}
                            onClick={() => handleDeleteCategory(row)}
                            className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingCategory && (
        <AdminEditCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={() => setEditingCategory(null)}
        />
      )}
    </>
  );
}

function ListingsList({
  listings,
  listingInsights,
  onView,
  onSetStatus,
  onSetFeatureStatus,
}: {
  listings: ListingRecord[];
  listingInsights: Record<string, any>;
  onView: (listing: ListingRecord) => void;
  onSetStatus: (listing: ListingRecord, status: string, active: boolean) => void;
  onSetFeatureStatus?: (listing: ListingRecord, status: string, active: boolean) => void;
}) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState<number>(0);
  const [canScroll, setCanScroll] = useState<boolean>(false);
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [maxScrollLeft, setMaxScrollLeft] = useState<number>(0);
  const isSyncingTop = useRef<boolean>(false);
  const isSyncingBottom = useRef<boolean>(false);

  const updateScrollDimensions = useCallback(() => {
    if (tableScrollRef.current) {
      const sw = tableScrollRef.current.scrollWidth;
      const cw = tableScrollRef.current.clientWidth;
      setContentWidth(sw);
      setCanScroll(sw > cw + 5);
      setMaxScrollLeft(Math.max(0, sw - cw));
      setScrollLeft(tableScrollRef.current.scrollLeft);
    }
  }, []);

  useEffect(() => {
    updateScrollDimensions();
    const el = tableScrollRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      updateScrollDimensions();
    });
    ro.observe(el);

    window.addEventListener("resize", updateScrollDimensions);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScrollDimensions);
    };
  }, [updateScrollDimensions, listings]);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current && !isSyncingBottom.current) {
      isSyncingTop.current = true;
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      setScrollLeft(topScrollRef.current.scrollLeft);
      requestAnimationFrame(() => {
        isSyncingTop.current = false;
      });
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current && !isSyncingTop.current) {
      isSyncingBottom.current = true;
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
      setScrollLeft(tableScrollRef.current.scrollLeft);
      requestAnimationFrame(() => {
        isSyncingBottom.current = false;
      });
    }
  };

  const scrollTable = (offset: number) => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  if (listings.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <FileText className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No listings found</h3>
        <p className="text-sm text-slate-500">Listings will appear here once created.</p>
      </div>
    );
  }

  return (
    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
      {/* Top Horizontal Scroll Bar & Navigation */}
      {canScroll && (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <span className="inline-flex items-center justify-center p-1 rounded bg-slate-200 text-slate-700">
                <MoveHorizontal className="w-3.5 h-3.5" />
              </span>
              <span className="font-semibold">Table Scroll (14 columns)</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="text-slate-500 font-normal hidden sm:inline">
                Drag the top scrollbar or use the buttons to navigate columns
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => scrollTable(-350)}
                disabled={scrollLeft <= 5}
                className="h-7 px-2.5 text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Scroll Left
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => scrollTable(350)}
                disabled={scrollLeft >= maxScrollLeft - 5}
                className="h-7 px-2.5 text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium"
              >
                Scroll Right <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
          {/* Synchronized top scrollbar track */}
          <div
            ref={topScrollRef}
            onScroll={handleTopScroll}
            className="overflow-x-auto overflow-y-hidden h-3 w-full rounded bg-slate-200/70 custom-top-scrollbar"
            title="Scroll horizontally to view all columns"
          >
            <div style={{ width: `${contentWidth}px`, height: "1px" }} />
          </div>
        </div>
      )}

      <CardContent className="p-0">
        <div
          ref={tableScrollRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto admin-table-scrollbar"
        >
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Business</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created On</TableHead>
                <TableHead>Subscribed On</TableHead>
                <TableHead>Upgraded On</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Cancelled On</TableHead>
                <TableHead>Feature Status</TableHead>
                <TableHead>Feature Plan</TableHead>
                <TableHead>Feature Date</TableHead>
                <TableHead>Feature Cancel Date</TableHead>
                <TableHead className="text-right pr-6 sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {listings.map((listing) => {
              const effectiveStatus = getEffectiveListingStatus(listing, listingInsights[listing.id]);
              return (
                <TableRow key={listing.__path}>
                  <TableCell className="pl-6">
                    <p className="font-medium">{listing.businessName || "Unnamed"}</p>
                    <p className="text-xs text-slate-500">{listing.companyWebsite || "-"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getCollectionLabel(listing.__col)}</Badge>
                  </TableCell>
                  <TableCell>{formatUserPlan(listing.selectedPlan, listingInsights[listing.id]?.plan)}</TableCell>
                  <TableCell>{getStatusBadge(effectiveStatus)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(listing.createdAt)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.subscribedOn)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.upgradedOn)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.expiryDate)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.cancelledOn)}</TableCell>
                  <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                    {listingInsights[listing.id]?.featureStatus && listingInsights[listing.id]?.featureStatus !== "-" ? (
                      getStatusBadge(listingInsights[listing.id]?.featureStatus)
                    ) : (
                      <span className="text-slate-400 text-xs font-mono">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">{listingInsights[listing.id]?.featurePlan || "-"}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.featureDate)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.featureCancelDate)}</TableCell>
                  <TableCell className="text-right pr-6 sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[220px]">
                        <DropdownMenuLabel>Listing Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onView(listing)}>
                          <Eye className="w-4 h-4 mr-2" /> View Listing
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold py-1">
                          Listing Status
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Active", true)}>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Set to Active
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Expired", false)}>
                          <Clock className="w-4 h-4 mr-2 text-orange-600" /> Set to Expired
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Cancelled", false)}>
                          <XCircle className="w-4 h-4 mr-2 text-rose-600" /> Set to Cancelled
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Incomplete Payment", false)}>
                          <AlertTriangle className="w-4 h-4 mr-2 text-red-600" /> Set to Incomplete Payment
                        </DropdownMenuItem>
                        {onSetFeatureStatus && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold py-1">
                              Feature Status
                            </DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onSetFeatureStatus(listing, "Active", true)}>
                              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Set Feature: Active
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetFeatureStatus(listing, "Expired", false)}>
                              <Clock className="w-4 h-4 mr-2 text-orange-600" /> Set Feature: Expired
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetFeatureStatus(listing, "Cancelled", false)}>
                              <XCircle className="w-4 h-4 mr-2 text-rose-600" /> Set Feature: Cancelled
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetFeatureStatus(listing, "Incomplete Payment", false)}>
                              <AlertTriangle className="w-4 h-4 mr-2 text-red-600" /> Set Feature: Incomplete Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetFeatureStatus(listing, "Disabled", false)}>
                              <Ban className="w-4 h-4 mr-2 text-slate-600" /> Set Feature: Disabled
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionList({ transactions }: { transactions: any[] }) {
  const [search, setSearch] = useState("");

  const rows = useMemo(
    () =>
      transactions
        .map((t) => formatPartnerTransaction({ id: t.id, ...t }))
        .sort(sortPartnerTransactionsNewestFirst),
    [transactions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.dateDisplay,
        r.typeLabel,
        r.description,
        r.group,
        r.businessName,
        r.customerEmail,
        r.partnerId,
        r.planId,
        r.featureId,
        r.listingId,
        r.statusLabel,
        r.amountDisplay,
        r.collectionName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const handleExport = (format: "csv" | "xlsx" | "pdf") => {
    if (filtered.length === 0) return;
    if (format === "csv") downloadPartnerTransactionsCsv(filtered);
    else if (format === "xlsx") downloadPartnerTransactionsExcel(filtered);
    else downloadPartnerTransactionsPdf(filtered);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-600">
            All partner checkout payments. Search the table, then export the filtered results.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partner, business, plan, status…"
              className="pl-9 h-10 w-full sm:w-72 bg-white"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 shrink-0" disabled={filtered.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <FileText className="w-4 h-4 mr-2" />
                Download as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileText className="w-4 h-4 mr-2" />
                Download as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <Receipt className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
          <h3 className="font-semibold">No transactions recorded</h3>
          <p className="text-sm text-slate-500">Transactions appear here after checkout.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <SearchX className="w-8 h-8 text-slate-300 mb-2 mx-auto" />
          <p className="text-sm text-slate-600">No transactions match “{search.trim()}”.</p>
        </div>
      ) : (
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto admin-table-scrollbar">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Listing ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t: PartnerTransactionRow) => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-6 whitespace-nowrap text-slate-600">{t.dateDisplay}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5 max-w-[200px]">
                          <p className="truncate">{t.customerEmail || "—"}</p>
                          <p className="text-xs text-slate-500 font-mono truncate" title={t.partnerId || ""}>
                            {t.partnerId || "—"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate">{t.businessName || "—"}</TableCell>
                      <TableCell>{t.typeLabel}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={t.description}>
                        {t.description}
                      </TableCell>
                      <TableCell className="capitalize whitespace-nowrap">{t.group || "—"}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">{t.listingId || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            t.statusRaw === "succeeded"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : t.statusRaw === "pending"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                          }
                        >
                          {t.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                        {t.amountDisplay}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
              Showing {filtered.length} of {rows.length} transaction{rows.length === 1 ? "" : "s"}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className={`text-sm font-medium ${disabled ? "text-slate-500" : "text-slate-700"}`}>{label}</p>
      <Input 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        disabled={disabled}
        className={disabled ? "bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" : ""}
      />
    </div>
  );
}

function isPartnerAccountLog(log: any): boolean {
  const action = (log.action || "").toUpperCase();
  const category = (log.category || "").toLowerCase();

  // Explicit exclusions: payment, billing, subscription, or listing actions
  if (
    action.startsWith("PAYMENT_") ||
    action.startsWith("SUBSCRIPTION_") ||
    action.startsWith("LISTING_") ||
    action === "FEATURE_ADDED" ||
    action === "CATEGORY_DELETED" ||
    category === "billing" ||
    category === "listing"
  ) {
    return false;
  }

  // Explicit inclusions: account actions or category
  if (
    action === "ACCOUNT_CREATED" ||
    action === "ACCOUNT_UPDATED" ||
    action === "PASSWORD_UPDATED" ||
    category === "account"
  ) {
    return true;
  }

  return false;
}

function isListingOrBillingLog(log: any): boolean {
  const action = (log.action || "").toUpperCase();
  const category = (log.category || "").toLowerCase();

  if (
    action.startsWith("PAYMENT_") ||
    action.startsWith("SUBSCRIPTION_") ||
    action.startsWith("LISTING_") ||
    action === "FEATURE_ADDED" ||
    action === "CATEGORY_DELETED" ||
    category === "billing" ||
    category === "listing"
  ) {
    return true;
  }

  return false;
}

function getAuditActor(log: any): { label: "Admin" | "Partner" | "System"; badgeClass: string } {
  const perf = (log.performedBy || log.metadata?.performedBy || "").toLowerCase();
  if (perf === "admin") {
    return { label: "Admin", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" };
  }
  if (perf === "system" || perf === "stripe") {
    return { label: "System", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" };
  }
  if (perf === "partner" || perf === "user") {
    return { label: "Partner", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" };
  }

  const category = (log.category || "").toLowerCase();
  const details = (log.details || "").toLowerCase();
  const action = (log.action || "").toUpperCase();
  const hasAdminEmail = Boolean(log.metadata?.adminEmail || log.adminEmail);

  // 1. Admin actions
  if (
    category === "admin" ||
    hasAdminEmail ||
    details.includes("admin:") ||
    details.includes("by admin") ||
    details.includes("admin (") ||
    action === "ADMIN_ACTION"
  ) {
    return { label: "Admin", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" };
  }

  // 2. Automatic transactions & billing/subscription events (Stripe, webhooks, renewals, auto-cancellations)
  if (
    action.startsWith("PAYMENT_") ||
    action.startsWith("SUBSCRIPTION_") ||
    category === "billing" ||
    details.includes("recurring invoice") ||
    details.includes("cancellation processed") ||
    details.includes("invoice in_") ||
    details.includes("subscription invoice") ||
    details.includes("auto-cancelled") ||
    details.includes("stripe")
  ) {
    return { label: "System", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" };
  }

  // 3. Otherwise, partner / user performed action
  return { label: "Partner", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" };
}

function AuditLogList({ logs }: { logs: any[] }) {
  if (logs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <History className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No audit logs found</h3>
        <p className="text-sm text-slate-500">Activity will appear here as it happens.</p>
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case "ACCOUNT_CREATED":
        return <Badge className="bg-sky-50 text-sky-700 border-sky-200">Account Created</Badge>;
      case "ACCOUNT_UPDATED":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Account Updated</Badge>;
      case "PASSWORD_UPDATED":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Password Updated</Badge>;
      case "PAYMENT_SUCCESS":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Payment Success</Badge>;
      case "PAYMENT_FAILED":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Payment Failed</Badge>;
      case "SUBSCRIPTION_CANCELLED":
        return <Badge className="bg-red-50 text-red-700 border-red-200">Subscription Cancelled</Badge>;
      case "LISTING_CREATED":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Listing Created</Badge>;
      case "LISTING_UPDATED":
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Listing Updated</Badge>;
      case "LISTING_DELETED":
        return <Badge className="bg-slate-100 text-slate-700 border-slate-300">Listing Deleted</Badge>;
      case "FEATURE_ADDED":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Feature Added</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Timestamp</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Updated By</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right pr-6">Partner ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const actor = getAuditActor(log);
              return (
                <TableRow key={log.id}>
                  <TableCell className="pl-6 text-sm text-slate-500 whitespace-nowrap">
                    {log.timestamp?.seconds
                      ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                      : "Recently"}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{log.partnerName || "Unknown"}</TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell>
                    <Badge className={`${actor.badgeClass} font-medium text-xs`}>
                      {actor.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 max-w-md">{log.details}</TableCell>
                  <TableCell className="text-right pr-6 font-mono text-[10px] text-slate-400">
                    {log.partnerId || "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

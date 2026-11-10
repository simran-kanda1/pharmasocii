import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
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
  Star,
  Tags,
  User,
  Users,
  Mail,
  Trash2,
  Info,
  Upload,
  EyeOff,
} from "lucide-react";
import { uploadJobDescriptionPdf, uploadEventAgendaPdf, validateJobDescriptionPdf } from "@/lib/jobDescriptionUpload";
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
  where,
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
  buildCategoryDocId,
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
import { PartnerPlanHistoryModal } from "@/components/admin/PartnerPlanHistoryModal";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";
import {
  getEffectiveListingStatus,
  getEffectiveFeatureStatus,
} from "@/lib/adminEffectiveStatus";

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
  downloadSingleTransactionInvoicePdf,
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
  | "audit"
  | "memberAudit";
type ListingFilter = "all" | "active" | "approved" | "cancelled" | "expired" | "incomplete_payment" | "payment_error" | "pending_payment" | "disabled" | "pending";
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
  source?: string;
  createdByAdmin?: boolean;
  status?: string;
  startDate?: any;
  billingPeriodEnd?: any;
  createdAt?: { seconds?: number };
  active?: boolean;
  [key: string]: any;
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
  source?: string;
  createdByAdmin?: boolean;
  status?: string;
  createdAt?: { seconds?: number };
  [key: string]: any;
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
                        className="mt-0.5 flex-shrink-0 text-slate-900 hover:text-black"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" strokeWidth={2.75} /> : <ChevronRight className="w-4 h-4" strokeWidth={2.75} />}
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
                          "font-normal text-slate-700"
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
                                  className="flex-shrink-0 text-slate-900 hover:text-black"
                                >
                                  {isSubExpanded ? <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.75} /> : <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.75} />}
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

const getStatusBadge = (status?: string) => {
  const norm = String(status || "").trim().toLowerCase();
  switch (norm) {
    case "approved":
    case "active":
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
    case "pending review":
    case "pending":
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>;
    case "pending payment":
    case "pending_payment":
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending Payment</Badge>;
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

  const initialUrlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialTabParam = initialUrlParams?.get("tab") as AdminTab | null;
  const initialAuditView = initialUrlParams?.get("auditView");
  const initialAuditSearch = initialUrlParams?.get("auditSearch") || "";
  const initialAuditListing = initialUrlParams?.get("auditListing") || "all";
  const initialPartnerHistoryId = initialUrlParams?.get("partnerHistory") || "";

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTabParam || "overview");
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
  const [communityMembers, setCommunityMembers] = useState<any[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState(initialAuditSearch);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<"partner" | "listing">(
    initialAuditView === "listing" ? "listing" : "partner"
  );
  const [auditListingFilter, setAuditListingFilter] = useState<string>(initialAuditListing || "all");
  const [auditListingEventFilter, setAuditListingEventFilter] = useState<string>("all");
  const [memberAuditSearchTerm, setMemberAuditSearchTerm] = useState("");
  const [memberAuditCategoryFilter, setMemberAuditCategoryFilter] = useState<"all" | "account_created" | "password" | "status" | "post_reactivated" | "comment_reactivated">("all");
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
  const [historyPartner, setHistoryPartner] = useState<PartnerRecord | null>(null);
  const [partnerEditor, setPartnerEditor] = useState<Record<string, any>>({});
  const [partnerEditorOpen, setPartnerEditorOpen] = useState(false);
  const [lastTrialEndMs, setLastTrialEndMs] = useState<number | null>(null); // for undo last extension

  const [selectedListing, setSelectedListing] = useState<ListingRecord | null>(null);
  const [listingEditor, setListingEditor] = useState<Record<string, any>>({});
  const [listingEditorOpen, setListingEditorOpen] = useState(false);
  const partnerHistoryOpenedFromUrlRef = useRef(false);

  useEffect(() => {
    if (!initialPartnerHistoryId || partnerHistoryOpenedFromUrlRef.current || partners.length === 0) return;
    const match = partners.find((p) => p.id === initialPartnerHistoryId);
    if (match) {
      setHistoryPartner(match);
      partnerHistoryOpenedFromUrlRef.current = true;
    }
  }, [initialPartnerHistoryId, partners]);

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

        // Automatically cancel admin-granted plans/trials that have expired
        const now = Date.now();
        plans.forEach(async (plan) => {
          const isAdminPlan = Boolean(plan.isTrial || plan.source === "admin_granted");
          if (isAdminPlan && plan.active !== false && plan.billingPeriodEnd) {
            const endMs = typeof plan.billingPeriodEnd.toMillis === 'function'
              ? plan.billingPeriodEnd.toMillis()
              : (plan.billingPeriodEnd.seconds ? plan.billingPeriodEnd.seconds * 1000 : new Date(plan.billingPeriodEnd).getTime());
            
            if (endMs < now) {
              try {
                const planRef = doc(db, "partnersCollection", plan.partnerId, "planCollection", plan.id);
                await updateDoc(planRef, { active: false, status: "Expired" });

                // Synchronize featuresCollection on expiry
                try {
                  const featSnap = await getDocs(collection(db, "partnersCollection", plan.partnerId, "featuresCollection"));
                  for (const fDoc of featSnap.docs) {
                    await updateDoc(fDoc.ref, { active: false, status: "Expired" });
                  }
                } catch (fe) {
                  console.warn("Auto-cancel featuresCollection sync error:", fe);
                }

                // Deactivate partner feature spotlight
                try {
                  await updateDoc(doc(db, "partnersCollection", plan.partnerId), {
                    isFeatured: false,
                    selectedAddon: "",
                    featuredPlacement: "",
                  });
                } catch (pe) {
                  console.warn("Auto-cancel partner isFeatured sync error:", pe);
                }

                console.log(`Auto-cancelled expired admin plan & feature ${plan.id} for partner ${plan.partnerId}`);
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
        const featList = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, any>),
          partnerId: d.ref.path.split("/")[1] || "",
        })) as FeaturedPlanPurchase[];

        // Automatically cancel admin-granted features that have expired
        const now = Date.now();
        featList.forEach(async (feat) => {
          const isAdminFeat = Boolean(feat.isTrial || feat.source === "admin_granted");
          if (isAdminFeat && feat.active !== false && feat.accessThrough) {
            const accessMs = typeof feat.accessThrough.toMillis === 'function'
              ? feat.accessThrough.toMillis()
              : (feat.accessThrough.seconds ? feat.accessThrough.seconds * 1000 : new Date(feat.accessThrough).getTime());
            if (accessMs < now) {
              try {
                const featRef = doc(db, "partnersCollection", feat.partnerId, "featuresCollection", feat.id);
                await updateDoc(featRef, { active: false, status: "Expired" });
                await updateDoc(doc(db, "partnersCollection", feat.partnerId), {
                  isFeatured: false,
                  selectedAddon: "",
                  featuredPlacement: "",
                });
              } catch (e) {
                console.warn("Auto-cancel expired admin feature error:", e);
              }
            }
          }
        });

        setFeaturedPlans(featList);
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
            allListings.push(data as ListingRecord);
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

    const qAudit = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(5000));
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Failed to fetch auditLogs snapshot:", error);
    });

    const unsubMembers = onSnapshot(collection(db, "membersCollection"), (snap) => {
      setCommunityMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Failed to fetch membersCollection snapshot:", error);
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
      unsubMembers();
      unsubSettings();
      clearInterval(listingsInterval);
    };
  }, [isAuthorized]);

  // If searching by partner ID or listing ID, also run a direct targeted query in case the log is older
  useEffect(() => {
    if (!isAuthorized || !auditSearchTerm) return;
    const term = auditSearchTerm.trim();
    if (term.length < 10) return;

    let cancelled = false;
    const fetchTargetedLogs = async () => {
      try {
        const qByPartner = query(collection(db, "auditLogs"), where("partnerId", "==", term), limit(500));
        const snap = await getDocs(qByPartner);
        if (cancelled || snap.empty) return;
        setAuditLogs((prev) => {
          const existingIds = new Set(prev.map((l) => l.id));
          const newItems = snap.docs
            .filter((d) => !existingIds.has(d.id))
            .map((d) => ({ id: d.id, ...d.data() }));
          if (newItems.length === 0) return prev;
          const merged = [...prev, ...newItems];
          merged.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
          return merged;
        });
      } catch (err) {
        console.warn("Targeted audit log lookup error:", err);
      }
    };

    fetchTargetedLogs();
    return () => { cancelled = true; };
  }, [auditSearchTerm, isAuthorized]);

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
      firstName: partner.firstName || (partner as any).first_name || "",
      lastName: partner.lastName || (partner as any).last_name || "",
      primaryName: partner.primaryName || partner.contactName || (partner as any).name || "",
      primaryEmail: partner.primaryEmail || (partner as any).email || "",
      phoneNumber: partner.phoneNumber || (partner as any).phone || "",
      
      // Company Info
      businessName: partner.businessName || partner.companyName || "",
      companyWebsite: partner.companyWebsite || (partner as any).website || "",
      businessPhone: partner.businessPhone || (partner as any).phone || partner.phoneNumber || "",
      linkedinProfile: partner.linkedinProfile || (partner as any).linkedin || "",
      businessAddress: partner.businessAddress || (partner as any).addressHtml || (partner as any).address || "",
      businessCountry: partner.businessCountry || (partner as any).country || "",
      companyProfileText: partner.companyProfileText || (partner as any).profileHtml || (partner as any).companyProfile || "",
      
      // Billing & Admin
      partnerStatus: partner.partnerStatus || (partner as any).status || "Pending",
      billingEmailAddress: partner.billingEmailAddress || (partner as any).billingEmail || "",
      VAT_ABN_EIN_businessId: partner.VAT_ABN_EIN_businessId || (partner as any).businessId || (partner as any).vatNumber || (partner as any).vat || (partner as any).ein || "",
      altContactName: partner.altContactName || (partner as any).secondaryName || (partner as any).altName || (partner as any).secondaryContactName || "",
      altEmail: partner.altEmail || (partner as any).secondaryEmail || "",
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

    if (isPartnerAdminCreated) {
      if (!pPrimaryName || !pBusinessName || !pPrimaryEmail) {
        setSaveNotice("Company Name, Contact Name, and Primary Email cannot be empty.");
        return;
      }
    } else {
      if (!pBusinessName || !pPrimaryEmail) {
        setSaveNotice("Company Name and Primary Email cannot be empty.");
        return;
      }
    }

    try {
      let payload: Record<string, any>;

      if (!isPartnerAdminCreated) {
        payload = {
          businessName: pBusinessName,
          companyName: pBusinessName,
          primaryEmail: pPrimaryEmail,
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
          businessId: partnerEditor.VAT_ABN_EIN_businessId || "",
          altContactName: partnerEditor.altContactName || "",
          secondaryName: partnerEditor.altContactName || "",
          altEmail: partnerEditor.altEmail || "",
          secondaryEmail: partnerEditor.altEmail || "",
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

      const changes: string[] = [];
      const recordAdminDiff = (label: string, oldVal: any, newVal: any, summarizeValue = false) => {
        if (newVal === undefined) return;
        const a = String(oldVal || "").trim();
        const b = String(newVal || "").trim();
        if (a === b) return;
        if (summarizeValue) {
          changes.push(`${label} ${a ? (b ? "updated" : "cleared") : "added"}`);
        } else if (!a && b) {
          changes.push(`${label} set to "${b}"`);
        } else if (a && !b) {
          changes.push(`${label} cleared (was "${a}")`);
        } else {
          changes.push(`${label} changed from "${a}" to "${b}"`);
        }
      };

      if (payload.businessName && payload.businessName !== (selectedPartner.businessName || "")) {
        changes.push(`Company name updated from "${selectedPartner.businessName || ""}" to "${payload.businessName}"`);
      }
      recordAdminDiff("Primary email", selectedPartner.primaryEmail, payload.primaryEmail);
      recordAdminDiff("First name", selectedPartner.firstName, payload.firstName);
      recordAdminDiff("Last name", selectedPartner.lastName, payload.lastName);
      if (payload.primaryName && payload.primaryName !== (selectedPartner.primaryName || "")) {
        changes.push(`Primary contact changed from "${selectedPartner.primaryName || ""}" to "${payload.primaryName}"`);
      }
      recordAdminDiff("Phone", selectedPartner.phoneNumber || (selectedPartner as any).phone, payload.phoneNumber);
      recordAdminDiff("Alternate contact", selectedPartner.altContactName || (selectedPartner as any).secondaryName, payload.altContactName);
      recordAdminDiff("Alternate email", selectedPartner.altEmail || (selectedPartner as any).secondaryEmail, payload.altEmail);
      if (payload.companyWebsite !== undefined && String(payload.companyWebsite || "").trim() !== String(selectedPartner.companyWebsite || "").trim()) {
        changes.push(`Company URL changed from "${selectedPartner.companyWebsite || ""}" to "${payload.companyWebsite || ""}"`);
      }
      recordAdminDiff("Business phone", (selectedPartner as any).businessPhone || (selectedPartner as any).businessPhoneNumber, payload.businessPhone);
      recordAdminDiff("LinkedIn profile", (selectedPartner as any).linkedinProfile || (selectedPartner as any).linkedInProfileLink, payload.linkedinProfile);
      recordAdminDiff("Billing email", selectedPartner.billingEmailAddress, payload.billingEmailAddress);
      recordAdminDiff("Business ID", selectedPartner.VAT_ABN_EIN_businessId || (selectedPartner as any).businessId, payload.VAT_ABN_EIN_businessId);
      recordAdminDiff("Company profile", (selectedPartner as any).companyProfileText, payload.companyProfileText, true);
      recordAdminDiff("Business headquarters", selectedPartner.businessCountry, payload.businessCountry);
      recordAdminDiff("Business address", (selectedPartner as any).businessAddress, payload.businessAddress, true);

      const changeDetails = changes.length > 0
        ? `Partner profile updated by Admin (${adminEmail}): ${changes.join(". ")}.`
        : `Profile updated by admin: ${payload.businessName || selectedPartner.businessName} (Contact: ${payload.primaryName || selectedPartner.primaryName}). Admin: ${adminEmail}`;

      // Log to Audit Trail
      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: payload.businessName || selectedPartner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: changeDetails,
        category: "admin",
        performedBy: "admin",
        metadata: { adminEmail, changes, updatedFields: payload, performedBy: "admin" }
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
      let hasFeature = false;
      try {
        const featSnap = await getDocs(collection(db, "partnersCollection", selectedPartner.id, "featuresCollection"));
        if (!featSnap.empty) {
          hasFeature = true;
          for (const fDoc of featSnap.docs) {
            await updateDoc(fDoc.ref, {
              accessThrough: newEnd,
              active: true,
              isTrial: true
            });
          }
        }
      } catch (e) {
        console.warn("Failed to synchronize featuresCollection on trial extend:", e);
      }

      // Sync partner document featureSpotlightPaidThrough
      if (hasFeature || selectedPartner.selectedAddon || selectedPartner.isFeatured) {
        try {
          await updateDoc(doc(db, "partnersCollection", selectedPartner.id), {
            featureSpotlightPaidThrough: newEnd,
            isFeatured: true
          });
        } catch (e) {
          console.warn("Failed to sync partner featureSpotlightPaidThrough:", e);
        }
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
            ...(hasFeature || selectedPartner.selectedAddon || selectedPartner.isFeatured ? { isFeatured: true, featureSpotlightPaidThrough: newEnd } : {})
          });
        } catch (e) {
          console.warn("Failed to sync listing status to Extended:", e);
        }
      }

      const partnerListing = listings.find((l) => l.partnerId === selectedPartner.id);
      if (partnerListing && (!listingId || partnerListing.id !== listingId)) {
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
            status: "Extended",
            ...(hasFeature || selectedPartner.selectedAddon || selectedPartner.isFeatured ? { isFeatured: true, featureSpotlightPaidThrough: newEnd } : {})
          });
        } catch (e) {
          console.warn("Failed to sync partner listing on trial extend:", e);
        }
      }

      const actionMsg = hasFeature 
        ? `Trial & feature extended by ${days} days (New expiry: ${newEnd.toLocaleDateString()}). Admin: ${adminEmail}`
        : `Trial extended by ${days} days (New expiry: ${newEnd.toLocaleDateString()}). Admin: ${adminEmail}`;

      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: selectedPartner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: actionMsg,
        category: "admin",
        performedBy: "admin",
        metadata: { adminEmail, extendedDays: days, newExpiryDate: newEnd, performedBy: "admin" }
      });

      setSaveNotice(actionMsg);
    } catch (err: any) {
      console.error("Error extending trial:", err);
      alert("Failed to extend trial: " + err.message);
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

      // Synchronize featuresCollection on undo
      try {
        const featSnap = await getDocs(collection(db, "partnersCollection", selectedPartner.id, "featuresCollection"));
        for (const fDoc of featSnap.docs) {
          await updateDoc(fDoc.ref, {
            accessThrough: previousEnd,
            active: previousEnd.getTime() > Date.now(),
            isTrial: true
          });
        }
      } catch (e) {
        console.warn("Failed to revert featuresCollection on undo:", e);
      }

      // Sync partner document featureSpotlightPaidThrough
      try {
        await updateDoc(doc(db, "partnersCollection", selectedPartner.id), {
          featureSpotlightPaidThrough: previousEnd,
          isFeatured: previousEnd.getTime() > Date.now()
        });
      } catch (e) {
        console.warn("Failed to revert partner featureSpotlightPaidThrough on undo:", e);
      }

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
          await updateDoc(listingRef, { 
            status: "Approved",
            featureSpotlightPaidThrough: previousEnd,
            isFeatured: previousEnd.getTime() > Date.now()
          });
        } catch (e) {
          console.warn("Failed to revert listing status on undo:", e);
        }
      }

      const partnerListing = listings.find((l) => l.partnerId === selectedPartner.id);
      if (partnerListing && (!listingId || partnerListing.id !== listingId)) {
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
            featureSpotlightPaidThrough: previousEnd,
            isFeatured: previousEnd.getTime() > Date.now()
          });
        } catch (e) {
          console.warn("Failed to sync partner listing on undo:", e);
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
    if (!window.confirm("Are you sure you want to cancel this partner's trial? Their plan and feature will be deactivated immediately.")) return;
    try {
      const now = new Date();

      // 1. Deactivate ALL plan documents in planCollection for this partner
      try {
        const plansSnap = await getDocs(collection(db, "partnersCollection", selectedPartner.id, "planCollection"));
        for (const pDoc of plansSnap.docs) {
          await updateDoc(pDoc.ref, {
            active: false,
            billingPeriodEnd: now,
            status: "Cancelled",
            cancelledAt: now,
            cancelAt: now,
          });
        }
      } catch (e) {
        console.warn("Failed to deactivate planCollection:", e);
      }

      // 2. Deactivate ALL feature documents in featuresCollection for this partner
      try {
        const featSnap = await getDocs(collection(db, "partnersCollection", selectedPartner.id, "featuresCollection"));
        for (const fDoc of featSnap.docs) {
          await updateDoc(fDoc.ref, {
            active: false,
            accessThrough: now,
            status: "Cancelled",
            cancelledAt: now,
            cancelAt: now,
          });
        }
      } catch (e) {
        console.warn("Failed to cancel featuresCollection:", e);
      }

      // 3. Update the partner document: disable featured flag, clear addons, mark status Cancelled
      try {
        await updateDoc(doc(db, "partnersCollection", selectedPartner.id), {
          isFeatured: false,
          featureSpotlightPaidThrough: now,
          selectedAddon: "",
          featuredPlacement: "",
          featureStatus: "Cancelled",
          partnerStatus: "Cancelled",
          status: "Cancelled",
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("Failed to cancel partner feature spotlight:", e);
      }

      // 4. Deactivate and mark Cancelled on ALL listings belonging to this partner across all collections
      const partnerListings = listings.filter((l) => {
        const pId = l.partnerId || (l.__path?.startsWith("partnersCollection/") ? l.__path.split('/')[1] : "");
        return pId === selectedPartner.id;
      });

      for (const pl of partnerListings) {
        if (!pl.__path) continue;
        try {
          await updateDoc(doc(db, pl.__path), {
            status: "Cancelled",
            active: false,
            isFeatured: false,
            featureStatus: "Cancelled",
            featureSpotlightPaidThrough: now,
            selectedAddon: "",
            featuredPlacement: "",
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn(`Failed to cancel listing ${pl.id} at ${pl.__path}:`, e);
        }
      }

      // Also check subcollections directly under partnersCollection/{id}/...
      const subCols = ["businessOfferingsCollection", "eventsCollection", "jobsCollection", "consultingServicesCollection", "consultingCollection"];
      for (const sc of subCols) {
        try {
          const scSnap = await getDocs(collection(db, "partnersCollection", selectedPartner.id, sc));
          for (const sDoc of scSnap.docs) {
            await updateDoc(sDoc.ref, {
              status: "Cancelled",
              active: false,
              isFeatured: false,
              featureStatus: "Cancelled",
              featureSpotlightPaidThrough: now,
              selectedAddon: "",
              featuredPlacement: "",
              updatedAt: serverTimestamp(),
            });
          }
        } catch (e) {
          // ignore if subcollection doesn't exist
        }
      }

      // 5. Update local React states so UI reflects changes immediately
      setPartnerPlans((prev) =>
        prev.map((p) => (p.partnerId === selectedPartner.id ? { ...p, active: false, billingPeriodEnd: now, status: "Cancelled" } : p))
      );
      setFeaturedPlans((prev) =>
        prev.map((f) => (f.partnerId === selectedPartner.id ? { ...f, active: false, accessThrough: now, status: "Cancelled" } : f))
      );
      setPartners((prev) =>
        prev.map((p) => (p.id === selectedPartner.id ? { ...p, isFeatured: false, partnerStatus: "Cancelled", status: "Cancelled" } : p))
      );
      setListings((prev) =>
        prev.map((l) => {
          const pId = l.partnerId || (l.__path?.startsWith("partnersCollection/") ? l.__path.split('/')[1] : "");
          return pId === selectedPartner.id ? { ...l, status: "Cancelled", active: false, isFeatured: false, featureStatus: "Cancelled" } : l;
        })
      );
      setPartnerEditor((prev) => ({
        ...prev,
        partnerStatus: "Cancelled",
      }));

      // 6. Log to Audit Trail
      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: selectedPartner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Trial, plan, and feature cancelled immediately by admin: ${adminEmail}`,
        category: "admin",
        performedBy: "admin",
        metadata: { adminEmail, cancelledAt: now, performedBy: "admin" }
      });

      alert("Trial, plan, and feature cancelled successfully.");
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

    // Normalize status to one of: "Active", "Expired", "Cancelled", "Incomplete Payment", "Pending Payment", "Disabled"
    const effective = getEffectiveListingStatus(listing, listingInsights[listing.id]);
    let initialStatus = "Active";
    if (effective === "Pending Payment" || listing.status === "pending_payment" || listing.status === "Pending Payment") {
      initialStatus = "Pending Payment";
    } else if (effective === "Incomplete Payment" || effective === "Payment Error" || listing.status === "Incomplete Payment" || listing.status === "Payment Error" || listing.status === "past_due") {
      initialStatus = "Incomplete Payment";
    } else if (effective === "Disabled" || listing.status === "Disabled") {
      initialStatus = "Disabled";
    } else if (effective === "Expired" || listing.status === "Expired") {
      initialStatus = "Expired";
    } else if (effective === "Cancelled" || listing.status === "Cancelled" || listing.status === "Canceled") {
      initialStatus = "Cancelled";
    } else {
      initialStatus = "Active";
    }

    // Resolve associated partner to pull non-* core info (website, address, country, profile description, etc.)
    const partnerIdFromPath = listing.__path?.startsWith("partnersCollection/")
      ? listing.__path.split("/")[1]
      : "";
    const resolvedPartnerId = listing.partnerId || listing.userId || partnerIdFromPath || "";
    const partner = partners.find(
      (p) =>
        (resolvedPartnerId && p.id === resolvedPartnerId) ||
        (listing.id && p.id === listing.id) ||
        (p.primaryEmail && (listing as any).primaryEmail && p.primaryEmail.toLowerCase() === (listing as any).primaryEmail.toLowerCase()) ||
        (p.businessName && listing.businessName && p.businessName.trim().toLowerCase() === listing.businessName.trim().toLowerCase())
    );

    const resolvedBusinessName =
      listing.businessName ||
      (listing as any).companyName ||
      partner?.businessName ||
      partner?.companyName ||
      "";

    const resolvedCompanyWebsite =
      listing.companyWebsite ||
      (listing as any).website ||
      (listing as any).companyWebsiteLink ||
      partner?.companyWebsite ||
      (partner as any)?.website ||
      "";

    const resolvedBusinessCountry =
      listing.businessCountry ||
      (listing as any).country ||
      partner?.businessCountry ||
      (partner as any)?.country ||
      "";

    const resolvedBusinessAddress =
      listing.businessAddress ||
      (listing as any).addressHtml ||
      (listing as any).address ||
      partner?.businessAddress ||
      (partner as any)?.addressHtml ||
      (partner as any)?.address ||
      "";

    const resolvedCompanyProfile =
      listing.companyProfileText ||
      (listing as any).profileHtml ||
      (listing as any).companyProfile ||
      (listing as any).description ||
      partner?.companyProfileText ||
      (partner as any)?.profileHtml ||
      (partner as any)?.companyProfile ||
      "";

    const resolvedServiceCountries =
      (listing.serviceCountries && listing.serviceCountries.length > 0)
        ? listing.serviceCountries
        : (partner?.serviceCountries || []);

    const resolvedServiceRegions =
      (listing.serviceRegions && listing.serviceRegions.length > 0)
        ? listing.serviceRegions
        : (partner?.serviceRegions || []);

    const resolvedBSL =
      (listing.bioSafetyLevel && listing.bioSafetyLevel.length > 0)
        ? listing.bioSafetyLevel
        : (partner?.bioSafetyLevel || []);

    const resolvedCerts =
      (listing.certifications && listing.certifications.length > 0)
        ? listing.certifications
        : (partner?.certifications || []);

    const resolvedReps =
      listing.companyRepresentatives || partner?.companyRepresentatives || null;

    setListingEditor({
      // Core
      businessName: resolvedBusinessName,
      companyWebsite: resolvedCompanyWebsite,
      selectedPlan: listing.selectedPlan || "",
      selectedGroup: listing.selectedGroup || "",
      status: initialStatus,
      active: `${initialStatus === "Active"}`,
      // Taxonomy
      selectedCategories: listing.selectedCategories || [],
      selectedSubcategories: listing.selectedSubcategories || [],
      selectedSubSubcategories: listing.selectedSubSubcategories || [],
      serviceCountries: resolvedServiceCountries,
      serviceRegions: resolvedServiceRegions,
      // Business/Consulting
      companyProfileText: resolvedCompanyProfile,
      businessAddress: resolvedBusinessAddress,
      businessCountry: resolvedBusinessCountry,
      bioSafetyLevelCsv: resolvedBSL.join(", "),
      certificationsCsv: resolvedCerts.join(", "),
      companyRepresentativesJson: resolvedReps ? JSON.stringify(resolvedReps, null, 2) : "",
      // Event fields
      eventName: listing.eventName || "",
      eventLink: listing.eventLink || "",
      startDate: listing.startDate || "",
      endDate: listing.endDate || "",
      eventCountry: listing.eventCountry || (listing as any).country || resolvedBusinessCountry || "",
      stateRegion: listing.stateRegion || "",
      city: listing.city || "",
      location: listing.location || "",
      eventProfile: listing.eventProfile || (listing as any).description || "",
      agendaHighlights: listing.agendaHighlights || "",
      agendaPdfUrl: listing.agendaPdfUrl || (listing as any).agendaPdf || (listing as any).pdfUrl || partner?.agendaPdfUrl || "",
      // Job fields
      jobTitle: listing.jobTitle || "",
      industry: listing.industry || "",
      positionType: listing.positionType || "",
      experienceLevel: listing.experienceLevel || "",
      positionLink: listing.positionLink || "",
      jobCountry: listing.jobCountry || (listing as any).country || resolvedBusinessCountry || "",
      jobStateRegion: listing.stateRegion || "",
      jobCity: listing.city || "",
      jobLocation: listing.location || "",
      jobSummary: listing.jobSummary || "",
      education: listing.education || "",
      workModel: listing.workModel || "",
      applicationDeadline: listing.applicationDeadline || "",
      jobDescriptionPdfUrl: listing.jobDescriptionPdfUrl || (listing as any).jobPdf || (listing as any).pdfUrl || partner?.jobDescriptionPdfUrl || "",
      companyWebsiteLink: listing.companyWebsiteLink || resolvedCompanyWebsite || "",
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

  const listingInsights = useMemo(() => {
    const plansByListing = new Map<string, PartnerPlanRecord>();
    const plansByPartner = new Map<string, PartnerPlanRecord>();
    const featuresByListing = new Map<string, FeaturedPlanPurchase>();
    const featuresByPartner = new Map<string, FeaturedPlanPurchase>();
    const partnerById = new Map<string, PartnerRecord>();

    partners.forEach((p) => {
      if (p?.id) partnerById.set(p.id, p);
    });

    partnerPlans.forEach((plan) => {
      const currentTs =
        (plan as any)?.upgradedAt?.seconds ||
        (plan as any)?.startDate?.seconds ||
        plan?.createdAt?.seconds ||
        0;

      const listingId = (plan as any).listingId;
      if (listingId) {
        const existing = plansByListing.get(listingId);
        const existingTs =
          (existing as any)?.upgradedAt?.seconds ||
          (existing as any)?.startDate?.seconds ||
          existing?.createdAt?.seconds ||
          0;
        if (!existing || currentTs >= existingTs) {
          plansByListing.set(listingId, plan);
        }
      } else if (plan.partnerId) {
        const existing = plansByPartner.get(plan.partnerId);
        const existingTs =
          (existing as any)?.upgradedAt?.seconds ||
          (existing as any)?.startDate?.seconds ||
          existing?.createdAt?.seconds ||
          0;
        if (!existing || currentTs >= existingTs) {
          plansByPartner.set(plan.partnerId, plan);
        }
      }
    });

    featuredPlans.forEach((feature) => {
      if ((feature as any)?.supersededBy) return;
      const currentTs =
        (feature as any)?.lastPaymentReceived?.seconds ||
        feature?.createdAt?.seconds ||
        0;

      const listingId = (feature as any).listingId;
      if (listingId) {
        const existing = featuresByListing.get(listingId);
        const existingTs =
          (existing as any)?.lastPaymentReceived?.seconds ||
          existing?.createdAt?.seconds ||
          0;
        if (!existing || currentTs >= existingTs) {
          featuresByListing.set(listingId, feature);
        }
      } else if (feature.partnerId) {
        const existing = featuresByPartner.get(feature.partnerId);
        const existingTs =
          (existing as any)?.lastPaymentReceived?.seconds ||
          existing?.createdAt?.seconds ||
          0;
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

      const partner = partnerId ? partnerById.get(partnerId) : undefined;
      const isPendingPaymentListing =
        String(listing.status || "").trim().toLowerCase() === "pending_payment" ||
        String(listing.status || "").trim().toLowerCase() === "pending payment";

      const plan =
        plansByListing.get(listing.id) ||
        (!isPendingPaymentListing && partnerId ? plansByPartner.get(partnerId) : undefined);
      const feature =
        featuresByListing.get(listing.id) ||
        (!isPendingPaymentListing && partnerId ? featuresByPartner.get(partnerId) : undefined);

      const effectivePlanStatus = getEffectiveListingStatus(listing, { plan });
      const featureStatus = getEffectiveFeatureStatus(feature, listing);

      const isPlanPaidComplete =
        effectivePlanStatus !== "Pending Payment" &&
        Boolean(
          plan?.lastPaymentReceivedAt ||
            plan?.stripeSubscriptionId ||
            plan?.sessionId ||
            plan?.isTrial ||
            plan?.source === "admin_granted" ||
            listing.lastPaymentReceivedAt ||
            listing.stripeSubscriptionId ||
            (listing as any).createdByAdmin ||
            listing.status === "Approved" ||
            listing.status === "Active" ||
            listing.active === true
        );

      const isPlanCancelledOrExpired =
        effectivePlanStatus === "Cancelled" ||
        effectivePlanStatus === "Expired" ||
        Boolean(
          (plan as any)?.cancelAtPeriodEnd ||
            (plan as any)?.cancelAt ||
            (plan as any)?.canceledAt ||
            (plan as any)?.cancelledAt
        );

      const isFeaturePaidComplete =
        featureStatus !== "-" &&
        featureStatus !== "Pending Payment" &&
        Boolean(
          feature?.lastPaymentReceived ||
            (feature as any)?.stripeSubscriptionId ||
            (feature as any)?.sessionId ||
            feature?.isTrial ||
            feature?.source === "admin_granted" ||
            feature?.source === "included_plan" ||
            listing.lastFeaturePaymentReceivedAt ||
            listing.featureSpotlightPaidThrough ||
            (listing as any).createdByAdmin
        );

      const isFeatureCancelledOrExpired =
        featureStatus === "Cancelled" ||
        featureStatus === "Expired" ||
        Boolean(
          (feature as any)?.cancelPending ||
            (feature as any)?.cancelAtPeriodEnd ||
            (feature as any)?.cancelAt ||
            (feature as any)?.canceledAt ||
            (feature as any)?.deactivatedAt ||
            (listing as any)?.featureSpotlightCancelPending
        );

      const businessName =
        partner?.businessName ||
        (partner as any)?.companyName ||
        listing.businessName ||
        (listing as any).companyName ||
        "Unnamed";

      const isEvent = listing.__col === "eventsCollection" || listing.selectedGroup === "events";
      const isJob = listing.__col === "jobsCollection" || listing.selectedGroup === "jobs";
      const listingName = isEvent
        ? listing.eventName || (listing as any).title || listing.businessName || "—"
        : isJob
        ? listing.jobTitle || (listing as any).title || listing.businessName || "—"
        : (listing as any).listingTitle ||
          (listing as any).offeringName ||
          (listing as any).serviceName ||
          (listing as any).title ||
          listing.businessName ||
          businessName ||
          "—";

      const rawFeaturePlan =
        (listing as any)?.selectedAddon ||
        (listing as any)?.featuredPlacement ||
        (feature as any)?.featureName ||
        feature?.featureId ||
        (listing as any)?.featuredPlan ||
        "-";
      const featurePlanDisplay =
        rawFeaturePlan && rawFeaturePlan !== "-" && rawFeaturePlan !== "none"
          ? String(rawFeaturePlan).replace(/_/g, " ")
          : "-";

      acc[listing.id] = {
        plan,
        businessName,
        listingName,
        subscribedOn: isPlanPaidComplete
          ? (plan as any)?.startDate || plan?.createdAt || listing.lastPaymentReceivedAt || null
          : null,
        upgradedOn: isPlanPaidComplete ? (plan as any)?.upgradedAt || null : null,
        cancelledOn: isPlanCancelledOrExpired
          ? (plan as any)?.cancelAt ||
            (plan as any)?.canceledAt ||
            (plan as any)?.cancelledAt ||
            (effectivePlanStatus === "Expired" ? (plan as any)?.billingPeriodEnd : null) ||
            null
          : null,
        expiryDate: isPlanPaidComplete ? (plan as any)?.billingPeriodEnd || null : null,
        feature,
        featureStatus,
        isFeatured: featureStatus === "Active" || listing.isFeatured || feature?.active || false,
        featurePlan: featurePlanDisplay,
        featureDate: isFeaturePaidComplete
          ? (feature as any)?.lastPaymentReceived ||
            feature?.createdAt ||
            listing.lastFeaturePaymentReceivedAt ||
            null
          : null,
        featureCancelDate: isFeatureCancelledOrExpired
          ? (feature as any)?.cancelAt ||
            (feature as any)?.canceledAt ||
            (feature as any)?.accessThrough ||
            (listing as any)?.featureSpotlightAccessEnd ||
            (listing as any)?.featureSpotlightPaidThrough ||
            (feature as any)?.deactivatedAt ||
            null
          : null,
      };
      return acc;
    }, {} as Record<string, any>);
  }, [listings, partnerPlans, featuredPlans, partners]);

  const partnerInsights = useMemo(() => {
    const latestPlansByPartner = new Map<string, PartnerPlanRecord>();
    const partnerListingsMap = new Map<string, ListingRecord[]>();

    listings.forEach((listing) => {
      let partnerId = listing.partnerId;
      if (!partnerId) {
        if (listing.__col === "businessOfferingsCollection" || listing.__path?.includes("partnersCollection")) {
          partnerId = listing.__path.split("/")[1];
        }
      }
      if (!partnerId) return;
      const arr = partnerListingsMap.get(partnerId) || [];
      arr.push(listing);
      partnerListingsMap.set(partnerId, arr);
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

      // Only count listings where payment was completed (exclude Pending Payment)
      const pListings = (partnerListingsMap.get(partner.id) || []).filter((listing) => {
        const insight = listingInsights[listing.id];
        const status = getEffectiveListingStatus(listing, insight);
        return status !== "Pending Payment";
      });
      const totalListingsCount = pListings.length;
      const activeListings = pListings.filter((listing) => {
        const insight = listingInsights[listing.id];
        const status = getEffectiveListingStatus(listing, insight);
        return status === "Active" || status === "Approved" || status === "Extended";
      });

      // Deduplicate features per listing so feature upgrades keep the same feature count
      const pFeaturesRaw = featuredPlans.filter((f) => f.partnerId === partner.id && !(f as any).supersededBy);
      const uniqueFeatureKeys = new Set<string>();
      pFeaturesRaw.forEach((f) => {
        uniqueFeatureKeys.add(String((f as any).listingId || f.id));
      });
      const listingFeaturedCount = pListings.filter((l) => {
        const insight = listingInsights[l.id];
        const featStatus = insight?.featureStatus || getEffectiveFeatureStatus(insight?.feature, l);
        return featStatus !== "-" && featStatus !== "Pending Payment";
      }).length;
      const totalFeaturedCount = Math.max(uniqueFeatureKeys.size, listingFeaturedCount);

      let activeFeaturedCount = 0;
      activeListings.forEach((listing) => {
        const insight = listingInsights[listing.id];
        const featStatus = insight?.featureStatus || getEffectiveFeatureStatus(insight?.feature, listing);
        if (featStatus === "Active") {
          activeFeaturedCount += 1;
        }
      });

      acc[partner.id] = {
        latestPlan: formatUserPlan(rawPlan, latestPlan),
        listingCount: activeListings.length,
        totalListingsCount,
        featuredCount: activeFeaturedCount,
        totalFeaturedCount,
        trialInfo,
      };
      return acc;
    }, {} as Record<string, { 
      latestPlan: string; 
      listingCount: number; 
      totalListingsCount: number;
      featuredCount: number; 
      totalFeaturedCount: number;
      trialInfo?: { 
        durationDays: number; 
        currentDay: number; 
        isExpired: boolean; 
        daysLeft: number; 
        startDate: number;
        billingPeriodEnd: number;
      } | null;
    }>);
  }, [partners, partnerPlans, listings, featuredPlans, listingInsights]);

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
      isParent?: boolean;
      status?: string;
      imageUrl?: string;
      metaDescription?: string;
      metaKeywords?: string;
      description?: string;
      subEntries?: any[];
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

        const hasSubcategories = Array.isArray(subEntries) && subEntries.length > 0;
        const subCount = hasSubcategories ? subEntries.length : 0;

        // 1. ALWAYS push the Parent Category row
        rows.push({
          id: catMeta.id,
          group,
          category,
          subcategory: hasSubcategories ? "— (Parent Category)" : "—",
          subSubcategory: hasSubcategories ? `${subCount} subcategor${subCount === 1 ? "y" : "ies"}` : "—",
          isParent: true,
          status: isCatInactive ? "Inactive" : (catMeta.status || "Active"),
          imageUrl: catMeta.imageUrl || defaultImg,
          metaDescription: catMeta.metaDescription || "",
          metaKeywords: catMeta.metaKeywords || "",
          description: catMeta.description || "",
          subEntries: hasSubcategories ? subEntries : [],
        });

        // 2. If it has subcategories, also push rows for each individual subcategory
        if (hasSubcategories) {
          subEntries.forEach((sub: any) => {
            if (typeof sub === "string") {
              const specificSubMeta = categoryMetadataMap[`${groupKey}:${category}:${sub}`];
              const isSubInactive = specificSubMeta && (
                (specificSubMeta.status || "").toLowerCase() === "inactive" ||
                specificSubMeta.isDeleted === true ||
                specificSubMeta.deleted === true
              );

              if (isSubInactive) return;

              const subMeta = specificSubMeta || catMeta;
              rows.push({
                id: subMeta.id || catMeta.id,
                group,
                category,
                subcategory: sub,
                subSubcategory: "—",
                isParent: false,
                status: isCatInactive ? "Inactive" : (specificSubMeta?.status || catMeta.status || "Active"),
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
                : "—";
            const specificSubMeta = categoryMetadataMap[`${groupKey}:${category}:${subLabel}`];
            const isSubInactive = specificSubMeta && (
              (specificSubMeta.status || "").toLowerCase() === "inactive" ||
              specificSubMeta.isDeleted === true ||
              specificSubMeta.deleted === true
            );

            if (isSubInactive) return;

            const subMeta = specificSubMeta || catMeta;
            rows.push({
              id: subMeta.id || catMeta.id,
              group,
              category,
              subcategory: subLabel,
              subSubcategory: subSubs,
              isParent: false,
              status: isCatInactive ? "Inactive" : (specificSubMeta?.status || catMeta.status || "Active"),
              imageUrl: subMeta.imageUrl || catMeta.imageUrl || defaultImg,
              metaDescription: subMeta.metaDescription || catMeta.metaDescription || "",
              metaKeywords: subMeta.metaKeywords || catMeta.metaKeywords || "",
              description: subMeta.description || catMeta.description || "",
            });
          });
        }
      });
    });

    return rows.sort((a, b) => {
      const gComp = (a.group || "").localeCompare(b.group || "", undefined, { sensitivity: "base" });
      if (gComp !== 0) return gComp;
      const cComp = (a.category || "").localeCompare(b.category || "", undefined, { sensitivity: "base" });
      if (cComp !== 0) return cComp;
      if (a.isParent && !b.isParent) return -1;
      if (!a.isParent && b.isParent) return 1;
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

      // 2. Exact match on category (e.g. "Clinical Research") -> 950,000 for parent, 900,000 for sub
      if (cat === cleanQuery || (meaningfulPhrase && cat === meaningfulPhrase)) {
        return row.isParent ? 950000 : 900000;
      }

      // 3. Exact match on an individual sub-subcategory (e.g. "Adventitious Agents") -> 800,000
      if (subSubItems.includes(cleanQuery) || (meaningfulPhrase && subSubItems.includes(meaningfulPhrase))) return 800000;

      // 4. Subcategory starts with query -> 700,000
      if (sub.startsWith(cleanQuery) || (meaningfulPhrase && sub.startsWith(meaningfulPhrase))) return 700000;

      // 5. Category starts with query -> 650,000 for parent, 600,000 for sub
      if (cat.startsWith(cleanQuery) || (meaningfulPhrase && cat.startsWith(meaningfulPhrase))) {
        return row.isParent ? 650000 : 600000;
      }

      // 6. Any individual sub-subcategory starts with query -> 500,000
      if (subSubItems.some((item) => item.startsWith(cleanQuery) || (meaningfulPhrase && item.startsWith(meaningfulPhrase)))) return 500000;

      // 7. Subcategory contains exact query phrase -> 400,000
      if (sub.includes(cleanQuery) || (meaningfulPhrase && sub.includes(meaningfulPhrase))) return 400000;

      // 8. Category contains exact query phrase -> 350,000 for parent, 300,000 for sub
      if (cat.includes(cleanQuery) || (meaningfulPhrase && cat.includes(meaningfulPhrase))) {
        return row.isParent ? 350000 : 300000;
      }

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
      if (a.isParent && !b.isParent) return -1;
      if (!a.isParent && b.isParent) return 1;
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
      "Total Active Listings",
      "Total Listings",
      "Total Active Features",
      "Total Features",
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
        `${insight?.totalListingsCount || 0}`,
        `${insight?.featuredCount || 0}`,
        `${insight?.totalFeaturedCount || 0}`,
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

  const normalizedListingAuditRows = useMemo(() => {
    return buildNormalizedListingAuditRows({
      auditLogs,
      partners,
      listings,
      partnerPlans,
      featuredPlans,
      transactions,
    });
  }, [auditLogs, partners, listings, partnerPlans, featuredPlans, transactions]);

  const filteredListingAuditRows = useMemo(() => {
    return normalizedListingAuditRows.filter((row) => {
      if (auditListingFilter !== "all" && row.listingId !== auditListingFilter) {
        return false;
      }
      if (auditListingEventFilter !== "all" && row.eventKind !== auditListingEventFilter) {
        return false;
      }
      if (!auditSearchTerm) return true;
      const q = auditSearchTerm.toLowerCase().trim();
      return (
        row.companyName.toLowerCase().includes(q) ||
        row.listingName.toLowerCase().includes(q) ||
        row.actionLabel.toLowerCase().includes(q) ||
        row.grpLabel.toLowerCase().includes(q) ||
        row.typeLabel.toLowerCase().includes(q) ||
        row.byLabel.toLowerCase().includes(q) ||
        row.detailsLabel.toLowerCase().includes(q) ||
        row.paymentStatusLabel.toLowerCase().includes(q) ||
        row.actionId.toLowerCase().includes(q) ||
        (row.partnerId || "").toLowerCase().includes(q) ||
        (row.listingId || "").toLowerCase().includes(q)
      );
    });
  }, [normalizedListingAuditRows, auditListingFilter, auditListingEventFilter, auditSearchTerm]);

  const filteredPartnerLogs = useMemo(() => {
    return auditLogs
      .filter((log) => !isMemberAuditLog(log))
      .filter((log) => {
        if (auditCategoryFilter === "partner") {
          return isPartnerAccountLog(log);
        }
        if (auditCategoryFilter === "listing") {
          return isListingOrBillingLog(log);
        }
        // For "all", only include valid partner account logs or the 10 allowed listing/billing logs
        return isPartnerAccountLog(log) || isListingOrBillingLog(log);
      })
      .filter((log) => {
        if (!auditSearchTerm) return true;
        const q = auditSearchTerm.toLowerCase().trim();
        const metaStr = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : "";
        return (
          (log.partnerName || "").toLowerCase().includes(q) ||
          (log.action || "").toLowerCase().includes(q) ||
          (log.details || "").toLowerCase().includes(q) ||
          (log.partnerId || "").toLowerCase().includes(q) ||
          (log.id || "").toLowerCase().includes(q) ||
          metaStr.includes(q)
        );
      });
  }, [auditLogs, auditCategoryFilter, auditSearchTerm]);

  const exportPartnerAuditLogs = (format: "csv" | "excel") => {
    const isListingView = auditCategoryFilter === "listing";
    const headers = isListingView
      ? [
          "Date/Time",
          "Company Name",
          "Listing Name",
          "Action",
          "Grp",
          "Type",
          "By",
          "Details",
          "Payment Status",
          "Action ID",
        ]
      : ["Timestamp", "Company / Partner", "Partner ID", "Action", "Updated By", "Details"];

    const rows = isListingView
      ? filteredListingAuditRows.map((row) => [
          row.dateTimeStr,
          row.companyName,
          row.listingName,
          row.actionLabel,
          row.grpLabel,
          row.typeLabel,
          row.byLabel,
          row.detailsLabel,
          row.paymentStatusLabel,
          row.actionId,
        ])
      : filteredPartnerLogs.map((log) => {
          const actor = getPartnerAuditActor(log);
          const timeStr = log.timestamp?.seconds
            ? new Date(log.timestamp.seconds * 1000).toLocaleString()
            : "-";
          return [
            timeStr,
            log.partnerName || "Unknown",
            log.partnerId || "",
            log.action || "",
            actor.label,
            log.details || "",
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
    link.download = `${isListingView ? "listing-audit-trail" : "partner-audit-logs"}-${new Date().toISOString().slice(0, 10)}.${format === "excel" ? "xls" : "csv"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredMemberLogs = useMemo(() => {
    const explicitMemberLogs = auditLogs.filter(isMemberAuditLog);

    const registeredMemberIds = new Set<string>();
    const statusLoggedMemberIds = new Set<string>();
    for (const log of explicitMemberLogs) {
      const action = (log.action || "").toUpperCase();
      const mId = String(log.partnerId || log.memberId || log.metadata?.targetMemberId || "").trim();
      if (!mId) continue;
      if (action === "MEMBER_REGISTERED" || action === "ACCOUNT_CREATED") {
        registeredMemberIds.add(mId);
      }
      if (action === "MEMBER_STATUS_CHANGED") {
        statusLoggedMemberIds.add(mId);
      }
    }

    const synthesizedMemberLogs: any[] = [];
    for (const m of communityMembers) {
      const mId = String(m.userId || m.id || "").trim();
      const userName = String(m.userName || "").trim();
      if (!mId || userName.length < 2) continue;

      const displayName = String(m.name || "").trim() || `@${userName}`;
      const email = String(m.email || "").trim();

      if (!registeredMemberIds.has(mId)) {
        synthesizedMemberLogs.push({
          id: `synth-member-reg-${mId}`,
          partnerId: mId,
          memberId: mId,
          partnerName: displayName,
          memberName: displayName,
          action: "MEMBER_REGISTERED",
          details: `New community member registered (@${userName}${email ? `, ${email}` : ""})`,
          category: "community",
          performedBy: "member",
          metadata: {
            role: "member",
            scope: "community_members",
            email,
            userName,
            country: m.country || "",
          },
          timestamp: m.createdAt || null,
        });
      }

      const accStatus = String(m.accountStatus || "active").trim();
      if (accStatus !== "active" && !statusLoggedMemberIds.has(mId)) {
        const by = m.lastStatusChangeBy === "admin" ? "admin" : "system";
        synthesizedMemberLogs.push({
          id: `synth-member-status-${mId}`,
          partnerId: mId,
          memberId: mId,
          partnerName: displayName,
          memberName: displayName,
          action: "MEMBER_STATUS_CHANGED",
          details: `Account status changed to "${accStatus}" by ${by}.`,
          category: by === "admin" ? "admin" : "community",
          performedBy: by,
          metadata: {
            role: "member",
            scope: "community_members",
            email,
            newStatus: accStatus,
          },
          timestamp: m.spamBlockStartedAt || m.updatedAt || m.createdAt || null,
        });
      }
    }

    const combined = [...explicitMemberLogs, ...synthesizedMemberLogs].sort(
      (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
    );

    return combined.filter((log) => {
      const action = (log.action || "").toUpperCase();
      const details = (log.details || "").toLowerCase();

      if (memberAuditCategoryFilter === "account_created") {
        if (action !== "MEMBER_REGISTERED" && action !== "ACCOUNT_CREATED") return false;
      }
      if (memberAuditCategoryFilter === "password") {
        if (!action.includes("PASSWORD") && !details.includes("password")) return false;
      }
      if (memberAuditCategoryFilter === "status") {
        if (action !== "MEMBER_STATUS_CHANGED" && !details.includes("status changed")) return false;
      }
      if (memberAuditCategoryFilter === "post_reactivated") {
        if (action !== "POST_RESTORED" && !(action.includes("POST") && (details.includes("activated") || details.includes("restored")))) return false;
      }
      if (memberAuditCategoryFilter === "comment_reactivated") {
        if (action !== "COMMENT_ACTIVATED" && !(action.includes("COMMENT") && (details.includes("activated") || details.includes("restored")))) return false;
      }

      if (!memberAuditSearchTerm) return true;
      const q = memberAuditSearchTerm.toLowerCase().trim();
      const metaStr = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : "";
      return (
        (log.partnerName || log.memberName || "").toLowerCase().includes(q) ||
        (log.action || "").toLowerCase().includes(q) ||
        (log.details || "").toLowerCase().includes(q) ||
        (log.partnerId || log.memberId || "").toLowerCase().includes(q) ||
        (log.id || "").toLowerCase().includes(q) ||
        metaStr.includes(q)
      );
    });
  }, [auditLogs, communityMembers, memberAuditCategoryFilter, memberAuditSearchTerm]);

  const exportMemberAuditLogs = (format: "csv" | "excel") => {
    const headers = ["Timestamp", "Member / Subject", "Member ID", "Action", "Performed By", "Details"];
    const rows = filteredMemberLogs.map((log) => {
      const actor = getMemberAuditActor(log);
      const subject = getMemberAuditSubject(log, actor);
      const timeStr = log.timestamp?.seconds
        ? new Date(log.timestamp.seconds * 1000).toLocaleString()
        : "-";
      const performer =
        actor.label === "Admin" && (log.partnerName?.includes("@") || log.metadata?.adminEmail)
          ? `Admin (${log.partnerName || log.metadata?.adminEmail})`
          : actor.label;
      return [
        timeStr,
        subject.name,
        subject.id || log.partnerId || log.memberId || "",
        log.action || "",
        performer,
        log.details || "",
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
    link.download = `member-audit-logs-${new Date().toISOString().slice(0, 10)}.${format === "excel" ? "xls" : "csv"}`;
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
      pending_payment: 0,
      disabled: 0,
      pending: 0,
    };
    typeFilteredListings.forEach((l) => {
      const status = getEffectiveListingStatus(l, listingInsights[l.id]);
      if (status === "Active" || status === "Approved") counts.active++;
      else if (status === "Cancelled") counts.cancelled++;
      else if (status === "Expired") counts.expired++;
      else if (status === "Incomplete Payment" || status === "Payment Error") counts.incomplete_payment++;
      else if (status === "Pending Payment") counts.pending_payment++;
      else if (status === "Disabled") counts.disabled++;
      else if (status === "Pending Review" || status === "Pending") counts.pending++;
      else counts.active++;
    });
    return counts;
  }, [typeFilteredListings, listingInsights]);

  const filteredListings = useMemo(() => {
    return typeFilteredListings.filter((l) => {
      const insight = listingInsights[l.id];
      const status = getEffectiveListingStatus(l, insight);
      if (listingFilter === "pending" && status !== "Pending Review") return false;
      if (listingFilter === "active" && status !== "Active") return false;
      if (listingFilter === "approved" && status !== "Active") return false;
      if (listingFilter === "disabled" && status !== "Disabled") return false;
      if (listingFilter === "cancelled" && status !== "Cancelled") return false;
      if (listingFilter === "expired" && status !== "Expired") return false;
      if (listingFilter === "incomplete_payment" && status !== "Incomplete Payment") return false;
      if (listingFilter === "payment_error" && status !== "Incomplete Payment") return false;
      if (listingFilter === "pending_payment" && status !== "Pending Payment") return false;

      if (!listingSearchTerm) return true;

      const q = listingSearchTerm.toLowerCase();
      return (
        l.businessName?.toLowerCase().includes(q) ||
        insight?.businessName?.toLowerCase().includes(q) ||
        insight?.listingName?.toLowerCase().includes(q) ||
        l.selectedCategories?.some((c) => c.toLowerCase().includes(q)) ||
        l.selectedPlan?.toLowerCase().includes(q) ||
        status.toLowerCase().includes(q)
      );
    });
  }, [listingFilter, listingSearchTerm, typeFilteredListings, listingInsights]);

  const stats = {
    totalRevenue: transactions
      .filter((t) => ["succeeded", "completed", "complete", "paid"].includes(String(t.status || "").toLowerCase()))
      .reduce((acc, t) => acc + (t.amount || 0), 0),
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
    memberAudit: "Member Audit Trail",
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
            <SidebarItem label="Featured Plans" icon={Star} active={activeTab === "featuredPlans"} onClick={() => setActiveTab("featuredPlans")} />
            <SidebarItem label="Categories" icon={FileText} active={activeTab === "categories"} onClick={() => setActiveTab("categories")} />
            <SidebarItem label="Health Authority Sites" icon={Globe} active={activeTab === "healthAuthorities"} onClick={() => setActiveTab("healthAuthorities")} />
            <SidebarItem label="Site Policies" icon={ShieldCheck} active={activeTab === "policies"} onClick={() => setActiveTab("policies")} />
            <SidebarItem label="FAQs" icon={HelpCircle} active={activeTab === "faqs"} onClick={() => setActiveTab("faqs")} />
            <SidebarItem label="Contact Page" icon={Mail} active={activeTab === "contact"} onClick={() => setActiveTab("contact")} />
            <a
              href="/admin/dashboard?tab=transactions"
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors ${
                activeTab === "transactions"
                  ? "bg-slate-900 text-white font-semibold"
                  : "text-slate-600 hover:bg-slate-100 font-medium"
              }`}
              title="Open Transactions in a new tab"
            >
              <Receipt className="w-4 h-4 shrink-0 text-current" />
              <span className="text-sm text-left truncate flex-1 leading-snug">Transactions</span>
              <ExternalLink className={`ml-auto w-3.5 h-3.5 shrink-0 ${activeTab === "transactions" ? "text-white/80" : "text-slate-400"}`} />
            </a>
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 px-3 pt-4 pb-1">Community</p>
            <SidebarItem label="Members" icon={User} active={activeTab === "communityMembers"} onClick={() => setActiveTab("communityMembers")} />
            <SidebarItem label="Member posts" icon={MessageSquare} active={activeTab === "communityPosts"} onClick={() => setActiveTab("communityPosts")} />
            <SidebarItem label="Archive posts" icon={FileText} active={activeTab === "communityArchivePosts"} onClick={() => setActiveTab("communityArchivePosts")} />
            <SidebarItem label="Reported comments" icon={Flag} active={activeTab === "communityReportedComments"} onClick={() => setActiveTab("communityReportedComments")} />
            <SidebarItem label="Community categories" icon={Tags} active={activeTab === "communityCategories"} onClick={() => setActiveTab("communityCategories")} />
            <SidebarItem label="Email log" icon={History} active={activeTab === "emailLog"} onClick={() => setActiveTab("emailLog")} />
            <SidebarItem label="Member Audit Trail" icon={History} active={activeTab === "memberAudit"} onClick={() => setActiveTab("memberAudit")} />
            <SidebarItem label="Settings" icon={Settings} active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
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
                partners={partners}
                listings={listings}
                partnerPlans={partnerPlans}
                featuredPlans={featuredPlans}
                auditLogs={auditLogs}
                listingInsights={listingInsights}
                onViewListing={openListingEditor}
                onOpenTransactions={() => window.open("/admin/dashboard?tab=transactions", "_blank", "noopener,noreferrer")}
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
                  onOpenHistory={(partner) => setHistoryPartner(partner)}
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
                  <Button variant={listingFilter === "pending_payment" ? "default" : "outline"} onClick={() => setListingFilter("pending_payment")}>
                    <Clock className="w-4 h-4 mr-2" /> Pending Payment ({listingStatusCounts.pending_payment})
                  </Button>
                  <Button variant={listingFilter === "disabled" ? "default" : "outline"} onClick={() => setListingFilter("disabled")}>
                    <Ban className="w-4 h-4 mr-2" /> Disabled ({listingStatusCounts.disabled})
                  </Button>
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
                onViewAuditTrail={(listing) => {
                  setActiveTab("audit");
                  setAuditCategoryFilter("listing");
                  setAuditListingFilter(listing.id);
                  setAuditListingEventFilter("all");
                  setAuditSearchTerm("");
                }}
              />
            </div>
          )}

          {activeTab === "transactions" && (
            <TransactionList
              transactions={transactions}
              partners={partners}
              listings={listings}
              partnerPlans={partnerPlans}
              featuredPlans={featuredPlans}
              auditLogs={auditLogs}
              listingInsights={listingInsights}
            />
          )}

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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm text-slate-600">
                    {auditCategoryFilter === "listing"
                      ? "Listing audit trail — money, plans, upgrades, features, renewals, pending/failed payments, and cancellations."
                      : "Partner account & profile audit trail — initial profile creation, password changes, and updates to Partner Information fields (logo, company profile, contacts, address, etc.)."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder={auditCategoryFilter === "listing" ? "Search company, listing, ID, details…" : "Search partner, field change, ID…"}
                      value={auditSearchTerm}
                      onChange={(e) => setAuditSearchTerm(e.target.value)}
                      className="pl-9 h-10 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setAuditCategoryFilter("partner")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
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
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        auditCategoryFilter === "listing"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Listings & Money
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportPartnerAuditLogs("csv")}
                      className="h-10 text-xs"
                      disabled={
                        auditCategoryFilter === "listing"
                          ? filteredListingAuditRows.length === 0
                          : filteredPartnerLogs.length === 0
                      }
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportPartnerAuditLogs("excel")}
                      className="h-10 text-xs"
                      disabled={
                        auditCategoryFilter === "listing"
                          ? filteredListingAuditRows.length === 0
                          : filteredPartnerLogs.length === 0
                      }
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel
                    </Button>
                  </div>
                </div>
              </div>

              {auditCategoryFilter === "listing" && (
                <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Filter by Listing:</span>
                    <select
                      value={auditListingFilter}
                      onChange={(e) => setAuditListingFilter(e.target.value)}
                      className="flex h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 min-w-[230px]"
                    >
                      <option value="all">All Listings ({listings.length})</option>
                      {listings.map((l) => {
                        const insight = listingInsights[l.id];
                        const lName = insight?.listingName || l.eventName || l.jobTitle || l.businessName || "Unnamed Listing";
                        const cName = insight?.businessName || l.businessName || "";
                        const grp = formatAuditGroupCode(l.selectedGroup || l.__col, l.selectedPlan);
                        return (
                          <option key={l.__path || l.id} value={l.id}>
                            [{grp}] {lName}{cName && cName !== lName ? ` — ${cName}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Event Type:</span>
                    <select
                      value={auditListingEventFilter}
                      onChange={(e) => setAuditListingEventFilter(e.target.value)}
                      className="flex h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 min-w-[210px]"
                    >
                      <option value="all">All 10 Listing Events</option>
                      <option value="subscription_purchased">1. Listing/Subscription Purchased (New Listing)</option>
                      <option value="subscription_upgraded">2. Subscription Upgraded (Upgrade)</option>
                      <option value="feature_added">3. Feature Added (F added)</option>
                      <option value="feature_upgraded">4. Feature Upgraded (F upgraded)</option>
                      <option value="plan_cancelled">5. Plan Cancelled (Cancelled)</option>
                      <option value="feature_cancelled">6. Feature Cancelled (F cancelled)</option>
                      <option value="feature_renewed">7. Feature Renewed</option>
                      <option value="plan_renewed">8. Plan Renewed</option>
                      <option value="payment_failed">9. Payment Failed (Stripe)</option>
                      <option value="payment_pending">10. Payment Pending</option>
                    </select>
                  </div>

                  {(auditListingFilter !== "all" || auditListingEventFilter !== "all" || auditSearchTerm) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAuditListingFilter("all");
                        setAuditListingEventFilter("all");
                        setAuditSearchTerm("");
                      }}
                      className="h-9 text-xs text-slate-600 hover:text-slate-900"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}

              {auditCategoryFilter === "listing" ? (
                <ListingAuditLogTable
                  rows={filteredListingAuditRows}
                  onSelectListing={(listingId) => {
                    if (listingId) {
                      setAuditListingFilter((prev) => (prev === listingId ? "all" : listingId));
                    }
                  }}
                  activeListingFilter={auditListingFilter}
                />
              ) : (
                <PartnerAuditLogList logs={filteredPartnerLogs} />
              )}
            </div>
          )}

          {activeTab === "memberAudit" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm text-slate-600">
                    Audit logs, registration history, authentication events, and moderation actions for community members.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search member, email, details…"
                      value={memberAuditSearchTerm}
                      onChange={(e) => setMemberAuditSearchTerm(e.target.value)}
                      className="pl-9 h-10 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setMemberAuditCategoryFilter("all")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        memberAuditCategoryFilter === "all"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      All (5 Events)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberAuditCategoryFilter("account_created")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        memberAuditCategoryFilter === "account_created"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Account Created
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberAuditCategoryFilter("password")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        memberAuditCategoryFilter === "password"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Password Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberAuditCategoryFilter("status")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        memberAuditCategoryFilter === "status"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Status Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberAuditCategoryFilter("post_reactivated")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        memberAuditCategoryFilter === "post_reactivated"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Post Reactivations
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberAuditCategoryFilter("comment_reactivated")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        memberAuditCategoryFilter === "comment_reactivated"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Comment Reactivations
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportMemberAuditLogs("csv")}
                      className="h-10 text-xs"
                      disabled={filteredMemberLogs.length === 0}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportMemberAuditLogs("excel")}
                      className="h-10 text-xs"
                      disabled={filteredMemberLogs.length === 0}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel
                    </Button>
                  </div>
                </div>
              </div>
              <MemberAuditLogList logs={filteredMemberLogs} />
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
            <div className="flex items-center gap-2">
              {selectedPartner ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  <a
                    href={`/admin/dashboard?tab=audit&auditView=partner&auditSearch=${encodeURIComponent(
                      selectedPartner.id || selectedPartner.businessName || ""
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <History className="w-3.5 h-3.5" />
                    Partner Audit Trail
                  </a>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="flex items-center gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  <History className="w-3.5 h-3.5" />
                  Partner Audit Trail
                </Button>
              )}
            </div>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {selectedPartner && !Boolean((selectedPartner as any).createdByAdmin) && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Self-Registered Partner Account</span>
                  <p className="text-blue-700 mt-0.5">Only the Company Name and Primary Email are editable by admins. Other profile fields are managed directly by the partner.</p>
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

            {/* Section 2: Contact Information */}
            <div className="border-b pb-2 pt-4 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Contact Information</h3>
            </div>
            {!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin) && (
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-3 text-xs text-blue-800 mb-2">
                <strong>Self-serve Partner Account:</strong> Only Company Name and Primary Email can be updated by admin. All other profile information is managed by the partner.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" value={partnerEditor.firstName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, firstName: v }))} disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)} />
              <Field label="Last Name" value={partnerEditor.lastName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, lastName: v }))} disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)} />
            </div>
            <Field label="Primary Contact Name" value={partnerEditor.primaryName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, primaryName: v }))} disabled={!Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)} />
            <Field 
              label="Primary Email" 
              value={partnerEditor.primaryEmail || ""} 
              onChange={(v) => setPartnerEditor((prev) => ({ ...prev, primaryEmail: v }))} 
              disabled={false}
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
            <Field label="Business / Company Name" value={partnerEditor.businessName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, businessName: v }))} disabled={false} />
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
                <AdminPdfViewer 
                  label="Event Agenda PDF" 
                  pdfUrl={partnerEditor.agendaPdfUrl} 
                  partnerId={selectedPartner?.id || "admin"}
                  uploadType="event"
                  onPdfChange={async (newUrl) => {
                    setPartnerEditor((prev) => ({ ...prev, agendaPdfUrl: newUrl }));
                    if (selectedPartner?.id) {
                      try {
                        await updateDoc(doc(db, "partnersCollection", selectedPartner.id), { agendaPdfUrl: newUrl });
                        setSaveNotice(newUrl ? "Event Agenda PDF updated!" : "Event Agenda PDF removed.");
                        setTimeout(() => setSaveNotice(""), 4000);
                      } catch (err) {
                        console.error("Failed to update partner PDF:", err);
                      }
                    }
                  }}
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
                <AdminPdfViewer 
                  label="Job Description PDF" 
                  pdfUrl={partnerEditor.jobDescriptionPdfUrl} 
                  partnerId={selectedPartner?.id || "admin"}
                  uploadType="job"
                  onPdfChange={async (newUrl) => {
                    setPartnerEditor((prev) => ({ ...prev, jobDescriptionPdfUrl: newUrl }));
                    if (selectedPartner?.id) {
                      try {
                        await updateDoc(doc(db, "partnersCollection", selectedPartner.id), { jobDescriptionPdfUrl: newUrl });
                        setSaveNotice(newUrl ? "Job Description PDF updated!" : "Job Description PDF removed.");
                        setTimeout(() => setSaveNotice(""), 4000);
                      } catch (err) {
                        console.error("Failed to update partner PDF:", err);
                      }
                    }
                  }}
                />
              </>
            )}

            <Button 
              onClick={savePartnerEdits} 
              disabled={
                Boolean(selectedPartner && (selectedPartner as any).createdByAdmin)
                  ? !((partnerEditor.primaryName?.trim() || (partnerEditor.firstName?.trim() && partnerEditor.lastName?.trim())) && partnerEditor.businessName?.trim() && partnerEditor.primaryEmail?.trim())
                  : !(partnerEditor.businessName?.trim() && partnerEditor.primaryEmail?.trim())
              } 
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
            {selectedListing ? (
              <Button asChild variant="outline" size="sm" className="flex items-center gap-2">
                <a
                  href={`/admin/dashboard?tab=audit&auditView=listing&auditListing=${encodeURIComponent(selectedListing.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <History className="w-4 h-4" />
                  View Listing History
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="flex items-center gap-2">
                <History className="w-4 h-4" />
                View Listing History
              </Button>
            )}
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
                      <option value="Cancelled">Cancelled</option>
                      <option value="Expired">Expired</option>
                      <option value="Incomplete Payment">Incomplete Payment</option>
                      <option value="Pending Payment">Pending Payment</option>
                      <option value="Disabled">Disabled</option>
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
                      <AdminPdfViewer 
                        label="Event Agenda PDF" 
                        pdfUrl={listingEditor.agendaPdfUrl} 
                        partnerId={selectedListing?.partnerId || (selectedListing?.__path?.startsWith("partnersCollection/") ? selectedListing.__path.split('/')[1] : "admin")}
                        uploadType="event"
                        onPdfChange={async (newUrl) => {
                          setListingEditor((prev) => ({ ...prev, agendaPdfUrl: newUrl }));
                          if (selectedListing?.__path) {
                            try {
                              await updateDoc(doc(db, selectedListing.__path), { 
                                agendaPdfUrl: newUrl,
                                agenda: listingEditor.agendaHighlights || ""
                              });
                              setSaveNotice(newUrl ? "Agenda PDF saved to listing!" : "Agenda PDF removed from listing.");
                              setTimeout(() => setSaveNotice(""), 4000);
                            } catch (err) {
                              console.error("Failed to update listing PDF:", err);
                            }
                          }
                        }}
                      />
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
                      <AdminPdfViewer 
                        label="Job Description PDF" 
                        pdfUrl={listingEditor.jobDescriptionPdfUrl} 
                        partnerId={selectedListing?.partnerId || (selectedListing?.__path?.startsWith("partnersCollection/") ? selectedListing.__path.split('/')[1] : "admin")}
                        uploadType="job"
                        onPdfChange={async (newUrl) => {
                          setListingEditor((prev) => ({ ...prev, jobDescriptionPdfUrl: newUrl }));
                          if (selectedListing?.__path) {
                            try {
                              await updateDoc(doc(db, selectedListing.__path), { jobDescriptionPdfUrl: newUrl });
                              setSaveNotice(newUrl ? "Job Description PDF saved to listing!" : "Job Description PDF removed from listing.");
                              setTimeout(() => setSaveNotice(""), 4000);
                            } catch (err) {
                              console.error("Failed to update listing PDF:", err);
                            }
                          }
                        }}
                      />
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

      <PartnerPlanHistoryModal
        partner={historyPartner}
        isOpen={Boolean(historyPartner)}
        onClose={() => setHistoryPartner(null)}
        partnerPlans={partnerPlans}
        featuredPlans={featuredPlans}
        listings={listings}
        transactions={transactions}
        listingInsights={listingInsights}
      />
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
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-medium tracking-wide text-slate-500">{label}</p>
        <p className="text-2xl font-bold mt-1 text-slate-900 tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function OverviewTab({
  stats,
  transactions,
  partners,
  listings,
  partnerPlans,
  featuredPlans,
  auditLogs,
  listingInsights,
  onViewListing,
  onOpenTransactions,
}: {
  stats: any;
  transactions: any[];
  partners: PartnerRecord[];
  listings: ListingRecord[];
  partnerPlans: PartnerPlanRecord[];
  featuredPlans: FeaturedPlanPurchase[];
  auditLogs: any[];
  listingInsights: Record<string, any>;
  onViewListing: (listing: ListingRecord) => void;
  onOpenTransactions: () => void;
}) {
  const [renewalWindow, setRenewalWindow] = useState<"month" | "week">("month");

  const toDateSafe = (val: any): Date | null => {
    if (!val) return null;
    if (typeof val.toDate === "function") {
      const d = val.toDate();
      return d && !isNaN(d.getTime()) ? d : null;
    }
    if (typeof val.seconds === "number") return new Date(val.seconds * 1000);
    if (typeof val._seconds === "number") return new Date(val._seconds * 1000);
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === "string" || typeof val === "number") {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const partnerById = useMemo(() => {
    const map = new Map<string, PartnerRecord>();
    for (const p of partners) {
      if (p.id) map.set(p.id, p);
    }
    return map;
  }, [partners]);

  const listingById = useMemo(() => {
    const map = new Map<string, ListingRecord>();
    for (const l of listings) {
      if (l.id) map.set(l.id, l);
    }
    return map;
  }, [listings]);

  const getListingTitle = (l: ListingRecord | undefined, fallback?: string): string => {
    if (!l) return fallback || "—";
    return String(l.eventName || l.jobTitle || (l as any).title || l.businessName || fallback || "—").trim();
  };

  // Current Month and Current Week windows starting from start of today
  const windows = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    // Current calendar week (through end of Sunday of this week)
    const day = now.getDay(); // 0 = Sun, 1 = Mon, ...
    const daysToSunday = day === 0 ? 0 : 7 - day;
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday, 23, 59, 59, 999);
    // Current calendar month (through last day of this month)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startOfToday, endOfWeek, endOfMonth };
  }, []);

  // Build all active, auto-renewing upcoming renewals (plans + standalone features)
  const { renewalsThisMonth, renewalsThisWeek } = useMemo(() => {
    type RenewalItem = {
      id: string;
      kind: "Plan" | "Feature";
      businessName: string;
      listingName: string;
      itemLabel: string;
      groupLabel: string;
      renewalDate: Date;
      listing?: ListingRecord;
    };

    const items: RenewalItem[] = [];
    const seenKeys = new Set<string>();

    for (const plan of partnerPlans) {
      const linkedListing = plan.listingId ? listingById.get(String(plan.listingId)) : undefined;
      const insight = linkedListing ? listingInsights[linkedListing.id] : undefined;
      const effStatus = getEffectiveListingStatus(
        { status: plan.status, active: plan.active !== false },
        { plan, expiryDate: plan.billingPeriodEnd },
      );
      if (
        effStatus !== "Active" ||
        plan.cancelPending ||
        (plan as any).cancelAtPeriodEnd ||
        (plan as any).cancelAt ||
        (linkedListing as any)?.cancelPending ||
        (linkedListing as any)?.cancelAt
      ) {
        continue;
      }
      // Exclude non-recurring single-run jobs/trials if marked admin trial without Stripe subscription
      const renewalDate = toDateSafe(plan.billingPeriodEnd);
      if (!renewalDate) continue;
      if (renewalDate.getTime() < windows.startOfToday.getTime()) continue;

      const partner = partnerById.get(plan.partnerId);
      const businessName =
        partner?.businessName ||
        linkedListing?.businessName ||
        insight?.businessName ||
        "—";
      const listingName = getListingTitle(linkedListing, businessName);
      const groupLabel = formatAuditGroupCode(plan.group || linkedListing?.selectedGroup || linkedListing?.__col, plan.planId);
      const itemLabel = formatAuditPlanType(plan.planId || plan.planName, groupLabel);

      const dedupKey = `plan:${plan.listingId || plan.id}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      items.push({
        id: `plan-${plan.id}`,
        kind: "Plan",
        businessName,
        listingName,
        itemLabel: itemLabel !== "-" ? itemLabel : (plan.planName || plan.planId || "Plan"),
        groupLabel,
        renewalDate,
        listing: linkedListing,
      });
    }

    for (const feat of featuredPlans) {
      if ((feat as any).supersededBy) continue;
      const linkedListing = feat.listingId ? listingById.get(String(feat.listingId)) : undefined;
      const effFeat = getEffectiveFeatureStatus(feat, linkedListing);
      if (
        effFeat !== "Active" ||
        (feat as any).cancelPending ||
        (feat as any).cancelAtPeriodEnd ||
        (feat as any).cancelAt ||
        (linkedListing as any)?.featureSpotlightCancelPending
      ) {
        continue;
      }
      const renewalDate = toDateSafe(feat.accessThrough || (feat as any).billingPeriodEnd);
      if (!renewalDate) continue;
      if (renewalDate.getTime() < windows.startOfToday.getTime()) continue;

      const partner = partnerById.get(feat.partnerId);
      const businessName = partner?.businessName || linkedListing?.businessName || "—";
      const listingName = getListingTitle(linkedListing, businessName);
      const groupLabel = formatAuditGroupCode(linkedListing?.selectedGroup || linkedListing?.__col, linkedListing?.selectedPlan);
      const itemLabel = formatAuditFeatureType(feat.featureId || feat.featureName);

      const dedupKey = `feat:${feat.listingId || feat.id}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      items.push({
        id: `feat-${feat.id}`,
        kind: "Feature",
        businessName,
        listingName,
        itemLabel: itemLabel !== "-" ? itemLabel : (feat.featureName || feat.featureId || "Feature"),
        groupLabel,
        renewalDate,
        listing: linkedListing,
      });
    }

    items.sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime());

    return {
      renewalsThisMonth: items.filter((i) => i.renewalDate.getTime() <= windows.endOfMonth.getTime()),
      renewalsThisWeek: items.filter((i) => i.renewalDate.getTime() <= windows.endOfWeek.getTime()),
    };
  }, [partnerPlans, featuredPlans, listingById, listingInsights, partnerById, windows]);

  // Separate Incomplete Payments (unfinished/abandoned checkouts) & Failed Payments (payment failures / declined charges)
  const { incompletePayments, failedPayments } = useMemo(() => {
    type PaymentIssueItem = {
      id: string;
      businessName: string;
      listingName: string;
      itemLabel: string;
      amountDisplay: string;
      dateObj: Date | null;
      statusLabel: string;
      listing?: ListingRecord;
    };

    const incomplete: PaymentIssueItem[] = [];
    const failed: PaymentIssueItem[] = [];
    const seenFailedKeys = new Set<string>();
    const seenIncompleteKeys = new Set<string>();

    const completedListingIds = new Set<string>();
    const completedSessionIds = new Set<string>();
    for (const t of transactions) {
      const s = String(t.status || "").toLowerCase();
      if (["succeeded", "completed", "complete", "paid"].includes(s)) {
        if (t.listingId) completedListingIds.add(String(t.listingId));
        if (t.sessionId) completedSessionIds.add(String(t.sessionId));
      }
    }

    // 1. TransactionsCollection entries with failed / incomplete / pending statuses
    for (const t of transactions) {
      const s = String(t.status || "").toLowerCase().trim();
      if (["succeeded", "completed", "complete", "paid"].includes(s)) continue;
      const linkedListing = t.listingId ? listingById.get(String(t.listingId)) : undefined;
      const partner = t.partnerId ? partnerById.get(String(t.partnerId)) : undefined;
      const businessName = t.businessName || partner?.businessName || linkedListing?.businessName || "—";
      const listingName = getListingTitle(linkedListing, t.listingTitle || businessName);
      const formatted = formatPartnerTransaction({ id: t.id, ...t });
      const dateObj = toDateSafe(t.createdAt);

      const isPendingCheckout = ["pending", "pending_payment", "pending payment", "open", "expired"].includes(s);
      if (isPendingCheckout) {
        const key = String(t.sessionId || t.listingId || t.id);
        if (seenIncompleteKeys.has(key)) continue;
        seenIncompleteKeys.add(key);
        incomplete.push({
          id: `txn-inc-${t.id}`,
          businessName,
          listingName,
          itemLabel: formatted.planDisplay || formatted.description || "Checkout",
          amountDisplay: formatted.amountNumeric > 0 ? formatted.amountDisplay : "—",
          dateObj,
          statusLabel: "Pending Payment",
          listing: linkedListing,
        });
      } else {
        const key = String(t.invoiceId || t.sessionId || t.listingId || t.id);
        if (seenFailedKeys.has(key)) continue;
        seenFailedKeys.add(key);
        failed.push({
          id: `txn-fail-${t.id}`,
          businessName,
          listingName,
          itemLabel: formatted.planDisplay || formatted.description || "Payment",
          amountDisplay: formatted.amountNumeric > 0 ? formatted.amountDisplay : "—",
          dateObj,
          statusLabel: "Failed Payment",
          listing: linkedListing,
        });
      }
    }

    // 2. Audit logs: PAYMENT_FAILED -> Failed Payments; PAYMENT_PENDING / unpaid LISTING_CREATED -> Incomplete Payments
    for (const log of auditLogs) {
      if (!log || isMemberAuditLog(log)) continue;
      const action = String(log.action || "").toUpperCase().trim();
      const meta = log.metadata || {};
      const lid = meta.listingId ? String(meta.listingId) : "";
      const sid = meta.sessionId ? String(meta.sessionId) : "";
      const invId = meta.invoiceId ? String(meta.invoiceId) : "";
      const linkedListing = lid ? listingById.get(lid) : undefined;
      const listingStatus = linkedListing
        ? getEffectiveListingStatus(linkedListing, listingInsights[linkedListing.id])
        : "";
      const partner = log.partnerId ? partnerById.get(String(log.partnerId)) : undefined;
      const businessName = partner?.businessName || linkedListing?.businessName || log.partnerName || "—";
      const listingName = getListingTitle(linkedListing, meta.listingName || businessName);
      const grp = formatAuditGroupCode(meta.group || linkedListing?.selectedGroup || linkedListing?.__col, meta.planId || meta.plan || linkedListing?.selectedPlan);
      const itemLabel = meta.featureId
        ? formatAuditFeatureType(meta.featureId)
        : formatAuditPlanType(meta.planId || meta.plan || linkedListing?.selectedPlan, grp);
      const dateObj = toDateSafe(log.timestamp);

      if (action === "PAYMENT_FAILED") {
        const key = String(invId || sid || lid || log.id);
        if (seenFailedKeys.has(key)) continue;
        seenFailedKeys.add(key);
        const amt = typeof meta.amountDue === "number" ? meta.amountDue : typeof meta.amount === "number" ? meta.amount : 0;
        failed.push({
          id: `log-fail-${log.id}`,
          businessName,
          listingName,
          itemLabel: itemLabel !== "-" ? itemLabel : "Stripe Payment",
          amountDisplay: amt > 0 ? `$${amt.toFixed(2)}` : "—",
          dateObj,
          statusLabel: "Failed Payment",
          listing: linkedListing,
        });
      } else if (
        action === "PAYMENT_PENDING" ||
        (action === "LISTING_CREATED" &&
          (listingStatus === "Pending Payment" || String(meta.paymentStatus || "").toLowerCase().includes("pending")))
      ) {
        if (sid && completedSessionIds.has(sid)) continue;
        if (lid && (completedListingIds.has(lid) || (listingStatus && listingStatus !== "Pending Payment"))) continue;
        const key = String(sid || lid || log.id);
        if (seenIncompleteKeys.has(key)) continue;
        seenIncompleteKeys.add(key);
        incomplete.push({
          id: `log-inc-${log.id}`,
          businessName,
          listingName,
          itemLabel: itemLabel !== "-" ? itemLabel : "Checkout Started",
          amountDisplay: "—",
          dateObj,
          statusLabel: "Incomplete Payment",
          listing: linkedListing,
        });
      }
    }

    // 3. Listings / plans / features currently in Pending Payment or Incomplete Payment status
    for (const l of listings) {
      if (!l?.id) continue;
      const effStatus = getEffectiveListingStatus(l, listingInsights[l.id]);
      if (effStatus !== "Pending Payment" && effStatus !== "Incomplete Payment") continue;
      const partner = l.partnerId ? partnerById.get(l.partnerId) : undefined;
      const businessName = l.businessName || partner?.businessName || "—";
      const listingName = getListingTitle(l, businessName);
      const grp = formatAuditGroupCode(l.selectedGroup || l.__col, l.selectedPlan);
      const itemLabel = formatAuditPlanType(l.selectedPlan, grp);
      const dateObj = toDateSafe(l.createdAt || (l as any).updatedAt);

      if (effStatus === "Incomplete Payment") {
        if (seenFailedKeys.has(String(l.id))) continue;
        seenFailedKeys.add(String(l.id));
        failed.push({
          id: `listing-fail-${l.id}`,
          businessName,
          listingName,
          itemLabel: itemLabel !== "-" ? itemLabel : "Plan",
          amountDisplay: "—",
          dateObj,
          statusLabel: "Incomplete Payment",
          listing: l,
        });
      } else {
        if (seenIncompleteKeys.has(String(l.id))) continue;
        seenIncompleteKeys.add(String(l.id));
        incomplete.push({
          id: `listing-inc-${l.id}`,
          businessName,
          listingName,
          itemLabel: itemLabel !== "-" ? itemLabel : "Checkout",
          amountDisplay: "—",
          dateObj,
          statusLabel: "Pending Payment",
          listing: l,
        });
      }
    }

    const byDateDesc = (a: PaymentIssueItem, b: PaymentIssueItem) =>
      (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0);

    return {
      incompletePayments: incomplete.sort(byDateDesc),
      failedPayments: failed.sort(byDateDesc),
    };
  }, [transactions, auditLogs, listings, listingById, listingInsights, partnerById]);

  const recentSuccessfulTransactions = useMemo(
    () =>
      transactions
        .filter((t) => ["succeeded", "completed", "complete", "paid"].includes(String(t.status || "").toLowerCase()))
        .slice(0, 7),
    [transactions],
  );

  const visibleRenewals = renewalWindow === "week" ? renewalsThisWeek : renewalsThisMonth;
  const fmtShortDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Revenue" value={`$${Number(stats.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <StatCard label="Partners" value={stats.totalPartners} />
        <StatCard label="Live Listings" value={stats.activeListings} />
        <StatCard
          label={`Upcoming Renewals (${renewalWindow === "week" ? "Week" : "Month"})`}
          value={visibleRenewals.length}
        />
        <StatCard label="Incomplete Payments" value={incompletePayments.length} />
        <StatCard label="Failed Payments" value={failedPayments.length} />
      </div>

      {/* Upcoming Renewals with Current Month / Current Week toggle */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="tracking-normal">Upcoming Renewals</CardTitle>
            <CardDescription className="leading-relaxed">
              {renewalWindow === "week"
                ? `Current week (${fmtShortDate(windows.startOfToday)} – ${fmtShortDate(windows.endOfWeek)})`
                : `Current month (${fmtShortDate(windows.startOfToday)} – ${fmtShortDate(windows.endOfMonth)})`}
              {" · "}Active, non-cancelled plans and features scheduled to renew.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setRenewalWindow("month")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                renewalWindow === "month"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Current Month ({renewalsThisMonth.length})
            </button>
            <button
              type="button"
              onClick={() => setRenewalWindow("week")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                renewalWindow === "week"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Current Week ({renewalsThisWeek.length})
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visibleRenewals.length === 0 ? (
            <p className="text-sm text-slate-500 px-6 pb-6">
              No upcoming renewals for the current {renewalWindow === "week" ? "week" : "month"}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Renewal Date</TableHead>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Listing Name</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="pr-6">Plan / Feature</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRenewals.slice(0, 15).map((item) => (
                    <TableRow
                      key={item.id}
                      className={item.listing ? "cursor-pointer hover:bg-slate-50/70" : ""}
                      onClick={() => item.listing && onViewListing(item.listing)}
                    >
                      <TableCell className="pl-6 font-medium text-slate-700 whitespace-nowrap">
                        {item.renewalDate.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 max-w-[180px] truncate" title={item.businessName}>
                        {item.businessName}
                      </TableCell>
                      <TableCell className="text-slate-700 max-w-[200px] truncate" title={item.listingName}>
                        {item.listingName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="text-xs font-medium">
                          {item.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-medium text-slate-600">
                        {item.groupLabel}
                      </TableCell>
                      <TableCell className="pr-6 font-medium text-slate-800 whitespace-nowrap">
                        {item.itemLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incomplete Payments + Failed Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle className="tracking-normal">Incomplete Payments</CardTitle>
              <CardDescription className="leading-relaxed">Checkouts started that have not been completed.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onOpenTransactions} className="text-xs text-slate-600 hover:text-slate-900">
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {incompletePayments.length === 0 ? (
              <p className="text-sm text-slate-500 px-6 pb-6">No incomplete payments right now.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Business / Listing</TableHead>
                    <TableHead>Plan / Feature</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incompletePayments.slice(0, 7).map((item) => (
                    <TableRow
                      key={item.id}
                      className={item.listing ? "cursor-pointer hover:bg-slate-50/70" : ""}
                      onClick={() => item.listing && onViewListing(item.listing)}
                    >
                      <TableCell className="pl-6 max-w-[200px]">
                        <p className="font-medium text-slate-900 truncate" title={item.businessName}>{item.businessName}</p>
                        {item.listingName && item.listingName !== item.businessName && (
                          <p className="text-xs text-slate-500 truncate" title={item.listingName}>{item.listingName}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">{item.itemLabel}</TableCell>
                      <TableCell>
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium whitespace-nowrap">
                          {item.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 text-slate-500 text-xs whitespace-nowrap">
                        {item.dateObj ? item.dateObj.toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle className="tracking-normal">Failed Payments</CardTitle>
              <CardDescription className="leading-relaxed">Charges or renewals that failed payment.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onOpenTransactions} className="text-xs text-slate-600 hover:text-slate-900">
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {failedPayments.length === 0 ? (
              <p className="text-sm text-slate-500 px-6 pb-6">No failed payments recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Business / Listing</TableHead>
                    <TableHead>Plan / Feature</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right pr-6">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedPayments.slice(0, 7).map((item) => (
                    <TableRow
                      key={item.id}
                      className={item.listing ? "cursor-pointer hover:bg-slate-50/70" : ""}
                      onClick={() => item.listing && onViewListing(item.listing)}
                    >
                      <TableCell className="pl-6 max-w-[200px]">
                        <p className="font-medium text-slate-900 truncate" title={item.businessName}>{item.businessName}</p>
                        {item.listingName && item.listingName !== item.businessName && (
                          <p className="text-xs text-slate-500 truncate" title={item.listingName}>{item.listingName}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        <div>{item.itemLabel}</div>
                        <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-medium mt-0.5">
                          {item.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-rose-600 text-sm whitespace-nowrap">
                        {item.amountDisplay}
                      </TableCell>
                      <TableCell className="text-right pr-6 text-slate-500 text-xs whitespace-nowrap">
                        {item.dateObj ? item.dateObj.toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle className="tracking-normal">Recent Transactions</CardTitle>
            <CardDescription className="leading-relaxed">Latest 7 successful platform payments.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenTransactions} className="text-xs text-slate-600 hover:text-slate-900">
            View all
          </Button>
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
              {recentSuccessfulTransactions.map((t) => (
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

const TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;

function useTablePagination<T>(items: T[], initialSize = 25) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(initialSize);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [items.length, pageSize]);

  const pageItems = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );

  const startIndex = items.length === 0 ? 0 : safePage * pageSize + 1;
  const endIndex = Math.min(items.length, safePage * pageSize + pageSize);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    pageItems,
    totalCount: items.length,
    startIndex,
    endIndex,
  };
}

function TablePaginationBar({
  page,
  pageCount,
  pageSize,
  totalCount,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  itemLabel = "rows",
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  totalCount: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  itemLabel?: string;
}) {
  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-xs text-slate-600">
        <span>
          Showing <strong className="text-slate-900">{startIndex}–{endIndex}</strong> of{" "}
          <strong className="text-slate-900">{totalCount}</strong> {itemLabel}
        </span>
        <label className="inline-flex items-center gap-1.5">
          <span className="text-slate-500">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
          >
            {TABLE_PAGE_SIZES.map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </label>
      </div>
      <AdminTablePagination
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function PartnerList({
  partners,
  partnerInsights,
  onView,
  onSetStatus,
  onOpenHistory: _onOpenHistory,
}: {
  partners: PartnerRecord[];
  partnerInsights: Record<
    string,
    {
      latestPlan: string;
      listingCount: number;
      totalListingsCount: number;
      featuredCount: number;
      totalFeaturedCount: number;
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
  onOpenHistory: (partner: PartnerRecord) => void;
}) {
  const { page, setPage, pageSize, setPageSize, pageCount, pageItems, totalCount, startIndex, endIndex } =
    useTablePagination(partners, 25);

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
    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[68vh] admin-table-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <TableRow>
                <TableHead className="pl-4 pr-2 py-3 text-xs">Business</TableHead>
                <TableHead className="px-2 py-3 text-xs">Email</TableHead>
                <TableHead className="px-2 py-3 text-xs">Phone</TableHead>
                <TableHead className="px-2 py-3 text-xs">Profile Created</TableHead>
                <TableHead className="px-2 py-3 text-xs text-center whitespace-nowrap">Total Active Listings</TableHead>
                <TableHead className="px-2 py-3 text-xs text-center whitespace-nowrap">Total Listings</TableHead>
                <TableHead className="px-2 py-3 text-xs text-center whitespace-nowrap">Total Active Features</TableHead>
                <TableHead className="px-2 py-3 text-xs text-center whitespace-nowrap">Total Features</TableHead>
                <TableHead className="px-2 py-3 text-xs">Contact</TableHead>
                <TableHead className="px-2 py-3 text-xs">Head Office Country</TableHead>
                <TableHead className="px-2 py-3 text-xs text-center">By Admin</TableHead>
                <TableHead className="pl-2 pr-4 py-3 text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((partner) => {
                const insight = partnerInsights[partner.id];
                const created = formatPartnerCreatedAt(partner.createdAt || partner.created || partner.registeredAt);
                const historyUrl = `/admin/dashboard?tab=partners&partnerHistory=${encodeURIComponent(partner.id)}`;
                const partnerAuditUrl = `/admin/dashboard?tab=audit&auditView=partner&auditSearch=${encodeURIComponent(partner.id)}`;

                return (
                  <TableRow key={partner.id} className="hover:bg-slate-50/70">
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
                    <TableCell className="px-2 py-2 text-sm text-center">
                      <a
                        href={historyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Open active listings history in new tab"
                      >
                        {insight?.listingCount || 0}
                      </a>
                    </TableCell>
                    <TableCell className="px-2 py-2 text-sm text-center">
                      <a
                        href={historyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        title="Open all-time listings history in new tab"
                      >
                        {insight?.totalListingsCount || 0}
                      </a>
                    </TableCell>
                    <TableCell className="px-2 py-2 text-sm text-center">
                      <a
                        href={historyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold text-slate-800 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                        title="Open active features history in new tab"
                      >
                        {insight?.featuredCount || 0}
                      </a>
                    </TableCell>
                    <TableCell className="px-2 py-2 text-sm text-center">
                      <a
                        href={historyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                        title="Open all-time features history in new tab"
                      >
                        {insight?.totalFeaturedCount || 0}
                      </a>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <p className="text-sm max-w-[120px] truncate font-medium text-slate-800" title={partner.primaryName || ""}>
                        {partner.primaryName || "-"}
                      </p>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <p className="text-sm text-slate-700 max-w-[130px] truncate" title={partner.businessCountry || partner.headOfficeCountry || partner.headquartersCountry || partner.country || ""}>
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
                        <DropdownMenuContent align="end" className="min-w-[220px]">
                          <DropdownMenuLabel>Partner Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <a href={historyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
                              <History className="w-4 h-4 mr-2 text-blue-600" />
                              <span className="flex-1">Plan &amp; feature history</span>
                              <ExternalLink className="w-3.5 h-3.5 ml-2 text-slate-400" />
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={partnerAuditUrl} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
                              <History className="w-4 h-4 mr-2 text-indigo-600" />
                              <span className="flex-1">Partner audit trail</span>
                              <ExternalLink className="w-3.5 h-3.5 ml-2 text-slate-400" />
                            </a>
                          </DropdownMenuItem>
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
        <TablePaginationBar
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalCount={totalCount}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="partners"
        />
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
                      {option.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 italic pt-1">{option.description}</p>
                      )}
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
    const isParentRow = Boolean(
      row.isParent ||
      row.subcategory === "— (Parent Category)" ||
      row.subcategory === "—" ||
      row.subcategory === "-" ||
      !row.subcategory
    );

    const isSubSub = !isParentRow && row.subSubcategory && row.subSubcategory !== "-" && row.subSubcategory !== "—";
    const isSub = !isParentRow && row.subcategory && row.subcategory !== "-" && row.subcategory !== "—";

    const confirmMessage = isParentRow
      ? `Are you sure you want to delete the entire category "${row.category}" and all its subcategories from ${row.group}? This will permanently remove it from the directory.`
      : isSubSub
      ? `Are you sure you want to delete "${row.category} → ${row.subcategory} → ${row.subSubcategory}" from ${row.group}?`
      : isSub
      ? `Are you sure you want to delete "${row.category} → ${row.subcategory}" from ${row.group}?`
      : `Are you sure you want to delete "${row.category}" from ${row.group}?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const rowKey = `${row.group}__${row.category}__${row.subcategory}__${row.subSubcategory}`;
    setDeletingKey(rowKey);
    try {
      const canonicalId = buildCategoryDocId(
        row.group,
        row.category,
        isSub ? row.subcategory : undefined,
        isSubSub ? row.subSubcategory : undefined
      );
      const docId = row.id || canonicalId;

      const deletePayload = {
        group: row.group,
        parentCategory: row.group,
        category: row.category,
        categoryName: row.category,
        subcategory: isParentRow ? "" : (row.subcategory === "-" || row.subcategory === "—" ? "" : (row.subcategory || "")),
        subSubcategory: isParentRow ? "" : (row.subSubcategory === "-" || row.subSubcategory === "—" ? "" : (row.subSubcategory || "")),
        status: "Inactive",
        isDeleted: true,
        deleted: true,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "categoriesCollection", docId), deletePayload, { merge: true });

      if (canonicalId !== docId) {
        try {
          await setDoc(doc(db, "categoriesCollection", canonicalId), deletePayload, { merge: true });
        } catch (_) {}
      }

      if (isParentRow) {
        await setDoc(doc(db, "categoriesCollection", `${canonicalId}_all`), deletePayload, { merge: true }).catch(() => {});
        if (Array.isArray(row.subEntries) && row.subEntries.length > 0) {
          for (const sub of row.subEntries) {
            const subLabel = typeof sub === "string" ? sub : sub?.label;
            if (!subLabel) continue;
            const subCanonicalId = buildCategoryDocId(row.group, row.category, subLabel);
            await setDoc(
              doc(db, "categoriesCollection", subCanonicalId),
              { ...deletePayload, subcategory: subLabel, subSubcategory: "" },
              { merge: true }
            ).catch(() => {});
          }
        }
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
                    <TableRow
                      key={rowKey}
                      className={
                        row.isParent
                          ? "bg-slate-50/80 hover:bg-slate-100/70 border-t border-slate-200 transition-colors"
                          : "hover:bg-slate-50/50 transition-colors"
                      }
                    >
                      <TableCell className="pl-6 font-medium text-slate-800">{row.group}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {!row.isParent && <span className="text-slate-400 text-xs pl-2 font-mono">↳</span>}
                          <span className={row.isParent ? "font-semibold text-slate-900" : "text-slate-600"}>
                            {row.category}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.isParent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Parent Category
                          </span>
                        ) : (
                          <span className="text-slate-800 font-medium">{row.subcategory}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.isParent ? (
                          <span className="text-xs text-slate-500 italic">{row.subSubcategory}</span>
                        ) : (
                          <span className="text-slate-600">{row.subSubcategory}</span>
                        )}
                      </TableCell>
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
  onViewAuditTrail,
}: {
  listings: ListingRecord[];
  listingInsights: Record<string, any>;
  onView: (listing: ListingRecord) => void;
  onSetStatus: (listing: ListingRecord, status: string, active: boolean) => void;
  onSetFeatureStatus?: (listing: ListingRecord, status: string, active: boolean) => void;
  onViewAuditTrail?: (listing: ListingRecord) => void;
}) {
  const { page, setPage, pageSize, setPageSize, pageCount, pageItems, totalCount, startIndex, endIndex } =
    useTablePagination(listings, 25);
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
  }, [updateScrollDimensions, pageItems]);

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
          className="overflow-auto max-h-[68vh] admin-table-scrollbar"
        >
          <Table className="min-w-max">
            <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <TableRow>
                <TableHead className="pl-6">Business Name</TableHead>
                <TableHead>Listing Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan Created Date</TableHead>
                <TableHead>Upgraded On</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Plan Cancel Date</TableHead>
                <TableHead>Feature Status</TableHead>
                <TableHead>Current Feature Plan</TableHead>
                <TableHead>Feature Created Date</TableHead>
                <TableHead>Feature Cancel Date</TableHead>
                <TableHead className="text-right pr-6 sticky right-0 z-30 bg-slate-50 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {pageItems.map((listing) => {
              const insight = listingInsights[listing.id];
              const effectiveStatus = getEffectiveListingStatus(listing, insight);
              const businessName = insight?.businessName || listing.businessName || "Unnamed";
              const listingName = insight?.listingName || listing.eventName || listing.jobTitle || listing.businessName || "—";
              const listingAuditUrl = `/admin/dashboard?tab=audit&auditView=listing&auditListing=${encodeURIComponent(listing.id)}`;
              return (
                <TableRow key={listing.__path} className="hover:bg-slate-50/70">
                  <TableCell className="pl-6">
                    <p className="font-medium">{businessName}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-700">{listingName}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getCollectionLabel(listing.__col)}</Badge>
                  </TableCell>
                  <TableCell>{formatUserPlan(listing.selectedPlan, insight?.plan)}</TableCell>
                  <TableCell>{getStatusBadge(effectiveStatus)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(insight?.subscribedOn)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(insight?.upgradedOn)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(insight?.expiryDate)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(insight?.cancelledOn)}</TableCell>
                  <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                    {insight?.featureStatus && insight?.featureStatus !== "-" ? (
                      getStatusBadge(insight?.featureStatus)
                    ) : (
                      <span className="text-slate-400 text-xs font-mono">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm capitalize">{insight?.featurePlan || "-"}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(insight?.featureDate)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{formatAdminDate(insight?.featureCancelDate)}</TableCell>
                  <TableCell className="text-right pr-6 sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[235px]">
                        <DropdownMenuLabel>Listing Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onView(listing)}>
                          <Eye className="w-4 h-4 mr-2" /> View Listing
                        </DropdownMenuItem>
                        {onViewAuditTrail && (
                          <DropdownMenuItem asChild>
                            <a href={listingAuditUrl} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
                              <History className="w-4 h-4 mr-2 text-blue-600" />
                              <span className="flex-1">View Listing Audit Trail</span>
                              <ExternalLink className="w-3.5 h-3.5 ml-2 text-slate-400" />
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold py-1">
                          Listing Status
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Active", true)}>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Set to Active
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Cancelled", false)}>
                          <XCircle className="w-4 h-4 mr-2 text-rose-600" /> Set to Cancelled
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Expired", false)}>
                          <Clock className="w-4 h-4 mr-2 text-orange-600" /> Set to Expired
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Incomplete Payment", false)}>
                          <AlertTriangle className="w-4 h-4 mr-2 text-red-600" /> Set to Incomplete Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Pending Payment", false)}>
                          <Clock className="w-4 h-4 mr-2 text-amber-600" /> Set to Pending Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSetStatus(listing, "Disabled", false)}>
                          <Ban className="w-4 h-4 mr-2 text-slate-600" /> Set to Disabled
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
                            <DropdownMenuItem onClick={() => onSetFeatureStatus(listing, "Cancelled", false)}>
                              <XCircle className="w-4 h-4 mr-2 text-rose-600" /> Set Feature: Cancelled
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetFeatureStatus(listing, "Expired", false)}>
                              <Clock className="w-4 h-4 mr-2 text-orange-600" /> Set Feature: Expired
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetFeatureStatus(listing, "Incomplete Payment", false)}>
                              <AlertTriangle className="w-4 h-4 mr-2 text-red-600" /> Set Feature: Incomplete Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetFeatureStatus(listing, "Pending Payment", false)}>
                              <Clock className="w-4 h-4 mr-2 text-amber-600" /> Set Feature: Pending Payment
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
        <TablePaginationBar
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalCount={totalCount}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="listings"
        />
      </CardContent>
    </Card>
  );
}

function TransactionList({
  transactions,
  partners = [],
  listings = [],
  partnerPlans = [],
  featuredPlans = [],
  auditLogs = [],
  listingInsights = {},
}: {
  transactions: any[];
  partners?: PartnerRecord[];
  listings?: ListingRecord[];
  partnerPlans?: PartnerPlanRecord[];
  featuredPlans?: FeaturedPlanPurchase[];
  auditLogs?: any[];
  listingInsights?: Record<string, any>;
}) {
  const [search, setSearch] = useState("");

  const partnerMap = useMemo(() => {
    const byId = new Map<string, PartnerRecord>();
    const byEmail = new Map<string, PartnerRecord>();
    for (const p of partners) {
      if (p.id) byId.set(p.id, p);
      if (p.primaryEmail) byEmail.set(p.primaryEmail.toLowerCase(), p);
    }
    return { byId, byEmail };
  }, [partners]);

  const listingNameLookup = useMemo(() => {
    const byId = new Map<string, string>();
    const bySubId = new Map<string, string>();
    const byPartnerGroup = new Map<string, string[]>();
    const normalizeGroupKey = (raw: string): string => {
      const s = raw.toLowerCase();
      if (s.includes("event")) return "events";
      if (s.includes("job")) return "jobs";
      if (s.includes("consulting")) return "consulting";
      if (s.includes("business")) return "business_offerings";
      return s;
    };
    const getListingName = (l: any): string =>
      String(l?.eventName || l?.jobTitle || l?.title || l?.businessName || l?.companyName || "").trim();

    for (const l of listings) {
      const name = getListingName(l);
      if (!name) continue;
      if (l.id) byId.set(String(l.id), name);
      if ((l as any).stripeSubscriptionId) bySubId.set(String((l as any).stripeSubscriptionId), name);
      if ((l as any).featureSpotlightStripeSubscriptionId) {
        bySubId.set(String((l as any).featureSpotlightStripeSubscriptionId), name);
      }
      const pid = l.partnerId || (typeof l.__path === "string" && l.__path.startsWith("partnersCollection/") ? l.__path.split("/")[1] : "");
      const grpKey = normalizeGroupKey(String(l.selectedGroup || l.__col || ""));
      if (pid && grpKey) {
        const key = `${pid}:${grpKey}`;
        const arr = byPartnerGroup.get(key) || [];
        arr.push(name);
        byPartnerGroup.set(key, arr);
      }
    }
    for (const pl of partnerPlans) {
      if (pl.stripeSubscriptionId && pl.listingId && !bySubId.has(String(pl.stripeSubscriptionId))) {
        const name = byId.get(String(pl.listingId));
        if (name) bySubId.set(String(pl.stripeSubscriptionId), name);
      }
    }
    for (const fp of featuredPlans) {
      const subId = (fp as any).stripeSubscriptionId;
      if (subId && fp.listingId && !bySubId.has(String(subId))) {
        const name = byId.get(String(fp.listingId));
        if (name) bySubId.set(String(subId), name);
      }
    }
    return { byId, bySubId, byPartnerGroup, normalizeGroupKey };
  }, [listings, partnerPlans, featuredPlans]);

  const rows = useMemo(() => {
    const resolveTitleForRow = (formatted: PartnerTransactionRow) => {
      const byIdName = formatted.listingId ? listingNameLookup.byId.get(String(formatted.listingId)) : "";
      const bySubName = formatted.stripeSubscriptionId
        ? listingNameLookup.bySubId.get(String(formatted.stripeSubscriptionId))
        : "";
      let byGroupName = "";
      if (!byIdName && !bySubName && formatted.partnerId && formatted.group) {
        const key = `${formatted.partnerId}:${listingNameLookup.normalizeGroupKey(formatted.group)}`;
        const candidates = listingNameLookup.byPartnerGroup.get(key) || [];
        if (candidates.length === 1) {
          byGroupName = candidates[0];
        }
      }
      return byIdName || bySubName || byGroupName || formatted.targetTitle || null;
    };

    const rawTxns = transactions.map((t) => {
      const formatted = formatPartnerTransaction({ id: t.id, ...t });
      return {
        ...formatted,
        targetTitle: resolveTitleForRow(formatted),
      };
    });

    const knownSessionIds = new Set<string>();
    const knownInvoiceIds = new Set<string>();
    const paidListingIds = new Set<string>();
    const nonCompletedListingIds = new Set<string>();
    const nonCompletedSubIds = new Set<string>();

    for (const r of rawTxns) {
      if (r.sessionId) knownSessionIds.add(String(r.sessionId));
      if (r.invoiceId) knownInvoiceIds.add(String(r.invoiceId));
      const isPaid = r.statusLabel === "Completed";
      if (r.listingId) {
        if (isPaid) paidListingIds.add(String(r.listingId));
        else nonCompletedListingIds.add(String(r.listingId));
      }
      if (!isPaid && r.stripeSubscriptionId) {
        nonCompletedSubIds.add(String(r.stripeSubscriptionId));
      }
    }

    const listingById = new Map<string, ListingRecord>();
    for (const l of listings) {
      if (l.id) listingById.set(String(l.id), l);
    }

    const syntheticRows: PartnerTransactionRow[] = [];

    // 1. Include PAYMENT_FAILED and active PAYMENT_PENDING / unpaid LISTING_CREATED audit logs not already in transactionsCollection
    for (const log of auditLogs) {
      if (!log || isMemberAuditLog(log)) continue;
      const action = String(log.action || "").toUpperCase().trim();
      const meta = log.metadata || {};
      const lid = meta.listingId ? String(meta.listingId) : "";
      const sid = meta.sessionId ? String(meta.sessionId) : "";
      const invId = meta.invoiceId ? String(meta.invoiceId) : "";
      const subId = meta.subscriptionId ? String(meta.subscriptionId) : "";

      const linkedListing = lid ? listingById.get(lid) : undefined;
      const listingStatus = linkedListing
        ? getEffectiveListingStatus(linkedListing, listingInsights[linkedListing.id])
        : "";

      const isFailedLog = action === "PAYMENT_FAILED";
      const isPendingLog =
        action === "PAYMENT_PENDING" ||
        (action === "LISTING_CREATED" &&
          (listingStatus === "Pending Payment" ||
            String(meta.paymentStatus || "").toLowerCase().includes("pending")));

      if (!isFailedLog && !isPendingLog) continue;
      if (sid && knownSessionIds.has(sid)) continue;
      if (invId && knownInvoiceIds.has(invId)) continue;
      if (isPendingLog && lid && (paidListingIds.has(lid) || (listingStatus && listingStatus !== "Pending Payment"))) {
        continue;
      }

      if (sid) knownSessionIds.add(sid);
      if (invId) knownInvoiceIds.add(invId);
      if (lid) nonCompletedListingIds.add(lid);
      if (subId) nonCompletedSubIds.add(subId);

      const partner = log.partnerId ? partnerMap.byId.get(String(log.partnerId)) : undefined;
      const rawAmount =
        typeof meta.amountDue === "number"
          ? meta.amountDue
          : typeof meta.amount === "number"
            ? meta.amount
            : 0;
      const syntheticDoc: Record<string, unknown> & { id: string } = {
        id: `audit-${log.id}`,
        partnerId: log.partnerId || "",
        createdAt: log.timestamp || linkedListing?.createdAt || null,
        type: meta.featureId ? "feature" : "listing",
        planId: meta.planId || meta.plan || linkedListing?.selectedPlan || null,
        featureId: meta.featureId || (linkedListing as any)?.selectedAddon || null,
        group: meta.group || meta.type || linkedListing?.selectedGroup || null,
        listingId: lid || null,
        stripeSubscriptionId: subId || null,
        sessionId: sid || null,
        invoiceId: invId || null,
        amount: rawAmount,
        currency: meta.currency || "usd",
        status: isFailedLog ? "incomplete_payment" : "pending_payment",
        eventType: isFailedLog && String(meta.billingReason || "") === "subscription_cycle" ? "renewal" : "initial",
        listingTitle:
          meta.listingName ||
          linkedListing?.eventName ||
          linkedListing?.jobTitle ||
          linkedListing?.title ||
          linkedListing?.businessName ||
          null,
        businessName: partner?.businessName || linkedListing?.businessName || log.partnerName || "",
        customerEmail: partner?.primaryEmail || "",
        primaryContact: partner?.primaryName || "",
        description: isFailedLog
          ? String(log.details || "").trim() && String(log.details || "").trim() !== "N/A"
            ? String(log.details)
            : undefined
          : undefined,
      };
      const formatted = formatPartnerTransaction(syntheticDoc);
      syntheticRows.push({
        ...formatted,
        targetTitle: resolveTitleForRow(formatted),
      });
    }

    // 2. Include listings currently in Pending Payment or Incomplete Payment status if not already represented
    for (const l of listings) {
      if (!l?.id) continue;
      const effStatus = getEffectiveListingStatus(l, listingInsights[l.id]);
      if (effStatus !== "Pending Payment" && effStatus !== "Incomplete Payment") continue;
      if (nonCompletedListingIds.has(String(l.id))) continue;

      nonCompletedListingIds.add(String(l.id));
      const pid =
        l.partnerId ||
        (typeof l.__path === "string" && l.__path.startsWith("partnersCollection/") ? l.__path.split("/")[1] : "");
      const partner = pid ? partnerMap.byId.get(pid) : undefined;
      const syntheticDoc: Record<string, unknown> & { id: string } = {
        id: `listing-${l.id}`,
        partnerId: pid || "",
        createdAt: l.createdAt || l.updatedAt || null,
        type: "listing",
        planId: l.selectedPlan || null,
        group: l.selectedGroup || l.__col || null,
        listingId: l.id,
        collectionName: l.__col || null,
        stripeSubscriptionId: (l as any).stripeSubscriptionId || null,
        amount: 0,
        currency: "usd",
        status: effStatus === "Incomplete Payment" ? "incomplete_payment" : "pending_payment",
        eventType: "initial",
        listingTitle: l.eventName || l.jobTitle || l.title || l.businessName || null,
        businessName: l.businessName || partner?.businessName || "",
        customerEmail: partner?.primaryEmail || "",
        primaryContact: partner?.primaryName || "",
      };
      const formatted = formatPartnerTransaction(syntheticDoc);
      syntheticRows.push({
        ...formatted,
        targetTitle: resolveTitleForRow(formatted),
      });
    }

    // 3. Include partnerPlans / featuredPlans currently in Incomplete Payment or Pending Payment status
    for (const pl of partnerPlans) {
      const s = getEffectiveListingStatus(
        { status: pl.status, active: pl.active !== false },
        { plan: pl, expiryDate: pl.billingPeriodEnd },
      );
      if (s !== "Incomplete Payment" && s !== "Pending Payment") continue;
      if (pl.listingId && nonCompletedListingIds.has(String(pl.listingId))) continue;
      if (pl.stripeSubscriptionId && nonCompletedSubIds.has(String(pl.stripeSubscriptionId))) continue;
      if (pl.listingId) nonCompletedListingIds.add(String(pl.listingId));
      if (pl.stripeSubscriptionId) nonCompletedSubIds.add(String(pl.stripeSubscriptionId));

      const partner = pl.partnerId ? partnerMap.byId.get(pl.partnerId) : undefined;
      const syntheticDoc: Record<string, unknown> & { id: string } = {
        id: `plan-${pl.id}`,
        partnerId: pl.partnerId || "",
        createdAt: pl.startDate || pl.createdAt || null,
        type: "listing",
        planId: pl.planId || null,
        planName: pl.planName || null,
        group: pl.group || null,
        listingId: pl.listingId || null,
        collectionName: pl.collectionName || null,
        stripeSubscriptionId: pl.stripeSubscriptionId || null,
        amount: typeof pl.price === "number" ? pl.price : 0,
        currency: "usd",
        status: s === "Incomplete Payment" ? "incomplete_payment" : "pending_payment",
        eventType: "initial",
        businessName: partner?.businessName || "",
        customerEmail: partner?.primaryEmail || "",
        primaryContact: partner?.primaryName || "",
      };
      const formatted = formatPartnerTransaction(syntheticDoc);
      syntheticRows.push({
        ...formatted,
        targetTitle: resolveTitleForRow(formatted),
      });
    }

    for (const fp of featuredPlans) {
      const s = getEffectiveFeatureStatus(fp);
      if (s !== "Incomplete Payment" && s !== "Pending Payment") continue;
      const subId = (fp as any).stripeSubscriptionId;
      if (subId && nonCompletedSubIds.has(String(subId))) continue;
      if (subId) nonCompletedSubIds.add(String(subId));

      const partner = fp.partnerId ? partnerMap.byId.get(fp.partnerId) : undefined;
      const syntheticDoc: Record<string, unknown> & { id: string } = {
        id: `feature-${fp.id}`,
        partnerId: fp.partnerId || "",
        createdAt: fp.lastPaymentReceived || fp.createdAt || null,
        type: "feature",
        featureId: fp.featureId || null,
        listingId: fp.listingId || null,
        collectionName: fp.collectionName || null,
        stripeSubscriptionId: subId || null,
        amount: 0,
        currency: "usd",
        status: s === "Incomplete Payment" ? "incomplete_payment" : "pending_payment",
        eventType: "initial",
        businessName: partner?.businessName || "",
        customerEmail: partner?.primaryEmail || "",
        primaryContact: partner?.primaryName || "",
      };
      const formatted = formatPartnerTransaction(syntheticDoc);
      syntheticRows.push({
        ...formatted,
        targetTitle: resolveTitleForRow(formatted),
      });
    }

    return [...rawTxns, ...syntheticRows].sort(sortPartnerTransactionsNewestFirst);
  }, [transactions, auditLogs, listings, partnerPlans, featuredPlans, listingInsights, partnerMap, listingNameLookup]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const p = (r.partnerId ? partnerMap.byId.get(r.partnerId) : null) || (r.customerEmail ? partnerMap.byEmail.get(r.customerEmail.toLowerCase()) : null);
      const contact = r.primaryContact || p?.primaryName || "";
      const bName = r.businessName || p?.businessName || "";
      const em = r.customerEmail || p?.primaryEmail || "";
      const listingName = r.targetTitle || "";
      const hay = [
        r.dateDisplay,
        em,
        contact,
        bName,
        listingName,
        r.group,
        r.eventDisplay,
        r.planDisplay,
        r.description,
        r.upgradeFor,
        r.listingId,
        r.statusLabel,
        r.amountDisplay,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, partnerMap]);

  const {
    page: txnPage,
    setPage: setTxnPage,
    pageSize: txnPageSize,
    setPageSize: setTxnPageSize,
    pageCount: txnPageCount,
    pageItems: paginatedTxns,
    totalCount: txnTotalCount,
    startIndex: txnStart,
    endIndex: txnEnd,
  } = useTablePagination(filtered, 25);

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
              placeholder="Search partner, business, listing, plan, status…"
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
            <div className="overflow-auto max-h-[68vh] admin-table-scrollbar">
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Primary contact</TableHead>
                    <TableHead>Business name</TableHead>
                    <TableHead>Listing name</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right pr-6">Invoice (pdf)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTxns.map((t: PartnerTransactionRow) => {
                    const partner = (t.partnerId ? partnerMap.byId.get(t.partnerId) : null) || (t.customerEmail ? partnerMap.byEmail.get(t.customerEmail.toLowerCase()) : null);
                    const email = t.customerEmail || partner?.primaryEmail || "—";
                    const primaryContact = t.primaryContact || partner?.primaryName || "—";
                    const businessName = t.businessName || partner?.businessName || "—";
                    const listingName = t.targetTitle || "—";
                    const event = t.eventDisplay || "Initial";
                    const description = t.planDisplay || t.description || "—";

                    return (
                      <TableRow key={t.id}>
                        <TableCell className="pl-6 whitespace-nowrap text-slate-600">{t.dateDisplay}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={email}>
                          {email}
                        </TableCell>
                        <TableCell className="max-w-[170px] truncate font-medium text-slate-800" title={primaryContact}>
                          {primaryContact}
                        </TableCell>
                        <TableCell className="max-w-[190px] truncate text-slate-700" title={businessName}>
                          {businessName}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium text-slate-800" title={listingName}>
                          {listingName}
                        </TableCell>
                        <TableCell className="capitalize whitespace-nowrap">{t.group || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-slate-700">{event}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={description}>
                          {description}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              t.statusLabel === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                                : t.statusLabel === "Pending Payment"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 font-medium"
                                  : "bg-red-50 text-red-700 border-red-200 font-medium"
                            }
                          >
                            {t.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                          {t.amountDisplay}
                        </TableCell>
                        <TableCell className="text-right pr-6 whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              downloadSingleTransactionInvoicePdf(t, {
                                companyName: businessName !== "—" ? businessName : "Partner",
                                email: email !== "—" ? email : "",
                                businessId: t.partnerId || partner?.id || "",
                              })
                            }
                            className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 inline-flex items-center gap-1.5"
                            title="Download Invoice PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePaginationBar
              page={txnPage}
              pageCount={txnPageCount}
              pageSize={txnPageSize}
              totalCount={txnTotalCount}
              startIndex={txnStart}
              endIndex={txnEnd}
              onPageChange={setTxnPage}
              onPageSizeChange={setTxnPageSize}
              itemLabel="transactions"
            />
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

function AdminPdfViewer({
  label,
  pdfUrl,
  partnerId,
  uploadType = "event",
  onPdfChange,
  emptyMessage = "No PDF uploaded",
}: {
  label: string;
  pdfUrl?: string | null;
  partnerId?: string;
  uploadType?: "event" | "job";
  onPdfChange?: (url: string) => Promise<void> | void;
  emptyMessage?: string;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const url = pdfUrl ? String(pdfUrl).trim() : "";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateJobDescriptionPdf(file);
    if (err) {
      alert(err);
      return;
    }
    setUploading(true);
    try {
      const pid = partnerId || "admin-upload";
      const downloadUrl =
        uploadType === "event"
          ? await uploadEventAgendaPdf(pid, file, null)
          : await uploadJobDescriptionPdf(pid, file, null);
      if (onPdfChange) {
        await onPdfChange(downloadUrl);
      }
    } catch (error: any) {
      console.error("PDF upload failed:", error);
      alert(error?.message || "Failed to upload PDF.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (confirm(`Are you sure you want to remove the ${label}?`)) {
      if (onPdfChange) {
        await onPdfChange("");
      }
      setShowPreview(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {url && (
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium cursor-pointer"
          >
            {showPreview ? (
              <>
                <EyeOff className="w-3.5 h-3.5" /> Hide Preview
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> Inline Preview
              </>
            )}
          </button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf"
        className="hidden"
      />

      {url ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-100/70 transition-colors">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 min-w-0 flex-1 pr-2 group cursor-pointer"
              title="Click to open PDF in new tab"
            >
              <div className="w-9 h-9 rounded-md bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                  {label}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <span>Document attached</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-blue-600 font-medium group-hover:underline flex items-center gap-0.5">
                    Click to view <ExternalLink className="w-3 h-3 inline" />
                  </span>
                </p>
              </div>
            </a>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 px-2.5 bg-white text-xs shadow-sm border-slate-200 text-slate-700 hover:text-slate-900"
              >
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Open PDF
                </a>
              </Button>

              {onPdfChange && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-2.5 bg-white text-xs shadow-sm border-slate-200 text-slate-700 hover:text-slate-900"
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        Replace
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={uploading}
                    onClick={handleRemove}
                    className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    title="Remove PDF"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {showPreview && (
            <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-900 shadow-sm animate-in fade-in duration-200">
              <iframe
                src={`${url}#toolbar=1`}
                title={label}
                className="w-full h-96 bg-white"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs text-slate-500 italic">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>{emptyMessage}</span>
          </div>
          {onPdfChange && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 bg-white text-xs shadow-sm border-slate-200 text-slate-700 hover:text-slate-900"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Upload PDF
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function isPartnerAccountLog(log: any): boolean {
  const action = (log.action || "").toUpperCase();
  const category = (log.category || "").toLowerCase();
  const details = (log.details || "").toLowerCase();

  // Explicit exclusions: payment, billing, subscription, or listing actions
  if (
    action.startsWith("PAYMENT_") ||
    action.startsWith("SUBSCRIPTION_") ||
    action.startsWith("LISTING_") ||
    action.startsWith("PLAN_") ||
    action.startsWith("FEATURE_") ||
    action === "CATEGORY_DELETED" ||
    category === "billing" ||
    category === "listing" ||
    details.includes("listing status") ||
    details.includes("feature status") ||
    details.includes("feature upgraded") ||
    details.includes("plan upgraded") ||
    details.includes("subscription") ||
    details.includes("recurring invoice") ||
    details.includes("spotlight") ||
    details.includes("trial")
  ) {
    return false;
  }

  // Explicit inclusions: account actions or partner profile updates
  if (
    action === "ACCOUNT_CREATED" ||
    action === "ACCOUNT_UPDATED" ||
    action === "PROFILE_UPDATED" ||
    action === "PASSWORD_UPDATED" ||
    category === "account" ||
    category === "admin" ||
    details.includes("password") ||
    details.includes("logo") ||
    details.includes("company profile") ||
    details.includes("company name") ||
    details.includes("primary email") ||
    details.includes("primary contact") ||
    details.includes("company url") ||
    details.includes("business address") ||
    details.includes("business headquarters") ||
    details.includes("business id") ||
    details.includes("billing email") ||
    details.includes("alternate contact") ||
    details.includes("alternate email") ||
    details.includes("linkedin")
  ) {
    return true;
  }

  return false;
}

export type ListingAuditEventKind =
  | "subscription_purchased"
  | "subscription_upgraded"
  | "feature_added"
  | "feature_upgraded"
  | "plan_cancelled"
  | "feature_cancelled"
  | "feature_renewed"
  | "plan_renewed"
  | "payment_failed"
  | "payment_pending";

export interface NormalizedListingAuditRow {
  id: string;
  rawLog: any;
  timestampMs: number;
  dateTimeStr: string;
  partnerId: string;
  companyName: string;
  listingId: string;
  listingName: string;
  eventKind: ListingAuditEventKind;
  actionLabel: string;
  grpLabel: string;
  typeLabel: string;
  byLabel: "Partner" | "System" | "Stripe" | "Admin";
  detailsLabel: string;
  paymentStatusLabel: "Complete" | "Pending" | "Payment Failed" | "N/A";
  actionId: string;
}

function formatAuditGroupCode(rawGroupOrCollection?: string, planId?: string): string {
  const g = String(rawGroupOrCollection || "").toLowerCase().trim();
  const p = String(planId || "").toLowerCase().trim();
  if (
    g === "b" ||
    g === "business_offerings" ||
    g === "businessofferingscollection" ||
    g === "business" ||
    g === "business offering" ||
    g === "business offerings" ||
    p.includes("_bo_")
  ) {
    return "B";
  }
  if (
    g === "c" ||
    g === "consulting" ||
    g === "consulting_services" ||
    g === "consultingservicescollection" ||
    g === "consultingcollection" ||
    g === "consulting service" ||
    g === "consulting services" ||
    p.includes("_cs_")
  ) {
    return "C";
  }
  if (g === "job" || g === "jobs" || g === "jobscollection" || p.includes("_job")) {
    return "Job";
  }
  if (g === "event" || g === "events" || g === "eventscollection" || p.includes("_event")) {
    return "Event";
  }
  return "-";
}

function formatAuditFeatureType(featureId?: string): string {
  const f = String(featureId || "").toLowerCase().trim();
  if (!f || f === "none" || f === "-") return "-";
  if (f.includes("both")) return "Feature Both";
  if (f.includes("category")) return "Category Spotlight";
  if (f.includes("homepage")) return "Homepage Spotlight";
  return f
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAuditPlanType(planId?: string, grpCode?: string): string {
  const p = String(planId || "").toLowerCase().trim();
  if (!p || p === "none" || p === "-") return "-";

  const isYearly = p.includes("_yr") || p.includes("year") || p.includes("annual");
  const isMonthly = p.includes("_mo") || p.includes("month");
  const isJobOrEvent = grpCode === "Job" || grpCode === "Event" || p.includes("_job") || p.includes("_event");

  if (p.includes("premium_plus") || p.includes("premium plus")) {
    if (isYearly) return "PP Yearly";
    if (isMonthly && !isJobOrEvent) return "PP Monthly";
    return "Premium Plus";
  }
  if (p.includes("premium")) {
    if (isYearly) return "Premium Yearly";
    if (isMonthly && !isJobOrEvent) return "Premium Monthly";
    return "Premium";
  }
  if (p.includes("standard")) {
    if (isYearly) return "Standard Yearly";
    if (isMonthly && !isJobOrEvent) return "Standard Monthly";
    return "Standard";
  }
  if (p.includes("basic")) {
    if (isYearly) return "Basic Yearly";
    if (isMonthly && !isJobOrEvent) return "Basic Monthly";
    return "Basic";
  }
  return formatUserPlan(planId);
}

function formatShortTierAbbrev(planId?: string): string {
  const p = String(planId || "").toLowerCase().trim();
  if (p.includes("premium_plus") || p.includes("premium plus")) return "PP";
  if (p.includes("premium")) return "P";
  if (p.includes("standard")) return "S";
  if (p.includes("basic")) return "B";
  return "";
}

function formatUpgradeDetailsLabel(fromPlanId?: string, toPlanId?: string): string {
  const toP = String(toPlanId || "").toLowerCase().trim();
  const fromP = String(fromPlanId || "").toLowerCase().trim();
  const isYearly = toP.includes("_yr") || toP.includes("year");
  const isMonthly = toP.includes("_mo") || toP.includes("month") || toP.includes("_job") || toP.includes("_event");
  const intervalSuffix = isYearly ? "Yearly" : isMonthly ? "Monthly" : "";

  const fromShort = formatShortTierAbbrev(fromP);
  const toShort = formatShortTierAbbrev(toP);
  if (fromShort && toShort && fromShort !== toShort) {
    return `${fromShort} to ${toShort}${intervalSuffix ? ` ${intervalSuffix}` : ""}`;
  }
  if (toP) {
    return `Upgraded to ${formatAuditPlanType(toP)}`;
  }
  return "Plan upgrade";
}

function classifyListingAuditEventKind(log: any, listingStatusRaw?: string): ListingAuditEventKind | null {
  if (!log || isMemberAuditLog(log)) return null;
  const action = String(log.action || "").toUpperCase().trim();
  const details = String(log.details || "").toLowerCase();

  // Strictly exclude non-money, non-cancellation actions (profile edits, listing content edits, deletions, admin toggles)
  if (
    action === "LISTING_UPDATED" ||
    action === "LISTING_DELETED" ||
    action === "ACCOUNT_CREATED" ||
    action === "ACCOUNT_UPDATED" ||
    action === "PASSWORD_UPDATED" ||
    action === "CATEGORY_DELETED" ||
    action === "ADMIN_ACTION"
  ) {
    return null;
  }

  // 10. Payment Pending
  if (action === "PAYMENT_PENDING") {
    return "payment_pending";
  }

  // Legacy LISTING_CREATED: if listing is still pending_payment (checkout started & never finished), classify as Payment Pending;
  // otherwise if paid/admin-created, classify as Subscription Purchased.
  if (action === "LISTING_CREATED") {
    const lNorm = String(listingStatusRaw || log.metadata?.paymentStatus || "").toLowerCase().trim();
    if (lNorm === "pending_payment" || lNorm === "pending payment" || lNorm === "pending") {
      return "payment_pending";
    }
    return "subscription_purchased";
  }

  // 1. Listing / Subscription Purchased
  if (action === "SUBSCRIPTION_PURCHASED") {
    return "subscription_purchased";
  }

  // 2. Subscription Upgraded
  if (action === "PLAN_UPGRADED" || action === "SUBSCRIPTION_UPGRADED") {
    return "subscription_upgraded";
  }

  // 3. Feature Added
  if (action === "FEATURE_ADDED") {
    return "feature_added";
  }

  // 4. Feature Upgraded
  if (action === "FEATURE_UPGRADED") {
    return "feature_upgraded";
  }

  // 5 & 6. Plan Cancelled / Feature Cancelled
  if (action === "FEATURE_CANCELLED") {
    return "feature_cancelled";
  }
  if (action === "PLAN_CANCELLED" || action === "SUBSCRIPTION_CANCELLED") {
    if (log.metadata?.cancelScope === "feature" || details.includes("feature")) {
      return "feature_cancelled";
    }
    return "plan_cancelled";
  }

  // 7. Feature Renewed
  if (action === "FEATURE_RENEWED") {
    return "feature_renewed";
  }

  // 8. Plan Renewed
  if (action === "PLAN_RENEWED") {
    return "plan_renewed";
  }

  // 9. Payment Failed (Stripe)
  if (action === "PAYMENT_FAILED") {
    return "payment_failed";
  }

  // Legacy PAYMENT_SUCCESS classification
  if (action === "PAYMENT_SUCCESS") {
    const isFeature =
      Boolean(log.metadata?.featureId) ||
      log.metadata?.type === "feature" ||
      details.includes("spotlight");
    const isRenewal =
      log.metadata?.billingReason === "subscription_cycle" ||
      details.includes("recurring invoice") ||
      details.includes("subscription invoice");

    if (isFeature && isRenewal) return "feature_renewed";
    if (isFeature) return "feature_added";
    if (isRenewal) return "plan_renewed";
    return "subscription_purchased";
  }

  return null;
}

function isListingOrBillingLog(log: any): boolean {
  return classifyListingAuditEventKind(log) !== null;
}

function buildNormalizedListingAuditRows({
  auditLogs,
  partners,
  listings,
  partnerPlans,
  featuredPlans,
  transactions,
}: {
  auditLogs: any[];
  partners: PartnerRecord[];
  listings: ListingRecord[];
  partnerPlans: PartnerPlanRecord[];
  featuredPlans: FeaturedPlanPurchase[];
  transactions: any[];
}): NormalizedListingAuditRow[] {
  const partnerById = new Map<string, PartnerRecord>();
  partners.forEach((p) => partnerById.set(p.id, p));

  const listingById = new Map<string, ListingRecord>();
  const listingsByPartnerId = new Map<string, ListingRecord[]>();
  const listingBySubId = new Map<string, ListingRecord>();
  listings.forEach((l) => {
    listingById.set(l.id, l);
    const pid =
      l.partnerId ||
      (l.__path?.startsWith("partnersCollection/") ? l.__path.split("/")[1] : "");
    if (pid) {
      const arr = listingsByPartnerId.get(pid) || [];
      arr.push(l);
      listingsByPartnerId.set(pid, arr);
    }
    if ((l as any).stripeSubscriptionId) {
      listingBySubId.set(String((l as any).stripeSubscriptionId), l);
    }
    if ((l as any).featureSpotlightStripeSubscriptionId) {
      listingBySubId.set(String((l as any).featureSpotlightStripeSubscriptionId), l);
    }
  });

  const planById = new Map<string, PartnerPlanRecord>();
  const planBySubId = new Map<string, PartnerPlanRecord>();
  const plansByListingId = new Map<string, PartnerPlanRecord[]>();
  partnerPlans.forEach((p) => {
    planById.set(p.id, p);
    if (p.stripeSubscriptionId) {
      planBySubId.set(String(p.stripeSubscriptionId), p);
    }
    if (p.listingId) {
      const arr = plansByListingId.get(p.listingId) || [];
      arr.push(p);
      plansByListingId.set(p.listingId, arr);
    }
  });

  const featureBySubId = new Map<string, FeaturedPlanPurchase>();
  const featuresByListingId = new Map<string, FeaturedPlanPurchase[]>();
  featuredPlans.forEach((f) => {
    const subId = (f as any).stripeSubscriptionId;
    if (subId) {
      featureBySubId.set(String(subId), f);
    }
    if (f.listingId) {
      const arr = featuresByListingId.get(f.listingId) || [];
      arr.push(f);
      featuresByListingId.set(f.listingId, arr);
    }
  });

  const txnBySessionId = new Map<string, any>();
  const txnByInvoiceId = new Map<string, any>();
  transactions.forEach((t) => {
    if (t.sessionId) txnBySessionId.set(String(t.sessionId), t);
    if (t.invoiceId) txnByInvoiceId.set(String(t.invoiceId), t);
  });

  // Track which sessionIds already have a specific log (so legacy duplicate PAYMENT_SUCCESS for the same sessionId is skipped)
  const specificActionSessionIds = new Set<string>();
  const paidListingIdsWithPurchaseLog = new Set<string>();
  auditLogs.forEach((log) => {
    const action = String(log.action || "").toUpperCase();
    const sid = log.metadata?.sessionId ? String(log.metadata.sessionId) : "";
    if (
      sid &&
      (action === "SUBSCRIPTION_PURCHASED" ||
        action === "PLAN_UPGRADED" ||
        action === "SUBSCRIPTION_UPGRADED" ||
        action === "FEATURE_ADDED" ||
        action === "FEATURE_UPGRADED")
    ) {
      specificActionSessionIds.add(sid);
    }
    if (action === "SUBSCRIPTION_PURCHASED" || action === "PAYMENT_SUCCESS") {
      const txn = sid ? txnBySessionId.get(sid) : null;
      const lid = log.metadata?.listingId || txn?.listingId || "";
      if (lid && action === "SUBSCRIPTION_PURCHASED") {
        paidListingIdsWithPurchaseLog.add(String(lid));
      }
    }
  });

  const rows: NormalizedListingAuditRow[] = [];

  for (const log of auditLogs) {
    const rawAction = String(log.action || "").toUpperCase();
    const sid = log.metadata?.sessionId ? String(log.metadata.sessionId) : "";
    const invId = log.metadata?.invoiceId ? String(log.metadata.invoiceId) : "";
    const subId = log.metadata?.subscriptionId ? String(log.metadata.subscriptionId) : "";
    const planDocId = log.metadata?.planDocId ? String(log.metadata.planDocId) : "";

    // Skip duplicate legacy PAYMENT_SUCCESS when a specific action log exists for the same sessionId
    if (rawAction === "PAYMENT_SUCCESS" && sid && specificActionSessionIds.has(sid)) {
      continue;
    }

    const matchedTxn =
      (sid ? txnBySessionId.get(sid) : null) ||
      (invId ? txnByInvoiceId.get(invId) : null) ||
      null;
    const matchedPlan =
      (planDocId ? planById.get(planDocId) : null) ||
      (subId ? planBySubId.get(subId) : null) ||
      null;
    const matchedFeature = subId ? featureBySubId.get(subId) : null;

    let resolvedListingId: string =
      log.metadata?.listingId ||
      matchedTxn?.listingId ||
      matchedPlan?.listingId ||
      matchedFeature?.listingId ||
      "";

    let matchedListing: ListingRecord | undefined = resolvedListingId
      ? listingById.get(resolvedListingId)
      : subId
        ? listingBySubId.get(subId)
        : undefined;

    if (!matchedListing && log.partnerId) {
      const partnerListings = listingsByPartnerId.get(log.partnerId) || [];
      if (partnerListings.length === 1) {
        matchedListing = partnerListings[0];
        resolvedListingId = matchedListing.id;
      } else if (partnerListings.length > 1) {
        const targetPlan = log.metadata?.planId || log.metadata?.plan || matchedTxn?.planId || "";
        const byPlan = targetPlan
          ? partnerListings.find((l) => l.selectedPlan === targetPlan)
          : undefined;
        if (byPlan) {
          matchedListing = byPlan;
          resolvedListingId = byPlan.id;
        }
      }
    }

    if (matchedListing && !resolvedListingId) {
      resolvedListingId = matchedListing.id;
    }

    // If a listing was paid and already has a SUBSCRIPTION_PURCHASED row, skip the pre-checkout PAYMENT_PENDING / LISTING_CREATED row for that same initial purchase
    if (
      (rawAction === "PAYMENT_PENDING" || rawAction === "LISTING_CREATED") &&
      resolvedListingId &&
      matchedListing &&
      String(matchedListing.status || "").toLowerCase() !== "pending_payment" &&
      String(matchedListing.status || "").toLowerCase() !== "pending payment" &&
      paidListingIdsWithPurchaseLog.has(resolvedListingId)
    ) {
      continue;
    }

    const eventKind = classifyListingAuditEventKind(log, matchedListing?.status);
    if (!eventKind) continue;

    const partner = log.partnerId ? partnerById.get(log.partnerId) : undefined;
    const companyName =
      partner?.businessName ||
      matchedListing?.businessName ||
      (log.partnerName && log.partnerName !== "Unknown Partner" ? log.partnerName : "") ||
      "-";

    const rawMetaListingName = String(log.metadata?.listingName || "").trim();
    const isGenericGroupName = ["business offerings", "consulting", "consulting services", "events", "jobs"].includes(
      rawMetaListingName.toLowerCase(),
    );
    const listingName =
      (rawMetaListingName && !isGenericGroupName ? rawMetaListingName : "") ||
      matchedListing?.title ||
      matchedListing?.eventName ||
      matchedListing?.jobTitle ||
      matchedListing?.businessName ||
      companyName ||
      "-";

    const listingPlans = resolvedListingId ? plansByListingId.get(resolvedListingId) || [] : [];
    const listingFeatures = resolvedListingId ? featuresByListingId.get(resolvedListingId) || [] : [];
    const primaryListingPlan = matchedPlan || listingPlans[0] || null;
    const primaryListingFeature = matchedFeature || listingFeatures[0] || null;

    const resolvedPlanId =
      log.metadata?.planId ||
      log.metadata?.plan ||
      matchedTxn?.planId ||
      primaryListingPlan?.planId ||
      matchedListing?.selectedPlan ||
      "";
    const resolvedFeatureId =
      log.metadata?.featureId ||
      matchedTxn?.featureId ||
      primaryListingFeature?.featureId ||
      (matchedListing as any)?.selectedAddon ||
      (matchedListing as any)?.featuredPlacement ||
      "";

    const rawGroup =
      log.metadata?.group ||
      (log.metadata?.type !== "listing" && log.metadata?.type !== "feature" ? log.metadata?.type : "") ||
      matchedTxn?.group ||
      matchedListing?.selectedGroup ||
      matchedListing?.__col ||
      (primaryListingPlan as any)?.group ||
      primaryListingPlan?.collectionName ||
      "";
    const grpLabel = formatAuditGroupCode(rawGroup, resolvedPlanId);

    const isFeatureEvent =
      eventKind === "feature_added" ||
      eventKind === "feature_upgraded" ||
      eventKind === "feature_cancelled" ||
      eventKind === "feature_renewed" ||
      (eventKind === "payment_failed" && Boolean(resolvedFeatureId && !log.metadata?.planId));

    const typeLabel = isFeatureEvent
      ? formatAuditFeatureType(resolvedFeatureId)
      : formatAuditPlanType(resolvedPlanId, grpLabel);

    // Action column label (matching Slide 1 & Slide 2)
    let actionLabel = "Activity";
    switch (eventKind) {
      case "subscription_purchased":
        actionLabel = "New Listing";
        break;
      case "subscription_upgraded":
        actionLabel = "Upgrade";
        break;
      case "feature_added":
        actionLabel = "Feature Added";
        break;
      case "feature_upgraded":
        actionLabel = "Feature Upgrade";
        break;
      case "plan_cancelled":
        actionLabel = "Cancelled";
        break;
      case "feature_cancelled":
        actionLabel = "Feature Cancelled";
        break;
      case "feature_renewed":
        actionLabel = "Feature Renewed";
        break;
      case "plan_renewed":
        actionLabel = "Renewal";
        break;
      case "payment_failed":
        actionLabel = "Payment Failed";
        break;
      case "payment_pending":
        actionLabel = "Payment Pending";
        break;
    }

    // By column (Partner | System | Stripe | Admin)
    let byLabel: "Partner" | "System" | "Stripe" | "Admin" = "Partner";
    const perfRaw = String(log.performedBy || log.metadata?.performedBy || "").toLowerCase();
    if (eventKind === "payment_failed" || perfRaw === "stripe") {
      byLabel = "Stripe";
    } else if (
      perfRaw === "admin" ||
      Boolean(log.metadata?.adminEmail || log.metadata?.createdByAdmin) ||
      String(log.details || "").toLowerCase().includes("by admin")
    ) {
      byLabel = "Admin";
    } else if (
      eventKind === "plan_renewed" ||
      eventKind === "feature_renewed" ||
      perfRaw === "system"
    ) {
      byLabel = "System";
    } else {
      byLabel = "Partner";
    }

    // Details column (matching Slide 2)
    let detailsLabel = "N/A";
    switch (eventKind) {
      case "subscription_purchased":
        detailsLabel = "Initial Listing";
        break;
      case "subscription_upgraded":
        detailsLabel = formatUpgradeDetailsLabel(
          log.metadata?.fromPlanId || matchedTxn?.previousPlanId,
          resolvedPlanId,
        );
        break;
      case "feature_added":
        detailsLabel = "Feature added";
        break;
      case "feature_upgraded": {
        const prevFeat = log.metadata?.previousFeatureId || matchedTxn?.previousFeatureId;
        detailsLabel = prevFeat
          ? `${formatAuditFeatureType(prevFeat)} to ${formatAuditFeatureType(resolvedFeatureId)}`
          : "Feature upgrade";
        break;
      }
      case "plan_renewed":
        detailsLabel = "Plan renewals";
        break;
      case "feature_renewed":
        detailsLabel = "Feature renewals";
        break;
      case "plan_cancelled":
      case "feature_cancelled":
      case "payment_failed":
      case "payment_pending":
        detailsLabel = "N/A";
        break;
    }

    // Payment Status column (matching Slide 2: Complete | Pending | Payment Failed | N/A)
    let paymentStatusLabel: "Complete" | "Pending" | "Payment Failed" | "N/A" = "Complete";
    if (eventKind === "plan_cancelled" || eventKind === "feature_cancelled") {
      paymentStatusLabel = "N/A";
    } else if (eventKind === "payment_pending") {
      paymentStatusLabel = "Pending";
    } else if (eventKind === "payment_failed") {
      paymentStatusLabel = "Payment Failed";
    } else {
      paymentStatusLabel = "Complete";
    }

    const timestampMs = log.timestamp?.seconds
      ? log.timestamp.seconds * 1000
      : typeof log.timestamp?.toDate === "function"
        ? log.timestamp.toDate().getTime()
        : 0;
    const dateTimeStr = timestampMs ? new Date(timestampMs).toLocaleString() : "Recently";

    const actionId =
      sid ||
      invId ||
      subId ||
      log.id ||
      "-";

    rows.push({
      id: log.id || `${log.partnerId}-${timestampMs}-${eventKind}`,
      rawLog: log,
      timestampMs,
      dateTimeStr,
      partnerId: log.partnerId || "",
      companyName,
      listingId: resolvedListingId,
      listingName,
      eventKind,
      actionLabel,
      grpLabel,
      typeLabel,
      byLabel,
      detailsLabel,
      paymentStatusLabel,
      actionId,
    });
  }

  return rows;
}

function ListingAuditLogTable({
  rows,
  onSelectListing,
  activeListingFilter,
}: {
  rows: NormalizedListingAuditRow[];
  onSelectListing?: (listingId: string) => void;
  activeListingFilter?: string;
}) {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    pageItems,
    totalCount,
    startIndex,
    endIndex,
  } = useTablePagination(rows, 25);

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <History className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No listing audit trail entries found</h3>
        <p className="text-sm text-slate-500">
          Listing purchases, plan upgrades, feature additions/upgrades, renewals, pending/failed payments, and cancellations will appear here.
        </p>
      </div>
    );
  }

  const getListingActionBadge = (row: NormalizedListingAuditRow) => {
    switch (row.eventKind) {
      case "subscription_purchased":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">{row.actionLabel}</Badge>;
      case "subscription_upgraded":
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">{row.actionLabel}</Badge>;
      case "feature_added":
      case "feature_upgraded":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">{row.actionLabel}</Badge>;
      case "plan_cancelled":
      case "feature_cancelled":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">{row.actionLabel}</Badge>;
      case "plan_renewed":
      case "feature_renewed":
        return <Badge className="bg-teal-50 text-teal-700 border-teal-200">{row.actionLabel}</Badge>;
      case "payment_failed":
        return <Badge className="bg-red-50 text-red-700 border-red-200">{row.actionLabel}</Badge>;
      case "payment_pending":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">{row.actionLabel}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: NormalizedListingAuditRow["paymentStatusLabel"]) => {
    switch (status) {
      case "Complete":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Complete</Badge>;
      case "Pending":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
      case "Payment Failed":
        return <Badge className="bg-red-50 text-red-700 border-red-200">Payment Failed</Badge>;
      case "N/A":
      default:
        return <span className="text-xs font-medium text-slate-500">N/A</span>;
    }
  };

  const getByBadge = (by: NormalizedListingAuditRow["byLabel"]) => {
    if (by === "Stripe") {
      return <Badge className="bg-violet-50 text-violet-700 border-violet-200 font-medium text-xs">Stripe</Badge>;
    }
    if (by === "System") {
      return <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-medium text-xs">System</Badge>;
    }
    if (by === "Admin") {
      return <Badge className="bg-purple-50 text-purple-700 border-purple-200 font-medium text-xs">Admin</Badge>;
    }
    return <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-medium text-xs">Partner</Badge>;
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="max-h-[68vh] overflow-auto admin-table-scrollbar">
          <Table className="min-w-max">
            <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <TableRow className="bg-slate-50/95 hover:bg-slate-50/95">
                <TableHead className="pl-6">Date/Time</TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Listing Name</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Grp</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead className="text-right pr-6">Action ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((row) => {
                const isFilteredListing = Boolean(activeListingFilter && activeListingFilter !== "all" && row.listingId === activeListingFilter);
                return (
                  <TableRow key={row.id} className="hover:bg-slate-50/60">
                    <TableCell className="pl-6 text-sm text-slate-500 whitespace-nowrap">
                      {row.dateTimeStr}
                    </TableCell>
                    <TableCell className="font-semibold text-sm text-slate-900 whitespace-nowrap">
                      {row.companyName}
                    </TableCell>
                    <TableCell className="font-medium text-sm text-slate-800 whitespace-nowrap">
                      {row.listingId && onSelectListing ? (
                        <button
                          type="button"
                          onClick={() => onSelectListing(row.listingId)}
                          className={`text-left hover:underline cursor-pointer ${
                            isFilteredListing ? "text-blue-700 font-semibold" : "text-slate-800 hover:text-blue-600"
                          }`}
                          title="Click to filter audit trail for this listing"
                        >
                          {row.listingName}
                        </button>
                      ) : (
                        row.listingName
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getListingActionBadge(row)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className="font-semibold text-xs">
                        {row.grpLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-700 whitespace-nowrap">
                      {row.typeLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getByBadge(row.byLabel)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                      {row.detailsLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getPaymentStatusBadge(row.paymentStatusLabel)}
                    </TableCell>
                    <TableCell className="text-right pr-6 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {row.actionId}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <TablePaginationBar
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalCount={totalCount}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="entries"
        />
      </CardContent>
    </Card>
  );
}

function getPartnerAuditActor(log: any): { label: "Admin" | "Partner" | "System"; badgeClass: string } {
  const category = (log.category || "").toLowerCase();
  const details = (log.details || "").toLowerCase();
  const action = (log.action || "").toUpperCase();
  const hasAdminEmail = Boolean(log.metadata?.adminEmail || log.adminEmail);

  // 1. Admin actions (explicitly admin-triggered or containing admin email / admin details)
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

  // 2. Cancellations or modifications performed by partner
  if (
    action === "SUBSCRIPTION_CANCELLED" ||
    action === "PLAN_CANCELLED" ||
    action === "FEATURE_CANCELLED" ||
    details.includes("subscription cancelled") ||
    details.includes("cancellation processed")
  ) {
    return { label: "Partner", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" };
  }

  const perf = (log.performedBy || log.metadata?.performedBy || "").toLowerCase();
  if (perf === "admin") {
    return { label: "Admin", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" };
  }
  if (perf === "partner" || perf === "user") {
    return { label: "Partner", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (perf === "system" || perf === "stripe") {
    return { label: "System", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" };
  }

  // 3. Automatic transactions & billing events (Stripe, webhooks, renewals, auto-cancellations)
  if (
    action.startsWith("PAYMENT_") ||
    action === "PLAN_RENEWED" ||
    action === "FEATURE_RENEWED" ||
    category === "billing" ||
    details.includes("recurring invoice") ||
    details.includes("invoice in_") ||
    details.includes("subscription invoice") ||
    details.includes("auto-cancelled") ||
    details.includes("stripe")
  ) {
    return { label: "System", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" };
  }

  return { label: "Partner", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" };
}

function PartnerAuditLogList({ logs }: { logs: any[] }) {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    pageItems,
    totalCount,
    startIndex,
    endIndex,
  } = useTablePagination(logs, 25);

  if (logs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <History className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No partner audit logs found</h3>
        <p className="text-sm text-slate-500">Partner registrations, profile changes, listing actions, plan upgrades, and cancellations will appear here.</p>
      </div>
    );
  }

  const getActionBadge = (log: any) => {
    const action = (log.action || "").toUpperCase();
    const details = (log.details || "").toLowerCase();

    // 1. Password changed
    if (action === "PASSWORD_UPDATED" || action.includes("PASSWORD")) {
      return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Password Changed</Badge>;
    }

    // 2. Account created
    if (action === "ACCOUNT_CREATED" || action.includes("REGISTER")) {
      return <Badge className="bg-sky-50 text-sky-700 border-sky-200">Partner Account Created</Badge>;
    }

    // 3. Profile creation & profile field updates with explicit diffs
    if (action === "ACCOUNT_UPDATED" || action === "PROFILE_UPDATED") {
      if (details.includes("partner profile created") || log.metadata?.profileCreated) {
        return <Badge className="bg-sky-50 text-sky-700 border-sky-200">Profile Created</Badge>;
      }
      const changeCount = Array.isArray(log.metadata?.changes) ? log.metadata.changes.length : 0;
      if (changeCount <= 1) {
        if (details.includes("logo uploaded") || details.includes("logo updated")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Logo Updated</Badge>;
        }
        if (details.includes("logo removed")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Logo Removed</Badge>;
        }
        if (details.includes("company profile updated") || details.includes("company profile added") || details.includes("company profile cleared")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Company Profile Updated</Badge>;
        }
        if (details.includes("company name updated") || details.includes("company name changed")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Company Name Updated</Badge>;
        }
        if (details.includes("primary email changed")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Primary Email Changed</Badge>;
        }
        if (details.includes("primary contact changed")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Primary Contact Changed</Badge>;
        }
        if (details.includes("company url changed") || details.includes("website changed")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Company URL Changed</Badge>;
        }
        if (details.includes("business headquarters")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Headquarters Updated</Badge>;
        }
        if (details.includes("business address")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Business Address Updated</Badge>;
        }
        if (details.includes("business id")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Business ID Updated</Badge>;
        }
        if (details.includes("billing email")) {
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Billing Email Updated</Badge>;
        }
      }
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Profile Updated</Badge>;
    }

    // 4. Feature and Plan cancellations
    if (action === "FEATURE_CANCELLED" || (action === "SUBSCRIPTION_CANCELLED" && details.includes("feature"))) {
      return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Feature Cancelled</Badge>;
    }
    if (action === "PLAN_CANCELLED" || action === "SUBSCRIPTION_CANCELLED") {
      return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Plan Cancelled</Badge>;
    }

    // 5. Upgrades
    if (action === "FEATURE_UPGRADED") {
      return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Feature Upgraded</Badge>;
    }
    if (action === "PLAN_UPGRADED" || action === "SUBSCRIPTION_UPGRADED" || details.includes("upgraded")) {
      return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Subscription Upgraded</Badge>;
    }

    // 6. Add Feature
    if (action === "FEATURE_ADDED" || details.includes("feature spotlight")) {
      return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Feature Added</Badge>;
    }

    // 7. Renewals
    if (action === "FEATURE_RENEWED" || (details.includes("renewed") && details.includes("feature"))) {
      return <Badge className="bg-teal-50 text-teal-700 border-teal-200">Feature Renewed</Badge>;
    }
    if (action === "PLAN_RENEWED" || details.includes("plan renewed") || details.includes("subscription renewed")) {
      return <Badge className="bg-teal-50 text-teal-700 border-teal-200">Plan Renewed</Badge>;
    }

    // 8. Purchases & Payments
    if (action === "PAYMENT_SUCCESS" || action === "SUBSCRIPTION_PURCHASED") {
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Subscription Purchased</Badge>;
    }
    if (action === "PAYMENT_FAILED") {
      return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Payment Failed</Badge>;
    }
    if (action === "LISTING_CREATED") {
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Listing Created</Badge>;
    }
    if (action === "LISTING_UPDATED") {
      return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Listing Updated</Badge>;
    }
    if (action === "LISTING_DELETED") {
      return <Badge className="bg-slate-100 text-slate-700 border-slate-300">Listing Deleted</Badge>;
    }
    if (action === "ADMIN_ACTION") {
      return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Admin Action</Badge>;
    }

    return <Badge variant="outline">{action ? action.replace(/_/g, " ") : "Activity"}</Badge>;
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="max-h-[68vh] overflow-auto admin-table-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <TableRow className="bg-slate-50/95 hover:bg-slate-50/95">
                <TableHead className="pl-6">Timestamp</TableHead>
                <TableHead>Company / Partner</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right pr-6">Partner ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((log) => {
                const actor = getPartnerAuditActor(log);
                return (
                  <TableRow key={log.id} className="hover:bg-slate-50/50">
                    <TableCell className="pl-6 text-sm text-slate-500 whitespace-nowrap">
                      {log.timestamp?.seconds
                        ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                        : "Recently"}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      <div className="space-y-0.5 max-w-[200px]">
                        <p className="truncate text-sm text-slate-900 font-semibold">{log.partnerName || "Partner Account"}</p>
                        {log.metadata?.email || log.primaryEmail ? (
                          <p className="text-xs text-slate-500 truncate">{log.metadata?.email || log.primaryEmail}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{getActionBadge(log)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge className={`${actor.badgeClass} font-medium text-xs`}>
                        {actor.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 max-w-md break-words">{log.details}</TableCell>
                    <TableCell className="text-right pr-6 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {log.partnerId || "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <TablePaginationBar
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalCount={totalCount}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="logs"
        />
      </CardContent>
    </Card>
  );
}

function isMemberAuditLog(log: any): boolean {
  const action = (log.action || "").toUpperCase();
  const details = (log.details || "").toLowerCase();
  const category = (log.category || "").toLowerCase();
  const performedBy = (log.performedBy || log.metadata?.performedBy || "").toLowerCase();
  const role = (log.metadata?.role || "").toLowerCase();
  const scope = (log.metadata?.scope || "").toLowerCase();

  const isExplicitMemberContext =
    category === "community" ||
    performedBy === "member" ||
    role === "member" ||
    scope === "community_members" ||
    Boolean(log.memberId) ||
    Boolean(log.targetMember || log.metadata?.targetMember || log.metadata?.targetMemberId) ||
    details.includes("member");

  const isExplicitPartnerContext =
    performedBy === "partner" ||
    performedBy === "stripe" ||
    role === "partner" ||
    category === "billing" ||
    category === "listing" ||
    details.includes("partner account") ||
    details.includes("partner password") ||
    details.includes("partner profile") ||
    details.startsWith("partner ");

  if (isExplicitPartnerContext) {
    return false;
  }

  // Exactly the 5 items specified in requirements:
  // 1. Account created – Member
  if (action === "MEMBER_REGISTERED") return true;
  if (action === "ACCOUNT_CREATED" && isExplicitMemberContext) return true;

  // 2. Change in PW by who and when - Member
  if (
    isExplicitMemberContext &&
    (action === "PASSWORD_UPDATED" ||
      action === "PASSWORD_RESET" ||
      action === "PASSWORD_CHANGED" ||
      details.includes("password changed") ||
      details.includes("password reset"))
  ) {
    return true;
  }

  // 3. Account status changed – system/admin/ - by who and when
  if (action === "MEMBER_STATUS_CHANGED" || (isExplicitMemberContext && details.includes("account status changed"))) {
    return true;
  }

  // 4. Post reactivation - admin only - by who and when
  if (
    action === "POST_RESTORED" ||
    (action.includes("POST") && (details.includes("activated post") || details.includes("restored post")))
  ) {
    return true;
  }

  // 5. Comment reactivation - admin only - by who and when
  if (
    action === "COMMENT_ACTIVATED" ||
    (action.includes("COMMENT") && (details.includes("activated comment") || details.includes("restored comment")))
  ) {
    return true;
  }

  return false;
}

function getMemberAuditActor(log: any): { label: "Admin" | "Member" | "System"; badgeClass: string } {
  const category = (log.category || "").toLowerCase();
  const details = (log.details || "").toLowerCase();
  const action = (log.action || "").toUpperCase();
  const hasAdminEmail = Boolean(log.metadata?.adminEmail || log.adminEmail);

  if (
    category === "admin" ||
    hasAdminEmail ||
    details.includes("admin:") ||
    details.includes("by admin") ||
    details.includes("admin (") ||
    details.includes("admin deleted") ||
    details.includes("admin hold") ||
    action === "ADMIN_ACTION"
  ) {
    return { label: "Admin", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" };
  }

  const perf = (log.performedBy || log.metadata?.performedBy || "").toLowerCase();
  if (perf === "admin") {
    return { label: "Admin", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" };
  }
  if (perf === "system") {
    return { label: "System", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" };
  }

  return { label: "Member", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" };
}

function getMemberAuditSubject(log: any, actor: { label: string }): { name: string; email?: string; id?: string } {
  const details = (log.details || "").toLowerCase();
  const isAdmin = actor.label === "Admin";
  const nameStored = log.partnerName || log.memberName || "";
  const isSelfAdminStored = isAdmin && (nameStored.includes("admin@") || nameStored.toLowerCase() === "admin");

  if (isSelfAdminStored) {
    if (details.includes("post")) {
      return {
        name: "Community Post",
        email: log.metadata?.authorEmail,
        id: log.metadata?.postId || log.partnerId || log.memberId,
      };
    }
    if (details.includes("comment")) {
      return {
        name: "Community Comment",
        email: log.metadata?.authorEmail,
        id: log.metadata?.commentId || log.partnerId || log.memberId,
      };
    }
    if (log.targetMember || log.metadata?.targetMember) {
      return {
        name: log.targetMember || log.metadata?.targetMember,
        email: log.metadata?.email,
        id: log.metadata?.targetMemberId || log.partnerId || log.memberId,
      };
    }
  }

  return {
    name: nameStored || "Community Member",
    email: log.metadata?.email,
    id: log.partnerId || log.memberId || "",
  };
}

function MemberAuditLogList({ logs }: { logs: any[] }) {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    pageItems,
    totalCount,
    startIndex,
    endIndex,
  } = useTablePagination(logs, 25);

  if (logs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <History className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No member audit logs found</h3>
        <p className="text-sm text-slate-500">Member registrations, logins, community actions, and admin moderation events will appear here.</p>
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case "MEMBER_REGISTERED":
      case "ACCOUNT_CREATED":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Account Created</Badge>;
      case "PASSWORD_UPDATED":
      case "PASSWORD_RESET":
      case "PASSWORD_CHANGED":
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Password Changed</Badge>;
      case "MEMBER_STATUS_CHANGED":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Status Changed</Badge>;
      case "POST_RESTORED":
        return <Badge className="bg-teal-50 text-teal-700 border-teal-200">Post Reactivated</Badge>;
      case "COMMENT_ACTIVATED":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Comment Reactivated</Badge>;
      default:
        return <Badge variant="outline">{action ? action.replace(/_/g, " ") : "Activity"}</Badge>;
    }
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="max-h-[68vh] overflow-auto admin-table-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <TableRow className="bg-slate-50/95 hover:bg-slate-50/95">
                <TableHead className="pl-6">Timestamp</TableHead>
                <TableHead>Member / Target</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right pr-6">Member ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((log) => {
                const actor = getMemberAuditActor(log);
                const subject = getMemberAuditSubject(log, actor);
                return (
                  <TableRow key={log.id} className="hover:bg-slate-50/50">
                    <TableCell className="pl-6 text-sm text-slate-500 whitespace-nowrap">
                      {log.timestamp?.seconds
                        ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                        : "Recently"}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      <div className="space-y-0.5 max-w-[200px]">
                        <p className="truncate text-sm text-slate-900">{subject.name}</p>
                        {subject.email && (
                          <p className="text-xs text-slate-500 truncate">{subject.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{getActionBadge(log.action)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge className={`${actor.badgeClass} font-medium text-xs`}>
                        {actor.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 max-w-md break-words">{log.details}</TableCell>
                    <TableCell className="text-right pr-6 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {subject.id || log.partnerId || log.memberId || "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <TablePaginationBar
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalCount={totalCount}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="logs"
        />
      </CardContent>
    </Card>
  );
}

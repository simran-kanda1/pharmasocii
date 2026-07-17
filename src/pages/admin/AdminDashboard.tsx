import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Clock,
  Download,
  ExternalLink,
  Flag,
  Eye,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquare,
  MoreVertical,
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
} from "lucide-react";
import { db, auth, storage } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { onAuthStateChanged, signOut } from "firebase/auth";
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
import { BUSINESS_CATEGORIES, CONSULTING_CATEGORIES, EVENTS_CATEGORIES, JOBS_CATEGORIES, type SubcategoryEntry } from "../AllCategories";
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
import { AdminAddPlan } from "@/components/admin/AdminAddPlan";
import { AdminAddFeaturedPlan } from "@/components/admin/AdminAddFeaturedPlan";

type AdminTab =
  | "overview"
  | "partners"
  | "listings"
  | "plans"
  | "featuredPlans"
  | "categories"
  | "communityMembers"
  | "communityPosts"
  | "communityArchivePosts"
  | "communityReportedComments"
  | "communityCategories"
  | "emailLog"
  | "settings"
  | "transactions"
  | "audit";
type ListingFilter = "all" | "pending" | "approved" | "disabled";
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

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const SERVICE_REGIONS = [
  "North America", "South America", "Europe", "Asia Pacific",
  "Middle East", "Africa", "Australia & Oceania",
];

const SERVICE_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia",
  "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Georgia", "Germany", "Ghana", "Greece", "Guatemala", "Guyana",
  "Haiti", "Honduras", "Hong Kong", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Korea", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Liberia", "Libya", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Mauritius",
  "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Norway",
  "Oman",
  "Pakistan", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saudi Arabia", "Senegal", "Serbia", "Sierra Leone", "Singapore", "Slovak Republic", "Slovenia",
  "Somalia", "South Africa", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tanzania", "Thailand", "Togo", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "UAE", "Uganda", "UK", "Ukraine", "United States", "Uruguay", "Uzbekistan",
  "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe",
];

const BSL_LEVELS = ["1", "2", "3", "4"];
const CERTIFICATIONS = ["GMP", "CE", "ISO 13485", "ISO 9001", "Others"];

function MultiSelectDropdown({
  label,
  items,
  selected,
  onToggle,
  placeholder,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  placeholder?: string;
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
      <p className="text-sm font-medium text-slate-700">{label}</p>
      
      {/* Selector Box */}
      <div
        onClick={() => setOpen(!open)}
        className="flex min-h-[40px] w-full items-center justify-between gap-2 flex-wrap rounded-md border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer hover:border-slate-300 transition-colors"
      >
        <div className="flex flex-wrap gap-1 items-center">
          {selected.length === 0 ? (
            <span className="text-slate-400">{placeholder || `Select ${label.toLowerCase()}...`}</span>
          ) : (
            selected.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-100"
              >
                {item}
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
              </span>
            ))
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
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
}) {
  const [open, setOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [expandedSubs, setExpandedSubs] = useState<string[]>([]);

  const catDict = useMemo(() => {
    const gk = (selectedGroup || "").toLowerCase().replace(" ", "_");
    if (gk === "business_offerings" || gk === "business") {
      return BUSINESS_CATEGORIES;
    } else if (gk === "consulting_services" || gk === "consulting") {
      return CONSULTING_CATEGORIES;
    } else if (gk === "events") {
      return EVENTS_CATEGORIES;
    } else if (gk === "jobs") {
      return JOBS_CATEGORIES;
    }
    return null;
  }, [selectedGroup]);

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

  const toggleSubcategorySelection = (sub: string, hasSubSubs: boolean) => {
    if (hasSubSubs) {
      setExpandedSubs((prev) =>
        prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
      );
    } else {
      const current = [...selectedSubcategories];
      const updated = current.includes(sub)
        ? current.filter((s) => s !== sub)
        : [...current, sub];
      onChange({
        selectedCategories,
        selectedSubcategories: updated,
        selectedSubSubcategories,
      });
    }
  };

  const toggleSubSubcategorySelection = (subSub: string) => {
    const current = [...selectedSubSubcategories];
    const updated = current.includes(subSub)
      ? current.filter((ss) => ss !== subSub)
      : [...current, subSub];
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
        onClick={() => setOpen(!open)}
        className="flex min-h-[40px] w-full items-center justify-between gap-2 flex-wrap rounded-md border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer hover:border-slate-300 transition-colors"
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
                </span>
              ))}
              {selectedSubcategories.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded border border-green-100 animate-fadeIn"
                >
                  {s}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSubcategorySelection(s, false);
                    }}
                    className="hover:bg-green-100 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedSubSubcategories.map((ss) => (
                <span
                  key={ss}
                  className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded border border-purple-100 animate-fadeIn"
                >
                  {ss}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSubSubcategorySelection(ss);
                    }}
                    className="hover:bg-purple-100 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
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
                        checked={hasSubs ? isExpanded : isParentSelected}
                        onCheckedChange={() => toggleCategorySelection(cat, hasSubs)}
                        className={hasSubs && isExpanded ? "border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" : ""}
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

                  {/* Subcategories (Indented) */}
                  {hasSubs && isExpanded && (
                    <div className="ml-8 pl-3 border-l-2 border-green-500/30 space-y-1 mb-2">
                      {subs.map((entry: SubcategoryEntry) => {
                        const subLabel = getSubLabel(entry);
                        const isNested = isBusinessGroup && hasSubSub(entry);
                        const isSubChecked = selectedSubcategories.includes(subLabel);
                        const isSubExpanded = expandedSubs.includes(subLabel);

                        return (
                          <div key={subLabel} className="flex flex-col">
                            {/* Subcategory Row */}
                            <div className="flex items-center gap-1.5 py-0.5">
                              {isNested ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSubcategorySelection(subLabel, true);
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
                                onCheckedChange={() => toggleSubcategorySelection(subLabel, isNested)}
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
                                  const isSsChecked = selectedSubSubcategories.includes(ssLabel);
                                  return (
                                    <div key={ssLabel} className="flex items-center gap-2 py-0.5">
                                      <Checkbox
                                        id={`admin-ssub-${cat}-${subLabel}-${ssLabel}`}
                                        checked={isSsChecked}
                                        onCheckedChange={() => toggleSubSubcategorySelection(ssLabel)}
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
  switch (status) {
    case "Approved":
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Approved</Badge>;
    case "Pending Review":
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>;
    case "Disabled":
      return <Badge className="bg-slate-200 text-slate-700 border-slate-300">Disabled</Badge>;
    case "Cancelled":
      return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Cancelled</Badge>;
    case "Extended":
      return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Extended</Badge>;
    default:
      return <Badge variant="outline">{status || "Unknown"}</Badge>;
  }
};

const PLAN_LIMITS: Record<string, { maxCategories: number; maxCountries: number }> = {
  basic_mo: { maxCategories: 3, maxCountries: 1 },
  standard_mo: { maxCategories: 5, maxCountries: 3 },
  premium_mo: { maxCategories: 15, maxCountries: 15 },
  premium_plus_mo: { maxCategories: -1, maxCountries: -1 },
  basic_yr: { maxCategories: 3, maxCountries: 1 },
  standard_yr: { maxCategories: 5, maxCountries: 3 },
  premium_yr: { maxCategories: 15, maxCountries: 15 },
  premium_plus_yr: { maxCategories: -1, maxCountries: -1 },
  basic_event: { maxCategories: -1, maxCountries: -1 },
  standard_event: { maxCategories: -1, maxCountries: -1 },
  premium_event: { maxCategories: -1, maxCountries: -1 },
  premium_plus_event: { maxCategories: -1, maxCountries: -1 },
  standard_job: { maxCategories: -1, maxCountries: -1 },
  premium_job: { maxCategories: -1, maxCountries: -1 },
  premium_plus_job: { maxCategories: -1, maxCountries: -1 },
};

const AVAILABLE_PLANS: Array<{
  service: string;
  planId: string;
  label: string;
  priceUsd: number;
  billing: string;
}> = [
  { service: "Business Offerings / Consulting", planId: "basic_mo", label: "Basic (Monthly)", priceUsd: 100, billing: "Monthly" },
  { service: "Business Offerings / Consulting", planId: "standard_mo", label: "Standard (Monthly)", priceUsd: 200, billing: "Monthly" },
  { service: "Business Offerings / Consulting", planId: "premium_mo", label: "Premium (Monthly)", priceUsd: 400, billing: "Monthly" },
  { service: "Business Offerings / Consulting", planId: "premium_plus_mo", label: "Premium Plus (Monthly)", priceUsd: 1000, billing: "Monthly" },
  { service: "Business Offerings / Consulting", planId: "basic_yr", label: "Basic (Annual)", priceUsd: 1080, billing: "Yearly" },
  { service: "Business Offerings / Consulting", planId: "standard_yr", label: "Standard (Annual)", priceUsd: 2184, billing: "Yearly" },
  { service: "Business Offerings / Consulting", planId: "premium_yr", label: "Premium (Annual)", priceUsd: 4320, billing: "Yearly" },
  { service: "Business Offerings / Consulting", planId: "premium_plus_yr", label: "Premium Plus (Annual)", priceUsd: 10800, billing: "Yearly" },
  { service: "Events", planId: "basic_event", label: "Basic Event", priceUsd: 500, billing: "Monthly" },
  { service: "Events", planId: "standard_event", label: "Standard Event", priceUsd: 850, billing: "Monthly" },
  { service: "Events", planId: "premium_event", label: "Premium Event", priceUsd: 1250, billing: "Monthly" },
  { service: "Events", planId: "premium_plus_event", label: "Premium Plus Event", priceUsd: 1450, billing: "Monthly" },
  { service: "Jobs", planId: "standard_job", label: "Standard Job Listing", priceUsd: 400, billing: "Monthly" },
  { service: "Jobs", planId: "premium_job", label: "Premium Job Listing", priceUsd: 800, billing: "Monthly" },
  { service: "Jobs", planId: "premium_plus_job", label: "Premium Plus Job Listing", priceUsd: 1000, billing: "Monthly" },
];

const FEATURED_PLAN_CATALOG = [
  {
    service: "Business Offerings & Consulting Services",
    options: [
      { id: "home_page", label: "Home Page", price: 1000, durationDays: 30, countryLimit: 1, categoryLimit: 2, specification: "Home page" },
      { id: "landing_page", label: "Landing Page", price: 700, durationDays: 30, countryLimit: 5, categoryLimit: 5, specification: "This is feature plan" },
      { id: "both", label: "Both Page", price: 1500, durationDays: 30, countryLimit: 5, categoryLimit: 2, specification: "Both plan" },
    ],
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [partnerPlans, setPartnerPlans] = useState<PartnerPlanRecord[]>([]);
  const [featuredPlans, setFeaturedPlans] = useState<FeaturedPlanPurchase[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [listingSearchTerm, setListingSearchTerm] = useState("");
  const [listingFilter, setListingFilter] = useState<ListingFilter>("all");
  const [isAddingPartner, setIsAddingPartner] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [isAddingFeaturedPlan, setIsAddingFeaturedPlan] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState("");
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
  const [listingEditor, setListingEditor] = useState<Record<string, string>>({});
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
    try {
      const payload: Record<string, any> = {
        // Primary Info
        firstName: partnerEditor.firstName || "",
        lastName: partnerEditor.lastName || "",
        primaryName: partnerEditor.primaryName || "",
        primaryEmail: partnerEditor.primaryEmail || "",
        phoneNumber: partnerEditor.phoneNumber || "",
        
        // Company Info
        businessName: partnerEditor.businessName || "",
        companyName: partnerEditor.businessName || "", // sync companyName just in case
        companyWebsite: partnerEditor.companyWebsite || "",
        businessPhone: partnerEditor.businessPhone || "",
        linkedinProfile: partnerEditor.linkedinProfile || "",
        businessAddress: partnerEditor.businessAddress || "",
        addressHtml: partnerEditor.businessAddress || "", // sync addressHtml
        businessCountry: partnerEditor.businessCountry || "",
        companyProfileText: partnerEditor.companyProfileText || "",
        profileHtml: partnerEditor.companyProfileText || "", // sync profileHtml
        
        // Billing & Admin
        partnerStatus: partnerEditor.partnerStatus || "Pending",
        status: partnerEditor.partnerStatus || "Pending", // sync status
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
        certifications: partnerEditor.certifications || [],
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

      await updateDoc(doc(db, "partnersCollection", selectedPartner.id), payload);
      setPartners((prev) =>
        prev.map((p) => (p.id === selectedPartner.id ? { ...p, ...payload } : p)),
      );

      // Log to Audit Trail
      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: payload.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Profile updated by admin: ${payload.businessName} (Contact: ${payload.primaryName}). Admin: ${adminEmail}`,
        category: "admin",
        metadata: { adminEmail, updatedFields: payload }
      });

      setSaveNotice("Partner profile updated.");
      setPartnerEditorOpen(false);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update partner profile.");
    }
  };

  const extendTrial = async (days: number) => {
    if (!selectedPartner) return;
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
          await updateDoc(listingRef, { status: "Extended" });
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
        metadata: { adminEmail, extendedDays: days, newExpiryDate: newEnd }
      });

    } catch (err: any) {
      console.error("Error extending trial:", err);
      alert("Failed to extend trial: " + err.message);
    }
  };

  const undoExtension = async () => {
    if (!selectedPartner || lastTrialEndMs === null) return;
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
        metadata: { adminEmail, revertedTo: previousEnd }
      });

      setLastTrialEndMs(null);
    } catch (err: any) {
      console.error("Error undoing extension:", err);
      alert("Failed to undo: " + err.message);
    }
  };

  const cancelTrial = async () => {
    if (!selectedPartner) return;
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
        metadata: { adminEmail, cancelledAt: new Date() }
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
        metadata: { adminEmail, newStatus: status }
      });

      setSaveNotice(`Partner status set to ${status}.`);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update partner status.");
    }
  };

  const openListingEditor = (listing: ListingRecord) => {
    setSelectedListing(listing);
    setListingEditor({
      // Core
      businessName: listing.businessName || "",
      companyWebsite: listing.companyWebsite || "",
      selectedPlan: listing.selectedPlan || "",
      selectedGroup: listing.selectedGroup || "",
      status: listing.status || "Pending Review",
      active: `${listing.active ?? true}`,
      // Taxonomy
      selectedCategoriesCsv: (listing.selectedCategories || []).join(", "),
      selectedSubcategoriesCsv: (listing.selectedSubcategories || []).join(", "),
      selectedSubSubcategoriesCsv: (listing.selectedSubSubcategories || []).join(", "),
      serviceCountriesCsv: (listing.serviceCountries || []).join(", "),
      serviceRegionsCsv: (listing.serviceRegions || []).join(", "),
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
      // Extract partnerId from path: partnersCollection/{partnerId}/{collectionName}/{listingId}
      const partnerId = listing.__path.split('/')[1];

      await logActivity({
        partnerId,
        partnerName: listing.businessName || "Unnamed Business",
        action: "LISTING_UPDATED",
        details: `Listing status for "${listing.businessName}" set to "${status}" (Active: ${active}). Updated by admin: ${adminEmail}`,
        category: "admin",
        metadata: { adminEmail, status, active, listingId: listing.id }
      });

      setSaveNotice(`Listing updated: ${status}.`);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update listing status.");
    }
  };

  const saveListingEdits = async () => {
    if (!selectedListing) return;
    try {
      const payload: Record<string, any> = {
        // Core
        businessName: listingEditor.businessName || "",
        companyWebsite: listingEditor.companyWebsite || "",
        selectedPlan: listingEditor.selectedPlan || "",
        selectedGroup: listingEditor.selectedGroup || "",
        status: listingEditor.status || "Pending Review",
        active: listingEditor.active === "true",
        // Taxonomy
        selectedCategories: splitCsv(listingEditor.selectedCategoriesCsv || ""),
        selectedSubcategories: splitCsv(listingEditor.selectedSubcategoriesCsv || ""),
        selectedSubSubcategories: splitCsv(listingEditor.selectedSubSubcategoriesCsv || ""),
        serviceCountries: splitCsv(listingEditor.serviceCountriesCsv || ""),
        serviceRegions: splitCsv(listingEditor.serviceRegionsCsv || ""),
        // Business/Consulting
        companyProfileText: (listingEditor.companyProfileText || "").slice(0, COMPANY_PROFILE_MAX_LENGTH),
        businessAddress: listingEditor.businessAddress || "",
        businessCountry: listingEditor.businessCountry || "",
        bioSafetyLevel: splitCsv(listingEditor.bioSafetyLevelCsv || ""),
        certifications: splitCsv(listingEditor.certificationsCsv || ""),
        companyRepresentatives: (() => {
          try { return listingEditor.companyRepresentativesJson ? JSON.parse(listingEditor.companyRepresentativesJson) : []; }
          catch { return []; }
        })(),
        // Event fields
        eventName: listingEditor.eventName || "",
        eventLink: listingEditor.eventLink || "",
        startDate: listingEditor.startDate || "",
        endDate: listingEditor.endDate || "",
        eventCountry: listingEditor.eventCountry || "",
        stateRegion: listingEditor.stateRegion || listingEditor.jobStateRegion || "",
        city: listingEditor.city || listingEditor.jobCity || "",
        location: listingEditor.location || listingEditor.jobLocation || "",
        eventProfile: listingEditor.eventProfile || "",
        agendaHighlights: listingEditor.agendaHighlights || "",
        agendaPdfUrl: listingEditor.agendaPdfUrl || "",
        // Job fields
        jobTitle: listingEditor.jobTitle || "",
        industry: listingEditor.industry || "",
        positionType: listingEditor.positionType || "",
        experienceLevel: listingEditor.experienceLevel || "",
        positionLink: listingEditor.positionLink || "",
        jobCountry: listingEditor.jobCountry || "",
        jobSummary: listingEditor.jobSummary || "",
        education: listingEditor.education || "",
        workModel: listingEditor.workModel || "",
        applicationDeadline: listingEditor.applicationDeadline || "",
        jobDescriptionPdfUrl: listingEditor.jobDescriptionPdfUrl || "",
        companyWebsiteLink: listingEditor.companyWebsiteLink || "",
        linkedInJob: listingEditor.linkedInJob || "",
      };

      await updateDoc(doc(db, selectedListing.__path), payload);

      setListings((prev) =>
        prev.map((l) => (l.__path === selectedListing.__path ? { ...l, ...payload } : l)),
      );

      // Log to Audit Trail
      const partnerId = selectedListing.__path.split('/')[1];
      await logActivity({
        partnerId,
        partnerName: payload.businessName || "Unnamed Business",
        action: "LISTING_UPDATED",
        details: `Listing details for "${payload.businessName}" updated by admin (${adminEmail}).`,
        category: "admin",
        metadata: { adminEmail, listingId: selectedListing.id, updatedFields: payload }
      });

      setSaveNotice("Listing updated.");
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not save listing changes.");
    }
  };

  const filteredPartners = useMemo(
    () =>
      partners.filter(
        (p) =>
          p.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.primaryEmail?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [partners, searchTerm],
  );

  const pendingListings = listings.filter((l) => l.status === "Pending Review");
  const approvedListings = listings.filter((l) => l.status === "Approved");
  const disabledListings = listings.filter((l) => l.status === "Disabled");

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

      acc[partner.id] = {
        latestPlan: latestPlan?.planName || latestPlan?.planId || "-",
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

      acc[listing.id] = {
        subscribedOn: (plan as any)?.startDate || plan?.createdAt || null,
        upgradedOn: (plan as any)?.upgradedAt || null,
        cancelledOn: (plan as any)?.cancelAt || (plan as any)?.canceledAt || null,
        expiryDate: (plan as any)?.billingPeriodEnd || null,
        isFeatured: listing.isFeatured || feature?.active || !!feature,
        featurePlan: (feature as any)?.featureName || feature?.featureId || "-",
        featureDate: feature?.createdAt || listing.lastFeaturePaymentReceivedAt || (feature as any)?.lastPaymentReceived || null,
        featureCancelDate: (feature as any)?.accessThrough || (feature as any)?.cancelAt || null,
        resubmitted: "-",
      };
      return acc;
    }, {} as Record<string, any>);
  }, [listings, partnerPlans, featuredPlans]);

  const categoryRows = useMemo(() => {
    const sources = [
      { group: "Business Offerings", data: BUSINESS_CATEGORIES },
      { group: "Consulting Services", data: CONSULTING_CATEGORIES },
      { group: "Events", data: EVENTS_CATEGORIES },
      { group: "Jobs", data: JOBS_CATEGORIES },
    ];
    const rows: Array<{ group: string; category: string; subcategory: string; subSubcategory: string }> = [];

    sources.forEach(({ group, data }) => {
      Object.entries(data).forEach(([category, subEntries]) => {
        if (!Array.isArray(subEntries) || subEntries.length === 0) {
          rows.push({ group, category, subcategory: "-", subSubcategory: "-" });
          return;
        }

        subEntries.forEach((sub: any) => {
          if (typeof sub === "string") {
            rows.push({ group, category, subcategory: sub, subSubcategory: "-" });
            return;
          }
          rows.push({
            group,
            category,
            subcategory: sub.label || "-",
            subSubcategory:
              Array.isArray(sub.subSubcategories) && sub.subSubcategories.length > 0
                ? sub.subSubcategories.join(", ")
                : "-",
          });
        });
      });
    });

    return rows;
  }, []);

  const filteredCategoryRows = useMemo(() => {
    if (!categorySearch.trim()) return categoryRows;
    const q = categorySearch.toLowerCase();
    return categoryRows.filter(
      (row) =>
        row.group.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        row.subcategory.toLowerCase().includes(q) ||
        row.subSubcategory.toLowerCase().includes(q),
    );
  }, [categoryRows, categorySearch]);

  const exportPartners = (format: "csv" | "excel") => {
    const headers = [
      "Business Name",
      "Primary Contact",
      "Email",
      "Phone",
      "Website",
      "Address",
      "Status",
      "Latest Plan",
      "Listings",
      "Featured",
    ];

    const rows = filteredPartners.map((partner) => {
      const insight = partnerInsights[partner.id];
      return [
        partner.businessName || "",
        partner.primaryName || "",
        partner.primaryEmail || "",
        partner.phoneNumber || "",
        partner.companyWebsite || "",
        partner.businessAddress || "",
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

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (listingFilter === "pending" && l.status !== "Pending Review") return false;
      if (listingFilter === "approved" && l.status !== "Approved") return false;
      if (listingFilter === "disabled" && l.status !== "Disabled") return false;

      if (!listingSearchTerm) return true;

      const q = listingSearchTerm.toLowerCase();
      return (
        l.businessName?.toLowerCase().includes(q) ||
        l.selectedCategories?.some((c) => c.toLowerCase().includes(q)) ||
        l.selectedPlan?.toLowerCase().includes(q)
      );
    });
  }, [listingFilter, listingSearchTerm, listings]);

  const stats = {
    totalRevenue: transactions.reduce((acc, t) => acc + (t.amount || 0), 0),
    totalPartners: partners.length,
    pendingApprovals: partners.filter((p) => p.partnerStatus === "Pending").length,
    pendingListings: pendingListings.length,
    activeListings: approvedListings.length,
  };

  const activeTabLabelMap: Record<AdminTab, string> = {
    overview: "Overview",
    partners: "Partners",
    listings: "Listings",
    plans: "Plans",
    featuredPlans: "Featured Plans",
    categories: "Categories",
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
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 h-full">
        <div className="px-7 pt-7 pb-4 shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <h1 className="font-semibold text-lg">Admin Console</h1>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-7 py-4 space-y-1.5 custom-scrollbar">
            <SidebarItem label="Overview" icon={LayoutDashboard} active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <SidebarItem label="Partners" icon={Users} active={activeTab === "partners"} onClick={() => setActiveTab("partners")} badge={stats.pendingApprovals > 0 ? stats.pendingApprovals : undefined} />
            <SidebarItem label="Listings" icon={FileText} active={activeTab === "listings"} onClick={() => setActiveTab("listings")} badge={stats.pendingListings > 0 ? stats.pendingListings : undefined} />
            <SidebarItem label="Plans" icon={Tags} active={activeTab === "plans"} onClick={() => setActiveTab("plans")} />
            <SidebarItem label="Featured Plans" icon={Sparkles} active={activeTab === "featuredPlans"} onClick={() => setActiveTab("featuredPlans")} />
            <SidebarItem label="Categories" icon={FileText} active={activeTab === "categories"} onClick={() => setActiveTab("categories")} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 pt-4 pb-1">Community</p>
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

        <div className="shrink-0 p-5 border-t border-slate-200 space-y-2 bg-white">
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full justify-start text-slate-600">
            <ExternalLink className="w-4 h-4 mr-2" /> Back to site
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50">
            <LogOut className="w-4 h-4 mr-2" /> Logout
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
                onApproveListing={(listing: ListingRecord) => setListingStatus(listing, "Approved", true)}
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
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search partners by business or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-11 bg-white border-slate-200"
                    />
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
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search listings by business, category, or plan..."
                    value={listingSearchTerm}
                    onChange={(e) => setListingSearchTerm(e.target.value)}
                    className="pl-10 h-11 bg-white border-slate-200"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button variant={listingFilter === "all" ? "default" : "outline"} onClick={() => setListingFilter("all")}>
                    All ({listings.length})
                  </Button>
                  <Button variant={listingFilter === "approved" ? "default" : "outline"} onClick={() => setListingFilter("approved")}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approved ({approvedListings.length})
                  </Button>
                  <Button variant={listingFilter === "disabled" ? "default" : "outline"} onClick={() => setListingFilter("disabled")}>
                    <Ban className="w-4 h-4 mr-2" /> Disabled ({disabledListings.length})
                  </Button>
                </div>
              </div>

              <ListingsList
                listings={filteredListings}
                listingInsights={listingInsights}
                onView={openListingEditor}
                onSetStatus={setListingStatus}
              />
            </div>
          )}

          {activeTab === "transactions" && <TransactionList transactions={transactions} />}

          {activeTab === "plans" && (
            isAddingPlan ? (
              <AdminAddPlan 
                onCancel={() => setIsAddingPlan(false)}
                onSuccess={() => {
                  setIsAddingPlan(false);
                  setSaveNotice("Plan added successfully!");
                  setTimeout(() => setSaveNotice(""), 5000);
                }}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => setIsAddingPlan(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Add Plan <Plus className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <PlansCatalogTab />
              </div>
            )
          )}

          {activeTab === "featuredPlans" && (
            isAddingFeaturedPlan ? (
              <AdminAddFeaturedPlan 
                onCancel={() => setIsAddingFeaturedPlan(false)}
                onSuccess={() => {
                  setIsAddingFeaturedPlan(false);
                  setSaveNotice("Featured plan added successfully!");
                  setTimeout(() => setSaveNotice(""), 5000);
                }}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => setIsAddingFeaturedPlan(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Add Featured Plan <Plus className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <FeaturedPlansTab featuredPlans={featuredPlans} partners={partners} />
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
                      className="pl-10 h-11 bg-white border-slate-200"
                    />
                  </div>
                  <Button onClick={() => setIsAddingCategory(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Add Category <Plus className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <CategoryBreakdownTable rows={filteredCategoryRows} />
              </div>
            )
          )}

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
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search audit logs by company name..."
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white border-slate-200"
                />
              </div>
              <AuditLogList
                logs={auditLogs.filter(log => {
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
                setAuditSearchTerm(selectedPartner?.id || "");
                setPartnerEditorOpen(false);
              }}
            >
              <History className="w-4 h-4" />
              View History
            </Button>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* Section 1: Account Status & Plan */}
            <div className="border-b pb-2 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Account Status & Plan</h3>
            </div>

            <Field label="Selected Group (business_offerings, consulting, events, jobs)" value={partnerEditor.selectedGroup || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, selectedGroup: v }))} />
            <Field label="Selected Plan" value={partnerEditor.selectedPlan || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, selectedPlan: v }))} />

            {selectedPartner && partnerInsights[selectedPartner.id]?.trialInfo && (() => {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const trial = partnerInsights[selectedPartner.id].trialInfo!;
              return (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trial Period Status</span>
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" value={partnerEditor.firstName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, firstName: v }))} />
              <Field label="Last Name" value={partnerEditor.lastName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, lastName: v }))} />
            </div>
            <Field label="Primary Contact Name" value={partnerEditor.primaryName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, primaryName: v }))} />
            <Field label="Primary Email" value={partnerEditor.primaryEmail || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, primaryEmail: v }))} />
            <Field label="Phone Number" value={partnerEditor.phoneNumber || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, phoneNumber: v }))} />

            {/* Section 3: Company Details */}
            <div className="border-b pb-2 pt-4 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Company Details</h3>
            </div>
            <Field label="Business Name" value={partnerEditor.businessName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, businessName: v }))} />
            <Field label="Company Website" value={partnerEditor.companyWebsite || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, companyWebsite: v }))} />
            <Field label="Business Phone" value={partnerEditor.businessPhone || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, businessPhone: v }))} />
            <Field label="LinkedIn Profile" value={partnerEditor.linkedinProfile || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, linkedinProfile: v }))} />
            <Field label="Business Country" value={partnerEditor.businessCountry || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, businessCountry: v }))} />
            <div className="space-y-1">
              <p className="text-sm font-medium">Business Address</p>
              <Textarea
                value={partnerEditor.businessAddress || ""}
                onChange={(e) => setPartnerEditor((prev) => ({ ...prev, businessAddress: e.target.value }))}
                className="min-h-20"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Company Profile Description</p>
              <Textarea
                value={partnerEditor.companyProfileText || ""}
                onChange={(e) => setPartnerEditor((prev) => ({ ...prev, companyProfileText: e.target.value }))}
                className="min-h-20"
              />
            </div>

            {/* Section 4: Billing & Registration */}
            <div className="border-b pb-2 pt-4 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Billing & Registration</h3>
            </div>
            <Field label="Billing Email Address" value={partnerEditor.billingEmailAddress || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, billingEmailAddress: v }))} />
            <Field label="VAT / ABN / EIN / Business ID" value={partnerEditor.VAT_ABN_EIN_businessId || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, VAT_ABN_EIN_businessId: v }))} />
            <Field label="Alternate Contact Name" value={partnerEditor.altContactName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, altContactName: v }))} />
            <Field label="Alternate Contact Email" value={partnerEditor.altEmail || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, altEmail: v }))} />

            {/* Section 5: Taxonomy & Scope */}
            <div className="border-b pb-2 pt-4 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Scope & Taxonomy</h3>
            </div>
            
            <MultiSelectDropdown
              label="Service Countries"
              items={SERVICE_COUNTRIES}
              selected={partnerEditor.serviceCountries || []}
              onToggle={(v) => {
                const current = partnerEditor.serviceCountries || [];
                const updated = current.includes(v) ? current.filter((x: string) => x !== v) : [...current, v];
                setPartnerEditor((prev) => ({ ...prev, serviceCountries: updated }));
              }}
              placeholder="Select countries..."
            />

            <MultiSelectDropdown
              label="Service Regions"
              items={SERVICE_REGIONS}
              selected={partnerEditor.serviceRegions || []}
              onToggle={(v) => {
                const current = partnerEditor.serviceRegions || [];
                const updated = current.includes(v) ? current.filter((x: string) => x !== v) : [...current, v];
                setPartnerEditor((prev) => ({ ...prev, serviceRegions: updated }));
              }}
              placeholder="Select regions..."
            />

            <CategoryTreeDropdown
              selectedGroup={partnerEditor.selectedGroup || "business_offerings"}
              selectedCategories={partnerEditor.selectedCategories || []}
              selectedSubcategories={partnerEditor.selectedSubcategories || []}
              selectedSubSubcategories={partnerEditor.selectedSubSubcategories || []}
              onChange={(updates) => {
                setPartnerEditor((prev) => ({
                  ...prev,
                  ...updates,
                }));
              }}
            />

            <MultiSelectDropdown
              label="Certifications"
              items={CERTIFICATIONS}
              selected={partnerEditor.certifications || []}
              onToggle={(v) => {
                const current = partnerEditor.certifications || [];
                const updated = current.includes(v) ? current.filter((x: string) => x !== v) : [...current, v];
                setPartnerEditor((prev) => ({ ...prev, certifications: updated }));
              }}
              placeholder="Select certifications..."
            />

            <MultiSelectDropdown
              label="Biosafety Levels"
              items={BSL_LEVELS}
              selected={partnerEditor.bioSafetyLevel || []}
              onToggle={(v) => {
                const current = partnerEditor.bioSafetyLevel || [];
                const updated = current.includes(v) ? current.filter((x: string) => x !== v) : [...current, v];
                setPartnerEditor((prev) => ({ ...prev, bioSafetyLevel: updated }));
              }}
              placeholder="Select biosafety levels..."
            />

            {/* Section 6: Event Specific Details */}
            {partnerEditor.selectedGroup === "events" && (
              <>
                <div className="border-b pb-2 pt-4 mb-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Event Details</h3>
                </div>
                <Field label="Event Name" value={partnerEditor.eventName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, eventName: v }))} />
                <Field label="Event Link" value={partnerEditor.eventLink || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, eventLink: v }))} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Start Date" value={partnerEditor.startDate || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, startDate: v }))} />
                  <Field label="End Date" value={partnerEditor.endDate || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, endDate: v }))} />
                </div>
                <Field label="Event Country" value={partnerEditor.eventCountry || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, eventCountry: v }))} />
                <Field label="State / Region" value={partnerEditor.stateRegion || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, stateRegion: v }))} />
                <Field label="City" value={partnerEditor.city || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, city: v }))} />
                <Field label="Location" value={partnerEditor.location || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, location: v }))} />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Event Profile</p>
                  <Textarea
                    value={partnerEditor.eventProfile || ""}
                    onChange={(e) => setPartnerEditor((prev) => ({ ...prev, eventProfile: e.target.value }))}
                    className="min-h-20"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Agenda Highlights</p>
                  <Textarea
                    value={partnerEditor.agendaHighlights || ""}
                    onChange={(e) => setPartnerEditor((prev) => ({ ...prev, agendaHighlights: e.target.value }))}
                    className="min-h-20"
                  />
                </div>
                <Field label="Agenda PDF URL" value={partnerEditor.agendaPdfUrl || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, agendaPdfUrl: v }))} />
              </>
            )}

            {/* Section 7: Job Specific Details */}
            {partnerEditor.selectedGroup === "jobs" && (
              <>
                <div className="border-b pb-2 pt-4 mb-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Job Details</h3>
                </div>
                <Field label="Job Title" value={partnerEditor.jobTitle || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, jobTitle: v }))} />
                <Field label="Industry" value={partnerEditor.industry || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, industry: v }))} />
                <Field label="Position Type" value={partnerEditor.positionType || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, positionType: v }))} />
                <Field label="Experience Level" value={partnerEditor.experienceLevel || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, experienceLevel: v }))} />
                <Field label="Position Link" value={partnerEditor.positionLink || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, positionLink: v }))} />
                <Field label="Job Country" value={partnerEditor.jobCountry || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, jobCountry: v }))} />
                <Field label="State / Region" value={partnerEditor.stateRegion || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, stateRegion: v }))} />
                <Field label="City" value={partnerEditor.city || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, city: v }))} />
                <Field label="Location" value={partnerEditor.location || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, location: v }))} />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Job Summary</p>
                  <Textarea
                    value={partnerEditor.jobSummary || ""}
                    onChange={(e) => setPartnerEditor((prev) => ({ ...prev, jobSummary: e.target.value }))}
                    className="min-h-20"
                  />
                </div>
                <Field label="Education Required" value={partnerEditor.education || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, education: v }))} />
                <Field label="Work Model" value={partnerEditor.workModel || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, workModel: v }))} />
                <Field label="Application Deadline" value={partnerEditor.applicationDeadline || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, applicationDeadline: v }))} />
                <Field label="Job Description PDF URL" value={partnerEditor.jobDescriptionPdfUrl || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, jobDescriptionPdfUrl: v }))} />
              </>
            )}

            <Button onClick={savePartnerEdits} className="w-full">Save Partner Changes</Button>
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
                  const pId = selectedListing.__path.split('/')[1];
                  setActiveTab("audit");
                  setAuditSearchTerm(pId);
                  setListingEditorOpen(false);
                }
              }}
            >
              <History className="w-4 h-4" />
              View Profile History
            </Button>
          </SheetHeader>
          <div className="mt-6 space-y-6 pb-6">

            {/* Section 1: Listing Status & Plan */}
            <div className="border-b pb-2 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Listing Status & Plan</h3>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">Status</p>
              <select
                value={listingEditor.status || ""}
                onChange={(e) => setListingEditor((prev) => ({ ...prev, status: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Approved">Approved</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Extended">Extended</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
            <Field label="Active (true or false)" value={listingEditor.active || "true"} onChange={(v) => setListingEditor((prev) => ({ ...prev, active: v }))} />
            <Field label="Plan" value={listingEditor.selectedPlan || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, selectedPlan: v }))} />
            <Field label="Selected Group (business_offerings, consulting, events, jobs)" value={listingEditor.selectedGroup || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, selectedGroup: v }))} />

            {/* Section 2: Core Info */}
            <div className="border-b pb-2 pt-2 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Core Information</h3>
            </div>
            <Field label="Business Name" value={listingEditor.businessName || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, businessName: v }))} />
            <Field label="Company Website" value={listingEditor.companyWebsite || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, companyWebsite: v }))} />
            <Field label="Business Country" value={listingEditor.businessCountry || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, businessCountry: v }))} />
            <div className="space-y-1">
              <p className="text-sm font-medium">Business Address</p>
              <Textarea value={listingEditor.businessAddress || ""} onChange={(e) => setListingEditor((prev) => ({ ...prev, businessAddress: e.target.value }))} className="min-h-16" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Company Profile</p>
              <Textarea
                value={listingEditor.companyProfileText || ""}
                onChange={(e) => setListingEditor((prev) => ({ ...prev, companyProfileText: e.target.value }))}
                maxLength={COMPANY_PROFILE_MAX_LENGTH}
                className="min-h-24"
              />
              <p className={`text-xs ${(listingEditor.companyProfileText || "").length >= COMPANY_PROFILE_MAX_LENGTH ? 'text-red-500 font-bold' : 'text-slate-500'}`}>{(listingEditor.companyProfileText || "").length}/{COMPANY_PROFILE_MAX_LENGTH} characters</p>
            </div>

            {/* Section 3: Categories & Geography */}
            <div className="border-b pb-2 pt-2 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Categories & Geography</h3>
            </div>
            <Field label="Categories (comma separated)" value={listingEditor.selectedCategoriesCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, selectedCategoriesCsv: v }))} />
            <Field label="Subcategories (comma separated)" value={listingEditor.selectedSubcategoriesCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, selectedSubcategoriesCsv: v }))} />
            <Field label="Sub-subcategories (comma separated)" value={listingEditor.selectedSubSubcategoriesCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, selectedSubSubcategoriesCsv: v }))} />
            <Field label="Service Regions (comma separated)" value={listingEditor.serviceRegionsCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, serviceRegionsCsv: v }))} />
            <Field label="Service Countries (comma separated)" value={listingEditor.serviceCountriesCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, serviceCountriesCsv: v }))} />

            {/* Section 4: Business Offering / Consulting specific */}
            <div className="border-b pb-2 pt-2 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Business Offering / Consulting</h3>
            </div>
            <Field label="Bio Safety Level (comma separated, e.g. 1,2,3)" value={listingEditor.bioSafetyLevelCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, bioSafetyLevelCsv: v }))} />
            <Field label="Certifications (comma separated, e.g. GMP,ISO 9001)" value={listingEditor.certificationsCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, certificationsCsv: v }))} />
            <div className="space-y-1">
              <p className="text-sm font-medium">Company Representatives (JSON)</p>
              <Textarea
                value={listingEditor.companyRepresentativesJson || ""}
                onChange={(e) => setListingEditor((prev) => ({ ...prev, companyRepresentativesJson: e.target.value }))}
                className="min-h-24 font-mono text-xs"
                placeholder='[{"firstName":"","lastName":"","email":""}]'
              />
            </div>

            {/* Section 5: Event Fields */}
            <div className="border-b pb-2 pt-2 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Event Fields</h3>
            </div>
            <Field label="Event Name" value={listingEditor.eventName || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, eventName: v }))} />
            <Field label="Event Link / Sign-up URL" value={listingEditor.eventLink || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, eventLink: v }))} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date" value={listingEditor.startDate || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, startDate: v }))} />
              <Field label="End Date" value={listingEditor.endDate || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, endDate: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Event Country" value={listingEditor.eventCountry || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, eventCountry: v }))} />
              <Field label="State / Region" value={listingEditor.stateRegion || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, stateRegion: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City" value={listingEditor.city || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, city: v }))} />
              <Field label="Location / Venue" value={listingEditor.location || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, location: v }))} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Event Profile</p>
              <Textarea value={listingEditor.eventProfile || ""} onChange={(e) => setListingEditor((prev) => ({ ...prev, eventProfile: e.target.value }))} className="min-h-20" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Agenda Highlights</p>
              <Textarea value={listingEditor.agendaHighlights || ""} onChange={(e) => setListingEditor((prev) => ({ ...prev, agendaHighlights: e.target.value }))} className="min-h-16" />
            </div>
            <Field label="Agenda PDF URL" value={listingEditor.agendaPdfUrl || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, agendaPdfUrl: v }))} />

            {/* Section 6: Job Fields */}
            <div className="border-b pb-2 pt-2 mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Job Fields</h3>
            </div>
            <Field label="Job Title" value={listingEditor.jobTitle || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, jobTitle: v }))} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Industry" value={listingEditor.industry || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, industry: v }))} />
              <Field label="Position Type" value={listingEditor.positionType || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, positionType: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Experience Level" value={listingEditor.experienceLevel || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, experienceLevel: v }))} />
              <Field label="Work Model" value={listingEditor.workModel || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, workModel: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Job Country" value={listingEditor.jobCountry || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, jobCountry: v }))} />
              <Field label="Education" value={listingEditor.education || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, education: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Application Deadline" value={listingEditor.applicationDeadline || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, applicationDeadline: v }))} />
              <Field label="Apply Link" value={listingEditor.positionLink || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, positionLink: v }))} />
            </div>
            <Field label="Company Website Link (Job)" value={listingEditor.companyWebsiteLink || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, companyWebsiteLink: v }))} />
            <Field label="LinkedIn Job URL" value={listingEditor.linkedInJob || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, linkedInJob: v }))} />
            <Field label="Job Description PDF URL" value={listingEditor.jobDescriptionPdfUrl || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, jobDescriptionPdfUrl: v }))} />
            <div className="space-y-1">
              <p className="text-sm font-medium">Job Summary</p>
              <Textarea value={listingEditor.jobSummary || ""} onChange={(e) => setListingEditor((prev) => ({ ...prev, jobSummary: e.target.value }))} className="min-h-20" />
            </div>

            <Button onClick={saveListingEdits} className="w-full mt-2">Save Listing Changes</Button>
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
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
      {badge ? (
        <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
          {badge}
        </span>
      ) : (
        active && <ChevronRight className="ml-auto w-4 h-4 text-white/80" />
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
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
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
        <StatCard label="Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} icon={Receipt} iconClass="bg-emerald-100 text-emerald-700" />
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
                      <p className="text-sm max-w-[110px] truncate" title={partner.primaryName || ""}>
                        {partner.primaryName || "-"}
                      </p>
                      <p className="text-xs text-slate-500 max-w-[130px] truncate" title={partner.businessAddress || ""}>
                        {partner.businessAddress || "-"}
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

function PlansCatalogTab() {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Available Plans by Service</CardTitle>
        <CardDescription>Pricing and limitations by plan.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Service</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Price (USD)</TableHead>
              <TableHead>Max Categories</TableHead>
              <TableHead>Max Countries</TableHead>
              <TableHead className="pr-6">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {AVAILABLE_PLANS.map((plan) => {
              const limits = PLAN_LIMITS[plan.planId];
              return (
                <TableRow key={plan.planId}>
                  <TableCell className="pl-6">{plan.service}</TableCell>
                  <TableCell>{plan.label}</TableCell>
                  <TableCell>{plan.billing}</TableCell>
                  <TableCell className="font-semibold text-emerald-700">${plan.priceUsd.toLocaleString()}</TableCell>
                  <TableCell>{limits?.maxCategories === -1 ? "Unlimited" : limits?.maxCategories ?? "-"}</TableCell>
                  <TableCell>{limits?.maxCountries === -1 ? "Unlimited" : limits?.maxCountries ?? "-"}</TableCell>
                  <TableCell className="pr-6">
                    {plan.planId.includes("premium_plus")
                      ? "Eligible for stronger homepage visibility options."
                      : "Standard listing visibility."}
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

function FeaturedPlansTab({
  featuredPlans,
  partners,
}: {
  featuredPlans: FeaturedPlanPurchase[];
  partners: PartnerRecord[];
}) {
  const purchaseCountByFeature = useMemo(() => {
    return featuredPlans.reduce((acc, feature) => {
      const id = feature.featureId || "unknown";
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

  return (
    <div className="space-y-6">
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Feature Plans</CardTitle>
          <CardDescription>Featured placements, information, and pricing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {FEATURED_PLAN_CATALOG.map((group) => (
            <div key={group.service} className="space-y-3">
              <h4 className="font-semibold">{group.service}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {group.options.map((option) => (
                  <div key={option.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-sm text-slate-600">Specification : {option.specification}</p>
                    <p className="font-semibold">Amount In $ : {option.price}</p>
                    <p>For : {option.durationDays} days</p>
                    <p>Number of Country : {option.countryLimit}</p>
                    <p>Number of Category : {option.categoryLimit}</p>
                    <p className="text-xs text-slate-500">Purchased: {purchaseCountByFeature[option.id] || 0}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
                      <Badge className={purchase.active === false ? "bg-slate-200 text-slate-700 border-slate-300" : "bg-emerald-50 text-emerald-700 border-emerald-200"}>
                        {purchase.active === false ? "Inactive" : "Active"}
                      </Badge>
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
}: {
  rows: Array<{ group: string; category: string; subcategory: string; subSubcategory: string }>;
}) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>All Categories</CardTitle>
        <CardDescription>Categories, sub categories, and sub sub categories.</CardDescription>
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
              <TableHead className="pr-6 text-center">Featured Image</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell className="pl-6 text-slate-500" colSpan={6}>
                  No categories found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={`${row.group}-${row.category}-${row.subcategory}-${index}`}>
                  <TableCell className="pl-6">{row.group}</TableCell>
                  <TableCell>{row.category}</TableCell>
                  <TableCell>{row.subcategory}</TableCell>
                  <TableCell>{row.subSubcategory}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-center">
                    <div className="w-10 h-8 mx-auto bg-slate-100 rounded border border-slate-200 flex items-center justify-center overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=100&h=80" alt="Thumbnail" className="w-full h-full object-cover opacity-80" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ListingsList({
  listings,
  listingInsights,
  onView,
  onSetStatus,
}: {
  listings: ListingRecord[];
  listingInsights: Record<string, any>;
  onView: (listing: ListingRecord) => void;
  onSetStatus: (listing: ListingRecord, status: string, active: boolean) => void;
}) {
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
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
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
                <TableHead>Is Featured</TableHead>
                <TableHead>Feature Plan</TableHead>
                <TableHead>Feature Date</TableHead>
                <TableHead>Feature Cancel Date</TableHead>
                <TableHead>Resubmitted</TableHead>
                <TableHead className="text-right pr-6 sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {listings.map((listing) => (
              <TableRow key={listing.__path}>
                <TableCell className="pl-6">
                  <p className="font-medium">{listing.businessName || "Unnamed"}</p>
                  <p className="text-xs text-slate-500">{listing.companyWebsite || "-"}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getCollectionLabel(listing.__col)}</Badge>
                </TableCell>
                <TableCell>{listing.selectedPlan?.replace(/_/g, " ") || "-"}</TableCell>
                <TableCell>{getStatusBadge(listing.status)}</TableCell>
                <TableCell className="text-slate-500 text-sm">{formatAdminDate(listing.createdAt)}</TableCell>
                <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.subscribedOn)}</TableCell>
                <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.upgradedOn)}</TableCell>
                <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.expiryDate)}</TableCell>
                <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.cancelledOn)}</TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {listingInsights[listing.id]?.isFeatured ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Yes</Badge>
                  ) : (
                    <Badge className="bg-slate-50 text-slate-500 border-slate-200">No</Badge>
                  )}
                </TableCell>
                <TableCell className="text-slate-500 text-sm">{listingInsights[listing.id]?.featurePlan || "-"}</TableCell>
                <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.featureDate)}</TableCell>
                <TableCell className="text-slate-500 text-sm">{formatAdminDate(listingInsights[listing.id]?.featureCancelDate)}</TableCell>
                <TableCell className="text-slate-500 text-sm">{listingInsights[listing.id]?.resubmitted || "-"}</TableCell>
                <TableCell className="text-right pr-6 sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[210px]">
                      <DropdownMenuLabel>Listing Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onView(listing)}>
                        <Eye className="w-4 h-4 mr-2" /> View / Edit listing
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onSetStatus(listing, "Approved", true)}>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Approve listing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSetStatus(listing, "Pending Review", false)}>
                        <Clock className="w-4 h-4 mr-2 text-amber-600" /> Unapprove (pending review)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSetStatus(listing, "Disabled", false)}>
                        <Ban className="w-4 h-4 mr-2 text-rose-600" /> Disable listing
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionList({ transactions }: { transactions: any[] }) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <Receipt className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No transactions recorded</h3>
        <p className="text-sm text-slate-500">Transactions appear here after checkout.</p>
      </div>
    );
  }

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Partner</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Plan ID</TableHead>
              <TableHead>Listing ID</TableHead>
              <TableHead>Partner ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right pr-6">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="pl-6">
                  <div className="space-y-0.5">
                    <p>{t.customerEmail || "-"}</p>
                    <p className="text-xs text-slate-500">{t.collectionName || "-"}</p>
                  </div>
                </TableCell>
                <TableCell>{t.businessName || "-"}</TableCell>
                <TableCell>{t.group?.replace(/_/g, " ") || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{t.planId || t.planName || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{t.listingId || "-"}</TableCell>
                <TableCell className="font-mono text-xs max-w-[220px] truncate">{t.partnerId || "-"}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      t.status === "succeeded"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : t.status === "pending"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                    }
                  >
                    {t.status || "-"}
                  </Badge>
                </TableCell>
                <TableCell className="font-semibold text-emerald-700">
                  {t.currency === "gbp" ? "£" : "$"}
                  {typeof t.amount === "number" ? t.amount.toFixed(2) : "0.00"}
                </TableCell>
                <TableCell className="text-right pr-6 text-slate-500">
                  {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
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
      case "PAYMENT_SUCCESS":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Payment Success</Badge>;
      case "PAYMENT_FAILED":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Payment Failed</Badge>;
      case "LISTING_UPDATED":
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Listing Updated</Badge>;
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
              <TableHead>Details</TableHead>
              <TableHead className="text-right pr-6">Partner ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="pl-6 text-sm text-slate-500 whitespace-nowrap">
                  {log.timestamp?.seconds
                    ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                    : "Recently"}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{log.partnerName || "Unknown"}</TableCell>
                <TableCell>{getActionBadge(log.action)}</TableCell>
                <TableCell className="text-sm text-slate-600 max-w-md">{log.details}</TableCell>
                <TableCell className="text-right pr-6 font-mono text-[10px] text-slate-400">
                  {log.partnerId || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

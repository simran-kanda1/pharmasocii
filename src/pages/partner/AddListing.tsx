import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, ArrowLeft, ArrowRight, ChevronRight, ChevronDown, Check, X, Info, Calendar, Briefcase, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { auth, db } from "@/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { logActivity } from "@/lib/auditLogger";
import { API_BASE_URL } from "@/apiConfig";
import { buildDisplayCategoryFields, sanitizeLowestLevelSelections } from "@/lib/categorySelection";


import {
    BUSINESS_CATEGORIES, CONSULTING_CATEGORIES, EVENTS_CATEGORIES, JOBS_CATEGORIES,
    type SubcategoryEntry, type CategoriesDict,
} from "../AllCategories";

// ─── Group config ───
const GROUP_CONFIG: Record<string, { label: string; icon: any; dbGroup: string; collectionName: string }> = {
    offerings: { label: "Business Offering", icon: Building2, dbGroup: "business_offerings", collectionName: "businessOfferingsCollection" },
    consulting: { label: "Consulting Service", icon: Users, dbGroup: "consulting", collectionName: "consultingServicesCollection" },
    events: { label: "Event Listing", icon: Calendar, dbGroup: "events", collectionName: "eventsCollection" },
    jobs: { label: "Job Listing", icon: Briefcase, dbGroup: "jobs", collectionName: "jobsCollection" },
};

// ─── Plan limits ───
interface PlanLimits { maxCategories: number; maxCountries: number; }
interface CompanyRepresentative { firstName: string; lastName: string; email: string; }

const normalizeRepresentative = (rep: any): CompanyRepresentative | null => {
    const firstName = (rep?.firstName || "").trim();
    const lastName = (rep?.lastName || "").trim();
    const email = (rep?.email || "").trim();
    if (!firstName || !lastName || !email) return null;
    return { firstName, lastName, email };
};

const representativeKey = (rep: CompanyRepresentative): string =>
    `${rep.firstName.toLowerCase()}|${rep.lastName.toLowerCase()}|${rep.email.toLowerCase()}`;

const PLAN_LIMITS: Record<string, PlanLimits> = {
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
const OTHER_CERT_OPTION = "Others";

const REGION_COUNTRY_MAP: Record<string, string[]> = {
    "North America": ["Barbados", "Belize", "Canada", "Costa Rica", "Cuba", "Dominican Republic", "El Salvador", "Guatemala", "Haiti", "Honduras", "Jamaica", "Mexico", "Nicaragua", "Panama", "Trinidad and Tobago", "United States"],
    "South America": ["Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"],
    "Europe": ["Albania", "Austria", "Belarus", "Belgium", "Bosnia", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Russia", "Serbia", "Slovak Republic", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "UK", "Ukraine"],
    "Asia Pacific": ["Afghanistan", "Armenia", "Azerbaijan", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China", "Georgia", "Hong Kong", "India", "Indonesia", "Japan", "Kazakhstan", "Korea", "Kyrgyzstan", "Laos", "Malaysia", "Maldives", "Mongolia", "Myanmar", "Nepal", "Pakistan", "Philippines", "Singapore", "Sri Lanka", "Taiwan", "Thailand", "Turkmenistan", "Uzbekistan", "Vietnam"],
    "Middle East": ["Bahrain", "Iran", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon", "Oman", "Palestine", "Qatar", "Saudi Arabia", "Syria", "UAE", "Yemen"],
    "Africa": ["Algeria", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Central African Republic", "Chad", "Congo", "Djibouti", "Egypt", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Ghana", "Kenya", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Senegal", "Sierra Leone", "Somalia", "South Africa", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"],
    "Australia & Oceania": ["Australia", "Fiji", "New Zealand", "Papua New Guinea"],
};

const getSubLabel = (entry: SubcategoryEntry): string => typeof entry === "string" ? entry : entry.label;
const hasSubSub = (entry: SubcategoryEntry): entry is { label: string; subSubcategories: string[] } => typeof entry !== "string";

const toDateValue = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === "function") {
        const converted = value.toDate();
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
    if (typeof value?.seconds === "number") {
        const converted = new Date(value.seconds * 1000);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    return null;
};

const inferPlanGroup = (plan: any): string => {
    if (plan?.group) return plan.group;
    if (plan?.collectionName === "businessOfferingsCollection") return "business_offerings";
    if (plan?.collectionName === "consultingServicesCollection" || plan?.collectionName === "consultingCollection") return "consulting";
    if (plan?.collectionName === "eventsCollection") return "events";
    if (plan?.collectionName === "jobsCollection") return "jobs";
    return "";
};

const getGroupPurchaseLock = (plans: any[], group: "business_offerings" | "consulting") => {
    const now = new Date();
    let blocked = false;
    let blockedUntil: Date | null = null;
    let hasOpenEndedBlock = false;

    for (const plan of plans || []) {
        if (inferPlanGroup(plan) !== group) continue;
        const isActive = plan?.active !== false;
        if (!isActive) continue;

        if (!plan?.cancelAtPeriodEnd) {
            blocked = true;
            hasOpenEndedBlock = true;
            blockedUntil = null;
            continue;
        }

        const periodEnd = toDateValue(plan?.billingPeriodEnd) || toDateValue(plan?.cancelAt);
        if (!periodEnd || now < periodEnd) {
            blocked = true;
            if (!hasOpenEndedBlock && periodEnd && (!blockedUntil || periodEnd > blockedUntil)) blockedUntil = periodEnd;
        }
    }
    return { blocked, blockedUntil };
};

// ─── Reusable MultiSelect Dropdown ───
function MultiSelectDropdown({ label, items, selected, onToggle, open, onToggleOpen, disabled, search, setSearch, filteredItems }: {
    label: string; items?: string[]; selected: string[]; onToggle: (v: string) => void;
    open: boolean; onToggleOpen: () => void; disabled?: (item: string) => boolean;
    search?: string; setSearch?: (v: string) => void; filteredItems?: string[];
}) {
    const displayItems = filteredItems || items || [];
    return (
        <div className="relative">
            <button type="button" onClick={onToggleOpen}
                className="w-full h-10 px-3 text-left text-sm bg-muted/40 border border-foreground/10 rounded-md flex items-center justify-between hover:border-primary/50 transition-colors">
                <span className="text-muted-foreground truncate">
                    {selected.length > 0 ? `${selected.length} selected` : `Choose your ${label} (multi-select enabled)`}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-foreground/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {setSearch && (
                        <div className="p-2 border-b border-foreground/10">
                            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm bg-muted/30 border-foreground/10" autoFocus />
                        </div>
                    )}
                    {displayItems.map(item => (
                        <button key={item} type="button" onClick={() => onToggle(item)}
                            disabled={disabled ? disabled(item) : false}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-primary/10 transition-colors ${disabled?.(item) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center text-xs transition-colors ${selected.includes(item) ? "bg-primary border-primary text-primary-foreground" : "border-foreground/20"}`}>
                                {selected.includes(item) && <Check className="w-3 h-3" />}
                            </div>
                            {item}
                        </button>
                    ))}
                </div>
            )}
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {selected.map(v => (
                        <span key={v} onClick={() => onToggle(v)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full cursor-pointer hover:bg-primary/20 transition-colors">
                            {v} <X className="w-3 h-3" />
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function AddListing() {
    const navigate = useNavigate();
    const { type } = useParams<{ type: string }>();
    const groupKey = type || "offerings";
    const config = GROUP_CONFIG[groupKey];
    const dbGroup = config?.dbGroup || "business_offerings";

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [groupPurchaseLock, setGroupPurchaseLock] = useState<{ blocked: boolean; blockedUntil: Date | null }>({ blocked: false, blockedUntil: null });
    const [showPlanDetails, setShowPlanDetails] = useState(false);

    // ─── Plan selection ───
    const [plan, setPlan] = useState("");
    const [addon, setAddon] = useState("");

    // ─── Company info (pre-filled from partner doc) ───
    const [companyName, setCompanyName] = useState("");
    const [companyProfile, setCompanyProfile] = useState("");
    const [businessAddress, setBusinessAddress] = useState("");
    const [businessCountry, setBusinessCountry] = useState("");

    // ─── Business Offerings fields ───
    const [selectedBSL, setSelectedBSL] = useState<string[]>([]);
    const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
    const [otherCertText, setOtherCertText] = useState("");
    const [showOtherCertInput, setShowOtherCertInput] = useState(false);
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [companyRepresentatives, setCompanyRepresentatives] = useState<CompanyRepresentative[]>([]);
    const [availableRepresentatives, setAvailableRepresentatives] = useState<CompanyRepresentative[]>([]);

    // ─── Event fields ───
    const [eventData, setEventData] = useState({
        eventName: "", eventLink: "", startDate: "", endDate: "",
        eventCountry: "", location: "", eventProfile: "",
    });

    // ─── Job fields ───
    const [jobData, setJobData] = useState({
        jobTitle: "", industry: "", positionType: "", experienceLevel: "",
        positionLink: "", jobCountry: "", location: "", jobSummary: "",
    });

    // ─── Category tree state ───
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
    const [selectedSubSubcategories, setSelectedSubSubcategories] = useState<string[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
    const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);

    // ─── Multiselect UI toggles ───
    const [showBSLDropdown, setShowBSLDropdown] = useState(false);
    const [showCertsDropdown, setShowCertsDropdown] = useState(false);
    const [showRegionsDropdown, setShowRegionsDropdown] = useState(false);
    const [showCountriesDropdown, setShowCountriesDropdown] = useState(false);
    const [countrySearch, setCountrySearch] = useState("");

    // Load partner data
    useEffect(() => {
        const fetchPartner = async () => {
            if (auth.currentUser) {
                const docSnap = await getDoc(doc(db, "partnersCollection", auth.currentUser.uid));
                if (docSnap.exists()) {
                    const d = docSnap.data();
                    setCompanyName(d.businessName || "");
                    setCompanyProfile(d.companyProfileText || "");
                    setBusinessAddress(d.businessAddress || "");
                    setBusinessCountry(d.businessCountry || "");
                    const [altFName, ...altLNames] = ((d.secondaryName || "") as string).split(" ");
                    const altRep = normalizeRepresentative({
                        firstName: d.secondaryFirstName || altFName || "",
                        lastName: d.secondaryLastName || altLNames.join(" ") || "",
                        email: d.secondaryEmail || "",
                    });
                    const partnerDocReps = Array.isArray(d.companyRepresentatives)
                        ? d.companyRepresentatives.map(normalizeRepresentative).filter(Boolean) as CompanyRepresentative[]
                        : [];

                    const listingResults = await Promise.allSettled([
                        getDocs(collection(doc(db, "partnersCollection", auth.currentUser.uid), "businessOfferingsCollection")),
                        getDocs(query(collection(db, "consultingServicesCollection"), where("partnerId", "==", auth.currentUser.uid))),
                        getDocs(query(collection(db, "eventsCollection"), where("partnerId", "==", auth.currentUser.uid))),
                        getDocs(query(collection(db, "jobsCollection"), where("partnerId", "==", auth.currentUser.uid))),
                    ]);
                    const listingReps = listingResults
                        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
                        .flatMap((result) => result.value.docs.map((docItem: any) => docItem.data()))
                        .flatMap((listingData: any) => Array.isArray(listingData.companyRepresentatives) ? listingData.companyRepresentatives : [])
                        .map(normalizeRepresentative)
                        .filter(Boolean) as CompanyRepresentative[];

                    const allSuggestions = [...partnerDocReps, ...listingReps, ...(altRep ? [altRep] : [])];
                    const seen = new Set<string>();
                    setAvailableRepresentatives(
                        allSuggestions.filter((rep) => {
                            const key = representativeKey(rep);
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        })
                    );

                    // Pre-populate with partner's primary representatives if it's a new listing
                    if (partnerDocReps.length > 0) {
                        setCompanyRepresentatives(partnerDocReps);
                    }
                }

                if (dbGroup === "business_offerings" || dbGroup === "consulting") {
                    const plansSnap = await getDocs(collection(doc(db, "partnersCollection", auth.currentUser.uid), "planCollection"));
                    const plans = plansSnap.docs.map((d) => d.data());
                    const lock = getGroupPurchaseLock(plans, dbGroup);
                    setGroupPurchaseLock(lock);
                    if (lock.blocked) {
                        const nextDate = lock.blockedUntil?.toLocaleDateString();
                        setError(
                            nextDate
                                ? `You can add another ${dbGroup === "business_offerings" ? "Business Offering" : "Consulting Service"} after ${nextDate}.`
                                : `You can only have one active ${dbGroup === "business_offerings" ? "Business Offering" : "Consulting Service"} at a time.`
                        );
                    }
                } else {
                    setGroupPurchaseLock({ blocked: false, blockedUntil: null });
                }
            }
        };
        fetchPartner();
    }, [dbGroup]);

    // ─── Plan limits ───
    const currentLimits = PLAN_LIMITS[plan] || { maxCategories: 0, maxCountries: 0 };
    const canUseRegionHelper = currentLimits.maxCountries === -1;

    // ─── Category count ───
    // Count directly from current selections so repeated labels in taxonomy
    // (common in consulting categories) do not get counted multiple times.
    const categoryCount = useMemo(() => {
        const selectedUnits = new Set<string>();
        selectedCategories.forEach((cat) => selectedUnits.add(`cat:${cat}`));
        selectedSubcategories.forEach((sub) => selectedUnits.add(`sub:${sub}`));
        selectedSubSubcategories.forEach((subSub) => selectedUnits.add(`subsub:${subSub}`));
        return selectedUnits.size;
    }, [selectedCategories, selectedSubcategories, selectedSubSubcategories]);

    const isCategoryLimitReached = currentLimits.maxCategories !== -1 && categoryCount >= currentLimits.maxCategories;
    const isCountryLimitReached = currentLimits.maxCountries !== -1 && selectedCountries.length >= currentLimits.maxCountries;
    const canSelectAllCategories = currentLimits.maxCategories === -1;

    function getCategoriesForGroup(group: string): CategoriesDict | Record<string, string[]> | null {
        switch (group) {
            case "business_offerings": return BUSINESS_CATEGORIES;
            case "consulting": return CONSULTING_CATEGORIES;
            case "events": return EVENTS_CATEGORIES;
            case "jobs": return JOBS_CATEGORIES;
            default: return null;
        }
    }

    const toggleExpandCategory = (cat: string) => setExpandedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    const toggleExpandSubcategory = (sub: string) => setExpandedSubcategories(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]);

    const toggleCategorySelection = (cat: string, hasSubs: boolean) => {
        if (hasSubs) { setSelectedCategories(prev => prev.filter(c => c !== cat)); toggleExpandCategory(cat); return; }
        if (selectedCategories.includes(cat)) setSelectedCategories(prev => prev.filter(c => c !== cat));
        else { if (!isCategoryLimitReached) setSelectedCategories(prev => [...prev, cat]); }
    };

    const toggleSubcategorySelection = (sub: string, hasSubSubs: boolean) => {
        if (hasSubSubs) { setSelectedSubcategories(prev => prev.filter(s => s !== sub)); toggleExpandSubcategory(sub); return; }
        if (selectedSubcategories.includes(sub)) setSelectedSubcategories(prev => prev.filter(s => s !== sub));
        else { if (!isCategoryLimitReached) setSelectedSubcategories(prev => [...prev, sub]); }
    };

    const toggleSubSubcategorySelection = (subSub: string) => {
        if (selectedSubSubcategories.includes(subSub)) setSelectedSubSubcategories(prev => prev.filter(s => s !== subSub));
        else { if (!isCategoryLimitReached) setSelectedSubSubcategories(prev => [...prev, subSub]); }
    };

    const toggleBSL = (val: string) => setSelectedBSL(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    const toggleCert = (val: string) => {
        if (val === OTHER_CERT_OPTION) {
            setShowCertsDropdown(false);
            if (showOtherCertInput) {
                const customValue = otherCertText.trim();
                setShowOtherCertInput(false);
                setOtherCertText("");
                if (customValue) {
                    setSelectedCerts(prev => prev.filter(cert => cert !== customValue));
                }
            } else {
                setShowOtherCertInput(true);
            }
            return;
        }
        setSelectedCerts(prev => {
            if (prev.includes(val)) {
                const next = prev.filter(v => v !== val);
                if (val === otherCertText.trim()) {
                    setOtherCertText("");
                    setShowOtherCertInput(false);
                }
                return next;
            }
            return [...prev, val];
        });
    };
    const handleOtherCertTextChange = (value: string) => {
        const previousCustomValue = otherCertText.trim();
        const nextCustomValue = value.trim();
        setOtherCertText(value);
        setSelectedCerts(prev => {
            const withoutPreviousCustom = prev.filter(cert => cert !== previousCustomValue && cert !== OTHER_CERT_OPTION);
            if (!nextCustomValue) return withoutPreviousCustom;
            return Array.from(new Set([...withoutPreviousCustom, nextCustomValue]));
        });
    };
    const toggleRegion = (val: string) => {
        if (!canUseRegionHelper) return;
        const regionCountries = REGION_COUNTRY_MAP[val] || [];
        if (selectedRegions.includes(val)) {
            setSelectedRegions(prev => prev.filter(v => v !== val));
            setSelectedCountries(prev => prev.filter(country => !regionCountries.includes(country)));
            return;
        }
        setSelectedRegions(prev => [...prev, val]);
        setSelectedCountries(prev => [...new Set([...prev, ...regionCountries])]);
    };
    const toggleCountry = (val: string) => {
        if (selectedCountries.includes(val)) setSelectedCountries(prev => prev.filter(v => v !== val));
        else { if (!isCountryLimitReached) setSelectedCountries(prev => [...prev, val]); }
    };

    const addRepresentative = () => {
        setCompanyRepresentatives(prev => [...prev, { firstName: "", lastName: "", email: "" }]);
    };
    const addRepresentativeFromSaved = (rep: CompanyRepresentative) => {
        setCompanyRepresentatives(prev => {
            const exists = prev.some((existing) => representativeKey({
                firstName: existing.firstName.trim(),
                lastName: existing.lastName.trim(),
                email: existing.email.trim(),
            }) === representativeKey(rep));
            if (exists) return prev;
            return [...prev, { ...rep }];
        });
    };
    const removeRepresentative = (index: number) => {
        setCompanyRepresentatives(prev => prev.filter((_, i) => i !== index));
    };
    const updateRepresentative = (index: number, field: keyof CompanyRepresentative, value: string) => {
        setCompanyRepresentatives(prev => prev.map((rep, i) => (i === index ? { ...rep, [field]: value } : rep)));
    };

    const getPlansForGroup = () => {
        switch (dbGroup) {
            case "business_offerings": case "consulting":
                return [
                    { value: "basic_mo", label: "Basic (Monthly) - $100.00" },
                    { value: "standard_mo", label: "Standard (Monthly) - $200.00" },
                    { value: "premium_mo", label: "Premium (Monthly) - $400.00" },
                    { value: "premium_plus_mo", label: "Premium Plus (Monthly) - $1000.00" },
                    { value: "basic_yr", label: "Basic (Annual) - $1,080.00" },
                    { value: "standard_yr", label: "Standard (Annual) - $2,184.00" },
                    { value: "premium_yr", label: "Premium (Annual) - $4,320.00" },
                    { value: "premium_plus_yr", label: "Premium Plus (Annual) - $10,800.00" },
                ];
            case "events":
                return [
                    { value: "basic_event", label: "Basic - $500.00" },
                    { value: "standard_event", label: "Standard - $850.00" },
                    { value: "premium_event", label: "Premium - $1,250.00" },
                    { value: "premium_plus_event", label: "Premium Plus - $1,450.00" },
                ];
            case "jobs":
                return [
                    { value: "standard_job", label: "Standard - $400.00" },
                    { value: "premium_job", label: "Premium - $800.00" },
                    { value: "premium_plus_job", label: "Premium Plus - $1,000.00" },
                ];
            default: return [];
        }
    };



    const getPlanDetailsText = (planId: string): string[] => {
        const limits = PLAN_LIMITS[planId];
        if (!limits) return [];
        const cats = limits.maxCategories === -1 ? "Unlimited" : `up to ${limits.maxCategories}`;
        const countries = limits.maxCountries === -1 ? "Unlimited" : `up to ${limits.maxCountries}`;
        return [
            `Access to specialized categories — ${cats}`,
            `Service countries — ${countries}`,
            "Company profile to highlight your key offerings",
            "Display your logo for branding",
            "Direct website link",
            "Add representative(s) for direct communication",
            ...(dbGroup === "business_offerings" ? ["Certifications (optional)", "Biosafety level (optional) — BSL disclosure"] : []),
        ];
    };

    const filteredCountries = SERVICE_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()));

    // ─── Submit: save listing + redirect to Stripe ───
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (groupPurchaseLock.blocked) {
            const nextDate = groupPurchaseLock.blockedUntil?.toLocaleDateString();
            setError(
                nextDate
                    ? `You can add another ${dbGroup === "business_offerings" ? "Business Offering" : "Consulting Service"} after ${nextDate}.`
                    : `You can only have one active ${dbGroup === "business_offerings" ? "Business Offering" : "Consulting Service"} at a time.`
            );
            return;
        }

        if (!plan) { setError("Please select a plan before continuing."); return; }
        if (dbGroup === "business_offerings" && showOtherCertInput && !otherCertText.trim()) {
            setError('Please enter a value for "Other" certification.');
            return;
        }
        const normalizedRepresentatives = companyRepresentatives
            .map((rep) => ({
                firstName: rep.firstName.trim(),
                lastName: rep.lastName.trim(),
                email: rep.email.trim(),
            }))
            .filter((rep) => rep.firstName || rep.lastName || rep.email);
        const hasInvalidRepresentative = normalizedRepresentatives.some(
            (rep) => !rep.firstName || !rep.lastName || !rep.email
        );
        if (hasInvalidRepresentative) {
            setError("Each company representative must include first name, last name, and email.");
            return;
        }

        try {
            if (!auth.currentUser) throw new Error("No authenticated user found. Please login.");
            setIsLoading(true);

            // Build listing data
            const normalizedCertifications = Array.from(
                new Set(
                    selectedCerts
                        .map(cert => cert.trim())
                        .filter(cert => cert && cert !== OTHER_CERT_OPTION && !cert.toLowerCase().startsWith("other:"))
                )
            );
            const sanitizedSelections = sanitizeLowestLevelSelections(
                getCategoriesForGroup(dbGroup) as any,
                selectedCategories,
                selectedSubcategories,
                selectedSubSubcategories
            );
            const categoryDisplayFields = buildDisplayCategoryFields(
                getCategoriesForGroup(dbGroup) as any,
                sanitizedSelections.selectedCategories,
                sanitizedSelections.selectedSubcategories,
                sanitizedSelections.selectedSubSubcategories
            );
            const listingData: Record<string, any> = {
                partnerId: auth.currentUser.uid,
                businessName: companyName,
                selectedGroup: dbGroup,
                selectedPlan: plan,
                // Feature add-ons can only be purchased after the base plan is paid.
                selectedAddon: "",
                selectedCategories: sanitizedSelections.selectedCategories,
                selectedSubcategories: sanitizedSelections.selectedSubcategories,
                selectedSubSubcategories: sanitizedSelections.selectedSubSubcategories,
                ...categoryDisplayFields,
                companyRepresentatives: normalizedRepresentatives,
                status: "pending_payment",
                createdAt: serverTimestamp(),
            };

            // Group-specific fields
            if (dbGroup === "business_offerings") {
                Object.assign(listingData, {
                    bioSafetyLevel: selectedBSL, certifications: normalizedCertifications,
                    serviceRegions: selectedRegions, serviceCountries: selectedCountries,
                    companyProfileText: companyProfile, businessAddress, businessCountry,
                });
            } else if (dbGroup === "consulting") {
                Object.assign(listingData, {
                    serviceRegions: selectedRegions, serviceCountries: selectedCountries,
                    companyProfileText: companyProfile, businessAddress, businessCountry,
                });
            } else if (dbGroup === "events") {
                Object.assign(listingData, { ...eventData });
            } else if (dbGroup === "jobs") {
                Object.assign(listingData, { ...jobData });
            }

            // Persist listings where the app expects to read them:
            // only business offerings live under partnersCollection/{partnerId}.
            const partnerRef = doc(db, "partnersCollection", auth.currentUser.uid);
            const listingsRef = dbGroup === "business_offerings"
                ? collection(partnerRef, config.collectionName)
                : collection(db, config.collectionName);
            const listingDoc = await addDoc(listingsRef, listingData);

            // Log to Audit Trail
            await logActivity({
                partnerId: auth.currentUser.uid,
                partnerName: companyName || "Unnamed Business",
                action: "LISTING_CREATED",
                details: `New ${config.label} listing created: "${eventData.eventName || jobData.jobTitle || dbGroup.replace(/_/g, ' ')}".`,
                category: "listing",
                metadata: {
                    listingId: listingDoc.id,
                    type: dbGroup,
                    plan
                }
            });

            // Create Stripe Checkout Session
            const origin = window.location.origin;
            const resp = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId: plan,
                    group: dbGroup,
                    partnerId: auth.currentUser.uid,
                    partnerEmail: auth.currentUser.email,
                    listingId: listingDoc.id,
                    collectionName: config.collectionName,
                    successUrl: `${origin}/partner/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
                    cancelUrl: `${origin}/partner/add-listing/${groupKey}?payment=cancelled`,
                }),
            });

            if (!resp.ok) {
                let errMessage = "Failed to communicate with the payment server.";
                try {
                    const errData = await resp.json();
                    errMessage = errData.error || errMessage;
                } catch {
                    // Could not parse JSON, likely a proxy error (backend down)
                    errMessage = `Server error ${resp.status}: The backend API might be offline. Please ensure the server is running.`;
                }
                throw new Error(errMessage);
            }

            const data = await resp.json();

            // Redirect to Stripe Checkout
            window.location.href = data.url;

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred.");
            setIsLoading(false);
        }
    };

    // ─── Render category tree ───
    function renderCategoryTree() {
        const catDict = getCategoriesForGroup(dbGroup);
        if (!catDict) return null;
        const isBusinessGroup = dbGroup === "business_offerings";

        return Object.entries(catDict).map(([cat, subs]) => {
            const hasSubs = subs.length > 0;
            const isExpanded = expandedCategories.includes(cat);
            const isParentSelected = selectedCategories.includes(cat);

            return (
                <div key={cat} className="flex flex-col">
                    <div className="flex items-start gap-2 py-1">
                        {hasSubs ? (
                            <button type="button" onClick={() => toggleExpandCategory(cat)} className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        ) : <span className="w-4 h-4 flex-shrink-0" />}
                        <div className="flex items-center gap-2">
                            <Checkbox id={`cat-${cat}`} checked={hasSubs ? isExpanded : isParentSelected}
                                onCheckedChange={() => toggleCategorySelection(cat, hasSubs)}
                                disabled={!hasSubs && !isParentSelected && isCategoryLimitReached}
                                className={hasSubs && isExpanded ? "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" : ""} />
                            <label htmlFor={`cat-${cat}`} className={`text-sm leading-none cursor-pointer ${hasSubs ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>{cat}</label>
                        </div>
                    </div>
                    {hasSubs && isExpanded && (
                        <div className="ml-8 pl-3 border-l-2 border-green-500/30 space-y-1 mb-2">
                            {subs.map((entry: SubcategoryEntry) => {
                                const subLabel = getSubLabel(entry);
                                const isNested = isBusinessGroup && hasSubSub(entry);
                                const isSubChecked = selectedSubcategories.includes(subLabel);
                                const isSubExpanded = expandedSubcategories.includes(subLabel);
                                return (
                                    <div key={subLabel} className="flex flex-col">
                                        <div className="flex items-center gap-1.5 py-0.5">
                                            {isNested ? (
                                                <button type="button" onClick={() => toggleExpandSubcategory(subLabel)} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                                                    {isSubExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                </button>
                                            ) : <span className="w-3.5 h-3.5 flex-shrink-0" />}
                                            <Checkbox id={`sub-${cat}-${subLabel}`} checked={isNested ? isSubExpanded : isSubChecked}
                                                onCheckedChange={() => toggleSubcategorySelection(subLabel, isNested || false)}
                                                disabled={!isNested && !isSubChecked && isCategoryLimitReached}
                                                className={`${isSubChecked ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`} />
                                            <label htmlFor={`sub-${cat}-${subLabel}`} className="text-sm text-green-700 dark:text-green-400 cursor-pointer">{subLabel}</label>
                                        </div>
                                        {isNested && isSubExpanded && hasSubSub(entry) && (
                                            <div className="ml-8 pl-3 border-l-2 border-primary/30 space-y-1 mb-1">
                                                {entry.subSubcategories.map((ssLabel: string) => {
                                                    const isSSChecked = selectedSubSubcategories.includes(ssLabel);
                                                    return (
                                                        <div key={ssLabel} className="flex items-center gap-1.5 py-0.5">
                                                            <span className="w-3 h-3 flex-shrink-0" />
                                                            <Checkbox id={`subsub-${ssLabel}`} checked={isSSChecked}
                                                                onCheckedChange={() => toggleSubSubcategorySelection(ssLabel)}
                                                                disabled={!isSSChecked && isCategoryLimitReached}
                                                                className={`${isSSChecked ? "data-[state=checked]:bg-primary data-[state=checked]:border-primary" : ""}`} />
                                                            <label htmlFor={`subsub-${ssLabel}`} className="text-sm text-primary cursor-pointer">{ssLabel}</label>
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
        });
    }

    const handleSelectAllCategories = () => {
        const catDict = getCategoriesForGroup(dbGroup);
        if (!catDict || !canSelectAllCategories) return;

        const allLeafCategories: string[] = [];
        const allLeafSubcategories: string[] = [];
        const allSubSubcategories: string[] = [];
        const allCategoryKeys = Object.keys(catDict);
        const allNestedSubcategoryLabels: string[] = [];
        const isBusinessGroup = dbGroup === "business_offerings";

        Object.entries(catDict).forEach(([cat, subs]) => {
            if (!subs.length) {
                allLeafCategories.push(cat);
                return;
            }

            subs.forEach((entry: SubcategoryEntry) => {
                const subLabel = getSubLabel(entry);
                if (isBusinessGroup && hasSubSub(entry)) {
                    allNestedSubcategoryLabels.push(subLabel);
                    entry.subSubcategories.forEach((ss) => allSubSubcategories.push(ss));
                } else {
                    allLeafSubcategories.push(subLabel);
                }
            });
        });

        setSelectedCategories(Array.from(new Set(allLeafCategories)));
        setSelectedSubcategories(Array.from(new Set(allLeafSubcategories)));
        setSelectedSubSubcategories(Array.from(new Set(allSubSubcategories)));
        setExpandedCategories(allCategoryKeys);
        setExpandedSubcategories(Array.from(new Set(allNestedSubcategoryLabels)));
    };

    if (!config) {
        return (
            <div className="flex-1 flex items-center justify-center p-16">
                <p className="text-muted-foreground">Invalid listing type.</p>
            </div>
        );
    }

    const IconComp = config.icon;

    return (
        <div className="flex-1 w-full min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            <div className="max-w-5xl mx-auto p-6 md:p-10 lg:p-14">
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground mb-6 -ml-4" onClick={() => navigate("/partner/dashboard")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </Button>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/20 p-3 rounded-xl border border-primary/30 text-primary">
                            <IconComp className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Add {config.label}</h1>
                            <p className="text-muted-foreground">Select a plan and configure your new listing below</p>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-5 py-3 rounded-xl text-sm">{error}</div>
                    )}

                    {/* ─── Plan Selection Card ─── */}
                    <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md">
                        <CardHeader className="border-b border-foreground/10 pb-4">
                            <CardTitle className="text-xl">Choose your plan</CardTitle>
                            <CardDescription>Select a subscription plan for this listing</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <Label>Payment plan <span className="text-red-400">*</span></Label>
                                    <Select value={plan} onValueChange={val => { setPlan(val); setSelectedCategories([]); setSelectedSubcategories([]); setSelectedSubSubcategories([]); setSelectedCountries([]); setSelectedRegions([]); }}>
                                        <SelectTrigger className="w-full h-12 bg-muted/40 border-foreground/10"><SelectValue placeholder="Select plan" /></SelectTrigger>
                                        <SelectContent className="bg-background/90 border-foreground/10">
                                            {getPlansForGroup().map(p => (
                                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {plan && (
                                        <button type="button" onClick={() => setShowPlanDetails(!showPlanDetails)} className="text-primary text-sm font-semibold hover:underline flex items-center gap-1">
                                            <Info className="w-3.5 h-3.5" /> Click here to check plan details
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <Label>Feature Package (Optional)</Label>
                                    <Select value={addon || "none"} onValueChange={setAddon} disabled>
                                        <SelectTrigger className="w-full h-12 bg-muted/40 border-foreground/10 opacity-70 cursor-not-allowed"><SelectValue placeholder="Available after plan payment" /></SelectTrigger>
                                        <SelectContent className="bg-background/90 border-foreground/10">
                                            <SelectItem value="none">Available after plan payment</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Feature plans are unlocked in Dashboard only after this listing payment is completed.
                                    </p>
                                </div>
                            </div>

                            {showPlanDetails && plan && (
                                <div className="bg-muted/40 border border-foreground/10 rounded-xl p-5 space-y-2">
                                    <h4 className="font-bold text-foreground text-sm uppercase tracking-wider mb-3">Plan Features</h4>
                                    {getPlanDetailsText(plan).map((f, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${f.includes("Extra Feature") ? "text-primary" : "text-green-500"}`} />
                                            <span className={f.includes("Extra Feature") ? "text-primary font-medium" : ""}>{f}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ─── Group-Specific Details (only after plan selected) ─── */}
                    {plan && (
                        <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md">
                            <CardHeader className="border-b border-foreground/10 pb-4">
                                <CardTitle className="text-xl">
                                    {dbGroup === "business_offerings" ? "Business details" :
                                        dbGroup === "consulting" ? "Service details" :
                                            dbGroup === "events" ? "Event details" : "Job details"}
                                </CardTitle>
                                <CardDescription>
                                    {dbGroup === "business_offerings" ? "Select your BSL, certifications, regions, countries and categories" :
                                        dbGroup === "consulting" ? "Select your service regions, countries and categories" :
                                            dbGroup === "events" ? "Provide event information and select categories" :
                                                "Provide job listing details and select categories"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">

                                {/* BUSINESS OFFERINGS */}
                                {dbGroup === "business_offerings" && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                <Label>Bio Safety Level</Label>
                                                <MultiSelectDropdown label="BSL" items={BSL_LEVELS} selected={selectedBSL} onToggle={toggleBSL} open={showBSLDropdown}
                                                    onToggleOpen={() => { setShowBSLDropdown(!showBSLDropdown); setShowCertsDropdown(false); setShowRegionsDropdown(false); setShowCountriesDropdown(false); }} />
                                            </div>
                                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                <Label>Certifications</Label>
                                                <MultiSelectDropdown label="certifications" items={CERTIFICATIONS} selected={selectedCerts} onToggle={toggleCert} open={showCertsDropdown}
                                                    onToggleOpen={() => { setShowCertsDropdown(!showCertsDropdown); setShowBSLDropdown(false); setShowRegionsDropdown(false); setShowCountriesDropdown(false); }} />
                                                {showOtherCertInput && (
                                                    <div className="space-y-1">
                                                        <Input
                                                            autoFocus
                                                            required={showOtherCertInput}
                                                            value={otherCertText}
                                                            onChange={(e) => handleOtherCertTextChange(e.target.value)}
                                                            placeholder='Enter "other" certification'
                                                            className="bg-muted/40 border-foreground/10"
                                                        />
                                                        {!otherCertText.trim() && (
                                                            <p className="text-xs text-muted-foreground">Please enter a value for "Other".</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                <Label>Service region(s)</Label>
                                                <MultiSelectDropdown label="service regions" items={SERVICE_REGIONS} selected={selectedRegions} onToggle={toggleRegion} open={showRegionsDropdown}
                                                    onToggleOpen={() => {
                                                        if (!canUseRegionHelper) return;
                                                        setShowRegionsDropdown(!showRegionsDropdown);
                                                        setShowBSLDropdown(false);
                                                        setShowCertsDropdown(false);
                                                        setShowCountriesDropdown(false);
                                                    }} />
                                                {!canUseRegionHelper && (
                                                    <p className="text-xs text-muted-foreground">Region helper is available only on plans with unlimited countries.</p>
                                                )}
                                            </div>
                                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                <Label>
                                                    Service country(ies) <span className="text-red-400">*</span> :
                                                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                        Selected {selectedCountries.length} of {currentLimits.maxCountries === -1 ? "Unlimited" : currentLimits.maxCountries}
                                                    </span>
                                                </Label>
                                                <MultiSelectDropdown label="countries" selected={selectedCountries} onToggle={toggleCountry} open={showCountriesDropdown}
                                                    onToggleOpen={() => { setShowCountriesDropdown(!showCountriesDropdown); setShowBSLDropdown(false); setShowCertsDropdown(false); setShowRegionsDropdown(false); }}
                                                    disabled={(c) => !selectedCountries.includes(c) && isCountryLimitReached}
                                                    search={countrySearch} setSearch={setCountrySearch} filteredItems={filteredCountries} />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* CONSULTING */}
                                {dbGroup === "consulting" && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                            <Label>Region(s)</Label>
                                            <MultiSelectDropdown label="service regions" items={SERVICE_REGIONS} selected={selectedRegions} onToggle={toggleRegion} open={showRegionsDropdown}
                                                onToggleOpen={() => {
                                                    if (!canUseRegionHelper) return;
                                                    setShowRegionsDropdown(!showRegionsDropdown);
                                                    setShowCountriesDropdown(false);
                                                }} />
                                            {!canUseRegionHelper && (
                                                <p className="text-xs text-muted-foreground">Region helper is available only on plans with unlimited countries.</p>
                                            )}
                                        </div>
                                        <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                            <Label>
                                                Country(ies) <span className="text-red-400">*</span> :
                                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                    Selected {selectedCountries.length} of {currentLimits.maxCountries === -1 ? "Unlimited" : currentLimits.maxCountries}
                                                </span>
                                            </Label>
                                            <MultiSelectDropdown label="countries" selected={selectedCountries} onToggle={toggleCountry} open={showCountriesDropdown}
                                                onToggleOpen={() => { setShowCountriesDropdown(!showCountriesDropdown); setShowRegionsDropdown(false); }}
                                                disabled={(c) => !selectedCountries.includes(c) && isCountryLimitReached}
                                                search={countrySearch} setSearch={setCountrySearch} filteredItems={filteredCountries} />
                                        </div>
                                    </div>
                                )}

                                {/* EVENTS */}
                                {dbGroup === "events" && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>Event name <span className="text-red-400">*</span></Label>
                                            <Input value={eventData.eventName} onChange={e => setEventData(prev => ({ ...prev, eventName: e.target.value }))} required className="bg-muted/40 border-foreground/10" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Event link <span className="text-red-400">*</span></Label>
                                            <Input type="url" placeholder="https://" value={eventData.eventLink} onChange={e => setEventData(prev => ({ ...prev, eventLink: e.target.value }))} required className="bg-muted/40 border-foreground/10" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Start date <span className="text-red-400">*</span></Label>
                                            <Input type="date" value={eventData.startDate} onChange={e => setEventData(prev => ({ ...prev, startDate: e.target.value }))} required className="bg-muted/40 border-foreground/10" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>End date <span className="text-red-400">*</span></Label>
                                            <Input type="date" value={eventData.endDate} onChange={e => setEventData(prev => ({ ...prev, endDate: e.target.value }))} required className="bg-muted/40 border-foreground/10" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Country <span className="text-red-400">*</span></Label>
                                            <Select value={eventData.eventCountry} onValueChange={val => setEventData(prev => ({ ...prev, eventCountry: val }))}>
                                                <SelectTrigger className="w-full h-10 bg-muted/40 border-foreground/10"><SelectValue placeholder="Select country" /></SelectTrigger>
                                                <SelectContent className="bg-background/90 border-foreground/10 max-h-60">
                                                    {SERVICE_COUNTRIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Location <span className="text-red-400">*</span></Label>
                                            <Input placeholder="State/Province/County, City" value={eventData.location} onChange={e => setEventData(prev => ({ ...prev, location: e.target.value }))} required className="bg-muted/40 border-foreground/10" />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label>Event profile <span className="text-red-400">*</span></Label>
                                            <Textarea value={eventData.eventProfile} onChange={e => setEventData(prev => ({ ...prev, eventProfile: e.target.value }))} required className="h-40 bg-muted/40 border-foreground/10 resize-none text-sm" placeholder="Describe the event, agenda, speakers..." />
                                        </div>
                                    </div>
                                )}

                                {/* JOBS */}
                                {dbGroup === "jobs" && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>Job title <span className="text-red-400">*</span></Label>
                                            <Input value={jobData.jobTitle} onChange={e => setJobData(prev => ({ ...prev, jobTitle: e.target.value }))} required className="bg-muted/40 border-foreground/10" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Industry <span className="text-red-400">*</span></Label>
                                            <Select value={jobData.industry} onValueChange={val => setJobData(prev => ({ ...prev, industry: val }))}>
                                                <SelectTrigger className="w-full h-10 bg-muted/40 border-foreground/10"><SelectValue placeholder="Select industry" /></SelectTrigger>
                                                <SelectContent className="bg-background/90 border-foreground/10 max-h-60">
                                                    {["Biotechnology", "Pharmaceutical", "Medical Devices", "Clinical Research", "Diagnostics", "Digital Health", "Life Sciences", "Healthcare", "Other"].map(i => (
                                                        <SelectItem key={i} value={i}>{i}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Position type <span className="text-red-400">*</span></Label>
                                            <Select value={jobData.positionType} onValueChange={val => setJobData(prev => ({ ...prev, positionType: val }))}>
                                                <SelectTrigger className="w-full h-10 bg-muted/40 border-foreground/10"><SelectValue placeholder="Select position type" /></SelectTrigger>
                                                <SelectContent className="bg-background/90 border-foreground/10">
                                                    {["Full-time", "Part-time", "Contract", "Freelance", "Internship", "Temporary"].map(t => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Experience level <span className="text-red-400">*</span></Label>
                                            <Select value={jobData.experienceLevel} onValueChange={val => setJobData(prev => ({ ...prev, experienceLevel: val }))}>
                                                <SelectTrigger className="w-full h-10 bg-muted/40 border-foreground/10"><SelectValue placeholder="Select experience level" /></SelectTrigger>
                                                <SelectContent className="bg-background/90 border-foreground/10">
                                                    {["Entry Level", "Junior", "Mid-Level", "Senior", "Lead", "Director", "Executive"].map(l => (
                                                        <SelectItem key={l} value={l}>{l}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Position link <span className="text-red-400">*</span></Label>
                                            <Input type="url" placeholder="https://" value={jobData.positionLink} onChange={e => setJobData(prev => ({ ...prev, positionLink: e.target.value }))} required className="bg-muted/40 border-foreground/10" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Country <span className="text-red-400">*</span></Label>
                                            <Select value={jobData.jobCountry} onValueChange={val => setJobData(prev => ({ ...prev, jobCountry: val }))}>
                                                <SelectTrigger className="w-full h-10 bg-muted/40 border-foreground/10"><SelectValue placeholder="Select country" /></SelectTrigger>
                                                <SelectContent className="bg-background/90 border-foreground/10 max-h-60">
                                                    {SERVICE_COUNTRIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Location <span className="text-red-400">*</span></Label>
                                            <Input placeholder="State/Province/County, City" value={jobData.location} onChange={e => setJobData(prev => ({ ...prev, location: e.target.value }))} required className="bg-muted/40 border-foreground/10" />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label>Job summary</Label>
                                            <Textarea value={jobData.jobSummary} onChange={e => setJobData(prev => ({ ...prev, jobSummary: e.target.value }))} className="h-32 bg-muted/40 border-foreground/10 resize-none text-sm" placeholder="Describe the role and responsibilities..." />
                                        </div>
                                    </div>
                                )}

                                {/* CATEGORY TREE (shared) */}
                                <div className="pt-6 border-t border-foreground/10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <Label className="text-base font-semibold">Category(ies) <span className="text-red-400">*</span></Label>
                                            <p className="text-xs text-muted-foreground mt-1">Select categories from the lowest level. Parent categories with subcategories expand when clicked.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {canSelectAllCategories && (
                                                <Button type="button" variant="outline" size="sm" onClick={handleSelectAllCategories}>
                                                    Select all
                                                </Button>
                                            )}
                                            <div className={`text-sm font-bold px-3 py-1.5 rounded-full border ${isCategoryLimitReached ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-green-500/10 border-green-500/30 text-green-400"}`}>
                                                {categoryCount} / {currentLimits.maxCategories === -1 ? "∞" : currentLimits.maxCategories}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="max-h-[500px] overflow-y-auto border border-foreground/10 rounded-xl bg-background p-4 space-y-0.5 custom-scrollbar">
                                        {renderCategoryTree()}
                                    </div>
                                    {(selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedSubSubcategories.length > 0) && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {selectedCategories.map(c => (
                                                <span key={c} onClick={() => toggleCategorySelection(c, false)} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs rounded-full border border-green-500/20 cursor-pointer hover:bg-green-500/20 transition-colors">
                                                    {c} <X className="w-3 h-3" />
                                                </span>
                                            ))}
                                            {selectedSubcategories.map(s => (
                                                <span key={s} onClick={() => toggleSubcategorySelection(s, false)} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs rounded-full border border-green-500/20 cursor-pointer hover:bg-green-500/20 transition-colors">
                                                    {s} <X className="w-3 h-3" />
                                                </span>
                                            ))}
                                            {selectedSubSubcategories.map(ss => (
                                                <span key={ss} onClick={() => toggleSubSubcategorySelection(ss)} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors">
                                                    {ss} <X className="w-3 h-3" />
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-foreground/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">Company representative(s)</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={addRepresentative}>Add representative</Button>
                                    </div>
                                    {availableRepresentatives.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground">Choose from existing representatives</p>
                                            <div className="flex flex-wrap gap-2">
                                                {availableRepresentatives.map((rep) => (
                                                    <Button
                                                        key={representativeKey(rep)}
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addRepresentativeFromSaved(rep)}
                                                    >
                                                        {rep.firstName} {rep.lastName} - {rep.email}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {companyRepresentatives.length === 0 && (
                                        <p className="text-xs text-muted-foreground">Optional: Add a new representative or choose one from existing contacts.</p>
                                    )}
                                    <div className="space-y-3">
                                        {companyRepresentatives.map((rep, index) => (
                                            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <Input
                                                    value={rep.firstName}
                                                    onChange={(e) => updateRepresentative(index, "firstName", e.target.value)}
                                                    placeholder="First name"
                                                    className="bg-muted/40 border-foreground/10"
                                                />
                                                <Input
                                                    value={rep.lastName}
                                                    onChange={(e) => updateRepresentative(index, "lastName", e.target.value)}
                                                    placeholder="Last name"
                                                    className="bg-muted/40 border-foreground/10"
                                                />
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="email"
                                                        value={rep.email}
                                                        onChange={(e) => updateRepresentative(index, "email", e.target.value)}
                                                        placeholder="Email"
                                                        className="bg-muted/40 border-foreground/10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeRepresentative(index)}
                                                        className="shrink-0"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Submit */}
                    <div className="flex justify-end pt-4 pb-20">
                        <Button type="button" variant="outline" className="mr-4 border-foreground/10" onClick={() => navigate("/partner/dashboard")}>Cancel</Button>
                        <Button type="submit" size="lg" className="h-14 px-10 shadow-lg shadow-primary/20 text-lg" disabled={isLoading || !plan || groupPurchaseLock.blocked}>
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Redirecting to Stripe...
                                </span>
                            ) : (
                                <><ArrowRight className="mr-2 h-5 w-5" /> Continue to Payment</>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

import { useState, useEffect, useMemo } from "react";
import { Building2, Globe, Building, Linkedin, Receipt, UploadCloud, ArrowRight, ChevronRight, ChevronDown, Check, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { auth, db } from "@/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { logActivity } from "@/lib/auditLogger";
import { API_BASE_URL } from "@/apiConfig";
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

// Import actual categories from AllCategories
import {
    BUSINESS_CATEGORIES,
    CONSULTING_CATEGORIES,
    EVENTS_CATEGORIES,
    JOBS_CATEGORIES,
    type SubcategoryEntry,
    type CategoriesDict,
} from "./AllCategories";

// ─── Plan limits ───
interface PlanLimits {
    maxCategories: number; // -1 = unlimited
    maxCountries: number;
}

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

// ─── Service Regions ───
const SERVICE_REGIONS = [
    "North America", "South America", "Europe", "Asia Pacific",
    "Middle East", "Africa", "Australia & Oceania",
];

// ─── Service Countries ───
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

// ─── BSL Levels ───
const BSL_LEVELS = ["1", "2", "3", "4"];

// ─── Certifications ───
const CERTIFICATIONS = ["GMP", "CE", "ISO 13485", "ISO 9001", "Others"];

// ─── Helper: get subcategory label ───
const getSubLabel = (entry: SubcategoryEntry): string =>
    typeof entry === "string" ? entry : entry.label;

const hasSubSub = (entry: SubcategoryEntry): entry is { label: string; subSubcategories: string[] } =>
    typeof entry !== "string";

export default function CompleteProfile() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Plan details popover
    const [showPlanDetails, setShowPlanDetails] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        firstName: "", lastName: "", email: "", phone: "",
        altName: "", altEmail: "",
        companyName: "", companyWebsite: "", businessPhone: "", linkedin: "",
        billingEmail: "", businessId: "",
        companyProfile: "", businessAddress: "",
        group: "", plan: "", addon: "",
    });

    // ─── Business details state ───
    const [selectedBSL, setSelectedBSL] = useState<string[]>([]);
    const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

    // ─── Event details state ───
    const [eventData, setEventData] = useState({
        eventName: "", eventLink: "", startDate: "", endDate: "",
        eventCountry: "", location: "", eventProfile: "",
    });

    // ─── Job details state ───
    const [jobData, setJobData] = useState({
        jobTitle: "", industry: "", positionType: "", experienceLevel: "",
        positionLink: "", jobCountry: "", location: "",
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

    // Load existing data
    useEffect(() => {
        const fetchUserData = async () => {
            if (auth.currentUser) {
                const docRef = doc(db, "partnersCollection", auth.currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const [fName, ...lNames] = (data.primaryName || "").split(" ");
                    setFormData(prev => ({
                        ...prev,
                        firstName: fName || "", lastName: lNames.join(" ") || "",
                        email: data.primaryEmail || "", companyName: data.businessName || "",
                        phone: data.phoneNumber || "", altName: data.secondaryName || "",
                        altEmail: data.secondaryEmail || "", billingEmail: data.billingEmailAddress || "",
                    }));
                }
            }
        };
        fetchUserData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleSelectChange = (field: string, value: string) => {
        if (field === "group") {
            setFormData(prev => ({ ...prev, group: value, plan: "", addon: "none" }));
            // Reset business details when group changes
            setSelectedBSL([]); setSelectedCerts([]); setSelectedRegions([]);
            setSelectedCountries([]); setSelectedCategories([]);
            setSelectedSubcategories([]); setSelectedSubSubcategories([]);
            setExpandedCategories([]); setExpandedSubcategories([]);
        } else if (field === "plan") {
            setFormData(prev => ({ ...prev, plan: value }));
            // Reset categories/countries when plan changes (limits might differ)
            setSelectedCategories([]); setSelectedSubcategories([]); setSelectedSubSubcategories([]);
            setSelectedCountries([]);
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };

    // ─── Current plan limits ───
    const currentLimits = PLAN_LIMITS[formData.plan] || { maxCategories: 0, maxCountries: 0 };

    // ─── Count selected categories from lowest level ───
    const categoryCount = useMemo(() => {
        const catDict = getCategoriesForGroup(formData.group);
        if (!catDict) return 0;
        let count = 0;

        // For categories with no subcategories, they count directly if selected
        for (const [cat, subs] of Object.entries(catDict)) {
            if (subs.length === 0) {
                if (selectedCategories.includes(cat)) count++;
            } else {
                // For categories with subs, count the selected subcategories
                for (const entry of subs) {
                    const subLabel = getSubLabel(entry);
                    if (hasSubSub(entry)) {
                        // 3-level: count selected sub-subcategories under this sub
                        for (const ssLabel of entry.subSubcategories) {
                            if (selectedSubSubcategories.includes(ssLabel)) count++;
                        }
                        // If the sub itself is checked but has subSubs, don't double count
                    } else {
                        // 2-level: count if the subcategory is selected
                        if (selectedSubcategories.includes(subLabel)) count++;
                    }
                }
            }
        }
        return count;
    }, [formData.group, selectedCategories, selectedSubcategories, selectedSubSubcategories]);

    const isCategoryLimitReached = currentLimits.maxCategories !== -1 && categoryCount >= currentLimits.maxCategories;
    const isCountryLimitReached = currentLimits.maxCountries !== -1 && selectedCountries.length >= currentLimits.maxCountries;

    // ─── Category tree helpers ───
    function getCategoriesForGroup(group: string): CategoriesDict | Record<string, string[]> | null {
        switch (group) {
            case "business_offerings": return BUSINESS_CATEGORIES;
            case "consulting": return CONSULTING_CATEGORIES;
            case "events": return EVENTS_CATEGORIES;
            case "jobs": return JOBS_CATEGORIES;
            default: return null;
        }
    }

    const toggleExpandCategory = (cat: string) => {
        setExpandedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };
    const toggleExpandSubcategory = (sub: string) => {
        setExpandedSubcategories(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]);
    };

    // Toggle a leaf-level category (or parent if no subs)
    const toggleCategorySelection = (cat: string, hasSubs: boolean) => {
        if (hasSubs) {
            // Just expand/collapse — parent with subs doesn't count
            toggleExpandCategory(cat);
            return;
        }
        // Parent with no subs — counts as 1
        if (selectedCategories.includes(cat)) {
            setSelectedCategories(prev => prev.filter(c => c !== cat));
        } else {
            if (isCategoryLimitReached) return; // respect limit
            setSelectedCategories(prev => [...prev, cat]);
        }
    };

    const toggleSubcategorySelection = (sub: string, hasSubSubs: boolean) => {
        if (hasSubSubs) {
            toggleExpandSubcategory(sub);
            return;
        }
        if (selectedSubcategories.includes(sub)) {
            setSelectedSubcategories(prev => prev.filter(s => s !== sub));
        } else {
            if (isCategoryLimitReached) return;
            setSelectedSubcategories(prev => [...prev, sub]);
        }
    };

    const toggleSubSubcategorySelection = (subSub: string) => {
        if (selectedSubSubcategories.includes(subSub)) {
            setSelectedSubSubcategories(prev => prev.filter(s => s !== subSub));
        } else {
            if (isCategoryLimitReached) return;
            setSelectedSubSubcategories(prev => [...prev, subSub]);
        }
    };

    // ─── Multi-select toggle handlers ───
    const toggleBSL = (val: string) => setSelectedBSL(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    const toggleCert = (val: string) => setSelectedCerts(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    const toggleRegion = (val: string) => setSelectedRegions(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    const toggleCountry = (val: string) => {
        if (selectedCountries.includes(val)) {
            setSelectedCountries(prev => prev.filter(v => v !== val));
        } else {
            if (isCountryLimitReached) return;
            setSelectedCountries(prev => [...prev, val]);
        }
    };

    const getPlansForGroup = (group: string) => {
        switch (group) {
            case 'business_offerings': case 'consulting':
                return [
                    { value: 'basic_mo', label: 'Basic (Monthly) - $100.00' },
                    { value: 'standard_mo', label: 'Standard (Monthly) - $200.00' },
                    { value: 'premium_mo', label: 'Premium (Monthly) - $400.00' },
                    { value: 'premium_plus_mo', label: 'Premium Plus (Monthly) - $1000.00' },
                    { value: 'basic_yr', label: 'Basic (Annual) - $1,080.00' },
                    { value: 'standard_yr', label: 'Standard (Annual) - $2,184.00' },
                    { value: 'premium_yr', label: 'Premium (Annual) - $4,320.00' },
                    { value: 'premium_plus_yr', label: 'Premium Plus (Annual) - $10,800.00' },
                ];
            case 'events':
                return [
                    { value: 'basic_event', label: 'Basic - $500.00' },
                    { value: 'standard_event', label: 'Standard - $850.00' },
                    { value: 'premium_event', label: 'Premium - $1,250.00' },
                    { value: 'premium_plus_event', label: 'Premium Plus - $1,450.00' },
                ];
            case 'jobs':
                return [
                    { value: 'standard_job', label: 'Standard - $400.00' },
                    { value: 'premium_job', label: 'Premium - $800.00' },
                    { value: 'premium_plus_job', label: 'Premium Plus - $1,000.00' },
                ];
            default: return [];
        }
    };

    const getAddonsForGroup = (group: string) => {
        switch (group) {
            case 'business_offerings': case 'consulting':
                return [
                    { value: 'addon_landing', label: 'Landing page (within module) - $400.00' },
                    { value: 'addon_home', label: 'Home page/Brand Visibility - $800.00' },
                    { value: 'addon_both', label: 'Both (Listing promotion) - $1000.00' },
                ];
            case 'events': case 'jobs':
                return [
                    { value: 'addon_visibility', label: 'Brand visibility on home page - $800.00' },
                    { value: 'addon_both', label: 'Both (Module & Home page) - $1000.00' },
                ];
            default: return [];
        }
    };

    // ─── Plan details text ───
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
            "Certifications (optional)",
            "Biosafety level (optional) — BSL disclosure",
            ...(planId.includes("premium_plus") ? ["Extra Feature: Homepage spotlight for increased visibility"] : []),
        ];
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setSuccess("");

        if (!formData.group || !formData.plan) {
            setError("Please select a group and plan before continuing.");
            return;
        }

        try {
            if (!auth.currentUser) throw new Error("No authenticated user found. Please login.");

            // Bypassing email verification for testing phase
            // await auth.currentUser.reload();
            // if (!auth.currentUser.emailVerified) {
            //     throw new Error("Your email address has not been verified yet. Please check your inbox and verify before continuing.");
            // }

            setIsLoading(true);

            // Save profile + business details to Firestore
            const partnerRef = doc(db, "partnersCollection", auth.currentUser.uid);
            const updateData: Record<string, any> = {
                primaryName: `${formData.firstName} ${formData.lastName}`.trim(),
                primaryEmail: formData.email,
                phoneNumber: formData.phone,
                secondaryName: formData.altName,
                secondaryEmail: formData.altEmail,
                businessName: formData.companyName,
                companyWebsite: formData.companyWebsite,
                businessPhoneNumber: formData.businessPhone,
                linkedInProfileLink: formData.linkedin,
                billingEmailAddress: formData.billingEmail,
                VAT_ABN_EIN_businessId: formData.businessId,
                companyProfileText: formData.companyProfile,
                businessAddress: formData.businessAddress,
                selectedGroup: formData.group,
                selectedPlan: formData.plan,
                selectedAddon: formData.addon === "none" ? "" : formData.addon,
                selectedCategories, selectedSubcategories, selectedSubSubcategories,
            };

            // Group-specific fields
            if (formData.group === "business_offerings") {
                Object.assign(updateData, { bioSafetyLevel: selectedBSL, certifications: selectedCerts, serviceRegions: selectedRegions, serviceCountries: selectedCountries });
            } else if (formData.group === "consulting") {
                Object.assign(updateData, { serviceRegions: selectedRegions, serviceCountries: selectedCountries });
            } else if (formData.group === "events") {
                Object.assign(updateData, { ...eventData });
            } else if (formData.group === "jobs") {
                Object.assign(updateData, { ...jobData });
            }

            await updateDoc(partnerRef, updateData);

            // Log to Audit Trail
            await logActivity({
                partnerId: auth.currentUser.uid,
                partnerName: formData.companyName,
                action: "ACCOUNT_UPDATED",
                details: `Partner profile completed/updated. Group: ${formData.group.replace(/_/g, " ")}, Plan: ${formData.plan.replace(/_/g, " ")}.`,
                category: "account",
                metadata: {
                    group: formData.group,
                    plan: formData.plan,
                    categoriesCount: categoryCount
                }
            });

            // Call backend to create Stripe Checkout Session
            const origin = window.location.origin;
            const resp = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId: formData.plan,
                    group: formData.group,
                    partnerId: auth.currentUser.uid,
                    partnerEmail: formData.email,
                    successUrl: `${origin}/partner/dashboard?payment=success`,
                    cancelUrl: `${origin}/partner/complete-profile?payment=cancelled`,
                }),
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error || "Failed to create checkout session");
            }

            // Redirect to Stripe Checkout
            window.location.href = data.url;

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred while saving your profile.");
            setIsLoading(false);
        }
    };

    const filteredCountries = SERVICE_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()));

    // ─── Render category tree ───
    function renderCategoryTree() {
        const catDict = getCategoriesForGroup(formData.group);
        if (!catDict) return null;

        const isBusinessGroup = formData.group === "business_offerings";

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
                            <Checkbox
                                id={`cat-${cat}`}
                                checked={hasSubs ? isExpanded : isParentSelected}
                                onCheckedChange={() => toggleCategorySelection(cat, hasSubs)}
                                disabled={!hasSubs && !isParentSelected && isCategoryLimitReached}
                                className={hasSubs && isExpanded ? "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" : ""}
                            />
                            <label htmlFor={`cat-${cat}`} className={`text-sm leading-none cursor-pointer ${hasSubs ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                                {cat}
                            </label>
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

                                            <Checkbox
                                                id={`sub-${cat}-${subLabel}`}
                                                checked={isNested ? isSubExpanded : isSubChecked}
                                                onCheckedChange={() => toggleSubcategorySelection(subLabel, isNested || false)}
                                                disabled={!isNested && !isSubChecked && isCategoryLimitReached}
                                                className={`${isSubChecked ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`}
                                            />
                                            <label htmlFor={`sub-${cat}-${subLabel}`} className="text-sm text-green-700 dark:text-green-400 cursor-pointer">
                                                {subLabel}
                                            </label>
                                        </div>

                                        {isNested && isSubExpanded && hasSubSub(entry) && (
                                            <div className="ml-6 pl-3 border-l border-primary/20 space-y-0.5 mb-1">
                                                {entry.subSubcategories.map(ssLabel => {
                                                    const isSsChecked = selectedSubSubcategories.includes(ssLabel);
                                                    return (
                                                        <div key={ssLabel} className="flex items-center gap-2 py-0.5">
                                                            <Checkbox
                                                                id={`ssub-${cat}-${subLabel}-${ssLabel}`}
                                                                checked={isSsChecked}
                                                                onCheckedChange={() => toggleSubSubcategorySelection(ssLabel)}
                                                                disabled={!isSsChecked && isCategoryLimitReached}
                                                                className={`${isSsChecked ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`}
                                                            />
                                                            <label htmlFor={`ssub-${cat}-${subLabel}-${ssLabel}`} className="text-xs text-muted-foreground cursor-pointer">
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
        });
    }

    // ─── Multi-select dropdown component ───
    function MultiSelectDropdown({ label, items, selected, onToggle, open, onToggleOpen, disabled, search, setSearch, filteredItems }: {
        label: string; items?: string[]; selected: string[]; onToggle: (v: string) => void; open: boolean; onToggleOpen: () => void; disabled?: (v: string) => boolean;
        search?: string; setSearch?: (v: string) => void; filteredItems?: string[];
    }) {
        const displayItems = filteredItems || items || [];
        return (
            <div className="relative">
                <div
                    onClick={onToggleOpen}
                    className="flex min-h-[44px] w-full items-center gap-2 flex-wrap rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm cursor-pointer hover:border-foreground/20 transition-colors"
                >
                    {selected.length === 0 ? (
                        <span className="text-muted-foreground">Choose your {label.toLowerCase()} (multi-select enabled)</span>
                    ) : (
                        selected.map(s => (
                            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-foreground/10 text-foreground text-xs rounded-md border border-foreground/10">
                                <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={(e) => { e.stopPropagation(); onToggle(s); }} />
                                {s}
                            </span>
                        ))
                    )}
                </div>
                {open && (
                    <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-background border border-foreground/10 rounded-lg shadow-xl">
                        {setSearch && (
                            <div className="p-2 border-b border-foreground/10 sticky top-0 bg-background">
                                <Input
                                    placeholder="Search..."
                                    value={search || ""}
                                    onChange={e => setSearch(e.target.value)}
                                    className="h-8 text-sm bg-foreground/5 border-foreground/10"
                                    onClick={e => e.stopPropagation()}
                                />
                            </div>
                        )}
                        {displayItems.map(item => {
                            const isSelected = selected.includes(item);
                            const isDisabled = disabled ? disabled(item) : false;
                            return (
                                <div
                                    key={item}
                                    onClick={() => { if (!isDisabled || isSelected) onToggle(item); }}
                                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors
                                        ${isSelected ? "bg-primary/10 text-primary font-medium" : isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-foreground/5 text-foreground"}`}
                                >
                                    <span>{item}</span>
                                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                                </div>
                            );
                        })}
                        {displayItems.length === 0 && (
                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">No results</div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setShowBSLDropdown(false);
            setShowCertsDropdown(false);
            setShowRegionsDropdown(false);
            setShowCountriesDropdown(false);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    return (
        <div className="flex-1 bg-background text-foreground py-12 px-4 relative overflow-hidden">
            <div className="container max-w-5xl mx-auto relative z-10">

                <div className="mb-10 text-center md:text-left border-b border-foreground/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Complete Your Profile</h1>
                        <p className="text-muted-foreground">Please fill out the remainder of your partner business information.</p>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-foreground/5 border border-foreground/10 px-4 py-2 rounded-full text-sm text-primary">
                        <Building2 className="w-4 h-4" /> Partner Status: <span className="text-foreground font-medium">Pending Verification</span>
                    </div>
                </div>

                {error && <div className="mb-8 p-4 bg-destructive/20 border border-destructive/50 rounded-lg text-destructive-foreground">{error}</div>}
                {success && <div className="mb-8 p-4 bg-primary/20 border border-primary/50 rounded-lg text-primary/80">{success}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="space-y-8">
                        {/* Partner Information */}
                        <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md">
                            <CardHeader className="border-b border-foreground/10 pb-4">
                                <CardTitle className="text-xl">Partner Information</CardTitle>
                                <CardDescription>Primary and alternate contact details for your account</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First name *</Label>
                                    <Input id="firstName" value={formData.firstName} onChange={handleChange} required className="bg-muted/40 border-foreground/10" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last name *</Label>
                                    <Input id="lastName" value={formData.lastName} onChange={handleChange} required className="bg-muted/40 border-foreground/10" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email *</Label>
                                    <Input id="email" type="email" value={formData.email} onChange={handleChange} required className="bg-muted/40 border-foreground/10" disabled={!!auth.currentUser} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone *</Label>
                                    <PhoneInput id="phone" international defaultCountry="US" value={formData.phone}
                                        onChange={(value) => setFormData(prev => ({ ...prev, phone: value || '' }))}
                                        className="flex h-10 w-full rounded-md border border-foreground/10 bg-muted/40 px-3 py-2 text-sm" />
                                </div>
                                <div className="space-y-2 pt-4 border-t border-foreground/10 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="altName">Alternate contact first & last name</Label>
                                        <Input id="altName" value={formData.altName} onChange={handleChange} className="bg-muted/40 border-foreground/10" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="altEmail">Alternate email address</Label>
                                        <Input id="altEmail" type="email" value={formData.altEmail} onChange={handleChange} className="bg-muted/40 border-foreground/10" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Business Details */}
                        <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md">
                            <CardHeader className="border-b border-foreground/10 pb-4">
                                <CardTitle className="text-xl">Business Details</CardTitle>
                                <CardDescription>Company information visible to the network</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="companyName">Company name *</Label>
                                    <div className="relative"><Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="companyName" value={formData.companyName} onChange={handleChange} required className="pl-9 bg-muted/40 border-foreground/10" /></div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyWebsite">Company website *</Label>
                                    <div className="relative"><Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="companyWebsite" type="url" placeholder="https://" value={formData.companyWebsite} onChange={handleChange} required className="pl-9 bg-muted/40 border-foreground/10" /></div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="businessPhone">Business phone *</Label>
                                    <PhoneInput id="businessPhone" international defaultCountry="US" value={formData.businessPhone}
                                        onChange={(value) => setFormData(prev => ({ ...prev, businessPhone: value || '' }))}
                                        className="flex h-10 w-full rounded-md border border-foreground/10 bg-muted/40 px-3 py-2 text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="linkedin">LinkedIn profile</Label>
                                    <div className="relative"><Linkedin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="linkedin" value={formData.linkedin} onChange={handleChange} placeholder="https://linkedin.com/company/..." className="pl-9 bg-muted/40 border-foreground/10" /></div>
                                </div>

                                <div className="space-y-2 md:col-span-2 pt-2">
                                    <Label>Company logo</Label>
                                    <div className="flex items-center gap-4">
                                        <div className="h-20 w-20 flex-shrink-0 bg-black/60 rounded-xl border border-dashed border-foreground/20 flex items-center justify-center text-muted-foreground"><UploadCloud className="h-6 w-6" /></div>
                                        <div className="flex-1">
                                            <Input type="file" className="bg-muted/40 border-foreground/10 text-sm h-10 pt-2 cursor-pointer" accept="image/jpeg, image/png" />
                                            <p className="text-xs text-muted-foreground mt-2">Formats: JPG, JPEG, PNG | Max size: 2MB | Dimensions: 200px x 200px</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-foreground/10 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="billingEmail">Billing / finance email address</Label>
                                        <div className="relative"><Receipt className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="billingEmail" type="email" value={formData.billingEmail} onChange={handleChange} className="pl-9 bg-primary/10 border-primary/30" /></div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="businessId">VAT/ABN/EIN/Business ID</Label>
                                        <Input id="businessId" value={formData.businessId} onChange={handleChange} className="bg-primary/10 border-primary/30" placeholder="(recommended for accurate invoicing and taxes)" />
                                    </div>
                                </div>

                                <div className="space-y-2 md:col-span-1">
                                    <Label htmlFor="companyProfile">Company profile *</Label>
                                    <Textarea id="companyProfile" value={formData.companyProfile} onChange={handleChange} required className="h-40 bg-muted/40 border-foreground/10 resize-none text-sm" placeholder="Briefly describe your company's mission and offerings..." />
                                </div>
                                <div className="space-y-2 md:col-span-1">
                                    <Label htmlFor="businessAddress">Business address</Label>
                                    <Textarea id="businessAddress" value={formData.businessAddress} onChange={handleChange} className="h-40 bg-muted/40 border-foreground/10 resize-none text-sm" placeholder={"123 Science Way\nSuite 100\nSan Francisco, CA 94107"} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Group & Plan Selection */}
                        <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md">
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <Label>Select group <span className="text-red-400">*</span></Label>
                                    <Select value={formData.group} onValueChange={(val) => handleSelectChange("group", val)} required>
                                        <SelectTrigger className="w-full h-12 bg-muted/40 border-foreground/10"><SelectValue placeholder="Select group" /></SelectTrigger>
                                        <SelectContent className="bg-background/90 border-foreground/10">
                                            <SelectItem value="business_offerings">Business Offerings</SelectItem>
                                            <SelectItem value="consulting">Consulting Services</SelectItem>
                                            <SelectItem value="events">Events & Conferences</SelectItem>
                                            <SelectItem value="jobs">Jobs</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-3">
                                    <Label>Payment plans <span className="text-red-400">*</span></Label>
                                    <Select value={formData.plan} onValueChange={(val) => handleSelectChange("plan", val)} required disabled={!formData.group}>
                                        <SelectTrigger className="w-full h-12 bg-muted/40 border-foreground/10"><SelectValue placeholder={formData.group ? "Select plan" : "Select a group first"} /></SelectTrigger>
                                        <SelectContent className="bg-background/90 border-foreground/10">
                                            {getPlansForGroup(formData.group).map(plan => (
                                                <SelectItem key={plan.value} value={plan.value}>{plan.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {formData.plan && (
                                        <button type="button" onClick={() => setShowPlanDetails(!showPlanDetails)} className="text-primary text-sm font-semibold hover:underline flex items-center gap-1">
                                            <Info className="w-3.5 h-3.5" /> Click here to check plan details
                                        </button>
                                    )}
                                </div>

                                {/* Plan details popover */}
                                {showPlanDetails && formData.plan && (
                                    <div className="md:col-span-2 bg-muted/40 border border-foreground/10 rounded-xl p-5 space-y-2">
                                        <h4 className="font-bold text-foreground text-sm uppercase tracking-wider mb-3">Plan Features</h4>
                                        {getPlanDetailsText(formData.plan).map((f, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                                                <Check className={`w-4 h-4 shrink-0 mt-0.5 ${f.includes("Extra Feature") ? "text-primary" : "text-green-500"}`} />
                                                <span className={f.includes("Extra Feature") ? "text-primary font-medium" : ""}>{f}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {formData.group && (
                                    <div className="space-y-3 md:col-span-2 pt-4 border-t border-foreground/10">
                                        <Label>Separate Feature Package (Optional Upgrade)</Label>
                                        <Select value={formData.addon} onValueChange={(val) => handleSelectChange("addon", val)}>
                                            <SelectTrigger className="w-full h-12 bg-primary/10 border-primary/30"><SelectValue placeholder="No additional features selected" /></SelectTrigger>
                                            <SelectContent className="bg-background/90 border-foreground/10">
                                                <SelectItem value="none">No additional features</SelectItem>
                                                {getAddonsForGroup(formData.group).map(addon => (
                                                    <SelectItem key={addon.value} value={addon.value}>{addon.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* ─── GROUP-SPECIFIC DETAILS (only after plan selected) ─── */}
                        {formData.plan && (
                            <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md">
                                <CardHeader className="border-b border-foreground/10 pb-4">
                                    <CardTitle className="text-xl">
                                        {formData.group === "business_offerings" ? "Business details" :
                                            formData.group === "consulting" ? "Service details" :
                                                formData.group === "events" ? "Event details" : "Job details"}
                                    </CardTitle>
                                    <CardDescription>
                                        {formData.group === "business_offerings" ? "Select your BSL, certifications, regions, countries and categories" :
                                            formData.group === "consulting" ? "Select your service regions, countries and categories" :
                                                formData.group === "events" ? "Provide event information and select categories" :
                                                    "Provide job listing details and select categories"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">

                                    {/* ═══ BUSINESS OFFERINGS: BSL + Certs + Regions + Countries ═══ */}
                                    {formData.group === "business_offerings" && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                    <Label>Bio Safety Level</Label>
                                                    <MultiSelectDropdown
                                                        label="BSL" items={BSL_LEVELS} selected={selectedBSL}
                                                        onToggle={toggleBSL} open={showBSLDropdown}
                                                        onToggleOpen={() => { setShowBSLDropdown(!showBSLDropdown); setShowCertsDropdown(false); setShowRegionsDropdown(false); setShowCountriesDropdown(false); }}
                                                    />
                                                </div>
                                                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                    <Label>Certifications</Label>
                                                    <MultiSelectDropdown
                                                        label="certifications" items={CERTIFICATIONS} selected={selectedCerts}
                                                        onToggle={toggleCert} open={showCertsDropdown}
                                                        onToggleOpen={() => { setShowCertsDropdown(!showCertsDropdown); setShowBSLDropdown(false); setShowRegionsDropdown(false); setShowCountriesDropdown(false); }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                    <Label>Service region(s)</Label>
                                                    <MultiSelectDropdown
                                                        label="service regions" items={SERVICE_REGIONS} selected={selectedRegions}
                                                        onToggle={toggleRegion} open={showRegionsDropdown}
                                                        onToggleOpen={() => { setShowRegionsDropdown(!showRegionsDropdown); setShowBSLDropdown(false); setShowCertsDropdown(false); setShowCountriesDropdown(false); }}
                                                    />
                                                </div>
                                                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                    <Label>
                                                        Service country(ies) <span className="text-red-400">*</span> :
                                                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                            Selected {selectedCountries.length} of {currentLimits.maxCountries === -1 ? "Unlimited" : currentLimits.maxCountries}
                                                        </span>
                                                    </Label>
                                                    <MultiSelectDropdown
                                                        label="countries" selected={selectedCountries}
                                                        onToggle={toggleCountry} open={showCountriesDropdown}
                                                        onToggleOpen={() => { setShowCountriesDropdown(!showCountriesDropdown); setShowBSLDropdown(false); setShowCertsDropdown(false); setShowRegionsDropdown(false); }}
                                                        disabled={(c) => !selectedCountries.includes(c) && isCountryLimitReached}
                                                        search={countrySearch} setSearch={setCountrySearch} filteredItems={filteredCountries}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* ═══ CONSULTING: Regions + Countries ═══ */}
                                    {formData.group === "consulting" && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                <Label>Region(s)</Label>
                                                <MultiSelectDropdown
                                                    label="service regions" items={SERVICE_REGIONS} selected={selectedRegions}
                                                    onToggle={toggleRegion} open={showRegionsDropdown}
                                                    onToggleOpen={() => { setShowRegionsDropdown(!showRegionsDropdown); setShowCountriesDropdown(false); }}
                                                />
                                            </div>
                                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                <Label>
                                                    Country(ies) <span className="text-red-400">*</span> :
                                                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                        Selected {selectedCountries.length} of {currentLimits.maxCountries === -1 ? "Unlimited" : currentLimits.maxCountries}
                                                    </span>
                                                </Label>
                                                <MultiSelectDropdown
                                                    label="countries" selected={selectedCountries}
                                                    onToggle={toggleCountry} open={showCountriesDropdown}
                                                    onToggleOpen={() => { setShowCountriesDropdown(!showCountriesDropdown); setShowRegionsDropdown(false); }}
                                                    disabled={(c) => !selectedCountries.includes(c) && isCountryLimitReached}
                                                    search={countrySearch} setSearch={setCountrySearch} filteredItems={filteredCountries}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* ═══ EVENTS: Event fields ═══ */}
                                    {formData.group === "events" && (
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
                                                <Label>Agenda (PDF) <span className="text-red-400">*</span></Label>
                                                <Input type="file" accept=".pdf" className="bg-muted/40 border-foreground/10 text-sm h-10 pt-2 cursor-pointer" />
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
                                                <p className="text-xs text-muted-foreground">1000 Characters left</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* ═══ JOBS: Job fields ═══ */}
                                    {formData.group === "jobs" && (
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
                                                <Label>Job description (PDF) <span className="text-red-400">*</span></Label>
                                                <Input type="file" accept=".pdf" className="bg-muted/40 border-foreground/10 text-sm h-10 pt-2 cursor-pointer" />
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
                                        </div>
                                    )}

                                    {/* ═══ CATEGORY TREE (shared by all groups) ═══ */}
                                    <div className="pt-6 border-t border-foreground/10">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <Label className="text-base font-semibold">
                                                    Category(ies) <span className="text-red-400">*</span>
                                                </Label>
                                                <p className="text-xs text-muted-foreground mt-1">Select categories from the lowest level. Parent categories with subcategories expand when clicked.</p>
                                            </div>
                                            <div className={`text-sm font-bold px-3 py-1.5 rounded-full border ${isCategoryLimitReached ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-green-500/10 border-green-500/30 text-green-400"}`}>
                                                {categoryCount} / {currentLimits.maxCategories === -1 ? "∞" : currentLimits.maxCategories}
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
                                </CardContent>
                            </Card>
                        )}

                        {/* Submit Button */}
                        <div className="flex justify-end pt-4 pb-20">
                            <Button type="submit" size="lg" className="h-14 px-10 shadow-lg shadow-primary/20 text-lg sticky bottom-6 z-40" disabled={isLoading}>
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
                    </div>
                </form>
            </div>
        </div>
    );
}

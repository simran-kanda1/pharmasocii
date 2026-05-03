import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "@/firebase";
import { doc, getDoc, updateDoc, collection, query, onSnapshot, where, writeBatch, getDocs } from "firebase/firestore";
import { logActivity } from "@/lib/auditLogger";
import { onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateEmail, reload } from "firebase/auth";
import { API_BASE_URL } from "@/apiConfig";
import { buildDisplayCategoryFields, sanitizeLowestLevelSelections } from "@/lib/categorySelection";
import { isValidBusinessAddress } from "@/lib/addressValidation";
import { getPasswordPolicyChecks, isPasswordPolicyValid, PASSWORD_POLICY_ERROR_MESSAGE } from "@/lib/passwordPolicy";
import { formatPartnerTransaction, sortPartnerTransactionsNewestFirst, type PartnerTransactionRow } from "@/lib/partnerTransactions";
import {
    downloadPartnerTransactionsCsv,
    downloadPartnerTransactionsExcel,
    downloadPartnerTransactionsPdf,
} from "@/lib/transactionExport";
import { normalizeServiceCountriesToArray } from "@/lib/utils";
import { uploadJobDescriptionPdf, validateJobDescriptionPdf } from "@/lib/jobDescriptionUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    LayoutDashboard, User, KeyRound, Receipt, LogOut, Download, FileSpreadsheet, FileText, Info,
    Building, Mail, Phone, MapPin,
    PlusCircle, LayoutList, Save, CheckCircle2,
    Clock, ChevronDown, ChevronRight, UploadCloud, Eye, EyeOff,
    CreditCard, Calendar, Star, Sparkles, Crown, Check, X,
    Edit3, ArrowUpCircle, XCircle, AlertTriangle, Globe, Tag
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import {
    BUSINESS_CATEGORIES, CONSULTING_CATEGORIES, EVENTS_CATEGORIES, JOBS_CATEGORIES,
    type SubcategoryEntry, type CategoriesDict,
} from "../AllCategories";
import { REGION_COUNTRY_MAP } from "@/constants/regions";



type TabType = "dashboard" | "profile" | "password" | "transactions";
type CancelScope = "feature" | "plan";

// ─── PLAN CONFIG ───
// Maps plan IDs to their limits and features
interface PlanConfig {
    label: string;
    subtitle: string;
    price: string;
    period: string;
    maxCategories: number; // -1 = unlimited
    maxCountries: number;  // -1 = unlimited
    features: string[];
    featurePlan?: string; // which feature spotlight comes included
}

const PLAN_CONFIGS: Record<string, PlanConfig> = {
    // Business & Consulting — Monthly
    basic_mo: { label: "Basic", subtitle: "Getting started", price: "$100.00", period: "/month", maxCategories: 3, maxCountries: 1, features: ["Access to specialized categories — list up to 3", "List primary service country — 1", "Company profile to highlight your key offerings", "Display your logo for branding", "Direct website link", "Add representative(s) for direct communication", "Certifications (optional)", "Biosafety level (optional) — BSL disclosure"] },
    standard_mo: { label: "Standard", subtitle: "Multi country presence", price: "$200.00", period: "/month", maxCategories: 5, maxCountries: 3, features: ["Access to specialized categories — list up to 5", "List primary service countries — up to 3", "Company profile to highlight your key offerings", "Display your logo for branding", "Direct website link", "Add representative(s) for direct communication", "Certifications (optional)", "Biosafety level (optional) — BSL disclosure"] },
    premium_mo: { label: "Premium", subtitle: "Broad scope & presence", price: "$400.00", period: "/month", maxCategories: 15, maxCountries: 15, features: ["Access to specialized categories — list up to 15", "List primary service countries — up to 15", "Company profile to highlight your key offerings", "Display your logo for branding", "Direct website link", "Add representative(s) for direct communication", "Certifications (optional)", "Biosafety level (optional) — BSL disclosure"] },
    premium_plus_mo: { label: "Premium Plus", subtitle: "Global scale", price: "$1,000.00", period: "/month", maxCategories: -1, maxCountries: -1, features: ["Access to specialized categories — Unlimited", "List primary service countries — Unlimited", "Company profile to highlight your key offerings", "Display your logo for branding", "Direct website link", "Add representative(s) for direct communication", "Certifications (optional)", "Biosafety level (optional) — BSL disclosure"] },
    // Business & Consulting — Yearly
    basic_yr: { label: "Basic Annual", subtitle: "Getting started", price: "$1,080.00", period: "/year", maxCategories: 3, maxCountries: 1, features: ["Access to specialized categories — list up to 3", "List primary service country — 1", "Company profile to highlight your key offerings", "Display your logo for branding", "Direct website link", "Add representative(s) for direct communication", "Certifications (optional)", "Biosafety level (optional) — BSL disclosure"] },
    standard_yr: { label: "Standard Annual", subtitle: "Multi country presence", price: "$2,184.00", period: "/year", maxCategories: 5, maxCountries: 3, features: ["Access to specialized categories — list up to 5", "List primary service countries — up to 3", "Company profile to highlight your key offerings", "Display your logo for branding", "Direct website link", "Add representative(s) for direct communication", "Certifications (optional)", "Biosafety level (optional) — BSL disclosure"] },
    premium_yr: { label: "Premium Annual", subtitle: "Broad scope & presence", price: "$4,320.00", period: "/year", maxCategories: 15, maxCountries: 15, features: ["Access to specialized categories — list up to 15", "List primary service countries — up to 15", "Company profile to highlight your key offerings", "Display your logo for branding", "Direct website link", "Add representative(s) for direct communication", "Option to highlight certifications", "Optional BSL (Biosafety Level) disclosure"] },
    premium_plus_yr: { label: "Premium Plus Annual", subtitle: "Global scale", price: "$10,800.00", period: "/year", maxCategories: -1, maxCountries: -1, features: ["Access to specialized categories — Unlimited", "List primary service countries — Unlimited", "Company profile to highlight your key offerings", "Display your logo for branding", "Direct website link", "Add representative(s) for direct communication", "Option to highlight certifications", "Optional BSL (Biosafety Level) disclosure"] },
    // Events
    basic_event: { label: "Basic", subtitle: "Single day conference/event", price: "$500.00", period: "/month", maxCategories: -1, maxCountries: -1, features: ["Event profile", "Event agenda", "Event date", "Event Location", "Select multiple categories for better visibility", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"] },
    standard_event: { label: "Standard", subtitle: "Multi day conference/event", price: "$850.00", period: "/month", maxCategories: -1, maxCountries: -1, features: ["Event profile", "Event agenda", "Event dates", "Event Location", "Select multiple categories for better visibility", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"] },
    premium_event: { label: "Premium", subtitle: "Event listing + landing page spotlight", price: "$1,250.00", period: "/month", maxCategories: -1, maxCountries: -1, featurePlan: "landing_page", features: ["Extra Feature: Landing page spotlight for increased visibility", "Event profile", "Event agenda", "Event dates", "Event Location", "Select multiple categories for better visibility", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"] },
    premium_plus_event: { label: "Premium Plus", subtitle: "Event listing + home page spotlight", price: "$1,450.00", period: "/month", maxCategories: -1, maxCountries: -1, featurePlan: "home_page", features: ["Extra Feature: Home page spotlight for maximum visibility", "Event profile", "Event agenda", "Event dates", "Event Location", "Select multiple categories", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"] },
    // Jobs
    standard_job: { label: "Standard", subtitle: "Job posting", price: "$400.00", period: "", maxCategories: -1, maxCountries: -1, features: ["Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"] },
    premium_job: { label: "Premium", subtitle: "Job posting & landing page spotlight", price: "$800.00", period: "", maxCategories: -1, maxCountries: -1, featurePlan: "landing_page", features: ["Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication", "Extra feature for landing page spotlight"] },
    premium_plus_job: { label: "Premium Plus", subtitle: "Job posting + home page spotlight", price: "$1,000.00", period: "", maxCategories: -1, maxCountries: -1, featurePlan: "home_page", features: ["Extra Feature: Home page spotlight for maximum visibility", "Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"] },
};

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

const FEATURE_PLANS = [
    { id: "landing_page", label: "Landing Page Spotlight", description: "Featured on the category landing page for increased visibility", price: "$400.00", icon: Star },
    { id: "home_page", label: "Home Page Spotlight", description: "Featured on the home page for maximum brand visibility", price: "$800.00", icon: Crown },
    { id: "both", label: "Both (Module & Home Page)", description: "Featured on both the category landing page and the home page", price: "$1,000.00", icon: Sparkles },
];

const FEATURE_PRICE_CENTS: Record<string, number> = {
    landing_page: 40000,
    home_page: 80000,
    both: 100000,
};

const getSpotlightAddonTierId = (listing: any): string | null => {
    const raw = String(listing?.selectedAddon || listing?.featuredPlacement || "").trim();
    if (raw === "landing_page" || raw === "home_page" || raw === "both") return raw;
    return null;
};

const getFeatureUpgradeTargets = (currentId: string | null | undefined): string[] => {
    const c = (currentId || "").trim();
    if (c === "landing_page") return ["home_page", "both"];
    if (c === "home_page") return ["both"];
    return [];
};

const formatFeatureUpgradeDelta = (fromId: string, toId: string): string => {
    const from = FEATURE_PRICE_CENTS[fromId];
    const to = FEATURE_PRICE_CENTS[toId];
    if (from == null || to == null) return "";
    return `+$${((to - from) / 100).toFixed(2)} today`;
};

const COMPANY_PROFILE_MAX_LENGTH = 1000;

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

const getPlanPeriodEndDate = (plan: any): Date | null =>
    toDateValue(plan?.billingPeriodEnd) || toDateValue(plan?.cancelAt);

/** Paid access still in effect (not lapsed / not deactivated). */
const isPlanBillingLive = (plan: any): boolean => {
    if (plan?.active === false) return false;
    const end = getPlanPeriodEndDate(plan);
    if (end && end.getTime() < Date.now()) return false;
    return true;
};

const inferPlanGroup = (plan: any): string => {
    if (plan?.group) return plan.group;
    if (plan?.collectionName === "businessOfferingsCollection") return "business_offerings";
    if (plan?.collectionName === "consultingServicesCollection" || plan?.collectionName === "consultingCollection") return "consulting";
    if (plan?.collectionName === "eventsCollection") return "events";
    if (plan?.collectionName === "jobsCollection") return "jobs";
    return "";
};

const addListingRouteTypeForPlan = (plan: any): "offerings" | "consulting" | "events" | "jobs" | null => {
    const g = inferPlanGroup(plan);
    if (g === "business_offerings") return "offerings";
    if (g === "consulting") return "consulting";
    if (g === "events") return "events";
    if (g === "jobs") return "jobs";
    return null;
};

const inferListingGroup = (listing: any): string => {
    if (listing?.selectedGroup) return listing.selectedGroup;
    if (listing?.__col === "businessOfferingsCollection") return "business_offerings";
    if (listing?.__col === "consultingServicesCollection" || listing?.__col === "consultingCollection") return "consulting";
    if (listing?.__col === "eventsCollection") return "events";
    if (listing?.__col === "jobsCollection") return "jobs";
    return "";
};

const normalizeRepresentative = (rep: any): { firstName: string; lastName: string; email: string } | null => {
    const firstName = (rep?.firstName || "").trim();
    const lastName = (rep?.lastName || "").trim();
    const email = (rep?.email || "").trim();
    if (!firstName || !lastName || !email) return null;
    return { firstName, lastName, email };
};

const representativeKey = (rep: { firstName: string; lastName: string; email: string }): string =>
    `${rep.firstName.toLowerCase()}|${rep.lastName.toLowerCase()}|${rep.email.toLowerCase()}`;

const getGroupPlanLock = (plans: any[], group: "business_offerings" | "consulting") => {
    const now = new Date();
    let blocked = false;
    let blockedUntil: Date | null = null;
    let hasOpenEndedBlock = false;

    for (const plan of plans || []) {
        if (inferPlanGroup(plan) !== group) continue;
        if (!isPlanBillingLive(plan)) continue;

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

export default function Dashboard() {
    const navigate = useNavigate();
    const [partnerData, setPartnerData] = useState<any>(null);
    const [offerings, setOfferings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>("dashboard");
    const [transactions, setTransactions] = useState<any[]>([]);
    const [transactionDetailRow, setTransactionDetailRow] = useState<PartnerTransactionRow | null>(null);
    const [activePlans, setActivePlans] = useState<any[]>([]);


    // Feature plan modal
    const [showFeatureModal, setShowFeatureModal] = useState(false);
    const [selectedFeaturePlan, setSelectedFeaturePlan] = useState<string>("");
    const [featureProcessing, setFeatureProcessing] = useState(false);

    // Profile form state
    const [profileForm, setProfileForm] = useState<any>({
        firstName: "", lastName: "", email: "", phone: "",
        altName: "", altEmail: "", companyName: "", companyWebsite: "",
        businessPhone: "", linkedin: "", companyProfile: "", businessAddress: "", businessCountry: "",
    });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMsg, setProfileMsg] = useState("");
    /** Required when changing sign-in email (Firebase recent-auth / re-auth). */
    const [profileEmailReauthPassword, setProfileEmailReauthPassword] = useState("");

    // Password form state
    const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });

    // Subscription management modals
    const [showEditListingModal, setShowEditListingModal] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showAddFeatureModal, setShowAddFeatureModal] = useState(false);
    const [showUpgradeFeatureModal, setShowUpgradeFeatureModal] = useState(false);
    const [selectedPlanForAction, setSelectedPlanForAction] = useState<any>(null);
    const [selectedListingForEdit, setSelectedListingForEdit] = useState<any>(null);
    const [pendingUpgradePlanId, setPendingUpgradePlanId] = useState<string | null>(null);
    const [actionProcessing, setActionProcessing] = useState(false);
    const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
    const profileCompanyProfileTooLong = (profileForm.companyProfile || "").length >= COMPANY_PROFILE_MAX_LENGTH;
    const getLinkedListingForPlan = (plan: any) =>
        offerings.find((o) =>
            o.id === plan?.listingId &&
            (!plan?.collectionName || o.__col === plan.collectionName)
        ) || offerings.find((o) => o.id === plan?.listingId);
    const hasStandaloneFeatureForPlan = (plan: any) => {
        const linkedListing = getLinkedListingForPlan(plan);
        const hasFeature = Boolean(linkedListing?.selectedAddon && linkedListing.selectedAddon !== "none");
        const hasIncludedFeature = Boolean(PLAN_CONFIGS[plan?.planId]?.featurePlan);
        return hasFeature && !hasIncludedFeature;
    };
    const isFeatureEligiblePlan = (plan: any) => {
        if (!isPlanBillingLive(plan) || plan.cancelAtPeriodEnd || !plan.listingId || !plan.collectionName) return false;
        const linkedListing = getLinkedListingForPlan(plan);
        if (!linkedListing) return false;
        return linkedListing.status !== "pending_payment" && linkedListing.active !== false;
    };

    // Verify payment on return from Stripe checkout
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get("session_id");
        const paymentStatus = params.get("payment");

        // Prevent duplicate calls by checking if we've already processed this session
        const processedKey = `payment_verified_${sessionId}`;

        if (sessionId && paymentStatus === "success" && !sessionStorage.getItem(processedKey)) {
            // Mark as processing immediately to prevent duplicates
            sessionStorage.setItem(processedKey, "true");

            console.log("Verifying payment for session:", sessionId);
            // Use our central API verification endpoint
            fetch(`${API_BASE_URL}/api/verify-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId })
            })
                .then(res => res.json())
                .then(data => {
                    console.log("Payment verification result:", data);
                    if (data.success && data.updated) {
                        console.log("Payment verified and listing updated!");
                    }
                    // Clean up URL
                    window.history.replaceState({}, document.title, "/partner/dashboard");
                })
                .catch(err => {
                    console.error("Payment verification failed:", err);
                    // Remove the flag so user can retry
                    sessionStorage.removeItem(processedKey);
                });
        } else if (paymentStatus === "success") {
            // Clean up URL even without session_id or if already processed
            window.history.replaceState({}, document.title, "/partner/dashboard");
        }

        const featureStatus = params.get("feature");
        if (featureStatus === "success") {
            setActionMessage({ type: "success", text: "Feature activated successfully!" });
            window.history.replaceState({}, document.title, window.location.pathname);

            // if we have session_id for feature we can verify it similarly
            if (sessionId && !sessionStorage.getItem(processedKey)) {
                sessionStorage.setItem(processedKey, "true");
                // Use our central API verification endpoint
                fetch(`${API_BASE_URL}/api/verify-payment`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId })
                }).catch(err => console.error("Feature verification failed:", err));
            }
        }
    }, []);

    useEffect(() => {
        let unsubOff: any = null;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const docRef = doc(db, "partnersCollection", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setPartnerData(data);

                    const [fName, ...lNames] = (data.primaryName || "").split(" ");
                    setProfileForm({
                        firstName: fName || "", lastName: lNames.join(" ") || "",
                        email: data.primaryEmail || "", phone: data.phoneNumber || "",
                        altName: data.secondaryName || "", altEmail: data.secondaryEmail || "",
                        companyName: data.businessName || "", companyWebsite: data.companyWebsite || "",
                        businessPhone: data.businessPhoneNumber || "", linkedin: data.linkedInProfileLink || "",
                        companyProfile: data.companyProfileText || "", businessAddress: data.businessAddress || "",
                        businessCountry: data.businessCountry || "",
                    });

                    const sortAndDedupeOfferings = (items: any[]) => {
                        const mergedByListing = new Map<string, any>();
                        for (const entry of items) {
                            const key = `${entry.__col}:${entry.id}`;
                            const existing = mergedByListing.get(key);
                            if (!existing) {
                                mergedByListing.set(key, entry);
                                continue;
                            }
                            // Prefer partner-embedded docs when both sources have same listing id.
                            if (existing.__source !== "partner" && entry.__source === "partner") {
                                mergedByListing.set(key, entry);
                            }
                        }
                        return Array.from(mergedByListing.values()).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    };

                    const attachSnapshot = (col: string, source: "partner" | "global", refQuery: any) => {
                        const sourceKey = `${source}:${col}`;
                        return onSnapshot(refQuery, (snap: any) => {
                            setOfferings(prev => {
                                const withoutThisSource = prev.filter(item => item.__sourceKey !== sourceKey);
                                const newItems = snap.docs.map((d: any) => ({
                                    id: d.id,
                                    ...d.data(),
                                    __col: col,
                                    __source: source,
                                    __sourceKey: sourceKey,
                                }));
                                return sortAndDedupeOfferings([...withoutThisSource, ...newItems]);
                            });
                        });
                    };

                    // Keep partner-scoped snapshots for backward compatibility.
                    const partnerEmbeddedCollections = ["businessOfferingsCollection", "consultingServicesCollection", "consultingCollection", "eventsCollection", "jobsCollection"];
                    // Some listing groups are stored as top-level collections keyed by partnerId.
                    const globalCollections = ["consultingServicesCollection", "consultingCollection", "eventsCollection", "jobsCollection"];

                    const allUnsubs = [
                        ...partnerEmbeddedCollections.map((col) => attachSnapshot(col, "partner", query(collection(docRef, col)))),
                        ...globalCollections.map((col) => attachSnapshot(col, "global", query(collection(db, col), where("partnerId", "==", user.uid)))),
                    ];
                    unsubOff = () => allUnsubs.forEach(u => u());

                    // Fetch transactions (plans & features)
                    const transQ = query(collection(db, "transactionsCollection"), where("partnerId", "==", user.uid));
                    onSnapshot(transQ, (snap) => {
                        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
                    });

                    // Fetch active plans from planCollection
                    const plansQ = query(collection(docRef, "planCollection"));
                    onSnapshot(plansQ, (snap) => {
                        setActivePlans(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.startDate?.seconds || 0) - (a.startDate?.seconds || 0)));
                    });
                } else {
                    navigate("/all-categories");
                }
                setLoading(false);
            } else {
                navigate("/login");
            }
        });

        return () => {
            unsubscribe();
            if (typeof unsubOff === 'function') unsubOff();
        };
    }, [navigate]);

    const formattedTransactions = useMemo(
        () =>
            transactions
                .map((t) => formatPartnerTransaction({ id: t.id, ...t }))
                .sort(sortPartnerTransactionsNewestFirst),
        [transactions]
    );

    const handleExportTransactions = useCallback(
        (format: "csv" | "xlsx" | "pdf") => {
            if (formattedTransactions.length === 0) return;
            if (format === "csv") downloadPartnerTransactionsCsv(formattedTransactions);
            else if (format === "xlsx") downloadPartnerTransactionsExcel(formattedTransactions);
            else downloadPartnerTransactionsPdf(formattedTransactions);
        },
        [formattedTransactions]
    );

    const handleAddPlan = (type: string = "offerings") => {
        if (type === "offerings" && businessOfferingLock.blocked) {
            const nextDate = businessOfferingLock.blockedUntil?.toLocaleDateString();
            setActionMessage({
                type: "error",
                text: nextDate
                    ? `You can add a new Business Offering after ${nextDate}.`
                    : "You can only have one active Business Offering plan at a time.",
            });
            return;
        }
        if (type === "consulting" && consultingLock.blocked) {
            const nextDate = consultingLock.blockedUntil?.toLocaleDateString();
            setActionMessage({
                type: "error",
                text: nextDate
                    ? `You can add a new Consulting Service after ${nextDate}.`
                    : "You can only have one active Consulting Service plan at a time.",
            });
            return;
        }
        navigate(`/partner/add-listing/${type}`);
    };

    const handleProfileSave = async () => {
        setProfileSaving(true);
        setProfileMsg("");
        if (profileCompanyProfileTooLong) {
            setProfileMsg(`Company profile cannot exceed ${COMPANY_PROFILE_MAX_LENGTH} characters.`);
            setProfileSaving(false);
            return;
        }
        if (!profileForm.businessCountry) {
            setProfileMsg("Please select your business headquarters country.");
            setProfileSaving(false);
            return;
        }
        if (!profileForm.businessAddress?.trim()) {
            setProfileMsg("Please enter your business address.");
            setProfileSaving(false);
            return;
        }
        if (!isValidBusinessAddress(profileForm.businessAddress)) {
            setProfileMsg("Please enter a valid business address (include street number and street name).");
            setProfileSaving(false);
            return;
        }
        try {
            if (auth.currentUser) {
                const nextEmail = (profileForm.email || "").trim();
                const currentEmail = auth.currentUser.email || "";
                if (nextEmail && nextEmail !== currentEmail) {
                    if (!profileEmailReauthPassword.trim()) {
                        setProfileMsg("Enter your current account password below to change your email.");
                        setProfileSaving(false);
                        return;
                    }
                    try {
                        const cred = EmailAuthProvider.credential(currentEmail, profileEmailReauthPassword);
                        await reauthenticateWithCredential(auth.currentUser, cred);
                        await updateEmail(auth.currentUser, nextEmail);
                        setProfileEmailReauthPassword("");
                    } catch (emailError: any) {
                        if (emailError?.code === "auth/requires-recent-login") {
                            setProfileMsg("Please sign out and sign back in before changing your email.");
                            setProfileSaving(false);
                            return;
                        }
                        if (emailError?.code === "auth/wrong-password" || emailError?.code === "auth/invalid-credential") {
                            setProfileMsg("Current password is incorrect. Email was not changed.");
                            setProfileSaving(false);
                            return;
                        }
                        if (emailError?.code === "auth/email-already-in-use") {
                            setProfileMsg("This email is already in use by another account.");
                            setProfileSaving(false);
                            return;
                        }
                        throw emailError;
                    }
                }

                const docRef = doc(db, "partnersCollection", auth.currentUser.uid);
                await updateDoc(docRef, {
                    primaryName: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
                    primaryEmail: nextEmail, phoneNumber: profileForm.phone,
                    secondaryName: profileForm.altName, secondaryEmail: profileForm.altEmail,
                    businessName: profileForm.companyName, companyWebsite: profileForm.companyWebsite,
                    businessPhoneNumber: profileForm.businessPhone, linkedInProfileLink: profileForm.linkedin,
                    companyProfileText: (profileForm.companyProfile || "").slice(0, COMPANY_PROFILE_MAX_LENGTH),
                    businessAddress: profileForm.businessAddress,
                    businessCountry: profileForm.businessCountry || "",
                });

                const newBusinessName = (profileForm.companyName || "").trim();
                const prevBusinessName = (partnerData?.businessName || "").trim();
                if (newBusinessName && newBusinessName !== prevBusinessName && auth.currentUser) {
                    const uid = auth.currentUser.uid;
                    const batch = writeBatch(db);
                    const partnerRefPath = doc(db, "partnersCollection", uid);
                    const embeddedSnap = await getDocs(collection(partnerRefPath, "businessOfferingsCollection"));
                    embeddedSnap.docs.forEach((d) => {
                        batch.update(d.ref, { businessName: newBusinessName, updatedAt: new Date() });
                    });
                    const topCols = ["consultingServicesCollection", "consultingCollection", "eventsCollection", "jobsCollection"] as const;
                    for (const col of topCols) {
                        const qSnap = await getDocs(query(collection(db, col), where("partnerId", "==", uid)));
                        qSnap.docs.forEach((d) => {
                            batch.update(d.ref, { businessName: newBusinessName, updatedAt: new Date() });
                        });
                    }
                    await batch.commit();
                }

                if (auth.currentUser) await reload(auth.currentUser);

                setPartnerData({
                    ...partnerData, ...{
                        primaryName: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
                        primaryEmail: nextEmail, phoneNumber: profileForm.phone,
                        secondaryName: profileForm.altName, secondaryEmail: profileForm.altEmail,
                        businessName: profileForm.companyName, companyWebsite: profileForm.companyWebsite,
                        businessPhoneNumber: profileForm.businessPhone, linkedInProfileLink: profileForm.linkedin,
                        companyProfileText: (profileForm.companyProfile || "").slice(0, COMPANY_PROFILE_MAX_LENGTH),
                        businessAddress: profileForm.businessAddress,
                        businessCountry: profileForm.businessCountry || "",
                    }
                });

                // Log to Audit Trail
                await logActivity({
                    partnerId: auth.currentUser.uid,
                    partnerName: profileForm.companyName || partnerData.businessName || "Unnamed Business",
                    action: "ACCOUNT_UPDATED",
                    details: `Partner profile updated by partner.`,
                    category: "account",
                    metadata: {
                        updatedFields: Object.keys(profileForm).filter(k => profileForm[k] !== partnerData[k])
                    }
                });

                setProfileMsg("Profile updated successfully!");
                setTimeout(() => setProfileMsg(""), 3000);
            }
        } catch (err) {
            console.error("Failed to update profile", err);
            setProfileMsg("Failed to update profile. Please try again.");
        } finally {
            setProfileSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        setPasswordSaving(true);
        setPasswordMsg({ type: "", text: "" });
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordMsg({ type: "error", text: "New passwords do not match." }); setPasswordSaving(false); return;
        }
        if (!isPasswordPolicyValid(passwordForm.newPassword)) {
            setPasswordMsg({ type: "error", text: PASSWORD_POLICY_ERROR_MESSAGE }); setPasswordSaving(false); return;
        }
        try {
            const user = auth.currentUser;
            if (user && user.email) {
                const credential = EmailAuthProvider.credential(user.email, passwordForm.currentPassword);
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, passwordForm.newPassword);

                // Log to Audit Trail
                await logActivity({
                    partnerId: user.uid,
                    partnerName: partnerData?.businessName || "Unnamed Business",
                    action: "ACCOUNT_UPDATED",
                    details: `Partner password changed.`,
                    category: "account"
                });

                setPasswordMsg({ type: "success", text: "Password changed successfully!" });
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            }
        } catch (err: any) {
            if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
                setPasswordMsg({ type: "error", text: "Current password is incorrect." });
            } else {
                setPasswordMsg({ type: "error", text: err.message || "Failed to change password." });
            }
        } finally {
            setPasswordSaving(false);
        }
    };

    const handlePurchaseFeature = async () => {
        setFeatureProcessing(true);
        try {
            if (auth.currentUser && selectedFeaturePlan) {
                const activeListingPlan = activePlans.filter(isPlanBillingLive).find(isFeatureEligiblePlan);
                if (!activeListingPlan) {
                    throw new Error("You need a paid and active listing before buying a feature add-on.");
                }
                const origin = window.location.origin;
                const resp = await fetch(`${API_BASE_URL}/api/create-feature-checkout`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        featureId: selectedFeaturePlan,
                        partnerId: auth.currentUser.uid,
                        partnerEmail: auth.currentUser.email,
                        listingId: activeListingPlan.listingId,
                        collectionName: activeListingPlan.collectionName,
                        group: activeListingPlan.group || "",
                        successUrl: `${origin}/partner/dashboard?feature=success&session_id={CHECKOUT_SESSION_ID}`,
                        cancelUrl: `${origin}/partner/dashboard?feature=cancelled`,
                    }),
                });
                if (!resp.ok) {
                    let errMessage = "Server error occurred.";
                    try {
                        const errData = await resp.json();
                        errMessage = errData.error || errMessage;
                    } catch {
                        errMessage = `API offline: Please ensure backend server is running.`;
                    }
                    throw new Error(errMessage);
                }
                const data = await resp.json();
                window.location.href = data.url;
            }
        } catch (err: any) {
            console.error("Failed to add feature plan", err);
            setActionMessage({ type: "error", text: err.message || "Failed to add feature plan." });
            setFeatureProcessing(false);
        }
    };

    const handleSignOut = async () => {
        await signOut(auth);
        navigate("/login");
    };

    const startUpgradeCheckout = async (newPlanId: string) => {
        if (!auth.currentUser || !selectedPlanForAction) {
            throw new Error("Upgrade session expired. Please select upgrade again.");
        }
        const origin = window.location.origin;
        const resp = await fetch(`${API_BASE_URL}/api/upgrade-subscription`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subscriptionId: selectedPlanForAction.stripeSubscriptionId || null,
                newPlanId,
                currentPlanId: selectedPlanForAction.planId || null,
                partnerId: auth.currentUser.uid,
                partnerEmail: auth.currentUser.email,
                listingId: selectedPlanForAction.listingId,
                collectionName: selectedPlanForAction.collectionName,
                successUrl: `${origin}/partner/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}&upgrade=true`,
                cancelUrl: `${origin}/partner/dashboard?upgrade=cancelled`,
            }),
        });
        if (!resp.ok) {
            let errMessage = "Server error occurred.";
            try {
                const errData = await resp.json();
                errMessage = errData.error || errMessage;
            } catch {
                errMessage = "API offline: Please ensure backend server is running.";
            }
            throw new Error(errMessage);
        }
        const data = await resp.json();
        if (data.url) {
            window.location.href = data.url;
            return;
        }
        if (data.success) {
            setActionMessage({
                type: "success",
                text: "Upgrade completed successfully. Your next renewal uses the new plan price.",
            });
            setPendingUpgradePlanId(null);
            setTimeout(() => {
                setShowUpgradeModal(false);
                setShowEditListingModal(false);
                setSelectedPlanForAction(null);
                setSelectedListingForEdit(null);
                setActionMessage({ type: "", text: "" });
            }, 1800);
            return;
        }
        throw new Error("Stripe did not return a payment page. Please try the upgrade again.");
    };

    // Handle saving listing edits (all editable fields)
    const handleSaveListingEdit = async (updatedData: any) => {
        setActionProcessing(true);
        try {
            if (auth.currentUser && selectedListingForEdit) {
                const isBusinessCollection = selectedListingForEdit.__col === "businessOfferingsCollection";
                const listingRef = isBusinessCollection
                    ? doc(
                        db,
                        "partnersCollection",
                        auth.currentUser.uid,
                        selectedListingForEdit.__col,
                        selectedListingForEdit.id
                    )
                    : doc(db, selectedListingForEdit.__col, selectedListingForEdit.id);

                const listingGroup =
                    selectedListingForEdit.selectedGroup ||
                    inferListingGroup(selectedListingForEdit);

                const updateObj: Record<string, any> = {
                    updatedAt: new Date(),
                };

                if (listingGroup === "business_offerings" || listingGroup === "consulting") {
                    if (updatedData.serviceCountries !== undefined) {
                        updateObj.serviceCountries = updatedData.serviceCountries;
                    }
                    if (updatedData.serviceRegions !== undefined) {
                        updateObj.serviceRegions = updatedData.serviceRegions;
                    }
                    if (updatedData.bioSafetyLevel !== undefined) {
                        updateObj.bioSafetyLevel = updatedData.bioSafetyLevel;
                    }
                    if (updatedData.certifications !== undefined) {
                        updateObj.certifications = updatedData.certifications;
                    }
                    if (updatedData.companyProfileText !== undefined) {
                        updateObj.companyProfileText = updatedData.companyProfileText;
                    }
                    if (updatedData.businessAddress !== undefined) {
                        updateObj.businessAddress = updatedData.businessAddress;
                    }
                }

                if (listingGroup === "events") {
                    if (updatedData.eventName !== undefined) updateObj.eventName = updatedData.eventName;
                    if (updatedData.eventLink !== undefined) updateObj.eventLink = updatedData.eventLink;
                    if (updatedData.startDate !== undefined) updateObj.startDate = updatedData.startDate;
                    if (updatedData.endDate !== undefined) updateObj.endDate = updatedData.endDate;
                    if (updatedData.eventCountry !== undefined) updateObj.eventCountry = updatedData.eventCountry;
                    if (updatedData.location !== undefined) updateObj.location = updatedData.location;
                    if (updatedData.eventProfile !== undefined) updateObj.eventProfile = updatedData.eventProfile;
                    if (updatedData.agenda !== undefined) updateObj.agenda = updatedData.agenda;
                    if (updatedData.stateRegion !== undefined) updateObj.stateRegion = updatedData.stateRegion;
                    if (updatedData.city !== undefined) updateObj.city = updatedData.city;
                }

                if (listingGroup === "jobs") {
                    if (updatedData.jobTitle !== undefined) updateObj.jobTitle = updatedData.jobTitle;
                    if (updatedData.jobSummary !== undefined) updateObj.jobSummary = updatedData.jobSummary;
                    if (updatedData.industry !== undefined) updateObj.industry = updatedData.industry;
                    if (updatedData.jobtype !== undefined) updateObj.jobtype = updatedData.jobtype;
                    if (updatedData.positionType !== undefined) updateObj.positionType = updatedData.positionType;
                    if (updatedData.experienceLevel !== undefined) updateObj.experienceLevel = updatedData.experienceLevel;
                    if (updatedData.workModel !== undefined) updateObj.workModel = updatedData.workModel;
                    if (updatedData.positionLink !== undefined) updateObj.positionLink = updatedData.positionLink;
                    if (updatedData.jobCountry !== undefined) updateObj.jobCountry = updatedData.jobCountry;
                    if (updatedData.stateRegion !== undefined) updateObj.stateRegion = updatedData.stateRegion;
                    if (updatedData.city !== undefined) updateObj.city = updatedData.city;
                    if (updatedData.location !== undefined) updateObj.location = updatedData.location;
                    if (updatedData.education !== undefined) updateObj.education = updatedData.education;
                    if (updatedData.applicationDeadline !== undefined) updateObj.applicationDeadline = updatedData.applicationDeadline;
                    if (updatedData.jobDescriptionPdfUrl !== undefined) updateObj.jobDescriptionPdfUrl = updatedData.jobDescriptionPdfUrl;
                    if (updatedData.companyWebsiteLink !== undefined) updateObj.companyWebsiteLink = updatedData.companyWebsiteLink;
                    if (updatedData.linkedInJob !== undefined) updateObj.linkedInJob = updatedData.linkedInJob;
                }

                if (updatedData.selectedCategories !== undefined) {
                    updateObj.selectedCategories = updatedData.selectedCategories;
                }
                if (updatedData.selectedSubcategories !== undefined) {
                    updateObj.selectedSubcategories = updatedData.selectedSubcategories;
                }
                if (updatedData.selectedSubSubcategories !== undefined) {
                    updateObj.selectedSubSubcategories = updatedData.selectedSubSubcategories;
                }
                if (updatedData.selectedCategoriesDisplay !== undefined) {
                    updateObj.selectedCategoriesDisplay = updatedData.selectedCategoriesDisplay;
                }
                if (updatedData.selectedSubcategoriesDisplay !== undefined) {
                    updateObj.selectedSubcategoriesDisplay = updatedData.selectedSubcategoriesDisplay;
                }

                if (updatedData.companyRepresentatives !== undefined) {
                    updateObj.companyRepresentatives = updatedData.companyRepresentatives;
                }

                await updateDoc(listingRef, updateObj);

                if (pendingUpgradePlanId) {
                    setActionMessage({ type: "success", text: "Details saved. Redirecting to Stripe for upgrade payment..." });
                    await startUpgradeCheckout(pendingUpgradePlanId);
                    return;
                }

                setActionMessage({ type: "success", text: "Listing updated successfully!" });
                setTimeout(() => {
                    setShowEditListingModal(false);
                    setSelectedListingForEdit(null);
                    setSelectedPlanForAction(null);
                    setActionMessage({ type: "", text: "" });
                }, 1500);
            }
        } catch (err: any) {
            console.error("Failed to update listing:", err);
            setActionMessage({ type: "error", text: err?.message || "Failed to update listing. Please try again." });
        } finally {
            setActionProcessing(false);
        }
    };

    // Handle plan upgrade - edit details first, then Stripe upgrade flow
    const handleUpgradePlan = async (newPlanId: string) => {
        if (!selectedPlanForAction) return;
        const linkedListing = offerings.find((o) =>
            o.id === selectedPlanForAction.listingId &&
            (!selectedPlanForAction.collectionName || o.__col === selectedPlanForAction.collectionName)
        ) || offerings.find((o) => o.id === selectedPlanForAction.listingId);

        if (linkedListing) {
            setPendingUpgradePlanId(newPlanId);
            setSelectedListingForEdit(linkedListing);
            setShowUpgradeModal(false);
            setShowEditListingModal(true);
            setActionMessage({ type: "success", text: "Update your listing details before continuing to Stripe." });
            return;
        }

        setActionProcessing(true);
        try {
            await startUpgradeCheckout(newPlanId);
        } catch (err: any) {
            console.error("Failed to upgrade plan:", err);
            setActionMessage({ type: "error", text: err.message || "Failed to upgrade plan." });
        } finally {
            setActionProcessing(false);
        }
    };

    const handleCancelPlan = async (cancelScope: CancelScope) => {
        setActionProcessing(true);
        try {
            if (auth.currentUser && selectedPlanForAction) {
                const response = await fetch(`${API_BASE_URL}/api/cancel-plan`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        partnerId: auth.currentUser.uid,
                        planDocId: selectedPlanForAction.id,
                        cancelScope,
                    }),
                });
                let payload: any = null;
                try {
                    payload = await response.json();
                } catch {
                    payload = null;
                }
                if (!response.ok || !payload?.success) {
                    throw new Error(payload?.error || "Cancellation request failed.");
                }

                const successText =
                    cancelScope === "feature"
                        ? "Feature spotlight cancelled successfully."
                        : "Subscription will end after the current billing period. Any separate spotlight add-on for this listing has been removed.";
                setActionMessage({ type: "success", text: successText });
                setPendingUpgradePlanId(null);
                setTimeout(() => {
                    setShowCancelModal(false);
                    setSelectedPlanForAction(null);
                    setActionMessage({ type: "", text: "" });
                }, 2000);
            }
        } catch (err: any) {
            console.error("Failed to cancel plan:", err);
            setActionMessage({
                type: "error",
                text: err?.message || "Failed to cancel subscription. Please try again.",
            });
        } finally {
            setActionProcessing(false);
        }
    };

    // Handle feature plan purchase
    const handlePurchaseFeaturePlan = async (featureId: string) => {
        setActionProcessing(true);
        try {
            if (auth.currentUser && selectedPlanForAction) {
                if (!isFeatureEligiblePlan(selectedPlanForAction) || !isPlanBillingLive(selectedPlanForAction)) {
                    throw new Error("Feature add-ons require a paid and active listing-backed plan.");
                }
                const origin = window.location.origin;
                const resp = await fetch(`${API_BASE_URL}/api/create-feature-checkout`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        featureId,
                        partnerId: auth.currentUser.uid,
                        partnerEmail: auth.currentUser.email,
                        listingId: selectedPlanForAction.listingId,
                        collectionName: selectedPlanForAction.collectionName,
                        group: selectedPlanForAction.group || "",
                        successUrl: `${origin}/partner/dashboard?feature=success&session_id={CHECKOUT_SESSION_ID}`,
                        cancelUrl: `${origin}/partner/dashboard?feature=cancelled`,
                    }),
                });
                if (!resp.ok) {
                    let errMessage = "Server error occurred.";
                    try {
                        const errData = await resp.json();
                        errMessage = errData.error || errMessage;
                    } catch {
                        errMessage = `API offline: Please ensure backend server is running.`;
                    }
                    throw new Error(errMessage);
                }
                const data = await resp.json();
                window.location.href = data.url;
            }
        } catch (err: any) {
            console.error("Failed to purchase feature:", err);
            setActionMessage({ type: "error", text: err.message || "Failed to purchase feature plan." });
            setActionProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (!partnerData) return null;

    const livePlans = activePlans.filter(isPlanBillingLive);
    const livePlansEnding = livePlans.filter((p) => p.cancelAtPeriodEnd);
    const livePlansActive = livePlans.filter((p) => !p.cancelAtPeriodEnd);
    const expiredPlans = activePlans.filter((p) => !isPlanBillingLive(p) && (p.planId || p.planName));

    const isApproved = partnerData.partnerStatus !== "Disabled";
    const displayName = partnerData.primaryName || "Partner";
    const currentPlan = PLAN_CONFIGS[partnerData.selectedPlan] || null;
    const currentGroup = partnerData.selectedGroup || "";
    const includedFeature = currentPlan?.featurePlan || null;
    const businessOfferingLock = getGroupPlanLock(activePlans, "business_offerings");
    const consultingLock = getGroupPlanLock(activePlans, "consulting");

    const liveListingPlanForFeatures = livePlans.find(isFeatureEligiblePlan);
    const listingForGlobalFeatureModal = liveListingPlanForFeatures
        ? offerings.find(
            (o) =>
                o.id === liveListingPlanForFeatures.listingId &&
                (!liveListingPlanForFeatures.collectionName || o.__col === liveListingPlanForFeatures.collectionName)
        ) || offerings.find((o) => o.id === liveListingPlanForFeatures.listingId)
        : null;
    const globalModalAddonTier = getSpotlightAddonTierId(listingForGlobalFeatureModal);
    const globalModalUpgradeTargets = getFeatureUpgradeTargets(globalModalAddonTier);

    const representativeOptions = (() => {
        const [altFName, ...altLNames] = ((partnerData?.secondaryName || "") as string).split(" ");
        const altRep = normalizeRepresentative({
            firstName: partnerData?.secondaryFirstName || altFName || "",
            lastName: partnerData?.secondaryLastName || altLNames.join(" ") || "",
            email: partnerData?.secondaryEmail || "",
        });
        const fromListings = offerings
            .flatMap((listing) => Array.isArray(listing.companyRepresentatives) ? listing.companyRepresentatives : [])
            .map(normalizeRepresentative)
            .filter(Boolean) as Array<{ firstName: string; lastName: string; email: string }>;
        const fromPartner = Array.isArray(partnerData?.companyRepresentatives)
            ? partnerData.companyRepresentatives.map(normalizeRepresentative).filter(Boolean) as Array<{ firstName: string; lastName: string; email: string }>
            : [];
        const combined = [...fromPartner, ...fromListings, ...(altRep ? [altRep] : [])];
        const seen = new Set<string>();
        return combined.filter((rep) => {
            const key = representativeKey(rep);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    })();

    const sidebarItems: { id: TabType | "logout"; label: string; icon: any }[] = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "profile", label: "Profile", icon: User },
        { id: "password", label: "Change Password", icon: KeyRound },
        { id: "transactions", label: "Transactions", icon: Receipt },
        { id: "logout", label: "Logout", icon: LogOut },
    ];

    return (
        <div className="min-h-screen w-full bg-background flex">
            {/* Sidebar */}
            <aside className="w-[220px] bg-[#1e293b] flex flex-col shrink-0 fixed top-0 left-0 bottom-0 z-30">
                <div className="p-5 border-b border-white/10 flex items-center gap-2">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                            <div className="h-4 w-4 bg-foreground/20 rounded-full" />
                        </div>
                        <span className="font-bold text-base tracking-tight text-white">Pharma Socii</span>
                    </Link>
                </div>
                <nav className="flex-1 py-3">
                    {sidebarItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.id === activeTab;
                        const isLogout = item.id === "logout";
                        return (
                            <button key={item.id} onClick={() => {
                                if (isLogout) handleSignOut();
                                else setActiveTab(item.id as TabType);
                            }} className={`w-full flex items-center gap-3 px-5 py-3 text-[14px] font-medium transition-all duration-200 ${isActive ? "bg-primary text-white" : isLogout ? "text-white/60 hover:text-red-400 hover:bg-red-500/10" : "text-white/60 hover:text-white hover:bg-white/5"}`}>
                                <Icon className="w-4.5 h-4.5" />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-[220px] overflow-y-auto min-h-screen">
                {/* Top Bar */}
                <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-foreground/10 px-8 py-3 flex items-center justify-end">
                    <div className="text-sm text-foreground">
                        <span>{displayName}</span>
                    </div>
                </div>



                {/* Feature Plan Modal */}
                {showFeatureModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-background rounded-2xl border border-foreground/10 w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                            {featureProcessing ? (
                                <div className="p-12 flex flex-col items-center text-center">
                                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
                                    <h2 className="text-2xl font-bold text-foreground mb-2">Processing Payment...</h2>
                                    <p className="text-muted-foreground">Securely processing via Stripe</p>
                                </div>
                            ) : (
                                <>
                                    <div className="px-6 py-5 border-b border-foreground/10 flex items-center justify-between">
                                        <h2 className="text-xl font-bold text-foreground">
                                            {globalModalUpgradeTargets.length > 0 ? "Upgrade spotlight" : "Add Feature Plan"}
                                        </h2>
                                        <button type="button" onClick={() => { setShowFeatureModal(false); setSelectedFeaturePlan(""); }} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <p className="text-muted-foreground text-sm mb-2">
                                            {globalModalUpgradeTargets.length > 0
                                                ? "Move up to a higher spotlight tier. You pay only the difference in price."
                                                : "Get extra visibility by being featured on the category page or the home page. Select a plan below:"}
                                        </p>
                                        {FEATURE_PLANS.map(fp => {
                                            const Ic = fp.icon;
                                            const isSelected = selectedFeaturePlan === fp.id;
                                            const alreadyHasExact =
                                                partnerData.selectedAddon === fp.id ||
                                                includedFeature === fp.id ||
                                                globalModalAddonTier === fp.id;
                                            const isValidUpgradeChoice = globalModalUpgradeTargets.includes(fp.id);
                                            const inUpgradeMode = globalModalUpgradeTargets.length > 0;
                                            const disabled =
                                                featureProcessing ||
                                                alreadyHasExact ||
                                                (inUpgradeMode && !isValidUpgradeChoice);
                                            return (
                                                <button key={fp.id} type="button" disabled={disabled} onClick={() => setSelectedFeaturePlan(fp.id)}
                                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${disabled ? "border-foreground/10 opacity-50 cursor-not-allowed" : isSelected ? "border-primary bg-primary/5" : "border-foreground/10 hover:border-foreground/20 bg-foreground/5"}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? "bg-primary/20" : "bg-foreground/10"}`}>
                                                            <Ic className={`w-5 h-5 ${isSelected ? "text-primary" : "text-foreground/60"}`} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-foreground flex items-center gap-2">
                                                                {fp.label}
                                                                {alreadyHasExact && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Active</Badge>}
                                                                {isValidUpgradeChoice && globalModalAddonTier && (
                                                                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Upgrade</Badge>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{fp.description}</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            {inUpgradeMode && isValidUpgradeChoice && globalModalAddonTier ? (
                                                                <p className="text-lg font-bold text-primary">{formatFeatureUpgradeDelta(globalModalAddonTier, fp.id)}</p>
                                                            ) : (
                                                                <p className="text-lg font-bold text-foreground">{fp.price}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3">
                                        <Button variant="ghost" onClick={() => { setShowFeatureModal(false); setSelectedFeaturePlan(""); }}>Cancel</Button>
                                        <Button disabled={!selectedFeaturePlan || featureProcessing} onClick={handlePurchaseFeature} className="px-8 flex items-center">
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            {featureProcessing ? "Processing..." : globalModalUpgradeTargets.length > 0 ? "Continue to payment" : "Purchase Feature Plan"}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Global Action Message */}
                {actionMessage.text && (
                    <div className="fixed top-20 right-8 z-50 animate-in slide-in-from-right-8 duration-300">
                        <div className={`px-6 py-4 rounded-xl shadow-lg border ${actionMessage.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-red-500/10 border-red-500/30 text-red-500"}`}>
                            <div className="flex items-center gap-3">
                                {actionMessage.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                <p className="font-medium">{actionMessage.text}</p>
                                <button onClick={() => setActionMessage({ type: "", text: "" })} className="ml-4 opacity-70 hover:opacity-100">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Listing Modal */}
                {showEditListingModal && selectedListingForEdit && (
                    <EditListingModal
                        listing={selectedListingForEdit}
                        plan={selectedPlanForAction}
                        planConfig={PLAN_CONFIGS[(pendingUpgradePlanId || selectedListingForEdit?.selectedPlan || selectedPlanForAction?.planId) as string]}
                        isUpgradeFlow={Boolean(pendingUpgradePlanId)}
                        representativeOptions={representativeOptions}
                        onClose={() => {
                            setShowEditListingModal(false);
                            setSelectedListingForEdit(null);
                            setSelectedPlanForAction(null);
                            setPendingUpgradePlanId(null);
                        }}
                        onSave={handleSaveListingEdit}
                        processing={actionProcessing}
                    />
                )}

                {/* Upgrade Plan Modal */}
                {showUpgradeModal && selectedPlanForAction && (
                    <UpgradePlanModal
                        currentPlan={selectedPlanForAction}
                        currentPlanConfig={PLAN_CONFIGS[selectedPlanForAction?.planId]}
                        allPlans={PLAN_CONFIGS}
                        onClose={() => {
                            setShowUpgradeModal(false);
                            setSelectedPlanForAction(null);
                            setPendingUpgradePlanId(null);
                        }}
                        onUpgrade={handleUpgradePlan}
                        processing={actionProcessing}
                    />
                )}

                {/* Cancel Plan Modal */}
                {showCancelModal && selectedPlanForAction && (
                    <CancelPlanModal
                        key={selectedPlanForAction.id}
                        plan={selectedPlanForAction}
                        planConfig={PLAN_CONFIGS[selectedPlanForAction?.planId]}
                        hasFeature={hasStandaloneFeatureForPlan(selectedPlanForAction)}
                        onClose={() => {
                            setShowCancelModal(false);
                            setSelectedPlanForAction(null);
                            setPendingUpgradePlanId(null);
                        }}
                        onCancel={handleCancelPlan}
                        processing={actionProcessing}
                    />
                )}

                {/* Add Feature Plan Modal */}
                {showAddFeatureModal && selectedPlanForAction && (
                    <AddFeaturePlanModal
                        plan={selectedPlanForAction}
                        listing={selectedListingForEdit}
                        featurePlans={FEATURE_PLANS}
                        onClose={() => {
                            setShowAddFeatureModal(false);
                            setShowUpgradeFeatureModal(false);
                            setSelectedPlanForAction(null);
                            setSelectedListingForEdit(null);
                        }}
                        onPurchase={handlePurchaseFeaturePlan}
                        processing={actionProcessing}
                    />
                )}

                {showUpgradeFeatureModal && selectedPlanForAction && selectedListingForEdit && getSpotlightAddonTierId(selectedListingForEdit) && (
                    <UpgradeFeaturePlanModal
                        currentAddonId={getSpotlightAddonTierId(selectedListingForEdit) as string}
                        onClose={() => {
                            setShowUpgradeFeatureModal(false);
                            setSelectedPlanForAction(null);
                            setSelectedListingForEdit(null);
                        }}
                        onPurchase={handlePurchaseFeaturePlan}
                        processing={actionProcessing}
                    />
                )}

                {/* Content Area */}
                <div className="p-8 md:p-10">
                    {activeTab === "dashboard" && renderDashboard()}
                    {activeTab === "profile" && renderProfile()}
                    {activeTab === "password" && renderChangePassword()}
                    {activeTab === "transactions" && renderTransactions(formattedTransactions)}
                </div>
            </main>
        </div>
    );

    // ─── DASHBOARD TAB ───
    function renderDashboard() {
        const renderPlanSubscriptionCard = (plan: any, mode: "ending" | "active") => {
            const planConfig = PLAN_CONFIGS[plan.planId];
            const startDate = plan.startDate?.seconds ? new Date(plan.startDate.seconds * 1000) : plan.startDate ? new Date(plan.startDate) : null;
            const billingEnd = plan.billingPeriodEnd?.seconds ? new Date(plan.billingPeriodEnd.seconds * 1000) : plan.billingPeriodEnd ? new Date(plan.billingPeriodEnd) : null;
            const isYearly = plan.billingInterval === "year" || plan.planId?.includes("_yr");
            const linkedListing =
                offerings.find((o) => o.id === plan.listingId && (!plan.collectionName || o.__col === plan.collectionName)) ||
                offerings.find((o) => o.id === plan.listingId);
            const planRepresentatives = linkedListing?.companyRepresentatives || plan.companyRepresentatives || [];
            const hasFeature = linkedListing?.selectedAddon && linkedListing.selectedAddon !== "" && linkedListing.selectedAddon !== "none";
            const includedPlanFeature = planConfig?.featurePlan;
            const canAddFeature = !includedPlanFeature && !hasFeature && isFeatureEligiblePlan(plan);
            const spotlightTier = hasStandaloneFeatureForPlan(plan) ? getSpotlightAddonTierId(linkedListing) : null;
            const spotlightUpgradeTargets = spotlightTier ? getFeatureUpgradeTargets(spotlightTier) : [];
            const isEnding = mode === "ending";
            const actionsLocked = isEnding || Boolean(plan.cancelAtPeriodEnd);
            const cardShell = isEnding
                ? "rounded-xl border border-amber-500/35 bg-amber-500/[0.07] p-5"
                : "rounded-xl border border-foreground/10 bg-muted/40 p-5";

            return (
                <div key={plan.id} className={cardShell}>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                    <h4 className="text-lg font-bold text-foreground">
                                        {planConfig?.label || plan.planName || plan.planId?.replace(/_/g, " ").toUpperCase()}
                                    </h4>
                                    {isEnding ? (
                                        <>
                                            <Badge className="bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/50">Scheduled to end</Badge>
                                            <Badge variant="outline" className="border-foreground/20">{isYearly ? "Annual" : "Monthly"}</Badge>
                                            {billingEnd && (
                                                <span className="text-xs font-medium text-amber-900/85 dark:text-amber-100/85">
                                                    Access through {billingEnd.toLocaleDateString()}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Active</Badge>
                                            <Badge variant="outline" className="border-foreground/20">{isYearly ? "Annual" : "Monthly"}</Badge>
                                        </>
                                    )}
                                </div>
                                {isEnding && (
                                    <p className="text-sm text-muted-foreground mb-2 max-w-2xl">
                                        This plan will not renew. Listing edits, upgrades, and new spotlight purchases are disabled until the period ends.
                                    </p>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Start date</p>
                                        <p className="text-sm text-foreground font-medium">{startDate ? startDate.toLocaleDateString() : "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">{isEnding ? "Ends on" : "Renewal date"}</p>
                                        <p className="text-sm text-foreground font-medium">{billingEnd ? billingEnd.toLocaleDateString() : "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Billing cycle</p>
                                        <p className="text-sm text-foreground font-medium capitalize">{isYearly ? "Yearly" : "Monthly"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Price</p>
                                        <p className="text-sm text-foreground font-medium">{planConfig?.price || "N/A"}{planConfig?.period}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                                {linkedListing && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-foreground/20 text-foreground/80 hover:bg-foreground/5"
                                        disabled={actionsLocked}
                                        onClick={() => {
                                            setSelectedListingForEdit(linkedListing);
                                            setSelectedPlanForAction(plan);
                                            setPendingUpgradePlanId(null);
                                            setShowEditListingModal(true);
                                        }}
                                    >
                                        <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit listing
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-primary/40 text-primary hover:bg-primary/10"
                                    disabled={actionsLocked}
                                    onClick={() => {
                                        setSelectedPlanForAction(plan);
                                        setPendingUpgradePlanId(null);
                                        setShowUpgradeModal(true);
                                    }}
                                >
                                    <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" /> Upgrade plan
                                </Button>
                                {canAddFeature && (
                                    <Button
                                        size="sm"
                                        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold disabled:opacity-50"
                                        disabled={actionsLocked}
                                        onClick={() => {
                                            setSelectedPlanForAction(plan);
                                            setSelectedListingForEdit(linkedListing);
                                            setPendingUpgradePlanId(null);
                                            setShowUpgradeFeatureModal(false);
                                            setShowAddFeatureModal(true);
                                        }}
                                    >
                                        <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Add spotlight
                                    </Button>
                                )}
                                {spotlightUpgradeTargets.length > 0 && linkedListing && (
                                    <Button
                                        size="sm"
                                        className="bg-violet-700 text-white border border-violet-800 hover:bg-violet-800 hover:text-white shadow-sm font-semibold disabled:opacity-50"
                                        disabled={actionsLocked}
                                        onClick={() => {
                                            setSelectedPlanForAction(plan);
                                            setSelectedListingForEdit(linkedListing);
                                            setPendingUpgradePlanId(null);
                                            setShowAddFeatureModal(false);
                                            setShowUpgradeFeatureModal(true);
                                        }}
                                    >
                                        <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" /> Upgrade spotlight
                                    </Button>
                                )}
                                {!isEnding && !plan.cancelAtPeriodEnd && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                        onClick={() => {
                                            setSelectedPlanForAction(plan);
                                            setPendingUpgradePlanId(null);
                                            setShowCancelModal(true);
                                        }}
                                    >
                                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Cancel
                                    </Button>
                                )}
                            </div>
                        </div>
                        {(includedPlanFeature || hasFeature) && (
                            <div className="pt-3 border-t border-foreground/10">
                                <p className="text-sm text-foreground flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    {includedPlanFeature
                                        ? `Included: ${includedPlanFeature === "home_page" ? "Home page" : "Landing page"} spotlight`
                                        : `Active spotlight: ${FEATURE_PLANS.find((f) => f.id === linkedListing?.selectedAddon)?.label}`}
                                </p>
                                {linkedListing?.featureSpotlightPaidThrough && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Spotlight paid-through:{" "}
                                        {linkedListing.featureSpotlightPaidThrough?.seconds
                                            ? new Date(linkedListing.featureSpotlightPaidThrough.seconds * 1000).toLocaleDateString()
                                            : new Date(linkedListing.featureSpotlightPaidThrough).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        )}
                        {planRepresentatives?.length > 0 && (
                            <div className="pt-3 border-t border-foreground/10">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Company representatives</p>
                                <div className="space-y-1.5">
                                    {planRepresentatives.map((rep: any, i: number) => (
                                        <p key={i} className="text-sm text-foreground/90">
                                            {rep.firstName} {rep.lastName} — {rep.email}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        };

        return (
            <div className="max-w-5xl space-y-8">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Company Dashboard</h1>

                {!isApproved && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 p-6 rounded-xl flex items-start flex-col sm:flex-row gap-4 relative overflow-hidden">
                        <Clock className="w-8 h-8 text-yellow-500 shrink-0 mt-1 relative z-10" />
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-yellow-500">Account Disabled</h3>
                            <p className="text-foreground/80 mt-2 leading-relaxed max-w-2xl">Your account is currently disabled. Contact support to reactivate your listings.</p>
                        </div>
                    </div>
                )}

                {isApproved && (
                    <div className="bg-primary/10 border border-primary/30 p-6 rounded-xl flex items-start flex-col sm:flex-row gap-4 relative overflow-hidden">
                        <CheckCircle2 className="w-8 h-8 text-primary shrink-0 mt-1 relative z-10" />
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-primary">Profile Active</h3>
                            <p className="text-foreground/80 mt-2 leading-relaxed max-w-2xl">Your paid listings are live and visible in All Categories.</p>
                        </div>
                    </div>
                )}

                {/* Plan & Business Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                    {/* Business Information */}
                    <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md shadow-xl">
                        <CardHeader className="pb-4 border-b border-foreground/10">
                            <CardTitle className="text-xl flex items-center gap-2"><Building className="w-5 h-5 text-primary" /> Business Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-6">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Company Name</p>
                                <p className="text-2xl text-foreground font-bold">{partnerData.businessName}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-6 bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Group</p>
                                    <p className="text-foreground font-medium capitalize">{currentGroup.replace(/_/g, ' ') || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Plan</p>
                                    <p className="text-foreground font-medium">{currentPlan?.label || "N/A"}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1"><MapPin className="w-4 h-4" /> Registered Address</p>
                                <p className="text-foreground/90 font-medium pl-6">{partnerData.businessAddress || "N/A"}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contact Details */}
                    <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md shadow-xl">
                        <CardHeader className="pb-4 border-b border-foreground/10">
                            <CardTitle className="text-xl flex items-center gap-2"><Mail className="w-5 h-5 text-secondary" /> Contact Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-6">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Primary Rep</p>
                                <p className="text-xl text-foreground font-bold">{partnerData.primaryName}</p>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted/40 border border-foreground/10 flex items-center justify-center"><Mail className="w-4 h-4 text-foreground" /></div>
                                    <div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p><p className="text-foreground font-medium">{partnerData.primaryEmail}</p></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted/40 border border-foreground/10 flex items-center justify-center"><Phone className="w-4 h-4 text-foreground" /></div>
                                    <div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</p><p className="text-foreground font-medium">{partnerData.phoneNumber || partnerData.businessPhoneNumber || "N/A"}</p></div>
                                </div>
                            </div>
                            {(partnerData.secondaryName || partnerData.secondaryEmail) && (
                                <div className="pt-5 border-t border-foreground/10 mt-5">
                                    <p className="text-sm font-bold text-primary mb-3 uppercase tracking-wider">Alternate Contact</p>
                                    <div className="bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                        {partnerData.secondaryName && <p className="text-foreground font-semibold mb-1">{partnerData.secondaryName}</p>}
                                        {partnerData.secondaryEmail && <p className="text-foreground/80 text-sm">{partnerData.secondaryEmail}</p>}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Plans & billing */}
                {(livePlansActive.length > 0 || livePlansEnding.length > 0 || expiredPlans.length > 0) && (
                    <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md shadow-xl">
                        <CardHeader className="pb-4 border-b border-foreground/10">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-primary" /> Plans &amp; billing
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Active subscriptions, plans you have set to cancel at period end, and past plans that are no longer billing.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-10">
                            {livePlansEnding.length > 0 && (
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Scheduled to end</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Still in access until the end date below; will not renew. Repurchase anytime after it lapses.
                                        </p>
                                    </div>
                                    <div className="space-y-4">{livePlansEnding.map((plan) => renderPlanSubscriptionCard(plan, "ending"))}</div>
                                </div>
                            )}
                            {livePlansActive.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active</h3>
                                    <div className="space-y-4">{livePlansActive.map((plan) => renderPlanSubscriptionCard(plan, "active"))}</div>
                                </div>
                            )}
                            {expiredPlans.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Past plans</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Cancelled, expired, or replaced — no longer billing. Labels reflect subscription state in Stripe and your account.
                                    </p>
                                    <div className="space-y-4">
                                        {expiredPlans.map((plan) => {
                                            const planConfig = PLAN_CONFIGS[plan.planId];
                                            const endedAt =
                                                getPlanPeriodEndDate(plan) ||
                                                (plan.expiredAt?.seconds ? new Date(plan.expiredAt.seconds * 1000) : null);
                                            const addType = addListingRouteTypeForPlan(plan);
                                            const pastLabel = plan.active === false ? "Expired" : "Ended";
                                            return (
                                                <div key={plan.id} className="bg-muted/20 border border-foreground/10 rounded-xl p-5 opacity-90">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                <h4 className="text-lg font-bold text-foreground">{planConfig?.label || plan.planName || plan.planId}</h4>
                                                                <Badge className="bg-foreground/15 text-muted-foreground border-foreground/25">{pastLabel}</Badge>
                                                            </div>
                                                            {endedAt && (
                                                                <p className="text-sm text-muted-foreground">Billing ended {endedAt.toLocaleDateString()}</p>
                                                            )}
                                                        </div>
                                                        {addType && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="border-primary/50 text-primary shrink-0"
                                                                onClick={() => handleAddPlan(addType)}
                                                            >
                                                                Repurchase plan
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Offerings Section */}
                {isApproved && (
                    <div className="mt-8 space-y-6">
                        <div className="flex justify-between items-center border-b border-foreground/10 pb-4">
                            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2"><LayoutList className="w-6 h-6 text-primary" /> Your Listings</h2>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="bg-white text-black hover:bg-white/90"><PlusCircle className="w-4 h-4 mr-2" /> Add Listing</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-background border-foreground/10">
                                    <DropdownMenuItem
                                        onClick={() => handleAddPlan("offerings")}
                                        disabled={businessOfferingLock.blocked}
                                        className="cursor-pointer"
                                    >
                                        Business Offering {businessOfferingLock.blocked ? "(limit reached)" : ""}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleAddPlan("consulting")}
                                        disabled={consultingLock.blocked}
                                        className="cursor-pointer"
                                    >
                                        Consulting Service {consultingLock.blocked ? "(limit reached)" : ""}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddPlan("jobs")} className="cursor-pointer">Job Listing</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddPlan("events")} className="cursor-pointer">Event Listing</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {(() => {
                            // Separate paid listings from pending payment
                            const paidListings = offerings.filter(o => o.status !== "pending_payment");
                            const pendingPaymentListings = offerings.filter(o => o.status === "pending_payment");

                            if (offerings.length === 0) {
                                return (
                                    <div className="bg-foreground/5 border border-foreground/10 p-12 rounded-xl text-center">
                                        <p className="text-muted-foreground mb-4">You have not configured any specific listings yet.</p>
                                        <Button
                                            onClick={() => handleAddPlan("offerings")}
                                            variant="outline"
                                            className="border-primary/50 text-primary"
                                            disabled={businessOfferingLock.blocked}
                                        >
                                            {businessOfferingLock.blocked ? "Business Offering limit reached" : "Set up your first listing"}
                                        </Button>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {/* Paid/Active Listings */}
                                    {paidListings.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {paidListings.map(offering => {
                                                const statusColor = offering.status === "Approved"
                                                    ? "bg-green-500/20 text-green-400 border-green-500/50"
                                                    : offering.status === "Pending Review"
                                                        ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                                                        : offering.status === "Cancelled"
                                                            ? "bg-red-500/20 text-red-400 border-red-500/50"
                                                            : "bg-primary/20 text-primary border-primary/50";
                                                const statusLabel = offering.status || "Active";
                                                const listingGroup = inferListingGroup(offering);

                                                return (
                                                    <Card key={offering.id} className="bg-muted/40 border-foreground/10">
                                                        <CardHeader className="pb-3 border-b border-foreground/10 bg-foreground/5">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <CardTitle className="text-lg text-primary">{offering.selectedPlan?.split('_').join(' ').toUpperCase() || offering.planId?.split('_').join(' ').toUpperCase() || offering.eventName || offering.jobTitle || 'Listing'}</CardTitle>
                                                                    <p className="text-xs text-muted-foreground mt-1 capitalize">{listingGroup.replace(/_/g, ' ') || offering.__col?.replace('Collection', '').replace(/([A-Z])/g, ' $1').trim()}</p>
                                                                </div>
                                                                <Badge className={statusColor}>{statusLabel}</Badge>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="pt-4 space-y-3 text-sm">
                                                            {/* Categories */}
                                                            {(offering.selectedCategories?.length > 0 || offering.categories?.length > 0) && (
                                                                <div className="flex flex-col gap-1 text-foreground/80">
                                                                    <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Categories</span>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {(offering.selectedCategories || offering.categories || []).map((cat: string, i: number) => (
                                                                            <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-primary/30 text-xs">{cat}</Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* Subcategories */}
                                                            {offering.selectedSubcategories?.length > 0 && (
                                                                <div className="flex flex-col gap-1 text-foreground/80">
                                                                    <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Subcategories</span>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {(offering.selectedSubcategories || []).map((sub: string, i: number) => (
                                                                            <Badge key={i} variant="outline" className="border-foreground/20 text-xs">{sub}</Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* Sub-subcategories */}
                                                            {offering.selectedSubSubcategories?.length > 0 && (
                                                                <div className="flex flex-col gap-1 text-foreground/80">
                                                                    <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Sub-subcategories</span>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {offering.selectedSubSubcategories.map((subSub: string, i: number) => (
                                                                            <Badge key={i} variant="outline" className="border-primary/30 text-primary text-xs">{subSub}</Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* Countries */}
                                                            {offering.serviceCountries?.length > 0 && (
                                                                <div className="flex flex-col gap-1 text-foreground/80">
                                                                    <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Service Countries</span>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {offering.serviceCountries.map((country: string, i: number) => (
                                                                            <Badge key={i} variant="secondary" className="bg-foreground/10 text-xs">{country}</Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* Regions */}
                                                            {offering.serviceRegions?.length > 0 && (
                                                                <div className="flex flex-col gap-1 text-foreground/80">
                                                                    <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Service Regions</span>
                                                                    <p className="font-medium text-foreground text-xs">{offering.serviceRegions.join(', ')}</p>
                                                                </div>
                                                            )}
                                                            {/* Bio Safety Levels */}
                                                            {offering.bioSafetyLevel?.length > 0 && (
                                                                <div className="flex flex-col gap-1 text-foreground/80">
                                                                    <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Bio Safety Levels</span>
                                                                    <div className="flex flex-wrap gap-2">{offering.bioSafetyLevel.map((b: string, i: number) => <Badge variant="secondary" key={i} className="bg-foreground/10">{b}</Badge>)}</div>
                                                                </div>
                                                            )}
                                                            {/* Certifications */}
                                                            {offering.certifications?.length > 0 && (
                                                                <div className="flex flex-col gap-1 text-foreground/80">
                                                                    <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Certifications</span>
                                                                    <div className="flex flex-wrap gap-2">{offering.certifications.map((c: string, i: number) => <Badge variant="outline" key={i} className="border-foreground/20">{c}</Badge>)}</div>
                                                                </div>
                                                            )}
                                                            {offering.companyRepresentatives?.length > 0 && (
                                                                <div className="flex flex-col gap-1 text-foreground/80">
                                                                    <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Company Representatives</span>
                                                                    <div className="space-y-1">
                                                                        {offering.companyRepresentatives.map((rep: any, i: number) => (
                                                                            <p key={i} className="text-xs text-foreground">
                                                                                {rep.firstName} {rep.lastName} - {rep.email}
                                                                            </p>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* Created date */}
                                                            {offering.createdAt && (
                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-foreground/10">
                                                                    <Calendar className="w-3 h-3" />
                                                                    <span>Created: {new Date(offering.createdAt.seconds * 1000).toLocaleDateString()}</span>
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Pending Payment Listings */}
                                    {pendingPaymentListings.length > 0 && (
                                        <div className="mt-6">
                                            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-yellow-500" />
                                                Pending Payment ({pendingPaymentListings.length})
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {pendingPaymentListings.map(offering => {
                                                    const listingGroup = inferListingGroup(offering);
                                                    return (
                                                        <Card key={offering.id} className="bg-yellow-500/5 border-yellow-500/20">
                                                            <CardHeader className="pb-3 border-b border-yellow-500/10 bg-yellow-500/5">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <CardTitle className="text-base text-foreground">{offering.selectedPlan?.split('_').join(' ').toUpperCase() || 'Listing'}</CardTitle>
                                                                        <p className="text-xs text-muted-foreground mt-1 capitalize">{listingGroup.replace(/_/g, ' ')}</p>
                                                                    </div>
                                                                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Pending Payment</Badge>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="pt-4">
                                                                <p className="text-sm text-muted-foreground mb-3">Complete payment to activate this listing.</p>
                                                                <Button
                                                                    size="sm"
                                                                    className="w-full"
                                                                    onClick={() => {
                                                                        // Re-initiate checkout for this listing
                                                                        navigate(`/partner/add-listing/${listingGroup === "business_offerings" ? "offerings" : listingGroup}`);
                                                                    }}
                                                                >
                                                                    <CreditCard className="w-4 h-4 mr-2" /> Complete Payment
                                                                </Button>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>
        );
    }

    // ─── PROFILE TAB ───
    function renderProfile() {
        return (
            <div className="max-w-5xl space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Partner Information</h1>
                    <Button onClick={handleProfileSave} disabled={profileSaving || profileCompanyProfileTooLong} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Save className="w-4 h-4 mr-2" />{profileSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
                {profileMsg && (
                    <div className={`p-3 rounded-lg text-sm font-medium ${profileMsg.includes("success") ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>{profileMsg}</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-foreground/80">First name <span className="text-red-400">*</span></Label>
                        <Input value={profileForm.firstName} onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Last name <span className="text-red-400">*</span></Label>
                        <Input value={profileForm.lastName} onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-foreground/80">Email <span className="text-red-400">*</span></Label>
                        <Input type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                        {(profileForm.email || "").trim() !== (auth.currentUser?.email || "") && (
                            <div className="mt-3 space-y-2 rounded-lg border border-foreground/10 bg-muted/30 p-3">
                                <Label className="text-foreground/80 text-sm">Current password (required to change email)</Label>
                                <Input
                                    type="password"
                                    autoComplete="current-password"
                                    value={profileEmailReauthPassword}
                                    onChange={(e) => setProfileEmailReauthPassword(e.target.value)}
                                    className="bg-foreground/5 border-foreground/10 h-11"
                                    placeholder="Enter your login password"
                                />
                                <p className="text-xs text-muted-foreground">Firebase requires re-authentication before updating your sign-in email.</p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-foreground/80">Phone <span className="text-red-400">*</span></Label>
                        <PhoneInput defaultCountry="US" value={profileForm.phone} onChange={(value) => setProfileForm((prev: any) => ({ ...prev, phone: value || '' }))} className="flex h-11 w-full rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm text-foreground" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-foreground/10">
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Alternate contact first & last name <span className="text-red-400">*</span></Label>
                        <Input value={profileForm.altName} onChange={e => setProfileForm({ ...profileForm, altName: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Alternate email address <span className="text-red-400">*</span></Label>
                        <Input value={profileForm.altEmail} onChange={e => setProfileForm({ ...profileForm, altEmail: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-foreground/10">
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Company name <span className="text-red-400">*</span></Label>
                        <Input value={profileForm.companyName} onChange={e => setProfileForm({ ...profileForm, companyName: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Company website <span className="text-red-400">*</span></Label>
                        <Input value={profileForm.companyWebsite} onChange={e => setProfileForm({ ...profileForm, companyWebsite: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" placeholder="https://" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Business phone <span className="text-red-400">*</span></Label>
                        <PhoneInput defaultCountry="US" value={profileForm.businessPhone} onChange={(value) => setProfileForm((prev: any) => ({ ...prev, businessPhone: value || '' }))} className="flex h-11 w-full rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Linkedin profile</Label>
                        <Input value={profileForm.linkedin} onChange={e => setProfileForm({ ...profileForm, linkedin: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" placeholder="https://linkedin.com/company/..." />
                    </div>
                </div>

                <div className="pt-2 border-t border-foreground/10">
                    <Label className="text-foreground/80 mb-3 block">Company logo</Label>
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 flex-shrink-0 bg-foreground/5 rounded-lg border border-dashed border-foreground/20 flex items-center justify-center text-muted-foreground"><UploadCloud className="h-5 w-5" /></div>
                        <div className="flex-1">
                            <Input type="file" className="bg-foreground/5 border-foreground/10 text-sm h-10 pt-2 cursor-pointer" accept="image/jpeg, image/png" />
                            <p className="text-xs text-muted-foreground mt-1.5">Formats: JPG, JPEG, PNG | Max size: 2MB | Dimensions: 200px x 200px</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-foreground/10">
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Company profile <span className="text-red-400">*</span></Label>
                        <Textarea
                            value={profileForm.companyProfile}
                            onChange={e => setProfileForm({ ...profileForm, companyProfile: e.target.value })}
                            className={`h-40 bg-foreground/5 resize-none text-sm ${profileCompanyProfileTooLong ? "border-red-500 focus-visible:ring-red-500" : "border-foreground/10"}`}
                            placeholder="Briefly describe your company's mission and offerings..."
                        />
                        {profileCompanyProfileTooLong && (
                            <p className="text-xs text-red-500">Company profile cannot exceed {COMPANY_PROFILE_MAX_LENGTH} characters.</p>
                        )}
                        <p className="text-xs text-muted-foreground">{(profileForm.companyProfile || "").length}/{COMPANY_PROFILE_MAX_LENGTH} characters</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <Label className="text-foreground/80">Business headquarters (Country) <span className="text-red-400">*</span></Label>
                            <Select value={profileForm.businessCountry} onValueChange={(val) => setProfileForm({ ...profileForm, businessCountry: val })}>
                                <SelectTrigger className="w-full bg-foreground/5 border-foreground/10 h-10 text-sm">
                                    <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {SERVICE_COUNTRIES.map(country => (
                                        <SelectItem key={country} value={country}>{country}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground/80">Full business address <span className="text-red-400">*</span></Label>
                            <Textarea
                                value={profileForm.businessAddress}
                                onChange={e => setProfileForm({ ...profileForm, businessAddress: e.target.value })}
                                className="h-[104px] bg-foreground/5 border-foreground/10 resize-none text-sm font-normal"
                                placeholder={"123 Science Way\nSuite 100\nSan Francisco, CA 94107"}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── CHANGE PASSWORD TAB ───
    function renderChangePassword() {
        const newPwChecks = getPasswordPolicyChecks(passwordForm.newPassword);
        return (
            <div className="max-w-lg space-y-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Change Password</h1>
                <p className="text-muted-foreground text-sm">Update your password to keep your account secure.</p>
                {passwordMsg.text && (
                    <div className={`p-3 rounded-lg text-sm font-medium ${passwordMsg.type === "success" ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>{passwordMsg.text}</div>
                )}
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Current password</Label>
                        <div className="relative">
                            <Input type={showCurrentPw ? "text" : "password"} value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11 pr-10" />
                            <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/80">New password</Label>
                        <div className="relative">
                            <Input type={showNewPw ? "text" : "password"} value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11 pr-10" />
                            <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <li className={newPwChecks.minLength ? "text-green-500" : ""}>At least 8 characters</li>
                            <li className={newPwChecks.uppercase ? "text-green-500" : ""}>At least 1 uppercase letter</li>
                            <li className={newPwChecks.lowercase ? "text-green-500" : ""}>At least 1 lowercase letter</li>
                            <li className={newPwChecks.special ? "text-green-500" : ""}>At least 1 special character</li>
                        </ul>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Confirm new password</Label>
                        <Input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                    </div>
                    <Button onClick={handlePasswordChange} disabled={passwordSaving || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword} className="w-full h-11 mt-2">
                        <KeyRound className="w-4 h-4 mr-2" />{passwordSaving ? "Updating..." : "Update Password"}
                    </Button>
                </div>
            </div>
        );
    }

    // ─── TRANSACTIONS TAB ───
    function renderTransactions(txns: PartnerTransactionRow[]) {
        const detail = transactionDetailRow;
        const statusBadgeClass =
            detail?.statusRaw === "succeeded"
                ? "bg-green-500/10 text-green-400 border-green-500/30"
                : "bg-foreground/10 text-foreground border-foreground/20";

        return (
            <div className="max-w-6xl space-y-6 pr-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Transactions</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Payment history in a table view. Export for your records, or open a row for full plan and listing details.
                        </p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="border-foreground/20 shrink-0" disabled={txns.length === 0}>
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => handleExportTransactions("csv")}>
                                <FileText className="w-4 h-4 mr-2" />
                                Download as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportTransactions("xlsx")}>
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                Download as Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportTransactions("pdf")}>
                                <FileText className="w-4 h-4 mr-2" />
                                Download as PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {txns.length === 0 ? (
                    <div className="bg-foreground/5 border border-foreground/10 p-12 rounded-xl text-center">
                        <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No transactions yet.</p>
                    </div>
                ) : (
                    <div className="rounded-lg border border-foreground/15 bg-foreground/[0.02] overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse min-w-[720px]">
                                <thead>
                                    <tr className="bg-muted/60 border-b border-foreground/15">
                                        <th className="text-left font-semibold text-foreground/80 uppercase tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Date
                                        </th>
                                        <th className="text-left font-semibold text-foreground/80 uppercase tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Type
                                        </th>
                                        <th className="text-left font-semibold text-foreground/80 uppercase tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10">
                                            Description
                                        </th>
                                        <th className="text-left font-semibold text-foreground/80 uppercase tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Group
                                        </th>
                                        <th className="text-right font-semibold text-foreground/80 uppercase tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Amount
                                        </th>
                                        <th className="text-left font-semibold text-foreground/80 uppercase tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Status
                                        </th>
                                        <th className="text-center font-semibold text-foreground/80 uppercase tracking-wide text-xs px-3 py-2.5 whitespace-nowrap w-[100px]">
                                            Details
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {txns.map((txn, idx) => (
                                        <tr
                                            key={txn.id}
                                            className={`border-b border-foreground/10 hover:bg-muted/40 transition-colors ${idx % 2 === 1 ? "bg-foreground/[0.02]" : ""}`}
                                        >
                                            <td className="px-3 py-2 border-r border-foreground/10 text-foreground/90 whitespace-nowrap align-top">
                                                {txn.dateDisplay}
                                            </td>
                                            <td className="px-3 py-2 border-r border-foreground/10 text-foreground/90 whitespace-nowrap align-top">
                                                {txn.typeLabel}
                                            </td>
                                            <td className="px-3 py-2 border-r border-foreground/10 text-foreground align-top max-w-[280px]">
                                                <span className="line-clamp-2" title={txn.description}>
                                                    {txn.description}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 border-r border-foreground/10 text-muted-foreground capitalize align-top whitespace-nowrap">
                                                {txn.group || "—"}
                                            </td>
                                            <td className="px-3 py-2 border-r border-foreground/10 text-right font-semibold tabular-nums text-foreground align-top whitespace-nowrap">
                                                {txn.amountDisplay}
                                            </td>
                                            <td className="px-3 py-2 border-r border-foreground/10 align-top whitespace-nowrap">
                                                <Badge
                                                    className={
                                                        txn.statusRaw === "succeeded"
                                                            ? "bg-green-500/10 text-green-400 border-green-500/30 font-medium"
                                                            : "bg-amber-500/10 text-amber-200 border-amber-500/30 font-medium"
                                                    }
                                                >
                                                    {txn.statusLabel}
                                                </Badge>
                                            </td>
                                            <td className="px-2 py-1.5 text-center align-top">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                                                    onClick={() => setTransactionDetailRow(txn)}
                                                >
                                                    <Info className="w-4 h-4 mr-1" />
                                                    View
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {detail && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="txn-detail-title"
                            className="bg-background rounded-xl border border-foreground/15 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        >
                            <div className="px-5 py-4 border-b border-foreground/10 flex items-start justify-between gap-3 sticky top-0 bg-background z-10">
                                <div>
                                    <h2 id="txn-detail-title" className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <CreditCard className="w-5 h-5 text-primary shrink-0" />
                                        Transaction details
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-1">{detail.dateDisplay} · {detail.paymentMethod}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTransactionDetailRow(null)}
                                    className="text-muted-foreground hover:text-foreground p-1 rounded-md shrink-0"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="px-5 py-4 space-y-4 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className="font-medium">{detail.typeLabel}</Badge>
                                    <Badge className={statusBadgeClass}>{detail.statusLabel}</Badge>
                                    <span className="text-lg font-bold text-foreground tabular-nums">{detail.amountDisplay}</span>
                                    <span className="text-muted-foreground">{detail.currency}</span>
                                </div>
                                <dl className="space-y-3 border-t border-foreground/10 pt-4">
                                    <div>
                                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</dt>
                                        <dd className="text-foreground mt-0.5">{detail.description}</dd>
                                    </div>
                                    {detail.businessName && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business</dt>
                                            <dd className="text-foreground mt-0.5">{detail.businessName}</dd>
                                        </div>
                                    )}
                                    {detail.group && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Group</dt>
                                            <dd className="text-foreground mt-0.5 capitalize">{detail.group}</dd>
                                        </div>
                                    )}
                                    {detail.planId && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.planId}</dd>
                                        </div>
                                    )}
                                    {detail.featureId && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feature ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.featureId}</dd>
                                        </div>
                                    )}
                                    {(detail.listingId || detail.collectionName) && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Listing</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">
                                                {detail.collectionName && <span>{detail.collectionName}</span>}
                                                {detail.collectionName && detail.listingId && " / "}
                                                {detail.listingId && <span>{detail.listingId}</span>}
                                                {!detail.listingId && !detail.collectionName && "—"}
                                            </dd>
                                        </div>
                                    )}
                                    {detail.sessionId && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.sessionId}</dd>
                                        </div>
                                    )}
                                    {detail.invoiceId && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.invoiceId}</dd>
                                        </div>
                                    )}
                                    {detail.stripeSubscriptionId && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subscription ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.stripeSubscriptionId}</dd>
                                        </div>
                                    )}
                                    {detail.customerEmail && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer email</dt>
                                            <dd className="text-foreground mt-0.5 break-all">{detail.customerEmail}</dd>
                                        </div>
                                    )}
                                    {detail.selectedCategories.length > 0 && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Categories</dt>
                                            <dd className="flex flex-wrap gap-1.5">
                                                {detail.selectedCategories.map((cat, i) => (
                                                    <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-primary/30 text-xs">
                                                        {cat}
                                                    </Badge>
                                                ))}
                                            </dd>
                                        </div>
                                    )}
                                    {detail.selectedSubcategories.length > 0 && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Subcategories</dt>
                                            <dd className="flex flex-wrap gap-1.5">
                                                {detail.selectedSubcategories.map((sub, i) => (
                                                    <Badge key={i} variant="outline" className="border-foreground/20 text-xs">
                                                        {sub}
                                                    </Badge>
                                                ))}
                                            </dd>
                                        </div>
                                    )}
                                    {detail.selectedSubSubcategories.length > 0 && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Sub-subcategories</dt>
                                            <dd className="flex flex-wrap gap-1.5">
                                                {detail.selectedSubSubcategories.map((subSub, i) => (
                                                    <Badge key={i} variant="outline" className="border-primary/30 text-primary text-xs">
                                                        {subSub}
                                                    </Badge>
                                                ))}
                                            </dd>
                                        </div>
                                    )}
                                    {(detail.serviceCountries.length > 0 || detail.serviceRegions.length > 0) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {detail.serviceCountries.length > 0 && (
                                                <div>
                                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Countries</dt>
                                                    <dd className="flex flex-wrap gap-1.5">
                                                        {detail.serviceCountries.map((c, i) => (
                                                            <Badge key={i} variant="secondary" className="bg-foreground/10 text-xs">
                                                                {c}
                                                            </Badge>
                                                        ))}
                                                    </dd>
                                                </div>
                                            )}
                                            {detail.serviceRegions.length > 0 && (
                                                <div>
                                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Regions</dt>
                                                    <dd className="text-xs text-foreground/90">{detail.serviceRegions.join(", ")}</dd>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {detail.companyRepresentatives.length > 0 && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Company representatives</dt>
                                            <dd className="space-y-1">
                                                {detail.companyRepresentatives.map((rep, i) => (
                                                    <p key={i} className="text-xs text-foreground/90">
                                                        {[rep.firstName, rep.lastName].filter(Boolean).join(" ")}
                                                        {rep.email ? ` · ${rep.email}` : ""}
                                                    </p>
                                                ))}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                            <div className="px-5 py-3 border-t border-foreground/10 flex justify-end bg-muted/30">
                                <Button type="button" variant="secondary" onClick={() => setTransactionDetailRow(null)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

// ─── CONSTANTS FOR EDIT MODAL ───
const SERVICE_REGIONS = [
    "North America", "South America", "Europe", "Asia Pacific",
    "Middle East", "Africa", "Australia & Oceania",
];

// Use the global SERVICE_COUNTRIES defined above for local filtering as well

const BSL_LEVELS = ["1", "2", "3", "4"];
const CERTIFICATIONS = ["GMP", "CE", "ISO 13485", "ISO 9001", "Others"];
const OTHER_CERT_OPTION = "Others";



const getSubLabel = (entry: SubcategoryEntry): string =>
    typeof entry === "string" ? entry : entry.label;

const hasSubSub = (entry: SubcategoryEntry): entry is { label: string; subSubcategories: string[] } =>
    typeof entry !== "string";

// ─── MODAL COMPONENTS ───

interface EditListingModalProps {
    listing: any;
    plan: any;
    planConfig: any;
    isUpgradeFlow?: boolean;
    representativeOptions: Array<{ firstName: string; lastName: string; email: string }>;
    onClose: () => void;
    onSave: (data: any) => void;
    processing: boolean;
}

function EditListingModal({ listing, planConfig, isUpgradeFlow = false, representativeOptions, onClose, onSave, processing }: EditListingModalProps) {
    // Form state
    const listingGroup = listing.selectedGroup
        || (listing.__col === "businessOfferingsCollection" ? "business_offerings"
            : listing.__col === "consultingServicesCollection" ? "consulting"
                : listing.__col === "eventsCollection" ? "events"
                    : listing.__col === "jobsCollection" ? "jobs"
                        : "");
    const [selectedCategories, setSelectedCategories] = useState<string[]>(listing.selectedCategories || []);
    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(listing.selectedSubcategories || []);
    const [selectedSubSubcategories, setSelectedSubSubcategories] = useState<string[]>(listing.selectedSubSubcategories || []);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(listing.selectedCategories || []);
    const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>(listing.selectedSubcategories || []);
    const existingCertifications = Array.isArray(listing.certifications) ? listing.certifications : [];
    const parsedOtherCert = (existingCertifications.find((cert: string) => cert.toLowerCase().startsWith("other:")) || "").replace(/^other:\s*/i, "");
    const [countries, setCountries] = useState<string[]>(() => normalizeServiceCountriesToArray(listing.serviceCountries));
    const [regions, setRegions] = useState<string[]>(listing.serviceRegions || []);
    const [bslLevels, setBslLevels] = useState<string[]>(listing.bioSafetyLevel || []);
    const [certifications, setCertifications] = useState<string[]>([
        ...existingCertifications.filter((cert: string) => !cert.toLowerCase().startsWith("other:") && cert !== OTHER_CERT_OPTION),
        ...(parsedOtherCert ? [parsedOtherCert] : []),
    ]);
    const [otherCertText, setOtherCertText] = useState(parsedOtherCert);
    const [showOtherCertInput, setShowOtherCertInput] = useState(Boolean(parsedOtherCert || existingCertifications.includes(OTHER_CERT_OPTION)));
    const [companyProfile, setCompanyProfile] = useState(listing.companyProfileText || "");
    const companyProfileTooLong = companyProfile.length >= COMPANY_PROFILE_MAX_LENGTH;
    const [businessAddress, setBusinessAddress] = useState(listing.businessAddress || "");
    const [representatives, setRepresentatives] = useState<Array<{ firstName: string; lastName: string; email: string }>>(
        Array.isArray(listing.companyRepresentatives) && listing.companyRepresentatives.length > 0
            ? listing.companyRepresentatives.map((rep: any) => ({
                firstName: rep.firstName || "",
                lastName: rep.lastName || "",
                email: rep.email || "",
            }))
            : []
    );
    const availableRepresentativeOptions = useMemo(() => {
        const combined = [
            ...(representativeOptions || []),
            ...(Array.isArray(listing.companyRepresentatives) ? listing.companyRepresentatives.map(normalizeRepresentative).filter(Boolean) : []),
        ] as Array<{ firstName: string; lastName: string; email: string }>;
        const seen = new Set<string>();
        return combined.filter((rep) => {
            const key = representativeKey(rep);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [listing.companyRepresentatives, representativeOptions]);

    // Dropdown open states
    const [countriesOpen, setCountriesOpen] = useState(false);
    const [countrySearch, setCountrySearch] = useState("");

    const maxCategories = typeof planConfig?.maxCategories === "number" ? planConfig.maxCategories : -1;
    const maxCountries = typeof planConfig?.maxCountries === "number" ? planConfig.maxCountries : -1;
    const canUseRegionHelper = maxCountries === -1;
    const canSelectAllCategories = maxCategories === -1;

    const categoryCount = useMemo(() => {
        const selectedUnits = new Set<string>();
        selectedCategories.forEach((cat) => selectedUnits.add(`cat:${cat}`));
        selectedSubcategories.forEach((sub) => selectedUnits.add(`sub:${sub}`));
        selectedSubSubcategories.forEach((subSub) => selectedUnits.add(`subsub:${subSub}`));
        return selectedUnits.size;
    }, [selectedCategories, selectedSubcategories, selectedSubSubcategories]);
    const isCategoryLimitReached = maxCategories !== -1 && categoryCount >= maxCategories;

    function getCategoriesForGroup(group: string): CategoriesDict | Record<string, string[]> | null {
        switch (group) {
            case "business_offerings": return BUSINESS_CATEGORIES;
            case "consulting": return CONSULTING_CATEGORIES;
            case "events": return EVENTS_CATEGORIES;
            case "jobs": return JOBS_CATEGORIES;
            default: return null;
        }
    }

    // Filter countries based on search
    const filteredCountries = SERVICE_COUNTRIES.filter(c =>
        c.toLowerCase().includes(countrySearch.toLowerCase())
    );

    const toggleExpandCategory = (cat: string) => {
        setExpandedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };
    const toggleExpandSubcategory = (sub: string) => {
        setExpandedSubcategories(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]);
    };

    const toggleCategorySelection = (cat: string, hasSubs: boolean) => {
        if (hasSubs) {
            setSelectedCategories(prev => prev.filter(c => c !== cat));
            toggleExpandCategory(cat);
            return;
        }
        if (selectedCategories.includes(cat)) {
            setSelectedCategories(prev => prev.filter(c => c !== cat));
        } else {
            if (isCategoryLimitReached) return;
            setSelectedCategories(prev => [...prev, cat]);
        }
    };
    const toggleSubcategorySelection = (sub: string, hasSubSubs: boolean) => {
        if (hasSubSubs) {
            setSelectedSubcategories(prev => prev.filter(s => s !== sub));
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

    const toggleCountry = (country: string) => {
        if (countries.includes(country)) {
            setCountries(countries.filter(c => c !== country));
        } else if (maxCountries === -1 || countries.length < maxCountries) {
            setCountries([...countries, country]);
        }
    };

    const toggleRegion = (region: string) => {
        if (!canUseRegionHelper) return;
        const regionCountries = REGION_COUNTRY_MAP[region] || [];
        if (regions.includes(region)) {
            setRegions(regions.filter(r => r !== region));
            setCountries(prev => prev.filter(country => !regionCountries.includes(country)));
        } else {
            setRegions([...regions, region]);
            setCountries(prev => [...new Set([...prev, ...regionCountries])]);
        }
    };

    const toggleBSL = (level: string) => {
        if (bslLevels.includes(level)) {
            setBslLevels(bslLevels.filter(l => l !== level));
        } else {
            setBslLevels([...bslLevels, level]);
        }
    };

    const toggleCert = (cert: string) => {
        if (cert === OTHER_CERT_OPTION) {
            if (showOtherCertInput) {
                const customValue = otherCertText.trim();
                setShowOtherCertInput(false);
                setOtherCertText("");
                if (customValue) {
                    setCertifications(prev => prev.filter(c => c !== customValue));
                }
            } else {
                setShowOtherCertInput(true);
            }
            return;
        }
        if (certifications.includes(cert)) {
            const next = certifications.filter(c => c !== cert);
            setCertifications(next);
            if (cert === otherCertText.trim()) {
                setOtherCertText("");
                setShowOtherCertInput(false);
            }
        } else {
            setCertifications([...certifications, cert]);
        }
    };
    const handleOtherCertTextChange = (value: string) => {
        const previousCustomValue = otherCertText.trim();
        const nextCustomValue = value.trim();
        setOtherCertText(value);
        setCertifications(prev => {
            const withoutPreviousCustom = prev.filter(cert => cert !== previousCustomValue && cert !== OTHER_CERT_OPTION);
            if (!nextCustomValue) return withoutPreviousCustom;
            return Array.from(new Set([...withoutPreviousCustom, nextCustomValue]));
        });
    };
    function renderCategoryTree() {
        const catDict = getCategoriesForGroup(listingGroup);
        if (!catDict) return null;
        const isBusinessGroup = listingGroup === "business_offerings";

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
                                id={`edit-cat-${cat}`}
                                checked={hasSubs ? isExpanded : isParentSelected}
                                onCheckedChange={() => toggleCategorySelection(cat, hasSubs)}
                                disabled={!hasSubs && !isParentSelected && isCategoryLimitReached}
                                className={hasSubs && isExpanded ? "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" : ""}
                            />
                            <label htmlFor={`edit-cat-${cat}`} className={`text-sm leading-none cursor-pointer ${hasSubs ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>{cat}</label>
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
                                                id={`edit-sub-${cat}-${subLabel}`}
                                                checked={isNested ? isSubExpanded : isSubChecked}
                                                onCheckedChange={() => toggleSubcategorySelection(subLabel, isNested || false)}
                                                disabled={!isNested && !isSubChecked && isCategoryLimitReached}
                                                className={isSubChecked ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}
                                            />
                                            <label htmlFor={`edit-sub-${cat}-${subLabel}`} className="text-sm text-green-700 dark:text-green-400 cursor-pointer">{subLabel}</label>
                                        </div>
                                        {isNested && isSubExpanded && hasSubSub(entry) && (
                                            <div className="ml-8 pl-3 border-l-2 border-primary/30 space-y-1 mb-1">
                                                {entry.subSubcategories.map((ssLabel: string) => {
                                                    const isSSChecked = selectedSubSubcategories.includes(ssLabel);
                                                    return (
                                                        <div key={ssLabel} className="flex items-center gap-1.5 py-0.5">
                                                            <span className="w-3 h-3 flex-shrink-0" />
                                                            <Checkbox
                                                                id={`edit-subsub-${cat}-${subLabel}-${ssLabel}`}
                                                                checked={isSSChecked}
                                                                onCheckedChange={() => toggleSubSubcategorySelection(ssLabel)}
                                                                disabled={!isSSChecked && isCategoryLimitReached}
                                                                className={isSSChecked ? "data-[state=checked]:bg-primary data-[state=checked]:border-primary" : ""}
                                                            />
                                                            <label htmlFor={`edit-subsub-${cat}-${subLabel}-${ssLabel}`} className="text-sm text-primary cursor-pointer">{ssLabel}</label>
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
        const catDict = getCategoriesForGroup(listingGroup);
        if (!catDict || !canSelectAllCategories) return;

        const allLeafCategories: string[] = [];
        const allLeafSubcategories: string[] = [];
        const allSubSubcategories: string[] = [];
        const allCategoryKeys = Object.keys(catDict);
        const allNestedSubcategoryLabels: string[] = [];
        const isBusinessGroup = listingGroup === "business_offerings";

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
    const addRepresentative = () => {
        setRepresentatives(prev => [...prev, { firstName: "", lastName: "", email: "" }]);
    };
    const addRepresentativeFromSaved = (rep: { firstName: string; lastName: string; email: string }) => {
        setRepresentatives(prev => {
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
        setRepresentatives(prev => prev.filter((_, i) => i !== index));
    };
    const updateRepresentative = (index: number, field: "firstName" | "lastName" | "email", value: string) => {
        setRepresentatives(prev => prev.map((rep, i) => (i === index ? { ...rep, [field]: value } : rep)));
    };

    const isBusinessOffering = listing.__col === "businessOfferingsCollection" || listing.selectedGroup === "business_offerings";
    const showServiceLocations = listingGroup === "business_offerings" || listingGroup === "consulting";

    const [eventName, setEventName] = useState(listing.eventName || "");
    const [eventLink, setEventLink] = useState(listing.eventLink || "");
    const [startDate, setStartDate] = useState(listing.startDate || "");
    const [endDate, setEndDate] = useState(listing.endDate || "");
    const [eventCountry, setEventCountry] = useState(listing.eventCountry || "");
    const [eventLocation, setEventLocation] = useState(listing.location || "");
    const [eventProfile, setEventProfile] = useState(listing.eventProfile || "");
    const [agenda, setAgenda] = useState(listing.agenda || "");
    const [eventStateRegion, setEventStateRegion] = useState(listing.stateRegion || "");
    const [eventCity, setEventCity] = useState(listing.city || "");
    const eventListingPlanId = listing.selectedPlan || "";
    const isBasicEventPlan = eventListingPlanId === "basic_event";

    useEffect(() => {
        if (listingGroup !== "events" || !isBasicEventPlan || !startDate) return;
        setEndDate((prev: string) => (prev === startDate ? prev : startDate));
    }, [listingGroup, isBasicEventPlan, startDate]);

    const [jobTitle, setJobTitle] = useState(listing.jobTitle || "");
    const [jobSummary, setJobSummary] = useState(listing.jobSummary || "");
    const [industry, setIndustry] = useState(listing.industry || "");
    const [jobType, setJobType] = useState(listing.jobtype || listing.positionType || "");
    const [experienceLevel, setExperienceLevel] = useState(listing.experienceLevel || "");
    const [workModel, setWorkModel] = useState(listing.workModel || "");
    const [positionLink, setPositionLink] = useState(listing.positionLink || "");
    const [jobCountry, setJobCountry] = useState(listing.jobCountry || "");
    const [jobStateRegion, setJobStateRegion] = useState(listing.stateRegion || "");
    const [jobCity, setJobCity] = useState(listing.city || "");
    const [jobLocationLine, setJobLocationLine] = useState(listing.location || "");
    const [education, setEducation] = useState(listing.education || "");
    const [applicationDeadline, setApplicationDeadline] = useState(
        typeof listing.applicationDeadline === "string" ? listing.applicationDeadline : ""
    );
    const [jobDescriptionPdfUrl, setJobDescriptionPdfUrl] = useState(listing.jobDescriptionPdfUrl || "");
    const [jobPdfFile, setJobPdfFile] = useState<File | null>(null);
    const [jobPdfUploadError, setJobPdfUploadError] = useState("");
    const [jobPdfUploading, setJobPdfUploading] = useState(false);
    const [companyWebsiteLink, setCompanyWebsiteLink] = useState(listing.companyWebsiteLink || "");
    const [linkedInJob, setLinkedInJob] = useState(listing.linkedInJob || "");

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl border border-foreground/10 w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="px-6 py-5 border-b border-foreground/10 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Edit3 className="w-5 h-5 text-primary" /> Edit Listing
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {listingGroup === "events" && (
                        <div className="space-y-4 border border-foreground/10 rounded-lg p-4 bg-foreground/5">
                            <h3 className="text-sm font-bold text-foreground">Event details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><Label>Event name <span className="text-red-400">*</span></Label><Input value={eventName} onChange={(e) => setEventName(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>Event link <span className="text-red-400">*</span></Label><Input value={eventLink} onChange={(e) => setEventLink(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>Start date <span className="text-red-400">*</span></Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div>
                                    <Label>End date <span className="text-red-400">*</span></Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        disabled={isBasicEventPlan}
                                        className="bg-foreground/5 border-foreground/10 mt-1"
                                    />
                                    {isBasicEventPlan && (
                                        <p className="text-xs text-muted-foreground mt-1">Basic events are single day; end date matches the start date.</p>
                                    )}
                                </div>
                                <div><Label>Country <span className="text-red-400">*</span></Label><Input value={eventCountry} onChange={(e) => setEventCountry(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>State/Province/Region <span className="text-red-400">*</span></Label><Input value={eventStateRegion} onChange={(e) => setEventStateRegion(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>City/Town <span className="text-red-400">*</span></Label><Input value={eventCity} onChange={(e) => setEventCity(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div className="md:col-span-2"><Label>Venue / location notes</Label><Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div className="md:col-span-2"><Label>Agenda <span className="text-red-400">*</span></Label><Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1 min-h-[100px]" /></div>
                                <div className="md:col-span-2"><Label>Event profile <span className="text-red-400">*</span></Label><Textarea value={eventProfile} onChange={(e) => setEventProfile(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1 min-h-[80px]" /></div>
                            </div>
                        </div>
                    )}
                    {listingGroup === "jobs" && (
                        <div className="space-y-4 border border-foreground/10 rounded-lg p-4 bg-foreground/5">
                            <h3 className="text-sm font-bold text-foreground">Job details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2"><Label>Job title <span className="text-red-400">*</span></Label><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div className="md:col-span-2"><Label>Job summary <span className="text-red-400">*</span></Label><Textarea value={jobSummary} onChange={(e) => setJobSummary(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1 min-h-[80px]" /></div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label>Full job description (PDF) <span className="text-red-400">*</span></Label>
                                    <Input
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        className="bg-foreground/5 border-foreground/10 mt-1 cursor-pointer"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] || null;
                                            setJobPdfFile(f);
                                            setJobPdfUploadError("");
                                            if (f) setJobDescriptionPdfUrl("");
                                        }}
                                    />
                                    {jobPdfFile && <p className="text-xs text-muted-foreground">Selected: {jobPdfFile.name}</p>}
                                    <p className="text-xs text-muted-foreground">Or paste a hosted PDF link if you are not uploading a file.</p>
                                    <Input
                                        type="url"
                                        placeholder="https://…"
                                        value={jobDescriptionPdfUrl}
                                        onChange={(e) => setJobDescriptionPdfUrl(e.target.value)}
                                        disabled={!!jobPdfFile}
                                        className="bg-foreground/5 border-foreground/10 mt-1"
                                    />
                                    {jobPdfUploadError && <p className="text-xs text-red-500">{jobPdfUploadError}</p>}
                                </div>
                                <div><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>Job type <span className="text-red-400">*</span></Label><Input value={jobType} onChange={(e) => setJobType(e.target.value)} placeholder="e.g. Full-time" className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>Country <span className="text-red-400">*</span></Label><Input value={jobCountry} onChange={(e) => setJobCountry(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>State/Province/Region <span className="text-red-400">*</span></Label><Input value={jobStateRegion} onChange={(e) => setJobStateRegion(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>City/Town <span className="text-red-400">*</span></Label><Input value={jobCity} onChange={(e) => setJobCity(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>Education</Label>
                                    <Select value={education} onValueChange={setEducation}>
                                        <SelectTrigger className="bg-foreground/5 border-foreground/10 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>
                                            {["High school or equivalent", "Associate degree", "Bachelors degree", "Masters degree", "Doctorate/PhD/MD", "Other"].map((o) => (
                                                <SelectItem key={o} value={o}>{o}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div><Label>Experience level</Label>
                                    <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                                        <SelectTrigger className="bg-foreground/5 border-foreground/10 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>
                                            {["Entry level", "Associate level", "Mid-level", "Lead/Principal", "Director", "VP/executive"].map((o) => (
                                                <SelectItem key={o} value={o}>{o}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div><Label>Work model <span className="text-red-400">*</span></Label>
                                    <Select value={workModel} onValueChange={setWorkModel}>
                                        <SelectTrigger className="bg-foreground/5 border-foreground/10 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>
                                            {["Hybrid", "Remote", "On-site"].map((o) => (
                                                <SelectItem key={o} value={o}>{o}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2"><Label>Position link (Apply URL) <span className="text-red-400">*</span></Label><Input type="url" value={positionLink} onChange={(e) => setPositionLink(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div><Label>Application deadline</Label><Input type="date" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div className="md:col-span-2"><Label>Company website link</Label><Input type="url" value={companyWebsiteLink} onChange={(e) => setCompanyWebsiteLink(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div className="md:col-span-2"><Label>LinkedIn</Label><Input value={linkedInJob} onChange={(e) => setLinkedInJob(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                                <div className="md:col-span-2"><Label>Location (combined display)</Label><Input value={jobLocationLine} onChange={(e) => setJobLocationLine(e.target.value)} placeholder="Optional extra location text" className="bg-foreground/5 border-foreground/10 mt-1" /></div>
                            </div>
                        </div>
                    )}
                    {/* Categories */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-foreground/80 flex items-center gap-2">
                                <Tag className="w-4 h-4" /> Categories
                                {maxCategories !== -1 && <span className="text-xs text-muted-foreground">({categoryCount}/{maxCategories} max)</span>}
                            </Label>
                            {canSelectAllCategories && (
                                <Button type="button" variant="outline" size="sm" onClick={handleSelectAllCategories}>
                                    Select all
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Select from category, subcategory, or sub-subcategory levels.</p>
                        <div className="max-h-64 overflow-y-auto border border-foreground/10 rounded-lg p-3 bg-foreground/5">
                            {renderCategoryTree()}
                        </div>
                    </div>

                    {/* Service Regions - Premium Plus only */}
                    {showServiceLocations && canUseRegionHelper && (
                        <div>
                            <Label className="text-foreground/80 flex items-center gap-2 mb-3">
                                <Globe className="w-4 h-4" /> Service Regions
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {SERVICE_REGIONS.map(region => (
                                    <button
                                        key={region}
                                        type="button"
                                        onClick={() => toggleRegion(region)}
                                        className={`px-3 py-2 rounded-lg text-sm border transition-all ${regions.includes(region)
                                            ? "bg-primary/20 border-primary/50 text-primary font-medium"
                                            : "bg-foreground/5 border-foreground/10 text-foreground/70 hover:border-foreground/30 hover:bg-foreground/10"
                                            }`}
                                    >
                                        {regions.includes(region) && <Check className="w-3 h-3 inline mr-1.5" />}
                                        {region}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Service Countries - Multi-select dropdown with search */}
                    {showServiceLocations && (
                        <div>
                            <Label className="text-foreground/80 flex items-center gap-2 mb-3">
                                <MapPin className="w-4 h-4" /> Service Countries
                                {maxCountries !== -1 && <span className="text-xs text-muted-foreground">({countries.length}/{maxCountries} max)</span>}
                            </Label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setCountriesOpen(!countriesOpen)}
                                    className="w-full h-11 px-3 text-left text-sm bg-foreground/5 border border-foreground/10 rounded-lg flex items-center justify-between hover:border-primary/50 transition-colors"
                                >
                                    <span className="text-muted-foreground">
                                        {countries.length > 0 ? `${countries.length} countries selected` : "Select countries (multi-select enabled)"}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${countriesOpen ? "rotate-180" : ""}`} />
                                </button>
                                {countriesOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-background border border-foreground/10 rounded-lg shadow-xl max-h-64 overflow-hidden">
                                        <div className="p-2 border-b border-foreground/10 sticky top-0 bg-background">
                                            <Input
                                                placeholder="Search countries..."
                                                value={countrySearch}
                                                onChange={e => setCountrySearch(e.target.value)}
                                                className="h-9 text-sm bg-foreground/5 border-foreground/10"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            {filteredCountries.map(country => {
                                                const isSelected = countries.includes(country);
                                                const isDisabled = !isSelected && maxCountries !== -1 && countries.length >= maxCountries;
                                                return (
                                                    <button
                                                        key={country}
                                                        type="button"
                                                        onClick={() => !isDisabled && toggleCountry(country)}
                                                        disabled={isDisabled}
                                                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-primary/10 cursor-pointer"
                                                            }`}
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-xs transition-colors ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-foreground/20"
                                                            }`}>
                                                            {isSelected && <Check className="w-3 h-3" />}
                                                        </div>
                                                        {country}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {countries.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {countries.map(country => (
                                        <span
                                            key={country}
                                            onClick={() => toggleCountry(country)}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full cursor-pointer hover:bg-primary/20 transition-colors"
                                        >
                                            {country} <X className="w-3 h-3" />
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bio Safety Levels - Only for business offerings */}
                    {isBusinessOffering && (
                        <div>
                            <Label className="text-foreground/80 flex items-center gap-2 mb-3">
                                Bio Safety Levels <span className="text-xs text-muted-foreground">(optional)</span>
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {BSL_LEVELS.map(level => (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => toggleBSL(level)}
                                        className={`px-4 py-2 rounded-lg text-sm border transition-all ${bslLevels.includes(level)
                                            ? "bg-primary/20 border-primary/50 text-primary font-medium"
                                            : "bg-foreground/5 border-foreground/10 text-foreground/70 hover:border-foreground/30"
                                            }`}
                                    >
                                        {bslLevels.includes(level) && <Check className="w-3 h-3 inline mr-1.5" />}
                                        BSL-{level}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Certifications - Only for business offerings */}
                    {isBusinessOffering && (
                        <div>
                            <Label className="text-foreground/80 flex items-center gap-2 mb-3">
                                Certifications <span className="text-xs text-muted-foreground">(optional)</span>
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {CERTIFICATIONS.map(cert => (
                                    <button
                                        key={cert}
                                        type="button"
                                        onClick={() => toggleCert(cert)}
                                        className={`px-3 py-2 rounded-lg text-sm border transition-all ${(cert === OTHER_CERT_OPTION ? showOtherCertInput : certifications.includes(cert))
                                            ? "bg-primary/20 border-primary/50 text-primary font-medium"
                                            : "bg-foreground/5 border-foreground/10 text-foreground/70 hover:border-foreground/30"
                                            }`}
                                    >
                                        {(cert === OTHER_CERT_OPTION ? showOtherCertInput : certifications.includes(cert)) && <Check className="w-3 h-3 inline mr-1.5" />}
                                        {cert}
                                    </button>
                                ))}
                            </div>
                            {showOtherCertInput && (
                                <div className="mt-3 space-y-1">
                                    <Input
                                        autoFocus
                                        value={otherCertText}
                                        onChange={(e) => handleOtherCertTextChange(e.target.value)}
                                        placeholder='Enter "other" certification'
                                        className="bg-foreground/5 border-foreground/10"
                                    />
                                    {!otherCertText.trim() && (
                                        <p className="text-xs text-muted-foreground">Please enter a value for "Other".</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Company Profile */}
                    {isBusinessOffering && (
                        <div>
                            <Label className="text-foreground/80 mb-2 block">Company Profile</Label>
                            <Textarea
                                value={companyProfile}
                                onChange={e => setCompanyProfile(e.target.value)}
                                placeholder="Describe your company's services and capabilities..."
                                className={`h-32 bg-foreground/5 resize-none ${companyProfileTooLong ? "border-red-500 focus-visible:ring-red-500" : "border-foreground/10"}`}
                            />
                            {companyProfileTooLong && (
                                <p className="text-xs text-red-500 mt-2">Company profile cannot exceed {COMPANY_PROFILE_MAX_LENGTH} characters.</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">{companyProfile.length}/{COMPANY_PROFILE_MAX_LENGTH} characters</p>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-foreground/80">Company representative(s)</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addRepresentative}>Add representative</Button>
                        </div>
                        {availableRepresentativeOptions.length > 0 && (
                            <div className="space-y-2 mb-3">
                                <p className="text-xs text-muted-foreground">Choose from existing representatives</p>
                                <div className="flex flex-wrap gap-2">
                                    {availableRepresentativeOptions.map((rep) => (
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
                        {representatives.length === 0 && (
                            <p className="text-xs text-muted-foreground mb-2">Optional: Add a new representative or choose one from existing contacts.</p>
                        )}
                        <div className="space-y-2.5">
                            {representatives.map((rep, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <Input
                                        value={rep.firstName}
                                        onChange={(e) => updateRepresentative(index, "firstName", e.target.value)}
                                        placeholder="First name"
                                        className="bg-foreground/5 border-foreground/10"
                                    />
                                    <Input
                                        value={rep.lastName}
                                        onChange={(e) => updateRepresentative(index, "lastName", e.target.value)}
                                        placeholder="Last name"
                                        className="bg-foreground/5 border-foreground/10"
                                    />
                                    <div className="flex gap-2">
                                        <Input
                                            type="email"
                                            value={rep.email}
                                            onChange={(e) => updateRepresentative(index, "email", e.target.value)}
                                            placeholder="Email"
                                            className="bg-foreground/5 border-foreground/10"
                                        />
                                        <Button type="button" variant="ghost" size="sm" onClick={() => removeRepresentative(index)} className="shrink-0">
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Business Address */}
                    {isBusinessOffering && (
                        <div>
                            <Label className="text-foreground/80 mb-2 block">Business Address</Label>
                            <Textarea
                                value={businessAddress}
                                onChange={e => setBusinessAddress(e.target.value)}
                                placeholder="Enter your business address..."
                                className="h-20 bg-foreground/5 border-foreground/10 resize-none"
                            />
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3 shrink-0">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={async () => {
                            let jobPdfUrlOut = jobDescriptionPdfUrl.trim();
                            if (listingGroup === "jobs") {
                                if (jobPdfFile) {
                                    if (!auth.currentUser) {
                                        setJobPdfUploadError("You must be signed in to upload.");
                                        return;
                                    }
                                    const v = validateJobDescriptionPdf(jobPdfFile);
                                    if (v) {
                                        setJobPdfUploadError(v);
                                        return;
                                    }
                                    setJobPdfUploadError("");
                                    try {
                                        setJobPdfUploading(true);
                                        jobPdfUrlOut = await uploadJobDescriptionPdf(auth.currentUser.uid, jobPdfFile, listing.id);
                                    } catch (err: any) {
                                        setJobPdfUploadError(err?.message || "PDF upload failed.");
                                        return;
                                    } finally {
                                        setJobPdfUploading(false);
                                    }
                                } else if (!jobPdfUrlOut) {
                                    setJobPdfUploadError("Add a PDF file or a hosted PDF URL.");
                                    return;
                                }
                                setJobPdfUploadError("");
                            }

                            const sanitizedSelections = sanitizeLowestLevelSelections(
                                getCategoriesForGroup(listingGroup) as any,
                                selectedCategories,
                                selectedSubcategories,
                                selectedSubSubcategories
                            );
                            const categoryDisplayFields = buildDisplayCategoryFields(
                                getCategoriesForGroup(listingGroup) as any,
                                sanitizedSelections.selectedCategories,
                                sanitizedSelections.selectedSubcategories,
                                sanitizedSelections.selectedSubSubcategories
                            );
                            await onSave({
                                selectedCategories: sanitizedSelections.selectedCategories,
                                selectedSubcategories: sanitizedSelections.selectedSubcategories,
                                selectedSubSubcategories: sanitizedSelections.selectedSubSubcategories,
                                ...categoryDisplayFields,
                                ...(showServiceLocations
                                    ? {
                                        serviceCountries: countries,
                                        serviceRegions: canUseRegionHelper ? regions : [],
                                    }
                                    : {}),
                                bioSafetyLevel: bslLevels,
                                certifications: Array.from(
                                    new Set(
                                        certifications
                                            .map((cert) => cert.trim())
                                            .filter((cert) => cert && cert !== OTHER_CERT_OPTION && !cert.toLowerCase().startsWith("other:"))
                                    )
                                ),
                                companyProfileText: (companyProfile || "").slice(0, COMPANY_PROFILE_MAX_LENGTH),
                                businessAddress: businessAddress,
                                companyRepresentatives: representatives
                                    .map((rep) => ({
                                        firstName: rep.firstName.trim(),
                                        lastName: rep.lastName.trim(),
                                        email: rep.email.trim(),
                                    }))
                                    .filter((rep) => rep.firstName || rep.lastName || rep.email),
                                ...(listingGroup === "events"
                                    ? {
                                        eventName,
                                        eventLink,
                                        startDate,
                                        endDate,
                                        eventCountry,
                                        location: eventLocation,
                                        eventProfile,
                                        agenda,
                                        stateRegion: eventStateRegion,
                                        city: eventCity,
                                    }
                                    : {}),
                                ...(listingGroup === "jobs"
                                    ? {
                                        jobTitle,
                                        jobSummary,
                                        industry,
                                        jobtype: jobType,
                                        positionType: jobType,
                                        experienceLevel,
                                        workModel,
                                        positionLink,
                                        jobCountry,
                                        stateRegion: jobStateRegion,
                                        city: jobCity,
                                        location: jobLocationLine,
                                        education,
                                        applicationDeadline,
                                        jobDescriptionPdfUrl: jobPdfUrlOut,
                                        companyWebsiteLink,
                                        linkedInJob,
                                    }
                                    : {}),
                            });
                        }}
                        disabled={
                            processing ||
                            jobPdfUploading ||
                            companyProfileTooLong ||
                            (showOtherCertInput && !otherCertText.trim()) ||
                            representatives
                                .map((rep) => ({
                                    firstName: rep.firstName.trim(),
                                    lastName: rep.lastName.trim(),
                                    email: rep.email.trim(),
                                }))
                                .some((rep) => (rep.firstName || rep.lastName || rep.email) && (!rep.firstName || !rep.lastName || !rep.email)) ||
                            (listingGroup === "events" &&
                                (!eventName.trim() ||
                                    !eventLink.trim() ||
                                    !startDate ||
                                    !endDate ||
                                    !eventCountry.trim() ||
                                    !eventStateRegion.trim() ||
                                    !eventCity.trim() ||
                                    !agenda.trim() ||
                                    !eventProfile.trim() ||
                                    (startDate && endDate && endDate < startDate) ||
                                    (isBasicEventPlan && startDate && endDate !== startDate))) ||
                            (listingGroup === "jobs" &&
                                (!jobTitle.trim() ||
                                    !jobSummary.trim() ||
                                    (!jobDescriptionPdfUrl.trim() && !jobPdfFile) ||
                                    !jobType.trim() ||
                                    !jobCountry.trim() ||
                                    !jobStateRegion.trim() ||
                                    !jobCity.trim() ||
                                    !workModel.trim() ||
                                    !positionLink.trim())) ||
                            (showServiceLocations && countries.length === 0)
                        }
                    >
                        {jobPdfUploading ? "Uploading PDF…" : processing ? "Saving..." : isUpgradeFlow ? "Save & Continue to Stripe" : "Save Changes"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface UpgradePlanModalProps {
    currentPlan: any;
    currentPlanConfig: any;
    allPlans: Record<string, any>;
    onClose: () => void;
    onUpgrade: (planId: string) => void;
    processing: boolean;
}

function UpgradePlanModal({ currentPlan, currentPlanConfig, allPlans, onClose, onUpgrade, processing }: UpgradePlanModalProps) {
    const [selectedPlan, setSelectedPlan] = useState<string>("");

    // Plan tier order for comparison (higher index = higher tier)
    const planTierOrder: Record<string, number> = {
        // Monthly business/consulting
        basic_mo: 1, standard_mo: 2, premium_mo: 3, premium_plus_mo: 4,
        // Yearly business/consulting
        basic_yr: 1, standard_yr: 2, premium_yr: 3, premium_plus_yr: 4,
        // Events
        basic_event: 1, standard_event: 2, premium_event: 3, premium_plus_event: 4,
        // Jobs
        standard_job: 1, premium_job: 2, premium_plus_job: 3,
    };

    const currentTier = planTierOrder[currentPlan.planId] || 0;

    // Determine plan type and billing cycle
    const isBusinessMonthly = currentPlan.planId?.includes('_mo');
    const isBusinessYearly = currentPlan.planId?.includes('_yr');
    const isEvent = currentPlan.planId?.includes('event');
    const isJob = currentPlan.planId?.includes('job');

    // Parse price from string like "$100.00" to number
    const parsePrice = (priceStr: string) => {
        return parseFloat(priceStr.replace(/[$,]/g, '')) || 0;
    };

    const currentPrice = parsePrice(currentPlanConfig?.price || "0");

    // Filter upgrade options: events/jobs = higher tier only; business monthly = higher monthly OR annual at same/higher tier; business yearly = higher annual only
    const upgradePlans = Object.entries(allPlans).filter(([id]) => {
        const targetTier = planTierOrder[id] || 0;

        if (isEvent) return id.includes('event') && targetTier > currentTier;
        if (isJob) return id.includes('job') && targetTier > currentTier;

        const targetMo = id.includes('_mo');
        const targetYr = id.includes('_yr');
        if (!targetMo && !targetYr) return false;

        if (isBusinessMonthly) {
            if (targetMo) return targetTier > currentTier;
            if (targetYr) return targetTier >= currentTier;
            return false;
        }
        if (isBusinessYearly) {
            return targetYr && targetTier > currentTier;
        }
        return false;
    }).sort((a, b) => {
        const ta = planTierOrder[a[0]] || 0;
        const tb = planTierOrder[b[0]] || 0;
        if (ta !== tb) return ta - tb;
        if (a[0].includes("_mo") && b[0].includes("_yr")) return -1;
        if (a[0].includes("_yr") && b[0].includes("_mo")) return 1;
        return 0;
    });

    const selectedPlanConfig = selectedPlan ? allPlans[selectedPlan] : null;
    const selectedPrice = selectedPlanConfig ? parsePrice(selectedPlanConfig.price) : 0;
    const priceDifference = selectedPrice - currentPrice;
    const selectedIsAnnual = Boolean(selectedPlan?.includes('_yr'));
    const crossIntervalBusinessUpgrade =
        Boolean(isBusinessMonthly && selectedIsAnnual);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl border border-foreground/10 w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="px-6 py-5 border-b border-foreground/10 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-primary" /> Upgrade Plan
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="bg-foreground/5 border border-foreground/10 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Current plan</p>
                        <p className="text-lg font-bold text-foreground">{currentPlanConfig?.label}</p>
                        <p className="text-sm text-foreground/80">{currentPlanConfig?.price}{currentPlanConfig?.period}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {currentPlanConfig?.maxCategories === -1 ? "Unlimited" : currentPlanConfig?.maxCategories} categories, {currentPlanConfig?.maxCountries === -1 ? "Unlimited" : currentPlanConfig?.maxCountries} countries
                        </p>
                    </div>

                    {upgradePlans.length === 0 ? (
                        <div className="text-center py-8">
                            <Crown className="w-12 h-12 text-primary mx-auto mb-3" />
                            <p className="text-foreground font-medium">You're on the highest tier!</p>
                            <p className="text-sm text-muted-foreground mt-1">There are no higher plans available for upgrade.</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm font-medium text-foreground">Select a plan to upgrade to:</p>
                            <div className="space-y-3">
                                {upgradePlans.map(([id, config]) => {
                                    const rowIsAnnual = id.includes('_yr');
                                    const rowCrossInterval = Boolean(isBusinessMonthly && rowIsAnnual);
                                    const listPriceDiff = parsePrice(config.price) - currentPrice;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => setSelectedPlan(id)}
                                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedPlan === id
                                                ? "border-primary bg-primary/5"
                                                : "border-foreground/10 hover:border-foreground/20 bg-foreground/5"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-foreground flex items-center gap-2">
                                                        {config.label}
                                                        {config.featurePlan && (
                                                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                                                                Includes {config.featurePlan === "home_page" ? "Home Page" : "Landing Page"} Spotlight
                                                            </Badge>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{config.subtitle}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {config.maxCategories === -1 ? "Unlimited" : config.maxCategories} categories, {config.maxCountries === -1 ? "Unlimited" : config.maxCountries} countries
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-foreground">{config.price}<span className="text-sm font-normal text-muted-foreground">{config.period}</span></p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {rowCrossInterval
                                                            ? "Prorated charge at checkout"
                                                            : `+ $${listPriceDiff.toFixed(2)} vs current list price`}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
                {selectedPlan && (
                    <div className="px-6 py-3 bg-primary/5 border-t border-primary/20">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm text-muted-foreground">Upgrade cost (prorated)</p>
                                <p className="text-xs text-muted-foreground">Next step: update listing details, then complete payment on Stripe.</p>
                            </div>
                            {crossIntervalBusinessUpgrade ? (
                                <p className="text-sm font-semibold text-primary text-right shrink-0">
                                    Based on your billing period
                                </p>
                            ) : (
                                <p className="text-xl font-bold text-primary shrink-0">+${priceDifference.toFixed(2)}</p>
                            )}
                        </div>
                    </div>
                )}
                <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3 shrink-0">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onUpgrade(selectedPlan)} disabled={!selectedPlan || processing || upgradePlans.length === 0}>
                        {processing ? "Processing..." : selectedPlan ? "Continue" : "Select a Plan"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface CancelPlanModalProps {
    plan: any;
    planConfig: any;
    hasFeature: boolean;
    onClose: () => void;
    onCancel: (scope: CancelScope) => void;
    processing: boolean;
}

function CancelPlanModal({ plan, planConfig, hasFeature, onClose, onCancel, processing }: CancelPlanModalProps) {
    const billingEnd =
        plan.billingPeriodEnd?.seconds
            ? new Date(plan.billingPeriodEnd.seconds * 1000)
            : getPlanPeriodEndDate(plan);
    const [cancelChoice, setCancelChoice] = useState<CancelScope | null>(hasFeature ? null : "plan");

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl border border-foreground/10 w-full max-w-md shadow-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-foreground/10 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" /> Cancel subscription
                    </h2>
                    <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-foreground">
                        {hasFeature
                            ? <>You have an active <span className="font-semibold">spotlight add-on</span> on this listing, plus your <span className="font-semibold">{planConfig?.label}</span> plan. Choose what to cancel.</>
                            : <>Cancel your <span className="font-semibold">{planConfig?.label}</span> subscription?</>}
                    </p>
                    {hasFeature && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">Choose one option</p>
                            <button
                                type="button"
                                onClick={() => setCancelChoice("feature")}
                                className={`w-full text-left rounded-lg border p-3 transition-colors ${cancelChoice === "feature"
                                    ? "border-primary bg-primary/10"
                                    : "border-foreground/15 bg-foreground/5 hover:border-foreground/30"
                                    }`}
                            >
                                <span className="font-medium text-foreground">Cancel spotlight add-on only</span>
                                <span className="text-xs text-muted-foreground block mt-1">Your plan keeps billing until you cancel it separately.</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCancelChoice("plan")}
                                className={`w-full text-left rounded-lg border p-3 transition-colors ${cancelChoice === "plan"
                                    ? "border-primary bg-primary/10"
                                    : "border-foreground/15 bg-foreground/5 hover:border-foreground/30"
                                    }`}
                            >
                                <span className="font-medium text-foreground">Cancel this subscription</span>
                                <span className="text-xs text-muted-foreground block mt-1">Stops the plan after the billing date below. Any separate spotlight on this listing is removed.</span>
                            </button>
                        </div>
                    )}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                        <p className="text-sm text-yellow-400">
                            {hasFeature && cancelChoice === "feature" ? (
                                "The spotlight add-on is removed now. Your listing plan stays active until you cancel it."
                            ) : !hasFeature || cancelChoice === "plan" ? (
                                <>
                                    Your subscription stays active until <span className="font-semibold">{billingEnd?.toLocaleDateString() || "the end of your billing period"}</span>.
                                    After that, access tied to this plan ends unless you purchase again.
                                </>
                            ) : (
                                "Select an option above to continue."
                            )}
                        </p>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Keep subscription</Button>
                    <Button
                        variant="destructive"
                        onClick={() => onCancel(hasFeature ? (cancelChoice as CancelScope) : "plan")}
                        disabled={processing || (hasFeature && !cancelChoice)}
                    >
                        {processing
                            ? "Cancelling..."
                            : hasFeature && cancelChoice === "feature"
                                ? "Cancel spotlight"
                                : "Cancel subscription"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface UpgradeFeaturePlanModalProps {
    currentAddonId: string;
    onClose: () => void;
    onPurchase: (featureId: string) => void;
    processing: boolean;
}

function UpgradeFeaturePlanModal({ currentAddonId, onClose, onPurchase, processing }: UpgradeFeaturePlanModalProps) {
    const [selectedFeature, setSelectedFeature] = useState<string>("");
    const targets = FEATURE_PLANS.filter((fp) => getFeatureUpgradeTargets(currentAddonId).includes(fp.id));

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl border border-foreground/10 w-full max-w-2xl shadow-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-foreground/10 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-primary" /> Upgrade spotlight
                    </h2>
                    <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-muted-foreground text-sm">
                        Choose a higher tier. You are charged only the difference in list price (handled at checkout).
                    </p>
                    {targets.length === 0 ? (
                        <p className="text-sm text-muted-foreground">You are already on the highest spotlight tier.</p>
                    ) : (
                        <div className="space-y-3">
                            {targets.map((fp) => {
                                const Icon = fp.icon;
                                const isSelected = selectedFeature === fp.id;
                                return (
                                    <button
                                        key={fp.id}
                                        type="button"
                                        onClick={() => setSelectedFeature(fp.id)}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected
                                            ? "border-primary bg-primary/5"
                                            : "border-foreground/10 hover:border-foreground/20 bg-foreground/5"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? "bg-primary/20" : "bg-foreground/10"}`}>
                                                <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-foreground/60"}`} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-foreground">{fp.label}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{fp.description}</p>
                                            </div>
                                            <p className="text-lg font-bold text-primary shrink-0">{formatFeatureUpgradeDelta(currentAddonId, fp.id)}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onPurchase(selectedFeature)} disabled={!selectedFeature || processing || targets.length === 0}>
                        <CreditCard className="w-4 h-4 mr-2" />
                        {processing ? "Processing..." : "Continue to payment"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface AddFeaturePlanModalProps {
    plan: any;
    listing: any;
    featurePlans: any[];
    onClose: () => void;
    onPurchase: (featureId: string) => void;
    processing: boolean;
}

function AddFeaturePlanModal({ featurePlans, onClose, onPurchase, processing }: AddFeaturePlanModalProps) {
    const [selectedFeature, setSelectedFeature] = useState<string>("");

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl border border-foreground/10 w-full max-w-2xl shadow-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-foreground/10 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" /> Add Feature Plan
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-muted-foreground text-sm">
                        Boost your visibility by featuring your listing on the landing page or home page.
                    </p>
                    <div className="space-y-3">
                        {featurePlans.map(fp => {
                            const Icon = fp.icon;
                            const isSelected = selectedFeature === fp.id;
                            return (
                                <button
                                    key={fp.id}
                                    onClick={() => setSelectedFeature(fp.id)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-foreground/10 hover:border-foreground/20 bg-foreground/5"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? "bg-primary/20" : "bg-foreground/10"}`}>
                                            <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-foreground/60"}`} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-foreground">{fp.label}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{fp.description}</p>
                                        </div>
                                        <p className="text-lg font-bold text-foreground">{fp.price}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onPurchase(selectedFeature)} disabled={!selectedFeature || processing}>
                        <CreditCard className="w-4 h-4 mr-2" />
                        {processing ? "Processing..." : "Purchase Feature"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

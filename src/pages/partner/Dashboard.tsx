import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "@/firebase";
import { doc, getDoc, updateDoc, collection, query, onSnapshot, where } from "firebase/firestore";
import { logActivity } from "@/lib/auditLogger";
import { onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateEmail } from "firebase/auth";
import { API_BASE_URL } from "@/apiConfig";
import { buildDisplayCategoryFields, sanitizeLowestLevelSelections } from "@/lib/categorySelection";
import { isValidBusinessAddress } from "@/lib/addressValidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    LayoutDashboard, User, KeyRound, Receipt, LogOut,
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
    premium_plus_event: { label: "Premium Plus", subtitle: "Comprehensive event listing", price: "$1,450.00", period: "/month", maxCategories: -1, maxCountries: -1, features: ["Event profile", "Event agenda", "Event dates", "Event Location", "Select multiple categories", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"] },
    // Jobs
    standard_job: { label: "Standard", subtitle: "Job posting", price: "$400.00", period: "", maxCategories: -1, maxCountries: -1, features: ["Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"] },
    premium_job: { label: "Premium", subtitle: "Job posting & landing page spotlight", price: "$800.00", period: "", maxCategories: -1, maxCountries: -1, featurePlan: "landing_page", features: ["Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication", "Extra feature for landing page spotlight"] },
    premium_plus_job: { label: "Premium Plus", subtitle: "Advanced job posting", price: "$1,000.00", period: "", maxCategories: -1, maxCountries: -1, features: ["Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"] },
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

const inferPlanGroup = (plan: any): string => {
    if (plan?.group) return plan.group;
    if (plan?.collectionName === "businessOfferingsCollection") return "business_offerings";
    if (plan?.collectionName === "consultingServicesCollection" || plan?.collectionName === "consultingCollection") return "consulting";
    if (plan?.collectionName === "eventsCollection") return "events";
    if (plan?.collectionName === "jobsCollection") return "jobs";
    return "";
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

export default function Dashboard() {
    const navigate = useNavigate();
    const [partnerData, setPartnerData] = useState<any>(null);
    const [offerings, setOfferings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>("dashboard");
    const [transactions, setTransactions] = useState<any[]>([]);
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
    const [selectedPlanForAction, setSelectedPlanForAction] = useState<any>(null);
    const [selectedListingForEdit, setSelectedListingForEdit] = useState<any>(null);
    const [actionProcessing, setActionProcessing] = useState(false);
    const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
    const profileCompanyProfileTooLong = (profileForm.companyProfile || "").length >= COMPANY_PROFILE_MAX_LENGTH;
    const isFeatureEligiblePlan = (plan: any) => {
        if (!plan?.active || !plan.listingId || !plan.collectionName) return false;
        const linkedListing = offerings.find((o) => o.id === plan.listingId);
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
                    try {
                        await updateEmail(auth.currentUser, nextEmail);
                    } catch (emailError: any) {
                        if (emailError?.code === "auth/requires-recent-login") {
                            setProfileMsg("Please sign out and sign back in before changing your email.");
                            return;
                        }
                        if (emailError?.code === "auth/email-already-in-use") {
                            setProfileMsg("This email is already in use by another account.");
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
        if (passwordForm.newPassword.length < 6) {
            setPasswordMsg({ type: "error", text: "New password must be at least 6 characters." }); setPasswordSaving(false); return;
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
                const activeListingPlan = activePlans.find(isFeatureEligiblePlan);
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

    // Handle saving listing edits (all editable fields)
    const handleSaveListingEdit = async (updatedData: any) => {
        setActionProcessing(true);
        try {
            if (auth.currentUser && selectedListingForEdit) {
                const listingRef = doc(
                    db,
                    "partnersCollection",
                    auth.currentUser.uid,
                    selectedListingForEdit.__col,
                    selectedListingForEdit.id
                );

                // Build update object with only changed/provided fields
                const updateObj: Record<string, any> = {
                    serviceCountries: updatedData.serviceCountries,
                    updatedAt: new Date(),
                };
                if (updatedData.serviceRegions !== undefined) {
                    updateObj.serviceRegions = updatedData.serviceRegions;
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

                // Add business offering specific fields if present
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
                if (updatedData.companyRepresentatives !== undefined) {
                    updateObj.companyRepresentatives = updatedData.companyRepresentatives;
                }

                await updateDoc(listingRef, updateObj);
                setActionMessage({ type: "success", text: "Listing updated successfully!" });
                setTimeout(() => {
                    setShowEditListingModal(false);
                    setSelectedListingForEdit(null);
                    setActionMessage({ type: "", text: "" });
                }, 1500);
            }
        } catch (err) {
            console.error("Failed to update listing:", err);
            setActionMessage({ type: "error", text: "Failed to update listing. Please try again." });
        } finally {
            setActionProcessing(false);
        }
    };

    // Handle plan upgrade - uses Stripe subscription update or creates new checkout
    const handleUpgradePlan = async (newPlanId: string) => {
        setActionProcessing(true);
        try {
            if (auth.currentUser && selectedPlanForAction) {
                const origin = window.location.origin;
                const resp = await fetch(`${API_BASE_URL}/api/upgrade-subscription`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        subscriptionId: selectedPlanForAction.stripeSubscriptionId || null,
                        newPlanId,
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
                        errMessage = `API offline: Please ensure backend server is running.`;
                    }
                    throw new Error(errMessage);
                }
                const data = await resp.json();

                if (data.url) {
                    // Redirect to Stripe checkout for new subscription
                    window.location.href = data.url;
                } else if (data.success) {
                    // Subscription was updated directly
                    setActionMessage({ type: "success", text: "Plan upgraded successfully!" });
                    setTimeout(() => {
                        setShowUpgradeModal(false);
                        setSelectedPlanForAction(null);
                        setActionMessage({ type: "", text: "" });
                    }, 1500);
                    setActionProcessing(false);
                }
            }
        } catch (err: any) {
            console.error("Failed to upgrade plan:", err);
            setActionMessage({ type: "error", text: err.message || "Failed to upgrade plan." });
            setActionProcessing(false);
        }
    };

    // Handle plan cancellation (cancel at period end)
    const handleCancelPlan = async () => {
        setActionProcessing(true);
        try {
            if (auth.currentUser && selectedPlanForAction) {
                const planRef = doc(
                    db,
                    "partnersCollection",
                    auth.currentUser.uid,
                    "planCollection",
                    selectedPlanForAction.id
                );

                let stripeCancelAt: number | null = null;

                // If there's a Stripe subscription, cancel it at period end first.
                // Only mark Firestore as cancelled after Stripe confirms.
                if (selectedPlanForAction.stripeSubscriptionId) {
                    const response = await fetch(`${API_BASE_URL}/api/cancel-subscription`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            subscriptionId: selectedPlanForAction.stripeSubscriptionId,
                        }),
                    });

                    let payload: any = null;
                    try {
                        payload = await response.json();
                    } catch {
                        payload = null;
                    }

                    if (!response.ok || !payload?.success) {
                        const errMessage =
                            payload?.error ||
                            "Stripe did not confirm cancellation at period end. Please try again.";
                        throw new Error(errMessage);
                    }

                    stripeCancelAt = typeof payload?.cancelAt === "number" ? payload.cancelAt : null;
                }

                const planUpdate: Record<string, any> = {
                    cancelAtPeriodEnd: true,
                    cancelledAt: new Date(),
                };
                if (stripeCancelAt) {
                    const periodEndDate = new Date(stripeCancelAt * 1000);
                    planUpdate.billingPeriodEnd = periodEndDate;
                    planUpdate.cancelAt = periodEndDate;
                }
                await updateDoc(planRef, planUpdate);

                setActionMessage({ type: "success", text: "Subscription will be cancelled at the end of the billing period." });
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
                if (!isFeatureEligiblePlan(selectedPlanForAction)) {
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

    const isApproved = partnerData.partnerStatus !== "Disabled";
    const displayName = partnerData.primaryName || "Partner";
    const currentPlan = PLAN_CONFIGS[partnerData.selectedPlan] || null;
    const currentGroup = partnerData.selectedGroup || "";
    const listingAddon = offerings.find((o) => o.selectedAddon && o.selectedAddon !== "none" && o.selectedAddon !== "")?.selectedAddon || "";
    const resolvedAddon = listingAddon || partnerData.selectedAddon || "";
    const hasFeaturePlan = resolvedAddon !== "none" && resolvedAddon !== "";
    const includedFeature = currentPlan?.featurePlan || null;
    const hasActivePaidPlan = activePlans.some(isFeatureEligiblePlan);
    const groupPlanDetails = (["business_offerings", "consulting"] as const)
        .map((group) => {
            const activeGroupPlan = activePlans.find((plan) => plan.active !== false && inferPlanGroup(plan) === group);
            if (!activeGroupPlan) return null;
            const config = PLAN_CONFIGS[activeGroupPlan.planId] || null;
            const isYearly = activeGroupPlan.billingInterval === "year" || activeGroupPlan.planId?.includes("_yr");
            return { group, plan: activeGroupPlan, config, isYearly };
        })
        .filter(Boolean) as Array<{ group: "business_offerings" | "consulting"; plan: any; config: PlanConfig | null; isYearly: boolean }>;
    const planForDetails = currentPlan || groupPlanDetails[0]?.config || null;
    const businessOfferingLock = getGroupPlanLock(activePlans, "business_offerings");
    const consultingLock = getGroupPlanLock(activePlans, "consulting");
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

    const formattedTransactions = transactions.map(t => ({
        id: t.id,
        date: t.createdAt ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : "N/A",
        description: t.type === "feature" ? `Feature: ${t.featureId?.replace(/_/g, ' ')}` : `Plan: ${t.planId?.replace(/_/g, ' ').toUpperCase() || 'N/A'}`,
        amount: `$${t.amount?.toFixed(2) || "0.00"}`,
        status: t.status === "succeeded" ? "Completed" : t.status,
        method: "Stripe Checkout",
        group: t.group?.replace(/_/g, ' ') || null,
        businessName: t.businessName || null,
        selectedCategories: t.selectedCategories || [],
        serviceCountries: t.serviceCountries || [],
        serviceRegions: t.serviceRegions || [],
        planId: t.planId,
        currency: t.currency?.toUpperCase() || "USD",
    }));

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
                                        <h2 className="text-xl font-bold text-foreground">Add Feature Plan</h2>
                                        <button onClick={() => { setShowFeatureModal(false); setSelectedFeaturePlan(""); }} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <p className="text-muted-foreground text-sm mb-2">Get extra visibility by being featured on the category page or the home page. Select a plan below:</p>
                                        {FEATURE_PLANS.map(fp => {
                                            const Ic = fp.icon;
                                            const isSelected = selectedFeaturePlan === fp.id;
                                            const alreadyHas = partnerData.selectedAddon === fp.id || includedFeature === fp.id;
                                            return (
                                                <button key={fp.id} disabled={alreadyHas || featureProcessing} onClick={() => setSelectedFeaturePlan(fp.id)}
                                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${alreadyHas ? "border-green-500/30 bg-green-500/5 opacity-70 cursor-not-allowed" : isSelected ? "border-primary bg-primary/5" : "border-foreground/10 hover:border-foreground/20 bg-foreground/5"}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? "bg-primary/20" : "bg-foreground/10"}`}>
                                                            <Ic className={`w-5 h-5 ${isSelected ? "text-primary" : "text-foreground/60"}`} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-foreground flex items-center gap-2">
                                                                {fp.label}
                                                                {alreadyHas && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Active</Badge>}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{fp.description}</p>
                                                        </div>
                                                        <p className="text-lg font-bold text-foreground">{fp.price}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3">
                                        <Button variant="ghost" onClick={() => { setShowFeatureModal(false); setSelectedFeaturePlan(""); }}>Cancel</Button>
                                        <Button disabled={!selectedFeaturePlan || featureProcessing} onClick={handlePurchaseFeature} className="px-8 flex items-center">
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            {featureProcessing ? "Processing..." : "Purchase Feature Plan"}
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
                        planConfig={PLAN_CONFIGS[selectedPlanForAction?.planId]}
                        representativeOptions={representativeOptions}
                        onClose={() => {
                            setShowEditListingModal(false);
                            setSelectedListingForEdit(null);
                            setSelectedPlanForAction(null);
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
                        }}
                        onUpgrade={handleUpgradePlan}
                        processing={actionProcessing}
                    />
                )}

                {/* Cancel Plan Modal */}
                {showCancelModal && selectedPlanForAction && (
                    <CancelPlanModal
                        plan={selectedPlanForAction}
                        planConfig={PLAN_CONFIGS[selectedPlanForAction?.planId]}
                        onClose={() => {
                            setShowCancelModal(false);
                            setSelectedPlanForAction(null);
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

                {/* Current Plan Details */}
                {planForDetails && (
                    <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md shadow-xl">
                        <CardHeader className="pb-4 border-b border-foreground/10">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl flex items-center gap-2"><Crown className="w-5 h-5 text-primary" /> Your Plan Details</CardTitle>
                                <div className="flex items-center gap-3">
                                    <Badge className="bg-primary/20 text-primary border-primary/50 px-3 py-1">
                                            {groupPlanDetails.length > 1 ? `${groupPlanDetails.length} Active Plans` : (planForDetails?.label || "Active Plan")}
                                    </Badge>
                                    {groupPlanDetails.length <= 1 && planForDetails?.price && (
                                        <span className="text-2xl font-bold text-foreground">{planForDetails.price}<span className="text-sm font-normal text-muted-foreground">{planForDetails.period}</span></span>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {groupPlanDetails.length > 0 && (
                                <div className="mb-6 pb-6 border-b border-foreground/10">
                                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Active Business & Consulting Plans</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {groupPlanDetails.map(({ group, config, isYearly }) => (
                                            <div key={group} className="bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                                    {group === "business_offerings" ? "Business Offerings" : "Consulting Services"}
                                                </p>
                                                <p className="text-base font-semibold text-foreground">{config?.label || "Active Plan"}</p>
                                                <p className="text-sm text-foreground/80 mt-1">
                                                    {config?.price || "N/A"}{config?.period || ""} • {isYearly ? "Yearly" : "Monthly"}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Limits */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Plan Limits</h4>
                                    <div className="bg-muted/40 p-4 rounded-lg border border-foreground/10 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-foreground/80">Max Categories</span>
                                            <span className="font-bold text-foreground">{planForDetails.maxCategories === -1 ? "Unlimited" : planForDetails.maxCategories}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-foreground/80">Max Countries</span>
                                            <span className="font-bold text-foreground">{planForDetails.maxCountries === -1 ? "Unlimited" : planForDetails.maxCountries}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Features */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Included Features</h4>
                                    <ul className="space-y-1.5">
                                        {planForDetails.features.map((f, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                                                <Check className={`w-4 h-4 shrink-0 mt-0.5 ${f.toLowerCase().includes("extra feature") ? "text-primary" : "text-green-500"}`} />
                                                <span className={f.toLowerCase().includes("extra feature") ? "text-primary font-medium" : ""}>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Feature plan status */}
                            <div className="mt-6 pt-6 border-t border-foreground/10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Feature Spotlight</h4>
                                        {includedFeature ? (
                                            <p className="text-foreground text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Included with your {planForDetails.label} plan — {includedFeature === "home_page" ? "Home Page" : "Landing Page"} spotlight</p>
                                        ) : hasFeaturePlan ? (
                                            <p className="text-foreground text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Active — {FEATURE_PLANS.find(f => f.id === resolvedAddon)?.label || resolvedAddon.replace(/_/g, " ")}</p>
                                        ) : (
                                            <p className="text-muted-foreground text-sm">No feature spotlight active. Add one to boost your visibility.</p>
                                        )}
                                    </div>
                                    {!includedFeature && !hasFeaturePlan && hasActivePaidPlan && (
                                        <Button onClick={() => setShowFeatureModal(true)} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                                            <Star className="w-4 h-4 mr-2" /> Add Feature Plan
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Active Subscriptions Section */}
                {activePlans.length > 0 && (
                    <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md shadow-xl">
                        <CardHeader className="pb-4 border-b border-foreground/10">
                            <CardTitle className="text-xl flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Active Subscriptions</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                {activePlans.filter(p => p.active).map(plan => {
                                    const planConfig = PLAN_CONFIGS[plan.planId];
                                    const startDate = plan.startDate?.seconds ? new Date(plan.startDate.seconds * 1000) : (plan.startDate ? new Date(plan.startDate) : null);
                                    const billingEnd = plan.billingPeriodEnd?.seconds ? new Date(plan.billingPeriodEnd.seconds * 1000) : (plan.billingPeriodEnd ? new Date(plan.billingPeriodEnd) : null);
                                    const isYearly = plan.billingInterval === "year" || plan.planId?.includes('_yr');
                                    const linkedListing = offerings.find((o) =>
                                        o.id === plan.listingId && (!plan.collectionName || o.__col === plan.collectionName)
                                    ) || offerings.find((o) => o.id === plan.listingId);
                                    const planRepresentatives = linkedListing?.companyRepresentatives || plan.companyRepresentatives || [];
                                    const hasFeature = linkedListing?.selectedAddon && linkedListing.selectedAddon !== "" && linkedListing.selectedAddon !== "none";
                                    const includedFeature = planConfig?.featurePlan;
                                    const canAddFeature = !includedFeature && !hasFeature && isFeatureEligiblePlan(plan);

                                    return (
                                        <div key={plan.id} className="bg-muted/40 border border-foreground/10 rounded-xl p-5">
                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                            <h4 className="text-lg font-bold text-foreground">{planConfig?.label || plan.planName || plan.planId?.replace(/_/g, ' ').toUpperCase()}</h4>
                                                            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Active</Badge>
                                                            <Badge variant="outline" className="border-foreground/20">{isYearly ? "Annual" : "Monthly"}</Badge>
                                                            {plan.cancelAtPeriodEnd && (
                                                                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Cancels {billingEnd?.toLocaleDateString()}</Badge>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Start Date</p>
                                                                <p className="text-sm text-foreground font-medium">{startDate ? startDate.toLocaleDateString() : "N/A"}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Renewal Date</p>
                                                                <p className="text-sm text-foreground font-medium">{billingEnd ? billingEnd.toLocaleDateString() : "N/A"}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Billing Cycle</p>
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
                                                                onClick={() => {
                                                                    setSelectedListingForEdit(linkedListing);
                                                                    setSelectedPlanForAction(plan);
                                                                    setShowEditListingModal(true);
                                                                }}
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit Listing
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="border-primary/50 text-primary hover:bg-primary/10"
                                                            onClick={() => {
                                                                setSelectedPlanForAction(plan);
                                                                setShowUpgradeModal(true);
                                                            }}
                                                        >
                                                            <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" /> Upgrade
                                                        </Button>
                                                        {canAddFeature && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="border-secondary/50 text-secondary hover:bg-secondary/10"
                                                                onClick={() => {
                                                                    setSelectedPlanForAction(plan);
                                                                    setSelectedListingForEdit(linkedListing);
                                                                    setShowAddFeatureModal(true);
                                                                }}
                                                            >
                                                                <Star className="w-3.5 h-3.5 mr-1.5" /> Add Feature
                                                            </Button>
                                                        )}
                                                        {!plan.cancelAtPeriodEnd && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                                                onClick={() => {
                                                                    setSelectedPlanForAction(plan);
                                                                    setShowCancelModal(true);
                                                                }}
                                                            >
                                                                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Cancel
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Feature status */}
                                                {(includedFeature || hasFeature) && (
                                                    <div className="pt-3 border-t border-foreground/10">
                                                        <p className="text-sm text-foreground flex items-center gap-2">
                                                            <Sparkles className="w-4 h-4 text-primary" />
                                                            {includedFeature
                                                                ? `Included: ${includedFeature === "home_page" ? "Home Page" : "Landing Page"} Spotlight`
                                                                : `Active Feature: ${FEATURE_PLANS.find(f => f.id === linkedListing?.selectedAddon)?.label}`
                                                            }
                                                        </p>
                                                    </div>
                                                )}
                                                {planRepresentatives?.length > 0 && (
                                                    <div className="pt-3 border-t border-foreground/10">
                                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Company Representatives</p>
                                                        <div className="space-y-1.5">
                                                            {planRepresentatives.map((rep: any, i: number) => (
                                                                <p key={i} className="text-sm text-foreground/90">
                                                                    {rep.firstName} {rep.lastName} - {rep.email}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
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
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Email <span className="text-red-400">*</span></Label>
                        <Input type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                    </div>
                    <div className="space-y-2">
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
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Confirm new password</Label>
                        <Input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                    </div>
                    <Button onClick={handlePasswordChange} disabled={passwordSaving || !passwordForm.currentPassword || !passwordForm.newPassword} className="w-full h-11 mt-2">
                        <KeyRound className="w-4 h-4 mr-2" />{passwordSaving ? "Updating..." : "Update Password"}
                    </Button>
                </div>
            </div>
        );
    }

    // ─── TRANSACTIONS TAB ───
    function renderTransactions(txns: any[]) {
        return (
            <div className="max-w-4xl space-y-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Transactions</h1>
                <p className="text-muted-foreground text-sm">View your payment history and billing activity.</p>
                {txns.length === 0 ? (
                    <div className="bg-foreground/5 border border-foreground/10 p-12 rounded-xl text-center">
                        <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No transactions yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {txns.map(txn => (
                            <div key={txn.id} className="bg-foreground/5 border border-foreground/10 rounded-xl p-5 hover:border-foreground/20 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                    <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                                        <CreditCard className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-foreground font-semibold">{txn.description}</p>
                                                {txn.group && (
                                                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{txn.group}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-lg font-bold text-foreground">{txn.amount}</span>
                                                <Badge className="bg-green-500/10 text-green-400 border-green-500/30">{txn.status}</Badge>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {txn.date}</span>
                                            <span>{txn.method}</span>
                                            <span className="text-foreground/50">{txn.currency}</span>
                                        </div>

                                        {/* Categories */}
                                        {txn.selectedCategories?.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-foreground/10">
                                                <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold block mb-1.5">Categories</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(txn.selectedCategories || []).map((cat: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-primary/30 text-xs">{cat}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {txn.selectedSubcategories?.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-foreground/10">
                                                <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold block mb-1.5">Subcategories</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(txn.selectedSubcategories || []).map((sub: string, i: number) => (
                                                        <Badge key={i} variant="outline" className="border-foreground/20 text-xs">{sub}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {txn.selectedSubSubcategories?.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-foreground/10">
                                                <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold block mb-1.5">Sub-subcategories</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {txn.selectedSubSubcategories.map((subSub: string, i: number) => (
                                                        <Badge key={i} variant="outline" className="border-primary/30 text-primary text-xs">{subSub}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Countries & Regions */}
                                        {(txn.serviceCountries?.length > 0 || txn.serviceRegions?.length > 0) && (
                                            <div className="mt-3 pt-3 border-t border-foreground/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {txn.serviceCountries?.length > 0 && (
                                                    <div>
                                                        <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold block mb-1.5">Countries</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {txn.serviceCountries.map((country: string, i: number) => (
                                                                <Badge key={i} variant="secondary" className="bg-foreground/10 text-xs">{country}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {txn.serviceRegions?.length > 0 && (
                                                    <div>
                                                        <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold block mb-1.5">Regions</span>
                                                        <p className="text-xs text-foreground/80">{txn.serviceRegions.join(', ')}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {txn.companyRepresentatives?.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-foreground/10">
                                                <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold block mb-1.5">Company Representatives</span>
                                                <div className="space-y-1">
                                                    {txn.companyRepresentatives.map((rep: any, i: number) => (
                                                        <p key={i} className="text-xs text-foreground/80">
                                                            {rep.firstName} {rep.lastName} - {rep.email}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
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
    representativeOptions: Array<{ firstName: string; lastName: string; email: string }>;
    onClose: () => void;
    onSave: (data: any) => void;
    processing: boolean;
}

function EditListingModal({ listing, planConfig, representativeOptions, onClose, onSave, processing }: EditListingModalProps) {
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
    const [countries, setCountries] = useState<string[]>(listing.serviceCountries || []);
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

    const maxCategories = planConfig?.maxCategories || -1;
    const maxCountries = planConfig?.maxCountries || -1;
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
                    {canUseRegionHelper && (
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
                        onClick={() => {
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
                            onSave({
                                selectedCategories: sanitizedSelections.selectedCategories,
                                selectedSubcategories: sanitizedSelections.selectedSubcategories,
                                selectedSubSubcategories: sanitizedSelections.selectedSubSubcategories,
                                ...categoryDisplayFields,
                                serviceCountries: countries,
                                serviceRegions: canUseRegionHelper ? regions : [],
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
                            });
                        }}
                        disabled={
                            processing ||
                            companyProfileTooLong ||
                            (showOtherCertInput && !otherCertText.trim()) ||
                            representatives
                                .map((rep) => ({
                                    firstName: rep.firstName.trim(),
                                    lastName: rep.lastName.trim(),
                                    email: rep.email.trim(),
                                }))
                                .some((rep) => (rep.firstName || rep.lastName || rep.email) && (!rep.firstName || !rep.lastName || !rep.email))
                        }
                    >
                        {processing ? "Saving..." : "Save Changes"}
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
    const isMonthly = currentPlan.planId?.includes('_mo') || currentPlan.planId?.includes('_event');
    const isEvent = currentPlan.planId?.includes('event');
    const isJob = currentPlan.planId?.includes('job');

    // Parse price from string like "$100.00" to number
    const parsePrice = (priceStr: string) => {
        return parseFloat(priceStr.replace(/[$,]/g, '')) || 0;
    };

    const currentPrice = parsePrice(currentPlanConfig?.price || "0");

    // Filter to show only UPGRADE options (higher tier, same billing cycle)
    const upgradePlans = Object.entries(allPlans).filter(([id]) => {
        const targetTier = planTierOrder[id] || 0;

        // Must be higher tier
        if (targetTier <= currentTier) return false;

        // Must match plan type
        if (isEvent) return id.includes('event');
        if (isJob) return id.includes('job');

        // For business/consulting, match monthly/yearly
        if (isMonthly) return id.includes('_mo') && !id.includes('event') && !id.includes('job');
        return id.includes('_yr') && !id.includes('event') && !id.includes('job');
    }).sort((a, b) => (planTierOrder[a[0]] || 0) - (planTierOrder[b[0]] || 0));

    // Calculate price difference for selected plan
    const selectedPlanConfig = selectedPlan ? allPlans[selectedPlan] : null;
    const selectedPrice = selectedPlanConfig ? parsePrice(selectedPlanConfig.price) : 0;
    const priceDifference = selectedPrice - currentPrice;

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
                                    const upgradeDiff = parsePrice(config.price) - currentPrice;
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
                                                    <p className="text-xs text-green-400 mt-1">+${upgradeDiff.toFixed(2)} difference</p>
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
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Upgrade cost (prorated)</p>
                                <p className="text-xs text-muted-foreground">You'll be charged the difference for the remaining billing period</p>
                            </div>
                            <p className="text-xl font-bold text-primary">+${priceDifference.toFixed(2)}</p>
                        </div>
                    </div>
                )}
                <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3 shrink-0">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onUpgrade(selectedPlan)} disabled={!selectedPlan || processing || upgradePlans.length === 0}>
                        {processing ? "Processing..." : selectedPlan ? `Upgrade to ${allPlans[selectedPlan]?.label}` : "Select a Plan"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface CancelPlanModalProps {
    plan: any;
    planConfig: any;
    onClose: () => void;
    onCancel: () => void;
    processing: boolean;
}

function CancelPlanModal({ plan, planConfig, onClose, onCancel, processing }: CancelPlanModalProps) {
    const billingEnd = plan.billingPeriodEnd?.seconds ? new Date(plan.billingPeriodEnd.seconds * 1000) : null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl border border-foreground/10 w-full max-w-md shadow-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-foreground/10 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" /> Cancel Subscription
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-foreground">
                        Are you sure you want to cancel your <span className="font-semibold">{planConfig?.label}</span> subscription?
                    </p>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                        <p className="text-sm text-yellow-400">
                            Your subscription will remain active until <span className="font-semibold">{billingEnd?.toLocaleDateString() || "the end of your billing period"}</span>.
                            After that, your listing will be deactivated and removed from public view.
                        </p>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Keep Subscription</Button>
                    <Button variant="destructive" onClick={onCancel} disabled={processing}>
                        {processing ? "Cancelling..." : "Cancel Subscription"}
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

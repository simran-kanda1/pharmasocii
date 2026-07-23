import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { uploadJobDescriptionPdf, uploadEventAgendaPdf, validateJobDescriptionPdf } from "@/lib/jobDescriptionUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    LayoutDashboard, User, KeyRound, Receipt, LogOut, Download, FileSpreadsheet, FileText, Info,
    Building, Mail, Phone, MapPin,
    PlusCircle, Save, CheckCircle2,
    Clock, ChevronDown, ChevronRight, UploadCloud, Eye, EyeOff,
    CreditCard, Star, Sparkles, Crown, Check, X,
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
    basic_event: { label: "Basic", subtitle: "Single day conference/event", price: "$500.00", period: "/month", maxCategories: -1, maxCountries: -1, features: ["Event profile", "Agenda highlights + full agenda PDF", "Event date", "Event Location", "Select multiple categories for better visibility", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"] },
    standard_event: { label: "Standard", subtitle: "Multi day conference/event", price: "$850.00", period: "/month", maxCategories: -1, maxCountries: -1, features: ["Event profile", "Agenda highlights + full agenda PDF", "Event dates", "Event Location", "Select multiple categories for better visibility", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"] },
    premium_event: { label: "Premium", subtitle: "Event listing + landing page spotlight", price: "$1,250.00", period: "/month", maxCategories: -1, maxCountries: -1, featurePlan: "landing_page", features: ["Extra Feature: Landing page spotlight for increased visibility", "Event profile", "Agenda highlights + full agenda PDF", "Event dates", "Event Location", "Select multiple categories for better visibility", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"] },
    premium_plus_event: { label: "Premium Plus", subtitle: "Event listing + home page spotlight", price: "$1,450.00", period: "/month", maxCategories: -1, maxCountries: -1, featurePlan: "home_page", features: ["Extra Feature: Home page spotlight for maximum visibility", "Event profile", "Agenda highlights + full agenda PDF", "Event dates", "Event Location", "Select multiple categories", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"] },
    // Jobs
    standard_job: { label: "Standard", subtitle: "Job posting", price: "$400.00", period: "/month", maxCategories: -1, maxCountries: -1, features: ["Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"] },
    premium_job: { label: "Premium", subtitle: "Job posting & landing page spotlight", price: "$800.00", period: "/month", maxCategories: -1, maxCountries: -1, featurePlan: "landing_page", features: ["Extra Feature: Landing page spotlight for increased visibility", "Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"] },
    premium_plus_job: { label: "Premium Plus", subtitle: "Job posting + home page spotlight", price: "$1,000.00", period: "/month", maxCategories: -1, maxCountries: -1, featurePlan: "home_page", features: ["Extra Feature: Home page spotlight for maximum visibility", "Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"] },
};

const PLAN_UPGRADE_TIER_ORDER: Record<string, number> = {
    basic_mo: 1, standard_mo: 2, premium_mo: 3, premium_plus_mo: 4,
    basic_yr: 1, standard_yr: 2, premium_yr: 3, premium_plus_yr: 4,
    basic_event: 1, standard_event: 2, premium_event: 3, premium_plus_event: 4,
    standard_job: 1, premium_job: 2, premium_plus_job: 3,
};

function getAvailablePlanUpgradeIds(currentPlanId: string | undefined): string[] {
    if (!currentPlanId) return [];
    const currentTier = PLAN_UPGRADE_TIER_ORDER[currentPlanId] || 0;
    const isBusinessMonthly = currentPlanId.includes("_mo");
    const isBusinessYearly = currentPlanId.includes("_yr");
    const isEvent = currentPlanId.includes("_event");
    const isJob = currentPlanId.includes("_job");
    return Object.keys(PLAN_CONFIGS).filter((id) => {
        const targetTier = PLAN_UPGRADE_TIER_ORDER[id] || 0;
        if (isEvent) return id.includes("_event") && targetTier > currentTier;
        if (isJob) return id.includes("_job") && targetTier > currentTier;
        const targetMo = id.includes("_mo");
        const targetYr = id.includes("_yr");
        if (!targetMo && !targetYr) return false;
        if (isBusinessMonthly) {
            if (targetMo) return targetTier > currentTier;
            if (targetYr) return targetTier >= currentTier;
            return false;
        }
        if (isBusinessYearly) return targetYr && targetTier > currentTier;
        return false;
    });
}

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

const FEATURE_SPOTLIGHT_TIER: Record<string, number> = {
    landing_page: 1,
    home_page: 2,
    both: 3,
};

const isEventOrJobPlanId = (planId?: string | null) => {
    const id = String(planId || "");
    return id.includes("_event") || id.includes("_job");
};

const isEventOrJobListing = (planId?: string | null, listing?: any) =>
    isEventOrJobPlanId(planId) ||
    listing?.__col === "eventsCollection" ||
    listing?.__col === "jobsCollection";

const spotlightTierFromId = (featureId?: string | null) =>
    FEATURE_SPOTLIGHT_TIER[String(featureId || "").trim()] || 0;

const spotlightIdFromTier = (tier: number): string | null => {
    if (tier >= 3) return "both";
    if (tier >= 2) return "home_page";
    if (tier >= 1) return "landing_page";
    return null;
};

const getEffectiveSpotlightTier = (listing: any, planId?: string | null) => {
    const addon = getSpotlightAddonTierId(listing);
    const included = planId ? PLAN_CONFIGS[planId]?.featurePlan : null;
    return Math.max(spotlightTierFromId(addon), spotlightTierFromId(included));
};

const getEffectiveSpotlightFeatureId = (listing: any, planId?: string | null) =>
    spotlightIdFromTier(getEffectiveSpotlightTier(listing, planId));

const hasStandaloneSpotlightAddon = (listing: any, planId?: string | null) => {
    if (!listing) return false;
    if (listing.featureSpotlightStripeSubscriptionId) return true;
    const addon = getSpotlightAddonTierId(listing);
    if (!addon) return false;
    const included = planId ? PLAN_CONFIGS[planId]?.featurePlan : null;
    if (included && addon === included && !listing.featureSpotlightStripeSubscriptionId) {
        return false;
    }
    return Boolean(
        listing.lastFeaturePaymentReceivedAt ||
        listing.featureSpotlightPaidThrough ||
        listing.featureSpotlightSubscriptionItemId,
    );
};

const isSpotlightCancelPending = (listing: any): boolean => {
    if (!listing?.featureSpotlightCancelPending) return false;
    const end =
        toDateValue(listing?.featureSpotlightAccessEnd) ||
        toDateValue(listing?.featureSpotlightPaidThrough);
    if (!end) return true;
    return end.getTime() > Date.now();
};

const mergeSpotlightListingFields = (preferred: any, other: any) => {
    if (!preferred) return other;
    if (!other) return preferred;
    const merged = { ...preferred };
    if (other.featureSpotlightCancelPending) merged.featureSpotlightCancelPending = true;
    const pickLatestDate = (a: any, b: any) => {
        const da = toDateValue(a);
        const db = toDateValue(b);
        if (!da) return b ?? a;
        if (!db) return a;
        return db.getTime() > da.getTime() ? b : a;
    };
    merged.featureSpotlightAccessEnd = pickLatestDate(preferred.featureSpotlightAccessEnd, other.featureSpotlightAccessEnd);
    merged.featureSpotlightPaidThrough = pickLatestDate(preferred.featureSpotlightPaidThrough, other.featureSpotlightPaidThrough);
    if (!merged.featureSpotlightStripeSubscriptionId && other.featureSpotlightStripeSubscriptionId) {
        merged.featureSpotlightStripeSubscriptionId = other.featureSpotlightStripeSubscriptionId;
    }
    if (!merged.featureSpotlightSubscriptionItemId && other.featureSpotlightSubscriptionItemId) {
        merged.featureSpotlightSubscriptionItemId = other.featureSpotlightSubscriptionItemId;
    }
    if (!merged.lastFeaturePaymentReceivedAt && other.lastFeaturePaymentReceivedAt) {
        merged.lastFeaturePaymentReceivedAt = other.lastFeaturePaymentReceivedAt;
    }
    if (!merged.selectedAddon && other.selectedAddon) merged.selectedAddon = other.selectedAddon;
    if (!merged.featuredPlacement && other.featuredPlacement) merged.featuredPlacement = other.featuredPlacement;
    return merged;
};

const getStandaloneSpotlightFeatureId = (listing: any, planId?: string | null): string | null => {
    if (!hasStandaloneSpotlightAddon(listing, planId)) return null;
    return getSpotlightAddonTierId(listing);
};

const getSpotlightAddonTierId = (listing: any): string | null => {
    const raw = String(listing?.selectedAddon || listing?.featuredPlacement || "").trim();
    if (raw === "landing_page" || raw === "home_page" || raw === "both") return raw;
    return null;
};

const getFeatureUpgradeTargets = (
    currentId: string | null | undefined,
    planId?: string | null,
    listing?: any,
): string[] => {
    if (listing && isSpotlightCancelPending(listing)) return [];
    const effectiveTier = Math.max(
        spotlightTierFromId(currentId),
        spotlightTierFromId(planId ? PLAN_CONFIGS[planId]?.featurePlan : null),
    );
    if (effectiveTier >= 3) return [];
    if (isEventOrJobListing(planId, listing)) return [];

    const c = (currentId || "").trim();
    if (c === "landing_page") return ["home_page", "both"];
    if (c === "home_page") return ["both"];
    if (effectiveTier === 1) return ["home_page", "both"];
    if (effectiveTier === 2) return ["both"];
    return [];
};

const getFeaturePurchaseTargets = (planId?: string | null, listing?: any): string[] => {
    if (listing && isSpotlightCancelPending(listing)) return [];
    const effectiveTier = getEffectiveSpotlightTier(listing, planId);
    if (effectiveTier >= 3) return [];
    if (hasStandaloneSpotlightAddon(listing, planId)) return [];

    if (isEventOrJobListing(planId, listing)) return [];

    if (effectiveTier === 0) return ["landing_page", "home_page", "both"];
    return getFeatureUpgradeTargets(getSpotlightAddonTierId(listing), planId, listing);
};

const formatFeatureUpgradeDelta = (fromId: string, toId: string, planId?: string | null): string => {
    const effectiveFromTier = Math.max(
        spotlightTierFromId(fromId),
        spotlightTierFromId(planId ? PLAN_CONFIGS[planId]?.featurePlan : null),
    );
    const effectiveFromId = spotlightIdFromTier(effectiveFromTier) || fromId;
    const from = FEATURE_PRICE_CENTS[effectiveFromId];
    const to = FEATURE_PRICE_CENTS[toId];
    if (from == null || to == null) return "";
    return `+$${((to - from) / 100).toFixed(2)} today`;
};

const COMPANY_PROFILE_MAX_LENGTH = 1000;
const AGENDA_HIGHLIGHTS_MAX = 500;

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
    const stripeStatus = String(plan?.stripeSubscriptionStatus || "").toLowerCase();
    // Test-clock lag: Stripe can still be live while billingPeriodEnd is behind wall clock.
    if (["active", "trialing", "past_due"].includes(stripeStatus) && !plan?.cancelAtPeriodEnd) {
        return true;
    }
    if (["active", "trialing", "past_due"].includes(stripeStatus) && plan?.cancelAtPeriodEnd) {
        const end = getPlanPeriodEndDate(plan);
        // Still within the paid cancel window.
        if (!end || end.getTime() >= Date.now()) return true;
        return false;
    }
    const end = getPlanPeriodEndDate(plan);
    if (end && end.getTime() < Date.now()) return false;
    return true;
};

/** Cancelled or lapsed plans — no edits, upgrades, or new add-ons. */
const isPlanLockedForChanges = (plan: any): boolean => {
    if (!plan) return true;
    if (plan.cancelAtPeriodEnd) return true;
    return !isPlanBillingLive(plan);
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

const formatPlanGroupLabel = (group: string): string => {
    const labels: Record<string, string> = {
        business_offerings: "Business Offerings",
        consulting: "Consulting",
        events: "Events",
        jobs: "Jobs",
    };
    if (labels[group]) return labels[group];
    if (!group) return "";
    return group.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const getListingDisplayName = (listing: any, plan?: any): string => {
    if (!listing) return "";
    const name =
        (listing.eventName || "").trim() ||
        (listing.jobTitle || "").trim() ||
        (listing.businessName || "").trim() ||
        (listing.companyName || "").trim();
    if (name) return name;
    const group = inferListingGroup(listing) || inferPlanGroup(plan);
    return formatPlanGroupLabel(group) || "Listing";
};

const formatPlanTierLabel = (plan: any, planConfig: any): string =>
    planConfig?.label ||
    plan?.planName ||
    (plan?.planId ? plan.planId.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Plan");

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
    const [partnerFeatures, setPartnerFeatures] = useState<any[]>([]);

    // Feature plan modal
    const [showFeatureModal, setShowFeatureModal] = useState(false);
    const [selectedFeaturePlan, setSelectedFeaturePlan] = useState<string>("");
    const [featureProcessing, setFeatureProcessing] = useState(false);

    // Profile form state
    const [profileForm, setProfileForm] = useState<any>({
        firstName: "", lastName: "", email: "", phone: "",
        altName: "", altEmail: "", companyName: "", companyWebsite: "",
        businessPhone: "", linkedin: "", companyProfile: "", businessAddress: "", businessCountry: "",
        billingEmail: "", businessId: "",
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
    const [pendingEventUpgradeDates, setPendingEventUpgradeDates] = useState<{ startDate: string; endDate: string } | null>(null);
    /** Survives async save + re-renders so Stripe checkout always has plan/subscription context. */
    const upgradeCheckoutContextRef = useRef<{
        targetPlanId: string;
        planForCheckout: any;
        eventDates?: { startDate: string; endDate: string } | null;
    } | null>(null);
    const [actionProcessing, setActionProcessing] = useState(false);
    const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
    const [cancelModalError, setCancelModalError] = useState("");
    const profileCompanyProfileTooLong = (profileForm.companyProfile || "").length >= COMPANY_PROFILE_MAX_LENGTH;
    const getStandaloneFeatureRecordForPlan = (plan: any) => {
        if (!plan?.listingId) return null;
        const matches = partnerFeatures.filter((feature) => {
            if (feature.listingId !== plan.listingId) return false;
            if (feature.source === "included_plan") return false;
            if (plan.collectionName && feature.collectionName && feature.collectionName !== plan.collectionName) {
                return false;
            }
            return feature.source === "spotlight_addon" || Boolean(feature.stripeSubscriptionId);
        });
        return matches.find((feature) => feature.source === "spotlight_addon") || matches[0] || null;
    };

    const enrichListingSpotlightFromFeatures = (listing: any, plan: any) => {
        if (!listing || !plan) return listing;
        const featureRecord = getStandaloneFeatureRecordForPlan(plan);
        if (!featureRecord?.cancelPending) return listing;
        return {
            ...listing,
            featureSpotlightCancelPending: true,
            featureSpotlightAccessEnd: featureRecord.accessThrough || listing.featureSpotlightAccessEnd,
            featureSpotlightPaidThrough: listing.featureSpotlightPaidThrough || featureRecord.accessThrough,
        };
    };

    const getLinkedListingForPlan = (plan: any) => {
        const matches = offerings.filter(
            (o) =>
                o.id === plan?.listingId &&
                (!plan?.collectionName || o.__col === plan.collectionName),
        );
        if (matches.length === 0) {
            const fallback = offerings.find((o) => o.id === plan?.listingId);
            return enrichListingSpotlightFromFeatures(fallback, plan);
        }
        const preferred =
            plan?.collectionName !== "businessOfferingsCollection"
                ? matches.find((o) => o.__source === "global") || matches[0]
                : matches.find((o) => o.__source === "partner") || matches[0];
        const merged = matches.reduce((acc, entry) => mergeSpotlightListingFields(acc, entry), preferred);
        return enrichListingSpotlightFromFeatures(merged, plan);
    };

    const isSpotlightCancelPendingForPlan = (plan: any, listing?: any) => {
        const linked = listing ?? getLinkedListingForPlan(plan);
        return isSpotlightCancelPending(linked);
    };
    const arePlanActionsLocked = (plan: any, linkedListing?: any) => {
        if (isPlanLockedForChanges(plan)) return true;
        return isSpotlightCancelPendingForPlan(plan, linkedListing);
    };
    const hasStandaloneFeatureForPlan = (plan: any) => {
        const linkedListing = getLinkedListingForPlan(plan);
        return (
            hasStandaloneSpotlightAddon(linkedListing, plan?.planId) &&
            !isSpotlightCancelPendingForPlan(plan, linkedListing)
        );
    };
    const isFeatureEligiblePlan = (plan: any) => {
        if (isPlanLockedForChanges(plan) || !plan.listingId || !plan.collectionName) return false;
        if (isSpotlightCancelPendingForPlan(plan)) return false;
        const linkedListing = getLinkedListingForPlan(plan);
        if (!linkedListing) return false;
        return linkedListing.status !== "pending_payment" && linkedListing.active !== false;
    };

    const assertPlanUnlockedForChanges = (plan: any) => {
        if (isPlanLockedForChanges(plan)) {
            throw new Error(
                plan?.cancelAtPeriodEnd
                    ? "This plan is scheduled to end. Editing and upgrades are not available until you repurchase."
                    : "This plan is no longer active. Editing and upgrades are not available until you repurchase.",
            );
        }
        const linkedListing = getLinkedListingForPlan(plan);
        if (isSpotlightCancelPendingForPlan(plan, linkedListing)) {
            throw new Error(
                "This spotlight add-on is scheduled to end. Editing and plan changes are not available until that date passes.",
            );
        }
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

                    // Refresh renewal dates from Stripe so auto-renewed subs stay active in the dashboard.
                    fetch(`${API_BASE_URL}/api/sync-partner-billing`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ partnerId: user.uid }),
                    }).catch((err) => console.warn("Partner billing sync:", err?.message || err));

                    const [fName, ...lNames] = (data.primaryName || "").split(" ");
                    setProfileForm({
                        firstName: fName || "", lastName: lNames.join(" ") || "",
                        email: data.primaryEmail || "", phone: data.phoneNumber || "",
                        altName: data.secondaryName || "", altEmail: data.secondaryEmail || "",
                        companyName: data.businessName || "", companyWebsite: data.companyWebsite || "",
                        businessPhone: data.businessPhoneNumber || "", linkedin: data.linkedInProfileLink || "",
                        companyProfile: data.companyProfileText || "", businessAddress: data.businessAddress || "",
                        businessCountry: data.businessCountry || "",
                        billingEmail: data.billingEmailAddress || "",
                        businessId: data.VAT_ABN_EIN_businessId || "",
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
                            const preferGlobal = entry.__col !== "businessOfferingsCollection";
                            if (preferGlobal) {
                                if (existing.__source !== "global" && entry.__source === "global") {
                                    mergedByListing.set(key, entry);
                                }
                            } else if (existing.__source !== "partner" && entry.__source === "partner") {
                                mergedByListing.set(key, entry);
                            }
                        }
                        return Array.from(mergedByListing.values()).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    };

                    const attachSnapshot = (col: string, source: "partner" | "global", refQuery: any) => {
                        const sourceKey = `${source}:${col}`;
                        return onSnapshot(
                            refQuery,
                            (snap: any) => {
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
                            },
                            (err) => {
                                console.warn(`Dashboard listings snapshot (${sourceKey}):`, err?.message || err);
                            },
                        );
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
                    onSnapshot(
                        transQ,
                        (snap) => {
                            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
                        },
                        (err) => console.warn("Dashboard transactions snapshot:", err?.message || err),
                    );

                    // Fetch active plans from planCollection
                    const plansQ = query(collection(docRef, "planCollection"));
                    onSnapshot(
                        plansQ,
                        (snap) => {
                            const now = Date.now();
                            const loadedPlans = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                            loadedPlans.forEach(async (plan: any) => {
                                if (plan.isTrial && plan.active !== false && plan.billingPeriodEnd) {
                                    const endMs = typeof plan.billingPeriodEnd.toMillis === 'function'
                                        ? plan.billingPeriodEnd.toMillis()
                                        : (plan.billingPeriodEnd.seconds ? plan.billingPeriodEnd.seconds * 1000 : new Date(plan.billingPeriodEnd).getTime());
                                    
                                    if (endMs < now) {
                                        try {
                                            const planRef = doc(db, "partnersCollection", user.uid, "planCollection", plan.id);
                                            await updateDoc(planRef, { active: false });
                                            console.log(`Auto-cancelled expired trial plan ${plan.id}`);
                                        } catch (e) {
                                            console.error("Error auto-cancelling expired trial plan:", e);
                                        }
                                    }
                                }
                            });

                            setActivePlans(loadedPlans.sort((a: any, b: any) => (b.startDate?.seconds || 0) - (a.startDate?.seconds || 0)));
                        },
                        (err) => console.warn("Dashboard plans snapshot:", err?.message || err),
                    );

                    const featuresQ = query(collection(docRef, "featuresCollection"), where("active", "==", true));
                    onSnapshot(
                        featuresQ,
                        (snap) => {
                            setPartnerFeatures(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                        },
                        (err) => console.warn("Dashboard features snapshot:", err?.message || err),
                    );
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
                        if (emailError?.code === "auth/invalid-email") {
                            setProfileMsg("Enter a valid email address.");
                            setProfileSaving(false);
                            return;
                        }
                        if (emailError?.code === "auth/operation-not-allowed") {
                            setProfileMsg("Email changes are not available for this account. Contact support if you need to update your sign-in email.");
                            setProfileSaving(false);
                            return;
                        }
                        if (emailError?.code === "auth/email-change-needs-verification") {
                            setProfileMsg("Check your inbox to verify the new email address, then sign in again with that email.");
                            setProfileSaving(false);
                            return;
                        }
                        setProfileMsg(emailError?.message || "Could not update your sign-in email. Check your password and try again.");
                        setProfileSaving(false);
                        return;
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
                    billingEmailAddress: profileForm.billingEmail || "",
                    VAT_ABN_EIN_businessId: profileForm.businessId || "",
                });

                const newBusinessName = (profileForm.companyName || "").trim();
                const prevBusinessName = (partnerData?.businessName || "").trim();
                const profileListingPatch = {
                    companyProfileText: (profileForm.companyProfile || "").slice(0, COMPANY_PROFILE_MAX_LENGTH),
                    businessAddress: profileForm.businessAddress,
                    businessCountry: profileForm.businessCountry || "",
                    updatedAt: new Date(),
                };
                if (auth.currentUser) {
                    const uid = auth.currentUser.uid;
                    const batch = writeBatch(db);
                    const partnerRefPath = doc(db, "partnersCollection", uid);
                    const embeddedSnap = await getDocs(collection(partnerRefPath, "businessOfferingsCollection"));
                    embeddedSnap.docs.forEach((d) => {
                        batch.update(d.ref, {
                            ...(newBusinessName && newBusinessName !== prevBusinessName ? { businessName: newBusinessName } : {}),
                            ...profileListingPatch,
                        });
                    });
                    const topCols = ["consultingServicesCollection", "consultingCollection", "eventsCollection", "jobsCollection"] as const;
                    for (const col of topCols) {
                        const qSnap = await getDocs(query(collection(db, col), where("partnerId", "==", uid)));
                        qSnap.docs.forEach((d) => {
                            batch.update(d.ref, {
                                ...(newBusinessName && newBusinessName !== prevBusinessName ? { businessName: newBusinessName } : {}),
                                ...profileListingPatch,
                            });
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
                        billingEmailAddress: profileForm.billingEmail || "",
                        VAT_ABN_EIN_businessId: profileForm.businessId || "",
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
        } catch (err: any) {
            console.error("Failed to update profile", err);
            const code = err?.code || "";
            if (code === "auth/email-already-in-use") {
                setProfileMsg("This email is already in use by another account.");
            } else if (code === "auth/invalid-email") {
                setProfileMsg("Enter a valid email address.");
            } else if (code === "auth/requires-recent-login") {
                setProfileMsg("For security, sign out and sign back in before changing your email.");
            } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                setProfileMsg("Current password is incorrect. Your profile was not saved.");
            } else {
                setProfileMsg(err?.message || "Failed to update profile. Please try again.");
            }
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
                    action: "PASSWORD_UPDATED",
                    details: `Partner password changed.`,
                    category: "account"
                });

                setPasswordMsg({ type: "success", text: "Password changed successfully!" });
                alert("Password changed successfully!");
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
                const linkedListing = getLinkedListingForPlan(activeListingPlan);
                if (isSpotlightCancelPendingForPlan(activeListingPlan, linkedListing)) {
                    throw new Error(
                        "This spotlight add-on is already scheduled to end. You can purchase again after the current paid period ends.",
                    );
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
                if (data.upgraded && !data.noCheckoutRequired) {
                    throw new Error(data.message || "Unexpected upgrade response. Please refresh and try again.");
                }
                if (data.success && data.noCheckoutRequired) {
                    setActionMessage({
                        type: "success",
                        text: data.message || "Spotlight tier updated on your subscription.",
                    });
                    setFeatureProcessing(false);
                    window.location.reload();
                    return;
                }
                if (!data.url) {
                    throw new Error(data.error || "No checkout URL returned from server.");
                }
                window.location.href = data.url;
                return;
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

    const startUpgradeCheckout = async (
        newPlanId: string,
        eventDates?: { startDate: string; endDate: string } | null,
        planOverride?: any
    ) => {
        const planForCheckout = planOverride || selectedPlanForAction || upgradeCheckoutContextRef.current?.planForCheckout;
        if (!auth.currentUser || !planForCheckout) {
            throw new Error("Upgrade session expired. Please select upgrade again.");
        }
        assertPlanUnlockedForChanges(planForCheckout);
        const datesForCheckout =
            eventDates ??
            pendingEventUpgradeDates ??
            upgradeCheckoutContextRef.current?.eventDates ??
            null;
        const origin = window.location.origin;
        const resp = await fetch(`${API_BASE_URL}/api/upgrade-subscription`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subscriptionId: planForCheckout.stripeSubscriptionId || null,
                newPlanId,
                currentPlanId: planForCheckout.planId || null,
                partnerId: auth.currentUser.uid,
                partnerEmail: auth.currentUser.email,
                listingId: planForCheckout.listingId,
                collectionName: planForCheckout.collectionName,
                group: planForCheckout.group || "",
                successUrl: `${origin}/partner/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}&upgrade=true`,
                cancelUrl: `${origin}/partner/dashboard?upgrade=cancelled`,
                ...(datesForCheckout
                    ? {
                        pendingEventStartDate: datesForCheckout.startDate,
                        pendingEventEndDate: datesForCheckout.endDate,
                    }
                    : {}),
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
        if (data.alreadyOnPlan) {
            throw new Error(data.message || "This listing is already on the selected plan. Refresh the dashboard and try again.");
        }
        if (data.url) {
            window.location.href = data.url;
            return { redirecting: true as const };
        }
        if (data.success && data.noCheckoutRequired) {
            setActionMessage({
                type: "success",
                text: data.message || "Upgrade completed successfully. Your next renewal uses the new plan price.",
            });
            upgradeCheckoutContextRef.current = null;
            setPendingUpgradePlanId(null);
            setPendingEventUpgradeDates(null);
            setTimeout(() => {
                setShowUpgradeModal(false);
                setShowEditListingModal(false);
                setSelectedPlanForAction(null);
                setSelectedListingForEdit(null);
                setActionMessage({ type: "", text: "" });
                window.location.reload();
            }, 1800);
            return { redirecting: false as const };
        }
        throw new Error(data.error || "Stripe did not return a payment page. Please try the upgrade again.");
    };

    // Handle saving listing edits (all editable fields)
    const handleSaveListingEdit = async (updatedData: any) => {
        setActionProcessing(true);
        let redirectingToStripe = false;
        const upgradePlanId =
            pendingUpgradePlanId ?? upgradeCheckoutContextRef.current?.targetPlanId ?? null;
        const planForUpgrade =
            selectedPlanForAction ?? upgradeCheckoutContextRef.current?.planForCheckout ?? null;
        try {
            if (auth.currentUser && selectedListingForEdit) {
                const planForEdit =
                    selectedPlanForAction ||
                    activePlans.find(
                        (p) =>
                            p.listingId === selectedListingForEdit.id &&
                            (!p.collectionName || p.collectionName === selectedListingForEdit.__col),
                    );
                if (planForEdit) {
                    assertPlanUnlockedForChanges(planForEdit);
                }

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
                }

                const deferEventDatesForUpgrade =
                    listingGroup === "events" &&
                    Boolean(upgradePlanId) &&
                    upgradePlanId !== "basic_event" &&
                    Boolean(updatedData.startDate) &&
                    Boolean(updatedData.endDate) &&
                    updatedData.endDate !== updatedData.startDate;

                const deferredEventDates = deferEventDatesForUpgrade
                    ? { startDate: updatedData.startDate, endDate: updatedData.endDate }
                    : null;

                setPendingEventUpgradeDates(deferredEventDates);
                if (upgradeCheckoutContextRef.current) {
                    upgradeCheckoutContextRef.current = {
                        ...upgradeCheckoutContextRef.current,
                        eventDates: deferredEventDates,
                    };
                }
                if (deferEventDatesForUpgrade && deferredEventDates && upgradePlanId) {
                    updateObj.pendingUpgradeEventDates = {
                        startDate: deferredEventDates.startDate,
                        endDate: deferredEventDates.endDate,
                        targetPlanId: upgradePlanId,
                    };
                }

                if (listingGroup === "events") {
                    if (updatedData.eventName !== undefined) updateObj.eventName = updatedData.eventName;
                    if (updatedData.eventLink !== undefined) updateObj.eventLink = updatedData.eventLink;
                    if (updatedData.startDate !== undefined && !deferEventDatesForUpgrade) {
                        updateObj.startDate = updatedData.startDate;
                    }
                    if (updatedData.endDate !== undefined && !deferEventDatesForUpgrade) {
                        updateObj.endDate = updatedData.endDate;
                    }
                    if (updatedData.eventCountry !== undefined) updateObj.eventCountry = updatedData.eventCountry;
                    if (updatedData.location !== undefined) updateObj.location = updatedData.location;
                    if (updatedData.eventProfile !== undefined) updateObj.eventProfile = updatedData.eventProfile;
                    if (updatedData.agendaHighlights !== undefined) {
                        updateObj.agendaHighlights = updatedData.agendaHighlights;
                        updateObj.agenda = updatedData.agendaHighlights;
                    }
                    if (updatedData.agendaPdfUrl !== undefined) updateObj.agendaPdfUrl = updatedData.agendaPdfUrl;
                    if (updatedData.agenda !== undefined && updatedData.agendaHighlights === undefined) {
                        updateObj.agenda = updatedData.agenda;
                    }
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

                if (upgradePlanId) {
                    setActionMessage({ type: "success", text: "Details saved. Redirecting to Stripe for upgrade payment..." });
                    const checkoutResult = await startUpgradeCheckout(
                        upgradePlanId,
                        deferredEventDates,
                        planForUpgrade
                    );
                    if (checkoutResult?.redirecting) {
                        redirectingToStripe = true;
                    }
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
            if (!redirectingToStripe) {
                setActionProcessing(false);
            }
        }
    };

    // Handle plan upgrade - edit details first, then Stripe upgrade flow
    const handleUpgradePlan = async (newPlanId: string) => {
        if (!selectedPlanForAction) return;
        try {
            assertPlanUnlockedForChanges(selectedPlanForAction);
        } catch (err: any) {
            setActionMessage({ type: "error", text: err.message || "This plan cannot be upgraded." });
            return;
        }
        const linkedListing = getLinkedListingForPlan(selectedPlanForAction);

        upgradeCheckoutContextRef.current = {
            targetPlanId: newPlanId,
            planForCheckout: selectedPlanForAction,
            eventDates: null,
        };

        if (linkedListing) {
            setPendingUpgradePlanId(newPlanId);
            setSelectedListingForEdit(linkedListing);
            setShowUpgradeModal(false);
            setShowEditListingModal(true);
            setActionMessage({ type: "success", text: "Update your listing details before continuing to Stripe." });
            return;
        }

        setActionProcessing(true);
        let redirectingToStripe = false;
        try {
            const checkoutResult = await startUpgradeCheckout(newPlanId, null, selectedPlanForAction);
            if (checkoutResult?.redirecting) {
                redirectingToStripe = true;
            }
        } catch (err: any) {
            console.error("Failed to upgrade plan:", err);
            setActionMessage({ type: "error", text: err.message || "Failed to upgrade plan." });
        } finally {
            if (!redirectingToStripe) {
                setActionProcessing(false);
            }
        }
    };

    const handleCancelPlan = async (cancelScope: CancelScope) => {
        setActionProcessing(true);
        setCancelModalError("");
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
                    const apiError = payload?.error;
                    if (
                        cancelScope === "feature" &&
                        response.status === 409 &&
                        typeof apiError === "string" &&
                        apiError.toLowerCase().includes("already scheduled")
                    ) {
                        setActionMessage({
                            type: "success",
                            text: "Spotlight add-on is already scheduled to end at the close of your paid period.",
                        });
                        setShowCancelModal(false);
                        setSelectedPlanForAction(null);
                        setPendingUpgradePlanId(null);
                        window.setTimeout(() => {
                            setActionMessage({ type: "", text: "" });
                            window.location.reload();
                        }, 1200);
                        return;
                    }
                    if (!apiError && !response.ok) {
                        throw new Error(
                            response.status === 502
                                ? "Billing service error. Ensure the API server is running and Stripe is configured."
                                : `Cancellation failed (${response.status}). Check that the API server is reachable.`,
                        );
                    }
                    throw new Error(apiError || "Cancellation request failed.");
                }

                if (cancelScope === "feature" && payload?.cancelledFeature === false) {
                    console.warn("Feature cancellation succeeded without cancelledFeature flag.");
                }

                const successText =
                    cancelScope === "feature"
                        ? "Spotlight add-on scheduled to end at the close of your paid period. It will not renew."
                        : "Subscription will end after the current billing period. Any separate spotlight add-on for this listing has been removed.";
                setActionMessage({ type: "success", text: successText });
                setPendingUpgradePlanId(null);
                setShowCancelModal(false);
                setSelectedPlanForAction(null);
                window.setTimeout(() => {
                    setActionMessage({ type: "", text: "" });
                    window.location.reload();
                }, 1200);
            }
        } catch (err: any) {
            console.error("Failed to cancel plan:", err);
            const message = err?.message || "Failed to cancel subscription. Please try again.";
            setCancelModalError(message);
            setActionMessage({ type: "error", text: message });
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
                const linkedListing = getLinkedListingForPlan(selectedPlanForAction);
                if (linkedListing && isSpotlightCancelPendingForPlan(selectedPlanForAction, linkedListing)) {
                    throw new Error(
                        "This spotlight add-on is already scheduled to end. You can purchase again after the current paid period ends.",
                    );
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
                if (data.upgraded && !data.noCheckoutRequired) {
                    throw new Error(data.message || "Unexpected upgrade response. Please refresh and try again.");
                }
                if (data.success && data.noCheckoutRequired) {
                    setActionMessage({
                        type: "success",
                        text: data.message || "Spotlight tier updated on your subscription.",
                    });
                    setActionProcessing(false);
                    window.location.reload();
                    return;
                }
                if (!data.url) {
                    throw new Error(data.error || "No checkout URL returned from server.");
                }
                window.location.href = data.url;
                return;
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
    const livePlansSorted = [...livePlans].sort((a, b) => {
        if (Boolean(a.cancelAtPeriodEnd) === Boolean(b.cancelAtPeriodEnd)) return 0;
        return a.cancelAtPeriodEnd ? 1 : -1;
    });
    const expiredPlans = activePlans.filter((p) => !isPlanBillingLive(p) && (p.planId || p.planName));

    const isApproved = partnerData.partnerStatus !== "Disabled";
    const displayName = partnerData.primaryName || "Partner";
    const currentPlan = PLAN_CONFIGS[partnerData.selectedPlan] || null;
    const currentGroup = partnerData.selectedGroup || "";
    const businessOfferingLock = getGroupPlanLock(activePlans, "business_offerings");
    const consultingLock = getGroupPlanLock(activePlans, "consulting");

    const liveListingPlanForFeatures = livePlans.find(isFeatureEligiblePlan);
    const listingForGlobalFeatureModal = liveListingPlanForFeatures
        ? getLinkedListingForPlan(liveListingPlanForFeatures)
        : null;
    const globalModalAddonTier = getEffectiveSpotlightFeatureId(
        listingForGlobalFeatureModal,
        liveListingPlanForFeatures?.planId,
    );
    const globalModalUpgradeTargets = getFeatureUpgradeTargets(
        globalModalAddonTier,
        liveListingPlanForFeatures?.planId,
        listingForGlobalFeatureModal,
    );
    const globalModalPurchaseTargets = getFeaturePurchaseTargets(
        liveListingPlanForFeatures?.planId,
        listingForGlobalFeatureModal,
    );

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
                                        {FEATURE_PLANS.filter((fp) =>
                                            globalModalUpgradeTargets.length > 0
                                                ? globalModalUpgradeTargets.includes(fp.id)
                                                : globalModalPurchaseTargets.includes(fp.id),
                                        ).map(fp => {
                                            const Ic = fp.icon;
                                            const isSelected = selectedFeaturePlan === fp.id;
                                            const alreadyHasExact =
                                                getEffectiveSpotlightTier(listingForGlobalFeatureModal, liveListingPlanForFeatures?.planId) >=
                                                (FEATURE_SPOTLIGHT_TIER[fp.id] || 0) &&
                                                getEffectiveSpotlightTier(listingForGlobalFeatureModal, liveListingPlanForFeatures?.planId) > 0;
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
                                                                {alreadyHasExact && <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 text-[10px]">Active</Badge>}
                                                                {isValidUpgradeChoice && globalModalAddonTier && (
                                                                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Upgrade</Badge>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{fp.description}</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            {inUpgradeMode && isValidUpgradeChoice && globalModalAddonTier ? (
                                                                <p className="text-lg font-bold text-primary">
                                                                    {formatFeatureUpgradeDelta(
                                                                        globalModalAddonTier,
                                                                        fp.id,
                                                                        liveListingPlanForFeatures?.planId,
                                                                    )}
                                                                </p>
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
                        targetEventPlanId={pendingUpgradePlanId || undefined}
                        representativeOptions={representativeOptions}
                        onClose={() => {
                            setShowEditListingModal(false);
                            setSelectedListingForEdit(null);
                            setSelectedPlanForAction(null);
                            setPendingUpgradePlanId(null);
                            setPendingEventUpgradeDates(null);
                            upgradeCheckoutContextRef.current = null;
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
                            setPendingEventUpgradeDates(null);
                            upgradeCheckoutContextRef.current = null;
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
                        linkedListing={getLinkedListingForPlan(selectedPlanForAction)}
                        hasFeature={hasStandaloneFeatureForPlan(selectedPlanForAction)}
                        spotlightCancelPending={isSpotlightCancelPendingForPlan(
                            selectedPlanForAction,
                            getLinkedListingForPlan(selectedPlanForAction),
                        )}
                        cancelError={cancelModalError}
                        onClose={() => {
                            setShowCancelModal(false);
                            setSelectedPlanForAction(null);
                            setPendingUpgradePlanId(null);
                            setCancelModalError("");
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
                        featurePlans={FEATURE_PLANS.filter((fp) =>
                            getFeaturePurchaseTargets(selectedPlanForAction.planId, selectedListingForEdit).includes(fp.id),
                        )}
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

                {showUpgradeFeatureModal && selectedPlanForAction && selectedListingForEdit && (
                    <UpgradeFeaturePlanModal
                        currentAddonId={
                            getEffectiveSpotlightFeatureId(selectedListingForEdit, selectedPlanForAction.planId) || ""
                        }
                        planId={selectedPlanForAction.planId}
                        listing={selectedListingForEdit}
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
        const renderPlanSubscriptionCard = (plan: any, mode: "active" | "past" = "active") => {
            const isPast = mode === "past";
            const planConfig = PLAN_CONFIGS[plan.planId];
            // Current billing period start (updates on renewals); fall back to original purchase startDate.
            const startDate =
                toDateValue(plan.billingPeriodStart) ||
                toDateValue(plan.lastPaymentReceivedAt) ||
                toDateValue(plan.startDate);
            const billingEnd = toDateValue(plan.billingPeriodEnd) || toDateValue(plan.cancelAt);
            const cancelledAt = toDateValue(plan.cancelledAt);
            const isYearly = plan.billingInterval === "year" || plan.planId?.includes("_yr");
            const billingCycleLabel = isYearly ? "Annual" : "Monthly";
            const linkedListing = getLinkedListingForPlan(plan);
            const planRepresentatives = linkedListing?.companyRepresentatives || plan.companyRepresentatives || [];
            const hasFeature = linkedListing?.selectedAddon && linkedListing?.selectedAddon !== "" && linkedListing?.selectedAddon !== "none";
            const includedPlanFeature = planConfig?.featurePlan;
            const effectiveSpotlightId = getEffectiveSpotlightFeatureId(linkedListing, plan.planId);
            const effectiveSpotlightTier = getEffectiveSpotlightTier(linkedListing, plan.planId);
            const spotlightCancelPending = isSpotlightCancelPendingForPlan(plan, linkedListing);
            const hasStandaloneAddon = hasStandaloneSpotlightAddon(linkedListing, plan.planId);
            const standaloneSpotlightId = getStandaloneSpotlightFeatureId(linkedListing, plan.planId);
            const standaloneSpotlightPlan = FEATURE_PLANS.find((f) => f.id === standaloneSpotlightId);
            const standaloneSpotlightStart = toDateValue(linkedListing?.lastFeaturePaymentReceivedAt);
            const standaloneSpotlightRenewal =
                toDateValue(linkedListing?.featureSpotlightPaidThrough) ||
                toDateValue(linkedListing?.featureSpotlightAccessEnd);
            const purchaseTargets = getFeaturePurchaseTargets(plan.planId, linkedListing);
            const upgradeTargets = getFeatureUpgradeTargets(effectiveSpotlightId, plan.planId, linkedListing);
            const canAddFeature =
                purchaseTargets.length > 0 &&
                isFeatureEligiblePlan(plan) &&
                effectiveSpotlightTier === 0 &&
                !spotlightCancelPending;
            const canUpgradeFeature =
                upgradeTargets.length > 0 &&
                isFeatureEligiblePlan(plan) &&
                effectiveSpotlightTier > 0 &&
                !spotlightCancelPending;
            const isEnding = Boolean(plan.cancelAtPeriodEnd) && !isPast;
            const actionsLocked = isPast || arePlanActionsLocked(plan, linkedListing);
            const canListingPlanUpgradeAction =
                !isPast && getAvailablePlanUpgradeIds(plan.planId).length > 0 && !actionsLocked;
            const pastStatusLabel = plan.cancelAtPeriodEnd ? "Cancelled" : plan.active === false ? "Expired" : "Ended";
            const cardShell = isPast
                ? "rounded-xl border border-foreground/15 bg-muted/25 p-5 opacity-95"
                : isEnding
                ? "rounded-xl border border-amber-500/35 bg-amber-500/[0.07] p-5"
                : "rounded-xl border border-foreground/10 bg-muted/40 p-5";
            const planGroupLabel = formatPlanGroupLabel(inferPlanGroup(plan));
            const listingName = getListingDisplayName(linkedListing, plan);
            const planTierLabel = formatPlanTierLabel(plan, planConfig);
            const planSummaryParts = [planGroupLabel, planTierLabel].filter(Boolean);

            return (
                <div key={plan.id} className={cardShell}>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1 flex-wrap">
                                    <h4 className="text-lg font-bold text-foreground">
                                        {listingName || planSummaryParts.join(" · ") || planTierLabel}
                                    </h4>
                                    {isPast ? (
                                        <>
                                            <Badge variant="outline" className="bg-foreground/10 text-muted-foreground border-foreground/20">{pastStatusLabel}</Badge>
                                            <Badge variant="outline" className="border-foreground/20">{billingCycleLabel}</Badge>
                                            {cancelledAt && (
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    Cancelled on {cancelledAt.toLocaleDateString()}
                                                </span>
                                            )}
                                            {billingEnd && (
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    Access ended {billingEnd.toLocaleDateString()}
                                                </span>
                                            )}
                                        </>
                                    ) : isEnding ? (
                                        <>
                                            <Badge variant="outline" style={{ backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#d97706' }}>Scheduled to end</Badge>
                                            <Badge variant="outline" className="border-foreground/20">{billingCycleLabel}</Badge>
                                            {billingEnd && (
                                                <span className="text-xs font-medium" style={{ color: '#78350f' }}>
                                                    Access through {billingEnd.toLocaleDateString()}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Badge variant="outline" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#10b981' }}>Active</Badge>
                                            <Badge variant="outline" className="border-foreground/20">{billingCycleLabel}</Badge>
                                        </>
                                    )}
                                </div>
                                {listingName && planSummaryParts.length > 0 && (
                                    <p className="text-sm text-muted-foreground mb-2">{planSummaryParts.join(" · ")}</p>
                                )}
                                {isPast && (
                                    <p className="text-sm text-muted-foreground mb-2 max-w-2xl">
                                        This plan is no longer active. To subscribe again, use Add Listing on the dashboard when your account is eligible.
                                    </p>
                                )}
                                {isEnding && (
                                    <p className="text-sm text-muted-foreground mb-2 max-w-2xl">
                                        This plan is still active and accessible until the end date below. It is scheduled not to renew after that date.
                                        Editing, plan upgrades, and spotlight changes are disabled while cancellation is scheduled.
                                    </p>
                                )}
                                {spotlightCancelPending && !isEnding && (
                                    <p className="text-sm text-muted-foreground mb-2 max-w-2xl">
                                        Your spotlight add-on is scheduled to end on{" "}
                                        {standaloneSpotlightRenewal?.toLocaleDateString() || "the end of your paid period"}.
                                        Add-ons and upgrades are disabled until that date passes; you can purchase again afterward.
                                    </p>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground tracking-wider font-bold mb-1">
                                            {isPast ? "Last Period Start" : "Current Period Start"}
                                        </p>
                                        <p className="text-sm text-foreground font-medium">{startDate ? startDate.toLocaleDateString() : "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground tracking-wider font-bold mb-1">{isPast ? "Ended On" : isEnding ? "Ends On" : "Renewal Date"}</p>
                                        <p className="text-sm text-foreground font-medium">{billingEnd ? billingEnd.toLocaleDateString() : "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground tracking-wider font-bold mb-1">Billing Cycle</p>
                                        <p className="text-sm text-foreground font-medium capitalize">{billingCycleLabel}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground tracking-wider font-bold mb-1">Price</p>
                                        <p className="text-sm text-foreground font-medium">{planConfig?.price || "N/A"}{planConfig?.period}</p>
                                    </div>
                                </div>
                                {hasStandaloneAddon && (
                                    <div className="mt-4 pt-4 border-t border-foreground/10">
                                        <p className="text-xs text-muted-foreground tracking-wider font-bold mb-3">
                                            Spotlight Add-on Subscription
                                        </p>
                                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                                            <h5 className="text-sm font-semibold text-foreground">
                                                {standaloneSpotlightPlan?.label || "Spotlight add-on"}
                                            </h5>
                                            {spotlightCancelPending ? (
                                                <Badge variant="outline" style={{ backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#d97706' }}>
                                                    Scheduled to end
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#10b981' }}>Active</Badge>
                                            )}
                                            <Badge variant="outline" className="border-foreground/20">Monthly</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground tracking-wider font-bold mb-1">Start Date</p>
                                                <p className="text-sm text-foreground font-medium">
                                                    {standaloneSpotlightStart ? standaloneSpotlightStart.toLocaleDateString() : "N/A"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground tracking-wider font-bold mb-1">
                                                    {spotlightCancelPending ? "Ends On" : "Renewal Date"}
                                                </p>
                                                <p className="text-sm text-foreground font-medium">
                                                    {standaloneSpotlightRenewal ? standaloneSpotlightRenewal.toLocaleDateString() : "N/A"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground tracking-wider font-bold mb-1">Billing Cycle</p>
                                                <p className="text-sm text-foreground font-medium">Monthly</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground tracking-wider font-bold mb-1">Price</p>
                                                <p className="text-sm text-foreground font-medium">
                                                    {standaloneSpotlightPlan?.price || "N/A"}/month
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {!isPast && (
                            <div className="flex flex-wrap gap-2 shrink-0">
                                {linkedListing && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-foreground/20 text-foreground/80 hover:bg-foreground/5"
                                        disabled={actionsLocked}
                                        title={
                                            actionsLocked
                                                ? plan.cancelAtPeriodEnd
                                                    ? "Editing is unavailable while this plan is scheduled to end."
                                                    : spotlightCancelPending
                                                        ? "Editing is unavailable while spotlight cancellation is scheduled."
                                                        : "Editing is unavailable while this plan is cancelled or ended."
                                                : undefined
                                        }
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
                                    className={`border-primary/40 ${canListingPlanUpgradeAction ? "text-primary hover:bg-primary/10" : "text-muted-foreground border-foreground/15 opacity-60 cursor-not-allowed"}`}
                                    disabled={actionsLocked || !canListingPlanUpgradeAction}
                                    title={
                                        actionsLocked
                                            ? "Upgrades are unavailable while this plan or spotlight add-on is scheduled to end."
                                            : !canListingPlanUpgradeAction
                                                ? "No higher plan available."
                                                : undefined
                                    }
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
                                {canUpgradeFeature && linkedListing && (
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
                            )}
                        </div>
                        {(includedPlanFeature || hasFeature) && (
                            <div className="pt-3 border-t border-foreground/10">
                                <p className="text-sm text-foreground flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    {includedPlanFeature && !hasStandaloneAddon
                                        ? `Included: ${includedPlanFeature === "home_page" ? "Home page" : "Landing page"} spotlight`
                                        : `Active spotlight: ${FEATURE_PLANS.find((f) => f.id === (effectiveSpotlightId || linkedListing?.selectedAddon))?.label}`}
                                </p>
                                {spotlightCancelPending && standaloneSpotlightRenewal && (
                                    <p className="text-xs mt-1" style={{ color: '#78350f' }}>
                                        Spotlight add-on scheduled to end on {standaloneSpotlightRenewal.toLocaleDateString()}.
                                        It will not renew; you can purchase again after that date.
                                    </p>
                                )}
                            </div>
                        )}
                        {planRepresentatives?.length > 0 && (
                            <div className="pt-3 border-t border-foreground/10">
                                <p className="text-xs text-muted-foreground tracking-wider font-bold mb-1.5">Company Representatives</p>
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

        const pendingPaymentListings = offerings.filter((o) => o.status === "pending_payment");
        const pendingPaymentDisplayLimit = 2;
        const visiblePendingPaymentListings = pendingPaymentListings.slice(0, pendingPaymentDisplayLimit);
        const hiddenPendingPaymentCount = pendingPaymentListings.length - visiblePendingPaymentListings.length;
        const renderAddListingDropdown = (buttonClassName?: string) => (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className={buttonClassName || "bg-white text-black hover:bg-white/90"}>
                        <PlusCircle className="w-4 h-4 mr-2" /> Add Listing
                    </Button>
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
        );

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
                                <p className="text-sm font-medium text-muted-foreground tracking-wider mb-1">Company Name</p>
                                <p className="text-2xl text-foreground font-bold">{partnerData.businessName}</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4 bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                {livePlansSorted.length > 0 ? (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-2">Active Plans</p>
                                        <ul className="space-y-2">
                                            {livePlansSorted.map((plan) => {
                                                const linked = getLinkedListingForPlan(plan);
                                                const planConfig = PLAN_CONFIGS[plan.planId];
                                                const groupLabel = formatPlanGroupLabel(inferPlanGroup(plan));
                                                const tierLabel = formatPlanTierLabel(plan, planConfig);
                                                const name = getListingDisplayName(linked, plan);
                                                return (
                                                    <li key={plan.id} className="text-sm text-foreground">
                                                        <span className="font-medium">{name || `${groupLabel} · ${tierLabel}`}</span>
                                                        {name && (
                                                            <span className="text-muted-foreground"> — {groupLabel} · {tierLabel}</span>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-1">Group</p>
                                            <p className="text-foreground font-medium capitalize">{currentGroup.replace(/_/g, " ") || "N/A"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-1">Plan</p>
                                            <p className="text-foreground font-medium">{currentPlan?.label || "N/A"}</p>
                                        </div>
                                    </div>
                                )}
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
                                <p className="text-sm font-medium text-muted-foreground tracking-wider mb-1">Primary Rep</p>
                                <p className="text-xl text-foreground font-bold">{partnerData.primaryName}</p>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted/40 border border-foreground/10 flex items-center justify-center"><Mail className="w-4 h-4 text-foreground" /></div>
                                    <div><p className="text-xs font-medium text-muted-foreground tracking-wider">Email</p><p className="text-foreground font-medium">{partnerData.primaryEmail}</p></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted/40 border border-foreground/10 flex items-center justify-center"><Phone className="w-4 h-4 text-foreground" /></div>
                                    <div><p className="text-xs font-medium text-muted-foreground tracking-wider">Phone</p><p className="text-foreground font-medium">{partnerData.phoneNumber || partnerData.businessPhoneNumber || "N/A"}</p></div>
                                </div>
                            </div>
                            {(partnerData.secondaryName || partnerData.secondaryEmail) && (
                                <div className="pt-5 border-t border-foreground/10 mt-5">
                                    <p className="text-sm font-bold text-primary mb-3 tracking-wider">Alternate Contact</p>
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
                {(livePlans.length > 0 || expiredPlans.length > 0 || pendingPaymentListings.length > 0 || isApproved) && (
                    <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md shadow-xl">
                        <CardHeader className="pb-4 border-b border-foreground/10">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <CreditCard className="w-5 h-5 text-primary" /> Plans &amp; billing
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Active subscriptions, plans you have set to cancel at period end, and past plans that are no longer billing.
                                    </p>
                                </div>
                                {isApproved && renderAddListingDropdown()}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-10">
                            {livePlansSorted.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold tracking-wider text-muted-foreground">Active</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Plans marked "Scheduled to end" remain active until the listed end date.
                                    </p>
                                    <div className="space-y-4">{livePlansSorted.map((plan) => renderPlanSubscriptionCard(plan, "active"))}</div>
                                </div>
                            )}
                            {expiredPlans.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold tracking-wider text-muted-foreground">Past Plans</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Cancelled, expired, or replaced — no longer billing. Labels reflect subscription state in Stripe and your account.
                                    </p>
                                    <div className="space-y-4">
                                        {expiredPlans.map((plan) => renderPlanSubscriptionCard(plan, "past"))}
                                    </div>
                                </div>
                            )}
                            {pendingPaymentListings.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-yellow-500" />
                                        Pending Payment ({pendingPaymentListings.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {visiblePendingPaymentListings.map((offering) => {
                                            const listingGroup = inferListingGroup(offering);
                                            const listingName = getListingDisplayName(offering);
                                            const groupLabel = formatPlanGroupLabel(listingGroup);
                                            const tierLabel = formatPlanTierLabel(offering, PLAN_CONFIGS[offering.selectedPlan || offering.planId]);
                                            return (
                                                <div key={offering.id} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div>
                                                        <p className="font-semibold text-foreground">{listingName || groupLabel}</p>
                                                        <p className="text-sm text-muted-foreground mt-0.5">{[groupLabel, tierLabel].filter(Boolean).join(" · ")}</p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="shrink-0"
                                                        onClick={() => {
                                                            navigate(`/partner/add-listing/${listingGroup === "business_offerings" ? "offerings" : listingGroup}`);
                                                        }}
                                                    >
                                                        <CreditCard className="w-4 h-4 mr-2" /> Complete payment
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {hiddenPendingPaymentCount > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            + {hiddenPendingPaymentCount} more pending {hiddenPendingPaymentCount === 1 ? "listing" : "listings"} not shown
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
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
                    <div className={`p-3 rounded-lg text-sm font-medium ${profileMsg.includes("success") ? "bg-green-500/10 border border-green-500/30 text-green-700" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>{profileMsg}</div>
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
                    <div className="space-y-2">
                        <Label className="text-foreground/80">Billing / finance email</Label>
                        <Input type="email" value={profileForm.billingEmail} onChange={e => setProfileForm({ ...profileForm, billingEmail: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/80">VAT / ABN / EIN / Business ID</Label>
                        <Input value={profileForm.businessId} onChange={e => setProfileForm({ ...profileForm, businessId: e.target.value })} className="bg-foreground/5 border-foreground/10 h-11" placeholder="Recommended for invoicing and taxes" />
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
                        <p className={`text-xs ${(profileForm.companyProfile || "").length >= COMPANY_PROFILE_MAX_LENGTH ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>{(profileForm.companyProfile || "").length}/{COMPANY_PROFILE_MAX_LENGTH} characters</p>
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
                    <div className={`p-3 rounded-lg text-sm font-medium ${passwordMsg.type === "success" ? "bg-green-500/10 border border-green-500/30 text-green-700" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>{passwordMsg.text}</div>
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
                ? "bg-green-500/10 text-green-700 border-green-500/30"
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
                                        <th className="text-left font-semibold text-foreground/80 tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Date
                                        </th>
                                        <th className="text-left font-semibold text-foreground/80 tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Type
                                        </th>
                                        <th className="text-left font-semibold text-foreground/80 tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10">
                                            Description
                                        </th>
                                        <th className="text-left font-semibold text-foreground/80 tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Group
                                        </th>
                                        <th className="text-right font-semibold text-foreground/80 tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Amount
                                        </th>
                                        <th className="text-left font-semibold text-foreground/80 tracking-wide text-xs px-3 py-2.5 border-r border-foreground/10 whitespace-nowrap">
                                            Status
                                        </th>
                                        <th className="text-center font-semibold text-foreground/80 tracking-wide text-xs px-3 py-2.5 whitespace-nowrap w-[100px]">
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
                                                            ? "bg-green-500/10 text-green-700 border-green-500/30 font-medium"
                                                            : "bg-amber-500/10 text-amber-800 border-amber-500/30 font-medium"
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
                                        <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Description</dt>
                                        <dd className="text-foreground mt-0.5">{detail.description}</dd>
                                    </div>
                                    {detail.businessName && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Business</dt>
                                            <dd className="text-foreground mt-0.5">{detail.businessName}</dd>
                                        </div>
                                    )}
                                    {detail.group && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Group</dt>
                                            <dd className="text-foreground mt-0.5 capitalize">{detail.group}</dd>
                                        </div>
                                    )}
                                    {detail.planId && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Plan ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.planId}</dd>
                                        </div>
                                    )}
                                    {detail.featureId && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Feature ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.featureId}</dd>
                                        </div>
                                    )}
                                    {(detail.listingId || detail.collectionName) && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Listing</dt>
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
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Session ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.sessionId}</dd>
                                        </div>
                                    )}
                                    {detail.invoiceId && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Invoice ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.invoiceId}</dd>
                                        </div>
                                    )}
                                    {detail.stripeSubscriptionId && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Subscription ID</dt>
                                            <dd className="text-foreground mt-0.5 font-mono text-xs break-all">{detail.stripeSubscriptionId}</dd>
                                        </div>
                                    )}
                                    {detail.customerEmail && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground">Customer Email</dt>
                                            <dd className="text-foreground mt-0.5 break-all">{detail.customerEmail}</dd>
                                        </div>
                                    )}
                                    {detail.selectedCategories.length > 0 && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">Categories</dt>
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
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">Subcategories</dt>
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
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">Sub-subcategories</dt>
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
                                                    <dt className="text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">Countries</dt>
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
                                                    <dt className="text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">Regions</dt>
                                                    <dd className="text-xs text-foreground/90">{detail.serviceRegions.join(", ")}</dd>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {detail.companyRepresentatives.length > 0 && (
                                        <div>
                                            <dt className="text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">Company Representatives</dt>
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
    targetEventPlanId?: string;
    representativeOptions: Array<{ firstName: string; lastName: string; email: string }>;
    onClose: () => void;
    onSave: (data: any) => void;
    processing: boolean;
}

function EditListingModal({ listing, planConfig, isUpgradeFlow = false, targetEventPlanId, representativeOptions, onClose, onSave, processing }: EditListingModalProps) {
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
                                            <label htmlFor={`edit-sub-${cat}-${subLabel}`} className="text-sm text-green-700 cursor-pointer">{subLabel}</label>
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
    const [agendaHighlights, setAgendaHighlights] = useState(
        (listing.agendaHighlights || listing.agenda || "") as string
    );
    const [agendaPdfUrl, setAgendaPdfUrl] = useState(listing.agendaPdfUrl || "");
    const [eventAgendaPdfFile, setEventAgendaPdfFile] = useState<File | null>(null);
    const [eventAgendaPdfUploadError, setEventAgendaPdfUploadError] = useState("");
    const [eventAgendaPdfUploading, setEventAgendaPdfUploading] = useState(false);
    const [eventStateRegion, setEventStateRegion] = useState(listing.stateRegion || "");
    const [eventCity, setEventCity] = useState(listing.city || "");
    const eventListingPlanId = listing.selectedPlan || "";
    const effectiveEventPlanId =
        isUpgradeFlow && targetEventPlanId ? targetEventPlanId : eventListingPlanId;
    const isSingleDayEventPlan = effectiveEventPlanId === "basic_event";
    const isUpgradingFromBasicToMultiDay =
        isUpgradeFlow &&
        eventListingPlanId === "basic_event" &&
        Boolean(targetEventPlanId) &&
        targetEventPlanId !== "basic_event";

    useEffect(() => {
        if (listingGroup !== "events" || !isSingleDayEventPlan || !startDate) return;
        setEndDate((prev: string) => (prev === startDate ? prev : startDate));
    }, [listingGroup, isSingleDayEventPlan, startDate]);

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
                        <Edit3 className="w-5 h-5 text-primary" /> {isUpgradeFlow ? "Update listing for upgrade" : "Edit listing"}
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
                                <div className="md:col-span-2">
                                    <Label>Event name <span className="text-red-400">*</span></Label>
                                    <Input value={eventName} onChange={(e) => setEventName(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1 h-11" />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Event link <span className="text-red-400">*</span></Label>
                                    <Input type="url" value={eventLink} onChange={(e) => setEventLink(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1 h-11" />
                                </div>
                                <div>
                                    <Label>Start date <span className="text-red-400">*</span></Label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (isSingleDayEventPlan) {
                                                setStartDate(v);
                                                setEndDate(v);
                                            } else {
                                                setStartDate(v);
                                                setEndDate((prev: string) => (prev && v && prev < v ? v : prev));
                                            }
                                        }}
                                        className="bg-foreground/5 border-foreground/10 mt-1 h-11"
                                    />
                                </div>
                                <div>
                                    <Label>End date <span className="text-red-400">*</span></Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        min={startDate || undefined}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (startDate && v < startDate) setEndDate(startDate);
                                            else setEndDate(v);
                                        }}
                                        disabled={isSingleDayEventPlan}
                                        className="bg-foreground/5 border-foreground/10 mt-1 h-11"
                                    />
                                    {isSingleDayEventPlan && (
                                        <p className="text-xs text-muted-foreground mt-1">Basic events are single day; end date matches the start date.</p>
                                    )}
                                    {isUpgradingFromBasicToMultiDay && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Set an end date to extend your event for the upgraded plan. Dates apply after upgrade payment completes.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label>Country <span className="text-red-400">*</span></Label>
                                    <Select value={eventCountry} onValueChange={setEventCountry}>
                                        <SelectTrigger className="bg-foreground/5 border-foreground/10 mt-1 h-11"><SelectValue placeholder="Select country" /></SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            {SERVICE_COUNTRIES.map((c) => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>State/Province/Region <span className="text-red-400">*</span></Label>
                                    <Input value={eventStateRegion} onChange={(e) => setEventStateRegion(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1 h-11" />
                                </div>
                                <div>
                                    <Label>City/Town <span className="text-red-400">*</span></Label>
                                    <Input value={eventCity} onChange={(e) => setEventCity(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1 h-11" />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Venue / location <span className="text-red-400">*</span></Label>
                                    <Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1 h-11" />
                                </div>
                                <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Agenda highlights <span className="text-red-400">*</span> <span className="text-muted-foreground font-normal">(max {AGENDA_HIGHLIGHTS_MAX})</span></Label>
                                        <Textarea
                                            value={agendaHighlights}
                                            onChange={(e) => setAgendaHighlights(e.target.value.slice(0, AGENDA_HIGHLIGHTS_MAX))}
                                            className="bg-foreground/5 border-foreground/10 mt-1 min-h-[100px]"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">{agendaHighlights.length}/{AGENDA_HIGHLIGHTS_MAX}</p>
                                    </div>
                                    <div>
                                        <Label>Full agenda (PDF) <span className="text-red-400">*</span></Label>
                                        <Input
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            className="bg-foreground/5 border-foreground/10 mt-1 cursor-pointer"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0] || null;
                                                setEventAgendaPdfFile(f);
                                                setEventAgendaPdfUploadError("");
                                                if (f) setAgendaPdfUrl("");
                                            }}
                                        />
                                        {eventAgendaPdfFile && <p className="text-xs text-muted-foreground mt-1">Selected: {eventAgendaPdfFile.name}</p>}
                                        <p className="text-xs text-muted-foreground mt-1">Or paste a hosted PDF link.</p>
                                        <Input
                                            type="url"
                                            placeholder="https://…"
                                            value={agendaPdfUrl}
                                            onChange={(e) => setAgendaPdfUrl(e.target.value)}
                                            disabled={!!eventAgendaPdfFile}
                                            className="bg-foreground/5 border-foreground/10 mt-1"
                                        />
                                        {eventAgendaPdfUploadError && <p className="text-xs text-red-500 mt-1">{eventAgendaPdfUploadError}</p>}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Event profile <span className="text-red-400">*</span></Label>
                                    <Textarea value={eventProfile} onChange={(e) => setEventProfile(e.target.value)} className="bg-foreground/5 border-foreground/10 mt-1 min-h-[80px]" />
                                </div>
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
                </div>
                <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3 shrink-0">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={async () => {
                            let jobPdfUrlOut = jobDescriptionPdfUrl.trim();
                            let eventAgendaPdfOut = agendaPdfUrl.trim();
                            if (listingGroup === "events") {
                                if (eventAgendaPdfFile) {
                                    if (!auth.currentUser) {
                                        setEventAgendaPdfUploadError("You must be signed in to upload.");
                                        return;
                                    }
                                    const v = validateJobDescriptionPdf(eventAgendaPdfFile);
                                    if (v) {
                                        setEventAgendaPdfUploadError(v);
                                        return;
                                    }
                                    setEventAgendaPdfUploadError("");
                                    try {
                                        setEventAgendaPdfUploading(true);
                                        eventAgendaPdfOut = await uploadEventAgendaPdf(auth.currentUser.uid, eventAgendaPdfFile, listing.id);
                                    } catch (err: any) {
                                        setEventAgendaPdfUploadError(err?.message || "PDF upload failed.");
                                        return;
                                    } finally {
                                        setEventAgendaPdfUploading(false);
                                    }
                                } else if (!eventAgendaPdfOut) {
                                    setEventAgendaPdfUploadError("Add an agenda PDF file or a hosted PDF URL.");
                                    return;
                                }
                                setEventAgendaPdfUploadError("");
                            }
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
                                        agendaHighlights: agendaHighlights.trim(),
                                        agenda: agendaHighlights.trim(),
                                        agendaPdfUrl: eventAgendaPdfOut,
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
                            eventAgendaPdfUploading ||
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
                                    !eventLocation.trim() ||
                                    !agendaHighlights.trim() ||
                                    (!agendaPdfUrl.trim() && !eventAgendaPdfFile) ||
                                    !eventProfile.trim() ||
                                    categoryCount === 0 ||
                                    (startDate && endDate && endDate < startDate) ||
                                    (isSingleDayEventPlan && startDate && endDate !== startDate))) ||
                            (listingGroup === "jobs" &&
                                (!jobTitle.trim() ||
                                    !jobSummary.trim() ||
                                    (!jobDescriptionPdfUrl.trim() && !jobPdfFile) ||
                                    !jobType.trim() ||
                                    !industry.trim() ||
                                    !experienceLevel.trim() ||
                                    !education.trim() ||
                                    !jobCountry.trim() ||
                                    !jobStateRegion.trim() ||
                                    !jobCity.trim() ||
                                    !workModel.trim() ||
                                    !positionLink.trim() ||
                                    categoryCount === 0)) ||
                            (showServiceLocations && countries.length === 0)
                        }
                    >
                        {jobPdfUploading || eventAgendaPdfUploading ? "Uploading PDF…" : processing ? "Saving..." : isUpgradeFlow ? "Save & Continue to Stripe" : "Save Changes"}
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

    const isBusinessMonthly = currentPlan.planId?.includes("_mo");

    const parsePrice = (priceStr: string) => {
        return parseFloat(priceStr.replace(/[$,]/g, '')) || 0;
    };

    const currentPrice = parsePrice(currentPlanConfig?.price || "0");

    const upgradePlanIds = getAvailablePlanUpgradeIds(currentPlan.planId);
    const upgradePlans = upgradePlanIds
        .map((id) => [id, allPlans[id]] as const)
        .filter(([, config]) => Boolean(config))
        .sort((a, b) => {
            const ta = PLAN_UPGRADE_TIER_ORDER[a[0]] || 0;
            const tb = PLAN_UPGRADE_TIER_ORDER[b[0]] || 0;
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
    linkedListing?: any;
    hasFeature: boolean;
    spotlightCancelPending?: boolean;
    cancelError?: string;
    onClose: () => void;
    onCancel: (scope: CancelScope) => void;
    processing: boolean;
}

function CancelPlanModal({ plan, planConfig, linkedListing, hasFeature, spotlightCancelPending, cancelError, onClose, onCancel, processing }: CancelPlanModalProps) {
    const billingEnd =
        plan.billingPeriodEnd?.seconds
            ? new Date(plan.billingPeriodEnd.seconds * 1000)
            : getPlanPeriodEndDate(plan);
    const spotlightEnd =
        toDateValue(linkedListing?.featureSpotlightAccessEnd) ||
        toDateValue(linkedListing?.featureSpotlightPaidThrough) ||
        billingEnd;
    const showFeatureCancelChoice = hasFeature && !spotlightCancelPending;
    const [cancelChoice, setCancelChoice] = useState<CancelScope | null>(showFeatureCancelChoice ? null : "plan");

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
                        {showFeatureCancelChoice
                            ? <>You have an active <span className="font-semibold">spotlight add-on</span> on this listing, plus your <span className="font-semibold">{planConfig?.label}</span> plan. Choose what to cancel.</>
                            : <>Cancel your <span className="font-semibold">{planConfig?.label}</span> subscription?</>}
                    </p>
                    {spotlightCancelPending && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                            <p className="text-sm text-amber-800">
                                Your spotlight add-on is already scheduled to end on{" "}
                                <span className="font-semibold">
                                    {spotlightEnd?.toLocaleDateString() || "the end of your paid period"}
                                </span>
                                . You can cancel the plan subscription below if needed.
                            </p>
                        </div>
                    )}
                    {showFeatureCancelChoice && (
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
                            {showFeatureCancelChoice && cancelChoice === "feature" ? (
                                <>
                                    Spotlight stays active until{" "}
                                    <span className="font-semibold">
                                        {spotlightEnd?.toLocaleDateString() || "the end of your paid period"}
                                    </span>
                                    , then won&apos;t renew.
                                </>
                            ) : !showFeatureCancelChoice || cancelChoice === "plan" ? (
                                <>
                                    Your subscription stays active until <span className="font-semibold">{billingEnd?.toLocaleDateString() || "the end of your billing period"}</span>.
                                    After that, access tied to this plan ends unless you purchase again.
                                </>
                            ) : (
                                "Select an option above to continue."
                            )}
                        </p>
                    </div>
                    {cancelError && (
                        <p className="text-sm text-destructive">{cancelError}</p>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-foreground/10 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Keep subscription</Button>
                    <Button
                        variant="destructive"
                        onClick={() => onCancel(showFeatureCancelChoice ? (cancelChoice as CancelScope) : "plan")}
                        disabled={processing || (showFeatureCancelChoice && !cancelChoice)}
                    >
                        {processing
                            ? "Cancelling..."
                            : showFeatureCancelChoice && cancelChoice === "feature"
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
    planId?: string;
    listing?: any;
    onClose: () => void;
    onPurchase: (featureId: string) => void;
    processing: boolean;
}

function UpgradeFeaturePlanModal({ currentAddonId, planId, listing, onClose, onPurchase, processing }: UpgradeFeaturePlanModalProps) {
    const [selectedFeature, setSelectedFeature] = useState<string>("");
    const targets = FEATURE_PLANS.filter((fp) =>
        getFeatureUpgradeTargets(currentAddonId, planId, listing).includes(fp.id),
    );

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
                                            <p className="text-lg font-bold text-primary shrink-0">
                                                {formatFeatureUpgradeDelta(currentAddonId, fp.id, planId)}
                                            </p>
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

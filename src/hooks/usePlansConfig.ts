import { useState, useEffect } from "react";
import { db } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export interface PlanItem {
    id: string;
    badge: string;
    subtitle: string;
    monthlyPrice: number;
    yearlyMonthlyPrice: number;
    yearlyTotalPrice: number;
    features: string[];
    isFeatured?: boolean;
    maxCategories: number;
    maxCountries: number;
    stripeMonthlyId?: string;
    stripeYearlyId?: string;
    tierRank?: number;
}

export interface PlanGroup {
    id: string;
    title: string;
    hasAnnualToggle: boolean;
    order: number;
    plans: PlanItem[];
}

export interface PlansConfig {
    groups: PlanGroup[];
}

export const DEFAULT_PLANS_CONFIG: PlansConfig = {
    groups: [
        {
            id: "business_offerings",
            title: "Business Offerings and Consulting",
            hasAnnualToggle: true,
            order: 1,
            plans: [
                {
                    id: "basic",
                    badge: "Basic",
                    subtitle: "Individuals or businesses getting started",
                    monthlyPrice: 100,
                    yearlyMonthlyPrice: 90,
                    yearlyTotalPrice: 1080,
                    stripeMonthlyId: "basic_mo",
                    stripeYearlyId: "basic_yr",
                    maxCategories: 3,
                    maxCountries: 1,
                    tierRank: 1,
                    isFeatured: false,
                    features: [
                        "Access to specialized categories — list up to 3",
                        "List primary service country — 1",
                        "Company profile to highlight your key offerings",
                        "Display your logo for branding",
                        "Direct website link",
                        "Add representative(s) for direct communication",
                        "Certifications (optional) — highlight relevant certifications",
                        "Biosafety level (optional) — BSL disclosure",
                    ],
                },
                {
                    id: "standard",
                    badge: "Standard",
                    subtitle: "Individuals or businesses providing services in more than one country",
                    monthlyPrice: 200,
                    yearlyMonthlyPrice: 182,
                    yearlyTotalPrice: 2184,
                    stripeMonthlyId: "standard_mo",
                    stripeYearlyId: "standard_yr",
                    maxCategories: 5,
                    maxCountries: 3,
                    tierRank: 2,
                    isFeatured: false,
                    features: [
                        "Access to specialized categories — list up to 5",
                        "List primary service countries — up to 3",
                        "Company profile to highlight your key offerings",
                        "Display your logo for branding",
                        "Direct website link",
                        "Add representative(s) for direct communication",
                        "Certifications (optional) — highlight relevant certifications",
                        "Biosafety level (optional) — BSL disclosure",
                    ],
                },
                {
                    id: "premium",
                    badge: "Premium",
                    subtitle: "Businesses with a broader scope and presence",
                    monthlyPrice: 400,
                    yearlyMonthlyPrice: 360,
                    yearlyTotalPrice: 4320,
                    stripeMonthlyId: "premium_mo",
                    stripeYearlyId: "premium_yr",
                    maxCategories: 15,
                    maxCountries: 15,
                    tierRank: 3,
                    isFeatured: true,
                    features: [
                        "Access to specialized categories — list up to 15",
                        "List primary service countries — up to 15",
                        "Company profile to highlight your key offerings",
                        "Display your logo for branding",
                        "Direct website link",
                        "Add representative(s) for direct communication",
                        "Option to highlight certifications",
                        "Optional BSL (Biosafety Level) disclosure",
                    ],
                },
                {
                    id: "premium_plus",
                    badge: "Premium Plus",
                    subtitle: "Businesses with a global presence",
                    monthlyPrice: 1000,
                    yearlyMonthlyPrice: 900,
                    yearlyTotalPrice: 10800,
                    stripeMonthlyId: "premium_plus_mo",
                    stripeYearlyId: "premium_plus_yr",
                    maxCategories: -1,
                    maxCountries: -1,
                    tierRank: 4,
                    isFeatured: false,
                    features: [
                        "Access to specialized categories — Unlimited",
                        "List primary service countries — Unlimited",
                        "Company profile to highlight your key offerings",
                        "Display your logo for branding",
                        "Direct website link",
                        "Add representative(s) for direct communication",
                        "Option to highlight certifications",
                        "Optional BSL (Biosafety Level) disclosure",
                    ],
                },
            ],
        },
        {
            id: "events",
            title: "Events",
            hasAnnualToggle: false,
            order: 2,
            plans: [
                {
                    id: "basic_event",
                    badge: "Basic",
                    subtitle: "Single day conference/event",
                    monthlyPrice: 500,
                    yearlyMonthlyPrice: 500,
                    yearlyTotalPrice: 500,
                    stripeMonthlyId: "basic_event",
                    maxCategories: -1,
                    maxCountries: -1,
                    tierRank: 1,
                    isFeatured: false,
                    features: [
                        "Event profile",
                        "Agenda highlights + full agenda PDF",
                        "Event date",
                        "Event Location",
                        "Select multiple categories for better visibility",
                        "Company profile",
                        "Display your logo for branding",
                        "Direct link to your site for easy sign up",
                        "Add representative(s) for direct communication",
                    ],
                },
                {
                    id: "standard_event",
                    badge: "Standard",
                    subtitle: "Multi day conference/event",
                    monthlyPrice: 850,
                    yearlyMonthlyPrice: 850,
                    yearlyTotalPrice: 850,
                    stripeMonthlyId: "standard_event",
                    maxCategories: -1,
                    maxCountries: -1,
                    tierRank: 2,
                    isFeatured: false,
                    features: [
                        "Event profile",
                        "Agenda highlights + full agenda PDF",
                        "Event dates",
                        "Event Location",
                        "Select multiple categories for better visibility",
                        "Company profile",
                        "Display your logo for branding",
                        "Direct link to your site for easy sign up",
                        "Add representative(s) for direct communication",
                    ],
                },
                {
                    id: "premium_event",
                    badge: "Premium",
                    subtitle: "Event listing + landing page spotlight",
                    monthlyPrice: 1250,
                    yearlyMonthlyPrice: 1250,
                    yearlyTotalPrice: 1250,
                    stripeMonthlyId: "premium_event",
                    maxCategories: -1,
                    maxCountries: -1,
                    tierRank: 3,
                    isFeatured: false,
                    features: [
                        "Extra Feature: Landing page spotlight for increased visibility",
                        "Event profile",
                        "Agenda highlights + full agenda PDF",
                        "Event dates",
                        "Event Location",
                        "Select multiple categories for better visibility",
                        "Company profile",
                        "Display your logo for branding",
                        "Direct link to your site for easy sign up",
                        "Add representative(s) for direct communication",
                    ],
                },
                {
                    id: "premium_plus_event",
                    badge: "Premium Plus",
                    subtitle: "Event listing + home page spotlight",
                    monthlyPrice: 1450,
                    yearlyMonthlyPrice: 1450,
                    yearlyTotalPrice: 1450,
                    stripeMonthlyId: "premium_plus_event",
                    maxCategories: -1,
                    maxCountries: -1,
                    tierRank: 4,
                    isFeatured: true,
                    features: [
                        "Extra Feature: Home page spotlight for maximum visibility",
                        "Event profile",
                        "Agenda highlights + full agenda PDF",
                        "Event dates",
                        "Event Location",
                        "Select multiple categories",
                        "Company profile",
                        "Display your logo for branding",
                        "Direct link to your site for easy sign up",
                        "Add representative(s) for direct communication",
                    ],
                },
            ],
        },
        {
            id: "jobs",
            title: "Jobs",
            hasAnnualToggle: false,
            order: 3,
            plans: [
                {
                    id: "standard_job",
                    badge: "Standard",
                    subtitle: "Job posting",
                    monthlyPrice: 400,
                    yearlyMonthlyPrice: 400,
                    yearlyTotalPrice: 400,
                    stripeMonthlyId: "standard_job",
                    maxCategories: -1,
                    maxCountries: -1,
                    tierRank: 1,
                    isFeatured: false,
                    features: [
                        "Position title for quick search",
                        "Job description outlining key responsibilities",
                        "Company profile to showcase your brand and attract top talent",
                        "Direct link to your site for easy applications",
                        "Display your logo for branding",
                        "Location for filtering and relevance",
                        "Industry classification to improve discoverability",
                        "Add representative(s) for direct communication",
                    ],
                },
                {
                    id: "premium_job",
                    badge: "Premium",
                    subtitle: "Job posting & landing page spotlight",
                    monthlyPrice: 800,
                    yearlyMonthlyPrice: 800,
                    yearlyTotalPrice: 800,
                    stripeMonthlyId: "premium_job",
                    maxCategories: -1,
                    maxCountries: -1,
                    tierRank: 2,
                    isFeatured: false,
                    features: [
                        "Extra Feature: Landing page spotlight for increased visibility",
                        "Position title for quick search",
                        "Job description outlining key responsibilities",
                        "Company profile to showcase your brand and attract top talent",
                        "Direct link to your site for easy applications",
                        "Display your logo for branding",
                        "Location for filtering and relevance",
                        "Industry classification to improve discoverability",
                        "Add representative(s) for direct communication",
                    ],
                },
                {
                    id: "premium_plus_job",
                    badge: "Premium Plus",
                    subtitle: "Job posting + home page spotlight",
                    monthlyPrice: 1000,
                    yearlyMonthlyPrice: 1000,
                    yearlyTotalPrice: 1000,
                    stripeMonthlyId: "premium_plus_job",
                    maxCategories: -1,
                    maxCountries: -1,
                    tierRank: 3,
                    isFeatured: true,
                    features: [
                        "Extra Feature: Home page spotlight for maximum visibility",
                        "Position title for quick search",
                        "Job description outlining key responsibilities",
                        "Company profile to showcase your brand and attract top talent",
                        "Direct link to your site for easy applications",
                        "Display your logo for branding",
                        "Location for filtering and relevance",
                        "Industry classification to improve discoverability",
                        "Add representative(s) for direct communication",
                    ],
                },
            ],
        },
    ],
};

export function usePlansConfig() {
    const [config, setConfig] = useState<PlansConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const docRef = doc(db, "config", "plansConfig");
        
        const unsubscribe = onSnapshot(
            docRef,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data() as PlansConfig;
                    // Sort groups by order
                    if (data.groups) {
                        data.groups.sort((a, b) => (a.order || 0) - (b.order || 0));
                    }
                    setConfig(data);
                } else {
                    setConfig(DEFAULT_PLANS_CONFIG);
                }
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching plansConfig:", err);
                setError(err.message);
                setConfig(DEFAULT_PLANS_CONFIG);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Helper to get limits by stripeId
    const getLimitsForPlanId = (stripePlanId: string) => {
        const activeConfig = config || DEFAULT_PLANS_CONFIG;
        if (!stripePlanId) return { maxCategories: 0, maxCountries: 0 };
        for (const group of activeConfig.groups) {
            for (const plan of group.plans) {
                if (plan.stripeMonthlyId === stripePlanId || plan.stripeYearlyId === stripePlanId || plan.id === stripePlanId) {
                    return { maxCategories: plan.maxCategories, maxCountries: plan.maxCountries };
                }
            }
        }
        return { maxCategories: 0, maxCountries: 0 };
    };

    // Helper to get features list by planId
    const getFeaturesForPlanId = (planId: string): string[] => {
        const activeConfig = config || DEFAULT_PLANS_CONFIG;
        if (!planId) return [];
        for (const group of activeConfig.groups) {
            for (const plan of group.plans) {
                if (
                    plan.stripeMonthlyId === planId || 
                    plan.stripeYearlyId === planId || 
                    plan.id === planId || 
                    plan.badge?.toLowerCase() === planId.toLowerCase()
                ) {
                    return plan.features || [];
                }
            }
        }
        return [];
    };

    return { config, loading, error, getLimitsForPlanId, getFeaturesForPlanId };
}

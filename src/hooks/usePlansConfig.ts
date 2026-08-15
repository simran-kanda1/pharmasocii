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
                    setConfig({ groups: [] });
                }
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching plansConfig:", err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Helper to get limits by stripeId
    const getLimitsForPlanId = (stripePlanId: string) => {
        if (!config || !stripePlanId) return { maxCategories: 0, maxCountries: 0 };
        for (const group of config.groups) {
            for (const plan of group.plans) {
                if (plan.stripeMonthlyId === stripePlanId || plan.stripeYearlyId === stripePlanId) {
                    return { maxCategories: plan.maxCategories, maxCountries: plan.maxCountries };
                }
            }
        }
        return { maxCategories: 0, maxCountries: 0 };
    };

    return { config, loading, error, getLimitsForPlanId };
}

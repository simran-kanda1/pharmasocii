import { useState, useEffect } from "react";
import { db } from "@/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

export interface FeaturedPlanOption {
    id: string;
    label: string;
    specification: string;
    price: number;
    durationDays: number;
    countryLimit: number;
    categoryLimit: number;
    status: "Active" | "Inactive";
    description?: string;
}

export interface FeaturedPlanGroup {
    service: string;
    options: FeaturedPlanOption[];
}

export interface FeaturedPlansConfig {
    groups: FeaturedPlanGroup[];
}

export const DEFAULT_FEATURED_PLANS_CONFIG: FeaturedPlansConfig = {
    groups: [
        {
            service: "Business Offerings & Consulting Services",
            options: [
                {
                    id: "home_page",
                    label: "Home Page",
                    specification: "Home page",
                    price: 1000,
                    durationDays: 30,
                    countryLimit: 1,
                    categoryLimit: 2,
                    status: "Active",
                    description: "Featured on the home page for maximum brand visibility",
                },
                {
                    id: "landing_page",
                    label: "Landing Page",
                    specification: "This is feature plan",
                    price: 700,
                    durationDays: 30,
                    countryLimit: 5,
                    categoryLimit: 5,
                    status: "Active",
                    description: "Featured on the category landing page for increased visibility",
                },
                {
                    id: "both",
                    label: "Both Page",
                    specification: "Both plan",
                    price: 1500,
                    durationDays: 30,
                    countryLimit: 5,
                    categoryLimit: 2,
                    status: "Active",
                    description: "Featured on both the category landing page and the home page",
                },
            ],
        },
    ],
};

export function useFeaturedPlansConfig() {
    const [config, setConfig] = useState<FeaturedPlansConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const docRef = doc(db, "config", "featuredPlansConfig");

        const unsubscribe = onSnapshot(
            docRef,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data() as FeaturedPlansConfig;
                    setConfig(data && Array.isArray(data.groups) && data.groups.length > 0 ? data : DEFAULT_FEATURED_PLANS_CONFIG);
                } else {
                    setConfig(DEFAULT_FEATURED_PLANS_CONFIG);
                }
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching featuredPlansConfig:", err);
                setError(err.message);
                setConfig(DEFAULT_FEATURED_PLANS_CONFIG);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const saveConfig = async (newConfig: FeaturedPlansConfig) => {
        const docRef = doc(db, "config", "featuredPlansConfig");
        await setDoc(docRef, newConfig);
    };

    const getFeaturedPlanById = (id?: string | null): FeaturedPlanOption | undefined => {
        if (!id) return undefined;
        const activeConfig = config || DEFAULT_FEATURED_PLANS_CONFIG;
        const cleanId = id.trim().toLowerCase();
        for (const group of activeConfig.groups) {
            for (const option of group.options) {
                if (option.id.toLowerCase() === cleanId) {
                    return option;
                }
            }
        }
        return undefined;
    };

    const getAllActiveFeaturedPlans = (): FeaturedPlanOption[] => {
        const activeConfig = config || DEFAULT_FEATURED_PLANS_CONFIG;
        const active: FeaturedPlanOption[] = [];
        for (const group of activeConfig.groups) {
            for (const option of group.options) {
                if (option.status !== "Inactive") {
                    active.push(option);
                }
            }
        }
        return active;
    };

    return {
        config: config || DEFAULT_FEATURED_PLANS_CONFIG,
        loading,
        error,
        saveConfig,
        getFeaturedPlanById,
        getAllActiveFeaturedPlans,
    };
}

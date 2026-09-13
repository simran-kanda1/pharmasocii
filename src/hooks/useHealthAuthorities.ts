import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";
import {
    DEFAULT_HEALTH_AUTHORITIES,
    type HealthAuthorityItem,
} from "@/lib/defaultHealthAuthorities";

const STORAGE_KEY = "pharma_health_authorities_cache";
const CONFIG_DOC_PATH = ["config", "healthAuthorities"] as const;

function getCachedHealthAuthorities(): HealthAuthorityItem[] | null {
    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn("Failed to parse cached health authorities:", e);
    }
    return null;
}

function setCachedHealthAuthorities(items: HealthAuthorityItem[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn("Failed to cache health authorities in localStorage:", e);
    }
}

export function useHealthAuthorities() {
    const [allHealthAuthorities, setAllHealthAuthorities] = useState<HealthAuthorityItem[]>(() => {
        return getCachedHealthAuthorities() || DEFAULT_HEALTH_AUTHORITIES;
    });
    const [loading, setLoading] = useState(true);
    const [isConfiguredInDb, setIsConfiguredInDb] = useState(false);

    useEffect(() => {
        const docRef = doc(db, CONFIG_DOC_PATH[0], CONFIG_DOC_PATH[1]);
        const unsub = onSnapshot(
            docRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data && "items" in data && Array.isArray(data.items)) {
                        setAllHealthAuthorities(data.items);
                        setCachedHealthAuthorities(data.items);
                        setIsConfiguredInDb(true);
                    } else {
                        const cached = getCachedHealthAuthorities();
                        setAllHealthAuthorities(cached || DEFAULT_HEALTH_AUTHORITIES);
                        setIsConfiguredInDb(false);
                    }
                } else {
                    // Document doesn't exist yet in Firestore
                    const cached = getCachedHealthAuthorities();
                    setAllHealthAuthorities(cached || DEFAULT_HEALTH_AUTHORITIES);
                    setIsConfiguredInDb(false);
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error subscribing to healthAuthorities config:", error);
                const cached = getCachedHealthAuthorities();
                setAllHealthAuthorities(cached || DEFAULT_HEALTH_AUTHORITIES);
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    // Filter active items for public consumer views, sorted alphabetically by country name
    const activeHealthAuthorities = allHealthAuthorities
        .filter((item) => item.status !== "Inactive")
        .sort((a, b) => a.country.localeCompare(b.country, undefined, { sensitivity: "base" }));

    // Admin view: all items sorted alphabetically by country name
    const sortedAllHealthAuthorities = [...allHealthAuthorities].sort((a, b) =>
        a.country.localeCompare(b.country, undefined, { sensitivity: "base" })
    );

    // Save full list to Firestore & localStorage
    const saveHealthAuthorities = useCallback(async (newItems: HealthAuthorityItem[]) => {
        const docRef = doc(db, CONFIG_DOC_PATH[0], CONFIG_DOC_PATH[1]);
        const sanitizedItems = newItems.map((item) => ({
            id: item.id || `ha_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            country: item.country.trim(),
            url: item.url.trim(),
            status: item.status || "Active",
            updatedAt: new Date().toISOString(),
        }));

        await setDoc(docRef, {
            items: sanitizedItems,
            updatedAt: serverTimestamp(),
            lastModifiedBy: "admin",
        }, { merge: true });

        setAllHealthAuthorities(sanitizedItems);
        setCachedHealthAuthorities(sanitizedItems);
        setIsConfiguredInDb(true);
    }, []);

    // Add a single new health authority
    const addHealthAuthority = useCallback(async (item: { country: string; url: string; status?: "Active" | "Inactive" }) => {
        const id = `ha_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newItem: HealthAuthorityItem = {
            id,
            country: item.country.trim(),
            url: item.url.trim(),
            status: item.status || "Active",
            updatedAt: new Date().toISOString(),
        };
        const updated = [...allHealthAuthorities, newItem];
        await saveHealthAuthorities(updated);
        return newItem;
    }, [allHealthAuthorities, saveHealthAuthorities]);

    // Update an existing health authority
    const updateHealthAuthority = useCallback(async (id: string, updates: Partial<HealthAuthorityItem>) => {
        const updated = allHealthAuthorities.map((item) => {
            if (item.id === id) {
                return {
                    ...item,
                    ...updates,
                    country: updates.country !== undefined ? updates.country.trim() : item.country,
                    url: updates.url !== undefined ? updates.url.trim() : item.url,
                    status: updates.status !== undefined ? updates.status : item.status || "Active",
                    updatedAt: new Date().toISOString(),
                };
            }
            return item;
        });
        await saveHealthAuthorities(updated);
    }, [allHealthAuthorities, saveHealthAuthorities]);

    // Delete a health authority by ID
    const deleteHealthAuthority = useCallback(async (id: string) => {
        const updated = allHealthAuthorities.filter((item) => item.id !== id);
        await saveHealthAuthorities(updated);
    }, [allHealthAuthorities, saveHealthAuthorities]);

    // Reset database to default health authorities list
    const resetToDefaults = useCallback(async () => {
        await saveHealthAuthorities(DEFAULT_HEALTH_AUTHORITIES);
    }, [saveHealthAuthorities]);

    return {
        healthAuthorities: activeHealthAuthorities,
        allHealthAuthorities: sortedAllHealthAuthorities,
        loading,
        isConfiguredInDb,
        saveHealthAuthorities,
        addHealthAuthority,
        updateHealthAuthority,
        deleteHealthAuthority,
        resetToDefaults,
    };
}

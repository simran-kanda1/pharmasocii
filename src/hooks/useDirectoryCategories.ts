import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import {
    DEFAULT_BUSINESS_CATEGORIES,
    DEFAULT_CONSULTING_CATEGORIES,
    DEFAULT_EVENTS_CATEGORIES,
    DEFAULT_JOBS_CATEGORIES,
    mergeDirectoryCategories,
    normalizeGroupKey,
    type CategoriesDict,
    type DirectoryCategoryDoc,
} from "@/lib/defaultDirectoryCategories";

export function useDirectoryCategories() {
    const [businessCategories, setBusinessCategories] = useState<CategoriesDict>(DEFAULT_BUSINESS_CATEGORIES);
    const [consultingCategories, setConsultingCategories] = useState<CategoriesDict>(DEFAULT_CONSULTING_CATEGORIES);
    const [eventsCategories, setEventsCategories] = useState<CategoriesDict>(DEFAULT_EVENTS_CATEGORIES);
    const [jobsCategories, setJobsCategories] = useState<CategoriesDict>(DEFAULT_JOBS_CATEGORIES);
    const [categoryMetadataMap, setCategoryMetadataMap] = useState<Record<string, DirectoryCategoryDoc>>({});
    const [rawDocs, setRawDocs] = useState<DirectoryCategoryDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "categoriesCollection"),
            (snapshot) => {
                const docs: DirectoryCategoryDoc[] = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                }));

                setRawDocs(docs);
                const merged = mergeDirectoryCategories(docs);
                setBusinessCategories(merged.business);
                setConsultingCategories(merged.consulting);
                setEventsCategories(merged.events);
                setJobsCategories(merged.jobs);
                setCategoryMetadataMap(merged.categoryMetadataMap);
                setLoading(false);
            },
            (error) => {
                console.error("Error subscribing to categoriesCollection:", error);
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const getCategoriesForGroup = (group?: string): CategoriesDict | null => {
        const key = normalizeGroupKey(group);
        switch (key) {
            case "business":
                return businessCategories;
            case "consulting":
                return consultingCategories;
            case "events":
                return eventsCategories;
            case "jobs":
                return jobsCategories;
            default:
                return null;
        }
    };

    return {
        businessCategories,
        consultingCategories,
        eventsCategories,
        jobsCategories,
        getCategoriesForGroup,
        categoryMetadataMap,
        rawDocs,
        loading,
    };
}

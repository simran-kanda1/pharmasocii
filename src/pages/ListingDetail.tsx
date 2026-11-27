import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "@/firebase";
import { doc, getDoc, collectionGroup, query, getDocs, limit } from "firebase/firestore";
import {
    buildLiveListingKeySet,
    isPartnerListingPublic,
} from "@/lib/partnerListingPublic";
import { MapPin, ShieldCheck, Phone, ExternalLink, Building2, Linkedin, Calendar, CalendarRange, Globe, Ticket, Briefcase, Clock, FileText, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDirectoryCategories } from "@/hooks/useDirectoryCategories";
import { REGION_COUNTRY_MAP } from "@/constants/regions";
import { matchCategoryOrSub } from "@/lib/categorySelection";
import { formatEventLocation, formatJobLocation } from "@/lib/utils";


// Simple skeleton placeholder
const Skeleton = ({ className }: { className: string }) => <div className={`animate-pulse bg-muted rounded ${className}`} />;

export default function ListingDetail() {
    const { businessCategories, consultingCategories, eventsCategories, jobsCategories } = useDirectoryCategories();
    const BUSINESS_LOOKUP_LIMIT = 10000;
    const { type, id } = useParams<{ type: string; id: string }>();
    const [item, setItem] = useState<any>(null);
    const [partner, setPartner] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [showAllCerts, setShowAllCerts] = useState(false);
    const [showAllAreas, setShowAllAreas] = useState(false);
    const [activeRegion, setActiveRegion] = useState<string | null>(null);

    useEffect(() => {
        const fetchListing = async () => {
            if (!id || !type) return;
            setLoading(true);
            try {
                let collectionNames: string[] = [];

                if (type === "business") {
                    collectionNames = ["businessOfferingsCollection"];
                } else if (type === "consulting") {
                    // Keep both names for backward compatibility with existing data. 
                    collectionNames = ["consultingServicesCollection", "consultingCollection"];
                } else if (type === "events") {
                    collectionNames = ["eventsCollection"];
                } else if (type === "jobs") {
                    collectionNames = ["jobsCollection"];
                }

                if (collectionNames.length > 0) {
                    let docSnap: any = null;
                    let resolvedCollectionName = "";
                    const plansSnap = await getDocs(query(collectionGroup(db, "planCollection"), limit(10000)));
                    const liveListingKeys = buildLiveListingKeySet(
                        plansSnap.docs.map((planDoc) => ({
                            path: planDoc.ref.path,
                            data: planDoc.data() as Record<string, unknown>,
                        })),
                    );

                    for (const collectionName of collectionNames) {
                        if (type === "business") {
                            const q = query(collectionGroup(db, collectionName), limit(BUSINESS_LOOKUP_LIMIT));
                            const querySnap = await getDocs(q);
                            const found = querySnap.docs.find((d) => {
                                if (d.id !== id) return false;
                                const raw = d.data() as Record<string, any>;
                                const path = String(d.ref.parent?.parent?.path || "");
                                const partnerFromPath =
                                    path.includes("partnersCollection") && d.ref.parent?.parent?.id
                                        ? d.ref.parent.parent.id
                                        : "";
                                const listing = {
                                    id: d.id,
                                    partnerId: raw.partnerId || partnerFromPath,
                                    ...raw,
                                };
                                return isPartnerListingPublic(listing, collectionName, liveListingKeys);
                            });
                            if (found) {
                                docSnap = found;
                                resolvedCollectionName = collectionName;
                                break;
                            }

                            // Fallback for legacy records stored in top-level collections.
                            const directBusinessRef = doc(db, collectionName, id);
                            const directBusinessSnap = await getDoc(directBusinessRef);
                            if (directBusinessSnap.exists()) {
                                const raw = directBusinessSnap.data() as Record<string, any>;
                                const listing = { id: directBusinessSnap.id, partnerId: raw.partnerId, ...raw };
                                if (isPartnerListingPublic(listing, collectionName, liveListingKeys)) {
                                    docSnap = directBusinessSnap;
                                    resolvedCollectionName = collectionName;
                                    break;
                                }
                            }
                        } else {
                            const directRef = doc(db, collectionName, id);
                            const directSnap = await getDoc(directRef);
                            if (directSnap.exists()) {
                                const raw = directSnap.data() as Record<string, any>;
                                const listing = { id: directSnap.id, partnerId: raw.partnerId, ...raw };
                                if (isPartnerListingPublic(listing, collectionName, liveListingKeys)) {
                                    docSnap = directSnap;
                                    resolvedCollectionName = collectionName;
                                    break;
                                }
                            }
                        }
                    }

                    if (docSnap && docSnap.exists()) {
                        const listingData: any = { id: docSnap.id, ...docSnap.data() };
                        if (resolvedCollectionName) {
                            listingData._collectionName = resolvedCollectionName;
                        }
                        setItem(listingData);

                        // Fetch partner metadata
                        if (listingData.partnerId) {
                            const partnerRef = doc(db, "partnersCollection", listingData.partnerId);
                            const partnerSnap = await getDoc(partnerRef);
                            if (partnerSnap.exists()) {
                                setPartner(partnerSnap.data());
                            }
                        }
                    } else if (type === "business") {
                        const altRef = doc(db, "partnersCollection", id);
                        const altSnap = await getDoc(altRef);
                        if (altSnap.exists()) {
                            const pData = altSnap.data();
                            setItem({ id: altSnap.id, ...pData });
                            setPartner(pData);
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching listing:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchListing();
    }, [type, id]);

    // Handle initial active region
    useEffect(() => {
        if (item?.serviceRegions && item.serviceRegions.length > 0) {
            setActiveRegion(item.serviceRegions[0]);
        } else if (item?.serviceCountries && item.serviceCountries.length > 0) {
            // Group by region if no regions provided
            for (const [region, countries] of Object.entries(REGION_COUNTRY_MAP)) {
                if (item.serviceCountries.some((c: string) => countries.includes(c))) {
                    setActiveRegion(region);
                    break;
                }
            }
        }
    }, [item]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-24 max-w-6xl space-y-8">
                <Skeleton className="h-12 w-3/4 animate-pulse rounded-xl" />
                <Skeleton className="h-6 w-1/2 animate-pulse rounded-lg" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-32 animate-pulse rounded-2xl" />
                    <Skeleton className="h-32 animate-pulse rounded-2xl" />
                </div>
                <Skeleton className="h-64 animate-pulse rounded-2xl" />
            </div>
        );
    }

    if (!item) {
        return (
            <div className="container mx-auto px-4 py-32 text-center">
                <h2 className="text-3xl font-bold mb-4">Listing not found</h2>
                <p className="text-muted-foreground mb-8">The listing you are looking for does not exist or has been removed.</p>
                <Button asChild variant="outline" className="rounded-full px-8">
                    <Link to="/all-categories">Back to Categories</Link>
                </Button>
            </div>
        );
    }

    const rawListingTitle = type === "business" ? item.businessName : type === "consulting" ? (item.primaryName || item.businessName) : type === "events" ? item.eventName : type === "jobs" ? item.jobTitle : item.businessName;
    const listingTitle = rawListingTitle || "";

    // Format a date string (YYYY-MM-DD) to a human-readable form.
    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return null;
        try {
            return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        } catch {
            return dateStr;
        }
    };
    const eventStart = type === "events" ? formatDate(item.startDate) : null;
    const eventEnd = type === "events" ? formatDate(item.endDate) : null;
    const eventLocationLine =
        type === "events"
            ? formatEventLocation(
                item.city || item.eventCity,
                item.stateRegion || item.state || item.eventStateRegion,
                item.eventCountry || item.country
            )
            : "";
    const jobLocationLine =
        type === "jobs"
            ? formatJobLocation(
                item.city || item.jobCity,
                item.stateRegion || item.state || item.jobStateRegion,
                item.jobCountry || item.country
            )
            : "";
    const jobCatsArray = type === "jobs" 
        ? (() => {
            const list: string[] = [];
            if (Array.isArray(item.selectedCategoriesDisplay) && item.selectedCategoriesDisplay.length > 0) {
                list.push(...item.selectedCategoriesDisplay);
            } else if (Array.isArray(item.selectedCategories) && item.selectedCategories.length > 0) {
                list.push(...item.selectedCategories);
            } else if (Array.isArray(item.categories) && item.categories.length > 0) {
                list.push(...item.categories);
            } else if (typeof item.categories === "string" && item.categories.trim()) {
                list.push(...item.categories.split(",").map((s: string) => s.trim()));
            } else if (typeof item.category === "string" && item.category.trim()) {
                list.push(item.category.trim());
            }

            if (Array.isArray(item.selectedSubcategoriesDisplay) && item.selectedSubcategoriesDisplay.length > 0) {
                list.push(...item.selectedSubcategoriesDisplay);
            } else if (Array.isArray(item.selectedSubcategories) && item.selectedSubcategories.length > 0) {
                list.push(...item.selectedSubcategories.map((s: string) => s.split(" > ").pop()?.trim() || s.trim()));
            }

            if (Array.isArray(item.selectedSubSubcategories) && item.selectedSubSubcategories.length > 0) {
                list.push(...item.selectedSubSubcategories.map((s: string) => s.split(" > ").pop()?.trim() || s.trim()));
            }

            return Array.from(new Set(list.filter(Boolean))).sort((a, b) =>
                a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
            );
        })()
        : [];
    const jobTypeLabel = type === "jobs" ? (item.jobtype || item.positionType || "") : "";
    const jobDeadlineFormatted = type === "jobs" && item.applicationDeadline ? formatDate(item.applicationDeadline) : null;

    // Helper to group subcategories by Area as per the new taxonomy setup
    const getGroupedCategories = () => {
        // Comprehensive fallbacks for different field names used in Firestore
        const selectedAreas = Array.isArray(item.selectedCategoriesDisplay) ? item.selectedCategoriesDisplay :
            (Array.isArray(item.selectedCategories) ? item.selectedCategories :
                (Array.isArray(item.categories) ? item.categories :
                    (item.category ? [item.category] :
                        (item.consultingCategory ? [item.consultingCategory] : []))));

        const rawSubList: string[] = [];
        if (Array.isArray(item.selectedSubcategories)) rawSubList.push(...item.selectedSubcategories);
        if (Array.isArray(item.selectedSubcategoriesDisplay)) rawSubList.push(...item.selectedSubcategoriesDisplay);
        if (Array.isArray(item.subcategories)) rawSubList.push(...item.subcategories);
        const allSelectedSubs = Array.from(new Set(rawSubList));

        const allSelectedSubSubs = Array.isArray(item.selectedSubSubcategories) ? item.selectedSubSubcategories :
            (Array.isArray(item.subSubcategories) ? item.subSubcategories : []);

        const serviceRegions = Array.isArray(item.serviceRegions) ? item.serviceRegions : [];
        const serviceCountries = Array.isArray(item.serviceCountries) ? item.serviceCountries : [];

        const normalize = (s: any) => (typeof s === 'string' ? s.toLowerCase().trim() : "");

        const categoriesDict = type === "business" 
            ? businessCategories 
            : type === "consulting" 
            ? consultingCategories 
            : type === "events" 
            ? eventsCategories 
            : jobsCategories;

        // Legacy area aliases mapping old taxonomy category names to active categories
        const LEGACY_AREA_ALIASES: Record<string, string> = {
            "container closures & packaging": "Packaging & Delivery Systems",
            "container closures packaging": "Packaging & Delivery Systems",
            "packaging": "Packaging & Delivery Systems",
            "clinical research & related activities": "Clinical Research Services",
            "clinical research related activities": "Clinical Research Services",
            "clinical research & development": "Clinical Research Services",
            "clinical research": "Clinical Research Services",
            "engineering": "Engineering Services",
            "equipment": "Equipment Support Services",
            "equipment suppliers": "Equipment Support Services",
            "facility design and qualifications": "Available Facilities & Infrastructure",
            "facility & infrastructure": "Available Facilities & Infrastructure",
            "materials/ excipients / cells": "Materials, Excipients & Bioprocess Supplies",
            "materials excipients cells": "Materials, Excipients & Bioprocess Supplies",
            "medical devices": "Medical Devices & Delivery Systems",
            "laboratory & related services": "Laboratory & Analytical Services",
            "laboratory and related services": "Laboratory & Analytical Services",
            "regulatory services": "Regulatory Services",
        };

        const KNOWN_SPECIALIZATION_PARENT_MAP: Record<string, { area: string; sub?: string }> = {
            "equipment maintenance & calibration": { area: "Laboratory & Analytical Services" },
            "extractable and leachable studies": { area: "Laboratory & Analytical Services" },
            "filter compatibility studies": { area: "Laboratory & Analytical Services" },
            "laboratory informatics": { area: "Laboratory & Analytical Services" },
            "laboratory network": { area: "Laboratory & Analytical Services" },
            "clinical writing": { area: "Regulatory Services" },
            "cmc writing": { area: "Regulatory Services" },
            "non-clinical writing": { area: "Regulatory Services" },
        };

        // Build active taxonomy lookup indices
        type SubSubHit = { area: string; sub: string; subSub: string };
        type SubHit = { area: string; sub: string };

        const subSubIndex: SubSubHit[] = [];
        const subIndex: SubHit[] = [];
        const activeAreas = new Set<string>();

        Object.entries(categoriesDict || {}).forEach(([areaName, entries]) => {
            activeAreas.add(areaName);
            (entries || []).forEach((entry: any) => {
                const subLabel = typeof entry === "string" ? entry : entry.label;
                subIndex.push({ area: areaName, sub: subLabel });
                if (typeof entry !== "string" && Array.isArray(entry.subSubcategories)) {
                    entry.subSubcategories.forEach((ss: string) => {
                        subSubIndex.push({ area: areaName, sub: subLabel, subSub: ss });
                    });
                }
            });
        });

        // Helper to match token in subSubIndex (with exact, matchCategoryOrSub, and compound '&' or '/' support)
        const findSubSubHit = (token: string): SubSubHit | undefined => {
            const raw = token.includes(" > ") ? token.split(" > ").pop()?.trim() || token : token;
            const normRaw = normalize(raw);

            // 1. Exact or matchCategoryOrSub
            let found = subSubIndex.find((hit) => matchCategoryOrSub(raw, hit.subSub));
            if (found) return found;

            // 2. Compound matching (e.g. "Ampoules & Vials" matches "Ampoules" or "Vials")
            if (raw.includes("&") || raw.includes("/")) {
                const parts = raw.split(/[&/]/).map((p) => normalize(p)).filter(Boolean);
                found = subSubIndex.find((hit) => parts.includes(normalize(hit.subSub)));
                if (found) return found;
            }

            // 3. Reversed compound matching (e.g. hit.subSub has "Bottles & Jars", token has "Bottles")
            found = subSubIndex.find((hit) => {
                if (hit.subSub.includes("&") || hit.subSub.includes("/")) {
                    const hitParts = hit.subSub.split(/[&/]/).map((p) => normalize(p)).filter(Boolean);
                    return hitParts.includes(normRaw);
                }
                return false;
            });
            if (found) return found;

            return undefined;
        };

        // Helper to match token in subIndex
        const findSubHit = (token: string): SubHit | undefined => {
            const raw = token.includes(" > ") ? token.split(" > ").pop()?.trim() || token : token;

            let found = subIndex.find((hit) => matchCategoryOrSub(raw, hit.sub));
            if (found) return found;

            if (raw.includes("&") || raw.includes("/")) {
                const parts = raw.split(/[&/]/).map((p: string) => normalize(p)).filter(Boolean);
                found = subIndex.find((hit) => parts.includes(normalize(hit.sub)));
                if (found) return found;
            }

            return undefined;
        };

        // Resolve an Area name (active taxonomy, case-insensitive, or legacy alias)
        const resolveAreaName = (area: string): string | undefined => {
            if (!area) return undefined;
            const norm = normalize(area);
            for (const active of activeAreas) {
                if (normalize(active) === norm) return active;
            }
            const alias = LEGACY_AREA_ALIASES[norm];
            if (alias) {
                for (const active of activeAreas) {
                    if (normalize(active) === normalize(alias)) return active;
                }
                return alias;
            }
            return area.trim();
        };

        // Map: Area -> Map of (SubcategoryLabel -> Set of Sub-subcategories)
        const areaMap = new Map<string, Map<string, Set<string>>>();
        const getOrCreateArea = (area: string) => {
            let m = areaMap.get(area);
            if (!m) {
                m = new Map<string, Set<string>>();
                areaMap.set(area, m);
            }
            return m;
        };

        // Pre-register any active or resolved areas from selectedAreas to preserve original order
        (selectedAreas as string[]).forEach((area) => {
            const resolved = resolveAreaName(area);
            if (resolved) {
                getOrCreateArea(resolved);
            }
        });

        const claimedTokens = new Set<string>();

        // Combine all sub/sub-sub tokens from Firestore listing
        const allTokens = [
            ...allSelectedSubSubs.map((t: string) => ({ raw: t })),
            ...allSelectedSubs.map((t: string) => ({ raw: t })),
        ];

        // Process all selected tokens against active taxonomy
        allTokens.forEach(({ raw }) => {
            const leaf = raw.includes(" > ") ? raw.split(" > ").pop()?.trim() || raw : raw;
            const normRaw = normalize(raw);
            const normLeaf = normalize(leaf);

            // A) Check sub-subcategory match first (e.g. Aerosols, Airless Systems, Ampoules & Vials -> Primary Packaging)
            const ssHit = findSubSubHit(leaf);
            if (ssHit) {
                const subMap = getOrCreateArea(ssHit.area);
                let ssSet = subMap.get(ssHit.sub);
                if (!ssSet) {
                    ssSet = new Set<string>();
                    subMap.set(ssHit.sub, ssSet);
                }
                ssSet.add(leaf);
                claimedTokens.add(normRaw);
                claimedTokens.add(normLeaf);
                return;
            }

            // B) Check subcategory match (e.g. Formulation Development -> Development Services)
            const sHit = findSubHit(leaf);
            if (sHit) {
                const subMap = getOrCreateArea(sHit.area);
                if (!subMap.has(sHit.sub)) {
                    subMap.set(sHit.sub, new Set<string>());
                }
                claimedTokens.add(normRaw);
                claimedTokens.add(normLeaf);
                return;
            }
        });

        // Fallback for composite paths e.g. "Area > Sub > SubSub"
        allTokens.forEach(({ raw }) => {
            const leaf = raw.includes(" > ") ? raw.split(" > ").pop()?.trim() || raw : raw;
            const normRaw = normalize(raw);
            const normLeaf = normalize(leaf);
            if (claimedTokens.has(normRaw) || claimedTokens.has(normLeaf)) return;

            if (raw.includes(" > ")) {
                const parts = raw.split(" > ").map((p: string) => p.trim());
                if (parts.length >= 2) {
                    const resolvedArea = resolveAreaName(parts[0]);
                    if (resolvedArea) {
                        const subMap = getOrCreateArea(resolvedArea);
                        const subName = parts[1];
                        let ssSet = subMap.get(subName);
                        if (!ssSet) {
                            ssSet = new Set<string>();
                            subMap.set(subName, ssSet);
                        }
                        if (parts[2]) ssSet.add(parts[2]);
                        claimedTokens.add(normRaw);
                        claimedTokens.add(normLeaf);
                        return;
                    }
                }
            }
        });

        // C) Check known parent category mapping for legacy specializations
        allTokens.forEach(({ raw }) => {
            const leaf = raw.includes(" > ") ? raw.split(" > ").pop()?.trim() || raw : raw;
            const normRaw = normalize(raw);
            const normLeaf = normalize(leaf);
            if (claimedTokens.has(normRaw) || claimedTokens.has(normLeaf)) return;

            const fallback = KNOWN_SPECIALIZATION_PARENT_MAP[normLeaf] || KNOWN_SPECIALIZATION_PARENT_MAP[normRaw];
            if (fallback) {
                const targetArea = resolveAreaName(fallback.area) || fallback.area;
                const subMap = getOrCreateArea(targetArea);
                const subLabel = fallback.sub || leaf;
                if (!subMap.has(subLabel)) {
                    subMap.set(subLabel, new Set<string>());
                }
                claimedTokens.add(normRaw);
                claimedTokens.add(normLeaf);
            }
        });

        // Truly unmatched orphans
        const orphanEntries: { label: string; subSubs: string[] }[] = [];
        allTokens.forEach(({ raw }) => {
            const leaf = raw.includes(" > ") ? raw.split(" > ").pop()?.trim() || raw : raw;
            const normRaw = normalize(raw);
            const normLeaf = normalize(leaf);
            if (claimedTokens.has(normRaw) || claimedTokens.has(normLeaf)) return;

            claimedTokens.add(normRaw);
            claimedTokens.add(normLeaf);
            orphanEntries.push({ label: leaf, subSubs: [] });
        });

        // Build the final grouped list
        const grouped: {
            area: string;
            subs: { label: string; subSubs: string[] }[];
            regions: string[];
            countries: string[];
        }[] = [];

        areaMap.forEach((subMap, areaName) => {
            const subs: { label: string; subSubs: string[] }[] = [];
            subMap.forEach((ssSet, subLabel) => {
                subs.push({
                    label: subLabel,
                    subSubs: Array.from(ssSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
                });
            });

            // Sort subcategories alphabetically
            subs.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

            // Only display this area if:
            // 1. It has matched subcategories (subs.length > 0), OR
            // 2. It is an active category in categoriesDict whose taxonomy legitimately has no subcategories (leaf category).
            // Do NOT render empty legacy areas (like old "Container Closures & Packaging" when all its subs moved to "Packaging & Delivery Systems").
            const isExplicitlySelected = (selectedAreas as string[]).some(
                (sa) => normalize(sa) === normalize(areaName)
            );
            const areaInTaxonomy = (categoriesDict as any)?.[areaName];
            const isLegitLeafArea = Array.isArray(areaInTaxonomy) && areaInTaxonomy.length === 0;

            if (subs.length > 0 || isLegitLeafArea || isExplicitlySelected) {
                grouped.push({
                    area: areaName,
                    subs,
                    regions: serviceRegions,
                    countries: serviceCountries,
                });
            }
        });

        // Sort categories/areas in alphabetical order
        grouped.sort((a, b) => a.area.localeCompare(b.area, undefined, { sensitivity: "base" }));

        // Only display "Other selected specializations" if there are actual unmatched orphan tokens
        if (orphanEntries.length > 0) {
            orphanEntries.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
            grouped.push({
                area: "Other selected specializations",
                subs: orphanEntries,
                regions: serviceRegions,
                countries: serviceCountries,
            });
        }

        return grouped;
    };

    const groupedCategories = getGroupedCategories();

    return (
        <div className="min-h-0 w-full flex-1 bg-background">
            <div className="container mx-auto px-4 py-12 max-w-7xl pt-32">
                {/* Main Profile Header Section */}
                <Card className="rounded-3xl border-foreground/10 shadow-xl overflow-hidden mb-12">
                    <div className="bg-muted/30 p-8 md:p-12">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            {/* Icon */}
                            <div className="w-24 h-24 rounded-2xl bg-background border border-foreground/10 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                                {partner?.logoUrl || item.logoUrl || partner?.companyLogoUrl || item.companyLogoUrl ? (
                                    <img src={partner?.logoUrl || item.logoUrl || partner?.companyLogoUrl || item.companyLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                                ) : type === "events" ? (
                                    <Calendar className="w-12 h-12 text-primary/40" />
                                ) : type === "jobs" ? (
                                    <Briefcase className="w-12 h-12 text-primary/40" />
                                ) : (
                                    <Building2 className="w-12 h-12 text-primary/40" />
                                )}
                            </div>

                            <div className="flex-1 space-y-4 w-full">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">{listingTitle}</h1>


                                </div>

                                {/* ── Event: organizer name + description ── */}
                                {type === "events" ? (
                                    <>
                                        {item.businessName && (
                                            <p className="text-sm font-semibold text-muted-foreground tracking-widest">
                                                {item.businessName}
                                            </p>
                                        )}
                                        {item.eventProfile && (() => {
                                            const rawText = String(item.eventProfile).trim();
                                            // Split by double newlines or single newlines followed by a repeating pattern
                                            const paragraphs = rawText.split(/\n+/);
                                            const uniqueParagraphs: string[] = [];
                                            const seen = new Set<string>();

                                            paragraphs.forEach(p => {
                                                const trimmed = p.trim();
                                                if (trimmed && !seen.has(trimmed)) {
                                                    uniqueParagraphs.push(trimmed);
                                                    seen.add(trimmed);
                                                }
                                            });

                                            return uniqueParagraphs.map((para, idx) => (
                                                <p key={idx} className="text-foreground/80 text-base leading-relaxed max-w-4xl whitespace-pre-line mb-4 last:mb-0">
                                                    {para}
                                                </p>
                                            ));
                                        })()}
                                    </>
                                ) : type === "jobs" ? (
                                    <>
                                        {(item.businessName || partner?.businessName) && (
                                            <p className="text-sm font-semibold text-muted-foreground tracking-widest">
                                                {item.businessName || partner?.businessName}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-muted-foreground text-lg leading-relaxed max-w-4xl">
                                        {item.companyProfileText || partner?.companyProfileText || "No company profile available."}
                                    </p>
                                )}

                                {/* ── Business-only: certifications & BSL ── */}
                                {type === "business" && (() => {
                                    const rawBsl = item.bioSafetyLevel || partner?.bioSafetyLevel;
                                    const bslString = Array.isArray(rawBsl) ? [...rawBsl].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).join(", ") : rawBsl;
                                    const hasBsl = !!bslString && bslString !== "N/A" && String(bslString).trim().length > 0;

                                    const rawCerts = item.certifications || partner?.certifications;
                                    const certsRawArray = Array.isArray(rawCerts)
                                        ? rawCerts.flatMap((c: any) => typeof c === 'string' ? c.split(',').map((s: string) => s.trim()) : [c])
                                        : (typeof rawCerts === 'string'
                                            ? rawCerts.split(',').map((s: string) => s.trim())
                                            : (rawCerts ? [rawCerts] : []));
                                    const certsArray = Array.from(new Set(certsRawArray.filter(Boolean)));
                                    const hasCerts = certsArray.length > 0;

                                    if (!hasBsl && !hasCerts) return null;

                                    certsArray.sort((a, b) => String(a).localeCompare(String(b)));
                                    const displayCerts = showAllCerts ? certsArray : certsArray.slice(0, 3);

                                    return (
                                        <div className="flex flex-col items-start gap-y-4 pt-2">
                                            {hasBsl && (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground tracking-widest">BSL Level</span>
                                                    <p className="text-sm font-semibold text-foreground">{bslString}</p>
                                                </div>
                                            )}
                                            {hasCerts && (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground tracking-widest">Certifications</span>
                                                    <div className="text-sm font-semibold capitalize text-foreground flex flex-col items-start gap-0.5">
                                                        <span>{displayCerts.join(", ")}{!showAllCerts && certsArray.length > 3 ? "..." : ""}</span>
                                                        {certsArray.length > 3 && (
                                                            <button
                                                                onClick={() => setShowAllCerts(!showAllCerts)}
                                                                className="text-xs text-primary hover:underline mt-0.5 font-bold"
                                                            >
                                                                {showAllCerts ? "View less" : "View more"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ── Event: key details row ── */}
                                {type === "events" && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                                        {(eventStart || eventEnd) && (
                                            <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10">
                                                <CalendarRange className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Date</p>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {eventStart}{eventEnd && eventEnd !== eventStart ? ` – ${eventEnd}` : ""}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {eventLocationLine && (
                                            <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10">
                                                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Location</p>
                                                    <p className="text-sm font-semibold text-foreground">{eventLocationLine}</p>
                                                </div>
                                            </div>
                                        )}
                                        {(() => {
                                            if (groupedCategories.length > 0) {
                                                const initialLimit = 2;
                                                const hasMore = groupedCategories.length > initialLimit;
                                                const visibleGroups = showAllCategories ? groupedCategories : groupedCategories.slice(0, initialLimit);

                                                return (
                                                    <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10 h-full">
                                                        <Globe className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1.5">Categories & Subcategories</p>
                                                            <div className="space-y-2 text-xs">
                                                                {visibleGroups.map((group, gIdx) => {
                                                                    const subNames = group.subs.map((s: any) => s.label.split(" > ").pop()?.trim()).filter(Boolean);
                                                                    return (
                                                                        <div key={gIdx} className="leading-snug">
                                                                            <span className="font-bold text-foreground text-[12px] text-primary/95 block sm:inline">
                                                                                {group.area}
                                                                                {subNames.length > 0 ? ": " : ""}
                                                                            </span>
                                                                            {subNames.length > 0 && (
                                                                                <span className="text-muted-foreground font-normal sm:ml-1">
                                                                                    {subNames.join(", ")}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {hasMore && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowAllCategories(!showAllCategories)}
                                                                    className="mt-2 text-[11px] text-primary hover:underline font-bold tracking-tight inline-block"
                                                                >
                                                                    {showAllCategories ? "Show less" : `+${groupedCategories.length - initialLimit} more categories`}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const cats = (() => {
                                                const list: string[] = [];
                                                if (Array.isArray(item.selectedCategoriesDisplay) && item.selectedCategoriesDisplay.length > 0) {
                                                    list.push(...item.selectedCategoriesDisplay);
                                                } else if (Array.isArray(item.selectedCategories) && item.selectedCategories.length > 0) {
                                                    list.push(...item.selectedCategories);
                                                } else if (Array.isArray(item.categories) && item.categories.length > 0) {
                                                    list.push(...item.categories);
                                                } else if (typeof item.categories === "string" && item.categories.trim()) {
                                                    list.push(...item.categories.split(",").map((s: string) => s.trim()));
                                                } else if (typeof item.category === "string" && item.category.trim()) {
                                                    list.push(item.category.trim());
                                                }

                                                if (Array.isArray(item.selectedSubcategoriesDisplay) && item.selectedSubcategoriesDisplay.length > 0) {
                                                    list.push(...item.selectedSubcategoriesDisplay);
                                                } else if (Array.isArray(item.selectedSubcategories) && item.selectedSubcategories.length > 0) {
                                                    list.push(...item.selectedSubcategories.map((s: string) => s.split(" > ").pop()?.trim() || s.trim()));
                                                }

                                                if (Array.isArray(item.selectedSubSubcategories) && item.selectedSubSubcategories.length > 0) {
                                                    list.push(...item.selectedSubSubcategories.map((s: string) => s.split(" > ").pop()?.trim() || s.trim()));
                                                }

                                                return Array.from(new Set(list.filter(Boolean))).sort((a, b) =>
                                                    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
                                                );
                                            })();

                                            if (cats.length === 0) return null;

                                            const initialLimit = 3;
                                            const hasMore = cats.length > initialLimit;

                                            return (
                                                <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10 h-full">
                                                    <Globe className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Categories</p>
                                                        <div className="text-sm font-semibold text-foreground">
                                                            {showAllCategories ? cats.join(", ") : cats.slice(0, initialLimit).join(", ") + (hasMore ? "..." : "")}
                                                            {hasMore && (
                                                                <button
                                                                    onClick={() => setShowAllCategories(!showAllCategories)}
                                                                    className="ml-2 text-[10px] text-primary hover:underline font-bold tracking-tighter"
                                                                >
                                                                    {showAllCategories ? "Show less" : `+${cats.length - initialLimit} more`}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* ── Job: key details row ── */}
                                {type === "jobs" && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                                        {jobTypeLabel && (
                                            <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10">
                                                <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Job Type</p>
                                                    <p className="text-sm font-semibold text-foreground">{jobTypeLabel}</p>
                                                </div>
                                            </div>
                                        )}
                                        {jobDeadlineFormatted && (
                                            <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10">
                                                <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Apply By</p>
                                                    <p className="text-sm font-semibold text-foreground">{jobDeadlineFormatted}</p>
                                                </div>
                                            </div>
                                        )}
                                        {item.workModel && (
                                            <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10">
                                                <Globe className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Work Model</p>
                                                    <p className="text-sm font-semibold text-foreground">{item.workModel}</p>
                                                </div>
                                            </div>
                                        )}
                                        {item.education && (
                                            <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10">
                                                <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Education</p>
                                                    <p className="text-sm font-semibold text-foreground">{item.education}</p>
                                                </div>
                                            </div>
                                        )}
                                        {item.experienceLevel && (
                                            <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10">
                                                <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Experience Level</p>
                                                    <p className="text-sm font-semibold text-foreground">{item.experienceLevel}</p>
                                                </div>
                                            </div>
                                        )}
                                        {item.industry && (
                                            <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10">
                                                <Briefcase className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Industry</p>
                                                    <p className="text-sm font-semibold text-foreground">{item.industry}</p>
                                                </div>
                                            </div>
                                        )}
                                        {jobLocationLine && (
                                            <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10">
                                                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Location</p>
                                                    <p className="text-sm font-semibold text-foreground">{jobLocationLine}</p>
                                                </div>
                                            </div>
                                        )}
                                        {(() => {
                                            if (groupedCategories.length > 0) {
                                                const initialLimit = 2;
                                                const hasMore = groupedCategories.length > initialLimit;
                                                const visibleGroups = showAllCategories ? groupedCategories : groupedCategories.slice(0, initialLimit);

                                                return (
                                                    <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10 h-full">
                                                        <LayoutList className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1.5">Categories & Specializations</p>
                                                            <div className="space-y-2 text-xs">
                                                                {visibleGroups.map((group, gIdx) => {
                                                                    const subNames = group.subs.map((s: any) => s.label.split(" > ").pop()?.trim()).filter(Boolean);
                                                                    return (
                                                                        <div key={gIdx} className="leading-snug">
                                                                            <span className="font-bold text-foreground text-[12px] text-primary/95 block sm:inline">
                                                                                {group.area}
                                                                                {subNames.length > 0 ? ": " : ""}
                                                                            </span>
                                                                            {subNames.length > 0 && (
                                                                                <span className="text-muted-foreground font-normal sm:ml-1">
                                                                                    {subNames.join(", ")}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {hasMore && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowAllCategories(!showAllCategories)}
                                                                    className="mt-2 text-[11px] text-primary hover:underline font-bold tracking-tight inline-block"
                                                                >
                                                                    {showAllCategories ? "Show less" : `+${groupedCategories.length - initialLimit} more categories`}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (jobCatsArray.length === 0) return null;

                                            const initialLimit = 3;
                                            const hasMore = jobCatsArray.length > initialLimit;

                                            return (
                                                <div className="flex items-start gap-3 bg-background/60 rounded-xl px-4 py-3 border border-foreground/10 h-full">
                                                    <LayoutList className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-0.5">Categories</p>
                                                        <div className="text-sm font-semibold text-foreground">
                                                            {showAllCategories ? jobCatsArray.join(", ") : jobCatsArray.slice(0, initialLimit).join(", ") + (hasMore ? "..." : "")}
                                                            {hasMore && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowAllCategories(!showAllCategories)}
                                                                    className="ml-2 text-[10px] text-primary hover:underline font-bold tracking-tighter"
                                                                >
                                                                    {showAllCategories ? "Show less" : `+${jobCatsArray.length - initialLimit} more`}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* ── Business & Consulting: location + phone ── */}
                                {(type === "business" || type === "consulting") && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-6 text-sm text-muted-foreground">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-start gap-3">
                                                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                <span>{item.businessCountry || partner?.businessCountry || "N/A"}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Phone className="w-4 h-4 text-primary shrink-0" />
                                                <span>{item.businessPhoneNumber || item.phoneNumber || partner?.businessPhoneNumber || partner?.phoneNumber || "N/A"}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── CTA buttons ── */}
                                <div className="flex flex-wrap justify-start items-center gap-4 pt-4 border-t border-foreground/10">
                                    {(() => {
                                        const cleanExternalUrl = (url?: any): string => {
                                            if (!url) return "";
                                            const str = String(url).trim();
                                            if (!str || str === "undefined" || str === "null" || str === "-") return "";
                                            return /^https?:\/\//i.test(str) ? str : `https://${str}`;
                                        };

                                        const resolvedWebsite = cleanExternalUrl(
                                            item.companyWebsiteLink ||
                                            item.companyWebsite ||
                                            item.website ||
                                            partner?.companyWebsite ||
                                            partner?.companyWebsiteLink ||
                                            partner?.website
                                        );

                                        const resolvedLinkedIn = cleanExternalUrl(
                                            item.linkedInProfileLink ||
                                            item.linkedinProfile ||
                                            item.linkedin ||
                                            item.linkedIn ||
                                            item.companyLinkedin ||
                                            partner?.linkedInProfileLink ||
                                            partner?.linkedinProfile ||
                                            partner?.linkedin ||
                                            partner?.linkedIn ||
                                            partner?.companyLinkedin
                                        );

                                        const resolvedJobLinkedIn = cleanExternalUrl(
                                            item.linkedInJob ||
                                            resolvedLinkedIn
                                        );

                                        if (type === "events") {
                                            return (
                                                <div className="flex flex-wrap gap-4">
                                                    {item.eventLink && item.eventLink !== "" && (
                                                        <Button asChild size="lg" className="rounded-xl shadow-lg bg-primary hover:bg-primary/90 border-none px-8 font-bold text-primary-foreground transition-all">
                                                            <a href={cleanExternalUrl(item.eventLink)} target="_blank" rel="noopener noreferrer">
                                                                <Ticket className="mr-2 w-5 h-5" /> Register / View Event
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {Boolean(resolvedWebsite) && (
                                                        <Button asChild variant="outline" size="lg" className="rounded-xl shadow-sm border-primary text-primary hover:bg-primary/10 hover:text-primary px-6 font-bold transition-all">
                                                            <a href={resolvedWebsite} target="_blank" rel="noopener noreferrer">
                                                                Company Website <ExternalLink className="ml-2 w-4 h-4" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {Boolean(resolvedLinkedIn) && (
                                                        <Button asChild size="lg" className="rounded-xl shadow-lg bg-[#0077b5] hover:bg-[#005a8c] border-none px-6 font-bold text-white transition-all">
                                                            <a href={resolvedLinkedIn} target="_blank" rel="noopener noreferrer">
                                                                <Linkedin className="mr-2 w-4 h-4" /> LinkedIn
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        }

                                        if (type === "jobs") {
                                            return (
                                                <div className="flex flex-wrap gap-3">
                                                    {item.positionLink && item.positionLink !== "" && (
                                                        <Button asChild size="lg" className="rounded-xl shadow-lg bg-primary hover:bg-primary/90 border-none px-8 font-bold text-primary-foreground transition-all">
                                                            <a href={cleanExternalUrl(item.positionLink)} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="mr-2 w-5 h-5" /> Apply
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {Boolean(resolvedWebsite) && (
                                                        <Button asChild variant="outline" size="lg" className="rounded-xl shadow-sm border-primary text-primary hover:bg-primary/10 hover:text-primary px-6 font-bold transition-all">
                                                            <a href={resolvedWebsite} target="_blank" rel="noopener noreferrer">
                                                                Company Website <ExternalLink className="ml-2 w-4 h-4" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {Boolean(resolvedJobLinkedIn) && (
                                                        <Button asChild size="lg" className="rounded-xl shadow-lg bg-[#0077b5] hover:bg-[#005a8c] border-none px-6 font-bold text-white transition-all">
                                                            <a href={resolvedJobLinkedIn} target="_blank" rel="noopener noreferrer">
                                                                <Linkedin className="mr-2 w-5 h-5" /> LinkedIn
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return (
                                            <>
                                                {Boolean(resolvedWebsite) && (
                                                    <Button asChild variant="outline" size="lg" className="rounded-xl shadow-sm border-primary text-primary hover:bg-primary/10 hover:text-primary px-6 font-bold transition-all">
                                                        <a href={resolvedWebsite} target="_blank" rel="noopener noreferrer">
                                                            Company Website <ExternalLink className="ml-2 w-4 h-4" />
                                                        </a>
                                                    </Button>
                                                )}
                                                {Boolean(resolvedLinkedIn) && (
                                                    <Button asChild size="lg" className="rounded-xl shadow-lg bg-[#0077b5] hover:bg-[#005a8c] border-none px-6 font-bold text-white transition-all">
                                                        <a href={resolvedLinkedIn} target="_blank" rel="noopener noreferrer">
                                                            <Linkedin className="mr-2 w-4 h-4" /> LinkedIn
                                                        </a>
                                                    </Button>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* ── Job Summary card ── */}
                {type === "jobs" && item.jobSummary && (
                    <div className="mb-12">
                        <Card className="rounded-3xl border-foreground/10 shadow-lg overflow-hidden">
                            <div className="bg-muted/30 px-8 py-5 border-b border-foreground/10">
                                <h3 className="text-lg font-black text-foreground tracking-wider flex items-center gap-2">
                                    <Briefcase className="w-5 h-5 text-primary" /> Role Description
                                </h3>
                            </div>
                            <div className="p-8">
                                <p className="text-foreground/80 text-base leading-relaxed whitespace-pre-line">{item.jobSummary}</p>
                            </div>
                        </Card>
                    </div>
                )}

                {/* ── Full job description (PDF) ── */}
                {type === "jobs" && item.jobDescriptionPdfUrl && String(item.jobDescriptionPdfUrl).trim() !== "" && (
                    <div className="mb-12">
                        <Card className="rounded-3xl border-foreground/10 shadow-lg overflow-hidden">
                            <div className="bg-muted/30 px-8 py-5 border-b border-foreground/10 flex flex-wrap items-center justify-between gap-4">
                                <h3 className="text-lg font-black text-foreground tracking-wider flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" /> Full Job Description
                                </h3>
                                <Button asChild variant="outline" size="sm" className="rounded-full">
                                    <a href={item.jobDescriptionPdfUrl} target="_blank" rel="noopener noreferrer">
                                        Open PDF <ExternalLink className="ml-2 w-4 h-4" />
                                    </a>
                                </Button>
                            </div>
                            <div className="p-4 bg-muted/20 border-t border-foreground/5">
                                <iframe
                                    title="Job description PDF"
                                    src={`${item.jobDescriptionPdfUrl}#toolbar=1`}
                                    className="w-full min-h-[480px] rounded-xl border border-foreground/10 bg-background"
                                />
                            </div>
                        </Card>
                    </div>
                )}



                {/* Event agenda - moved up for prominence */}
                {type === "events" && (() => {
                    const highlights = String(item.agendaHighlights || item.agenda || "").trim();
                    const pdf = String(item.agendaPdfUrl || "").trim();
                    return highlights !== "" || pdf !== "";
                })() && (
                        <div className="mb-12">
                            <Card className="rounded-3xl border-foreground/10 shadow-lg overflow-hidden">
                                <div className="bg-muted/30 px-8 py-5 border-b border-foreground/10 flex flex-wrap items-center justify-between gap-4">
                                    <h3 className="text-lg font-black text-foreground tracking-wider flex items-center gap-2">
                                        <CalendarRange className="w-5 h-5 text-primary" /> Agenda
                                    </h3>
                                    {item.agendaPdfUrl && String(item.agendaPdfUrl).trim() !== "" && (
                                        <Button asChild variant="outline" size="sm" className="rounded-full shadow-sm border-primary/20 hover:bg-primary/5">
                                            <a href={item.agendaPdfUrl} target="_blank" rel="noopener noreferrer">
                                                <FileText className="mr-2 w-4 h-4 text-primary" /> Open Full PDF Agenda
                                            </a>
                                        </Button>
                                    )}
                                </div>
                                <div className="p-8 space-y-6">
                                    {(() => {
                                        const text = String(item.agendaHighlights || item.agenda || "").trim();
                                        if (!text) return null;
                                        return (
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-bold text-muted-foreground tracking-widest">Agenda Highlights</p>
                                                <p className="text-foreground/80 text-base leading-relaxed whitespace-pre-line">{text}</p>
                                            </div>
                                        );
                                    })()}

                                    {item.agendaPdfUrl && String(item.agendaPdfUrl).trim() !== "" && (
                                        <div className="pt-4 border-t border-foreground/5">
                                            <div className="aspect-[16/9] md:aspect-[21/9] w-full rounded-2xl border border-foreground/10 overflow-hidden bg-muted/20">
                                                <iframe
                                                    title="Event Agenda PDF"
                                                    src={`${item.agendaPdfUrl}#toolbar=0`}
                                                    className="w-full h-full"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}



                {/* Subcategories detail for jobs */}
                {type === "jobs" && (Array.isArray(item.selectedSubcategories) && item.selectedSubcategories.length > 0) && (
                    <div className="mb-12">
                        <Card className="rounded-3xl border-foreground/10 shadow-lg overflow-hidden">
                            <div className="bg-muted/30 px-8 py-5 border-b border-foreground/10">
                                <h3 className="text-lg font-black text-foreground tracking-wider flex items-center gap-2">
                                    <Briefcase className="w-5 h-5 text-primary" /> Job Specializations
                                </h3>
                            </div>
                            <div className="p-8 flex flex-wrap gap-2">
                                {item.selectedSubcategories.slice().sort((a: string, b: string) => (a.split(" > ").pop() || a).localeCompare(b.split(" > ").pop() || b, undefined, { sensitivity: "base" })).map((sub: string, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="text-sm py-1.5 px-4 rounded-xl bg-primary/5 text-primary border-primary/10 font-medium">
                                        {sub.split(" > ").pop()}
                                    </Badge>
                                ))}
                                {Array.isArray(item.selectedSubSubcategories) && item.selectedSubSubcategories.slice().sort((a: string, b: string) => (a.split(" > ").pop() || a).localeCompare(b.split(" > ").pop() || b, undefined, { sensitivity: "base" })).map((ss: string, idx: number) => (
                                    <Badge key={`ss-${idx}`} variant="outline" className="text-sm py-1.5 px-4 rounded-xl font-medium">
                                        {ss.split(" > ").pop()}
                                    </Badge>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Tier 1 & 2: Categories & Subcategories Table */}
                {(type === "business" || type === "consulting" || type === "events") && groupedCategories.length > 0 && (
                    <div className="mb-12">
                        <Card className="rounded-3xl border-foreground/10 shadow-lg overflow-hidden">
                            <div className="bg-muted/30 px-8 py-5 border-b border-foreground/10">
                                <h3 className="text-lg font-black text-foreground tracking-wider flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-primary" /> {type === "events" ? "Event Categories & Topics" : "Areas & Categories"}
                                </h3>
                            </div>
                            <table className="w-full text-left border-collapse">

                                <tbody>
                                    {(() => {
                                        const renderedGroups = [];
                                        
                                        for (let idx = 0; idx < groupedCategories.length; idx++) {
                                            const group = groupedCategories[idx];
                                            
                                            if (!showAllAreas && idx >= 10) {
                                                break;
                                            }
                                            
                                            renderedGroups.push(
                                                <tr key={idx} className="border-b border-foreground/10 last:border-0 hover:bg-muted/5 transition-colors">
                                                    <td className="px-8 py-6 align-top">
                                                        <p className="font-bold text-foreground text-lg flex items-center gap-2">
                                                            {group.area}
                                                        </p>
                                                    </td>
                                                    <td className="px-8 py-6 space-y-4 align-top">
                                                        {group.subs.length > 0 ? (
                                                            group.subs.map((sub: any, sIdx: number) => (
                                                                <div key={sIdx} className="space-y-1.5">
                                                                    <p className="font-semibold text-foreground flex items-center gap-2">
                                                                        <span className="w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                                                                        {sub.label.split(" > ").pop()}
                                                                    </p>
                                                                    {sub.subSubs && sub.subSubs.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1.5 pl-4 pt-0.5">
                                                                            {sub.subSubs.map((ss: string, ssIdx: number) => (
                                                                                <Badge key={ssIdx} variant="secondary" className="text-[10px] py-0 px-2 rounded-md bg-primary/5 text-primary border-primary/10 font-medium tracking-tight">
                                                                                    {ss.split(" > ").pop()}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            null
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        return renderedGroups;
                                    })()}
                                </tbody>
                            </table>
                            
                            {(() => {
                                        if (groupedCategories.length > 10) {
                                    return (
                                        <div className="p-4 border-t border-foreground/10 flex justify-center bg-muted/10">
                                            <Button 
                                                variant="ghost" 
                                                className="text-primary hover:text-primary/80 font-bold"
                                                onClick={() => setShowAllAreas(!showAllAreas)}
                                            >
                                                {showAllAreas ? "View less" : "View more"}
                                            </Button>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </Card>
                    </div>
                )}

                {/* Service Locations Section */}
                {(Array.isArray(item.serviceRegions) && item.serviceRegions.length > 0 || Array.isArray(item.serviceCountries) && item.serviceCountries.length > 0) && (
                    <div className="mb-12">
                        <Card className="rounded-3xl border-foreground/10 shadow-lg overflow-hidden border-2 border-slate-200">
                            <div className="bg-slate-50 px-8 py-6 border-b border-foreground/10">
                                <h3 className="text-lg font-black text-foreground tracking-tight tracking-wider">
                                    Geographic Availability
                                </h3>
                            </div>
                            <div className="p-8">
                                <div className="space-y-8">
                                    {/* Pre-process Regions and Countries */}
                                    {(() => {
                                        const regionsMapping: Record<string, string[]> = {};
                                        const unmatchedCountries: string[] = [];
                                        const serviceCountries = Array.isArray(item.serviceCountries) ? item.serviceCountries : [];
                                        const serviceRegions = Array.isArray(item.serviceRegions) ? item.serviceRegions : [];

                                        // 1. Initialize regionsMapping with explicit regions
                                        serviceRegions.forEach((r: string) => {
                                            if (r) regionsMapping[r] = [];
                                        });

                                        // 2. Group countries into regions
                                        serviceCountries.forEach((country: string) => {
                                            let matched = false;
                                            const normalizedCountry = country.trim().toLowerCase();

                                            // Check each region in the map
                                            for (const [region, regionCountries] of Object.entries(REGION_COUNTRY_MAP)) {
                                                if (regionCountries.some(rc => rc.trim().toLowerCase() === normalizedCountry)) {
                                                    if (!regionsMapping[region]) regionsMapping[region] = [];
                                                    if (!regionsMapping[region].includes(country)) {
                                                        regionsMapping[region].push(country);
                                                    }
                                                    matched = true;
                                                }
                                            }

                                            if (!matched && !unmatchedCountries.includes(country)) {
                                                unmatchedCountries.push(country);
                                            }
                                        });

                                        // 3. Handle unmatched countries (International/General)
                                        if (unmatchedCountries.length > 0) {
                                            const generalKey = "Global / Other";
                                            if (!regionsMapping[generalKey]) regionsMapping[generalKey] = [];
                                            regionsMapping[generalKey].push(...unmatchedCountries);
                                        }

                                        const regionList = Object.keys(regionsMapping).sort();

                                        // Ensure active region is valid
                                        const currentActive = regionList.includes(activeRegion || "")
                                            ? activeRegion
                                            : (regionList.length > 0 ? regionList[0] : null);

                                        if (regionList.length === 0) {
                                            return <p className="text-muted-foreground italic text-sm px-1">Global Coverage</p>;
                                        }

                                        return (
                                            <>
                                                {/* Regions Tabs */}
                                                <div className="space-y-4">
                                                    <h4 className="text-[10px] font-bold text-muted-foreground tracking-widest px-1 text-slate-400">Regions Served</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {regionList.map((region) => (
                                                            <button
                                                                key={region}
                                                                onClick={() => setActiveRegion(region)}
                                                                className={`text-sm py-2 px-6 rounded-xl transition-all border-2 ${currentActive === region
                                                                    ? "bg-primary text-primary-foreground border-primary shadow-md transform scale-105"
                                                                    : "bg-muted/50 text-slate-600 border-transparent hover:bg-slate-200"
                                                                    }`}
                                                            >
                                                                {region}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Countries in Active Region */}
                                                {currentActive && (
                                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-[10px] font-bold text-muted-foreground tracking-widest px-1 text-slate-400">Markets in {currentActive}</h4>
                                                            <div className="h-px flex-1 bg-foreground/5"></div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {regionsMapping[currentActive].length === 0 ? (
                                                                <div className="p-6 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 w-full text-center">
                                                                    <p className="text-muted-foreground italic text-sm">
                                                                        Full coverage across all major markets within {currentActive}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                regionsMapping[currentActive].sort().map((country: string, idx: number) => (
                                                                    <Badge key={idx} variant="outline" className="text-sm py-2 px-5 rounded-xl border-foreground/10 bg-background hover:border-primary/30 transition-all font-semibold">
                                                                        {country}
                                                                    </Badge>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Representatives Section (listing-level only) */}
                {Array.isArray(item.companyRepresentatives) && item.companyRepresentatives.length > 0 && (
                    <div className="mb-12">
                        <Card className="rounded-3xl border-foreground/10 shadow-lg overflow-hidden border-2 border-slate-200">
                            <div className="bg-slate-50 px-8 py-6 border-b border-foreground/10">
                                <h3 className="text-lg font-black text-foreground tracking-tight tracking-wider">
                                    Representative(s)
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <tbody>
                                        {item.companyRepresentatives.map((rep: any, idx: number) => (
                                            <tr key={`${rep.email || "rep"}-${idx}`} className="border-b border-foreground/10 last:border-0 hover:bg-muted/5 transition-colors">
                                                <td className="px-8 py-5 text-sm font-medium text-foreground">{rep.firstName || "-"}</td>
                                                <td className="px-8 py-5 text-sm font-medium text-foreground">{rep.lastName || "-"}</td>
                                                <td className="px-8 py-5 text-sm">
                                                    {rep.email ? (
                                                        <a href={`mailto:${rep.email}`} className="text-primary underline underline-offset-4 hover:text-primary/80">
                                                            {rep.email}
                                                        </a>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}


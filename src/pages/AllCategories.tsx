import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { MapPin, Search, ExternalLink, Calendar, X, ChevronLeft, ChevronRight, ChevronDown, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { db } from "@/firebase";
import { collection, collectionGroup, query, getDocs, limit } from "firebase/firestore";
import {
    buildLiveListingKeySet,
    isListingStatusPublic,
    isPartnerListingPublic,
    resolveSpotlightPlacement,
    spotlightDisplayActive,
} from "@/lib/partnerListingPublic";
import { AutoCarousel } from "@/components/ui/auto-carousel";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toTitleCase, formatEventLocation, formatJobLocation } from "@/lib/utils";
import { matchCategoryOrSub } from "@/lib/categorySelection";

import { useDirectoryCategories } from "@/hooks/useDirectoryCategories";
import { useHealthAuthorities } from "@/hooks/useHealthAuthorities";
import {
    DEFAULT_BUSINESS_CATEGORIES as BUSINESS_CATEGORIES,
    DEFAULT_CONSULTING_CATEGORIES as CONSULTING_CATEGORIES,
    DEFAULT_EVENTS_CATEGORIES as EVENTS_CATEGORIES,
    DEFAULT_JOBS_CATEGORIES as JOBS_CATEGORIES,
    getSubLabel,
    hasSubSub,
    type SubcategoryEntry,
    type CategoriesDict,
} from "@/lib/defaultDirectoryCategories";
import { DEFAULT_HEALTH_AUTHORITIES as HEALTH_AUTHORITIES } from "@/lib/defaultHealthAuthorities";

export {
    BUSINESS_CATEGORIES,
    CONSULTING_CATEGORIES,
    EVENTS_CATEGORIES,
    JOBS_CATEGORIES,
    getSubLabel,
    hasSubSub,
    HEALTH_AUTHORITIES,
    type SubcategoryEntry,
    type CategoriesDict,
};

const CATEGORY_CONFIG = {
    business: {
        title: "Business Offerings",
        description: "Explore companies serving global life sciences markets across specialized categories."
    },
    consulting: {
        title: "Consulting Services",
        description: "From established consulting firms to independent specialists, find the right partner to advance your project."
    },
    events: {
        title: "Events",
        description: "Whether you're an industry leader, emerging entrepreneur, or passionate researcher, stay connected to the conversations and ideas moving life sciences forward."
    },
    jobs: {
        title: "Jobs",
        description: "Explore opportunities aligned with your goals and take the next step in your life sciences journey."
    },
    compliance: {
        title: "Global Health Authority Sites",
        description: "A structured gateway to health authority sites, all in one place."
    }
};

const BSL_FILTER_OPTIONS = ["1", "2", "3", "4"];


const WORK_MODELS = ["Hybrid", "Remote", "On-site"];


export default function AllCategories() {
    const { businessCategories, consultingCategories, eventsCategories, jobsCategories } = useDirectoryCategories();
    const { healthAuthorities } = useHealthAuthorities();
    const { category } = useParams<{ category: string }>();
    const [searchParams] = useSearchParams();
    const rawTab = (category || "business").toLowerCase();
    const currentTab =
        rawTab === "experts"
            ? "consulting"
            : rawTab === "business" ||
                rawTab === "consulting" ||
                rawTab === "events" ||
                rawTab === "jobs" ||
                rawTab === "compliance"
              ? rawTab
              : "business";

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // ── All three levels are now arrays (multi-select) ──
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
    const [selectedSubSubcategories, setSelectedSubSubcategories] = useState<string[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
    const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
    const [selectedBSL, setSelectedBSL] = useState<string[]>([]);
    
    // Job specific filters
    const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
    const [selectedWorkModels, setSelectedWorkModels] = useState<string[]>([]);
    const [jobLocationSearch, setJobLocationSearch] = useState("");
    const [sortBy, setSortBy] = useState<"recent" | "default">("default");


    const [healthAuthSearch, setHealthAuthSearch] = useState("");
    const [showAllCategories, setShowAllCategories] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 30;

    // ── Persistence Logic ──

    // Reset filters when switching category tab or search params (always show listing list, not category-only grid).
    useEffect(() => {
        const initialSearch = searchParams.get("search") || "";
        setSearchQuery(initialSearch);

        // Handle initial category from URL if present
        const initialCat = searchParams.get("cat");
        if (initialCat) {
            setSelectedCategories([initialCat]);
        } else {
            setSelectedCategories([]);
        }

        setSelectedSubcategories([]);
        setSelectedSubSubcategories([]);

        setViewMode("list");

        setCurrentPage(1);
    }, [currentTab, searchParams]);

    useEffect(() => {
        const fetchAllCategoriesData = async () => {
            setLoading(true);
            try {
                let docs: Array<{ doc: any; collectionName: string }> = [];
                const plansSnap = await getDocs(query(collectionGroup(db, "planCollection"), limit(10000)));
                const liveListingKeys = buildLiveListingKeySet(
                    plansSnap.docs.map((planDoc) => ({
                        path: planDoc.ref.path,
                        data: planDoc.data() as Record<string, unknown>,
                    })),
                );

                if (currentTab === "business") {
                    const q = query(collectionGroup(db, "businessOfferingsCollection"), limit(5000));
                    const snap = await getDocs(q);
                    docs = snap.docs.map((d) => ({ doc: d, collectionName: "businessOfferingsCollection" }));
                } else if (currentTab === "consulting") {
                    const [servicesSnap, legacySnap] = await Promise.all([
                        getDocs(query(collection(db, "consultingServicesCollection"), limit(5000))),
                        getDocs(query(collection(db, "consultingCollection"), limit(5000))),
                    ]);
                    docs = [
                        ...servicesSnap.docs.map((d) => ({ doc: d, collectionName: "consultingServicesCollection" })),
                        ...legacySnap.docs.map((d) => ({ doc: d, collectionName: "consultingCollection" })),
                    ];
                } else if (currentTab === "events") {
                    const q = query(collection(db, "eventsCollection"), limit(5000));
                    const snap = await getDocs(q);
                    docs = snap.docs.map((d) => ({ doc: d, collectionName: "eventsCollection" }));
                } else if (currentTab === "jobs") {
                    const q = query(collection(db, "jobsCollection"), limit(5000));
                    const snap = await getDocs(q);
                    docs = snap.docs.map((d) => ({ doc: d, collectionName: "jobsCollection" }));
                }

                if (docs.length > 0) {
                    // De-duplicate and only show records backed by a billing-live plan.
                    const deduped = new Map<string, any>();
                    docs.forEach(({ doc: d, collectionName }) => {
                        const raw = d.data() as Record<string, any>;
                        const partnerFromPath =
                            d.ref?.parent?.parent?.id && String(d.ref.parent.parent.path || "").includes("partnersCollection")
                                ? d.ref.parent.parent.id
                                : "";
                        const listing = { id: d.id, partnerId: raw.partnerId || partnerFromPath || "", ...raw };
                        if (!isPartnerListingPublic(listing, collectionName, liveListingKeys)) return;
                        const key = d.ref?.path || d.id;
                        if (!deduped.has(key)) {
                            deduped.set(key, listing);
                        }
                    });
                    const approvedDocs = Array.from(deduped.values()).filter((doc: any) => isListingStatusPublic(doc));
                    
                    // Sort by most recent if requested
                    if (sortBy === "recent") {
                        approvedDocs.sort((a, b) => {
                            const dateA = a.createdAt?.toDate?.() || a.createdAt?.seconds || 0;
                            const dateB = b.createdAt?.toDate?.() || b.createdAt?.seconds || 0;
                            return dateB - dateA;
                        });
                    }
                    
                    setData(approvedDocs);
                } else {
                    setData([]);
                }
            } catch (err) {
                console.error("Error fetching AllCategories:", err);
                setData([]);
            } finally {
                setLoading(false);
            }
        };
        fetchAllCategoriesData();
    }, [currentTab, sortBy]);

    const handleCloseModal = () => setSelectedProfile(null);

    // ── Toggle for top-level categories (now an array) ──
    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
        setCurrentPage(1);
    };

    const toggleSubcategory = (cat: string, sub: string) => {
        const compositeKey = `${cat} > ${sub}`;
        setSelectedSubcategories(prev => {
            const isChecked = prev.includes(compositeKey) || prev.includes(sub);
            return isChecked
                ? prev.filter(s => s !== compositeKey && s !== sub)
                : [...prev, compositeKey];
        });
        setCurrentPage(1);
    };

    const toggleSubSubcategory = (cat: string, sub: string, subSub: string) => {
        const compositeKey = `${cat} > ${sub} > ${subSub}`;
        setSelectedSubSubcategories(prev => {
            const isChecked = prev.includes(compositeKey) || prev.includes(subSub);
            return isChecked
                ? prev.filter(s => s !== compositeKey && s !== subSub)
                : [...prev, compositeKey];
        });
        setCurrentPage(1);
    };

    const toggleExpandCategory = (cat: string) => {
        setExpandedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const toggleExpandSubcategory = (cat: string, subLabel: string) => {
        const compositeKey = `${cat} > ${subLabel}`;
        setExpandedSubcategories(prev =>
            prev.includes(compositeKey) || prev.includes(subLabel)
                ? prev.filter(s => s !== compositeKey && s !== subLabel)
                : [...prev, compositeKey]
        );
    };

    const resetCategorySelection = () => {
        setSelectedCategories([]);
        setSelectedSubcategories([]);
        setSelectedSubSubcategories([]);

        setViewMode("list");
        setCurrentPage(1);
    };

    const toggleBSL = (bsl: string) => {
        setSelectedBSL(prev =>
            prev.includes(bsl) ? prev.filter(b => b !== bsl) : [...prev, bsl]
        );
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedSubcategories([]);
        setSelectedSubSubcategories([]);
        setSelectedBSL([]);
        setSelectedJobTypes([]);
        setSelectedWorkModels([]);
        setJobLocationSearch("");
        setCurrentPage(1);
    };

    const isMainCategoryTab = currentTab === "business" || currentTab === "consulting" || currentTab === "events" || currentTab === "jobs";
    const currentCategoriesDict = currentTab === "business" ? businessCategories : currentTab === "consulting" ? consultingCategories : currentTab === "events" ? eventsCategories : jobsCategories;
    const noFeaturedText = currentTab === "business" ? "No businesses available at the moment." : currentTab === "consulting" ? "No experts available at the moment." : currentTab === "events" ? "No events available at the moment." : "No jobs available at the moment.";

    const filteredHealthAuths = healthAuthorities.filter((auth) =>
        auth.country.toLowerCase().includes(healthAuthSearch.toLowerCase()) ||
        (auth.url && auth.url.toLowerCase().includes(healthAuthSearch.toLowerCase()))
    );

    const normalizeToken = (value: any) => (typeof value === "string" ? value.trim().toLowerCase() : "");

    const subToCategoryTokens = new Map<string, Set<string>>();
    const subSubToCategoryTokens = new Map<string, Set<string>>();
    Object.entries(currentCategoriesDict as CategoriesDict).forEach(([cat, entries]) => {
        const catToken = normalizeToken(cat);
        (entries || []).forEach((entry: SubcategoryEntry) => {
            const subToken = normalizeToken(getSubLabel(entry));
            if (subToken) {
                if (!subToCategoryTokens.has(subToken)) subToCategoryTokens.set(subToken, new Set<string>());
                subToCategoryTokens.get(subToken)!.add(catToken);
            }
            if (hasSubSub(entry) && Array.isArray(entry.subSubcategories)) {
                entry.subSubcategories.forEach((subSub) => {
                    const subSubToken = normalizeToken(subSub);
                    if (!subSubToken) return;
                    if (!subSubToCategoryTokens.has(subSubToken)) subSubToCategoryTokens.set(subSubToken, new Set<string>());
                    subSubToCategoryTokens.get(subSubToken)!.add(catToken);
                });
            }
        });
    });

    // ── Filter logic: all three levels use array state ──
    const filteredBusinesses = data.filter((item) => {
        const itemSubs: string[] = Array.isArray(item.selectedSubcategoriesDisplay)
            ? item.selectedSubcategoriesDisplay
            : Array.isArray(item.selectedSubcategories)
                ? item.selectedSubcategories
            : Array.isArray(item.subcategories)
                ? item.subcategories
                : [];
        const itemSubSubs: string[] = Array.isArray(item.selectedSubSubcategories)
            ? item.selectedSubSubcategories
            : Array.isArray(item.subSubcategories)
                ? item.subSubcategories
                : [];
        const itemCategories: string[] = Array.isArray(item.selectedCategoriesDisplay) && item.selectedCategoriesDisplay.length > 0
            ? item.selectedCategoriesDisplay
            : Array.isArray(item.selectedCategories) && item.selectedCategories.length > 0
                ? item.selectedCategories
            : Array.isArray(item.categories) && item.categories.length > 0
                ? item.categories
                : item.category
                    ? [item.category]
                    : item.consultingCategory
                        ? [item.consultingCategory]
                        : item.eventCategory
                            ? [item.eventCategory]
                            : item.jobCategory
                                ? [item.jobCategory]
                                : [];

        if (searchQuery.trim()) {
            const searchTerms = searchQuery.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            if (searchTerms.length === 0) return true;

            const matches = searchTerms.some(q => 
                item.businessName?.toLowerCase().includes(q) ||
                item.primaryName?.toLowerCase().includes(q) ||
                item.eventName?.toLowerCase().includes(q) ||
                item.jobTitle?.toLowerCase().includes(q) ||
                item.category?.toLowerCase().includes(q) ||
                item.businessCountry?.toLowerCase().includes(q) ||
                item.eventCountry?.toLowerCase().includes(q) ||
                item.jobCountry?.toLowerCase().includes(q) ||
                item.location?.toLowerCase().includes(q) ||
                item.city?.toLowerCase().includes(q) ||
                item.state?.toLowerCase().includes(q) ||
                item.jobtype?.toLowerCase().includes(q) ||
                item.workModel?.toLowerCase().includes(q) ||
                item.experienceLevel?.toLowerCase().includes(q) ||
                item.industry?.toLowerCase().includes(q) ||
                (Array.isArray(item.serviceCountries) &&
                    item.serviceCountries.some((c: string) =>
                        c.toLowerCase().includes(q)
                    )) ||
                (Array.isArray(item.categories) &&
                    item.categories.some((c: string) =>
                        c.toLowerCase().includes(q)
                    )) ||
                (Array.isArray(item.certifications) ? 
                    item.certifications.some((c: string) => c.toLowerCase().includes(q)) : 
                    (item.certifications || "").toLowerCase().includes(q)) ||
                item.selectedGroup?.toLowerCase().includes(q) ||
                itemSubs.some((s: string) => s.toLowerCase().includes(q)) ||
                itemSubSubs.some((s: string) => s.toLowerCase().includes(q))
            );

            if (!matches) return false;
        }
        if (!isMainCategoryTab) return true;

        // Category-tree filtering by selected branches.
        // If a top-level category is selected with no child selections in that branch,
        // include all items in that category.
        if (selectedCategories.length > 0) {
            const hasBranchMatch = selectedCategories.some((selCat) => {
                const itemMatchesCat = itemCategories.some(itemCat => matchCategoryOrSub(itemCat, selCat));
                if (!itemMatchesCat) return false;

                const selCatToken = normalizeToken(selCat);
                const subFiltersForCategory = selectedSubcategories.filter(sub => {
                    if (sub.includes(" > ")) return sub.split(" > ")[0] === selCat;
                    return subToCategoryTokens.get(normalizeToken(sub))?.has(selCatToken);
                });
                const subSubFiltersForCategory = selectedSubSubcategories.filter(ss => {
                    if (ss.includes(" > ")) return ss.split(" > ")[0] === selCat;
                    return subSubToCategoryTokens.get(normalizeToken(ss))?.has(selCatToken);
                });

                if (subFiltersForCategory.length === 0 && subSubFiltersForCategory.length === 0) {
                    return true;
                }

                const subMatch =
                    subFiltersForCategory.length === 0 ||
                    subFiltersForCategory.some((subFilter) => itemSubs.some(itemSub => matchCategoryOrSub(itemSub, subFilter)));
                const subSubMatch =
                    subSubFiltersForCategory.length === 0 ||
                    subSubFiltersForCategory.some((ssFilter) => itemSubSubs.some(itemSubSub => matchCategoryOrSub(itemSubSub, ssFilter)));

                return subMatch && subSubMatch;
            });
            if (!hasBranchMatch) return false;
        } else {
            // No top-level category selected: apply sub/sub-sub filters globally.
            if (selectedSubcategories.length > 0) {
                const hasMatchingSubcategory = selectedSubcategories.some((selSub) => itemSubs.some(itemSub => matchCategoryOrSub(itemSub, selSub)));
                if (!hasMatchingSubcategory) return false;
            }
            if (selectedSubSubcategories.length > 0) {
                const hasMatchingSubSubcategory = selectedSubSubcategories.some((selSubSub) => itemSubSubs.some(itemSubSub => matchCategoryOrSub(itemSubSub, selSubSub)));
                if (!hasMatchingSubSubcategory) return false;
            }
        }

        // ── BSL filter (business tab only) ──
        if (currentTab === "business" && selectedBSL.length > 0) {
            const itemBSLs: string[] = Array.isArray(item.bioSafetyLevel)
                ? item.bioSafetyLevel
                : item.bioSafetyLevel
                    ? [item.bioSafetyLevel]
                    : [];
            
            // Allow matching if the item's BSL contains the filter string (e.g., "BSL-1" includes "1")
            const hasMatchingBSL = selectedBSL.some(bsl =>
                itemBSLs.some(itemBsl => String(itemBsl).includes(bsl))
            );
            if (!hasMatchingBSL) return false;
        }

        // ── Job specific filters ──
        if (currentTab === "jobs") {
            if (selectedJobTypes.length > 0) {
                const itemJobType = item.jobtype || item.positionType;
                if (!itemJobType || !selectedJobTypes.includes(itemJobType)) return false;
            }
            if (selectedWorkModels.length > 0) {
                if (!item.workModel || !selectedWorkModels.includes(item.workModel)) return false;
            }
            if (jobLocationSearch.trim()) {
                const q = jobLocationSearch.toLowerCase();
                const matches = (item.city || "").toLowerCase().includes(q) || 
                                (item.stateRegion || "").toLowerCase().includes(q) || 
                                (item.location || "").toLowerCase().includes(q) ||
                                (item.state || "").toLowerCase().includes(q);
                if (!matches) return false;
            }
        }

        return true;
    });

    if (sortBy === "default") {
        filteredBusinesses.sort((a, b) => {
            const titleA = currentTab === "business" ? a.businessName : currentTab === "consulting" ? (a.primaryName || a.businessName || a.companyName || "") : currentTab === "events" ? a.eventName : a.jobTitle;
            const titleB = currentTab === "business" ? b.businessName : currentTab === "consulting" ? (b.primaryName || b.businessName || b.companyName || "") : currentTab === "events" ? b.eventName : b.jobTitle;
            return String(titleA || "").localeCompare(String(titleB || ""));
        });
    }

    const totalPages = Math.ceil(filteredBusinesses.length / itemsPerPage);
    const paginatedBusinesses = filteredBusinesses.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const featuredBusinesses = data.filter(item => {
        if (!spotlightDisplayActive(item)) return false;
        const addon = resolveSpotlightPlacement(item);
        // Premium Plus (events/jobs) is home-only — never land in the module Featured strip.
        if (addon === "home_page") return false;
        const isLandingSpotlight = addon === "landing_page" || addon === "both" || addon === "spotlight_addon";
        // Legacy isFeatured only when placement is unknown and this is not a home-only plan.
        const hasLegacyFeatureFlag = Boolean(item.isFeatured) && !addon;
        if (!isLandingSpotlight && !hasLegacyFeatureFlag) return false;
        return true;
    });
    // ── Sidebar: uses selectedCategories array everywhere ──
    const renderSidebarCategories = () => {
        if (currentTab !== "business") {
            return Object.entries(currentCategoriesDict as Record<string, string[]>).map(([cat, subs]) => {
                const isExpanded = expandedCategories.includes(cat);
                // FIX: check array, not single string
                const isSelectedCategory = selectedCategories.includes(cat);
                return (
                    <div key={cat} className="flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                            {subs.length > 0 ? (
                                <button onClick={() => toggleExpandCategory(cat)} className="mt-1 flex-shrink-0">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                </button>
                            ) : (
                                <span className="w-4 h-4 flex-shrink-0" />
                            )}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={cat}
                                    checked={isSelectedCategory}
                                    // FIX: use toggleCategory, not setSelectedCategory
                                    onCheckedChange={() => toggleCategory(cat)}
                                />
                                <label htmlFor={cat} className="text-sm font-medium leading-none cursor-pointer">{cat}</label>
                            </div>
                        </div>
                        {isExpanded && subs.length > 0 && (
                            <div className="pl-10 space-y-2 mb-2">
                                {subs.map(sub => {
                                    const compositeKey = `${cat} > ${sub}`;
                                    const isChecked = selectedSubcategories.includes(compositeKey) || selectedSubcategories.includes(sub);
                                    return (
                                        <div key={sub} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${cat}-${sub}`}
                                                checked={isChecked}
                                                onCheckedChange={() => toggleSubcategory(cat, sub)}
                                            />
                                            <label htmlFor={`${cat}-${sub}`} className="text-sm font-light leading-none cursor-pointer text-muted-foreground">{sub}</label>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            });
        }

        // Business tab — 3-level sidebar
        return Object.entries(currentCategoriesDict as CategoriesDict).map(([cat, subs]) => {
            const isExpanded = expandedCategories.includes(cat);
            // FIX: check array, not single string
            const isSelectedCategory = selectedCategories.includes(cat);
            return (
                <div key={cat} className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                        {subs.length > 0 ? (
                            <button onClick={() => toggleExpandCategory(cat)} className="mt-1 flex-shrink-0">
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </button>
                        ) : (
                            <span className="w-4 h-4 flex-shrink-0" />
                        )}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={cat}
                                checked={isSelectedCategory}
                                // FIX: use toggleCategory, not setSelectedCategory
                                onCheckedChange={() => toggleCategory(cat)}
                            />
                            <label htmlFor={cat} className="text-sm font-medium leading-none cursor-pointer">{cat}</label>
                        </div>
                    </div>

                    {isExpanded && subs.length > 0 && (
                        <div className="pl-10 space-y-2 mb-2">
                            {subs.map((entry) => {
                                const subLabel = getSubLabel(entry);
                                const isNested = hasSubSub(entry);
                                const compositeSubKey = `${cat} > ${subLabel}`;
                                const isSubExpanded = expandedSubcategories.includes(compositeSubKey) || expandedSubcategories.includes(subLabel);
                                const isSubChecked = selectedSubcategories.includes(compositeSubKey) || selectedSubcategories.includes(subLabel);

                                return (
                                    <div key={subLabel} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                            {isNested ? (
                                                <button onClick={() => toggleExpandSubcategory(cat, subLabel)} className="flex-shrink-0">
                                                    {isSubExpanded
                                                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                                </button>
                                            ) : (
                                                <span className="w-3.5 h-3.5 flex-shrink-0" />
                                            )}
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`${cat}-${subLabel}`}
                                                    checked={isSubChecked}
                                                    onCheckedChange={() => toggleSubcategory(cat, subLabel)}
                                                />
                                                <label htmlFor={`${cat}-${subLabel}`} className="text-sm font-light leading-none cursor-pointer text-muted-foreground">
                                                    {subLabel}
                                                </label>
                                            </div>
                                        </div>

                                        {isNested && isSubExpanded && (
                                            <div className="pl-6 space-y-1.5 mt-1">
                                                {entry.subSubcategories.map((subSub) => {
                                                    const compositeSsKey = `${cat} > ${subLabel} > ${subSub}`;
                                                    const isSsChecked = selectedSubSubcategories.includes(compositeSsKey) || selectedSubSubcategories.includes(subSub);
                                                    return (
                                                        <div key={subSub} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`${cat}-${subLabel}-${subSub}`}
                                                                checked={isSsChecked}
                                                                onCheckedChange={() => toggleSubSubcategory(cat, subLabel, subSub)}
                                                            />
                                                            <label htmlFor={`${cat}-${subLabel}-${subSub}`} className="text-xs font-light leading-none cursor-pointer text-muted-foreground/80">
                                                                {subSub}
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
    };

    const toggleJobType = (type: string) => {
        setSelectedJobTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
        setCurrentPage(1);
    };

    const toggleWorkModel = (model: string) => {
        setSelectedWorkModels(prev => prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]);
        setCurrentPage(1);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-background w-full">
            <div className="bg-muted/40 py-12">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl font-bold tracking-tight mb-4">
                        {CATEGORY_CONFIG[currentTab as keyof typeof CATEGORY_CONFIG]?.title || "Areas"}
                    </h1>

                    <p className="text-muted-foreground text-lg max-w-2xl">
                        {CATEGORY_CONFIG[currentTab as keyof typeof CATEGORY_CONFIG]?.description}
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 mt-8 flex-1">
                <div className={`w-full mb-10 flex flex-col items-center gap-4 ${currentTab === "jobs" ? "lg:flex-row" : "max-w-4xl mx-auto md:flex-row"}`}>
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                        {currentTab === "compliance" ? (
                            <Input
                                placeholder="Search for a country..."
                                value={healthAuthSearch}
                                onChange={(e) => setHealthAuthSearch(e.target.value)}
                                className="pl-12 py-6 text-lg rounded-2xl border-foreground/10 bg-background shadow-sm w-full"
                            />
                        ) : (
                            <Input
                                placeholder={currentTab === "business" ? "Search by company name, certification, country, or category" : currentTab === "consulting" ? "Search by company name, country, or category" : currentTab === "events" ? "Search by event name, country, or category" : "Search by job title, location, job type, country, or category"}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-12 py-6 text-lg rounded-2xl border-foreground/10 bg-background shadow-sm w-full"
                            />
                        )}
                    </div>

                    {currentTab === "jobs" && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-[52px] px-6 py-6 text-lg rounded-2xl border-foreground/10 bg-background shadow-sm hover:bg-foreground/5 flex items-center gap-3 min-w-[200px] justify-between transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-muted-foreground">{selectedWorkModels.length > 0 ? selectedWorkModels.join(", ") : "Work Model"}</span>
                                    </div>
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px] rounded-xl p-2 bg-background border-foreground/10 shadow-xl">
                                {WORK_MODELS.map(model => (
                                    <DropdownMenuItem
                                        key={model}
                                        onClick={(e) => { e.preventDefault(); toggleWorkModel(model); }}
                                        className="p-3 cursor-pointer rounded-lg mb-1 focus:bg-primary/10 flex items-center gap-2"
                                    >
                                        <Checkbox 
                                            checked={selectedWorkModels.includes(model)} 
                                            className="pointer-events-none" 
                                        />
                                        <span>{model}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-[52px] px-6 py-6 text-lg rounded-2xl border-foreground/10 bg-background shadow-sm hover:bg-foreground/5 flex items-center gap-3 min-w-[200px] justify-between transition-colors">
                                <span className="font-medium">{CATEGORY_CONFIG[currentTab as keyof typeof CATEGORY_CONFIG]?.title || "Areas"}</span>
                                <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[280px] rounded-xl p-2 bg-background border-foreground/10 shadow-xl">
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg mb-1 focus:bg-primary/10">
                                <Link to="/all-categories/business" onClick={resetCategorySelection} className="flex items-center w-full">
                                    <span className="font-medium text-base">Business Offerings</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg mb-1 focus:bg-primary/10">
                                <Link to="/all-categories/consulting" onClick={resetCategorySelection} className="flex items-center w-full">
                                    <span className="font-medium text-base">Consulting Services</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg mb-1 focus:bg-primary/10">
                                <Link to="/all-categories/events" onClick={resetCategorySelection} className="flex items-center w-full">
                                    <span className="font-medium text-base">Events</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg mb-1 focus:bg-primary/10">
                                <Link to="/all-categories/jobs" onClick={resetCategorySelection} className="flex items-center w-full">
                                    <span className="font-medium text-base">Jobs</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg focus:bg-primary/10">
                                <Link to="/all-categories/compliance" onClick={resetCategorySelection} className="flex items-center w-full">
                                    <span className="font-medium text-base">Global Health Authority Sites</span>
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {currentTab === "jobs" && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Sort by:</span>
                            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                                <SelectTrigger className="w-[140px] h-[52px] rounded-2xl border-foreground/10 bg-background shadow-sm">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-foreground/10 shadow-xl">
                                    <SelectItem value="recent">Most recent</SelectItem>
                                    <SelectItem value="default">Default</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* BSL filter pills — Business Offerings only */}
                {currentTab === "business" && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-xs font-semibold text-muted-foreground tracking-widest mr-1 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> BSL Level:
                        </span>
                        {BSL_FILTER_OPTIONS.map(bsl => (
                            <button
                                key={bsl}
                                onClick={() => toggleBSL(bsl)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                    selectedBSL.includes(bsl)
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-background text-foreground border-foreground/15 hover:border-primary/40 hover:bg-primary/5"
                                }`}
                            >
                                {selectedBSL.includes(bsl) && <X className="w-3 h-3" />}
                                BSL-{bsl}
                            </button>
                        ))}
                        {selectedBSL.length > 0 && (
                            <button onClick={() => setSelectedBSL([])} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors ml-1">
                                Clear
                            </button>
                        )}
                    </div>
                )}

                {/* Job filter pills */}
                {currentTab === "jobs" && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        {selectedJobTypes.length > 0 && selectedJobTypes.map(type => (
                            <button key={type} onClick={() => toggleJobType(type)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-sm">
                                <X className="w-3 h-3" /> {type}
                            </button>
                        ))}
                        {selectedWorkModels.length > 0 && selectedWorkModels.map(model => (
                            <button key={model} onClick={() => toggleWorkModel(model)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary-foreground border border-foreground/10 shadow-sm">
                                <X className="w-3 h-3" /> {model}
                            </button>
                        ))}
                    </div>
                )}

                {/* Active filter chips */}
                {isMainCategoryTab && (selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedSubSubcategories.length > 0) && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {selectedCategories.map(s => (
                            <span key={s} onClick={() => toggleCategory(s)} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-primary text-primary-foreground cursor-pointer hover:bg-primary/80 transition-colors">
                                {s.split(" > ").pop()} <X className="w-3 h-3" />
                            </span>
                        ))}
                        {selectedSubcategories.map(s => {
                            const parts = s.split(" > ");
                            const leaf = parts[parts.length - 1];
                            return (
                                <span key={s} onClick={() => {
                                    if (parts.length >= 2) toggleSubcategory(parts[0], parts[1]);
                                    else toggleSubcategory("", s);
                                }} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors">
                                    {leaf} <X className="w-3 h-3" />
                                </span>
                            );
                        })}
                        {selectedSubSubcategories.map(s => {
                            const parts = s.split(" > ");
                            const leaf = parts[parts.length - 1];
                            return (
                                <span key={s} onClick={() => {
                                    if (parts.length >= 3) toggleSubSubcategory(parts[0], parts[1], parts[2]);
                                    else toggleSubSubcategory("", "", s);
                                }} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-secondary/10 text-secondary-foreground border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors">
                                    {leaf} <X className="w-3 h-3" />
                                </span>
                            );
                        })}
                        <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                            Clear all
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground">Loading {currentTab}...</div>
                ) : isMainCategoryTab && viewMode === "grid" ? (
                    <div className="flex flex-col gap-16 pb-24 w-full max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {(showAllCategories
                                ? Object.keys(currentCategoriesDict)
                                : Object.keys(currentCategoriesDict).slice(0, 11)
                            )
                                .filter(cat =>
                                    cat.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                                .map((catName) => (<div
                                    key={catName}
                                    onClick={() => { toggleCategory(catName); setViewMode("list"); }}
                                    className="p-6 border border-foreground/10 hover:border-primary/50 transition-all rounded-xl shadow-sm hover:shadow-md bg-background cursor-pointer flex flex-col justify-center items-center text-center min-h-[120px] group"
                                >
                                    <span className="font-medium text-sm md:text-base group-hover:text-primary transition-colors">{catName}</span>
                                </div>
                                ))}
                            {!showAllCategories && Object.keys(currentCategoriesDict).length > 11 && (
                                <div onClick={() => setShowAllCategories(true)} className="p-6 border-2 border-dashed border-primary/30 hover:border-primary/60 text-primary hover:bg-primary/5 transition-all rounded-xl shadow-sm cursor-pointer flex flex-col justify-center items-center text-center min-h-[120px]">
                                    <span className="font-bold text-sm md:text-base inline-flex items-center gap-2">View All {Object.keys(currentCategoriesDict).length} Areas <ChevronDown className="w-4 h-4" /></span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : isMainCategoryTab && viewMode === "list" ? (
                    <div className="flex flex-col md:flex-row gap-8 pb-24">
                        <div className="w-full md:w-72 shrink-0 space-y-6">
                            <div className="space-y-4">

                                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {renderSidebarCategories()}
                                </div>


                            </div>
                        </div>

                        <div className="flex-1">
                            {filteredBusinesses.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">
                                    No companies matched your criteria.
                                </div>
                            ) : (
                                <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {paginatedBusinesses.map((item) => {
                                        const rawTitle = currentTab === "business" ? item.businessName : currentTab === "consulting" ? (item.primaryName || item.businessName || item.companyName || "Consulting Listing") : currentTab === "events" ? item.eventName : item.jobTitle;
                                        const title = rawTitle || "";
                                        const bslDisplay = Array.isArray(item.bioSafetyLevel) ? [...item.bioSafetyLevel].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).join(", ") : item.bioSafetyLevel;
                                        const topLabel = currentTab === "business" ? (bslDisplay && bslDisplay !== "N/A" ? `BSL: ${bslDisplay}` : null) : currentTab === "consulting" ? `Location: ${item.businessCountry || "N/A"}` : currentTab === "events" ? `Date: ${item.startDate || "TBA"}` : formatJobLocation(item.city, item.stateRegion || item.state);
                                        const certsRawArray = Array.isArray(item.certifications)
                                            ? item.certifications.flatMap((c: any) => typeof c === 'string' ? c.split(',').map((s: string) => s.trim()) : [c])
                                            : (typeof item.certifications === 'string'
                                                ? item.certifications.split(',').map((s: string) => s.trim())
                                                : (item.certifications ? [item.certifications] : []));
                                        const certsArray = Array.from(new Set(certsRawArray.filter(Boolean)));
                                        certsArray.sort((a, b) => String(a).localeCompare(String(b)));
                                        const certsDisplay = certsArray.slice(0, 3).join(", ");
                                        const bottomLabel = currentTab === "business"
                                            ? (certsDisplay ? certsDisplay : null)
                                            : currentTab === "consulting" ? (item.focusArea || "Consultant")
                                                : currentTab === "events" ? formatEventLocation(item.city || item.eventCity, item.stateRegion || item.state || item.eventStateRegion)
                                                    : `${item.businessName || "Company"} • ${toTitleCase(item.jobtype || "Role")}`;

                                        const hasFooterInfo = currentTab !== "consulting" && Boolean(topLabel || bottomLabel);

                                        return (
                                            <Link
                                                key={currentTab === "business" ? `${item.partnerId || "na"}-${item.id}` : item.id}
                                                to={`/listing/${currentTab}/${item.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group rounded-xl border border-foreground/10 bg-background hover:bg-foreground/5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col h-[320px]"
                                            >
                                                <div className="p-6 flex-1 flex items-center justify-center bg-background text-center relative overflow-hidden">
                                                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-3">{title}</h3>
                                                </div>
                                                {hasFooterInfo && (
                                                    <div className="p-4 bg-muted/40 flex flex-col items-center justify-center h-24 border-t border-foreground/10">
                                                        {topLabel && <div className="text-xs font-semibold text-foreground tracking-wider mb-1">{topLabel}</div>}
                                                        {bottomLabel && <div className="text-xs text-muted-foreground line-clamp-1">{bottomLabel}</div>}
                                                    </div>
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex justify-center items-center gap-2 mt-12 pb-8">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                                setCurrentPage(prev => Math.max(prev - 1, 1));
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            disabled={currentPage === 1}
                                            className="rounded-xl"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>

                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(page => {
                                                    // Show first, last, and pages around current
                                                    return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                                                })
                                                .map((page, index, array) => (
                                                    <div key={page} className="flex items-center gap-1">
                                                        {index > 0 && array[index - 1] !== page - 1 && (
                                                            <span className="text-muted-foreground px-1">...</span>
                                                        )}
                                                        <Button
                                                            variant={currentPage === page ? "default" : "outline"}
                                                            onClick={() => {
                                                                setCurrentPage(page);
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className="w-10 h-10 rounded-xl"
                                                        >
                                                            {page}
                                                        </Button>
                                                    </div>
                                                ))}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                                setCurrentPage(prev => Math.min(prev + 1, totalPages));
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            disabled={currentPage === totalPages}
                                            className="rounded-xl"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                        </div>
                    </div>
                ) : currentTab === "compliance" ? (
                    <div className="flex-1 max-w-7xl mx-auto w-full pb-24 flex flex-col items-center">
                        {filteredHealthAuths.length > 0 ? (
                            <div className="w-full columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
                                {filteredHealthAuths.map((auth, index) => (
                                    <a key={auth.id || `${auth.country}-${index}`} href={auth.url} target="_blank" rel="noopener noreferrer" className="break-inside-avoid shadow-xs hover:shadow-md border border-foreground/10 hover:border-primary/50 bg-background p-4 rounded-xl flex items-center justify-between group transition-all">
                                        <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate pr-4">{auth.country}</span>
                                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <div className="w-full flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-2xl min-h-[200px]">
                                <Search className="w-8 h-8 mb-4 text-muted-foreground/50" />
                                <p className="text-lg font-medium text-foreground mb-1">No countries found</p>
                                <p>We couldn't find any health authorities matching "{healthAuthSearch}"</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">
                        {data.length === 0 ? "No listings found for this category right now. Check back soon." : "We're currently assembling listings for this category."}
                    </div>
                )}
            </div>

            {isMainCategoryTab && (
                <div className="w-full bg-muted/10 py-16">
                    <div className="container mx-auto px-4">
                        <div className="flex flex-col items-center overflow-hidden w-full">
                            {featuredBusinesses.length > 0 ? (
                                <div className="relative flex w-full">
                                    <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                                    <AutoCarousel speed={50} direction={currentTab === "jobs" || currentTab === "consulting" ? "right" : "left"} innerClassName="gap-6 px-3 py-4">
                                        {featuredBusinesses.map((fb, i) => {
                                            if (currentTab === "events") {
                                                const dateObj = new Date(fb.startDate);
                                                const month = isNaN(dateObj.getTime()) ? "" : dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                                                const day = isNaN(dateObj.getTime()) ? "" : dateObj.getUTCDate();
                                                return (
                                                    <Link
                                                        to={`/listing/events/${fb.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        key={`evt-${fb.id}-${i}`}
                                                        className="flex flex-col sm:flex-row overflow-hidden bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group min-w-[380px] max-w-[380px] h-[150px] shrink-0 text-left"
                                                    >
                                                        <div className="w-20 shrink-0 bg-foreground/5 group-hover:bg-foreground/10 flex flex-col items-center justify-center p-3 border-r border-foreground/10 transition-colors">
                                                            <span className="text-xs font-semibold text-muted-foreground tracking-widest">{month}</span>
                                                            <span className="text-2xl font-extrabold text-foreground">{day}</span>
                                                        </div>
                                                        <div className="flex flex-col p-4 w-full">
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 gap-2 sm:gap-4">
                                                                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 truncate">
                                                                    <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{formatEventLocation(fb.city, fb.stateRegion || fb.state)}</span>
                                                                </div>
                                                            </div>
                                                            <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-2 leading-tight">{fb.eventName || ""}</h3>
                                                            <div className="mt-auto pt-2 border-t border-foreground/10 flex items-center justify-between text-muted-foreground group-hover:text-foreground font-medium text-xs w-full transition-colors">
                                                                <span>View Event</span>
                                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                            </div>
                                                        </div>
                                                    </Link>
                                                );
                                            }

                                            if (currentTab === "jobs") {
                                                return (
                                                    <Link
                                                        to={`/listing/jobs/${fb.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        key={`job-${fb.id}-${i}`}
                                                        className="flex flex-col p-5 bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group min-w-[340px] max-w-[340px] h-[150px] shrink-0 text-left"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="text-[11px] font-medium text-muted-foreground tracking-wider border border-foreground/15 bg-foreground/5 rounded-full px-2.5 py-0.5 w-fit">
                                                                {fb.workModel || "Job Opening"}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                                                <MapPin className="w-3 h-3" /> {formatJobLocation(fb.city, fb.stateRegion || fb.state)}
                                                            </div>
                                                        </div>
                                                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-2 leading-tight">{fb.jobTitle || ""}</h3>
                                                        <div className="mt-auto pt-3 border-t border-foreground/10 flex items-center justify-between text-muted-foreground group-hover:text-foreground font-medium text-xs w-full transition-colors">
                                                            <span>View Job</span>
                                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                        </div>
                                                    </Link>
                                                );
                                            }

                                            return (
                                                <Link
                                                    to={`/listing/${currentTab}/${fb.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    key={`${currentTab === "business" ? `${fb.partnerId || "na"}-` : ""}${fb.id}-${i}`}
                                                    className="flex items-center justify-center text-center min-w-[260px] max-w-[260px] p-5 h-24 bg-background border border-foreground/10 rounded-xl shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group shrink-0"
                                                >
                                                    <h3 className="text-base md:text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                                                        {currentTab === "consulting" ? (fb.businessName || fb.companyName || fb.primaryName || "Consulting Listing") : (fb.businessName || fb.companyName || "")}
                                                    </h3>
                                                </Link>
                                            );
                                        })}
                                    </AutoCarousel>
                                </div>
                            ) : (
                                <div className="text-muted-foreground">{noFeaturedText}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={handleCloseModal}>
                    <div className="bg-background border border-foreground/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-foreground/10 bg-foreground/5">
                            <h2 className="text-2xl font-bold">Details</h2>
                            <Button variant="ghost" size="icon" onClick={handleCloseModal}><X className="w-5 h-5" /></Button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            {(currentTab === 'business' || currentTab === 'consulting') && (
                                <>
                                    <div className="flex items-start gap-4">
                                        {(selectedProfile.companyLogoUrl || selectedProfile.logoUrl) && (
                                            <div className="w-16 h-16 rounded-xl border border-foreground/10 p-1 shrink-0 bg-background flex items-center justify-center overflow-hidden">
                                                <img src={selectedProfile.companyLogoUrl || selectedProfile.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-bold text-primary">{currentTab === 'consulting' ? (selectedProfile.primaryName || selectedProfile.businessName) : selectedProfile.businessName}</h3>
                                            {(selectedProfile.businessCountry || selectedProfile.eventCountry || selectedProfile.jobCountry) && (
                                                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                                                    <MapPin className="w-4 h-4" /> {selectedProfile.businessCountry || selectedProfile.eventCountry || selectedProfile.jobCountry}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                            <p className="text-xs text-muted-foreground mb-1">Focus</p>
                                            <p className="font-semibold capitalize">{selectedProfile.selectedGroup?.replace(/_/g, ' ') || selectedProfile.focusArea || "N/A"}</p>
                                        </div>
                                        <div className="bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                            <p className="text-xs text-muted-foreground mb-1">Classification</p>
                                            <p className="font-semibold capitalize">{selectedProfile.selectedPlan?.replace(/_/g, ' ') || selectedProfile.planId?.replace(/_/g, ' ') || "N/A"}</p>
                                        </div>
                                    </div>
                                    {(Array.isArray(selectedProfile.selectedSubcategoriesDisplay) && selectedProfile.selectedSubcategoriesDisplay.length > 0) ||
                                    (Array.isArray(selectedProfile.selectedSubcategories) && selectedProfile.selectedSubcategories.length > 0) ? (
                                        <div>
                                            <p className="font-bold mb-2 text-sm text-muted-foreground tracking-wider">Specializations</p>
                                            <div className="flex flex-wrap gap-2">
                                                {(selectedProfile.selectedSubcategoriesDisplay || selectedProfile.selectedSubcategories || []).map((s: string, i: number) => (
                                                    <span key={i} className="bg-foreground/10 px-3 py-1 rounded-full text-xs">{s.split(" > ").pop()}</span>
                                                ))}
                                                {Array.isArray(selectedProfile.selectedSubSubcategories) && selectedProfile.selectedSubSubcategories.map((s: string, i: number) => (
                                                    <span key={`ss-${i}`} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs">{s.split(" > ").pop()}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    {selectedProfile.companyProfileText && (
                                        <div>
                                            <p className="font-bold mb-2">{currentTab === 'consulting' ? "Expert Profile" : "Company Overview"}</p>
                                            <p className="text-muted-foreground leading-relaxed">{selectedProfile.companyProfileText}</p>
                                        </div>
                                    )}
                                    {Array.isArray(selectedProfile.serviceCountries) && selectedProfile.serviceCountries.length > 0 && (
                                        <div>
                                            <p className="font-bold mb-2 text-sm text-muted-foreground tracking-wider">Service Countries</p>
                                            <p className="text-muted-foreground text-sm">{selectedProfile.serviceCountries.join(", ")}</p>
                                        </div>
                                    )}
                                </>
                            )}
                            {currentTab === 'jobs' && (
                                <>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-bold text-primary">{selectedProfile.jobTitle}</h3>
                                        <p className="text-lg text-muted-foreground font-medium">{selectedProfile.businessName} • {selectedProfile.industry}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <p className="text-sm"><span className="text-muted-foreground mr-2">Location:</span>{selectedProfile.city}, {selectedProfile.state}</p>
                                        <p className="text-sm"><span className="text-muted-foreground mr-2">Work Model:</span>{selectedProfile.workModel}</p>
                                        <p className="text-sm"><span className="text-muted-foreground mr-2">Experience:</span>{selectedProfile.experienceLevel}</p>
                                        <p className="text-sm"><span className="text-muted-foreground mr-2">Type:</span>{selectedProfile.jobtype}</p>
                                    </div>
                                    {selectedProfile.jobSummary && (
                                        <div>
                                            <p className="font-bold mb-2">Role Summary</p>
                                            <p className="text-muted-foreground leading-relaxed">{selectedProfile.jobSummary}</p>
                                        </div>
                                    )}
                                </>
                            )}
                            {currentTab === 'events' && (
                                <>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-bold text-primary">{selectedProfile.eventName}</h3>
                                        <p className="text-lg font-medium text-muted-foreground flex items-center gap-2"><Calendar className="w-5 h-5" /> {selectedProfile.startDate}</p>
                                    </div>
                                    <div className="bg-muted/40 p-4 rounded-lg border border-foreground/10 grid grid-cols-3 gap-4">
                                        <div><p className="text-xs text-muted-foreground mb-1">City</p><p className="font-semibold">{selectedProfile.city || "N/A"}</p></div>
                                        <div><p className="text-xs text-muted-foreground mb-1">State/Region</p><p className="font-semibold">{selectedProfile.stateRegion || selectedProfile.state || "N/A"}</p></div>
                                        <div><p className="text-xs text-muted-foreground mb-1">Country</p><p className="font-semibold">{selectedProfile.eventCountry || selectedProfile.country || "N/A"}</p></div>
                                    </div>
                                    {selectedProfile.categories && (
                                        <div>
                                            <p className="font-bold mb-2">Topics & Areas</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedProfile.categories.map((c: string, j: number) => (
                                                    <span key={j} className="bg-foreground/10 px-3 py-1 rounded-full text-sm">{c}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-foreground/10 bg-black/20 flex gap-4">
                            <Button className="w-full" size="lg">Contact / Proceed</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

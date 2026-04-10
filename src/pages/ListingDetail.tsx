import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "@/firebase";
import { doc, getDoc, collectionGroup, query, where, getDocs, limit } from "firebase/firestore";
import { MapPin, ArrowLeft, ShieldCheck, Phone, ExternalLink, Building2, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_CATEGORIES, CONSULTING_CATEGORIES } from "./AllCategories";
import { REGION_COUNTRY_MAP } from "@/constants/regions";

// Simple skeleton placeholder
const Skeleton = ({ className }: { className: string }) => <div className={`animate-pulse bg-muted rounded ${className}`} />;

export default function ListingDetail() {
    const BUSINESS_LOOKUP_LIMIT = 10000;
    const { type, id } = useParams<{ type: string; id: string }>();
    const [item, setItem] = useState<any>(null);
    const [partner, setPartner] = useState<any>(null);
    const [loading, setLoading] = useState(true);
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
                    for (const collectionName of collectionNames) {
                        if (type === "business") {
                            const q = query(collectionGroup(db, collectionName), where("active", "==", true), limit(BUSINESS_LOOKUP_LIMIT));
                            const querySnap = await getDocs(q);
                            const found = querySnap.docs.find((d) => d.id === id);
                            if (found) {
                                docSnap = found;
                                break;
                            }

                            // Fallback for legacy records stored in top-level collections.
                            const directBusinessRef = doc(db, collectionName, id);
                            const directBusinessSnap = await getDoc(directBusinessRef);
                            if (directBusinessSnap.exists() && directBusinessSnap.data()?.active !== false) {
                                docSnap = directBusinessSnap;
                                break;
                            }
                        } else {
                            const directRef = doc(db, collectionName, id);
                            const directSnap = await getDoc(directRef);
                            if (directSnap.exists() && directSnap.data()?.active !== false) {
                                docSnap = directSnap;
                                break;
                            }
                        }
                    }

                    if (docSnap && docSnap.exists()) {
                        const listingData: any = { id: docSnap.id, ...docSnap.data() };
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

    const listingTitle = type === "business" ? item.businessName : type === "consulting" ? (item.primaryName || item.businessName) : type === "events" ? item.eventName : item.jobTitle;
    const normalizeToken = (value: any) => (typeof value === "string" ? value.trim().toLowerCase() : "");
    const explicitCategoryTokens = new Set(
        (Array.isArray(item.selectedCategories) ? item.selectedCategories : []).map(normalizeToken).filter(Boolean)
    );

    // Helper to group subcategories by Area
    const getGroupedCategories = () => {
        if (type !== "business" && type !== "consulting") return [];
        
        // Comprehensive fallbacks for different field names used in Firestore
        const selectedAreas = Array.isArray(item.selectedCategoriesDisplay) ? item.selectedCategoriesDisplay :
                              (Array.isArray(item.selectedCategories) ? item.selectedCategories : 
                              (Array.isArray(item.categories) ? item.categories :
                              (item.category ? [item.category] : 
                              (item.consultingCategory ? [item.consultingCategory] : []))));

        const allSelectedSubs = Array.isArray(item.selectedSubcategoriesDisplay) ? item.selectedSubcategoriesDisplay :
            (Array.isArray(item.selectedSubcategories) ? item.selectedSubcategories :
                (Array.isArray(item.subcategories) ? item.subcategories : []));
        const allSelectedSubSubs = Array.isArray(item.selectedSubSubcategories) ? item.selectedSubSubcategories :
            (Array.isArray(item.subSubcategories) ? item.subSubcategories : []);

        const serviceRegions = Array.isArray(item.serviceRegions) ? item.serviceRegions : [];
        const serviceCountries = Array.isArray(item.serviceCountries) ? item.serviceCountries : [];

        // Track claimed items for orphan detection
        const claimedSubs = new Set<string>();
        const claimedSubSubs = new Set<string>();

        const normalize = (s: any) => (typeof s === 'string' ? s.toLowerCase().trim() : "");

        const categoriesDict = type === "business" ? BUSINESS_CATEGORIES : CONSULTING_CATEGORIES;

        const grouped = (selectedAreas as string[]).map(area => {
            const areaConfig = (categoriesDict as any)[area] || [];
            const matchingSubs = areaConfig.map((entry: any) => {
                const subLabel = typeof entry === "string" ? entry : entry.label;
                
                // Flexible matching
                const isSubSelected = allSelectedSubs.some((s: string) => normalize(s) === normalize(subLabel));
                if (isSubSelected) claimedSubs.add(normalize(subLabel));

                let subSubItems: string[] = [];
                if (typeof entry !== "string" && entry.subSubcategories) {
                    subSubItems = entry.subSubcategories.filter(ss => 
                        allSelectedSubSubs.some((selectedSS: string) => normalize(selectedSS) === normalize(ss))
                    );
                    subSubItems.forEach(ss => claimedSubSubs.add(normalize(ss)));
                }

                if (isSubSelected || subSubItems.length > 0) {
                    const originalSubLabel = allSelectedSubs.find((s: string) => normalize(s) === normalize(subLabel)) || subLabel;
                    return { label: originalSubLabel, subSubs: subSubItems };
                }
                return null;
            }).filter(Boolean);

            return { area, subs: matchingSubs, regions: serviceRegions, countries: serviceCountries };
        });

        // Show selected sub/sub-sub values even when taxonomy mapping is mismatched.
        const orphanSubs = allSelectedSubs.filter((sub: string) => !claimedSubs.has(normalize(sub)));
        const orphanSubSubs = allSelectedSubSubs.filter((subSub: string) => !claimedSubSubs.has(normalize(subSub)));
        if (orphanSubs.length > 0 || orphanSubSubs.length > 0) {
            const orphanEntries = orphanSubs.map((sub: string) => ({ label: sub, subSubs: [] as string[] }));
            if (orphanSubSubs.length > 0) {
                orphanEntries.push({ label: "Additional specializations", subSubs: orphanSubSubs });
            }
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
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-12 max-w-7xl pt-32">
                <Button asChild variant="ghost" className="mb-8 -ml-4 text-muted-foreground hover:text-primary transition-colors group rounded-full">
                    <Link to={`/all-categories/${type || 'business'}`}>
                        <ArrowLeft className="mr-2 w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to {type === 'business' ? 'Business Offerings' : type === 'consulting' ? 'Consulting' : (type || '').charAt(0).toUpperCase() + (type || '').slice(1)}
                    </Link>
                </Button>

                {/* Main Profile Header Section */}
                <Card className="rounded-3xl border-foreground/10 shadow-xl overflow-hidden mb-12">
                    <div className="bg-muted/30 p-8 md:p-12">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            {/* Company Logo or Icon */}
                            <div className="w-24 h-24 rounded-2xl bg-background border border-foreground/10 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                                {partner?.logoUrl || item.logoUrl ? (
                                    <img src={partner?.logoUrl || item.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <Building2 className="w-12 h-12 text-primary/40" />
                                )}
                            </div>

                            <div className="flex-1 space-y-4 w-full">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">{listingTitle}</h1>
                                    {item.isFeatured && (
                                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold uppercase tracking-wider text-[10px] px-3 py-1 rounded-full flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" /> Featured
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-muted-foreground text-lg leading-relaxed max-w-4xl">
                                    {item.companyProfileText || partner?.companyProfileText || "No company profile available."}
                                </p>

                                {type === "business" && (
                                    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-2">
                                        {/* Certifications & BSL are business-only fields */}
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Certifications</span>
                                            <p className="text-sm font-semibold capitalize text-foreground">
                                                {Array.isArray(item.certifications) ? item.certifications.join(", ") : item.certifications || partner?.certifications || "N/A"}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">BSL Level</span>
                                            <p className="text-sm font-semibold text-foreground">
                                                {Array.isArray(item.bioSafetyLevel) ? item.bioSafetyLevel.join(", ") : item.bioSafetyLevel || partner?.bioSafetyLevel || "N/A"}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-6 text-sm text-muted-foreground">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                            <span>{item.businessCountry || item.eventCountry || item.jobCountry || partner?.businessCountry || "N/A"}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-primary shrink-0" />
                                            <span>{item.businessPhoneNumber || item.phoneNumber || partner?.businessPhoneNumber || partner?.phoneNumber || "N/A"}</span>
                                        </div>
                                    </div>
                                    
                                </div>
                                <div className="flex flex-wrap justify-start items-center gap-4 pt-4 border-t border-foreground/10">
                                    <Button asChild variant="outline" size="lg" className="rounded-xl shadow-sm border-primary text-primary hover:bg-primary/10 hover:text-primary px-6 font-bold transition-all">
                                        <a href={item.companyWebsite || partner?.companyWebsite || "#"} target="_blank" rel="noopener noreferrer">
                                            Visit Website <ExternalLink className="ml-2 w-4 h-4" />
                                        </a>
                                    </Button>
                                    <Button asChild size="lg" className="rounded-xl shadow-lg bg-[#0077b5] hover:bg-[#005a8c] border-none px-6 font-bold text-white transition-all">
                                        <a href={item.linkedInProfileLink || partner?.linkedInProfileLink || "#"} target="_blank" rel="noopener noreferrer">
                                            <Linkedin className="mr-2 w-4 h-4" /> LinkedIn
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Tier 1 & 2: Categories & Subcategories Table */}
                {(type === "business" || type === "consulting") && groupedCategories.length > 0 && (
                    <div className="mb-12">
                        <Card className="rounded-3xl border-foreground/10 shadow-lg overflow-hidden">
                            <div className="bg-muted/30 px-8 py-5 border-b border-foreground/10">
                                <h3 className="text-lg font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-primary" /> Categories & Subcategories
                                </h3>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/10 border-b border-foreground/10">
                                        <th className="px-8 py-5 text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest w-1/3">Categories</th>
                                        <th className="px-8 py-5 text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Subcategories</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedCategories.map((group: any, idx: number) => (
                                        <tr key={idx} className="border-b border-foreground/10 last:border-0 hover:bg-muted/5 transition-colors">
                                            <td className="px-8 py-6 align-top">
                                                <p className="font-bold text-foreground text-lg flex items-center gap-2">
                                                    {group.area}
                                                    {!explicitCategoryTokens.has(normalizeToken(group.area)) && (
                                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                            inferred
                                                        </span>
                                                    )}
                                                </p>
                                            </td>
                                            <td className="px-8 py-6 space-y-4 align-top">
                                                {group.subs.length > 0 ? (
                                                    group.subs.map((sub: any, sIdx: number) => (
                                                        <div key={sIdx} className="space-y-1.5">
                                                            <p className="font-semibold text-foreground flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                                                                {sub.label}
                                                            </p>
                                                            {sub.subSubs && sub.subSubs.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5 pl-4 pt-0.5">
                                                                    {sub.subSubs.map((ss: string, ssIdx: number) => (
                                                                        <Badge key={ssIdx} variant="secondary" className="text-[10px] py-0 px-2 rounded-md bg-primary/5 text-primary border-primary/10 font-medium uppercase tracking-tight">
                                                                            {ss}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-muted-foreground/50 italic text-xs">No subcategories selected</p>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                )}

                {/* Service Locations Section */}
                {(Array.isArray(item.serviceRegions) && item.serviceRegions.length > 0 || Array.isArray(item.serviceCountries) && item.serviceCountries.length > 0) && (
                    <div className="mb-12">
                        <Card className="rounded-3xl border-foreground/10 shadow-lg overflow-hidden border-2 border-slate-200">
                            <div className="bg-slate-50 px-8 py-6 border-b border-foreground/10">
                                <h3 className="text-lg font-black text-foreground tracking-tight flex items-center gap-2 uppercase tracking-wider">
                                    <MapPin className="w-5 h-5 text-slate-500" /> Geographic Availability
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
                                                    <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1 text-slate-400">Regions Served</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {regionList.map((region) => (
                                                            <button
                                                                key={region}
                                                                onClick={() => setActiveRegion(region)}
                                                                className={`text-sm py-2 px-6 rounded-xl transition-all border-2 ${
                                                                    currentActive === region 
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
                                                            <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1 text-slate-400">Markets in {currentActive}</h4>
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
                    <div className="space-y-4">
                        <h3 className="text-xl font-black uppercase tracking-widest text-muted-foreground px-1">Representative(s)</h3>
                        <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/30 border-b border-foreground/10">
                                        <th className="px-8 py-4 text-sm font-bold">First Name</th>
                                        <th className="px-8 py-4 text-sm font-bold">Last Name</th>
                                        <th className="px-8 py-4 text-sm font-bold">Email</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {item.companyRepresentatives.map((rep: any, idx: number) => (
                                        <tr key={`${rep.email || "rep"}-${idx}`} className="border-b border-foreground/10 last:border-0 hover:bg-muted/5 transition-colors">
                                            <td className="px-8 py-4 text-sm">{rep.firstName || "-"}</td>
                                            <td className="px-8 py-4 text-sm">{rep.lastName || "-"}</td>
                                            <td className="px-8 py-4 text-sm text-primary underline underline-offset-4">{rep.email || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


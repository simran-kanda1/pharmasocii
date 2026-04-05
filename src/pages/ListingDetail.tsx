import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "@/firebase";
import { doc, getDoc, collectionGroup, query, where, getDocs, limit } from "firebase/firestore";
import { MapPin, ArrowLeft, ShieldCheck, Phone, ExternalLink, Building2, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_CATEGORIES } from "./AllCategories";

// Simple skeleton placeholder
const Skeleton = ({ className }: { className: string }) => <div className={`animate-pulse bg-muted rounded ${className}`} />;

export default function ListingDetail() {
    const { type, id } = useParams<{ type: string; id: string }>();
    const [item, setItem] = useState<any>(null);
    const [partner, setPartner] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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
                            const q = query(collectionGroup(db, collectionName), where("active", "==", true), limit(300));
                            const querySnap = await getDocs(q);
                            const found = querySnap.docs.find(d => d.id === id);
                            if (found) {
                                docSnap = found;
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

    // Helper to group subcategories by Area
    const getGroupedCategories = () => {
        if (type !== "business") return [];
        
        // Comprehensive fallbacks for different field names used in Firestore
        const selectedAreas = Array.isArray(item.selectedCategories) ? item.selectedCategories : 
                              (Array.isArray(item.categories) ? item.categories :
                              (item.category ? [item.category] : []));
        const allSelectedSubs = Array.isArray(item.selectedSubcategories) ? item.selectedSubcategories : 
                               (Array.isArray(item.subcategories) ? item.subcategories : []);
        const allSelectedSubSubs = Array.isArray(item.selectedSubSubcategories) ? item.selectedSubSubcategories : 
                                  (Array.isArray(item.subSubcategories) ? item.subSubcategories : []);

        const serviceRegions = Array.isArray(item.serviceRegions) ? item.serviceRegions : [];
        const serviceCountries = Array.isArray(item.serviceCountries) ? item.serviceCountries : [];

        // Track claimed items for orphan detection
        const claimedSubs = new Set<string>();
        const claimedSubSubs = new Set<string>();

        const normalize = (s: any) => (typeof s === 'string' ? s.toLowerCase().trim() : "");

        const grouped = (selectedAreas as string[]).map(area => {
            const areaConfig = BUSINESS_CATEGORIES[area] || [];
            const matchingSubs = areaConfig.map(entry => {
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

                                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-2">
                                    {/* Certifications & BSL */}
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-6 text-sm text-muted-foreground">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                            <span>{item.businessAddress || partner?.businessAddress || "N/A"}</span>
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
                {type === "business" && groupedCategories.length > 0 && (
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
                                                <p className="font-bold text-foreground text-lg">{group.area}</p>
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    {/* Regions */}
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Regions Served</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {Array.isArray(item.serviceRegions) && item.serviceRegions.length > 0 ? (
                                                item.serviceRegions.map((region: string, idx: number) => (
                                                    <Badge key={idx} variant="secondary" className="text-sm py-1.5 px-4 rounded-xl bg-muted/50 border-foreground/5 hover:bg-slate-200 transition-colors text-slate-700">
                                                        {region}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <p className="text-muted-foreground italic text-sm px-1">Global Coverage</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Countries */}
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Countries Served</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {Array.isArray(item.serviceCountries) && item.serviceCountries.length > 0 ? (
                                                item.serviceCountries.map((country: string, idx: number) => (
                                                    <Badge key={idx} variant="outline" className="text-sm py-1.5 px-4 rounded-xl border-foreground/10 bg-background hover:border-slate-400 transition-all font-semibold">
                                                        {country}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <p className="text-muted-foreground italic text-sm px-1">Multiple International Markets</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Representatives Section */}
                {(partner?.primaryName || partner?.secondaryName) && (
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
                                    {partner?.primaryName && (
                                        <tr className="border-b border-foreground/10 hover:bg-muted/5 transition-colors">
                                            <td className="px-8 py-4 text-sm">{partner.primaryName.split(' ')[0]}</td>
                                            <td className="px-8 py-4 text-sm">{partner.primaryName.split(' ').slice(1).join(' ')}</td>
                                            <td className="px-8 py-4 text-sm text-primary underline underline-offset-4">{partner.primaryEmail}</td>
                                        </tr>
                                    )}
                                    {partner?.secondaryName && (
                                        <tr className="border-b border-foreground/10 last:border-0 hover:bg-muted/5 transition-colors">
                                            <td className="px-8 py-4 text-sm">{partner.secondaryName.split(' ')[0]}</td>
                                            <td className="px-8 py-4 text-sm">{partner.secondaryName.split(' ').slice(1).join(' ')}</td>
                                            <td className="px-8 py-4 text-sm text-primary underline underline-offset-4">{partner.secondaryEmail}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


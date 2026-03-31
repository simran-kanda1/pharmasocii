import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "@/firebase";
import { doc, getDoc, collectionGroup, query, where, getDocs, limit } from "firebase/firestore";
import { MapPin, Calendar, Briefcase, ArrowLeft, Globe, BadgeCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Simple skeleton placeholder since the component might not exist
const Skeleton = ({ className }: { className: string }) => <div className={`animate-pulse bg-muted rounded ${className}`} />;

export default function ListingDetail() {
    const { type, id } = useParams<{ type: string; id: string }>();
    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchListing = async () => {
            if (!id || !type) return;
            setLoading(true);
            try {
                let collectionName = "";
                let isGroup = false;

                if (type === "business") {
                    // Try businessOfferingsCollection first as it's the primary one for the categories page
                    collectionName = "businessOfferingsCollection";
                    isGroup = true;
                }
                else if (type === "consulting") collectionName = "consultingCollection";
                else if (type === "events") collectionName = "eventsCollection";
                else if (type === "jobs") collectionName = "jobsCollection";

                if (collectionName) {
                    let docSnap;
                    if (isGroup) {
                        // For collection groups, we query by ID
                        const q = query(collectionGroup(db, collectionName), where("active", "==", true), limit(100));
                        const querySnap = await getDocs(q);
                        docSnap = querySnap.docs.find(d => d.id === id);
                    } else {
                        const docRef = doc(db, collectionName, id);
                        docSnap = await getDoc(docRef);
                    }

                    if (docSnap && docSnap.exists()) {
                        setItem({ id: docSnap.id, ...docSnap.data() });
                    } else if (type === "business") {
                        // Fallback to partnersCollection if not found in offerings (for home page "Partners" tiles)
                        const altRef = doc(db, "partnersCollection", id);
                        const altSnap = await getDoc(altRef);
                        if (altSnap.exists()) {
                            setItem({ id: altSnap.id, ...altSnap.data() });
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
            <div className="container mx-auto px-4 py-24 max-w-4xl space-y-8">
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

    const title = type === "business" ? item.businessName : type === "consulting" ? (item.primaryName || item.businessName) : type === "events" ? item.eventName : item.jobTitle;

    return (
        <div className="min-h-screen bg-background pb-32">
            {/* Header / Hero */}
            <section className="bg-muted/30 border-b border-foreground/10 pt-32 pb-16">
                <div className="container mx-auto px-4 max-w-5xl">
                    <Button asChild variant="ghost" className="mb-8 -ml-4 text-muted-foreground hover:text-primary transition-colors group rounded-full">
                        <Link to={`/all-categories/${type || 'business'}`}>
                            <ArrowLeft className="mr-2 w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to {type === 'business' ? 'Business Offerings' : type === 'consulting' ? 'Consulting' : (type || '').charAt(0).toUpperCase() + (type || '').slice(1)}
                        </Link>
                    </Button>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="flex-1 space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold uppercase tracking-wider text-[10px] px-3 py-1 rounded-full">
                                    {type === 'business' ? 'Service Provider' : type === 'consulting' ? 'Expert Consultant' : type === 'events' ? 'Industry Event' : 'Job Opening'}
                                </Badge>
                                {item.isFeatured && (
                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold uppercase tracking-wider text-[10px] px-3 py-1 rounded-full flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3" /> Featured
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight">{title}</h1>
                            
                            <div className="flex flex-wrap items-center gap-6 text-muted-foreground text-lg">
                                {item.businessAddress && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-primary" /> {item.businessAddress}
                                    </div>
                                )}
                                {(type === 'jobs' || type === 'events') && item.city && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-primary" /> {item.city}{item.state ? `, ${item.state}` : ''}
                                    </div>
                                )}
                                {type === 'events' && item.startDate && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" /> {item.startDate}
                                    </div>
                                )}
                                {type === 'jobs' && item.jobtype && (
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="w-5 h-5 text-primary" /> {item.jobtype}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="shrink-0 flex gap-4">
                            <Button size="lg" className="rounded-full px-8 h-14 font-bold shadow-lg shadow-primary/20">
                                {type === 'jobs' ? 'Apply Now' : type === 'events' ? 'Register Interest' : 'Inquire Now'}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Content */}
            <section className="py-20">
                <div className="container mx-auto px-4 max-w-5xl">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                        <div className="lg:col-span-2 space-y-12">
                            {/* Detailed Info */}
                            {(type === 'business' || type === 'consulting') && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card className="bg-muted/20 border-foreground/5 rounded-2xl p-6 transition-all hover:bg-muted/30">
                                            <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest mb-2">Primary Focus</p>
                                            <p className="text-xl font-bold capitalize text-foreground">{item.selectedGroup?.replace(/_/g, ' ') || item.focusArea || "N/A"}</p>
                                        </Card>
                                        <Card className="bg-muted/20 border-foreground/5 rounded-2xl p-6 transition-all hover:bg-muted/30">
                                            <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest mb-2">Classification</p>
                                            <p className="text-xl font-bold capitalize text-foreground">{item.selectedPlan?.replace(/_/g, ' ') || item.planId?.replace(/_/g, ' ') || "N/A"}</p>
                                        </Card>
                                    </div>

                                    {item.companyProfileText && (
                                        <div className="space-y-4">
                                            <h3 className="text-2xl font-bold text-foreground">{type === 'consulting' ? "Expert Profile" : "Company Overview"}</h3>
                                            <div className="prose prose-slate dark:prose-invert max-w-none">
                                                <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap">{item.companyProfileText}</p>
                                            </div>
                                        </div>
                                    )}

                                    {Array.isArray(item.serviceCountries) && item.serviceCountries.length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="text-xl font-bold flex items-center gap-2"><Globe className="w-5 h-5 text-primary" /> Service Locations</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {item.serviceCountries.map((country: string, idx: number) => (
                                                    <span key={idx} className="bg-secondary/50 px-4 py-1.5 rounded-full text-sm font-medium border border-foreground/5">{country}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {type === 'jobs' && (
                                <div className="space-y-12">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8 border-b border-foreground/10">
                                        <div><p className="text-xs uppercase font-bold text-muted-foreground mb-1">Company</p><p className="font-bold">{item.businessName}</p></div>
                                        <div><p className="text-xs uppercase font-bold text-muted-foreground mb-1">Work Model</p><p className="font-bold">{item.workModel}</p></div>
                                        <div><p className="text-xs uppercase font-bold text-muted-foreground mb-1">Experience</p><p className="font-bold">{item.experienceLevel}</p></div>
                                        <div><p className="text-xs uppercase font-bold text-muted-foreground mb-1">Sector</p><p className="font-bold">{item.industry}</p></div>
                                    </div>

                                    {item.jobSummary && (
                                        <div className="space-y-4">
                                            <h3 className="text-2xl font-bold text-foreground">Role Summary</h3>
                                            <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap">{item.jobSummary}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {type === 'events' && (
                                <div className="space-y-12">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card className="bg-muted/20 border-foreground/5 rounded-2xl p-6">
                                            <p className="text-xs uppercase font-bold text-muted-foreground mb-1">City & Country</p>
                                            <p className="text-xl font-bold">{item.city || "Venue"}</p>
                                        </Card>
                                        <Card className="bg-muted/20 border-foreground/5 rounded-2xl p-6">
                                            <p className="text-xs uppercase font-bold text-muted-foreground mb-1">VenueDetails</p>
                                            <p className="text-xl font-bold">{item.location || "TBA"}</p>
                                        </Card>
                                    </div>

                                    {item.categories && (
                                        <div className="space-y-4">
                                            <h3 className="text-xl font-bold flex items-center gap-2">Topics & Categories</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {item.categories.map((c: string, j: number) => (
                                                    <Badge key={j} variant="outline" className="px-4 py-1.5 rounded-full text-sm font-medium bg-background border-foreground/10 hover:border-primary transition-colors cursor-default">{c}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-8">
                            <Card className="border-primary/20 bg-primary/5 rounded-3xl p-8 sticky top-32 overflow-hidden relative">
                                <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                                <div className="relative z-10 space-y-6">
                                    <h3 className="text-xl font-bold text-foreground">Next Steps</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Ready to move forward? Connect with this partner or apply directly to proceed with your inquiry.
                                    </p>
                                    <div className="space-y-3">
                                        <Button className="w-full rounded-2xl h-14 font-bold shadow-md">Inquire Now</Button>
                                        <Button variant="outline" className="w-full rounded-2xl h-14 font-bold bg-background/50 border-foreground/10 hover:bg-background">Save for Later</Button>
                                    </div>
                                    
                                    <div className="pt-6 border-t border-foreground/10 space-y-6">
                                        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                                            <BadgeCheck className="w-5 h-5 text-primary" /> Verified Pharmaceutical Network
                                        </div>

                                        {/* Specializations Tags Moved inside for layout consistency */}
                                        {Array.isArray(item.selectedSubcategories) && item.selectedSubcategories.length > 0 && (
                                            <div className="pt-6 border-t border-foreground/10 space-y-4 font-sans">
                                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Specializations</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {item.selectedSubcategories.map((s: string, i: number) => (
                                                        <span key={i} className="bg-foreground/5 border border-foreground/10 px-3 py-1 rounded-lg text-xs font-medium">{s}</span>
                                                    ))}
                                                    {Array.isArray(item.selectedSubSubcategories) && item.selectedSubSubcategories.map((s: string, i: number) => (
                                                        <span key={`ss-${i}`} className="bg-primary/5 text-primary border border-primary/20 px-3 py-1 rounded-lg text-xs font-medium">{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

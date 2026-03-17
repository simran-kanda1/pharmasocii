import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Search, MapPin, Building2, Users, Calendar, Briefcase, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function Marketplace() {
    const { category } = useParams<{ category: string }>();
    const currentTab = category || "business";

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any>(null);

    useEffect(() => {
        const fetchMarketplaceData = async () => {
            setLoading(true);
            try {
                let q: any = null;

                if (currentTab === "business") {
                    q = query(collection(db, "partnersCollection"), where("partnerStatus", "==", "Approved"));
                } else if (currentTab === "consulting") {
                    q = query(collection(db, "consultingCollection"), where("active", "==", true));
                } else if (currentTab === "events") {
                    q = query(collection(db, "eventsCollection"), where("active", "==", true));
                } else if (currentTab === "jobs") {
                    q = query(collection(db, "jobsCollection"), where("active", "==", true));
                }

                if (q) {
                    const snap = await getDocs(q);
                    setData(snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) })));
                } else {
                    setData([]);
                }
            } catch (err) {
                console.error("Error fetching marketplace:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMarketplaceData();
    }, [currentTab]);

    const handleCloseModal = () => setSelectedProfile(null);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Marketplace Header */}
            <div className="bg-black/40 border-b border-white/5 py-12">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl font-bold tracking-tight mb-4">Marketplace</h1>
                    <p className="text-muted-foreground text-lg max-w-2xl">
                        Explore, connect, and collaborate with leading businesses, experts, and talent across the global biotech ecosystem.
                    </p>

                    <div className="mt-8 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1 max-w-xl">
                            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                            <Input
                                className="pl-10 h-12 bg-white/5 border-white/10 text-base rounded-full"
                                placeholder={`Search ${currentTab}...`}
                            />
                        </div>
                        <Button size="lg" className="h-12 px-6 rounded-full" variant="outline">
                            <Filter className="mr-2 h-4 w-4" /> Filters
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="container mx-auto px-4 mt-8 flex-1">
                <Tabs value={currentTab} className="w-full">
                    <TabsList className="bg-white/5 border border-white/10 mb-8 p-1 rounded-full w-full justify-start overflow-x-auto h-auto">
                        <TabsTrigger value="business" asChild className="rounded-full px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Link to="/marketplace/business" className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Businesses</Link>
                        </TabsTrigger>
                        <TabsTrigger value="consulting" asChild className="rounded-full px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Link to="/marketplace/consulting" className="flex items-center gap-2"><Users className="w-4 h-4" /> Consulting Services</Link>
                        </TabsTrigger>
                        <TabsTrigger value="events" asChild className="rounded-full px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Link to="/marketplace/events" className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Events</Link>
                        </TabsTrigger>
                        <TabsTrigger value="jobs" asChild className="rounded-full px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Link to="/marketplace/jobs" className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Jobs</Link>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Dynamic Content Area */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground">Loading {currentTab}...</div>
                ) : data.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground bg-white/5 border border-white/10 rounded-xl my-8">
                        No {currentTab} listings found right now. Check back soon.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
                        {data.map((item, i) => {
                            let title = "";
                            let subtext = "";
                            let tag = "";

                            if (currentTab === "business") {
                                title = item.businessName;
                                subtext = item.businessAddress || item.selectedGroup?.replace(/_/g, " ");
                                tag = item.isFeatured ? "Featured" : "Verified";
                            } else if (currentTab === "consulting") {
                                title = item.primaryName || item.businessName;
                                subtext = item.companyProfileText || item.businessAddress;
                                tag = item.isFeatured ? "Top Consultant" : "Verified";
                            } else if (currentTab === "events") {
                                title = item.eventName;
                                subtext = item.city || item.location;
                                tag = "Event";
                            } else if (currentTab === "jobs") {
                                title = item.jobTitle;
                                subtext = `${item.businessName} • ${item.city || item.workModel}`;
                                tag = item.jobtype || "Role";
                            }

                            return (
                                <div key={item.id} onClick={() => setSelectedProfile(item)} className="group rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer overflow-hidden flex flex-col">
                                    <div className="w-full h-40 bg-white/5 relative">
                                        {currentTab === 'business' || currentTab === 'events' ? (
                                            <img src={`https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=400&sig=${i + currentTab}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-primary/20 bg-primary/5">
                                                {currentTab === 'consulting' ? <Users strokeWidth={0.5} className="w-20 h-20" /> : <Briefcase strokeWidth={0.5} className="w-20 h-20" />}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
                                            {tag}
                                        </div>
                                        <h3 className="text-xl font-bold mb-1 truncate">
                                            {title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-4 truncate">
                                            <MapPin className="w-3.5 h-3.5 shrink-0" /> {subtext}
                                        </p>

                                        <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between">
                                            <span className="text-sm font-medium">View details</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={handleCloseModal}>
                    <div className="bg-background border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                            <h2 className="text-2xl font-bold">Details</h2>
                            <Button variant="ghost" size="icon" onClick={handleCloseModal}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            {currentTab === 'business' && (
                                <>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-bold text-primary">{selectedProfile.businessName}</h3>
                                        {selectedProfile.businessAddress && <p className="text-muted-foreground flex items-center gap-2"><MapPin className="w-4 h-4" /> {selectedProfile.businessAddress}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                                            <p className="text-xs uppercase text-muted-foreground mb-1">Group Focus</p>
                                            <p className="font-semibold capitalize">{selectedProfile.selectedGroup?.replace(/_/g, ' ') || "N/A"}</p>
                                        </div>
                                        <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                                            <p className="text-xs uppercase text-muted-foreground mb-1">Subscription Plan</p>
                                            <p className="font-semibold capitalize">{selectedProfile.selectedPlan?.replace(/_/g, ' ') || "N/A"}</p>
                                        </div>
                                    </div>
                                    {selectedProfile.companyProfileText && (
                                        <div>
                                            <p className="font-bold mb-2">Company Overview</p>
                                            <p className="text-muted-foreground leading-relaxed">{selectedProfile.companyProfileText}</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {currentTab === 'consulting' && (
                                <>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-bold text-primary">{selectedProfile.primaryName || selectedProfile.businessName}</h3>
                                        <p className="text-muted-foreground font-medium">{selectedProfile.businessName}</p>
                                    </div>
                                    {selectedProfile.companyProfileText && (
                                        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                            <p className="text-sm leading-relaxed">{selectedProfile.companyProfileText}</p>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold uppercase text-muted-foreground">Expert Details</p>
                                        <p className="text-lg">Location: {selectedProfile.businessAddress || "Remote"}</p>
                                    </div>
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
                                    <div className="bg-black/40 p-4 rounded-lg border border-white/5 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs uppercase text-muted-foreground mb-1">City</p>
                                            <p className="font-semibold">{selectedProfile.city}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-muted-foreground mb-1">Venue</p>
                                            <p className="font-semibold">{selectedProfile.location}</p>
                                        </div>
                                    </div>
                                    {selectedProfile.categories && (
                                        <div>
                                            <p className="font-bold mb-2">Topics & Categories</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedProfile.categories.map((c: string, j: number) => (
                                                    <span key={j} className="bg-white/10 px-3 py-1 rounded-full text-sm">{c}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-white/10 bg-black/20 flex gap-4">
                            <Button className="w-full" size="lg">Contact / Proceed</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

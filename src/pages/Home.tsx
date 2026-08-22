import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle, ShieldCheck, Building2, Users, Calendar, Briefcase, MessageSquare, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { AutoCarousel } from "@/components/ui/auto-carousel";
import { auth, db } from "@/firebase";
import { collection, collectionGroup, query, where, limit, getDocs, orderBy, doc, getDoc } from "firebase/firestore";
import {
    buildLiveListingKeySet,
    isPartnerListingPublic,
} from "@/lib/partnerListingPublic";
import { onAuthStateChanged } from "firebase/auth";
import { PostCard } from "@/components/community/PostCard";
import { useCommunityCategories } from "@/hooks/useCommunityCategories";

import {
    loadMemberEngagementIds,
    togglePostHelpful,
    toggleSavedPost,
} from "@/lib/communityEngagement";
import {
    canEngageCommunity,
    canReportCommunitySpam,
    canSaveCommunityContent,
    canShareCommunityContent,
    communityAccessHint,
} from "@/lib/communityAccess";

const FEATURE_FETCH_LIMIT = 5000;
/** When no rows match paid home spotlight, still show recent active listings so the home page is not empty. */
const FALLBACK_CAROUSEL_CAP = 24;

function pickSpotlightOrRecent(
    rows: Record<string, any>[],
    isHomeSpotlight: (item: Record<string, any>) => boolean,
    cap: number
): Record<string, any>[] {
    const spotlight = rows
        .filter(isHomeSpotlight)
        .sort((a, b) => featuredRecencyMs(b) - featuredRecencyMs(a));
    if (spotlight.length > 0) return spotlight.slice(0, cap);
    return [...rows].sort((a, b) => featuredRecencyMs(b) - featuredRecencyMs(a)).slice(0, cap);
}

function spotlightAccessEndMs(item: Record<string, any>): number | null {
    const raw = item.featureSpotlightAccessEnd;
    if (raw?.toDate) return raw.toDate().getTime();
    if (typeof raw?.seconds === "number") return raw.seconds * 1000;
    return null;
}

/** Spotlight stays visible until scheduled removal when user cancels mid-cycle. */
function spotlightDisplayActive(item: Record<string, any>): boolean {
    const endMs = spotlightAccessEndMs(item);
    if (item.featureSpotlightCancelPending && endMs != null && Date.now() > endMs) return false;
    return true;
}

function toMillis(value: any): number {
    if (!value) return 0;
    if (typeof value?.toDate === "function") {
        const d = value.toDate();
        return d instanceof Date ? d.getTime() : 0;
    }
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (typeof value === "number") return value > 1e12 ? value : value * 1000;
    if (typeof value === "string") {
        const ms = new Date(value).getTime();
        return Number.isNaN(ms) ? 0 : ms;
    }
    return 0;
}

function featuredRecencyMs(item: Record<string, any>): number {
    return Math.max(
        toMillis(item.lastFeaturePaymentReceivedAt),
        toMillis(item.lastPaymentReceivedAt),
        toMillis(item.createdAt)
    );
}

function inferIncludedSpotlightFromPlan(item: Record<string, any>): string {
    const planId = String(item.selectedPlan || "").trim().toLowerCase();
    if (planId === "premium_event" || planId === "premium_job") return "landing_page";
    if (planId === "premium_plus_event" || planId === "premium_plus_job") return "home_page";
    return "";
}
export default function Home() {
    const { categoryDoc } = useCommunityCategories();
    const [featuredBusinesses, setFeaturedBusinesses] = useState<any[]>([]);
    const [featuredJobs, setFeaturedJobs] = useState<any[]>([]);
    const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
    const [featuredConsulting, setFeaturedConsulting] = useState<any[]>([]);
    const [communityHighlights, setCommunityHighlights] = useState<any[]>([]);
    const [user, setUser] = useState<import("firebase/auth").User | null>(null);
    const [verified, setVerified] = useState(false);
    const [hasMemberProfile, setHasMemberProfile] = useState(false);
    const [memberRestricted, setMemberRestricted] = useState(false);
    const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
    const [helpfulPostIds, setHelpfulPostIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                setVerified(false);
                setHasMemberProfile(false);
                setMemberRestricted(false);
                setSavedPostIds(new Set());
                setHelpfulPostIds(new Set());
                return;
            }
            await u.reload();
            setVerified(u.emailVerified);
            const m = await getDoc(doc(db, "membersCollection", u.uid));
            setHasMemberProfile(m.exists());
            const st = m.data()?.accountStatus;
            setMemberRestricted(st === "spam_blocked" || st === "admin_hold");
            if (m.exists()) {
                const engagement = await loadMemberEngagementIds(u.uid);
                setSavedPostIds(engagement.savedPostIds);
                setHelpfulPostIds(engagement.helpfulPostIds);
            } else {
                setSavedPostIds(new Set());
                setHelpfulPostIds(new Set());
            }
        });
        return () => unsub();
    }, []);

    const canEngage = canEngageCommunity(user, verified, hasMemberProfile, memberRestricted);
    const canShare = canShareCommunityContent();
    const canReport = canReportCommunitySpam(user, verified, hasMemberProfile, memberRestricted);
    const canSave = canSaveCommunityContent(user, verified, hasMemberProfile, memberRestricted);
    const engageHint = communityAccessHint(memberRestricted, user, verified, hasMemberProfile);

    const toggleSavePost = useCallback(async (postId: string) => {
        if (!canSave || !user) return;
        try {
            const nowSaved = await toggleSavedPost(user.uid, postId, savedPostIds.has(postId));
            setSavedPostIds((prev) => {
                const next = new Set(prev);
                if (nowSaved) next.add(postId);
                else next.delete(postId);
                return next;
            });
        } catch (e) {
            console.error(e);
        }
    }, [canSave, user, savedPostIds]);

    const toggleHelpfulPost = useCallback(async (postId: string) => {
        if (!canEngage || !user) return;
        try {
            const nowHelpful = await togglePostHelpful(user.uid, postId, helpfulPostIds.has(postId));
            setHelpfulPostIds((prev) => {
                const next = new Set(prev);
                if (nowHelpful) next.add(postId);
                else next.delete(postId);
                return next;
            });
            setCommunityHighlights((prev) =>
                prev.map((p) =>
                    p.id === postId
                        ? { ...p, likeCount: Math.max(0, Number(p.likeCount ?? 0) + (nowHelpful ? 1 : -1)) }
                        : p,
                ),
            );
        } catch (e) {
            console.error(e);
        }
    }, [canEngage, user, helpfulPostIds]);

    useEffect(() => {
        const fetchFeaturedData = async () => {
            const isHomeSpotlight = (item: Record<string, any>) => {
                if (!spotlightDisplayActive(item)) return false;
                const addon = String(
                    item.selectedAddon || item.featuredPlacement || inferIncludedSpotlightFromPlan(item)
                ).trim().toLowerCase();
                return addon === "home_page" || addon === "both" || addon === "spotlight_addon" || (item.isFeatured && !addon);
            };

            let liveListingKeys = new Set<string>();
            try {
                const plansSnap = await getDocs(query(collectionGroup(db, "planCollection"), limit(10000)));
                liveListingKeys = buildLiveListingKeySet(
                    plansSnap.docs.map((planDoc) => ({
                        path: planDoc.ref.path,
                        data: planDoc.data() as Record<string, unknown>,
                    })),
                );
            } catch (e) {
                console.error("Home: plan fetch failed:", e);
            }

            let businessRows: Record<string, any>[] = [];
            try {
                const businessQuery = query(collectionGroup(db, "businessOfferingsCollection"), limit(FEATURE_FETCH_LIMIT));
                const businessDocs = await getDocs(businessQuery);
                businessRows = businessDocs.docs
                    .map((doc) => {
                        const raw = doc.data() as Record<string, any>;
                        const path = String(doc.ref.parent?.parent?.path || "");
                        const partnerFromPath =
                            path.includes("partnersCollection") && doc.ref.parent?.parent?.id ? doc.ref.parent.parent.id : "";
                        return { id: doc.id, partnerId: raw.partnerId || partnerFromPath, ...raw };
                    })
                    .filter((row) => isPartnerListingPublic(row, "businessOfferingsCollection", liveListingKeys));
            } catch (e) {
                console.error("Home: business offerings fetch failed:", e);
            }
            setFeaturedBusinesses(pickSpotlightOrRecent(businessRows, isHomeSpotlight, FALLBACK_CAROUSEL_CAP));

            let jobRows: Record<string, any>[] = [];
            try {
                const jobQuery = query(collection(db, "jobsCollection"), limit(FEATURE_FETCH_LIMIT));
                const jobDocs = await getDocs(jobQuery);
                jobRows = jobDocs.docs
                    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, any>) }))
                    .filter((row) => isPartnerListingPublic(row, "jobsCollection", liveListingKeys));
            } catch (e) {
                console.error("Home: jobs fetch failed:", e);
            }
            setFeaturedJobs(pickSpotlightOrRecent(jobRows, isHomeSpotlight, FALLBACK_CAROUSEL_CAP));

            let eventRows: Record<string, any>[] = [];
            try {
                const evtQuery = query(collection(db, "eventsCollection"), limit(FEATURE_FETCH_LIMIT));
                const evtDocs = await getDocs(evtQuery);
                eventRows = evtDocs.docs
                    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, any>) }))
                    .filter((row) => isPartnerListingPublic(row, "eventsCollection", liveListingKeys));
            } catch (e) {
                console.error("Home: events fetch failed:", e);
            }
            setFeaturedEvents(pickSpotlightOrRecent(eventRows, isHomeSpotlight, FALLBACK_CAROUSEL_CAP));

            let consultingRows: Record<string, any>[] = [];
            try {
                const [consultingServicesDocs, consultingLegacyDocs] = await Promise.all([
                    getDocs(query(collection(db, "consultingServicesCollection"), limit(FEATURE_FETCH_LIMIT))),
                    getDocs(query(collection(db, "consultingCollection"), limit(FEATURE_FETCH_LIMIT))),
                ]);
                consultingRows = [
                    ...consultingServicesDocs.docs
                        .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, any>) }))
                        .filter((row) => isPartnerListingPublic(row, "consultingServicesCollection", liveListingKeys)),
                    ...consultingLegacyDocs.docs
                        .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, any>) }))
                        .filter((row) => isPartnerListingPublic(row, "consultingCollection", liveListingKeys)),
                ];
            } catch (e) {
                console.error("Home: consulting fetch failed:", e);
            }
            setFeaturedConsulting(pickSpotlightOrRecent(consultingRows, isHomeSpotlight, FALLBACK_CAROUSEL_CAP));

            try {
                const postsQ = query(
                    collection(db, "postsCollection"),
                    where("archived", "==", false),
                    orderBy("createdAt", "desc"),
                    limit(5),
                );
                const postsSnap = await getDocs(postsQ);
                setCommunityHighlights(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            } catch (postsErr) {
                console.error("Failed to load community highlights:", postsErr);
                setCommunityHighlights([]);
            }
        };
        fetchFeaturedData();
    }, []);
    return (
        <div className="w-full">
            {/* HERO SECTION */}
            <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">

                <div className="container relative z-10 px-4 py-32 mx-auto flex flex-col items-start text-left mt-8 md:mt-16">

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter mb-8 max-w-5xl leading-tight text-foreground drop-shadow-sm">
                        Building a Connected Ecosystem for<br />
                        <span className="text-primary">Life Sciences</span>
                    </h1>

                    <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mb-12 font-light leading-relaxed">
                        Advancing life sciences through collaboration, shared knowledge, & meaningful connections
                    </p>


                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <Button size="lg" className="h-14 px-8 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/50 transition-all rounded-full" asChild>
                            <Link to="/signup">
                                Become a partner <ArrowRight className="ml-2 w-5 h-5" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold border-foreground/20 bg-foreground/5 hover:bg-foreground/10 backdrop-blur-md rounded-full" asChild>
                            <Link to="/community">
                                <PlayCircle className="mr-2 w-5 h-5 text-primary" /> Explore community
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>


            {/* CATEGORIES GRID */}
            <section className="py-24 bg-background relative z-10 border-b border-border">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-4xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">Discover, Connect & Collaborate</h2>
                        <p className="text-lg md:text-xl text-muted-foreground mt-4">Bridging disciplines, sectors, and borders across the life sciences industry</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        {[
                            { title: 'Business Offerings', icon: Building2, link: '/all-categories/business' },
                            { title: 'Consulting Services', icon: Users, link: '/all-categories/consulting' },
                            { title: 'Events/Conferences', icon: Calendar, link: '/all-categories/events' },
                            { title: 'Global Health Authority Sites', icon: ShieldCheck, link: '/all-categories/compliance' },
                            { title: 'Jobs', icon: Briefcase, link: '/all-categories/jobs' },
                            { title: 'Community', icon: MessageSquare, link: '/community' },
                        ].map((cat, i) => (
                            <Link to={cat.link} key={i} className="h-full">
                                <Card className="group hover:border-primary/50 border-foreground/10 transition-all cursor-pointer hover:shadow-md bg-background overflow-hidden h-full">
                                    <CardContent className="p-6 flex items-center justify-between gap-4 h-full">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors shrink-0">
                                                <cat.icon className="w-6 h-6 text-primary" />
                                            </div>
                                            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{cat.title}</h3>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* COMMUNITY HIGHLIGHTS */}
            <section className="py-24 bg-muted/40 border-y border-foreground/10 relative">
                <div className="container mx-auto px-6 md:px-12 max-w-7xl">
                    <SectionHeader
                        title="Community Highlights"
                        subtitle="Where people, expertise, & ideas connect"
                        action={
                            <div className="flex flex-wrap gap-3">
                                <Button asChild size="lg" variant="outline" className="rounded-full">
                                    <Link to="/member/register">Join community</Link>
                                </Button>
                                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold px-8 h-12 rounded-full border-none">
                                    <Link to="/community">View community <ArrowRight className="ml-2 w-4 h-4" /></Link>
                                </Button>
                            </div>
                        }
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                        {communityHighlights.length === 0 ? (
                            <p className="text-muted-foreground col-span-full">No community posts yet.</p>
                        ) : (
                            communityHighlights.map((p) => (
                                <PostCard
                                    key={p.id}
                                    post={p}
                                    categoryDoc={categoryDoc}
                                    showActionBar={Boolean(user)}
                                    canEngage={canEngage}
                                    canShare={canShare}
                                    canReport={canReport}
                                    hideContent={true}
                                    canSave={canSave}
                                    engageHint={engageHint}
                                    saved={savedPostIds.has(p.id)}
                                    helpful={helpfulPostIds.has(p.id)}
                                    onToggleSave={() => toggleSavePost(p.id)}
                                    onToggleHelpful={() => toggleHelpfulPost(p.id)}
                                />
                            ))
                        )}
                    </div>
                </div>
            </section>

{/* BUSINESS OFFERINGS CAROUSEL */}
            <section className="py-24 bg-background relative z-10 overflow-hidden">
                <div className="container mx-auto px-4 mb-12">
                    <div className="text-center max-w-4xl mx-auto">
                        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-12 text-center text-foreground">Featured</h2>
                        <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">Business Offerings</h2>
                        <p className="text-lg md:text-xl text-primary font-medium mb-4">Find the right partners to support your next phase of growth</p>
                        </div>
                </div>

                <div className="relative flex w-full">
                    {/* Gradient masks for infinite scroll effect */}
                    <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                    {featuredBusinesses.length > 0 ? (
                        <AutoCarousel speed={50} direction="left" innerClassName="gap-6 px-3 pb-8">
                            {featuredBusinesses.map((b, i) => (
                                <Link to={`/listing/business/${b.id}`} target="_blank" rel="noopener noreferrer" key={`offering-${b.partnerId || "na"}-${b.id}-${i}`} className="flex items-center justify-center text-center min-w-[320px] max-w-[320px] p-8 h-32 bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group shrink-0">
                                    <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">{b.businessName || ""}</h3>
                                </Link>
                            ))}
                        </AutoCarousel>
                    ) : (
                        <div className="w-full flex justify-center text-muted-foreground py-12">No featured businesses available.</div>
                    )}
                </div>

                {/* FEATURED CONSULTING CAROUSEL */}
                <div className="container mx-auto px-4 mt-32 mb-12">
                    <div className="text-center max-w-4xl mx-auto">
                        <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">Consulting</h2>
                        <p className="text-lg md:text-xl text-primary font-medium mb-4">Access trusted experts across regional and global markets</p>
                        </div>
                </div>

                <div className="relative flex w-full mb-12">
                    {/* Gradient masks for infinite scroll effect */}
                    <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                    {featuredConsulting.length > 0 ? (
                        <AutoCarousel speed={50} direction="right" innerClassName="gap-6 px-3 pb-8">
                            {featuredConsulting.map((c, i) => (
                                <Link to={`/listing/consulting/${c.id}`} target="_blank" rel="noopener noreferrer" key={`consulting-${c.id}-${i}`} className="flex items-center justify-center text-center min-w-[360px] max-w-[360px] p-8 h-32 bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group shrink-0">
                                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">{c.businessName || ""}</h3>
                                </Link>
                            ))}
                        </AutoCarousel>
                    ) : (
                        <div className="w-full flex justify-center text-muted-foreground py-12">No featured consulting available.</div>
                    )}
                </div>

                <div className="flex flex-col gap-24 mt-32 w-full overflow-hidden">
                    {/* Featured Events Carousel */}
                    <div className="flex flex-col items-center">
                        <div className="container mx-auto px-6 md:px-12 max-w-7xl text-center mb-12">
                            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">Events</h2>
                            <p className="text-base md:text-lg text-primary font-medium mb-3 max-w-3xl mx-auto">
                                Discover events shaping life sciences industry
                            </p>
                            </div>
                        <div className="relative flex w-full">
                            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                            {featuredEvents.length > 0 ? (
                                <AutoCarousel speed={50} direction="left" innerClassName="gap-6 px-3 py-4">
                                    {featuredEvents.map((evt, i) => {
                                        const dateObj = new Date(evt.startDate);
                                        const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                                        const day = dateObj.getUTCDate();
                                        return (
                                            <Link to={`/listing/events/${evt.id}`} target="_blank" rel="noopener noreferrer" key={`evt-${evt.id}-${i}`} className="flex flex-col sm:flex-row overflow-hidden bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group min-w-[400px] max-w-[400px] h-[160px] shrink-0">
                                                <div className="w-24 shrink-0 bg-primary/5 group-hover:bg-primary/10 flex flex-col items-center justify-center p-4 border-r border-foreground/10 transition-colors">
                                                    <span className="text-sm font-bold text-primary tracking-widest">{month}</span>
                                                    <span className="text-3xl font-extrabold text-foreground">{day}</span>
                                                </div>
                                                <div className="flex flex-col p-5 w-full">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2 sm:gap-4">
                                                        <div className="text-sm text-muted-foreground font-medium flex items-center gap-1.5 truncate">
                                                            <MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{[evt.stateRegion || evt.state, evt.eventCountry || evt.country].filter((x: any) => typeof x === "string" && x.trim()).join(", ") || "Online"}</span>
                                                        </div>
                                                    </div>
                                                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-4 leading-tight">{evt.eventName || ""}</h3>
                                                    <div className="mt-auto pt-3 border-t border-foreground/10 flex items-center justify-between text-primary font-semibold text-sm w-full">
                                                        <span>View Event</span>
                                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </AutoCarousel>
                            ) : (
                                <div className="w-full flex justify-center text-muted-foreground py-12">No featured events available.</div>
                            )}
                        </div>
                    </div>

                    {/* Featured Jobs Carousel */}
                    <div className="flex flex-col items-center pb-24">
                        <div className="container mx-auto px-6 md:px-12 max-w-7xl text-center mb-12">
                            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">Jobs</h2>
                            <p className="text-base md:text-lg text-primary font-medium mb-3 max-w-3xl mx-auto">
                                Explore opportunities across the life sciences ecosystem
                            </p>
                            </div>
                        <div className="relative flex w-full">
                            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                            {featuredJobs.length > 0 ? (
                                <AutoCarousel speed={50} direction="right" innerClassName="gap-6 px-3 py-4">
                                    {featuredJobs.map((job, i) => (
                                        <Link to={`/listing/jobs/${job.id}`} target="_blank" rel="noopener noreferrer" key={`job-${job.id}-${i}`} className="flex flex-col p-6 bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group min-w-[360px] max-w-[360px] h-[160px] shrink-0">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="text-xs font-bold text-primary tracking-wider border border-primary/20 bg-primary/10 rounded-full px-3 py-1 w-fit">
                                                    {job.workModel || "Job Opening"}
                                                </div>
                                                <div className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5" /> {[job.city, job.stateRegion || job.state].filter(Boolean).join(", ") || "Remote"}
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-2 leading-tight">{job.jobTitle || ""}</h3>
                                            <div className="mt-auto pt-4 border-t border-foreground/10 flex items-center justify-between text-primary font-semibold text-sm w-full">
                                                <span>View Job</span>
                                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </Link>
                                    ))}
                                </AutoCarousel>
                            ) : (
                                <div className="w-full flex justify-center text-muted-foreground py-12">No featured jobs available.</div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}

// Helper components

function SectionHeader({ title, subtitle, icon, action }: { title: string, subtitle: string, icon?: React.ReactNode, action?: React.ReactNode }) {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-foreground/10">
            <div>
                <div className="inline-flex items-center gap-3 mb-3">
                    {icon && <div className="p-2 rounded-lg bg-foreground/5 border border-foreground/10">{icon}</div>}
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
                </div>
                <p className="text-muted-foreground text-lg">{subtitle}</p>
            </div>
            {action && <div>{action}</div>}
        </div>
    )
}



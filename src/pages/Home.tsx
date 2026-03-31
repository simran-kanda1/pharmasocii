import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle, ShieldCheck, Building2, Users, Calendar, Briefcase, MessageSquare, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AutoCarousel } from "@/components/ui/auto-carousel";
import { db } from "@/firebase";
import { collection, query, where, limit, getDocs } from "firebase/firestore";



export default function Home() {
    const [featuredBusinesses, setFeaturedBusinesses] = useState<any[]>([]);
    const [featuredJobs, setFeaturedJobs] = useState<any[]>([]);
    const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
    const [featuredConsulting, setFeaturedConsulting] = useState<any[]>([]);

    useEffect(() => {
        const fetchFeaturedData = async () => {
            try {
                // Fetch featured partners
                const ptQuery = query(collection(db, "partnersCollection"), where("isFeatured", "==", true), where("partnerStatus", "==", "Approved"), limit(12));
                const ptDocs = await getDocs(ptQuery);
                setFeaturedBusinesses(ptDocs.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) })));

                // Fetch featured jobs
                const jobQuery = query(collection(db, "jobsCollection"), where("isFeatured", "==", true), where("active", "==", true), limit(3));
                const jobDocs = await getDocs(jobQuery);
                setFeaturedJobs(jobDocs.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) })));

                // Fetch featured events
                const evtQuery = query(collection(db, "eventsCollection"), where("isFeatured", "==", true), where("active", "==", true), limit(3));
                const evtDocs = await getDocs(evtQuery);
                setFeaturedEvents(evtDocs.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) })));

                // Fetch featured consulting
                const consultingQuery = query(collection(db, "consultingCollection"), where("isFeatured", "==", true), where("active", "==", true), limit(12));
                const consultingDocs = await getDocs(consultingQuery);
                setFeaturedConsulting(consultingDocs.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) })));
            } catch (err) {
                console.error("Failed to load featured data:", err);
            }
        };
        fetchFeaturedData();
    }, []);
    return (
        <div className="w-full">
            {/* HERO SECTION */}
            <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
                {/* Background Image & Overlay */}
                <div className="absolute inset-x-0 bottom-0 z-0 h-[80%] overflow-hidden pointer-events-none">
                    {/* Layer 1 - Light and tallest */}
                    <svg className="absolute bottom-0 w-[200vw] h-[100%] animate-[wave_30s_linear_infinite]" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M0,60 C300,120 300,0 600,60 C900,120 900,0 1200,60 L1200,120 L0,120 Z" className="fill-sky-100/40" />
                    </svg>
                    {/* Layer 2 - High and reversed */}
                    <svg className="absolute bottom-0 w-[200vw] h-[85%] animate-[wave_25s_linear_infinite_reverse]" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M0,60 C200,120 400,0 600,60 C800,120 1000,0 1200,60 L1200,120 L0,120 Z" className="fill-blue-200/40" />
                    </svg>
                    {/* Layer 3 - Medium */}
                    <svg className="absolute bottom-0 w-[200vw] h-[70%] animate-[wave_20s_linear_infinite]" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M0,60 C400,120 200,0 600,60 C1000,120 800,0 1200,60 L1200,120 L0,120 Z" className="fill-sky-300/30" />
                    </svg>
                    {/* Layer 4 - Mid-short and reversed */}
                    <svg className="absolute bottom-0 w-[200vw] h-[55%] animate-[wave_15s_linear_infinite_reverse]" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M0,40 C300,100 300,0 600,40 C900,100 900,0 1200,40 L1200,120 L0,120 Z" className="fill-blue-400/20" />
                    </svg>
                    {/* Layer 5 - Shortest and deepest */}
                    <svg className="absolute bottom-0 w-[200vw] h-[40%] animate-[wave_12s_linear_infinite]" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M0,80 C300,140 300,20 600,80 C900,140 900,20 1200,80 L1200,120 L0,120 Z" className="fill-primary/20" />
                    </svg>
                </div>

                <div className="container relative z-10 px-4 py-32 mx-auto flex flex-col items-start text-left mt-8 md:mt-16">

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter mb-8 max-w-5xl leading-tight text-foreground drop-shadow-sm">
                        Building a Connected Ecosystem for<br />
                        <span className="text-primary">Life Sciences</span>
                    </h1>

                    <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mb-12 font-light leading-relaxed">
                        Bridging disciplines, sectors, and borders across the industry.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <Button size="lg" className="h-14 px-8 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/50 transition-all rounded-full" asChild>
                            <Link to="/signup">
                                Become a Partner <ArrowRight className="ml-2 w-5 h-5" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold border-foreground/20 bg-foreground/5 hover:bg-foreground/10 backdrop-blur-md rounded-full" asChild>
                            <Link to="/community">
                                <PlayCircle className="mr-2 w-5 h-5 text-primary" /> Explore Community
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* PARTNER CAROUSEL */}
            {featuredBusinesses.length > 0 && (
                <section className="py-12 bg-muted/20 border-y border-foreground/10 overflow-hidden">
                    <div className="container mx-auto px-4 mb-8">
                        <h3 className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">Trusted by Leading Organizations</h3>
                    </div>
                    <div className="relative flex w-full overflow-hidden">
                        {/* Gradient masks for smooth fading edges */}
                        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                        <AutoCarousel speed={40} direction="left" innerClassName="gap-6 px-3">
                            {featuredBusinesses.map((p, i) => (
                                <Link to={`/listing/business/${p.id}`} target="_blank" rel="noopener noreferrer" key={`carousel-${p.id}-${i}`} className="flex items-center justify-center min-w-[220px] max-w-[220px] h-24 px-6 bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group shrink-0">
                                    <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors text-center line-clamp-2">{p.businessName}</span>
                                </Link>
                            ))}
                        </AutoCarousel>
                    </div>
                </section>
            )}

            {/* CATEGORIES GRID */}
            <section className="py-24 bg-background relative z-10 border-b border-border">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-4xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">Discover, Connect & Collaborate</h2>
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

            {/* BUSINESS OFFERINGS CAROUSEL */}
            <section className="py-24 bg-background relative z-10 overflow-hidden">
                <div className="container mx-auto px-4 mb-12">
                    <div className="text-center max-w-4xl mx-auto">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Business Offerings</h2>
                        <p className="text-xl md:text-2xl text-primary font-medium mb-4">Find the right industry partners for your next stage of growth.</p>
                        <p className="text-muted-foreground text-lg">Explore curated life sciences providers, businesses, and expertise across specialized categories.</p>
                    </div>
                </div>

                <div className="relative flex w-full">
                    {/* Gradient masks for infinite scroll effect */}
                    <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                    {featuredBusinesses.length > 0 ? (
                        <AutoCarousel speed={50} direction="left" innerClassName="gap-6 px-3 pb-8">
                            {featuredBusinesses.map((b, i) => (
                                <Link to={`/listing/business/${b.id}`} target="_blank" rel="noopener noreferrer" key={`offering-${b.id}-${i}`} className="flex items-center justify-center text-center min-w-[320px] max-w-[320px] p-8 h-32 bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group shrink-0">
                                    <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">{b.businessName}</h3>
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
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Featured Consulting Services</h2>
                        <p className="text-xl md:text-2xl text-primary font-medium mb-4">Access a broad network of experts with deep knowledge of regional and global landscapes.</p>
                        <p className="text-muted-foreground text-lg">From established consulting firms to independent specialists, find the right partner to advance your project.</p>
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
                                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">{c.businessName}</h3>
                                </Link>
                            ))}
                        </AutoCarousel>
                    ) : (
                        <div className="w-full flex justify-center text-muted-foreground py-12">No featured consulting services available.</div>
                    )}
                </div>

                <div className="flex flex-col gap-24 mt-32 w-full overflow-hidden">
                    {/* Featured Events Carousel */}
                    <div className="flex flex-col items-center">
                        <div className="container mx-auto px-6 md:px-12 max-w-7xl text-center mb-12">
                            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-6">Featured Events</h2>
                            <p className="text-lg text-primary font-medium mb-3 max-w-3xl mx-auto">
                                Discover conferences and events shaping the biotech, pharmaceutical, and medical device sectors.
                            </p>
                            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                                Whether you're an industry leader, emerging entrepreneur, or passionate researcher, stay connected to the conversations and ideas moving life sciences forward.
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
                                                            <MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{evt.city || evt.location || "Online"}</span>
                                                        </div>
                                                    </div>
                                                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-4 leading-tight">{evt.eventName}</h3>
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
                            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-6">Featured Jobs</h2>
                            <p className="text-lg text-primary font-medium mb-3 max-w-3xl mx-auto">
                                Whether you're an experienced researcher, industry leader, or recent graduate, your next career move starts here.
                            </p>
                            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                                Explore opportunities aligned with your goals and take the next step in your life sciences journey.
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
                                                <div className="text-xs font-bold text-primary uppercase tracking-wider border border-primary/20 bg-primary/10 rounded-full px-3 py-1 w-fit">
                                                    {job.workModel || "Job Opening"}
                                                </div>
                                                <div className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5" /> {job.city || "Remote"}
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-2 leading-tight">{job.jobTitle}</h3>
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

            {/* COMMUNITY HIGHLIGHTS */}
            <section className="py-24 bg-muted/40 border-y border-foreground/10 relative">
                <div className="container mx-auto px-6 md:px-12 max-w-7xl">
                    <SectionHeader
                        title="Community Highlights"
                        subtitle="Trending discussions directly from the network."
                        action={<Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold px-8 h-12 rounded-full border-none"><Link to="/member/login">Become a member <ArrowRight className="ml-2 w-4 h-4" /></Link></Button>}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="bg-background/50 border-foreground/10 backdrop-blur-sm hover:border-primary/50 transition-colors">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4 mb-4">
                                        <Avatar>
                                            <AvatarImage src={`https://i.pravatar.cc/150?u=${i}`} />
                                            <AvatarFallback>U{i}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-semibold">Alex Mercer</p>
                                            <p className="text-xs text-muted-foreground">2 hours ago</p>
                                        </div>
                                    </div>
                                    <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3 mb-4">
                                        Just published our latest findings on CRISPR applications in agricultural science. The implications for drought resistance are monumental. Let's discuss the ethical frameworks needed for commercialization!
                                    </p>
                                    <div className="flex items-center gap-4 pt-4 border-t border-foreground/10 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1.5 hover:text-primary cursor-pointer"><ArrowRight className="w-3 h-3 rotate-45" /> 24 upvotes</span>
                                        <span className="flex items-center gap-1.5 hover:text-primary cursor-pointer"><MessageSquare className="w-3 h-3" /> 12 comments</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section >

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



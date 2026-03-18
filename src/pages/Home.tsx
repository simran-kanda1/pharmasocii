import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle, ShieldCheck, Building2, Users, Calendar, Briefcase, MessageSquare, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
                const ptQuery = query(collection(db, "partnersCollection"), where("isFeatured", "==", true), where("partnerStatus", "==", "Approved"), limit(3));
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
                const consultingQuery = query(collection(db, "consultingCollection"), where("isFeatured", "==", true), where("active", "==", true), limit(4));
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

                <div className="container relative z-10 px-4 py-32 mx-auto flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-foreground/10 backdrop-blur-md mb-8">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium tracking-wide">The Premier Network for Biotech</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter mb-8 max-w-5xl leading-tight text-foreground drop-shadow-sm">
                        Innovate Faster with <br />
                        <span className="text-primary">Pharmasocii</span>
                    </h1>

                    <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mb-12 font-light leading-relaxed">
                        Join the ultimate marketplace and community connecting pioneering biotech businesses, industry experts, groundbreaking events, and top-tier talent.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <Button size="lg" className="h-14 px-8 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/50 transition-all rounded-full" asChild>
                            <Link to="/signup">
                                Join the Marketplace <ArrowRight className="ml-2 w-5 h-5" />
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

            {/* FEATURED SECTIONS */}
            <section className="py-24 bg-background relative z-10">
                <div className="container mx-auto px-4">
                    <SectionHeader
                        title="Featured Businesses"
                        subtitle="Discover top companies driving biotech innovation."
                        icon={<Building2 className="w-6 h-6 text-primary" />}
                        action={<Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10">Add your business <ArrowRight className="ml-2 w-4 h-4" /></Button>}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                        {featuredBusinesses.length > 0 ? featuredBusinesses.map((b, i) => (
                            <TileCard key={b.id} title={b.businessName} subtitle={b.selectedGroup?.replace(/_/g, ' ') || "Partner"} img={`https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=800&sig=${i}`} />
                        )) : (
                            <div className="col-span-full h-40 flex items-center justify-center text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">No featured businesses available.</div>
                        )}
                    </div>

                    <div className="mt-32">
                        <SectionHeader
                            title="Featured Consulting Services"
                            subtitle="Connect with leading minds in research and development."
                            icon={<Users className="w-6 h-6 text-secondary" />}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                            {featuredConsulting.length > 0 ? featuredConsulting.map((c) => (
                                <Card key={c.id} className="group overflow-hidden border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer flex flex-col">
                                    <CardContent className="p-6 flex flex-col h-full">
                                        <div className="mb-4">
                                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary mb-2 uppercase tracking-wider">
                                                Consulting Service
                                            </div>
                                            <h4 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-1">{c.businessName}</h4>
                                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 truncate">
                                                <MapPin className="w-3.5 h-3.5 shrink-0" /> {c.businessAddress}
                                            </p>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-3 mb-6 flex-1">
                                            {c.companyProfileText}
                                        </p>
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-foreground/10">
                                            <span className="text-sm font-medium">View Service</span>
                                            <Button size="icon" variant="ghost" className="rounded-full w-8 h-8 bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowRight className="w-4 h-4 text-primary" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )) : (
                                <div className="col-span-full h-40 flex items-center justify-center text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">No featured consulting services available.</div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mt-32">
                        <div>
                            <SectionHeader
                                title="Featured Jobs"
                                subtitle="Your next career move in biotech."
                                icon={<Briefcase className="w-6 h-6 text-primary" />}
                            />
                            <div className="space-y-4 mt-8">
                                {featuredJobs.length > 0 ? featuredJobs.map((job) => (
                                    <Card key={job.id} className="group overflow-hidden border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer">
                                        <CardContent className="p-6 flex items-center justify-between">
                                            <div>
                                                <h4 className="text-xl font-bold group-hover:text-primary transition-colors">{job.jobTitle}</h4>
                                                <p className="text-sm text-muted-foreground mt-1">{job.businessName} &bull; {job.city || job.workModel}</p>
                                            </div>
                                            <Button size="icon" variant="ghost" className="rounded-full bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowRight className="w-4 h-4 text-primary" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )) : (
                                    <div className="h-40 flex items-center justify-center text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">No featured jobs available.</div>
                                )}
                            </div>
                        </div>

                        <div>
                            <SectionHeader
                                title="Featured Events"
                                subtitle="Gatherings, symposiums, and networking."
                                icon={<Calendar className="w-6 h-6 text-secondary" />}
                            />
                            <div className="space-y-4 mt-8">
                                {featuredEvents.length > 0 ? featuredEvents.map((evt) => {
                                    const dateObj = new Date(evt.startDate);
                                    const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                                    const day = dateObj.getUTCDate();
                                    return (
                                        <Card key={evt.id} className="group overflow-hidden border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer">
                                            <CardContent className="p-0 flex items-stretch h-24">
                                                <div className="w-24 bg-primary/20 flex flex-col items-center justify-center p-4 border-r border-foreground/10">
                                                    <span className="text-sm font-semibold text-primary">{month}</span>
                                                    <span className="text-2xl font-bold">{day}</span>
                                                </div>
                                                <div className="p-4 flex-1 flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-bold text-lg group-hover:text-primary transition-colors truncate max-w-xs">{evt.eventName}</h4>
                                                        <p className="text-sm text-muted-foreground">{evt.city || evt.location}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                }) : (
                                    <div className="h-40 flex items-center justify-center text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">No featured events available.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* COMMUNITY HIGHLIGHTS */}
            <section className="py-24 bg-muted/40 border-y border-foreground/10 relative">
                <div className="container mx-auto px-4">
                    <SectionHeader
                        title="Community Highlights"
                        subtitle="Trending discussions directly from the network."
                        icon={<MessageSquare className="w-6 h-6 text-primary" />}
                        action={<Button variant="outline" className="border-foreground/20 bg-foreground/5">View Community <ArrowRight className="ml-2 w-4 h-4" /></Button>}
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
            </section>

            {/* FAQ */}
            <section className="py-32 bg-background">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
                        <p className="text-muted-foreground">How the marketplace works.</p>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-1" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg hover:text-primary py-6">How do I list my business?</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                                Listing your business is straightforward. Simply create an account, navigate to the Partner Dashboard, and fill out your organization's details including services, biosafety levels, and certifications. Once approved by our team, your business will instantly appear in the marketplace.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg hover:text-primary py-6">How do I post a job?</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                                Active partners can post jobs directly from their dashboard. Jobs will be featured in the marketplace and recommended to relevant talent in our community network based on tags and industry matching.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg hover:text-primary py-6">How do I become a partner?</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                                Partnership is open to verified biotech entities and consultants. Visit our Partner page, select a subscription plan, and verify your credentials. Partners receive enhanced visibility, job posting capabilities, and analytics.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-4" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg hover:text-primary py-6">What industries are supported?</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                                We support a wide range of life sciences sectors including Pharmaceuticals, Genomics, Medical Devices, Agricultural Biotech, Bioinformatics, and Clinical Research among others.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
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

function TileCard({ title, subtitle, img }: { title: string, subtitle: string, img: string }) {
    return (
        <div className="group relative h-[400px] rounded-2xl overflow-hidden cursor-pointer border border-foreground/10">
            <div className="absolute inset-0 bg-muted/40 z-10 transition-opacity duration-500 group-hover:bg-black/20" />
            <div className="absolute inset-0 bg-muted/50 z-10" />
            <img src={img} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />

            <div className="absolute bottom-0 left-0 right-0 p-8 z-20 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <h3 className="text-2xl font-bold text-foreground mb-2">{title}</h3>
                <p className="text-foreground/80 font-medium mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">{subtitle}</p>

                <div className="flex items-center gap-2 text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200">
                    <span>View Profile</span>
                    <ArrowRight className="w-4 h-4" />
                </div>
            </div>
        </div>
    )
}

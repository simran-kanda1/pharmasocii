import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Compass,
    Sparkles,
    Shield,
    Users,
    ArrowUpCircle,
    HeartHandshake,
    Leaf,
    ArrowRight,
    Building2,
    Briefcase,
    MessageSquare,
    CheckCircle2,
    Globe2,
    Layers
} from "lucide-react";
import { Link } from "react-router-dom";

export default function AboutUs() {
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    return (
        <div className="flex flex-col w-full bg-background">
            {/* SECTION 1: HERO & THE FOUNDATION */}
            <section className="relative py-20 md:py-28 overflow-hidden bg-background border-b border-border/40">
                <div className="container relative z-10 mx-auto px-4 max-w-7xl">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                        <div className="lg:col-span-7 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>About Pharma SocII</span>
                            </div>
                            
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                                The Foundation
                            </h1>
                            
                            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-normal max-w-2xl">
                                We provide a centralized platform and community for the global life sciences ecosystem — bringing businesses, service providers, and professionals together in one structured place. Our environment supports discovery, knowledge-sharing, and collaboration that helps accelerate projects and advance therapies for patients worldwide.
                            </p>

                            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-l-4 border-primary shadow-sm">
                                <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                                    We are building this ecosystem together.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-4 pt-2">
                                <Button size="lg" className="h-12 px-6 rounded-full font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" asChild>
                                    <Link to="/member/register">
                                        Join Community <ArrowRight className="ml-2 w-4 h-4" />
                                    </Link>
                                </Button>
                                <Button size="lg" variant="outline" className="h-12 px-6 rounded-full font-semibold border-foreground/20 bg-foreground/5 hover:bg-foreground/10 transition-all" asChild>
                                    <Link to="/signup">
                                        Become a Partner
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <div className="lg:col-span-5 relative">
                            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-foreground/10 aspect-[4/3] lg:aspect-[4/5] bg-muted/40">
                                <img
                                    src="https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=1200"
                                    alt="Biotech Innovation & Life Sciences Collaboration"
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
                                <div className="absolute bottom-6 left-6 right-6 text-white pointer-events-none space-y-1.5">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/80 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-white">
                                        Global Ecosystem
                                    </div>
                                    <p className="text-xl font-bold text-white leading-snug">Connecting Life Sciences Globally</p>
                                    <p className="text-xs text-white/80 font-light">Discovery • Knowledge-Sharing • Collaboration</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 2: OUR NORTH STAR */}
            <section className="py-20 md:py-28 bg-muted/30 border-b border-border/40 relative overflow-hidden">
                <div className="container mx-auto px-4 max-w-7xl relative z-10">
                    <div className="max-w-4xl mx-auto">
                        <Card className="relative overflow-hidden bg-background border-primary/20 p-8 sm:p-12 md:p-16 shadow-xl rounded-3xl text-center">
                            {/* Decorative background glow */}
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-6 shadow-inner">
                                    <Compass className="w-9 h-9 sm:w-11 sm:h-11" />
                                </div>

                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-4">
                                    Guiding Purpose
                                </div>

                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-6">
                                    Our North Star
                                </h2>

                                <div className="max-w-3xl mx-auto">
                                    <p className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground/90 leading-relaxed sm:leading-snug">
                                        “To be the trusted home for collaboration, knowledge, and community in the global life sciences industry.”
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-10 pt-8 border-t border-border/60">
                                    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                                        <Users className="w-4 h-4 text-primary" />
                                        <span>Unified Community</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                                        <Layers className="w-4 h-4 text-primary" />
                                        <span>Shared Knowledge</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                                        <Globe2 className="w-4 h-4 text-primary" />
                                        <span>Global Collaboration</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION 3: WHAT WE OFFER */}
            <section className="py-20 md:py-28 bg-background border-b border-border/40">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">Why Pharma SocII?</h2>
                        <p className="text-muted-foreground text-base md:text-lg mt-3">An all-in-one ecosystem designed specifically for the life sciences landscape</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <Card className="border-foreground/10 p-8 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-2xl bg-background flex flex-col justify-between">
                            <div>
                                <div className="p-3 bg-primary/10 w-fit rounded-xl mb-6">
                                    <Building2 className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-3">Comprehensive Directory</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                                    Discover vetted business offerings, trusted consulting services, upcoming global conferences, and official health authority portals.
                                </p>
                            </div>
                            <ul className="space-y-2 text-xs text-foreground/80 font-medium border-t border-border/50 pt-4">
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Business Offerings</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Specialized Consulting</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Global Health Authorities</li>
                            </ul>
                        </Card>

                        <Card className="border-foreground/10 p-8 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-2xl bg-background flex flex-col justify-between">
                            <div>
                                <div className="p-3 bg-primary/10 w-fit rounded-xl mb-6">
                                    <MessageSquare className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-3">Interactive Community</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                                    Engage in thoughtful peer discussions, exchange insights, solve regulatory or operational challenges, and share breakthroughs with fellow members.
                                </p>
                            </div>
                            <ul className="space-y-2 text-xs text-foreground/80 font-medium border-t border-border/50 pt-4">
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Peer-to-Peer Discussions</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Expert Insights & Feedback</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Spam-free & Moderated</li>
                            </ul>
                        </Card>

                        <Card className="border-foreground/10 p-8 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300 rounded-2xl bg-background flex flex-col justify-between">
                            <div>
                                <div className="p-3 bg-primary/10 w-fit rounded-xl mb-6">
                                    <Briefcase className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-3">Career & Partner Growth</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                                    Showcase your specialized services with partner subscription plans or find top talent through dedicated life sciences job postings.
                                </p>
                            </div>
                            <ul className="space-y-2 text-xs text-foreground/80 font-medium border-t border-border/50 pt-4">
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Industry Job Openings</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Targeted Event Promotion</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Transparent Pricing Plans</li>
                            </ul>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION 4: CORE VALUES */}
            <section className="relative py-20 md:py-28 bg-muted/20 overflow-hidden">
                <div className="container relative z-10 mx-auto px-4 max-w-7xl">
                    <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">Our Core Values</h2>
                        <p className="text-muted-foreground text-base md:text-lg mt-3">The culture and commitments we bring to every partner and member interaction</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Value 1 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 rounded-2xl bg-background h-full flex flex-col">
                            <Shield className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Integrity</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                                Upholding the highest ethical standards in every interaction, fostering a culture of transparency, respect, and trust with our team and stakeholders.
                            </p>
                        </Card>
                        {/* Value 2 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 rounded-2xl bg-background h-full flex flex-col">
                            <Users className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Our Community</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                                Building seamless connections and creating value for users and partners, while embracing feedback as a key driver of growth and continuous improvement.
                            </p>
                        </Card>
                        {/* Value 3 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 rounded-2xl bg-background h-full flex flex-col">
                            <ArrowUpCircle className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Continuous Improvement</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                                Encouraging learning, adaptability, and innovation to continuously enhance our platform, processes, and life sciences directory services.
                            </p>
                        </Card>
                        {/* Value 4 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 rounded-2xl bg-background h-full flex flex-col">
                            <HeartHandshake className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Stronger Together</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                                Creating opportunities for learning and growth in a supportive and inclusive environment where every individual is valued and empowered to contribute.
                            </p>
                        </Card>
                        {/* Value 5 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 rounded-2xl bg-background h-full flex flex-col md:col-span-2 lg:col-span-2">
                            <Leaf className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Sustainability & Long-Term Impact</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                                Promoting responsible and sustainable practices across the life sciences ecosystem, recognizing that small, consistent actions lead to meaningful, long-term impact for global health and scientific discovery.
                            </p>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION 5: CTA */}
            <section className="py-24 md:py-32 bg-primary/5 border-t border-border/40 relative overflow-hidden">
                <div className="container mx-auto px-4 max-w-4xl text-center relative z-10 space-y-8">
                    <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        Join Us in Building the Future of Life Sciences Collaboration
                    </h2>
                    <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                        Whether you are an organization looking to reach industry leaders or a professional seeking meaningful connections, Pharma SocII is your hub.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                        <Button size="lg" className="h-14 px-8 text-base font-semibold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all rounded-full hover:scale-105" asChild>
                            <Link to="/signup">
                                Become a Partner <ArrowRight className="ml-2 w-5 h-5" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold border-foreground/20 bg-background/80 hover:bg-background rounded-full transition-all" asChild>
                            <Link to="/member/register">
                                Join Community Free
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}

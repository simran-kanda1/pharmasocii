import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Compass,
    Sparkles,
    Users,
    ArrowRight,
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
                            
                            <div className="space-y-4 text-lg md:text-xl text-muted-foreground leading-relaxed font-normal max-w-2xl">
                                <p>
                                    We provide a centralized platform and community for the global life sciences ecosystem — bringing businesses, service providers, and professionals together in one structured place.
                                </p>
                                <p>
                                    Our platform supports discovery, knowledge sharing, and collaboration that help accelerate projects and advance therapies for patients worldwide.
                                </p>
                            </div>

                            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-l-4 border-primary shadow-sm">
                                <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                                    We are building this ecosystem together.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-4 pt-2">
                                <Button size="lg" className="h-12 px-6 rounded-full font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" asChild>
                                    <Link to="/member/register">
                                        Join community <ArrowRight className="ml-2 w-4 h-4" />
                                    </Link>
                                </Button>
                                <Button size="lg" variant="outline" className="h-12 px-6 rounded-full font-semibold border-foreground/20 bg-foreground/5 hover:bg-foreground/10 transition-all" asChild>
                                    <Link to="/signup">
                                        Become a partner
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <div className="lg:col-span-5 relative flex justify-center">
                            <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden shadow-2xl border border-foreground/10 bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent flex items-center justify-center p-8 group">
                                <div className="absolute inset-0 bg-primary/5 group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
                                <div className="text-center space-y-4 z-10">
                                    <div className="w-20 h-20 mx-auto rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                            <div className="w-5 h-5 rounded-full bg-white animate-pulse" />
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-foreground tracking-tight">Unified Global Hub</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                        Connecting organizations, consultants, events, jobs, and health authorities globally.
                                    </p>
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
                                        To be the trusted home for collaboration, knowledge, and community in the global life sciences industry.
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

            {/* SECTION 5: CTA */}
            <section className="py-24 md:py-32 bg-primary/5 border-t border-border/40 relative overflow-hidden">
                <div className="container mx-auto px-4 max-w-4xl text-center relative z-10 space-y-8">
                    <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        Join Us in Building the Future of Life Sciences Collaboration
                    </h2>
                    <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                        Whether you are an organization looking to reach industry experts or a professional seeking meaningful connections, Pharma SocII is your hub.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                        <Button size="lg" className="h-14 px-8 text-base font-semibold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all rounded-full hover:scale-105" asChild>
                            <Link to="/signup">
                                Become a partner <ArrowRight className="ml-2 w-5 h-5" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold border-foreground/20 bg-background/80 hover:bg-background rounded-full transition-all" asChild>
                            <Link to="/member/register">
                                Join community free
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}

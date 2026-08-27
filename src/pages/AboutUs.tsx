import { useEffect } from "react";

export default function AboutUs() {
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    return (
        <div className="flex flex-col w-full bg-background">
            {/* SECTION 1: HERO & THE FOUNDATION */}
            <section className="relative py-20 md:py-28 overflow-hidden bg-background border-b border-border/40">
                <div className="container relative z-10 mx-auto px-4 max-w-4xl">
                    <div className="space-y-6">
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                            The Foundation
                        </h1>
                        
                        <div className="space-y-4 text-lg md:text-xl text-muted-foreground leading-relaxed font-normal">
                            <p>
                                We provide a centralized platform and community for the global life sciences ecosystem — bringing businesses, service providers, and professionals together in one structured place.
                            </p>
                            <p>
                                Our platform supports discovery, knowledge sharing, and collaboration that help accelerate projects and advance therapies for patients worldwide.
                            </p>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl bg-foreground/5 border-l-4 border-primary">
                            <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                                We are building this ecosystem together.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 2: OUR NORTH STAR */}
            <section className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
                <div className="container mx-auto px-4 max-w-4xl relative z-10">
                    <div className="bg-background border border-foreground/10 p-8 sm:p-12 md:p-16 shadow-xl rounded-3xl text-center">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-6">
                            Our North Star
                        </h2>

                        <div className="max-w-3xl mx-auto">
                            <p className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground/90 leading-relaxed sm:leading-snug">
                                To be the trusted home for collaboration, knowledge, and community in the global life sciences industry.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

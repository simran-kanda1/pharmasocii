import { Card } from "@/components/ui/card";
import { Users, Lightbulb, Target } from "lucide-react";

export default function AboutUs() {
    return (
        <div className="flex-1 w-full bg-background pt-24 pb-16">
            <div className="max-w-5xl mx-auto px-4 md:px-8 space-y-16">

                {/* Hero Section */}
                <div className="text-center space-y-6 max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
                        About <span className="text-primary">Pharmasocii</span>
                    </h1>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        We are building the premier digital marketplace to connect the brightest minds,
                        agile businesses, and emerging talent across the global biotech and pharmaceutical ecosystem.
                    </p>
                </div>

                {/* Mission & Vision */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                    <Card className="bg-foreground/5 border-foreground/10 p-8 shadow-2xl backdrop-blur-md">
                        <div className="bg-primary/20 w-14 h-14 flex items-center justify-center rounded-xl border border-primary/30 mb-6">
                            <Target className="text-primary w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground mb-4">Our Mission</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            To accelerate medical breakthroughs by removing the friction in scientific collaboration.
                            We believe that when specialized contract research organizations, innovative consultants,
                            and biotech companies can seamlessly find one another, innovation speeds up and costs go down.
                        </p>
                    </Card>

                    <Card className="bg-foreground/5 border-foreground/10 p-8 shadow-2xl backdrop-blur-md">
                        <div className="bg-secondary/20 w-14 h-14 flex items-center justify-center rounded-xl border border-secondary/30 mb-6">
                            <Lightbulb className="text-secondary w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground mb-4">Our Vision</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            To establish the centralized nexus of life sciences. A future where finding the
                            exact specialized bio-reactor, leading oncology statistician, or specific clinical
                            event is as simple as a single query. We provide the infrastructure for next-generation drug discovery.
                        </p>
                    </Card>
                </div>

                {/* Team / Stats */}
                <div className="bg-muted/40 border border-foreground/10 rounded-3xl p-12 text-center mt-16 max-w-4xl mx-auto">
                    <Users className="w-12 h-12 text-primary mx-auto mb-6 opacity-80" />
                    <h2 className="text-3xl font-bold text-foreground mb-6">Built for the Scientific Community</h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Pharmasocii is engineered specifically with the rigorous demands of the scientific community in mind.
                        We enforce strict verification to ensure our marketplace remains a high-trust environment where precision,
                        security, and expertise are paramount.
                    </p>
                </div>

            </div>
        </div>
    );
}

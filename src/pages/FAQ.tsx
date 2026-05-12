import { Link } from "react-router-dom";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

export default function FAQ() {
    return (
        <div className="flex-1 bg-background py-24 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-6 max-w-4xl relative z-10">
                <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-foreground">Frequently Asked Questions</h1>
                    <p className="text-xl md:text-2xl text-primary font-medium">How Pharmasocii works for partners and visitors.</p>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">
                    <Accordion type="single" collapsible className="w-full bg-foreground/5 p-8 md:p-12 rounded-3xl border border-foreground/10 shadow-xl backdrop-blur-sm">
                        <AccordionItem value="discovery" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">
                                How does partner discovery work?
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8">
                                Partners list businesses, experts, events, and jobs. Visitors browse{" "}
                                <Link to="/all-categories/business" className="text-primary hover:underline">
                                    All Categories
                                </Link>{" "}
                                and open a listing for full detail.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="list-business" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">
                                How do I list my business?
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8">
                                Create a partner account, complete your profile, then add listings from your partner dashboard. Once your plan and listing are active, your organization appears under the right categories in All Categories.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="job" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">
                                How do I post a job?
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8">
                                From the partner dashboard, add a job listing and upload a description PDF when prompted. Active jobs appear under Jobs in All Categories.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="partner" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">
                                How do I become a partner?
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8">
                                Choose{" "}
                                <Link to="/signup" className="text-primary font-medium hover:underline">
                                    Become a partner
                                </Link>{" "}
                                (partner registration), create your account, and pick a plan that fits your goals. Partners get listing tools, visibility options, and dashboard access.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="industries" className="border-foreground/10 border-b-0">
                            <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">
                                What industries are supported?
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8">
                                We cover life sciences categories from manufacturing and CRO services to regulatory and jobs. Open{" "}
                                <Link to="/all-categories/business" className="text-primary hover:underline">
                                    All Categories
                                </Link>{" "}
                                for the full category tree. The{" "}
                                <Link to="/community" className="text-primary hover:underline">
                                    Community
                                </Link>{" "}
                                is separate from partner listings and uses a member profile after sign-in.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>
        </div>
    );
}

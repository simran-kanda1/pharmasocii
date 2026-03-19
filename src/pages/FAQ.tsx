import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

export default function FAQ() {
    return (
        <div className="flex-1 bg-background py-24 relative overflow-hidden">
            {/* Subtle background flair */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-6 max-w-4xl relative z-10">
                <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-foreground">Frequently Asked Questions</h1>
                    <p className="text-xl md:text-2xl text-primary font-medium">How PharmaSocii works.</p>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">
                    <Accordion type="single" collapsible className="w-full bg-foreground/5 p-8 md:p-12 rounded-3xl border border-foreground/10 shadow-xl backdrop-blur-sm">
                        <AccordionItem value="item-1" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">How do I list my business?</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8">
                                Listing your business is straightforward. Simply create an account, navigate to the Partner Dashboard, and fill out your organization's details including services, biosafety levels, and certifications. Once approved by our team, your business will instantly appear in All Categories.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">How do I post a job?</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8">
                                Active partners can post jobs directly from their dashboard. Jobs will be featured in All Categories and recommended to relevant talent in our community network based on tags and industry matching.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3" className="border-foreground/10">
                            <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">How do I become a partner?</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8">
                                Partnership is open to verified biotech entities and consultants. Visit our Partner page, select a subscription plan, and verify your credentials. Partners receive enhanced visibility, job posting capabilities, and analytics.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-4" className="border-foreground/10 border-b-0">
                            <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">What industries are supported?</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8">
                                We support a wide range of life sciences sectors including Pharmaceuticals, Genomics, Medical Devices, Agricultural Biotech, Bioinformatics, and Clinical Research among others.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>
        </div>
    );
}

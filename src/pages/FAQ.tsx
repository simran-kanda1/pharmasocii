import { useState, useEffect } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { Loader2 } from "lucide-react";
import { FAQ_CATEGORIES } from "@/components/admin/AdminFaqsPanel";

type FAQDoc = {
    id: string;
    question: string;
    answer: string;
    category?: string;
    order: number;
};

export default function FAQ() {
    const [faqs, setFaqs] = useState<FAQDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "faqs"), orderBy("order", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FAQDoc));
            setFaqs(fetched);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Group FAQs by defined categories
    const categorizedFaqs = FAQ_CATEGORIES.map((category) => {
        const items = faqs.filter((faq) => {
            if (!faq.category && category === "General") return true;
            return faq.category === category;
        });
        return { category, items };
    });

    // Check for any FAQs with custom categories not in default list
    const otherItems = faqs.filter(
        (faq) => faq.category && !FAQ_CATEGORIES.includes(faq.category as any)
    );
    if (otherItems.length > 0) {
        categorizedFaqs.push({ category: "Other" as any, items: otherItems });
    }

    return (
        <div className="flex-1 bg-background py-24 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-6 max-w-4xl relative z-10">
                <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-foreground">Frequently Asked Questions</h1>
                    <p className="text-lg md:text-xl text-muted-foreground font-normal">How Pharma SocII works for partners and visitors</p>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both space-y-12">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : faqs.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground bg-foreground/5 p-8 rounded-3xl border border-foreground/10">
                            No FAQs available yet.
                        </div>
                    ) : (
                        categorizedFaqs.map(({ category, items }) => {
                            if (items.length === 0) return null;
                            return (
                                <div key={category} className="space-y-4">
                                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground border-b border-foreground/10 pb-3">
                                        {category}
                                    </h2>
                                    <Accordion type="single" collapsible className="w-full bg-foreground/5 p-6 md:p-8 rounded-2xl border border-foreground/10 shadow-lg backdrop-blur-sm">
                                        {items.map((faq, index) => (
                                            <AccordionItem 
                                                key={faq.id} 
                                                value={faq.id} 
                                                className={`border-foreground/10 ${index === items.length - 1 ? 'border-b-0' : ''}`}
                                            >
                                                <AccordionTrigger className="text-left text-base md:text-lg font-semibold hover:text-primary py-4 transition-colors">
                                                    {faq.question}
                                                </AccordionTrigger>
                                                <AccordionContent className="text-muted-foreground text-sm md:text-base leading-relaxed pb-6 whitespace-pre-wrap">
                                                    {faq.answer}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

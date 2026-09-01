import { useState, useEffect } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { Loader2, ChevronDown, HelpCircle } from "lucide-react";
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
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const q = query(collection(db, "faqs"), orderBy("order", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FAQDoc));
            setFaqs(fetched);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const toggleCategory = (cat: string) => {
        setOpenCategories(prev => ({
            ...prev,
            [cat]: !prev[cat],
        }));
    };

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
        <div className="flex-1 bg-background py-16 md:py-24">
            <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                <div className="text-center mb-12 md:mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
                        Frequently Asked Questions
                    </h1>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both space-y-4">
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
                            const isOpen = !!openCategories[category];

                            return (
                                <div
                                    key={category}
                                    className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] overflow-hidden shadow-sm transition-all duration-200 hover:border-foreground/20"
                                >
                                    {/* Category Header Button */}
                                    <button
                                        type="button"
                                        onClick={() => toggleCategory(category)}
                                        className="w-full flex items-center justify-between p-5 md:p-6 text-left transition-colors hover:bg-foreground/5 cursor-pointer select-none"
                                        aria-expanded={isOpen}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                <HelpCircle className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground">
                                                    {category}
                                                </h2>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {items.length} question{items.length === 1 ? "" : "s"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <span className="text-xs font-medium hidden sm:inline-block">
                                                {isOpen ? "Collapse" : "Expand"}
                                            </span>
                                            <div
                                                className={`w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center transition-transform duration-300 ${
                                                    isOpen ? "rotate-180 bg-primary/15 text-primary" : ""
                                                }`}
                                            >
                                                <ChevronDown className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </button>

                                    {/* Collapsible Questions List */}
                                    {isOpen && (
                                        <div className="border-t border-foreground/10 bg-background/50 p-4 sm:p-6 md:p-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <Accordion type="single" collapsible className="w-full">
                                                {items.map((faq, index) => (
                                                    <AccordionItem
                                                        key={faq.id}
                                                        value={faq.id}
                                                        className={`border-foreground/10 ${
                                                            index === items.length - 1 ? "border-b-0" : ""
                                                        }`}
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
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

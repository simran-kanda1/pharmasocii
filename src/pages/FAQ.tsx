import { useState, useEffect } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { Loader2 } from "lucide-react";

type FAQDoc = {
    id: string;
    question: string;
    answer: string;
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

    return (
        <div className="flex-1 bg-background py-24 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-6 max-w-4xl relative z-10">
                <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-foreground">Frequently Asked Questions</h1>
                    <p className="text-xl md:text-2xl text-primary font-medium">How Pharma SocII works for partners and visitors</p>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">
                    <Accordion type="single" collapsible className="w-full bg-foreground/5 p-8 md:p-12 rounded-3xl border border-foreground/10 shadow-xl backdrop-blur-sm">
                        
                        {loading ? (
                            <div className="flex justify-center items-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : faqs.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground">
                                No FAQs available yet.
                            </div>
                        ) : (
                            faqs.map((faq, index) => (
                                <AccordionItem 
                                    key={faq.id} 
                                    value={faq.id} 
                                    className={`border-foreground/10 ${index === faqs.length - 1 ? 'border-b-0' : ''}`}
                                >
                                    <AccordionTrigger className="text-left text-lg md:text-xl font-semibold hover:text-primary py-6 transition-colors">
                                        {faq.question}
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground text-base md:text-lg leading-relaxed pb-8 whitespace-pre-wrap">
                                        {faq.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))
                        )}

                    </Accordion>
                </div>
            </div>
        </div>
    );
}

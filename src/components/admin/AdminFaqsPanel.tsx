import { useState, useEffect } from "react";
import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    serverTimestamp,
    writeBatch
} from "firebase/firestore";
import { db } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Pencil, Trash2, Check, X } from "lucide-react";

export const FAQ_CATEGORIES = [
    "General",
    "Plans and Billing",
    "Partners",
    "Feature Plans",
    "Community Site"
] as const;

export type FAQCategory = typeof FAQ_CATEGORIES[number];

export type FAQDoc = {
    id: string;
    question: string;
    answer: string;
    category?: string;
    order: number;
    createdAt?: any;
};

const DEFAULT_FAQS = [
    {
        category: "General",
        question: "Open Beta Statement",
        answer: "Pharma SocII is currently offered as an open beta. All core features are available, but the Platform may evolve as we assess performance and gather feedback. During this phase, features may be modified, suspended, or discontinued, and you may encounter occasional bugs or limitations. We appreciate your participation and input as we improve the Platform.",
        order: 0
    },
    {
        category: "General",
        question: "What industries and categories are supported?",
        answer: "We cover life sciences categories from manufacturing and CRO services to consulting, events, regulatory compliance, and jobs. Open All Categories from the top menu to view the full category tree.",
        order: 1
    },
    {
        category: "Plans and Billing",
        question: "How does subscription billing work?",
        answer: "Subscriptions are billed on a recurring monthly or yearly cycle via Stripe. You can manage your plan, review invoices, or cancel anytime from the partner dashboard.",
        order: 2
    },
    {
        category: "Plans and Billing",
        question: "Can I change or cancel my plan?",
        answer: "Yes, you can upgrade, downgrade, or cancel your subscription at any time directly through the partner dashboard under your active plan settings.",
        order: 3
    },
    {
        category: "Partners",
        question: "How do I become a partner?",
        answer: "Click Become a partner from the navigation, register your account, and select the plan that matches your business needs to get started.",
        order: 4
    },
    {
        category: "Partners",
        question: "How do I list my business, consulting service, event, or job?",
        answer: "From your partner dashboard, select Add Listing and choose the relevant category group. Fill out your listing details and publish to make it visible to visitors worldwide.",
        order: 5
    },
    {
        category: "Feature Plans",
        question: "What are Feature / Spotlight Plans?",
        answer: "Spotlight add-ons and Premium Plus plans highlight your organization with prominent placement on the homepage and top category carousels for maximum visibility.",
        order: 6
    },
    {
        category: "Feature Plans",
        question: "How do I add a spotlight feature to my listing?",
        answer: "You can purchase or upgrade to a spotlight feature directly from your partner dashboard on any active listing.",
        order: 7
    },
    {
        category: "Community Site",
        question: "What is the Community Site?",
        answer: "The Community Site connects life sciences professionals, allowing members to share insights, discuss topics, bookmark discussions, and interact with peers across the industry.",
        order: 8
    },
    {
        category: "Community Site",
        question: "How do I join the Community?",
        answer: "Click Join community to create a member account. Once your profile is set up, you can engage with posts, share questions, and interact across discussion categories.",
        order: 9
    }
];

export function AdminFaqsPanel() {
    const [faqs, setFaqs] = useState<FAQDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    
    // Editor State
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editQuestion, setEditQuestion] = useState("");
    const [editAnswer, setEditAnswer] = useState("");
    const [editCategory, setEditCategory] = useState<string>("General");
    const [editOrder, setEditOrder] = useState<number>(0);

    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "faqs"), orderBy("order", "asc"));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FAQDoc));
            setFaqs(fetched);
            setLoading(false);

            // Auto-seed if empty and we haven't tried yet
            if (snapshot.empty && !isSeeding && fetched.length === 0) {
                await handleSeedFaqs();
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSeedFaqs = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            DEFAULT_FAQS.forEach((faq) => {
                const docRef = doc(collection(db, "faqs"));
                batch.set(docRef, {
                    ...faq,
                    createdAt: serverTimestamp()
                });
            });
            await batch.commit();
        } catch (e) {
            console.error("Failed to seed FAQs:", e);
        } finally {
            setIsSeeding(false);
        }
    };

    const handleSaveNew = async () => {
        if (!editQuestion.trim() || !editAnswer.trim()) return;
        try {
            await addDoc(collection(db, "faqs"), {
                question: editQuestion.trim(),
                answer: editAnswer.trim(),
                category: editCategory || "General",
                order: editOrder,
                createdAt: serverTimestamp()
            });
            setIsAdding(false);
            resetEditor();
        } catch (e) {
            console.error("Error adding FAQ:", e);
        }
    };

    const handleSaveEdit = async (id: string) => {
        if (!editQuestion.trim() || !editAnswer.trim()) return;
        try {
            await updateDoc(doc(db, "faqs", id), {
                question: editQuestion.trim(),
                answer: editAnswer.trim(),
                category: editCategory || "General",
                order: editOrder
            });
            setIsEditing(null);
            resetEditor();
        } catch (e) {
            console.error("Error updating FAQ:", e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this FAQ?")) return;
        try {
            await deleteDoc(doc(db, "faqs", id));
        } catch (e) {
            console.error("Error deleting FAQ:", e);
        }
    };

    const startAdd = () => {
        setIsAdding(true);
        setIsEditing(null);
        setEditQuestion("");
        setEditAnswer("");
        setEditCategory("General");
        setEditOrder(faqs.length > 0 ? Math.max(...faqs.map(f => f.order)) + 1 : 0);
    };

    const startEdit = (faq: FAQDoc) => {
        setIsEditing(faq.id);
        setIsAdding(false);
        setEditQuestion(faq.question);
        setEditAnswer(faq.answer);
        setEditCategory(faq.category || "General");
        setEditOrder(faq.order);
    };

    const resetEditor = () => {
        setIsAdding(false);
        setIsEditing(null);
        setEditQuestion("");
        setEditAnswer("");
        setEditCategory("General");
        setEditOrder(0);
    };

    if (loading || isSeeding) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 pb-4">
                <div>
                    <CardTitle className="text-xl font-bold text-slate-800">Frequently Asked Questions</CardTitle>
                    <CardDescription className="mt-1">Manage the FAQs displayed on the /faq page grouped by category. Lower order numbers appear first.</CardDescription>
                </div>
                {!isAdding && !isEditing && (
                    <Button onClick={startAdd} className="bg-blue-600 hover:bg-blue-700 gap-2">
                        <Plus className="w-4 h-4" /> Add FAQ
                    </Button>
                )}
            </CardHeader>
            <CardContent className="p-0">
                {(isAdding || isEditing) && (
                    <div className="p-6 border-b bg-blue-50/30 space-y-4">
                        <h3 className="font-semibold text-slate-800">{isAdding ? "Add New FAQ" : "Edit FAQ"}</h3>
                        <div className="grid gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Subheading / Category</label>
                                <select 
                                    value={editCategory}
                                    onChange={e => setEditCategory(e.target.value)}
                                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {FAQ_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Question</label>
                                <Input 
                                    value={editQuestion}
                                    onChange={e => setEditQuestion(e.target.value)}
                                    placeholder="e.g. How do I list my business?"
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Answer</label>
                                <Textarea 
                                    value={editAnswer}
                                    onChange={e => setEditAnswer(e.target.value)}
                                    placeholder="e.g. Create a partner account..."
                                    className="bg-white min-h-[100px]"
                                />
                            </div>
                            <div className="space-y-1.5 w-32">
                                <label className="text-sm font-medium text-slate-700">Display Order</label>
                                <Input 
                                    type="number"
                                    value={editOrder}
                                    onChange={e => setEditOrder(parseInt(e.target.value) || 0)}
                                    className="bg-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button onClick={() => isAdding ? handleSaveNew() : handleSaveEdit(isEditing!)} className="gap-2">
                                <Check className="w-4 h-4" /> Save
                            </Button>
                            <Button variant="outline" onClick={resetEditor} className="gap-2">
                                <X className="w-4 h-4" /> Cancel
                            </Button>
                        </div>
                    </div>
                )}

                <div className="divide-y divide-slate-100">
                    {faqs.length === 0 && !isAdding && (
                        <div className="p-8 text-center text-slate-500">
                            No FAQs found. Add one to get started.
                        </div>
                    )}
                    
                    {faqs.map(faq => (
                        <div key={faq.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 hover:bg-slate-50/50 transition-colors group">
                            <div className="flex-none pt-1">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-medium text-sm">
                                    {faq.order}
                                </div>
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                        {faq.category || "General"}
                                    </span>
                                </div>
                                <h4 className="font-medium text-slate-900">{faq.question}</h4>
                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{faq.answer}</p>
                            </div>
                            <div className="flex-none flex items-start gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="outline" className="h-8" onClick={() => startEdit(faq)}>
                                    <Pencil className="w-4 h-4 mr-1.5" /> Edit
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleDelete(faq.id)}>
                                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

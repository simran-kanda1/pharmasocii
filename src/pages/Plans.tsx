import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlanItem {
    id: string;
    badge: string;
    subtitle: string;
    monthlyPrice: number;
    yearlyMonthlyPrice: number; // e.g. $90/mo for basic
    yearlyTotalPrice: number; // e.g. $1080
    features: string[];
    isFeatured?: boolean;
}

export default function Plans() {
    const navigate = useNavigate();
    const [isYearly, setIsYearly] = useState(true);

    // 1. Business Offerings and Consulting Services
    const businessConsultingPlans: PlanItem[] = [
        {
            id: "basic",
            badge: "Basic",
            subtitle: "Individuals or businesses getting started.",
            monthlyPrice: 100,
            yearlyMonthlyPrice: 90,
            yearlyTotalPrice: 1080,
            features: [
                "Access to specialized categories — list up to 3",
                "List primary service country — 1",
                "Company profile to highlight your key offerings",
                "Display your logo for branding",
                "Direct website link",
                "Add representative(s) for direct communication",
                "Certifications (optional) — highlight relevant certifications",
                "Biosafety level (optional) — BSL disclosure"
            ]
        },
        {
            id: "standard",
            badge: "Standard",
            subtitle: "Individuals or businesses providing services in more than one country.",
            monthlyPrice: 200,
            yearlyMonthlyPrice: 182,
            yearlyTotalPrice: 2184,
            features: [
                "Access to specialized categories — list up to 5",
                "List primary service countries — up to 3",
                "Company profile to highlight your key offerings",
                "Display your logo for branding",
                "Direct website link",
                "Add representative(s) for direct communication",
                "Certifications (optional) — highlight relevant certifications",
                "Biosafety level (optional) — BSL disclosure"
            ]
        },
        {
            id: "premium",
            badge: "Premium",
            subtitle: "Businesses with a broader scope and presence",
            monthlyPrice: 400,
            yearlyMonthlyPrice: 360,
            yearlyTotalPrice: 4320,
            isFeatured: true,
            features: [
                "Access to specialized categories — list up to 15",
                "List primary service countries — up to 15",
                "Company profile to highlight your key offerings",
                "Display your logo for branding",
                "Direct website link",
                "Add representative(s) for direct communication",
                "Option to highlight certifications",
                "Optional BSL (Biosafety Level) disclosure"
            ]
        },
        {
            id: "premium_plus",
            badge: "Premium Plus",
            subtitle: "Businesses with a global presence",
            monthlyPrice: 1000,
            yearlyMonthlyPrice: 900,
            yearlyTotalPrice: 10800,
            features: [
                "Access to specialized categories — Unlimited",
                "List primary service countries — Unlimited",
                "Company profile to highlight your key offerings",
                "Display your logo for branding",
                "Direct website link",
                "Add representative(s) for direct communication",
                "Option to highlight certifications",
                "Optional BSL (Biosafety Level) disclosure",
                "Extra Feature: Homepage spotlight for increased visibility"
            ]
        }
    ];

    // 2. Events & Conferences Services
    const eventPlans: PlanItem[] = [
        {
            id: "event_basic",
            badge: "Basic",
            subtitle: "Single day conference/event",
            monthlyPrice: 500,
            yearlyMonthlyPrice: 500,
            yearlyTotalPrice: 6000,
            features: [
                "Event profile",
                "Agenda highlights (500 chars) + full agenda PDF",
                "Event date (single day)",
                "Event location",
                "Select multiple categories for better visibility",
                "Company profile",
                "Display your logo for branding",
                "Direct link to your site for easy sign up",
                "Add representative(s) for direct communication"
            ]
        },
        {
            id: "event_standard",
            badge: "Standard",
            subtitle: "Multi day conference/event",
            monthlyPrice: 850,
            yearlyMonthlyPrice: 850,
            yearlyTotalPrice: 10200,
            features: [
                "Event profile",
                "Agenda highlights (500 chars) + full agenda PDF",
                "Multi-day event dates",
                "Event location",
                "Select multiple categories for better visibility",
                "Company profile",
                "Display your logo for branding",
                "Direct link to your site for easy sign up",
                "Add representative(s) for direct communication"
            ]
        },
        {
            id: "event_premium",
            badge: "Premium",
            subtitle: "Single or multi-day conference/event",
            monthlyPrice: 1250,
            yearlyMonthlyPrice: 1250,
            yearlyTotalPrice: 15000,
            isFeatured: true,
            features: [
                "Extra Feature: Landing page spotlight for increased visibility",
                "Event profile",
                "Agenda highlights (500 chars) + full agenda PDF",
                "Multi-day event dates",
                "Event location",
                "Select multiple categories for better visibility",
                "Company profile",
                "Display your logo for branding",
                "Direct link to your site for easy sign up",
                "Add representative(s) for direct communication"
            ]
        },
        {
            id: "event_premium_plus",
            badge: "Premium Plus",
            subtitle: "Single or multi-day conference/event",
            monthlyPrice: 1450,
            yearlyMonthlyPrice: 1450,
            yearlyTotalPrice: 17400,
            features: [
                "Extra Feature: Home page spotlight for maximum visibility",
                "Event profile",
                "Agenda highlights (500 chars) + full agenda PDF",
                "Multi-day event dates",
                "Event location",
                "Select multiple categories",
                "Company profile",
                "Display your logo for branding",
                "Direct link to your site for easy sign up",
                "Add representative(s) for direct communication"
            ]
        }
    ];

    // 3. Jobs Services
    const jobPlans: PlanItem[] = [
        {
            id: "job_standard",
            badge: "Standard",
            subtitle: "Standard Job Listing",
            monthlyPrice: 400,
            yearlyMonthlyPrice: 400,
            yearlyTotalPrice: 4800,
            features: [
                "Position title for quick search",
                "Job description outlining key responsibilities",
                "Company profile to showcase your brand and attract top talent",
                "Direct link to your site for easy applications",
                "Display your logo for branding",
                "Location for filtering and relevance",
                "Industry classification to improve discoverability",
                "Add representative(s) for direct communication"
            ]
        },
        {
            id: "job_premium",
            badge: "Premium",
            subtitle: "Premium Job Listing",
            monthlyPrice: 800,
            yearlyMonthlyPrice: 800,
            yearlyTotalPrice: 9600,
            isFeatured: true,
            features: [
                "Extra Feature: Landing page spotlight for increased visibility",
                "Position title for quick search",
                "Job description outlining key responsibilities",
                "Company profile to showcase your brand and attract top talent",
                "Direct link to your site for easy applications",
                "Display your logo for branding",
                "Location for filtering and relevance",
                "Industry classification to improve discoverability",
                "Add representative(s) for direct communication"
            ]
        },
        {
            id: "job_premium_plus",
            badge: "Premium Plus",
            subtitle: "Premium Plus Job Listing",
            monthlyPrice: 1000,
            yearlyMonthlyPrice: 1000,
            yearlyTotalPrice: 12000,
            features: [
                "Extra Feature: Home page spotlight for maximum visibility",
                "Position title for quick search",
                "Job description outlining key responsibilities",
                "Company profile to showcase your brand and attract top talent",
                "Direct link to your site for easy applications",
                "Display your logo for branding",
                "Location for filtering and relevance",
                "Industry classification to improve discoverability",
                "Add representative(s) for direct communication"
            ]
        }
    ];

    return (
        <div className="relative min-h-screen bg-slate-50/50 pb-24 pt-12">
            {/* Background Decorative Blur Orbs */}
            <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-full max-w-7xl -translate-x-1/2 overflow-hidden opacity-30">
                <div className="absolute -left-20 top-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
            </div>

            <div className="container relative mx-auto px-4 max-w-7xl">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-6 mb-12">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                        Plans that fit every business size, budget, and stage. Choose yours today!
                    </h1>

                    {/* Monthly / Yearly Toggle */}
                    <div className="inline-flex items-center gap-3 pt-4">
                        <span className={`text-sm font-semibold transition-colors ${!isYearly ? "text-slate-900" : "text-slate-500"}`}>
                            Monthly
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsYearly(!isYearly)}
                            className="relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-800 transition-colors duration-200 ease-in-out focus:outline-none"
                            role="switch"
                            aria-checked={isYearly}
                        >
                            <span
                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    isYearly ? "translate-x-7" : "translate-x-0"
                                }`}
                            />
                        </button>
                        <span className={`text-sm font-semibold transition-colors flex items-center gap-1.5 ${isYearly ? "text-slate-900" : "text-slate-500"}`}>
                            Yearly
                        </span>
                    </div>
                </div>

                {/* SECTION 1: Business Offerings and Consulting Services */}
                <div className="mb-20">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 inline-block relative pb-2">
                            Business Offerings and Consulting Services.
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-900 rounded-full" />
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                        {businessConsultingPlans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                isYearly={isYearly}
                            />
                        ))}
                    </div>

                    <div className="flex justify-center mt-10">
                        <Button
                            onClick={() => navigate("/signup")}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-8 py-3 rounded-full flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                        >
                            Get Started <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* SECTION 2: Events & Conferences Services */}
                <div className="mb-20">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 inline-block relative pb-2">
                            Events &amp; Conferences Services
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-900 rounded-full" />
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                        {eventPlans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                isYearly={isYearly}
                                showDiscountTag={false}
                            />
                        ))}
                    </div>

                    <div className="flex justify-center mt-10">
                        <Button
                            onClick={() => navigate("/signup")}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-8 py-3 rounded-full flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                        >
                            Get Started <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* SECTION 3: Jobs Services */}
                <div className="mb-12">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 inline-block relative pb-2">
                            Jobs Services
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-900 rounded-full" />
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto">
                        {jobPlans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                isYearly={isYearly}
                                showDiscountTag={false}
                            />
                        ))}
                    </div>

                    <div className="flex justify-center mt-10">
                        <Button
                            onClick={() => navigate("/signup")}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-8 py-3 rounded-full flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                        >
                            Get Started <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
}

function PlanCard({
    plan,
    isYearly,
    showDiscountTag = true,
}: {
    plan: PlanItem;
    isYearly: boolean;
    showDiscountTag?: boolean;
}) {
    const displayPrice = isYearly ? plan.yearlyMonthlyPrice : plan.monthlyPrice;

    return (
        <div className={`relative flex flex-col justify-between rounded-2xl bg-white border ${plan.isFeatured ? "border-slate-800 shadow-md" : "border-slate-200/90 shadow-sm"} p-6 transition-all hover:shadow-md`}>
            {/* Top Badge */}
            <div className="text-center mb-4">
                <span className="inline-block bg-slate-900 text-white font-bold text-xs px-4 py-1 rounded-full uppercase tracking-wider">
                    {plan.badge}
                </span>
            </div>

            {/* Subtitle Box */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center mb-6 min-h-[56px] flex items-center justify-center">
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                    {plan.subtitle}
                </p>
            </div>

            {/* Price Header */}
            <div className="text-center mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                        {displayPrice.toLocaleString()} $
                    </span>
                    <span className="text-sm font-medium text-slate-500">/ month</span>
                </div>

                {isYearly && (
                    <div className="mt-1 space-y-0.5">
                        <p className="text-xs font-semibold text-slate-500">Billed Annually</p>
                        {showDiscountTag && plan.monthlyPrice !== plan.yearlyMonthlyPrice && (
                            <p className="text-xs font-bold text-emerald-600">Save 10%</p>
                        )}
                    </div>
                )}
            </div>

            {/* Features List */}
            <div className="flex-1 space-y-3">
                {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                        <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

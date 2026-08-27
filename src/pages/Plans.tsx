import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlansConfig, type PlanItem } from "@/hooks/usePlansConfig";

export default function Plans() {
    const navigate = useNavigate();
    const [isYearly, setIsYearly] = useState(true);
    const { config, loading, error } = usePlansConfig();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    if (error || !config) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
                Failed to load plans. Please try again later.
            </div>
        );
    }

    const getGridColsClass = (length: number) => {
        if (length === 1) return "grid-cols-1 max-w-md mx-auto";
        if (length === 2) return "grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto";
        if (length === 3) return "grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto";
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
    };

    return (
        <div className="relative min-h-screen bg-slate-50/50 pb-24 pt-12">
            <div className="container relative mx-auto px-4 max-w-7xl">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-6 mb-12">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                        Plans that fit every business size, budget, and stage
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 font-medium">
                        Choose yours today!
                    </p>

                    {/* Monthly / Annual Toggle */}
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
                            Annual
                        </span>
                    </div>
                </div>

                {/* Dynamic Sections */}
                {config.groups.map((group, index) => (
                    <div key={group.id} className={index === config.groups.length - 1 ? "mb-12" : "mb-20"}>
                        <div className="text-center mb-10">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 inline-block relative pb-2">
                                {group.title}
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-900 rounded-full" />
                            </h2>
                        </div>

                        <div className={`grid gap-6 items-stretch ${getGridColsClass(group.plans.length)}`}>
                            {group.plans.map((plan) => (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    isYearly={isYearly && group.hasAnnualToggle}
                                    showDiscountTag={group.hasAnnualToggle}
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
                ))}

                {/* Footnote */}
                <div className="mt-16 text-center border-t border-slate-200/80 pt-6 space-y-2">
                    <p className="text-sm text-slate-700 font-medium">
                        Not sure which plan fits your workflow? Reach out to us for a free trial period.
                    </p>
                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                        All prices are in USD. Plans auto‑renew. Access continues until the end of the paid period. No refunds.
                    </p>
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

    const extraFeatures = plan.features.filter((f) =>
        f.toLowerCase().includes("extra feature")
    );
    const standardFeatures = plan.features.filter(
        (f) => !f.toLowerCase().includes("extra feature")
    );

    return (
        <div className={`relative flex flex-col justify-between rounded-2xl bg-white border ${plan.isFeatured ? "border-slate-800 shadow-md" : "border-slate-200/90 shadow-sm"} p-6 transition-all hover:shadow-md`}>
            {/* Top Badge */}
            <div className="text-center mb-4">
                <span className="inline-block bg-slate-900 text-white font-bold text-xs px-4 py-1 rounded-full tracking-wider">
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
                        ${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-sm font-medium text-slate-500">/ month</span>
                </div>

                {isYearly && (
                    <div className="mt-1 space-y-0.5">
                        <p className="text-xs font-semibold text-slate-500">Billed annually</p>
                        {showDiscountTag && plan.monthlyPrice !== plan.yearlyMonthlyPrice && (
                            <p className="text-xs font-bold text-emerald-600">Save 10%</p>
                        )}
                    </div>
                )}
            </div>

            {/* Features List */}
            <div className="flex-1 flex flex-col">
                {/* Extra Feature Top Slot - strictly fixed height so standard features align 100% across all cards */}
                <div className="h-[56px] mb-5 flex items-center">
                    {extraFeatures.length > 0 ? (
                        <div className="w-full h-full bg-blue-50/90 border border-blue-200/90 rounded-xl px-3 py-1.5 flex items-center gap-2.5 shadow-sm">
                            <Check className="w-4 h-4 text-blue-600 shrink-0" />
                            <div className="text-[11px] leading-tight flex-1">
                                <span className="font-bold text-blue-700 block uppercase tracking-wider text-[9px]">
                                    Extra Feature
                                </span>
                                <span className="font-semibold text-slate-900 line-clamp-2">
                                    {extraFeatures[0].replace(/^Extra Feature:\s*/i, "")}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full" />
                    )}
                </div>

                {/* Standard Features */}
                <div className="space-y-3 flex-1">
                    {standardFeatures.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed min-h-[20px]">
                            <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

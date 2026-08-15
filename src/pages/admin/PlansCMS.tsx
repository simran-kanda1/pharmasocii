import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, ArrowUp, ArrowDown, X } from "lucide-react";
import { db } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { usePlansConfig, type PlanGroup, type PlanItem } from "@/hooks/usePlansConfig";

export default function PlansCMS() {
    const { config, loading } = usePlansConfig();
    const [groups, setGroups] = useState<PlanGroup[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (config && config.groups) {
            setGroups(JSON.parse(JSON.stringify(config.groups)));
        }
    }, [config]);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage("");
        try {
            await setDoc(doc(db, "config", "plansConfig"), { groups });
            setMessage("Successfully saved plans!");
        } catch (err: any) {
            setMessage("Error saving plans: " + err.message);
        }
        setIsSaving(false);
        setTimeout(() => setMessage(""), 3000);
    };

    const addGroup = () => {
        setGroups([...groups, {
            id: "new_group_" + Date.now(),
            title: "New Group",
            hasAnnualToggle: true,
            order: groups.length,
            plans: []
        }]);
    };

    const deleteGroup = (groupIndex: number) => {
        if (!confirm("Are you sure you want to delete this group?")) return;
        setGroups(groups.filter((_, i) => i !== groupIndex));
    };

    const updateGroup = (groupIndex: number, field: string, value: any) => {
        const newGroups = [...groups];
        newGroups[groupIndex] = { ...newGroups[groupIndex], [field]: value };
        setGroups(newGroups);
    };

    const addPlan = (groupIndex: number) => {
        const newGroups = [...groups];
        newGroups[groupIndex].plans.push({
            id: "plan_" + Date.now(),
            badge: "New Plan",
            subtitle: "Description here",
            monthlyPrice: 100,
            yearlyMonthlyPrice: 90,
            yearlyTotalPrice: 1080,
            features: ["Feature 1"],
            maxCategories: 3,
            maxCountries: 1,
            isFeatured: false,
            stripeMonthlyId: "",
            stripeYearlyId: "",
            tierRank: 1
        });
        setGroups(newGroups);
    };

    const deletePlan = (groupIndex: number, planIndex: number) => {
        if (!confirm("Are you sure you want to delete this plan?")) return;
        const newGroups = [...groups];
        newGroups[groupIndex].plans = newGroups[groupIndex].plans.filter((_, i) => i !== planIndex);
        setGroups(newGroups);
    };

    const updatePlan = (groupIndex: number, planIndex: number, field: keyof PlanItem, value: any) => {
        const newGroups = [...groups];
        newGroups[groupIndex].plans[planIndex] = { ...newGroups[groupIndex].plans[planIndex], [field]: value };
        setGroups(newGroups);
    };

    const updateFeature = (groupIndex: number, planIndex: number, featIndex: number, value: string) => {
        const newGroups = [...groups];
        newGroups[groupIndex].plans[planIndex].features[featIndex] = value;
        setGroups(newGroups);
    };

    const addFeature = (groupIndex: number, planIndex: number) => {
        const newGroups = [...groups];
        newGroups[groupIndex].plans[planIndex].features.push("");
        setGroups(newGroups);
    };

    const deleteFeature = (groupIndex: number, planIndex: number, featIndex: number) => {
        const newGroups = [...groups];
        newGroups[groupIndex].plans[planIndex].features = newGroups[groupIndex].plans[planIndex].features.filter((_, i) => i !== featIndex);
        setGroups(newGroups);
    };

    const movePlan = (groupIndex: number, planIndex: number, direction: 'up' | 'down') => {
        const newGroups = [...groups];
        const plans = newGroups[groupIndex].plans;
        if (direction === 'up' && planIndex > 0) {
            [plans[planIndex - 1], plans[planIndex]] = [plans[planIndex], plans[planIndex - 1]];
        } else if (direction === 'down' && planIndex < plans.length - 1) {
            [plans[planIndex + 1], plans[planIndex]] = [plans[planIndex], plans[planIndex + 1]];
        }
        setGroups(newGroups);
    };

    if (loading) return <div>Loading plans...</div>;

    return (
        <div className="space-y-8 p-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm sticky top-0 z-10 border border-slate-200">
                <div>
                    <h2 className="text-xl font-bold">Plans Content Management</h2>
                    <p className="text-sm text-slate-500">Changes made here instantly update the public Plans page and checkout limits.</p>
                </div>
                <div className="flex items-center gap-4">
                    {message && <span className="text-emerald-600 font-medium text-sm">{message}</span>}
                    <Button onClick={handleSave} disabled={isSaving} className="flex gap-2">
                        <Save className="w-4 h-4" />
                        {isSaving ? "Saving..." : "Save All Changes"}
                    </Button>
                </div>
            </div>

            {groups.map((group, groupIndex) => (
                <div key={groupIndex} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <Label>Group Title</Label>
                                    <Input value={group.title} onChange={e => updateGroup(groupIndex, 'title', e.target.value)} className="font-bold text-lg" />
                                </div>
                                <div className="w-48">
                                    <Label>System ID</Label>
                                    <Input value={group.id} onChange={e => updateGroup(groupIndex, 'id', e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id={`annual_${groupIndex}`} checked={group.hasAnnualToggle} onChange={e => updateGroup(groupIndex, 'hasAnnualToggle', e.target.checked)} />
                                <Label htmlFor={`annual_${groupIndex}`}>Show Monthly/Annual Toggle</Label>
                            </div>
                        </div>
                        <Button variant="destructive" size="icon" onClick={() => deleteGroup(groupIndex)}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {group.plans.map((plan, planIndex) => (
                                <div key={planIndex} className="bg-white border rounded-lg p-4 space-y-4 shadow-sm relative group">
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => movePlan(groupIndex, planIndex, 'up')} disabled={planIndex === 0}><ArrowUp className="w-3 h-3"/></Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => movePlan(groupIndex, planIndex, 'down')} disabled={planIndex === group.plans.length - 1}><ArrowDown className="w-3 h-3"/></Button>
                                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => deletePlan(groupIndex, planIndex)}><Trash2 className="w-3 h-3"/></Button>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <Label>Badge Name</Label>
                                            <Input value={plan.badge} onChange={e => updatePlan(groupIndex, planIndex, 'badge', e.target.value)} className="font-bold" />
                                        </div>
                                        <div>
                                            <Label>Subtitle</Label>
                                            <Textarea value={plan.subtitle} onChange={e => updatePlan(groupIndex, planIndex, 'subtitle', e.target.value)} rows={2} />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><Label>Monthly Price</Label><Input type="number" value={plan.monthlyPrice} onChange={e => updatePlan(groupIndex, planIndex, 'monthlyPrice', Number(e.target.value))} /></div>
                                            {group.hasAnnualToggle && <div><Label>Yearly (/mo equiv)</Label><Input type="number" value={plan.yearlyMonthlyPrice} onChange={e => updatePlan(groupIndex, planIndex, 'yearlyMonthlyPrice', Number(e.target.value))} /></div>}
                                            {group.hasAnnualToggle && <div><Label>Yearly Total</Label><Input type="number" value={plan.yearlyTotalPrice} onChange={e => updatePlan(groupIndex, planIndex, 'yearlyTotalPrice', Number(e.target.value))} /></div>}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div><Label>Max Categories (-1 for unlim)</Label><Input type="number" value={plan.maxCategories} onChange={e => updatePlan(groupIndex, planIndex, 'maxCategories', Number(e.target.value))} /></div>
                                            <div><Label>Max Countries (-1 for unlim)</Label><Input type="number" value={plan.maxCountries} onChange={e => updatePlan(groupIndex, planIndex, 'maxCountries', Number(e.target.value))} /></div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div><Label>Stripe Monthly ID</Label><Input value={plan.stripeMonthlyId || ""} onChange={e => updatePlan(groupIndex, planIndex, 'stripeMonthlyId', e.target.value)} /></div>
                                            <div><Label>Stripe Yearly ID</Label><Input value={plan.stripeYearlyId || ""} onChange={e => updatePlan(groupIndex, planIndex, 'stripeYearlyId', e.target.value)} /></div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" id={`feat_${groupIndex}_${planIndex}`} checked={plan.isFeatured} onChange={e => updatePlan(groupIndex, planIndex, 'isFeatured', e.target.checked)} />
                                                <Label htmlFor={`feat_${groupIndex}_${planIndex}`}>Highlighted Plan?</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Label>Tier Rank</Label>
                                                <Input type="number" className="w-16 h-8" value={plan.tierRank || 1} onChange={e => updatePlan(groupIndex, planIndex, 'tierRank', Number(e.target.value))} />
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t">
                                            <Label className="mb-2 block">Features</Label>
                                            <div className="space-y-2">
                                                {plan.features.map((feat, featIndex) => (
                                                    <div key={featIndex} className="flex gap-2">
                                                        <Input value={feat} onChange={e => updateFeature(groupIndex, planIndex, featIndex, e.target.value)} className="text-sm" />
                                                        <Button variant="ghost" size="icon" onClick={() => deleteFeature(groupIndex, planIndex, featIndex)} className="shrink-0 h-9 w-9"><X className="w-4 h-4"/></Button>
                                                    </div>
                                                ))}
                                                <Button variant="outline" size="sm" onClick={() => addFeature(groupIndex, planIndex)} className="w-full text-xs">
                                                    <Plus className="w-3 h-3 mr-1" /> Add Feature
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer min-h-[300px]" onClick={() => addPlan(groupIndex)}>
                                <div className="text-center text-slate-500">
                                    <Plus className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                    <span className="font-medium">Add Plan</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            <Button variant="outline" className="w-full border-dashed border-2 py-8" onClick={addGroup}>
                <Plus className="w-5 h-5 mr-2" /> Add New Group
            </Button>
        </div>
    );
}

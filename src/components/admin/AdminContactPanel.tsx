import { useState, useEffect } from "react";
import { db } from "@/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
    Loader2, 
    Plus, 
    Trash2, 
    ArrowUp, 
    ArrowDown, 
    RotateCcw, 
    ExternalLink, 
    Phone, 
    Mail, 
    CheckCircle2, 
    Building2, 
    Clock, 
    AlertCircle 
} from "lucide-react";
import { 
    DEFAULT_CONTACT_CONFIG, 
    type ContactConfig, 
    type ContactDepartment 
} from "@/lib/defaultContactConfig";

export function AdminContactPanel() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState("");
    const [error, setError] = useState("");

    const [config, setConfig] = useState<ContactConfig>(DEFAULT_CONTACT_CONFIG);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                setLoading(true);
                setError("");

                let activeConfig = DEFAULT_CONTACT_CONFIG;

                // 1. Check localStorage first
                const savedLocal = localStorage.getItem("pharmasocii_contact_config");
                if (savedLocal) {
                    try {
                        const parsed = JSON.parse(savedLocal);
                        if (parsed && Array.isArray(parsed.departments)) {
                            activeConfig = parsed;
                        }
                    } catch (e) {
                        console.error("Error parsing local contact config:", e);
                    }
                }

                // 2. Fetch from Firestore if available
                const docRef = doc(db, "config", "contactConfig");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as Partial<ContactConfig>;
                    if (data && Array.isArray(data.departments)) {
                        activeConfig = {
                            headline: data.headline || DEFAULT_CONTACT_CONFIG.headline,
                            subtitle: data.subtitle || DEFAULT_CONTACT_CONFIG.subtitle,
                            description: data.description || DEFAULT_CONTACT_CONFIG.description,
                            globalPhone: data.globalPhone ?? "",
                            globalAddress: data.globalAddress ?? "",
                            globalHours: data.globalHours || DEFAULT_CONTACT_CONFIG.globalHours,
                            showContactForm: data.showContactForm ?? true,
                            departments: data.departments,
                        };
                    }
                }

                setConfig(activeConfig);
                localStorage.setItem("pharmasocii_contact_config", JSON.stringify(activeConfig));
            } catch (err: any) {
                console.warn("Notice while fetching contact config (fallback in use):", err);
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaveSuccess("");
        setError("");

        // Immediate local sync
        localStorage.setItem("pharmasocii_contact_config", JSON.stringify(config));

        try {
            const docRef = doc(db, "config", "contactConfig");
            await setDoc(docRef, {
                ...config,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            setSaveSuccess("Contact page settings & phone numbers saved and published successfully!");
            setTimeout(() => setSaveSuccess(""), 5000);
        } catch (err: any) {
            console.warn("Firestore save notice:", err);
            setSaveSuccess("Settings saved locally for this session!");
            setTimeout(() => setSaveSuccess(""), 5000);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (window.confirm("Are you sure you want to reset all contact settings, emails, and phone numbers to default values?")) {
            setConfig(DEFAULT_CONTACT_CONFIG);
            localStorage.setItem("pharmasocii_contact_config", JSON.stringify(DEFAULT_CONTACT_CONFIG));
            setSaveSuccess("Contact settings reset to defaults. Click 'Save Changes' to publish.");
            setTimeout(() => setSaveSuccess(""), 5000);
        }
    };

    const handleDepartmentChange = (index: number, field: keyof ContactDepartment, value: string) => {
        const updated = [...config.departments];
        updated[index] = {
            ...updated[index],
            [field]: value,
        };
        setConfig(prev => ({ ...prev, departments: updated }));
    };

    const handleAddDepartment = () => {
        const newDept: ContactDepartment = {
            id: `dept_${Date.now()}`,
            title: "New Department Support",
            email: "support@pharmasocii.com",
            phone: "",
            description: "Direct inquiries and assistance for this department.",
            hours: "Mon – Fri: 9:00 AM – 5:00 PM EST",
            icon: "HelpCircle"
        };
        setConfig(prev => ({
            ...prev,
            departments: [...prev.departments, newDept],
        }));
    };

    const handleDeleteDepartment = (index: number) => {
        if (window.confirm(`Are you sure you want to remove '${config.departments[index].title}'?`)) {
            const updated = config.departments.filter((_, i) => i !== index);
            setConfig(prev => ({ ...prev, departments: updated }));
        }
    };

    const handleMoveDepartment = (index: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= config.departments.length) return;

        const updated = [...config.departments];
        const [moved] = updated.splice(index, 1);
        updated.splice(targetIndex, 0, moved);
        setConfig(prev => ({ ...prev, departments: updated }));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-slate-500 font-medium">Loading Contact Page Configuration...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header & Global Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Mail className="w-6 h-6 text-primary" />
                        Contact Us Page Management
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Configure the official emails, support departments, phone numbers (ph#s), and hours displayed on the public Contact page.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        asChild 
                        className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                        <a href="/contact" target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Public Page
                        </a>
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleReset} 
                        className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset Defaults
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/20"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Changes"
                        )}
                    </Button>
                </div>
            </div>

            {/* Notification Messages */}
            {saveSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 shadow-sm animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-medium">{saveSuccess}</p>
                </div>
            )}
            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3 shadow-sm">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* General Page Information Card */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-slate-600" />
                        Page Titles & General Info
                    </CardTitle>
                    <CardDescription>
                        Set the headline, callout question ("Got Questions?"), and optional company-wide phone or address.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">
                                Subtitle / Prompt
                            </label>
                            <Input 
                                value={config.subtitle}
                                onChange={(e) => setConfig(prev => ({ ...prev, subtitle: e.target.value }))}
                                placeholder="Got Questions?"
                                className="bg-white border-slate-200"
                            />
                            <p className="text-xs text-slate-400 mt-1">Shown prominently above or alongside the main heading.</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">
                                Page Headline
                            </label>
                            <Input 
                                value={config.headline}
                                onChange={(e) => setConfig(prev => ({ ...prev, headline: e.target.value }))}
                                placeholder="Contact Us"
                                className="bg-white border-slate-200"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">
                            Page Description / Welcome Text
                        </label>
                        <Textarea 
                            rows={2}
                            value={config.description}
                            onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="We are here to support your collaboration..."
                            className="bg-white border-slate-200"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3 border-t border-slate-100">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-primary" />
                                Main Company Phone (ph#)
                            </label>
                            <Input 
                                value={config.globalPhone || ""}
                                onChange={(e) => setConfig(prev => ({ ...prev, globalPhone: e.target.value }))}
                                placeholder="+1 (800) 555-0199 (Optional)"
                                className="bg-white border-slate-200"
                            />
                            <p className="text-xs text-slate-400 mt-1">Leave blank if no global phone is needed yet.</p>
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                Operating Hours
                            </label>
                            <Input 
                                value={config.globalHours || ""}
                                onChange={(e) => setConfig(prev => ({ ...prev, globalHours: e.target.value }))}
                                placeholder="Monday – Friday: 9:00 AM – 6:00 PM EST"
                                className="bg-white border-slate-200"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-primary" />
                                Office Address / Location
                            </label>
                            <Input 
                                value={config.globalAddress || ""}
                                onChange={(e) => setConfig(prev => ({ ...prev, globalAddress: e.target.value }))}
                                placeholder="e.g., Boston, MA / Global Digital Hub (Optional)"
                                className="bg-white border-slate-200"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Departments & Contact Channels Editor */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                            Support Departments & Channels ({config.departments.length})
                        </h3>
                        <p className="text-xs text-slate-500">
                            Edit emails, assign direct phone numbers (ph#s), descriptions, or add new channels.
                        </p>
                    </div>
                    <Button 
                        size="sm" 
                        onClick={handleAddDepartment} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Add Department
                    </Button>
                </div>

                <div className="space-y-4">
                    {config.departments.map((dept, index) => (
                        <Card key={dept.id || index} className="border-slate-200 shadow-sm bg-white overflow-hidden transition-all hover:border-primary/40">
                            <div className="bg-slate-50/70 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                                        {index + 1}
                                    </span>
                                    <span className="font-bold text-slate-800 text-sm">
                                        {dept.title || "Untitled Department"}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={index === 0}
                                        onClick={() => handleMoveDepartment(index, "up")}
                                        className="h-8 w-8 text-slate-500 hover:text-slate-900"
                                        title="Move Up"
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={index === config.departments.length - 1}
                                        onClick={() => handleMoveDepartment(index, "down")}
                                        className="h-8 w-8 text-slate-500 hover:text-slate-900"
                                        title="Move Down"
                                    >
                                        <ArrowDown className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteDepartment(index)}
                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        title="Delete Department"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <CardContent className="p-5 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1">
                                            Department Name <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            value={dept.title}
                                            onChange={(e) => handleDepartmentChange(index, "title", e.target.value)}
                                            placeholder="e.g. General Inquiries"
                                            className="bg-white border-slate-200 font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1 flex items-center gap-1.5">
                                            <Mail className="w-3.5 h-3.5 text-primary" />
                                            Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            type="email"
                                            value={dept.email}
                                            onChange={(e) => handleDepartmentChange(index, "email", e.target.value)}
                                            placeholder="e.g. general@pharmasocii.com"
                                            className="bg-white border-slate-200"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1 flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5 text-blue-600" />
                                            Phone Number (ph#)
                                        </label>
                                        <Input
                                            value={dept.phone || ""}
                                            onChange={(e) => handleDepartmentChange(index, "phone", e.target.value)}
                                            placeholder="e.g. +1 (555) 123-4567 (Optional)"
                                            className="bg-white border-slate-200"
                                        />
                                        <p className="text-[11px] text-slate-400 mt-1">Leave empty or add phone number anytime.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1">
                                            Short Description / Helper Text
                                        </label>
                                        <Input
                                            value={dept.description || ""}
                                            onChange={(e) => handleDepartmentChange(index, "description", e.target.value)}
                                            placeholder="e.g. General questions and platform inquiries."
                                            className="bg-white border-slate-200"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                                            Availability / Hours
                                        </label>
                                        <Input
                                            value={dept.hours || ""}
                                            onChange={(e) => handleDepartmentChange(index, "hours", e.target.value)}
                                            placeholder="e.g. Mon – Fri: 9:00 AM – 6:00 PM EST"
                                            className="bg-white border-slate-200"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Bottom Save Bar */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
                <Button 
                    variant="outline" 
                    onClick={handleReset} 
                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset Defaults
                </Button>
                <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-md shadow-primary/20"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        "Save & Publish Contact Page"
                    )}
                </Button>
            </div>
        </div>
    );
}

import { useState, useEffect } from "react";
import { db } from "@/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";

export function AdminSitePoliciesPanel() {
    const [activeTab, setActiveTab] = useState<"terms" | "privacy" | "guidelines">("terms");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState("");
    const [error, setError] = useState("");

    const [policies, setPolicies] = useState({
        termsOfUse: "",
        privacyPolicy: "",
        communityGuidelines: "",
    });

    useEffect(() => {
        const fetchPolicies = async () => {
            try {
                setLoading(true);
                setError("");
                const docRef = doc(db, "config", "sitePolicies");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setPolicies({
                        termsOfUse: data.termsOfUse || "",
                        privacyPolicy: data.privacyPolicy || "",
                        communityGuidelines: data.communityGuidelines || "",
                    });
                }
            } catch (err: any) {
                console.error("Error fetching site policies:", err);
                if (err?.code === "permission-denied") {
                    setError("Firestore Permission Denied: Please update your Firestore Security Rules in the Firebase Console to allow access to match /config/{configId}. We have added the updated rules to firestore.rules in the codebase.");
                } else {
                    console.log("No existing policy document found or error reading document, ready for initial input.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchPolicies();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaveSuccess("");
        setError("");

        try {
            const docRef = doc(db, "config", "sitePolicies");
            await setDoc(docRef, {
                ...policies,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            setSaveSuccess("Policies updated successfully! The main site pages will reflect these changes immediately.");
            setTimeout(() => setSaveSuccess(""), 5000);
        } catch (err: any) {
            console.error("Error saving site policies:", err);
            setError(err.message || "Failed to save site policies.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 bg-white rounded-lg border">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500 mr-2" />
                <span className="text-slate-600 font-medium">Loading Site Policies...</span>
            </div>
        );
    }

    return (
        <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="border-b pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-bold text-slate-900">Site Policies &amp; Legal Agreements</CardTitle>
                        <CardDescription className="text-sm text-slate-500 mt-1">
                            Edit and publish updates for the Terms of Use, Privacy Policy, and Community Guidelines. Updates apply live to the website.
                        </CardDescription>
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save All Policies
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
                {saveSuccess && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        {saveSuccess}
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Sub-tab navigation */}
                <div className="flex border-b border-slate-200 gap-2">
                    <button
                        onClick={() => setActiveTab("terms")}
                        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                            activeTab === "terms"
                                ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        } rounded-t-lg`}
                    >
                        Terms of Service
                    </button>
                    <button
                        onClick={() => setActiveTab("privacy")}
                        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                            activeTab === "privacy"
                                ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        } rounded-t-lg`}
                    >
                        Privacy Policy
                    </button>
                    <button
                        onClick={() => setActiveTab("guidelines")}
                        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                            activeTab === "guidelines"
                                ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        } rounded-t-lg`}
                    >
                        Community Guidelines
                    </button>
                </div>

                {/* Editor Content Area */}
                <div className="space-y-3">
                    {activeTab === "terms" && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Terms of Service Content (Supports Plain Text or HTML)
                            </label>
                            <Textarea
                                value={policies.termsOfUse}
                                onChange={(e) => setPolicies((prev) => ({ ...prev, termsOfUse: e.target.value }))}
                                placeholder="Enter updated Terms of Use..."
                                className="min-h-[500px] font-mono text-sm leading-relaxed p-4 bg-slate-50 border-slate-300"
                            />
                        </div>
                    )}

                    {activeTab === "privacy" && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Privacy Policy Content (Supports Plain Text or HTML)
                            </label>
                            <Textarea
                                value={policies.privacyPolicy}
                                onChange={(e) => setPolicies((prev) => ({ ...prev, privacyPolicy: e.target.value }))}
                                placeholder="Enter updated Privacy Policy..."
                                className="min-h-[500px] font-mono text-sm leading-relaxed p-4 bg-slate-50 border-slate-300"
                            />
                        </div>
                    )}

                    {activeTab === "guidelines" && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Community Guidelines Content (Supports Plain Text or HTML)
                            </label>
                            <Textarea
                                value={policies.communityGuidelines}
                                onChange={(e) => setPolicies((prev) => ({ ...prev, communityGuidelines: e.target.value }))}
                                placeholder="Enter updated Community Guidelines..."
                                className="min-h-[500px] font-mono text-sm leading-relaxed p-4 bg-slate-50 border-slate-300"
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save All Policies
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

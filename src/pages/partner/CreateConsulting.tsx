import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save, Users } from "lucide-react";

export default function CreateConsulting() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        primaryName: "",
        businessName: "",
        businessAddress: "",
        companyProfileText: ""
    });

    useEffect(() => {
        const fetchPartnerData = async () => {
            if (auth.currentUser) {
                const docSnap = await getDoc(doc(db, "partnersCollection", auth.currentUser.uid));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFormData(prev => ({
                        ...prev,
                        businessName: data.businessName || "",
                        primaryName: data.primaryName || "",
                        businessAddress: data.businessAddress || ""
                    }));
                }
            }
        };
        fetchPartnerData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (!auth.currentUser) throw new Error("Authentication required");

            const constRef = collection(db, "consultingCollection");

            await addDoc(constRef, {
                primaryName: formData.primaryName,
                businessName: formData.businessName,
                businessAddress: formData.businessAddress,
                companyProfileText: formData.companyProfileText,
                partnerId: auth.currentUser.uid,
                active: true,
                isFeatured: true, // For demo showcase
                createdAt: serverTimestamp()
            });

            navigate("/partner/dashboard");
        } catch (err) {
            console.error(err);
            alert("Failed to save consulting service");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 w-full bg-background p-8 md:p-12 lg:p-16">
            <div className="max-w-4xl mx-auto space-y-8">
                <Button variant="ghost" className="text-muted-foreground hover:text-white mb-6 -ml-4" onClick={() => navigate("/partner/dashboard")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </Button>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-2xl">
                    <CardHeader className="pb-8 border-b border-white/5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-primary/20 p-2 rounded-lg border border-primary/30 text-primary">
                                <Users className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-3xl text-white">Create Consulting Service</CardTitle>
                        </div>
                        <CardDescription className="text-base text-muted-foreground ml-1">
                            Payment verified cleanly. Please construct your consulting profile below. This will appear under Consulting Services in the marketplace.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <Label htmlFor="primaryName" className="text-white/80">Consultant / Primary Name *</Label>
                                    <Input id="primaryName" required placeholder="e.g. Dr. Sarah Jenkins" value={formData.primaryName} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="businessName" className="text-white/80">Company / Affiliation *</Label>
                                    <Input id="businessName" required placeholder="e.g. BioTech Innovations LLC" value={formData.businessName} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3 md:col-span-2">
                                    <Label htmlFor="businessAddress" className="text-white/80">Location / Remote Status *</Label>
                                    <Input id="businessAddress" required placeholder="e.g. Remote, or New York, NY" value={formData.businessAddress} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3 md:col-span-2">
                                    <Label htmlFor="companyProfileText" className="text-white/80">Consulting Overview & Expertise *</Label>
                                    <Textarea id="companyProfileText" required placeholder="Describe your specialized knowledge, services offered, and prior consulting experience..." value={formData.companyProfileText} onChange={handleChange} className="min-h-[160px] bg-black/40 border-white/10 text-white" />
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/10 flex justify-end">
                                <Button type="button" variant="outline" className="mr-4 border-white/10 text-white hover:bg-white/10" onClick={() => navigate("/partner/dashboard")}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading} className="px-8 shadow-lg shadow-primary/20 hover:shadow-primary/40 text-black">
                                    <Save className="w-4 h-4 mr-2 text-black" />
                                    {loading ? "Publishing Profile..." : "Publish Profile Live"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

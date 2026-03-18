import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save, Building2 } from "lucide-react";

export default function CreateBusinessOffering() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        planId: "premium_plus_mo",
        bioSafetyLevel: "",
        certifications: "",
        serviceRegions: "",
        serviceCountries: "",
        categories: ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (!auth.currentUser) throw new Error("Authentication required");

            const partnerRef = doc(db, "partnersCollection", auth.currentUser.uid);
            const offeringsRef = collection(partnerRef, "businessOfferingsCollection");

            await addDoc(offeringsRef, {
                planId: formData.planId,
                bioSafetyLevel: formData.bioSafetyLevel.split(",").map(s => s.trim()).filter(Boolean),
                certifications: formData.certifications.split(",").map(s => s.trim()).filter(Boolean),
                serviceRegions: formData.serviceRegions.split(",").map(s => s.trim()).filter(Boolean),
                serviceCountries: formData.serviceCountries.split(",").map(s => s.trim()).filter(Boolean),
                categories: formData.categories.split(",").map(s => s.trim()).filter(Boolean),
                createdAt: serverTimestamp()
            });

            navigate("/partner/dashboard");
        } catch (err) {
            console.error(err);
            alert("Failed to save offering");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 w-full bg-background p-8 md:p-12 lg:p-16">
            <div className="max-w-4xl mx-auto space-y-8">
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground mb-6 -ml-4" onClick={() => navigate("/partner/dashboard")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </Button>

                <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md shadow-2xl">
                    <CardHeader className="pb-8 border-b border-foreground/10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-primary/20 p-2 rounded-lg border border-primary/30 text-primary">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-3xl text-foreground">Create Business Offering</CardTitle>
                        </div>
                        <CardDescription className="text-base text-muted-foreground ml-1">
                            Payment verified cleanly. Please configure your new business offering listing below.
                            Use comma-separated values where multiple entries are supported for arrays.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <Label htmlFor="bioSafetyLevel" className="text-foreground/80">Bio Safety Level (BSL)</Label>
                                    <Input id="bioSafetyLevel" placeholder="e.g. BSL-1, BSL-2" value={formData.bioSafetyLevel} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 focus-visible:ring-primary/50 text-foreground" />
                                    <p className="text-xs text-muted-foreground">Highest clearance you operate at</p>
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="certifications" className="text-foreground/80">Certifications</Label>
                                    <Input id="certifications" placeholder="e.g. ISO 9001, GMP, FDA Approved" value={formData.certifications} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 focus-visible:ring-primary/50 text-foreground" />
                                    <p className="text-xs text-muted-foreground">List all valid regulatory auths</p>
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="serviceRegions" className="text-foreground/80">Service Region(s)</Label>
                                    <Input id="serviceRegions" placeholder="e.g. North America, Europe, Asia Pacific" value={formData.serviceRegions} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 focus-visible:ring-primary/50 text-foreground" />
                                    <p className="text-xs text-muted-foreground">Macro geographical footprint</p>
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="serviceCountries" className="text-foreground/80">Service Countries</Label>
                                    <Input id="serviceCountries" placeholder="e.g. United States, Canada, Germany" value={formData.serviceCountries} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 focus-visible:ring-primary/50 text-foreground" />
                                    <p className="text-xs text-muted-foreground">Exact operational countries</p>
                                </div>
                                <div className="space-y-3 md:col-span-2">
                                    <Label htmlFor="categories" className="text-foreground/80">Listing Categories</Label>
                                    <Input id="categories" placeholder="e.g. Artificial Intelligence, Bioinformatics, Automation" value={formData.categories} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 focus-visible:ring-primary/50 text-foreground" />
                                    <p className="text-xs text-muted-foreground">List up to 15 relevant directory mappings</p>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-foreground/10 flex justify-end">
                                <Button type="button" variant="outline" className="mr-4 border-foreground/10 text-foreground hover:bg-foreground/10" onClick={() => navigate("/partner/dashboard")}>
                                    Cancel Setup
                                </Button>
                                <Button type="submit" disabled={loading} className="px-8 shadow-lg shadow-primary/20 hover:shadow-primary/40 text-black">
                                    <Save className="w-4 h-4 mr-2 text-black" />
                                    {loading ? "Publishing Offering..." : "Publish Offering Live"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

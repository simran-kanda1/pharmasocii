import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save, Briefcase } from "lucide-react";

export default function CreateJob() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [businessName, setBusinessName] = useState("");

    const [formData, setFormData] = useState({
        jobTitle: "",
        industry: "",
        country: "",
        state: "",
        city: "",
        experienceLevel: "",
        positionLink: "",
        jobSummary: "",
        jobtype: "",
        workModel: ""
    });

    useEffect(() => {
        const fetchPartner = async () => {
            if (auth.currentUser) {
                const docSnap = await getDoc(doc(db, "partnersCollection", auth.currentUser.uid));
                if (docSnap.exists() && docSnap.data().businessName) {
                    setBusinessName(docSnap.data().businessName);
                }
            }
        };
        fetchPartner();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (!auth.currentUser) throw new Error("Authentication required");

            const jobsRef = collection(db, "jobsCollection");

            await addDoc(jobsRef, {
                ...formData,
                partnerId: auth.currentUser.uid,
                businessName: businessName,
                active: true,
                isFeatured: true,
                createdAt: serverTimestamp()
            });

            navigate("/partner/dashboard");
        } catch (err) {
            console.error(err);
            alert("Failed to save job listing");
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
                                <Briefcase className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-3xl text-white">Post a Job Listing</CardTitle>
                        </div>
                        <CardDescription className="text-base text-muted-foreground ml-1">
                            Payment verified cleanly. Please configure your new job opportunity below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3 md:col-span-2">
                                    <Label htmlFor="jobTitle" className="text-white/80">Job Title *</Label>
                                    <Input id="jobTitle" required placeholder="e.g. Senior Bioinformatics Scientist" value={formData.jobTitle} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="industry" className="text-white/80">Industry / Field *</Label>
                                    <Input id="industry" required placeholder="e.g. Data Science, Oncology" value={formData.industry} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="experienceLevel" className="text-white/80">Experience Level *</Label>
                                    <Input id="experienceLevel" required placeholder="e.g. Entry, Mid-Level, Director" value={formData.experienceLevel} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="jobtype" className="text-white/80">Job Type *</Label>
                                    <select id="jobtype" required value={formData.jobtype} onChange={handleChange} className="flex h-12 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                                        <option value="" disabled>Select type</option>
                                        <option value="Full-Time">Full-Time</option>
                                        <option value="Part-Time">Part-Time</option>
                                        <option value="Contract">Contract</option>
                                        <option value="Internship">Internship</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="workModel" className="text-white/80">Work Model *</Label>
                                    <select id="workModel" required value={formData.workModel} onChange={handleChange} className="flex h-12 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                                        <option value="" disabled>Select model</option>
                                        <option value="On-site">On-site</option>
                                        <option value="Hybrid">Hybrid</option>
                                        <option value="Remote">Remote</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="country" className="text-white/80">Country *</Label>
                                    <Input id="country" required placeholder="e.g. United States" value={formData.country} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="state" className="text-white/80">State / Region</Label>
                                    <Input id="state" placeholder="e.g. CA" value={formData.state} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="city" className="text-white/80">City</Label>
                                    <Input id="city" placeholder="e.g. San Francisco" value={formData.city} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="positionLink" className="text-white/80">Application / Position Link *</Label>
                                    <Input id="positionLink" type="url" required placeholder="https://example.com/apply" value={formData.positionLink} onChange={handleChange} className="h-12 bg-black/40 border-white/10 text-white" />
                                </div>
                                <div className="space-y-3 md:col-span-2">
                                    <Label htmlFor="jobSummary" className="text-white/80">Job Summary</Label>
                                    <Textarea id="jobSummary" placeholder="Provide a brief summary of the role and responsibilities..." value={formData.jobSummary} onChange={handleChange} className="min-h-[120px] bg-black/40 border-white/10 text-white" />
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/10 flex justify-end">
                                <Button type="button" variant="outline" className="mr-4 border-white/10 text-white hover:bg-white/10" onClick={() => navigate("/partner/dashboard")}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading} className="px-8 shadow-lg shadow-primary/20 hover:shadow-primary/40 text-black">
                                    <Save className="w-4 h-4 mr-2 text-black" />
                                    {loading ? "Publishing Job..." : "Publish Job Live"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

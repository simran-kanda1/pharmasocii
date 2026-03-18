import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/firebase";
import { doc, getDoc, collection, query, onSnapshot, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, Building, Mail, Phone, MapPin, PlusCircle, LayoutList, Edit3, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Dashboard() {
    const navigate = useNavigate();
    const [partnerData, setPartnerData] = useState<any>(null);
    const [offerings, setOfferings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stripeSimulating, setStripeSimulating] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({
        businessName: "",
        businessAddress: "",
        primaryName: "",
        phoneNumber: ""
    });

    useEffect(() => {
        let unsubOff: any = null;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const docRef = doc(db, "partnersCollection", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setPartnerData(data);

                    if (data.partnerStatus === "Approved") {
                        const offQ = query(collection(docRef, "businessOfferingsCollection"));
                        unsubOff = onSnapshot(offQ, (snap) => {
                            setOfferings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                        });
                    }
                } else {
                    // Not a partner, maybe regular user
                    navigate("/marketplace");
                }
                setLoading(false);
            } else {
                navigate("/login");
            }
        });

        return () => {
            unsubscribe();
            if (typeof unsubOff === 'function') unsubOff();
        };
    }, [navigate]);

    const handleAddPlan = (type: string = "offerings") => {
        setStripeSimulating(true);
        setTimeout(() => {
            setStripeSimulating(false);
            if (type === "consulting") {
                navigate("/partner/consulting/new");
            } else if (type === "jobs") {
                navigate("/partner/jobs/new");
            } else if (type === "events") {
                navigate("/partner/events/new");
            } else {
                navigate("/partner/offerings/new");
            }
        }, 3000);
    };

    const handleSaveProfile = async () => {
        try {
            if (auth.currentUser) {
                const docRef = doc(db, "partnersCollection", auth.currentUser.uid);
                await updateDoc(docRef, editForm);
                setPartnerData({ ...partnerData, ...editForm });
                setIsEditing(false);
            }
        } catch (err) {
            console.error("Failed to update profile", err);
        }
    };

    if (loading) {
        return <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground">Loading dashboard...</div>;
    }

    if (!partnerData) return null;

    const isApproved = partnerData.partnerStatus === "Approved";

    return (
        <div className="flex-1 w-full bg-background p-8 md:p-12 lg:p-16">
            <div className="max-w-5xl mx-auto space-y-8">

                <div className="flex justify-between items-end mb-2">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Company Dashboard</h1>
                    {isApproved && (
                        !isEditing ? (
                            <Button variant="outline" className="border-foreground/20 bg-foreground/5" onClick={() => {
                                setEditForm({
                                    businessName: partnerData.businessName || "",
                                    businessAddress: partnerData.businessAddress || "",
                                    primaryName: partnerData.primaryName || "",
                                    phoneNumber: partnerData.phoneNumber || partnerData.businessPhone || ""
                                });
                                setIsEditing(true);
                            }}>
                                <Edit3 className="w-4 h-4 mr-2" /> Edit Profile
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setIsEditing(false)}><X className="w-4 h-4" /></Button>
                                <Button onClick={handleSaveProfile} className="bg-primary text-primary-foreground"><Save className="w-4 h-4 mr-2" /> Save</Button>
                            </div>
                        )
                    )}
                </div>

                {!isApproved && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 p-6 rounded-xl flex items-start flex-col sm:flex-row gap-4 relative overflow-hidden">
                        <div className="absolute inset-0 bg-yellow-500/5 z-0" />
                        <Clock className="w-8 h-8 text-yellow-500 shrink-0 mt-1 relative z-10" />
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-yellow-500">Profile Pending Review</h3>
                            <p className="text-foreground/80 mt-2 leading-relaxed max-w-2xl">
                                Your profile is currently pending review for verification. Once our team approves your submission, your listings will go live on the marketplace. You can still review your getting started information below.
                            </p>
                        </div>
                    </div>
                )}

                {isApproved && (
                    <div className="bg-primary/10 border border-primary/30 p-6 rounded-xl flex items-start flex-col sm:flex-row gap-4 relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/5 z-0" />
                        <CheckCircle2 className="w-8 h-8 text-primary shrink-0 mt-1 relative z-10" />
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-primary">Profile Verified & Active</h3>
                            <p className="text-foreground/80 mt-2 leading-relaxed max-w-2xl">
                                Your company profile is fully approved and live on the marketplace.
                            </p>
                        </div>
                    </div>
                )}

                {stripeSimulating && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                        <h2 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Processing Payment...</h2>
                        <p className="text-muted-foreground text-lg">Securely simulating Stripe Checkout</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                    <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md shadow-xl">
                        <CardHeader className="pb-4 border-b border-foreground/10">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Building className="w-5 h-5 text-primary" />
                                Business Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Company Name</p>
                                {isEditing ? <Input value={editForm.businessName} onChange={e => setEditForm({ ...editForm, businessName: e.target.value })} className="bg-foreground/5 border-foreground/20" /> : <p className="text-2xl text-foreground font-bold">{partnerData.businessName}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-6 bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Group selection</p>
                                    <p className="text-foreground font-medium capitalize">{partnerData.selectedGroup?.replace(/_/g, ' ') || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Plan selected</p>
                                    <p className="text-foreground font-medium capitalize">{partnerData.selectedPlan?.replace(/_/g, ' ') || "N/A"}</p>
                                </div>
                            </div>
                            {partnerData.selectedAddon && partnerData.selectedAddon !== "none" && partnerData.selectedAddon !== "" && (
                                <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Extra Features Selected</p>
                                    <Badge variant="outline" className="mt-1 border-primary/50 text-foreground bg-muted/50 px-3 py-1 shadow-inner">{partnerData.selectedAddon.replace(/_/g, ' ')}</Badge>
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1"><MapPin className="w-4 h-4 text-muted-foreground" /> Registered Address</p>
                                {isEditing ? <Input value={editForm.businessAddress} onChange={e => setEditForm({ ...editForm, businessAddress: e.target.value })} className="bg-foreground/5 border-foreground/20" /> : <p className="text-foreground/90 font-medium pl-6">{partnerData.businessAddress || "N/A"}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md shadow-xl">
                        <CardHeader className="pb-4 border-b border-foreground/10">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Mail className="w-5 h-5 text-secondary" />
                                Contact Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Primary Rep</p>
                                {isEditing ? <Input value={editForm.primaryName} onChange={e => setEditForm({ ...editForm, primaryName: e.target.value })} className="bg-foreground/5 border-foreground/20" /> : <p className="text-xl text-foreground font-bold">{partnerData.primaryName}</p>}
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted/40 border border-foreground/10 flex items-center justify-center">
                                        <Mail className="w-4 h-4 text-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</p>
                                        <p className="text-foreground font-medium">{partnerData.primaryEmail}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted/40 border border-foreground/10 flex items-center justify-center shrink-0">
                                        <Phone className="w-4 h-4 text-foreground" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</p>
                                        {isEditing ? <Input value={editForm.phoneNumber} onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })} className="bg-foreground/5 border-foreground/20 mt-1 h-8" /> : <p className="text-foreground font-medium">{partnerData.phoneNumber || partnerData.businessPhone || "N/A"}</p>}
                                    </div>
                                </div>
                            </div>

                            {(partnerData.secondaryName || partnerData.secondaryEmail) && (
                                <div className="pt-6 border-t border-foreground/10 mt-6">
                                    <p className="text-sm font-bold text-primary mb-3 uppercase tracking-wider">Alternate Contact</p>
                                    <div className="bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                        {partnerData.secondaryName && <p className="text-foreground font-semibold mb-1">{partnerData.secondaryName}</p>}
                                        {partnerData.secondaryEmail && <p className="text-foreground/80 text-sm">{partnerData.secondaryEmail}</p>}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {isApproved && (
                    <div className="mt-8 space-y-6">
                        <div className="flex justify-between items-center border-b border-foreground/10 pb-4">
                            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                <LayoutList className="w-6 h-6 text-primary" /> Active Offerings & Plans
                            </h2>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="bg-white text-black hover:bg-white/90">
                                        <PlusCircle className="w-4 h-4 mr-2" /> Add Additional Plan
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-background border-foreground/10">
                                    <DropdownMenuItem onClick={() => handleAddPlan("offerings")} className="cursor-pointer">Business Offering</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddPlan("consulting")} className="cursor-pointer">Consulting Service</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddPlan("jobs")} className="cursor-pointer">Job Listing</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddPlan("events")} className="cursor-pointer">Event Listing</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {offerings.length === 0 ? (
                            <div className="bg-foreground/5 border border-foreground/10 p-12 rounded-xl text-center">
                                <p className="text-muted-foreground mb-4">You have not configured any specific business offerings yet.</p>
                                <Button onClick={() => handleAddPlan("offerings")} variant="outline" className="border-primary/50 text-primary">
                                    Set up your first offering
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {offerings.map(offering => (
                                    <Card key={offering.id} className="bg-muted/40 border-foreground/10">
                                        <CardHeader className="pb-3 border-b border-foreground/10 bg-foreground/5">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-lg text-primary">{offering.planId?.split('_').join(' ').toUpperCase() || 'Business Offering'}</CardTitle>
                                                <Badge className="bg-primary/20 text-primary border-primary/50">Active</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-4 space-y-3 text-sm">
                                            <div className="flex flex-col gap-1 text-foreground/80">
                                                <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Bio Safety Levels</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {offering.bioSafetyLevel?.map((b: string, i: number) => <Badge variant="secondary" key={i} className="bg-foreground/10">{b}</Badge>) || "N/A"}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 text-foreground/80">
                                                <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Certifications</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {offering.certifications?.map((c: string, i: number) => <Badge variant="outline" key={i} className="border-foreground/20">{c}</Badge>) || "N/A"}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 text-foreground/80">
                                                <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-bold">Categories</span>
                                                <p className="font-medium text-foreground">{offering.categories?.join(', ') || "N/A"}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

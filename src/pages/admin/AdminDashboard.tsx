import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, LogOut, CheckCircle2, Clock, XCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { seedTesterData } from "@/utils/seedDatabase";

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [partners, setPartners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Automatically protect route - if no admin session, boot to login
        if (!auth.currentUser) {
            navigate("/admin");
            return;
        }

        // Setup real-time listener for ALL partners in the system
        const q = query(collection(db, "partnersCollection"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const partnerData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPartners(partnerData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching partners:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [navigate]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/admin");
    };

    const handleSeed = async () => {
        await seedTesterData();
    };

    const approvePartner = async (partnerId: string) => {
        try {
            await updateDoc(doc(db, "partnersCollection", partnerId), {
                partnerStatus: "Approved",
            });
            alert("Partner has been successfully approved!");
        } catch (err) {
            console.error("Error approving partner:", err);
            alert("Failed to approve partner.");
        }
    };

    return (
        <div className="flex-1 bg-background min-h-screen text-foreground p-8">
            <div className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-primary" /> Root Admin Console
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage partners, plans, and approvals globally.</p>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10" onClick={handleSeed}>
                        <Database className="w-4 h-4 mr-2" /> Inject Tester Data
                    </Button>
                    <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" /> End Session
                    </Button>
                </div>
            </div>

            <div className="space-y-6 max-w-7xl mx-auto">
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-2xl">Registered Partners Queue</CardTitle>
                        <CardDescription>All partners who have initiated or completed setup.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-10 text-muted-foreground">Loading registry...</div>
                        ) : partners.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">No partners found in the system yet.</div>
                        ) : (
                            <div className="space-y-4">
                                {partners.map((partner) => (
                                    <div key={partner.id} className="p-6 bg-black/40 border border-white/10 rounded-xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">

                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-xl font-bold text-white">{partner.businessName || "Unnamed Company"}</h3>
                                                {partner.partnerStatus === "Approved" ? (
                                                    <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>
                                                ) : partner.selectedGroup && partner.selectedPlan ? (
                                                    <Badge className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border-yellow-500/50"><Clock className="w-3 h-3 mr-1" /> Needs Approval</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground border-white/20"><XCircle className="w-3 h-3 mr-1" /> Profile Incomplete</Badge>
                                                )}
                                            </div>

                                            <div className="text-sm text-white/70 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                                <p><span className="text-muted-foreground font-mono">Contact:</span> {partner.primaryName} ({partner.primaryEmail})</p>
                                                <p><span className="text-muted-foreground font-mono">Phone:</span> {partner.phoneNumber || "N/A"}</p>
                                                <p><span className="text-muted-foreground font-mono">Group:</span> <span className="text-primary font-medium">{partner.selectedGroup || "Not selected"}</span></p>
                                                <p><span className="text-muted-foreground font-mono">Plan:</span> <span className="text-white font-medium">{partner.selectedPlan || "Not selected"}</span></p>
                                                {partner.selectedAddon && partner.selectedAddon !== "" && (
                                                    <p className="md:col-span-2"><span className="text-muted-foreground font-mono">Addon Module:</span> <Badge variant="secondary" className="ml-2 font-mono">{partner.selectedAddon}</Badge></p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-none border-white/10">
                                            {partner.selectedGroup && partner.selectedPlan && partner.partnerStatus !== "Approved" && (
                                                <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white w-full md:w-auto" onClick={() => approvePartner(partner.id)}>
                                                    Approve Partner
                                                </Button>
                                            )}
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

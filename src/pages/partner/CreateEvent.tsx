import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save, Calendar } from "lucide-react";

export default function CreateEvent() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        eventName: "",
        eventLink: "",
        startDate: "",
        location: "",
        city: "",
        state: "",
        country: "",
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

            const eventsRef = collection(db, "eventsCollection");

            await addDoc(eventsRef, {
                eventName: formData.eventName,
                eventLink: formData.eventLink,
                startDate: formData.startDate,
                location: formData.location,
                city: formData.city,
                state: formData.state,
                country: formData.country,
                categories: formData.categories.split(",").map(c => c.trim()).filter(Boolean),
                partnerId: auth.currentUser.uid,
                active: true,
                isFeatured: true,
                createdAt: serverTimestamp()
            });

            navigate("/partner/dashboard");
        } catch (err) {
            console.error(err);
            alert("Failed to save event listing");
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
                                <Calendar className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-3xl text-foreground">Post an Event</CardTitle>
                        </div>
                        <CardDescription className="text-base text-muted-foreground ml-1">
                            Payment verified cleanly. Please configure your new event listing below. Use commas for categories.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3 md:col-span-2">
                                    <Label htmlFor="eventName" className="text-foreground/80">Event Name *</Label>
                                    <Input id="eventName" required placeholder="e.g. Global Biotech Summit '26" value={formData.eventName} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 text-foreground" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="startDate" className="text-foreground/80">Start Date *</Label>
                                    <Input id="startDate" type="date" required value={formData.startDate} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 text-foreground" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="eventLink" className="text-foreground/80">Event Link / Tickets *</Label>
                                    <Input id="eventLink" type="url" required placeholder="https://example.com/event" value={formData.eventLink} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 text-foreground" />
                                </div>
                                <div className="space-y-3 md:col-span-2">
                                    <Label htmlFor="location" className="text-foreground/80">Venue / Location Name *</Label>
                                    <Input id="location" required placeholder="e.g. Moscone Center, Virtual" value={formData.location} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 text-foreground" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="city" className="text-foreground/80">City *</Label>
                                    <Input id="city" required placeholder="e.g. San Francisco" value={formData.city} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 text-foreground" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="state" className="text-foreground/80">State / Region</Label>
                                    <Input id="state" placeholder="e.g. CA" value={formData.state} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 text-foreground" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="country" className="text-foreground/80">Country *</Label>
                                    <Input id="country" required placeholder="e.g. United States" value={formData.country} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 text-foreground" />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="categories" className="text-foreground/80">Categories (Comma-separated)</Label>
                                    <Input id="categories" placeholder="e.g. Conference, Networking, Life Sciences" value={formData.categories} onChange={handleChange} className="h-12 bg-muted/40 border-foreground/10 text-foreground" />
                                </div>
                            </div>

                            <div className="pt-8 border-t border-foreground/10 flex justify-end">
                                <Button type="button" variant="outline" className="mr-4 border-foreground/10 text-foreground hover:bg-foreground/10" onClick={() => navigate("/partner/dashboard")}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading} className="px-8 shadow-lg shadow-primary/20 hover:shadow-primary/40 text-black">
                                    <Save className="w-4 h-4 mr-2 text-black" />
                                    {loading ? "Publishing Event..." : "Publish Event Live"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

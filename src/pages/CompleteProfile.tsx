import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Save, Globe, Building, Linkedin, Receipt, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { auth, db } from "@/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

export default function CompleteProfile() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // State initialization matching the requested image form
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        altName: "",
        altEmail: "",
        companyName: "",
        companyWebsite: "",
        businessPhone: "",
        linkedin: "",
        billingEmail: "",
        businessId: "",
        companyProfile: "",
        businessAddress: "",
        group: "",
        plan: "",
        addon: "",
    });

    // Load existing data if available
    useEffect(() => {
        const fetchUserData = async () => {
            if (auth.currentUser) {
                const docRef = doc(db, "partnersCollection", auth.currentUser.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const [fName, ...lNames] = (data.primaryName || "").split(" ");

                    setFormData(prev => ({
                        ...prev,
                        firstName: fName || "",
                        lastName: lNames.join(" ") || "",
                        email: data.primaryEmail || "",
                        companyName: data.businessName || "",
                        phone: data.phoneNumber || "",
                        altName: data.secondaryName || "",
                        altEmail: data.secondaryEmail || "",
                        billingEmail: data.billingEmailAddress || "",
                    }));
                }
            }
        };
        fetchUserData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleSelectChange = (field: string, value: string) => {
        if (field === "group") {
            setFormData((prev) => ({ ...prev, group: value, plan: "", addon: "none" }));
        } else {
            setFormData((prev) => ({ ...prev, [field]: value }));
        }
    };

    const getPlansForGroup = (group: string) => {
        switch (group) {
            case 'business_offerings':
            case 'consulting':
                return [
                    { value: 'basic_mo', label: 'Basic ($100.00/mo) - Getting started' },
                    { value: 'standard_mo', label: 'Standard ($200.00/mo) - Multi country presence' },
                    { value: 'premium_mo', label: 'Premium ($400.00/mo) - Broad scope & presence' },
                    { value: 'premium_plus_mo', label: 'Premium Plus ($1000.00/mo) - Global scale' },
                    { value: 'basic_yr', label: 'Basic Annual ($1,080.00/yr) - $90/mo' },
                    { value: 'standard_yr', label: 'Standard Annual ($2,184.00/yr) - $182/mo' },
                    { value: 'premium_yr', label: 'Premium Annual ($4,320.00/yr) - $360/mo' },
                    { value: 'premium_plus_yr', label: 'Premium Plus Annual ($10,800.00/yr) - $900/mo' },
                ];
            case 'events':
                return [
                    { value: 'basic_event', label: 'Basic ($500.00/mo) - Single day event' },
                    { value: 'standard_event', label: 'Standard ($850.00/mo) - Multi day event' },
                    { value: 'premium_event', label: 'Premium ($1250.00/mo) - Listing + Landing page spotlight' },
                    { value: 'premium_plus_event', label: 'Premium Plus ($1450.00/mo) - Listing + Home page spotlight' },
                ];
            case 'jobs':
                return [
                    { value: 'standard_job', label: 'Standard ($400.00) - Job posting' },
                    { value: 'premium_job', label: 'Premium ($800.00) - Posting & landing page spotlight' },
                    { value: 'premium_plus_job', label: 'Premium Plus ($1000.00) - Posting & home page spotlight' },
                ];
            default:
                return [];
        }
    };

    const getAddonsForGroup = (group: string) => {
        switch (group) {
            case 'business_offerings':
            case 'consulting':
                return [
                    { value: 'addon_landing', label: 'Landing page (within module) - $400.00' },
                    { value: 'addon_home', label: 'Home page/Brand Visibility - $800.00' },
                    { value: 'addon_both', label: 'Both (Listing promotion) - $1000.00' },
                ];
            case 'events':
            case 'jobs':
                return [
                    { value: 'addon_visibility', label: 'Brand visibility on home page - $800.00' },
                    { value: 'addon_both', label: 'Both (Module & Home page) - $1000.00' },
                ];
            default:
                return [];
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setSuccess("");

        try {
            if (!auth.currentUser) {
                throw new Error("No authenticated user found. Please login.");
            }

            // Ensure their email is actually verified per criteria
            // Note: we might reload auth user data or just check their current token
            await auth.currentUser.reload();
            if (!auth.currentUser.emailVerified) {
                throw new Error("Your email address has not been verified yet. Please check your inbox and verify before continuing.");
            }

            const partnerRef = doc(db, "partnersCollection", auth.currentUser.uid);

            await updateDoc(partnerRef, {
                "primaryName": `${formData.firstName} ${formData.lastName}`.trim(),
                "primaryEmail": formData.email,
                "phoneNumber": formData.phone,
                "secondaryName": formData.altName,
                "secondaryEmail": formData.altEmail,
                "businessName": formData.companyName,
                "companyWebsite": formData.companyWebsite,
                "businessPhoneNumber": formData.businessPhone,
                "linkedInProfileLink": formData.linkedin,
                "billingEmailAddress": formData.billingEmail,
                "VAT_ABN_EIN_businessId": formData.businessId,
                "companyProfileText": formData.companyProfile,
                "businessAddress": formData.businessAddress,
                "selectedGroup": formData.group,
                "selectedPlan": formData.plan,
                "selectedAddon": formData.addon === "none" ? "" : formData.addon,
                // Logo URL would go here once uploaded to storage
            });

            setSuccess("Profile information successfully updated!");
            setTimeout(() => {
                // Mock navigate to strike payment link or success page
                navigate("/marketplace");
            }, 2000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred while saving your profile.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 bg-background text-foreground py-12 px-4 relative overflow-hidden">
            {/* Background aesthetics removed for solid vibe */}

            <div className="container max-w-5xl mx-auto relative z-10">

                <div className="mb-10 text-center md:text-left border-b border-foreground/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Complete Your Profile</h1>
                        <p className="text-muted-foreground">Please fill out the remainder of your partner business information.</p>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-foreground/5 border border-foreground/10 px-4 py-2 rounded-full text-sm text-primary">
                        <Building2 className="w-4 h-4" /> Partner Status: <span className="text-foreground font-medium">Pending Verification</span>
                    </div>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-destructive/20 border border-destructive/50 rounded-lg text-destructive-foreground">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-8 p-4 bg-primary/20 border border-primary/50 rounded-lg text-primary/80">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="space-y-8">
                        {/* Core Info Row */}
                        <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md">
                            <CardHeader className="border-b border-foreground/10 pb-4">
                                <CardTitle className="text-xl">Partner Information</CardTitle>
                                <CardDescription>Primary and alternate contact details for your account</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First name *</Label>
                                    <Input id="firstName" value={formData.firstName} onChange={handleChange} required className="bg-muted/40 border-foreground/10" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last name *</Label>
                                    <Input id="lastName" value={formData.lastName} onChange={handleChange} required className="bg-muted/40 border-foreground/10" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email *</Label>
                                    <Input id="email" type="email" value={formData.email} onChange={handleChange} required className="bg-muted/40 border-foreground/10" disabled={!!auth.currentUser} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone *</Label>
                                    <PhoneInput
                                        id="phone"
                                        international
                                        defaultCountry="US"
                                        value={formData.phone}
                                        onChange={(value) => setFormData(prev => ({ ...prev, phone: value || '' }))}
                                        className="flex h-10 w-full rounded-md border border-foreground/10 bg-muted/40 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                <div className="space-y-2 pt-4 border-t border-foreground/10 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="altName">Alternate contact first & last name</Label>
                                        <Input id="altName" value={formData.altName} onChange={handleChange} className="bg-muted/40 border-foreground/10" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="altEmail">Alternate email address</Label>
                                        <Input id="altEmail" type="email" value={formData.altEmail} onChange={handleChange} className="bg-muted/40 border-foreground/10" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Business Details Row */}
                        <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md">
                            <CardHeader className="border-b border-foreground/10 pb-4">
                                <CardTitle className="text-xl">Business Details</CardTitle>
                                <CardDescription>Company information visible to the network</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="companyName">Company name *</Label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input id="companyName" value={formData.companyName} onChange={handleChange} required className="pl-9 bg-muted/40 border-foreground/10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyWebsite">Company website *</Label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input id="companyWebsite" type="url" placeholder="https://" value={formData.companyWebsite} onChange={handleChange} required className="pl-9 bg-muted/40 border-foreground/10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="businessPhone">Business phone *</Label>
                                    <PhoneInput
                                        id="businessPhone"
                                        international
                                        defaultCountry="US"
                                        value={formData.businessPhone}
                                        onChange={(value) => setFormData(prev => ({ ...prev, businessPhone: value || '' }))}
                                        className="flex h-10 w-full rounded-md border border-foreground/10 bg-muted/40 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="linkedin">LinkedIn profile</Label>
                                    <div className="relative">
                                        <Linkedin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input id="linkedin" value={formData.linkedin} onChange={handleChange} placeholder="https://linkedin.com/company/..." className="pl-9 bg-muted/40 border-foreground/10" />
                                    </div>
                                </div>

                                <div className="space-y-2 md:col-span-2 pt-2">
                                    <Label>Company logo</Label>
                                    <div className="flex items-center gap-4">
                                        <div className="h-20 w-20 flex-shrink-0 bg-black/60 rounded-xl border border-dashed border-foreground/20 flex items-center justify-center text-muted-foreground">
                                            <UploadCloud className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <Input type="file" className="bg-muted/40 border-foreground/10 text-sm h-10 pt-2 cursor-pointer" accept="image/jpeg, image/png" />
                                            <p className="text-xs text-muted-foreground mt-2">Formats: JPG, JPEG, PNG | Max size: 2MB | Dimensions: 200px x 200px</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-foreground/10 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="billingEmail">Billing / finance email address</Label>
                                        <div className="relative">
                                            <Receipt className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input id="billingEmail" type="email" value={formData.billingEmail} onChange={handleChange} className="pl-9 bg-primary/10 border-primary/30 text-foreground placeholder:text-foreground/50 focus-visible:ring-primary" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="businessId">VAT/ABN/EIN/Business ID</Label>
                                        <Input id="businessId" value={formData.businessId} onChange={handleChange} className="bg-primary/10 border-primary/30 text-foreground placeholder:text-foreground/50 focus-visible:ring-primary" placeholder="(recommended for accurate invoicing and taxes)" />
                                    </div>
                                </div>

                                <div className="space-y-2 md:col-span-1">
                                    <Label htmlFor="companyProfile">Company profile *</Label>
                                    <Textarea id="companyProfile" value={formData.companyProfile} onChange={handleChange} required className="h-40 bg-muted/40 border-foreground/10 resize-none font-mono text-sm" placeholder="Briefly describe your company's mission and offerings..." />
                                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                        <span>1000 Characters left</span>
                                    </div>
                                </div>

                                <div className="space-y-2 md:col-span-1">
                                    <Label htmlFor="businessAddress">Business address</Label>
                                    <Textarea id="businessAddress" value={formData.businessAddress} onChange={handleChange} className="h-40 bg-muted/40 border-foreground/10 resize-none font-mono text-sm" placeholder="123 Science Way&#10;Suite 100&#10;San Francisco, CA 94107" />
                                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                        <span>1000 Characters left</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Selection Row */}
                        <Card className="bg-foreground/5 border-foreground/10 backdrop-blur-md">
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div className="space-y-3">
                                    <Label>Select group *</Label>
                                    <Select value={formData.group} onValueChange={(val) => handleSelectChange("group", val)} required>
                                        <SelectTrigger className="w-full h-12 bg-muted/40 border-foreground/10">
                                            <SelectValue placeholder="Select group" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background/90 border-foreground/10">
                                            <SelectItem value="business_offerings">Business offerings</SelectItem>
                                            <SelectItem value="consulting">Consulting services</SelectItem>
                                            <SelectItem value="events">Events & conferences</SelectItem>
                                            <SelectItem value="jobs">Jobs</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-3">
                                    <Label>Payment plans *</Label>
                                    <Select value={formData.plan} onValueChange={(val) => handleSelectChange("plan", val)} required disabled={!formData.group}>
                                        <SelectTrigger className="w-full h-12 bg-muted/40 border-foreground/10">
                                            <SelectValue placeholder={formData.group ? "Select plan" : "Select a group first"} />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background/90 border-foreground/10">
                                            {getPlansForGroup(formData.group).map(plan => (
                                                <SelectItem key={plan.value} value={plan.value}>{plan.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.group && (
                                    <div className="space-y-3 md:col-span-2 pt-4 border-t border-foreground/10">
                                        <Label>Separate Feature Package (Optional Upgrade)</Label>
                                        <Select value={formData.addon} onValueChange={(val) => handleSelectChange("addon", val)}>
                                            <SelectTrigger className="w-full h-12 bg-primary/10 border-primary/30 text-foreground focus-visible:ring-primary">
                                                <SelectValue placeholder="No additional features selected" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-background/90 border-foreground/10">
                                                <SelectItem value="none">No additional features</SelectItem>
                                                {getAddonsForGroup(formData.group).map(addon => (
                                                    <SelectItem key={addon.value} value={addon.value}>{addon.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="flex justify-end pt-4 pb-20">
                            <Button type="submit" size="lg" className="h-14 px-10 shadow-lg shadow-primary/20 text-lg sticky bottom-6 z-50" disabled={isLoading}>
                                {isLoading ? "Saving changes..." : <><Save className="mr-2 h-5 w-5" /> Save Profile & Continue</>}
                            </Button>
                        </div>
                    </div>
                </form>
            </div >
        </div >
    );
}

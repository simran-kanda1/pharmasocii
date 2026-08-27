import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
    Mail, 
    Phone, 
    Copy, 
    Check, 
    Send, 
    Building2, 
    ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { 
    DEFAULT_CONTACT_CONFIG, 
    type ContactConfig 
} from "@/lib/defaultContactConfig";

export default function ContactUs() {
    const [config, setConfig] = useState<ContactConfig>(DEFAULT_CONTACT_CONFIG);
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
    const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

    // Form state
    const [formState, setFormState] = useState({
        name: "",
        email: "",
        department: "General Inquiries",
        subject: "",
        message: "",
    });
    const [formSubmitted, setFormSubmitted] = useState(false);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });

        // 1. Initial local fallback
        const savedLocal = localStorage.getItem("pharmasocii_contact_config");
        if (savedLocal) {
            try {
                const parsed = JSON.parse(savedLocal);
                if (parsed && Array.isArray(parsed.departments)) {
                    setConfig(parsed);
                }
            } catch (e) {
                console.error("Error parsing local contact config:", e);
            }
        }

        // 2. Real-time Firestore subscription
        const docRef = doc(db, "config", "contactConfig");
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Partial<ContactConfig>;
                if (data && Array.isArray(data.departments)) {
                    const merged: ContactConfig = {
                        headline: data.headline || DEFAULT_CONTACT_CONFIG.headline,
                        subtitle: data.subtitle || DEFAULT_CONTACT_CONFIG.subtitle,
                        description: data.description || DEFAULT_CONTACT_CONFIG.description,
                        globalPhone: data.globalPhone ?? "",
                        globalAddress: data.globalAddress ?? "",
                        globalHours: data.globalHours || DEFAULT_CONTACT_CONFIG.globalHours,
                        showContactForm: data.showContactForm ?? true,
                        departments: data.departments,
                    };
                    setConfig(merged);
                    localStorage.setItem("pharmasocii_contact_config", JSON.stringify(merged));
                }
            }
        }, (error) => {
            console.warn("Firestore contact config snapshot notice:", error);
        });

        return () => unsubscribe();
    }, []);

    const copyToClipboard = (text: string, type: "email" | "phone") => {
        navigator.clipboard.writeText(text);
        if (type === "email") {
            setCopiedEmail(text);
            setTimeout(() => setCopiedEmail(null), 2500);
        } else {
            setCopiedPhone(text);
            setTimeout(() => setCopiedPhone(null), 2500);
        }
    };



    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Find matching department email or fallback to general
        const selectedDept = config.departments.find(d => d.title === formState.department) || config.departments[0];
        const targetEmail = selectedDept?.email || "general@pharmasocii.com";
        
        // Create pre-filled mailto
        const subject = encodeURIComponent(`[${formState.department}] ${formState.subject || "Website Inquiry"}`);
        const body = encodeURIComponent(
            `Name: ${formState.name}\n` +
            `Email: ${formState.email}\n` +
            `Department: ${formState.department}\n\n` +
            `Message:\n${formState.message}`
        );

        window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`;
        setFormSubmitted(true);
    };

    return (
        <div className="flex flex-col w-full bg-background min-h-screen">
            {/* HERO SECTION */}
            <section className="relative py-16 md:py-24 overflow-hidden border-b border-border/40 bg-gradient-to-b from-background via-background to-muted/20">
                <div className="container mx-auto px-4 max-w-6xl text-center space-y-6">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {config.headline || "Contact Us"}
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto font-normal">
                        {config.description}
                    </p>

                    {/* Global Contact Bar (if set) */}
                    {(config.globalPhone || config.globalAddress) && (
                        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-foreground/80 font-medium">
                            {config.globalPhone && (
                                <a 
                                    href={`tel:${config.globalPhone.replace(/[^0-9+]/g, "")}`} 
                                    className="flex items-center gap-2 hover:text-primary transition-colors bg-foreground/5 px-4 py-2 rounded-full border border-border"
                                >
                                    <Phone className="w-4 h-4 text-primary" />
                                    <span>{config.globalPhone}</span>
                                </a>
                            )}
                            {config.globalAddress && (
                                <div className="flex items-center gap-2 bg-foreground/5 px-4 py-2 rounded-full border border-border">
                                    <Building2 className="w-4 h-4 text-primary" />
                                    <span>{config.globalAddress}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* DEPARTMENTS GRID */}
            <section className="py-16 md:py-24 bg-background">
                <div className="container mx-auto px-4 max-w-6xl">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            Got Questions? Reach Out Directly
                        </h2>
                        <p className="text-muted-foreground text-sm sm:text-base mt-2">
                            Select the relevant department below for prompt and dedicated assistance.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                        {config.departments.map((dept) => (
                            <Card 
                                key={dept.id} 
                                className="border-foreground/10 bg-background shadow-sm hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 rounded-2xl flex flex-col justify-between overflow-hidden group"
                            >
                                <CardHeader className="p-6 pb-4">
                                    <CardTitle className="text-xl font-bold text-foreground">
                                        {dept.title}
                                    </CardTitle>
                                    {dept.description && (
                                        <CardDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5 line-clamp-2">
                                            {dept.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>

                                <CardContent className="p-6 pt-0 space-y-4">
                                    {/* Email Section */}
                                    <div className="p-3.5 rounded-xl bg-foreground/5 border border-border/60 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                            <Mail className="w-4 h-4 text-primary shrink-0" />
                                            <a 
                                                href={`mailto:${dept.email}`} 
                                                className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                                                title={`Email ${dept.email}`}
                                            >
                                                {dept.email}
                                            </a>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                            onClick={() => copyToClipboard(dept.email, "email")}
                                            title="Copy Email"
                                        >
                                            {copiedEmail === dept.email ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </Button>
                                    </div>

                                    {/* Phone Number (ph#) if configured */}
                                    {dept.phone && (
                                        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <Phone className="w-4 h-4 text-primary shrink-0" />
                                                <a 
                                                    href={`tel:${dept.phone.replace(/[^0-9+]/g, "")}`} 
                                                    className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                                                    title={`Call ${dept.phone}`}
                                                >
                                                    {dept.phone}
                                                </a>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                                onClick={() => copyToClipboard(dept.phone!, "phone")}
                                                title="Copy Phone Number"
                                            >
                                                {copiedPhone === dept.phone ? (
                                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </Button>
                                        </div>
                                    )}



                                    <Button asChild className="w-full mt-2 font-semibold shadow-sm hover:shadow-md transition-all" size="sm">
                                        <a href={`mailto:${dept.email}`}>
                                            Send Email <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                        </a>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* SEND A MESSAGE FORM */}
            <section className="py-16 md:py-24 bg-muted/20 border-t border-border/40">
                <div className="container mx-auto px-4 max-w-3xl">
                    <Card className="border-foreground/10 bg-background shadow-xl rounded-3xl p-6 sm:p-10">
                        <div className="text-center space-y-2 mb-8">
                            <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                                Send us a message
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                Fill out the details below and we will route your inquiry to the appropriate department.
                            </p>
                        </div>

                        {formSubmitted ? (
                            <div className="p-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                                    <Check className="w-6 h-6" />
                                </div>
                                <h4 className="text-lg font-bold text-emerald-900">Email Client Opened</h4>
                                <p className="text-sm text-emerald-800 max-w-md mx-auto">
                                    Your email client has been prepared with your inquiry. If it didn't open automatically, you can email us directly at{" "}
                                    <span className="font-semibold">{config.departments[0]?.email}</span>.
                                </p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setFormSubmitted(false)}
                                    className="border-emerald-300 text-emerald-900 hover:bg-emerald-100"
                                >
                                    Send Another Inquiry
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleFormSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80 block mb-1.5">
                                            Your Name <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            required
                                            value={formState.name}
                                            onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="Jane Doe"
                                            className="bg-background border-border"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80 block mb-1.5">
                                            Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            required
                                            type="email"
                                            value={formState.email}
                                            onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="jane@organization.com"
                                            className="bg-background border-border"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80 block mb-1.5">
                                            Department
                                        </label>
                                        <select
                                            value={formState.department}
                                            onChange={(e) => setFormState(prev => ({ ...prev, department: e.target.value }))}
                                            className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            {config.departments.map((dept) => (
                                                <option key={dept.id} value={dept.title}>
                                                    {dept.title} ({dept.email})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80 block mb-1.5">
                                            Subject
                                        </label>
                                        <Input
                                            value={formState.subject}
                                            onChange={(e) => setFormState(prev => ({ ...prev, subject: e.target.value }))}
                                            placeholder="Inquiry regarding..."
                                            className="bg-background border-border"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80 block mb-1.5">
                                        Your Message <span className="text-red-500">*</span>
                                    </label>
                                    <Textarea
                                        required
                                        rows={4}
                                        value={formState.message}
                                        onChange={(e) => setFormState(prev => ({ ...prev, message: e.target.value }))}
                                        placeholder="Please describe how we can assist you..."
                                        className="bg-background border-border"
                                    />
                                </div>

                                <Button 
                                    type="submit" 
                                    size="lg" 
                                    className="w-full font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all rounded-full h-12"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Submit Inquiry
                                </Button>
                            </form>
                        )}
                    </Card>
                </div>
            </section>

            {/* QUICK LINKS & SUPPORT BANNER */}
            <section className="py-12 bg-background border-t border-border/40">
                <div className="container mx-auto px-4 max-w-5xl text-center space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Additional Resources
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
                        <Link to="/faq" className="text-foreground hover:text-primary transition-colors underline underline-offset-4">
                            Frequently Asked Questions
                        </Link>
                        <span className="text-muted-foreground">•</span>
                        <Link to="/about-us" className="text-foreground hover:text-primary transition-colors underline underline-offset-4">
                            About Pharma SocII
                        </Link>
                        <span className="text-muted-foreground">•</span>
                        <Link to="/guidelines" className="text-foreground hover:text-primary transition-colors underline underline-offset-4">
                            Community Guidelines
                        </Link>
                        <span className="text-muted-foreground">•</span>
                        <Link to="/signup" className="text-foreground hover:text-primary transition-colors underline underline-offset-4">
                            Become a Partner
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

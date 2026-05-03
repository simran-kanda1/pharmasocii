import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Activity, ShieldCheck, Building2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, db } from "@/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { logActivity } from "@/lib/auditLogger";
import { getPasswordPolicyChecks, isPasswordPolicyValid, PASSWORD_POLICY_ERROR_MESSAGE } from "@/lib/passwordPolicy";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export default function PartnerRegister() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        phone: "",
        companyName: "",
        altFirstName: "",
        altLastName: "",
        altEmail: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
    };
    const passwordsMismatch =
        formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword;
    const passwordChecks = getPasswordPolicyChecks(formData.password);
    const isPasswordValid = isPasswordPolicyValid(formData.password);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!isPasswordValid) {
            setError(PASSWORD_POLICY_ERROR_MESSAGE);
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.phone || !formData.companyName || !formData.altFirstName || !formData.altLastName || !formData.altEmail) {
            setError("Please fill in all required fields");
            return;
        }

        try {
            setIsLoading(true);
            // Create user in Auth
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // Send Email Verification
            // await sendEmailVerification(user);

            // Create partner document in Firestore
            const partnerData = {
                partnerId: user.uid,
                primaryName: `${formData.firstName} ${formData.lastName}`,
                primaryEmail: formData.email,
                businessName: formData.companyName,
                phoneNumber: formData.phone,
                billingEmailAddress: formData.email, // Default to primary email initially
                secondaryName: `${formData.altFirstName} ${formData.altLastName}`.trim(),
                secondaryFirstName: formData.altFirstName,
                secondaryLastName: formData.altLastName,
                secondaryEmail: formData.altEmail,
                createdAt: serverTimestamp(),
            };

            await setDoc(doc(db, "partnersCollection", user.uid), partnerData);

            // Also add them to membersCollection as a basic user so they can login regularly as well
            const memberData = {
                userId: user.uid,
                name: `${formData.firstName} ${formData.lastName}`,
                userName: formData.email.split("@")[0], // Simple username generation
                email: formData.email,
                emailVerified: true, // Auto-verify for testing phase
                createdAt: serverTimestamp(),
                profilePicture: "",
                userBio: "",
            };

            await setDoc(doc(db, "membersCollection", user.uid), memberData);

            // Log to Audit Trail
            await logActivity({
                partnerId: user.uid,
                partnerName: formData.companyName,
                action: "ACCOUNT_CREATED",
                details: `Partner account created for ${formData.firstName} ${formData.lastName}.`,
                category: "account",
                metadata: {
                    email: formData.email,
                    phone: formData.phone
                }
            });

            setSuccess(true);
            setTimeout(() => {
                // Redirect to complete profile after showing success message
                navigate("/partner/complete-profile");
            }, 5000);

        } catch (err: any) {
            setError(err.message || "Failed to create account. Please try again.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row w-full bg-background text-foreground">
            {/* LEFT COLUMN: The Form (Dark Mode aesthetic) */}
            <div className="w-full md:w-[450px] lg:w-[500px] bg-background/90 p-8 md:p-12 overflow-y-auto border-r border-foreground/10 shrink-0 relative">


                <div className="mb-8">
                    <Link to="/" className="flex items-center gap-2 mb-8">
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                            <div className="h-3 w-3 bg-foreground/20 rounded-full" />
                        </div>
                        <span className="font-bold text-lg tracking-tight text-foreground">Pharmasocii</span>
                    </Link>
                </div>

                {success ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-20">
                        <ShieldCheck className="w-20 h-20 text-primary animate-pulse" />
                        <h3 className="text-3xl font-bold text-foreground">Account Created!</h3>
                        <p className="text-muted-foreground leading-relaxed max-w-[280px]">
                            Your account <span className="text-foreground font-medium">{formData.email}</span> has been set up successfully.
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 mt-8">
                            Proceeding to the next step... <Activity className="w-4 h-4 animate-spin" />
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-5 text-left relative z-10 text-foreground/90">
                        {error && (
                            <div className="p-3 bg-destructive/20 border border-destructive/50 rounded-md text-destructive-foreground text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="firstName" className="text-foreground/80">First name *</Label>
                            <Input id="firstName" value={formData.firstName} onChange={handleChange} required className="bg-foreground/5 border-foreground/10 text-foreground focus-visible:ring-primary/50" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="lastName" className="text-foreground/80">Last name *</Label>
                            <Input id="lastName" value={formData.lastName} onChange={handleChange} required className="bg-foreground/5 border-foreground/10 text-foreground focus-visible:ring-primary/50" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-foreground/80">Email *</Label>
                            <Input id="email" type="email" value={formData.email} onChange={handleChange} required className="bg-foreground/5 border-foreground/10 text-foreground focus-visible:ring-primary/50" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-foreground/80">Password *</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className={`pr-10 bg-foreground/5 text-foreground focus-visible:ring-primary/50 ${passwordsMismatch ? "border-destructive/70" : "border-foreground/10"}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                                <li className={passwordChecks.minLength ? "text-green-500" : ""}>At least 8 characters</li>
                                <li className={passwordChecks.uppercase ? "text-green-500" : ""}>At least 1 uppercase letter</li>
                                <li className={passwordChecks.lowercase ? "text-green-500" : ""}>At least 1 lowercase letter</li>
                                <li className={passwordChecks.special ? "text-green-500" : ""}>At least 1 special character</li>
                            </ul>
                            {passwordsMismatch && <p className="text-xs text-destructive mt-1">Passwords do not match.</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword" className="text-foreground/80">Confirm password *</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    className={`pr-10 bg-foreground/5 text-foreground focus-visible:ring-primary/50 ${passwordsMismatch ? "border-destructive/70" : "border-foreground/10"}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {passwordsMismatch && <p className="text-xs text-destructive mt-1">Passwords do not match.</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-foreground/80">Phone number *</Label>
                            <PhoneInput
                                id="phone"
                                defaultCountry="US"
                                value={formData.phone}
                                onChange={(value) => setFormData(prev => ({ ...prev, phone: value || '' }))}
                                className="flex h-10 w-full rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="companyName" className="text-foreground/80">Company name *</Label>
                            <Input id="companyName" value={formData.companyName} onChange={handleChange} required className="bg-foreground/5 border-foreground/10 text-foreground focus-visible:ring-primary/50" />
                        </div>

                        {/* Alternate Contact Section */}
                        <div className="pt-4 pb-2">
                            <p className="text-sm font-semibold text-primary">Alternate Contact</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="altFirstName" className="text-foreground/80">Alternate contact first name *</Label>
                            <Input id="altFirstName" value={formData.altFirstName} onChange={handleChange} required className="bg-foreground/5 border-foreground/10 text-foreground focus-visible:ring-primary/50" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="altLastName" className="text-foreground/80">Alternate contact last name *</Label>
                            <Input id="altLastName" value={formData.altLastName} onChange={handleChange} required className="bg-foreground/5 border-foreground/10 text-foreground focus-visible:ring-primary/50" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="altEmail" className="text-foreground/80">Alternate contact email *</Label>
                            <Input id="altEmail" type="email" value={formData.altEmail} onChange={handleChange} required className="bg-foreground/5 border-foreground/10 text-foreground focus-visible:ring-primary/50" />
                        </div>

                        <div className="pt-4">
                            <p className="text-xs text-muted-foreground/80 mb-4">
                                By creating an account, you agree to our <Link to="/terms" className="text-primary hover:underline">Terms of use</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy policy</Link>.
                            </p>
                            <Button type="submit" className="w-full shadow-lg shadow-primary/20 h-12" disabled={isLoading}>
                                {isLoading ? "Setting up..." : "Set up profile"}
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            {/* RIGHT COLUMN: Instructions / Steps */}
            <div className="flex-1 bg-background/50 p-8 md:p-16 lg:p-24 overflow-y-auto relative">


                <div className="max-w-3xl mx-auto space-y-12 relative z-10">

                    {/* Top informative banner boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-foreground/5 border border-foreground/10 rounded-2xl p-6 lg:p-8 backdrop-blur-sm">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-primary">
                                <Building2 className="w-5 h-5" />
                                <h3 className="font-semibold">Showcase your business</h3>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Connect with a global community dedicated to advancing healthcare and life sciences. Gain visibility, expand your network, and drive impactful collaborations.
                            </p>
                            <p className="text-sm text-foreground/80 font-medium">Set up your profile and complete the registration process in few simple steps.</p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-secondary">
                                <ShieldCheck className="w-5 h-5" />
                                <h3 className="font-semibold">Tailored Categories</h3>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                You can choose from multiple categories tailored to the needs of Biotechnology, Pharmaceuticals, Radiopharmaceuticals, and Medical Device industries. Our categories encompass every stage, from research to market access.
                            </p>
                            <p className="text-sm text-foreground/80 font-medium">Don't see a category that best fits your business, please contact us.</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight mb-8">Steps to become a partner</h2>

                            <div className="space-y-10 relative">
                                {/* Visual connecting line */}
                                <div className="absolute left-[11px] top-2 bottom-4 w-[2px] bg-foreground/10" />

                                <div className="relative pl-10">
                                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">Set up your profile</h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Create a profile using the form on this page. Note: Anyone with access to this account can edit your partner page, however, the primary contact, email and company name can only be changed by our team.
                                    </p>
                                </div>

                                <div className="relative pl-10">
                                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-foreground/5 border-2 border-foreground/20 flex items-center justify-center" />
                                    <h3 className="text-xl font-semibold mb-2">Begin registration</h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Once your profile is set up, begin the partner registration process.
                                    </p>
                                </div>

                                <div className="relative pl-10">
                                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-foreground/5 border-2 border-foreground/20 flex items-center justify-center" />
                                    <h3 className="text-xl font-semibold mb-2">Select a group</h3>
                                    <p className="text-muted-foreground leading-relaxed mb-3">
                                        Choose one of the following groups:
                                    </p>
                                    <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4 marker:text-primary">
                                        <li>Business offerings</li>
                                        <li>Consulting services</li>
                                        <li>Events & conferences</li>
                                        <li>Jobs</li>
                                    </ul>
                                    <p className="text-sm text-muted-foreground mt-3 italic">
                                        Relevant categories will be shown based on your group selection.
                                    </p>
                                </div>

                                <div className="relative pl-10">
                                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-foreground/5 border-2 border-foreground/20 flex items-center justify-center" />
                                    <h3 className="text-xl font-semibold mb-2">Choose a plan</h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Pick a monthly or annual plan and enter your payment information to complete the registration.
                                    </p>
                                </div>

                                <div className="relative pl-10">
                                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-foreground/5 border-2 border-foreground/20 flex items-center justify-center" />
                                    <h3 className="text-xl font-semibold mb-2">Review and go live</h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Business offerings and consulting services listings will be reviewed by our team before publishing. Events & conferences and jobs listings go live immediately after submission and successful payment.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-foreground/10">
                            <p className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">Need help?</span> visit our FAQs or <a href="#" className="text-primary hover:underline">contact us anytime</a> — we're here to support you.
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

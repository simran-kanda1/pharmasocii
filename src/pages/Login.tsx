import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { requestVerificationEmail } from "@/lib/adminCommunityCallables";

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [unverifiedUser, setUnverifiedUser] = useState(false);
    const [resendSuccess, setResendSuccess] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setResendSuccess("");
        setUnverifiedUser(false);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const partnerDoc = await getDoc(doc(db, "partnersCollection", user.uid));
            const memberDoc = await getDoc(doc(db, "membersCollection", user.uid));

            if (partnerDoc.exists()) {
                const partnerData = partnerDoc.data();
                if (partnerData.selectedGroup && partnerData.selectedPlan) {
                    navigate("/partner/dashboard");
                } else {
                    navigate("/partner/complete-profile");
                }
            } else if (memberDoc.exists()) {
                if (!user.emailVerified) {
                    setError("Please verify your email for active participation in the community. Check your inbox or click resend below.");
                    setUnverifiedUser(true);
                    setIsLoading(false);
                    return;
                }
                navigate("/community");
            } else {
                setError(
                    "No partner or member profile found for this account. Create a member account or complete partner registration.",
                );
                await signOut(auth);
            }
        } catch (err: any) {
            console.error("Login error:", err);
            setError("Invalid email or password. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (!auth.currentUser) return;
        try {
            setIsLoading(true);
            await requestVerificationEmail();
            setResendSuccess("Verification email sent! Please check your inbox.");
            setError("");
        } catch (err: any) {
            console.error(err);
            setError("Failed to send verification email. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center w-full bg-background text-foreground min-h-[80vh] px-4 py-12">
            <div className="w-full max-w-md border border-foreground/10 rounded-2xl bg-foreground/[0.02] p-8 shadow-xl">
                <div className="flex flex-col items-start text-left">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
                    <p className="text-sm text-muted-foreground mb-6 text-left w-full">Please verify your email for active participation in the community.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"

                            className="bg-foreground/5 border-foreground/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                                Forgot password?
                            </Link>
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"

                                className="bg-foreground/5 border-foreground/10 pr-10"
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {resendSuccess && <p className="text-sm text-emerald-600">{resendSuccess}</p>}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Logging in…" : "Log in"}
                    </Button>

                    {unverifiedUser && (
                        <div className="pt-2">
                            <Button type="button" variant="outline" className="w-full" disabled={isLoading} onClick={handleResend}>
                                Resend verification email
                            </Button>
                            <p className="text-xs text-muted-foreground text-center mt-3">
                                You must be logged in with an unverified session to resend login with password link.
                            </p>
                        </div>
                    )}
                </form>

                <p className="text-sm text-muted-foreground mt-6 text-center">
                    <Link to="/signup" className="text-primary font-medium hover:underline">
                        Become a partner
                    </Link>
                </p>

                <Button variant="ghost" asChild className="w-full mt-4">
                    <Link to="/" className="flex items-center justify-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Home
                    </Link>
                </Button>
            </div>
        </div>
    );
}

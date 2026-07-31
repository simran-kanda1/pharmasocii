import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

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

    return (
        <div className="flex-1 flex flex-col items-center justify-center w-full bg-background text-foreground relative overflow-hidden min-h-[80vh] px-4">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md border border-foreground/10 rounded-2xl bg-foreground/[0.02] p-8 shadow-xl">
                <div className="flex flex-col items-center text-center">
                    <div className="inline-flex items-center py-1 px-3 mb-6 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
                        <Activity className="w-4 h-4 mr-2 text-secondary" /> Partner login
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
                    <p className="text-muted-foreground text-sm mb-6">
                        Enter your credentials to access your partner account.
                    </p>
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
                            placeholder="researcher@biotech.com"
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
                                placeholder="••••••••"
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

                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Logging in…" : "Log in"}
                    </Button>
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

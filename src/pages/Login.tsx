import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check profile completion status to route appropriately
            const partnerDoc = await getDoc(doc(db, "partnersCollection", user.uid));
            if (partnerDoc.exists()) {
                const partnerData = partnerDoc.data();
                if (partnerData.selectedGroup && partnerData.selectedPlan) {
                    navigate("/partner/dashboard");
                } else {
                    navigate("/partner/complete-profile");
                }
            } else {
                // If they possess a regular account (like membersCollection), send them to main dashboard
                navigate("/partner/dashboard");
            }
        } catch (err: any) {
            console.error("Login error:", err);
            setError("Invalid email or password. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row w-full bg-background text-foreground">
            {/* Left side banner */}
            <div className="hidden md:flex flex-1 relative bg-black/40 overflow-hidden items-center justify-center p-12">
                <div className="absolute inset-0 bg-primary/20 mix-blend-overlay z-10" />
                <div className="absolute inset-0 z-0">
                    <img src="https://images.unsplash.com/photo-1579165466741-7f35e4755660?auto=format&fit=crop&q=80" className="w-full h-full object-cover opacity-30" alt="Microscope" />
                </div>
                <div className="relative z-20 max-w-lg text-left">
                    <div className="inline-flex py-1 px-3 mb-6 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-sm font-medium">
                        <Activity className="w-4 h-4 mr-2 text-secondary" /> Empowering the Biotech World
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                        The platform for <span className="text-primary">pioneers.</span>
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Sign in to access the marketplace, connect with experts, and engage with the global biotech community.
                    </p>
                </div>
            </div>

            {/* Right side login form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">

                <Card className="w-full max-w-md bg-white/5 border-white/10 backdrop-blur-xl relative z-10 shadow-2xl">
                    <CardHeader className="space-y-2 pb-8">
                        <CardTitle className="text-3xl font-bold text-center tracking-tight">Welcome back</CardTitle>
                        <CardDescription className="text-center text-base">Enter your credentials to access your account</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-6">
                            {error && (
                                <div className="p-3 bg-destructive/20 border border-destructive/50 rounded-md text-destructive-foreground text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email format</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        required
                                        className="pl-10 h-10 border-white/10 bg-black/40 focus:bg-white/5 transition-colors"
                                        placeholder="researcher@biotech.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline transition-all">Forgot password?</Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type="password"
                                        required
                                        className="pl-10 h-10 border-white/10 bg-black/40 focus:bg-white/5 transition-colors"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-11 text-base font-semibold shadow-xl shadow-primary/20" disabled={isLoading}>
                                {isLoading ? "Authenticating..." : (
                                    <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
                                )}
                            </Button>
                        </form>

                        <div className="mt-8 text-center text-sm text-muted-foreground">
                            Don't have an account?{" "}
                            <Link to="/signup" className="text-primary font-semibold hover:underline">
                                Register now
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

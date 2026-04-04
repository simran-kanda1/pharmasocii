import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [error, setError] = useState("");

    // Check if already logged in as admin
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check if user is in adminCollection
                const adminDoc = await getDoc(doc(db, "adminCollection", user.uid));
                if (adminDoc.exists()) {
                    navigate("/admin/dashboard");
                    return;
                }
            }
            setCheckingAuth(false);
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            // Sign in with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // Check if user is in adminCollection
            const adminDoc = await getDoc(doc(db, "adminCollection", userCredential.user.uid));
            
            if (!adminDoc.exists()) {
                setError("This account is not authorized for admin access.");
                setIsLoading(false);
                return;
            }
            
            navigate("/admin/dashboard");
        } catch (err: any) {
            console.error("Admin Login Error:", err);
            if (err.code === "auth/user-not-found") {
                setError("Account not found.");
            } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
                setError("Invalid email or password.");
            } else {
                setError("Login failed. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
            <Card className="w-full max-w-md bg-white border-slate-200 relative z-10 shadow-lg">
                <CardHeader className="space-y-3 pb-8 text-center">
                    <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2 border border-primary/20">
                        <ShieldAlert className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">Pharmasocii Admin</CardTitle>
                    <CardDescription className="text-base text-slate-500">Secure administrative portal access</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-destructive/20 border border-destructive/50 rounded-md text-destructive-foreground text-sm text-center">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700">Admin Identifier</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                className="h-12 border-slate-200 bg-white transition-colors text-slate-900 focus-visible:ring-primary/50"
                                placeholder="root@pharmasocii.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-700">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="h-12 pr-10 border-slate-200 bg-white transition-colors text-slate-900 focus-visible:ring-primary/50"
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-12 text-base font-semibold mt-4" disabled={isLoading}>
                            {isLoading ? "Authenticating..." : (
                                <>Sign in <ArrowRight className="ml-2 h-5 w-5" /></>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

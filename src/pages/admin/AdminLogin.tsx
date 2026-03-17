import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLogin() {
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
            // Admin accounts strictly use standard firebase auth to login, we route based on the successful login
            await signInWithEmailAndPassword(auth, email, password);
            navigate("/admin/dashboard");
        } catch (err: any) {
            console.error("Admin Login Error:", err);
            setError("Invalid credentials or unauthorized access.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 mix-blend-overlay z-0 pointer-events-none" />
            <Card className="w-full max-w-md bg-white/5 border-primary/20 backdrop-blur-xl relative z-10 shadow-2xl">
                <CardHeader className="space-y-3 pb-8 text-center">
                    <div className="mx-auto bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mb-2 shadow-lg shadow-primary/20 border border-primary/30">
                        <ShieldAlert className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight text-white">Pharmasocii Root</CardTitle>
                    <CardDescription className="text-base text-primary/70">Admin System Access Gateway</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-destructive/20 border border-destructive/50 rounded-md text-destructive-foreground text-sm text-center">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-white/80">Admin Identifer</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                className="h-12 border-white/10 bg-black/60 focus:bg-white/5 transition-colors text-white focus-visible:ring-primary/50"
                                placeholder="root@pharmasocii.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-white/80">Access Key</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                className="h-12 border-white/10 bg-black/60 focus:bg-white/5 transition-colors text-white focus-visible:ring-primary/50"
                                placeholder="••••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <Button type="submit" className="w-full h-12 text-base font-semibold shadow-xl shadow-primary/20 hover:shadow-primary/40 bg-primary text-black hover:bg-white transition-all mt-4" disabled={isLoading}>
                            {isLoading ? "Authenticating..." : (
                                <>Initialize Session <ArrowRight className="ml-2 h-5 w-5" /></>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

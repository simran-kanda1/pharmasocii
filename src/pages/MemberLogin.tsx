import { useState, useEffect } from "react";

import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, db } from "@/firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";


export default function MemberLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const emailFromUrl = searchParams.get("email") || "";

  const [email, setEmail] = useState(() => emailFromUrl);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");

  const [verifyHint] = useState<string | null>(() => {
    const s = location.state as { verifyEmailHint?: string } | null;
    return s?.verifyEmailHint ?? null;
  });

  useEffect(() => {
    if (emailFromUrl) setEmail(emailFromUrl);
  }, [emailFromUrl]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const memberSnap = await getDoc(doc(db, "membersCollection", user.uid));
      if (memberSnap.exists() && user.emailVerified) {
        navigate("/community", { replace: true });
      }
    });
    return () => unsub();
  }, [navigate]);

  const syncVerifiedFlag = async (uid: string, verified: boolean) => {
    const ref = doc(db, "membersCollection", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { emailVerified: verified });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResendSuccess("");
    setUnverifiedUser(false);

    try {
      setIsLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await cred.user.reload();
      const u = cred.user;
      await syncVerifiedFlag(u.uid, u.emailVerified);

      const memberSnap = await getDoc(doc(db, "membersCollection", u.uid));
      if (!memberSnap.exists()) {
        navigate("/member/setup", { replace: true });
        return;
      }

      if (!u.emailVerified) {
        setError("Please verify your email for active participation in the community. Check your inbox or click resend below.");
        setUnverifiedUser(true);
        return;
      }

      navigate("/community");
    } catch (err: unknown) {
      console.error(err);
      if (typeof err === "object" && err !== null && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
          setError("Invalid email or password.");
        } else {
          setError("Login failed. Try again.");
        }
      } else {
        setError("Login failed. Try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!auth.currentUser) return;
    try {
      setIsLoading(true);
      await sendEmailVerification(auth.currentUser);
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
    <div className="flex-1 flex flex-col items-center justify-center w-full bg-background text-foreground relative overflow-hidden min-h-[80vh] px-4">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md border border-foreground/10 rounded-2xl bg-foreground/[0.02] p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center py-1 px-3 mb-6 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
            Member login
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-6">Please verify your email for active participation in the community.</p>
        </div>


        {verifyHint && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            {verifyHint}
          </div>
        )}

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
              <Link to="/member/forgot-password" className="text-xs font-semibold text-primary hover:underline">
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
          <Link to="/member/register" className="text-primary font-medium hover:underline">
            Become a member
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

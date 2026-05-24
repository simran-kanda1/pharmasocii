import { useState, useEffect } from "react";
import type { FirebaseError } from "firebase/app";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Activity, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, db } from "@/firebase";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ensureVerificationPending } from "@/lib/ensureVerificationPending";

export default function MemberLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const verifyBanner = searchParams.get("verify") === "1";
  const emailFromUrl = searchParams.get("email") || "";

  const [email, setEmail] = useState(() => emailFromUrl);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [verifyHint, setVerifyHint] = useState<string | null>(() => {
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
    setResendMsg("");
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
        setError("Please verify your email before continuing. Check your inbox or resend below.");
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
    setResendMsg("");
    setError("");
    setVerifyHint(null);
    try {
      if (!auth.currentUser) {
        setError("Log in first, then resend verification.");
        return;
      }
      const queue = await ensureVerificationPending();
      try {
        await sendEmailVerification(auth.currentUser);
      } catch (sendErr: unknown) {
        const sendCode =
          typeof sendErr === "object" && sendErr !== null && "code" in sendErr
            ? (sendErr as FirebaseError).code
            : "";
        if (sendCode !== "auth/too-many-requests" || !queue.ok) throw sendErr;
      }
      if (queue.ok) {
        setResendMsg(
          "Verification queued in Admin → Overview. Firebase also emailed your signup address — check spam.",
        );
      } else {
        setResendMsg(queue.message || "Could not queue verification. Try again or ask admin.");
      }
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err ? (err as FirebaseError).code : "";
      if (code === "auth/too-many-requests") {
        setError("Too many emails sent. Wait 15–30 minutes, or use Admin → Overview → Member email verification.");
      } else {
        setError("Could not send email. Try again later.");
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full bg-background text-foreground relative overflow-hidden min-h-[80vh] px-4">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md border border-foreground/10 rounded-2xl bg-foreground/[0.02] p-8 shadow-xl">
        <div className="inline-flex py-1 px-3 mb-6 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
          <Activity className="w-4 h-4 mr-2 text-primary" /> Member login
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Verify your email to post, comment, save, and report spam.
        </p>

        {verifyBanner && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
            Account created. Check your email and click the verification link before logging in.
          </div>
        )}
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
            <Label htmlFor="password">Password</Label>
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
          {resendMsg && <p className="text-sm text-emerald-600">{resendMsg}</p>}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="flex flex-col gap-2 mt-4">
          <Button type="button" variant="outline" className="w-full" onClick={handleResend}>
            Resend verification email
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You must be logged in with an unverified session to resend (sign in with password
            first).
          </p>
        </div>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          New here?{" "}
          <Link to="/member/forgot-password" className="text-primary font-medium hover:underline">
            Forgot password?
          </Link>
          {" · "}
          <Link to="/member/register" className="text-primary font-medium hover:underline">
            Create an account
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

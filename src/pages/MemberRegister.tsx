import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { FirebaseError } from "firebase/app";
import { Activity, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, db } from "@/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getPasswordPolicyChecks, isPasswordPolicyValid, PASSWORD_POLICY_ERROR_MESSAGE } from "@/lib/passwordPolicy";
import { normalizeUserNameKey } from "@/lib/community";

export default function MemberRegister() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingEmailHint, setExistingEmailHint] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    userName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const passwordChecks = getPasswordPolicyChecks(form.password);
  const isPasswordValid = isPasswordPolicyValid(form.password);
  const passwordsMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setExistingEmailHint(false);
    if (!isPasswordValid) {
      setError(PASSWORD_POLICY_ERROR_MESSAGE);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    const key = normalizeUserNameKey(form.userName);
    if (key.length < 2) {
      setError("Username must be at least 2 characters (letters, numbers, underscore).");
      return;
    }
    if (!form.name.trim() || !form.email.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    const emailTrim = form.email.trim();

    try {
      setIsLoading(true);
      try {
        const methods = await fetchSignInMethodsForEmail(auth, emailTrim);
        if (methods.length > 0) {
          setExistingEmailHint(true);
          setIsLoading(false);
          return;
        }
      } catch {
        // Enumeration protection or network: still try sign-up; rely on auth error if duplicate.
      }

      const userCredential = await createUserWithEmailAndPassword(auth, emailTrim, form.password);
      const user = userCredential.user;
      await sendEmailVerification(user);

      const memberRef = doc(db, "membersCollection", user.uid);
      const nameKeyRef = doc(db, "userNames", key);

      await runTransaction(db, async (tx) => {
        const existing = await tx.get(nameKeyRef);
        if (existing.exists()) {
          throw new Error("USERNAME_TAKEN");
        }
        tx.set(nameKeyRef, {
          key,
          userId: user.uid,
          userName: form.userName.trim(),
          createdAt: serverTimestamp(),
        });
        tx.set(memberRef, {
          userId: user.uid,
          name: form.name.trim(),
          userName: form.userName.trim(),
          email: emailTrim,
          emailVerified: user.emailVerified,
          createdAt: serverTimestamp(),
          profilePicture: "",
          userBio: "",
          accountStatus: "active",
          spamActiveReportCount: 0,
          spamTotalReportCount: 0,
        });
      });

      navigate("/member/login?verify=1", { replace: true });
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error && err.message === "USERNAME_TAKEN") {
        setError("That username is already taken. Try another.");
      } else if (typeof err === "object" && err !== null && "code" in err) {
        const code = (err as FirebaseError).code;
        if (code === "auth/email-already-in-use") {
          setExistingEmailHint(true);
        } else {
          setError("Registration failed. Please try again.");
        }
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full bg-background text-foreground relative overflow-hidden min-h-[80vh] px-4">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md border border-foreground/10 rounded-2xl bg-foreground/[0.02] p-8 shadow-xl">
        <div className="inline-flex py-1 px-3 mb-6 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
          <Activity className="w-4 h-4 mr-2 text-primary" /> Member account
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Create your profile</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Name and username cannot be changed after signup. You will need to verify your email before
          posting or commenting.
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="bg-foreground/5 border-foreground/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userName">Username</Label>
            <Input
              id="userName"
              value={form.userName}
              onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))}
              required
              autoComplete="username"
              className="bg-foreground/5 border-foreground/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => {
                setExistingEmailHint(false);
                setForm((f) => ({ ...f, email: e.target.value }));
              }}
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
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
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
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className={passwordChecks.minLength ? "text-emerald-600" : ""}>At least 8 characters</li>
              <li className={passwordChecks.uppercase ? "text-emerald-600" : ""}>At least 1 uppercase letter</li>
              <li className={passwordChecks.lowercase ? "text-emerald-600" : ""}>At least 1 lowercase letter</li>
              <li className={passwordChecks.special ? "text-emerald-600" : ""}>At least 1 special character</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              required
              className="bg-foreground/5 border-foreground/10"
            />
            {passwordsMismatch && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>

          {existingEmailHint && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm text-foreground space-y-3">
              <p className="font-medium">You already have access with this email</p>
              <p className="text-muted-foreground leading-relaxed">
                Pharmasocii uses one login per email for security. That still lets you use{" "}
                <strong className="text-foreground">both</strong> the marketplace and the community: sign in, then—if
                you have not yet—add your community profile (choose your community username there). Use the same
                password you set for partner signup.
              </p>
              <Button type="button" className="w-full" asChild>
                <Link
                  to={`/member/login?email=${encodeURIComponent(form.email.trim())}`}
                  className="text-center"
                >
                  Sign in and finish community setup
                </Link>
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isLoading || existingEmailHint}>
            {isLoading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Already have an account?{" "}
          <Link to="/member/login" className="text-primary font-medium hover:underline">
            Log in
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

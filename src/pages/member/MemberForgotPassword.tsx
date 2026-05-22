import { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/firebase";
import { mirrorPasswordResetEmail } from "@/lib/adminCommunityCallables";
import { ArrowLeft } from "lucide-react";

export default function MemberForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      try {
        await mirrorPasswordResetEmail(trimmed);
      } catch {
        /* mirror optional until functions deployed */
      }
      setMsg(
        "If an account exists for this email, a reset link was sent. Check spam. Admins can also view the link under Email log.",
      );
    } catch (err: unknown) {
      console.error(err);
      setMsg(
        "If an account exists for this email, a reset link was sent. Check spam. Admins can also view the link under Email log.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Button variant="ghost" asChild className="mb-6 gap-2">
        <Link to="/member/login">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </Button>
      <h1 className="text-2xl font-bold mb-2">Reset password</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Community member accounts only. Enter the email you used to register.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </div>
  );
}

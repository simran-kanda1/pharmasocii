import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/adminCommunityCallables";
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
      await requestPasswordReset(trimmed);
      setMsg(
        "If an account exists for this email, we've sent a password reset link. Be sure to check your spam folder.",
      );
    } catch (err: unknown) {
      console.error(err);
      setMsg(
        "If an account exists for this email, we've sent a password reset link. Be sure to check your spam folder.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full bg-background text-foreground min-h-[80vh] px-4 py-12">
      <div className="w-full max-w-md border border-foreground/10 rounded-2xl bg-foreground/[0.02] p-8 shadow-xl">
        <div className="flex flex-col items-start text-left">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Reset password</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Enter the email you used to register. We’ll send a link to set a new password.
          </p>
        </div>

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
              className="bg-foreground/5 border-foreground/10"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        <Button variant="ghost" asChild className="w-full mt-4">
          <Link to="/login" className="flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to login
          </Link>
        </Button>
      </div>
    </div>
  );
}

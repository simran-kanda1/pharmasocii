import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, db } from "@/firebase";
import { onAuthStateChanged, sendEmailVerification } from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { normalizeUserNameKey } from "@/lib/community";

/**
 * Create a community (member) profile for an existing Firebase Auth user.
 * Partners use this after partner signup; community-only users use /member/register instead.
 */
export default function MemberCommunitySetup() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [userName, setUserName] = useState("");
  const [emailDisplay, setEmailDisplay] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/member/login", { replace: true, state: { from: "/member/setup" } });
        return;
      }
      await user.reload();
      setEmailDisplay(user.email || "");

      const memberSnap = await getDoc(doc(db, "membersCollection", user.uid));
      if (memberSnap.exists()) {
        navigate("/community", { replace: true });
        return;
      }

      const partnerSnap = await getDoc(doc(db, "partnersCollection", user.uid));
      const prefill =
        partnerSnap.exists() && partnerSnap.data().primaryName
          ? String(partnerSnap.data().primaryName)
          : user.displayName || "";
      setName(prefill);
      setReady(true);
    });
    return () => unsub();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const user = auth.currentUser;
    if (!user) return;

    const key = normalizeUserNameKey(userName);
    if (key.length < 2) {
      setError("Username must be at least 2 characters (letters, numbers, underscore).");
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    try {
      setSaving(true);
      await user.reload();
      if (!user.email) {
        setError("Your account has no email on file.");
        setSaving(false);
        return;
      }

      const memberRef = doc(db, "membersCollection", user.uid);
      const nameKeyRef = doc(db, "userNames", key);

      await runTransaction(db, async (tx) => {
        const existingMember = await tx.get(memberRef);
        if (existingMember.exists()) {
          throw new Error("MEMBER_EXISTS");
        }
        const taken = await tx.get(nameKeyRef);
        if (taken.exists()) {
          throw new Error("USERNAME_TAKEN");
        }
        tx.set(nameKeyRef, {
          key,
          userId: user.uid,
          userName: userName.trim(),
          createdAt: serverTimestamp(),
        });
        tx.set(memberRef, {
          userId: user.uid,
          name: name.trim(),
          userName: userName.trim(),
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: serverTimestamp(),
          profilePicture: "",
          userBio: "",
          accountStatus: "active",
          spamActiveReportCount: 0,
          spamTotalReportCount: 0,
        });
      });

      if (!user.emailVerified) {
        await sendEmailVerification(user);
      }
      navigate("/member/login?verify=1", { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "USERNAME_TAKEN") {
        setError("That username is already taken. Try another.");
      } else if (err instanceof Error && err.message === "MEMBER_EXISTS") {
        navigate("/community", { replace: true });
      } else {
        console.error(err);
        setError("Could not save your profile. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full bg-background text-foreground relative overflow-hidden min-h-[80vh] px-4">
      <div className="relative z-10 w-full max-w-md border border-foreground/10 rounded-2xl bg-foreground/[0.02] p-8 shadow-xl">
        <div className="inline-flex py-1 px-3 mb-6 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
          <Activity className="w-4 h-4 mr-2 text-primary" /> Community profile
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Create your community profile</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Partner accounts stay separate from community until you add a profile here. Name and username
          cannot be changed later. You need a verified email to post and comment.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={emailDisplay} disabled className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-foreground/5 border-foreground/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userName">Username</Label>
            <Input
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              autoComplete="username"
              className="bg-foreground/5 border-foreground/10"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save and continue"}
          </Button>
        </form>

        <Button variant="ghost" asChild className="w-full mt-4">
          <Link to="/community" className="flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to community
          </Link>
        </Button>
      </div>
    </div>
  );
}

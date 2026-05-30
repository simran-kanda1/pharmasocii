import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { AdminDetailChrome } from "@/components/admin/community/AdminDetailChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadMemberDetail, type AdminMemberDetail } from "@/lib/adminCommunityData";
import { adminSetMemberStatus } from "@/lib/adminCommunityCallables";

type Props = {
  memberId: string;
  onBack: () => void;
  onSaved: () => void;
};

export function AdminMemberEditPage({ memberId, onBack, onSaved }: Props) {
  const [member, setMember] = useState<AdminMemberDetail | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [institution, setInstitution] = useState("");
  const [industry, setIndustry] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<"active" | "spam_blocked" | "admin_hold">("active");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const m = await loadMemberDetail(memberId);
      setMember(m);
      if (m) {
        setName(m.name || "");
        setPhone(m.phone || "");
        setCountry(m.country || "");
        setInstitution(m.institution || "");
        setIndustry(m.industry || "");
        setBio(m.userBio || "");
        setStatus((m.accountStatus as typeof status) || "active");
      }
    })();
  }, [memberId]);

  const submit = async () => {
    if (!member) return;
    setBusy(true);
    setMsg("");
    try {
      await updateDoc(doc(db, "membersCollection", memberId), {
        name: name.trim(),
        phone: phone.trim(),
        country: country.trim(),
        institution: institution.trim(),
        industry: industry.trim(),
        userBio: bio.trim(),
      });
      const prevStatus = member.accountStatus || "active";
      if (status !== prevStatus) {
        await adminSetMemberStatus({
          userId: memberId,
          status,
          reason: status === "admin_hold" ? "Admin hold" : undefined,
          clearSpamCounters: status === "active",
        });
      }
      setMsg("Member updated.");
      onSaved();
    } catch (e) {
      console.error(e);
      setMsg("Could not save member.");
    } finally {
      setBusy(false);
    }
  };

  if (!member) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const isBlocked = member.accountStatus === "spam_blocked";

  return (
    <AdminDetailChrome
      title="Edit member information"
      breadcrumb={["Members", "Edit member info"]}
      onBack={onBack}
      backLabel="Back to member details"
    >
      <form
        className="p-6 space-y-4 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Username</Label>
          <Input value={member.userName || ""} disabled className="bg-muted/40" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={member.email || ""} disabled className="bg-muted/40" />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <Input value="••••••••" disabled className="bg-muted/40" />
          <p className="text-xs text-muted-foreground">Password is managed by Firebase Authentication.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Member Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="admin_hold">On hold</SelectItem>
                <SelectItem value="spam_blocked">Blocked (30 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>User Verified</Label>
            <Input value={member.emailVerified ? "Yes" : "No"} disabled className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label>Is Blocked</Label>
            <Input value={isBlocked ? "Yes" : "No"} disabled className="bg-muted/40" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Institution</Label>
          <Input value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>About Me</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <Button type="submit" disabled={busy}>
          Submit
        </Button>
      </form>
    </AdminDetailChrome>
  );
}

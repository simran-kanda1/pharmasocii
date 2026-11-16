import { useEffect, useState } from "react";
import { auth } from "@/firebase";
import { AdminDetailChrome } from "@/components/admin/community/AdminDetailChrome";
import { AdminAttributeTable } from "@/components/admin/community/AdminAttributeTable";
import { AdminSpamReportsBlock } from "@/components/admin/community/AdminSpamReportsBlock";
import { Button } from "@/components/ui/button";
import {
  loadMemberDetail,
  loadSpamReportsForAuthor,
  type AdminMemberDetail,
  type AdminSpamReportRow,
} from "@/lib/adminCommunityData";
import { adminSetMemberStatus } from "@/lib/adminCommunityCallables";
import { logMemberActivity } from "@/lib/auditLogger";
import { formatAdminDate } from "@/lib/formatAdminDate";
import { memberStatusLabel, resolveSpamBlockStartedAt, resolveSpamBlockUntil } from "@/lib/adminCommunityDisplay";

type Props = {
  memberId: string;
  onBack: () => void;
  onEdit: () => void;
  backLabel?: string;
};

export function AdminMemberDetailPage({ memberId, onBack, onEdit, backLabel = "Back To Members" }: Props) {
  const [member, setMember] = useState<AdminMemberDetail | null>(null);
  const [reports, setReports] = useState<AdminSpamReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [m, r] = await Promise.all([loadMemberDetail(memberId), loadSpamReportsForAuthor(memberId)]);
      setMember(m);
      setReports(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  if (loading && !member) {
    return <p className="text-sm text-muted-foreground">Loading member…</p>;
  }
  if (!member) {
    return <p className="text-sm text-muted-foreground">Member not found.</p>;
  }

  const blockStarted = resolveSpamBlockStartedAt(member, reports);
  const blockUntil = resolveSpamBlockUntil(member, blockStarted);
  const prevStatus = member.accountStatus || "active";
  const isActive = prevStatus === "active";

  const toggleActive = async () => {
    const nextStatus = isActive ? "admin_hold" : "active";
    const verb = isActive ? "Inactivate" : "Activate";
    if (!window.confirm(`${verb} account for ${member.name || member.userName || member.email || memberId}?`)) return;
    setStatusBusy(true);
    setStatusMsg("");
    try {
      await adminSetMemberStatus({
        userId: memberId,
        status: nextStatus,
        reason: nextStatus === "admin_hold" ? "Admin hold" : undefined,
        clearSpamCounters: nextStatus === "active",
      });
      const u = auth.currentUser;
      if (u) {
        await logMemberActivity({
          memberId,
          memberName: member.name || member.userName || memberId,
          action: "MEMBER_STATUS_CHANGED",
          details: `Account status changed from "${prevStatus}" to "${nextStatus}" by admin (${u.email})`,
          category: "admin",
          performedBy: "admin",
          metadata: {
            adminEmail: u.email,
            prevStatus,
            newStatus: nextStatus,
            scope: "community_members",
          },
        });
      }
      setStatusMsg(nextStatus === "active" ? "Account activated." : "Account inactivated.");
      await load();
    } catch (e) {
      console.error(e);
      setStatusMsg("Could not change account status.");
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <AdminDetailChrome title="Member details" breadcrumb={["Members", "Member details"]} onBack={onBack} backLabel={backLabel}>
      <AdminAttributeTable
        rows={[
          { label: "Name", value: member.name || "N/A" },
          { label: "Username", value: member.userName || "N/A" },
          { label: "Email", value: member.email || "N/A" },
          { label: "Phone", value: member.phone || "N/A" },
          { label: "Country", value: member.country || "N/A" },
          { label: "Institution", value: member.institution || "N/A" },
          { label: "Industry", value: member.industry || "N/A" },
          { label: "Tagline", value: member.aboutMe || "N/A" },
          { label: "About", value: member.userBio || "N/A" },
          { label: "Verified Email", value: member.emailVerified ? "Yes" : "No" },
          { label: "Status", value: memberStatusLabel(member.accountStatus, blockUntil) },
          { label: "Block start date", value: formatAdminDate(blockStarted) },
          { label: "Block end date", value: formatAdminDate(blockUntil) },
          { label: "Current spam cycle", value: `${member.spamActiveReportCount ?? 0} / 3` },
          { label: "Total lifetime spams", value: String(member.spamTotalReportCount ?? 0) },
          { label: "Created At", value: formatAdminDate(member.createdAt?.toDate?.()) },
        ]}
      />
      <AdminSpamReportsBlock reports={reports} loading={loading} showCommentLink />
      <div className="px-4 pb-4 flex flex-wrap items-center gap-4">
        <button type="button" className="text-sm text-primary hover:underline" onClick={onEdit}>
          Edit member information
        </button>
        <Button
          type="button"
          size="sm"
          variant={isActive ? "destructive" : "default"}
          disabled={statusBusy}
          onClick={() => void toggleActive()}
        >
          {isActive ? "Inactivate account" : "Activate account"}
        </Button>
        {statusMsg && <span className="text-sm text-muted-foreground">{statusMsg}</span>}
      </div>
    </AdminDetailChrome>
  );
}

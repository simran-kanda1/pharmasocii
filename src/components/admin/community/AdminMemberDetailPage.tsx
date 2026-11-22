import { useEffect, useState } from "react";
import { auth } from "@/firebase";
import { logMemberActivity } from "@/lib/auditLogger";
import { adminSetMemberStatus } from "@/lib/adminCommunityCallables";
import { Button } from "@/components/ui/button";
import { AdminDetailChrome } from "@/components/admin/community/AdminDetailChrome";
import { AdminAttributeTable } from "@/components/admin/community/AdminAttributeTable";
import { AdminSpamReportsBlock } from "@/components/admin/community/AdminSpamReportsBlock";
import {
  loadMemberDetail,
  loadSpamReportsForAuthor,
  type AdminMemberDetail,
  type AdminSpamReportRow,
} from "@/lib/adminCommunityData";
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [m, r] = await Promise.all([loadMemberDetail(memberId), loadSpamReportsForAuthor(memberId)]);
        setMember(m);
        setReports(r);
      } finally {
        setLoading(false);
      }
    })();
  }, [memberId]);

  const handleToggleStatus = async (targetStatus: "active" | "admin_hold") => {
    if (!member) return;
    const isActivating = targetStatus === "active";
    const actionLabel = isActivating ? "Activate" : "Inactivate";
    if (!window.confirm(`${actionLabel} member account for @${member.userName || member.name}?`)) return;
    setStatusBusy(true);
    try {
      await adminSetMemberStatus({
        userId: memberId,
        status: targetStatus,
        reason: isActivating ? undefined : "Admin hold",
        clearSpamCounters: isActivating,
      });
      const u = auth.currentUser;
      if (u) {
        await logMemberActivity({
          memberId,
          memberName: member.name || member.userName || memberId,
          action: "MEMBER_STATUS_CHANGED",
          details: `Account status changed from "${member.accountStatus || "active"}" to "${targetStatus}" by admin (${u.email})`,
          category: "admin",
          performedBy: "admin",
          metadata: {
            adminEmail: u.email,
            prevStatus: member.accountStatus || "active",
            newStatus: targetStatus,
            scope: "community_members",
          },
        });
      }
      setMember({ ...member, accountStatus: targetStatus });
    } catch (e) {
      console.error(e);
      alert(`Could not ${actionLabel.toLowerCase()} member.`);
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading && !member) {
    return <p className="text-sm text-muted-foreground">Loading member…</p>;
  }
  if (!member) {
    return <p className="text-sm text-muted-foreground">Member not found.</p>;
  }

  const blockStarted = resolveSpamBlockStartedAt(member, reports);
  const blockUntil = resolveSpamBlockUntil(member, blockStarted);

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
      <div className="px-4 pb-4 flex items-center justify-between">
        <button type="button" className="text-sm text-primary hover:underline" onClick={onEdit}>
          Edit member information
        </button>
        {member.accountStatus === "admin_hold" || member.accountStatus === "spam_blocked" ? (
          <Button
            size="sm"
            variant="outline"
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            disabled={statusBusy}
            onClick={() => handleToggleStatus("active")}
          >
            Activate account
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
            disabled={statusBusy}
            onClick={() => handleToggleStatus("admin_hold")}
          >
            Inactivate account
          </Button>
        )}
      </div>
    </AdminDetailChrome>
  );
}

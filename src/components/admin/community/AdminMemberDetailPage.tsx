import { useEffect, useState } from "react";
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
import { memberStatusLabel } from "@/lib/adminCommunityDisplay";

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

  if (loading && !member) {
    return <p className="text-sm text-muted-foreground">Loading member…</p>;
  }
  if (!member) {
    return <p className="text-sm text-muted-foreground">Member not found.</p>;
  }

  const blockUntil = member.spamBlockUntil?.toDate?.() ?? null;
  const blockStarted = member.spamBlockStartedAt?.toDate?.() ?? null;

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
          { label: "About", value: member.userBio || "N/A" },
          { label: "Verified Email", value: member.emailVerified ? "Yes" : "No" },
          { label: "Status", value: memberStatusLabel(member.accountStatus, blockUntil) },
          { label: "Block start date", value: formatAdminDate(blockStarted) },
          { label: "Block end date", value: formatAdminDate(blockUntil) },
          { label: "Lifetime spam reports", value: String(member.spamTotalReportCount ?? 0) },
          { label: "Current spam cycle", value: `${member.spamActiveReportCount ?? 0} / 3` },
          { label: "Created At", value: formatAdminDate(member.createdAt?.toDate?.()) },
        ]}
      />
      <AdminSpamReportsBlock reports={reports} loading={loading} showCommentLink />
      <div className="px-4 pb-4">
        <button type="button" className="text-sm text-primary hover:underline" onClick={onEdit}>
          Edit member information
        </button>
      </div>
    </AdminDetailChrome>
  );
}

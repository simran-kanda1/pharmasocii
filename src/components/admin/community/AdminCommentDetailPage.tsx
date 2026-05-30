import { AdminDetailChrome } from "@/components/admin/community/AdminDetailChrome";
import { AdminAttributeTable } from "@/components/admin/community/AdminAttributeTable";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { commentFrontEndUrl } from "@/lib/adminCommunityDisplay";
import { formatAdminDate } from "@/lib/formatAdminDate";
import type { AdminReportedCommentRow } from "@/lib/adminCommunityData";

type Props = {
  row: AdminReportedCommentRow;
  onBack: () => void;
};

export function AdminCommentDetailPage({ row, onBack }: Props) {
  const frontUrl = row.postId ? commentFrontEndUrl(row.postId, row.commentId) : null;

  return (
    <AdminDetailChrome
      title="Comment details"
      breadcrumb={["Reported comments", "Comment details"]}
      onBack={onBack}
      backLabel="Back To Reported Comments"
    >
      <AdminAttributeTable
        rows={[
          { label: "Reporter", value: row.reporterLabel || "—" },
          { label: "Comment owner", value: row.commentOwnerLabel || "—" },
          { label: "Account status", value: row.commentOwnerStatus || "—" },
          { label: "Post title", value: row.postTitle || "—" },
          { label: "Comment preview", value: row.commentPreview || "—" },
          { label: "Reason", value: row.reason || "—" },
          { label: "Reported on", value: formatAdminDate(row.createdAt?.toDate?.()) },
          { label: "Comment status", value: row.commentArchived ? "Not active" : "Active" },
          { label: "Archive date", value: formatAdminDate(row.archivedAt?.toDate?.()) },
        ]}
      />
      {frontUrl && (
        <div className="px-4 pb-6">
          <Button type="button" asChild>
            <a href={frontUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open comment on site (new tab)
            </a>
          </Button>
        </div>
      )}
    </AdminDetailChrome>
  );
}

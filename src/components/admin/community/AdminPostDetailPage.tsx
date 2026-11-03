import { useEffect, useState } from "react";
import { auth } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { adminArchivePost, adminRestorePost } from "@/lib/adminCommunityCallables";
import { AdminDetailChrome } from "@/components/admin/community/AdminDetailChrome";
import { AdminAttributeTable } from "@/components/admin/community/AdminAttributeTable";
import { AdminPostReportsCell } from "@/components/admin/community/AdminSpamReportsBlock";
import { AdminPostImageThumb } from "@/components/admin/AdminPostImageThumb";
import {
  loadPostDetail,
  loadSpamReportsForPost,
  type AdminPostDetail,
  type AdminSpamReportRow,
} from "@/lib/adminCommunityData";
import { formatAdminDate } from "@/lib/formatAdminDate";
import { formatPostCategoriesDisplay } from "@/lib/adminCommunityDisplay";

type Props = {
  postId: string;
  archived?: boolean;
  onBack: () => void;
  onStatusChanged?: () => void;
  backLabel?: string;
};

export function AdminPostDetailPage({
  postId,
  archived,
  onBack,
  onStatusChanged,
  backLabel = "Back To Posts",
}: Props) {
  const [post, setPost] = useState<AdminPostDetail | null>(null);
  const [reports, setReports] = useState<AdminSpamReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, r] = await Promise.all([loadPostDetail(postId), loadSpamReportsForPost(postId)]);
        setPost(p);
        setReports(r);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  const changeStatus = async (nextActive: boolean) => {
    if (!post || statusBusy) return;
    setStatusBusy(true);
    setStatusMsg("");
    try {
      if (nextActive) await adminRestorePost(postId);
      else await adminArchivePost(postId, "admin_deactivate");
      const u = auth.currentUser;
      if (u) {
        await logActivity({
          partnerId: u.uid,
          partnerName: u.email || "Admin",
          action: nextActive ? "POST_RESTORED" : "POST_ARCHIVED",
          details: `${nextActive ? "Activated" : "Deactivated"} post ${postId}`,
          category: "admin",
          performedBy: "admin",
          metadata: { scope: "community_posts", adminEmail: u.email, postId },
        });
      }
      const refreshed = await loadPostDetail(postId);
      setPost(refreshed);
      onStatusChanged?.();
      setStatusMsg(nextActive ? "Post is active." : "Post is inactive.");
    } catch (e) {
      console.error(e);
      setStatusMsg("Could not change post status.");
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading && !post) return <p className="text-sm text-muted-foreground">Loading post…</p>;
  if (!post) return <p className="text-sm text-muted-foreground">Post not found.</p>;

  const text = post.text || "";
  const descPreview = text.length > 280 && !descExpanded ? `${text.slice(0, 280)}…` : text;

  return (
    <AdminDetailChrome
      title="Post details"
      breadcrumb={["Posts", "Post details"]}
      onBack={onBack}
      backLabel={backLabel}
    >
      <AdminAttributeTable
        rows={[
          { label: "Title", value: post.title || "—" },
          {
            label: "Description",
            value: (
              <div>
                <p className="whitespace-pre-wrap">{descPreview || "—"}</p>
                {text.length > 280 && (
                  <button
                    type="button"
                    className="text-sm text-teal-700 hover:underline mt-1"
                    onClick={() => setDescExpanded((v) => !v)}
                  >
                    {descExpanded ? "See less" : "See More"}
                  </button>
                )}
              </div>
            ),
          },
          {
            label: "Image",
            value: post.imageStoragePath ? (
              <AdminPostImageThumb path={post.imageStoragePath} />
            ) : (
              "No image available"
            ),
          },
          { label: "Likes", value: String(post.likeCount ?? 0) },
          { label: "Comments", value: `${post.activeCommentCount ?? post.commentCount ?? 0} active · ${post.totalCommentCount ?? post.commentCount ?? 0} total` },
          { label: "Countries", value: (post.countries || []).join(", ") || "—" },
          {
            label: "Categories",
            value: formatPostCategoriesDisplay(
              post.mainCategories,
              post.subCategories,
              post.subSubCategories,
            ),
          },
          {
            label: "Posted by",
            value: (
              <span>
                {post.authorUserName || "—"}
                {post.authorEmail ? (
                  <span className="block text-xs text-muted-foreground">{post.authorEmail}</span>
                ) : null}
              </span>
            ),
          },
          {
            label: "Post status",
            value: (
              <div className="space-y-1">
                <select
                  className="h-9 rounded-md border bg-white px-2 text-sm"
                  value={post.archived || archived ? "inactive" : "active"}
                  disabled={statusBusy}
                  onChange={(e) => void changeStatus(e.target.value === "active")}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {statusMsg ? <p className="text-xs text-muted-foreground">{statusMsg}</p> : null}
              </div>
            ),
          },
          { label: "Archive date", value: formatAdminDate(post.archivedAt?.toDate?.()) },
          { label: "Created", value: formatAdminDate(post.createdAt?.toDate?.()) },
          { label: "Spam report count", value: String(reports.filter((r) => r.targetType !== "comment").length) },
          {
            label: "Reports",
            value: <AdminPostReportsCell reports={reports} loading={loading} />,
          },
        ]}
      />
    </AdminDetailChrome>
  );
}

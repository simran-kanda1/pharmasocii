import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";

type Props = {
  postId: string;
  archived?: boolean;
  onBack: () => void;
  onEdit?: () => void;
  backLabel?: string;
};

export function AdminPostDetailPage({
  postId,
  archived,
  onBack,
  onEdit,
  backLabel = "Back To Posts",
}: Props) {
  const [post, setPost] = useState<AdminPostDetail | null>(null);
  const [reports, setReports] = useState<AdminSpamReportRow[]>([]);
  const [loading, setLoading] = useState(true);
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
          { label: "Post status", value: post.archived || archived ? "Archived" : "Active" },
          { label: "Archive date", value: formatAdminDate(post.archivedAt?.toDate?.()) },
          { label: "Created", value: formatAdminDate(post.createdAt?.toDate?.()) },
          { label: "Spam report count", value: String(post.spamReportCount ?? 0) },
          {
            label: "Reports",
            value: <AdminPostReportsCell reports={reports} loading={loading} />,
          },
        ]}
      />
      {onEdit && (
        <div className="px-4 pb-4">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit post
          </Button>
        </div>
      )}
    </AdminDetailChrome>
  );
}

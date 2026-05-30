import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPostImageThumb } from "@/components/admin/AdminPostImageThumb";
import { AdminRowActions } from "@/components/admin/community/AdminRowActions";
import { formatAdminDate } from "@/lib/formatAdminDate";
import type { AdminPostRow } from "@/lib/adminCommunityData";

type Props = {
  rows: AdminPostRow[];
  loading: boolean;
  page: number;
  pageSize: number;
  archived?: boolean;
  busy?: boolean;
  onView: (postId: string) => void;
  onEdit: (postId: string) => void;
  onDelete?: (post: AdminPostRow) => void;
  onActivate?: (postId: string) => void;
};

export function AdminPostListTable({
  rows,
  loading,
  page,
  pageSize,
  archived,
  busy,
  onView,
  onEdit,
  onDelete,
  onActivate,
}: Props) {
  const colSpan = archived ? 13 : 12;

  return (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sr.</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Content</TableHead>
            <TableHead>Image</TableHead>
            <TableHead>Likes</TableHead>
            <TableHead>Comments</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Spam</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Post status</TableHead>
            <TableHead>Created</TableHead>
            {archived && <TableHead>Archive date</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colSpan}>Loading…</TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan}>No posts.</TableCell>
            </TableRow>
          ) : (
            rows.map((p, idx) => (
              <TableRow key={p.id}>
                <TableCell>{page * pageSize + idx + 1}</TableCell>
                <TableCell className="max-w-[160px] truncate font-medium">{p.title || "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate text-muted-foreground">{p.text || "—"}</TableCell>
                <TableCell>
                  <AdminPostImageThumb path={p.imageStoragePath} />
                </TableCell>
                <TableCell>{p.likeCount ?? 0}</TableCell>
                <TableCell>{p.commentCount ?? 0}</TableCell>
                <TableCell className="max-w-[140px] truncate">
                  {p.authorUserName}
                  {p.authorEmail ? (
                    <span className="block text-xs text-muted-foreground truncate">{p.authorEmail}</span>
                  ) : null}
                </TableCell>
                <TableCell>{p.spamReportCount ?? 0}</TableCell>
                <TableCell>
                  {p.authorAccountStatus === "active" || !p.authorAccountStatus ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                  ) : (
                    <Badge variant="secondary">{p.authorAccountStatus}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {archived ? (
                    <Badge variant="secondary">Not active</Badge>
                  ) : (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                  )}
                </TableCell>
                <TableCell>{formatAdminDate(p.createdAt?.toDate?.())}</TableCell>
                {archived && (
                  <TableCell>{formatAdminDate(p.archivedAt?.toDate?.())}</TableCell>
                )}
                <TableCell>
                  <div className="flex justify-end items-center gap-1">
                    {archived && onActivate && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => onActivate(p.id)}
                      >
                        Activate
                      </Button>
                    )}
                    <AdminRowActions
                      disabled={busy}
                      onView={() => onView(p.id)}
                      onEdit={() => onEdit(p.id)}
                      onDelete={onDelete ? () => onDelete(p) : undefined}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

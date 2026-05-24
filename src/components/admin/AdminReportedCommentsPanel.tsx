import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { loadReportedComments, type AdminReportedCommentRow } from "@/lib/adminCommunityData";
import { adminRestoreComment } from "@/lib/adminCommunityCallables";
import { formatAdminDate } from "@/lib/formatAdminDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";

const PAGE_SIZES = [10, 25, 50] as const;

export function AdminReportedCommentsPanel() {
  const [rows, setRows] = useState<AdminReportedCommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [page, setPage] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await loadReportedComments());
    } catch (e) {
      console.error(e);
      setMsg("Could not load reported comments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.reporterLabel || "").toLowerCase().includes(q) ||
        (r.commentOwnerLabel || "").toLowerCase().includes(q) ||
        (r.postTitle || "").toLowerCase().includes(q) ||
        (r.reason || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => setPage(0), [search, pageSize]);

  const reactivate = async (row: AdminReportedCommentRow) => {
    if (!row.postId || !row.commentId) return;
    setBusy(true);
    setMsg("");
    try {
      await adminRestoreComment(row.postId, row.commentId);
      const u = auth.currentUser;
      if (u) {
        await logActivity({
          partnerId: u.uid,
          partnerName: u.email || "Admin",
          action: "ADMIN_ACTION",
          details: `Reactivated comment ${row.commentId}`,
          category: "admin",
          metadata: { scope: "reported_comments" },
        });
      }
      setMsg("Comment reactivated.");
      await load();
    } catch (e) {
      console.error(e);
      setMsg("Could not reactivate comment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Reported comments</p>
        <p className="text-sm text-muted-foreground">All reported comments and replies from community members.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as (typeof PAGE_SIZES)[number])}>
          <SelectTrigger className="w-[120px] h-10 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search reporter, owner, post, reason…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm h-10 bg-white"
        />
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sr.</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Comment owner</TableHead>
              <TableHead>Account status</TableHead>
              <TableHead>Comment preview</TableHead>
              <TableHead>Post title</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Reported on</TableHead>
              <TableHead>Comment status</TableHead>
              <TableHead>Archive date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11}>Loading…</TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11}>No reported comments.</TableCell>
              </TableRow>
            ) : (
              pageRows.map((r, idx) => (
                <TableRow key={r.id}>
                  <TableCell>{page * pageSize + idx + 1}</TableCell>
                  <TableCell className="max-w-[120px] truncate">{r.reporterLabel}</TableCell>
                  <TableCell className="max-w-[120px] truncate">{r.commentOwnerLabel}</TableCell>
                  <TableCell>
                    {r.commentOwnerStatus === "active" ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                    ) : (
                      <Badge variant="secondary">{r.commentOwnerStatus || "Not active"}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.commentPreview}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{r.postTitle}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{r.reason || "—"}</TableCell>
                  <TableCell>{formatAdminDate(r.createdAt?.toDate?.())}</TableCell>
                  <TableCell>{r.commentArchived ? "Not active" : "Active"}</TableCell>
                  <TableCell>{formatAdminDate(r.archivedAt?.toDate?.())}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.commentArchived && r.postId && r.commentId && (
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => reactivate(r)}>
                          Reactivate
                        </Button>
                      )}
                      {r.postId && (
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" asChild>
                          <Link
                            to={`/community/post/${r.postId}${r.commentId ? `?highlight=${r.commentId}` : ""}`}
                            target="_blank"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} report(s)</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="self-center">
            Page {page + 1} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading || busy}>
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { loadCommunityPosts, type AdminPostRow } from "@/lib/adminCommunityData";
import { adminArchivePost } from "@/lib/adminCommunityCallables";
import { formatAdminDate } from "@/lib/formatAdminDate";
import { AdminPostImageThumb } from "@/components/admin/AdminPostImageThumb";
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

export function AdminMemberPostsPanel() {
  const [rows, setRows] = useState<AdminPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [page, setPage] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await loadCommunityPosts(false));
    } catch (e) {
      console.error(e);
      setMsg("Could not load posts.");
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
      (p) =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.authorUserName || "").toLowerCase().includes(q) ||
        (p.authorEmail || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => setPage(0), [search, pageSize]);

  const deactivate = async (postId: string) => {
    setBusy(true);
    setMsg("");
    try {
      await adminArchivePost(postId, "admin_deactivate");
      const u = auth.currentUser;
      if (u) {
        await logActivity({
          partnerId: u.uid,
          partnerName: u.email || "Admin",
          action: "ADMIN_ACTION",
          details: `Deactivated post ${postId}`,
          category: "admin",
          metadata: { scope: "community_posts" },
        });
      }
      setMsg("Post deactivated.");
      await load();
    } catch (e) {
      console.error(e);
      setMsg("Could not deactivate post.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Live community posts from members only (authors with a <code className="text-xs">membersCollection</code>{" "}
        profile).
      </p>

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
          placeholder="Search title or author…"
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12}>Loading…</TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12}>No posts.</TableCell>
              </TableRow>
            ) : (
              pageRows.map((p, idx) => (
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
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                  </TableCell>
                  <TableCell>{formatAdminDate(p.createdAt?.toDate?.())}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => deactivate(p.id)}>
                        Deactivate
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <Link to={`/community/post/${p.id}`} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} post(s)</span>
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

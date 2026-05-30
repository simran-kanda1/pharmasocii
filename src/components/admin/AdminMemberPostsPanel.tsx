import { useEffect, useMemo, useState } from "react";
import { auth } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { loadCommunityPosts, type AdminPostRow } from "@/lib/adminCommunityData";
import { adminArchivePost } from "@/lib/adminCommunityCallables";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPostListTable } from "@/components/admin/community/AdminPostListTable";
import { AdminConfirmDialog } from "@/components/admin/community/AdminConfirmDialog";
import { AdminPostDetailPage } from "@/components/admin/community/AdminPostDetailPage";
import { AdminPostEditPage } from "@/components/admin/community/AdminPostEditPage";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";

const PAGE_SIZES = [10, 25, 50] as const;

type Screen = { type: "list" } | { type: "view"; id: string } | { type: "edit"; id: string };

export function AdminMemberPostsPanel() {
  const [rows, setRows] = useState<AdminPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [page, setPage] = useState(0);
  const [screen, setScreen] = useState<Screen>({ type: "list" });
  const [archiveTarget, setArchiveTarget] = useState<AdminPostRow | null>(null);

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

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setBusy(true);
    setMsg("");
    try {
      await adminArchivePost(archiveTarget.id, "admin_deactivate");
      const u = auth.currentUser;
      if (u) {
        await logActivity({
          partnerId: u.uid,
          partnerName: u.email || "Admin",
          action: "ADMIN_ACTION",
          details: `Deactivated post ${archiveTarget.id}`,
          category: "admin",
          metadata: { scope: "community_posts" },
        });
      }
      setArchiveTarget(null);
      setMsg("Post archived.");
      if (screen.type !== "list") setScreen({ type: "list" });
      await load();
    } catch (e) {
      console.error(e);
      setMsg("Could not archive post.");
    } finally {
      setBusy(false);
    }
  };

  if (screen.type === "view") {
    return (
      <AdminPostDetailPage
        postId={screen.id}
        onBack={() => setScreen({ type: "list" })}
        onEdit={() => setScreen({ type: "edit", id: screen.id })}
      />
    );
  }

  if (screen.type === "edit") {
    return (
      <AdminPostEditPage
        postId={screen.id}
        onBack={() => setScreen({ type: "view", id: screen.id })}
        onSaved={() => {
          void load();
          setScreen({ type: "view", id: screen.id });
        }}
      />
    );
  }

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

      <AdminPostListTable
        rows={pageRows}
        loading={loading}
        page={page}
        pageSize={pageSize}
        busy={busy}
        onView={(id) => setScreen({ type: "view", id })}
        onEdit={(id) => setScreen({ type: "edit", id })}
        onDelete={(p) => setArchiveTarget(p)}
      />

      <AdminTablePagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        totalLabel={`${filtered.length} post(s)`}
        onRefresh={load}
        refreshDisabled={loading || busy}
      />

      <AdminConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Archive this post?"
        description={
          archiveTarget
            ? `Move "${archiveTarget.title || "Untitled"}" to archive? Comments will be archived as well.`
            : ""
        }
        confirmLabel="Archive"
        destructive
        busy={busy}
        onConfirm={confirmArchive}
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { loadCommunityMembers, type AdminMemberRow } from "@/lib/adminCommunityData";
import { formatAdminDate, formatAdminDateTime } from "@/lib/formatAdminDate";
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
import { AdminRowActions } from "@/components/admin/community/AdminRowActions";
import { AdminConfirmDialog } from "@/components/admin/community/AdminConfirmDialog";
import { AdminMemberDetailPage } from "@/components/admin/community/AdminMemberDetailPage";
import { AdminMemberEditPage } from "@/components/admin/community/AdminMemberEditPage";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";

const PAGE_SIZES = [10, 25, 50] as const;

type Screen = { type: "list" } | { type: "view"; id: string } | { type: "edit"; id: string };

function statusBadge(status?: string) {
  if (status === "spam_blocked") return <Badge variant="destructive">Blocked</Badge>;
  if (status === "admin_hold") return <Badge variant="secondary">On hold</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>;
}

export function AdminMembersPanel() {
  const [rows, setRows] = useState<AdminMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [page, setPage] = useState(0);
  const [screen, setScreen] = useState<Screen>({ type: "list" });
  const [deleteTarget, setDeleteTarget] = useState<AdminMemberRow | null>(null);

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      setRows(await loadCommunityMembers());
    } catch (e) {
      console.error(e);
      setMsg("Could not load members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((m) => {
      if (statusFilter !== "all" && (m.accountStatus || "active") !== statusFilter) return false;
      if (!q) return true;
      return (
        (m.name || "").toLowerCase().includes(q) ||
        (m.userName || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, pageSize]);

  const logAction = async (details: string) => {
    const u = auth.currentUser;
    if (!u) return;
    await logActivity({
      partnerId: u.uid,
      partnerName: u.email || "Admin",
      action: "ADMIN_ACTION",
      details,
      category: "admin",
      metadata: { scope: "community_members" },
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "membersCollection", deleteTarget.id));
      await logAction(`Deleted member ${deleteTarget.userName}`);
      setDeleteTarget(null);
      setMsg("Member profile deleted.");
      if (screen.type !== "list") setScreen({ type: "list" });
      await load();
    } catch (e) {
      console.error(e);
      setMsg("Could not delete member.");
    } finally {
      setBusy(false);
    }
  };

  if (screen.type === "view") {
    return (
      <AdminMemberDetailPage
        memberId={screen.id}
        onBack={() => setScreen({ type: "list" })}
        onEdit={() => setScreen({ type: "edit", id: screen.id })}
      />
    );
  }

  if (screen.type === "edit") {
    return (
      <AdminMemberEditPage
        memberId={screen.id}
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
        Only users with a community profile in <code className="text-xs">membersCollection</code> — partner-only
        accounts are excluded.
      </p>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-10 bg-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="admin_hold">On hold</SelectItem>
              <SelectItem value="spam_blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
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
        </div>
        <Input
          placeholder="Search name, username, email…"
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
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Posts</TableHead>
              <TableHead>Spam reports</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Block start</TableHead>
              <TableHead>Block end</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={17} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-muted-foreground">
                  No community members found.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((m, idx) => (
                <TableRow key={m.id}>
                  <TableCell>{page * pageSize + idx + 1}</TableCell>
                  <TableCell>{m.name || "—"}</TableCell>
                  <TableCell>{m.userName || "—"}</TableCell>
                  <TableCell className="max-w-[140px] truncate">{m.email || "—"}</TableCell>
                  <TableCell>{m.phone || "—"}</TableCell>
                  <TableCell>{m.country || "—"}</TableCell>
                  <TableCell>{m.institution || "—"}</TableCell>
                  <TableCell>{m.industry || "—"}</TableCell>
                  <TableCell>{m.postCount}</TableCell>
                  <TableCell>{m.spamTotalReportCount ?? 0}</TableCell>
                  <TableCell>{statusBadge(m.accountStatus)}</TableCell>
                  <TableCell>{m.emailVerified ? "Yes" : "No"}</TableCell>
                  <TableCell>{formatAdminDate(m.createdAt?.toDate?.())}</TableCell>
                  <TableCell>{formatAdminDateTime(m.lastLoginAt?.toDate?.())}</TableCell>
                  <TableCell>{formatAdminDate(m.spamBlockStartedAt?.toDate?.())}</TableCell>
                  <TableCell>{formatAdminDate(m.spamBlockUntil?.toDate?.())}</TableCell>
                  <TableCell>
                    <AdminRowActions
                      disabled={busy}
                      onView={() => setScreen({ type: "view", id: m.id })}
                      onEdit={() => setScreen({ type: "edit", id: m.id })}
                      onDelete={() => setDeleteTarget(m)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AdminTablePagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        totalLabel={`${filtered.length} member${filtered.length === 1 ? "" : "s"}`}
        onRefresh={load}
        refreshDisabled={loading || busy}
      />

      <AdminConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete member profile?"
        description={
          deleteTarget
            ? `Remove the community profile for @${deleteTarget.userName}? This does not delete their Firebase Authentication account.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

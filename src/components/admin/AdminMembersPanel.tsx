import { useEffect, useMemo, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { loadCommunityMembers, type AdminMemberRow } from "@/lib/adminCommunityData";
import { formatAdminDate, formatAdminDateTime } from "@/lib/formatAdminDate";
import {
  adminApproveMemberVerification,
  adminRefreshVerificationLink,
  adminSetMemberStatus,
} from "@/lib/adminCommunityCallables";
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
import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const PAGE_SIZES = [10, 25, 50] as const;

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
  const [selected, setSelected] = useState<AdminMemberRow | null>(null);

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

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      await logAction(label);
      setMsg("Done.");
      await load();
      if (selected) {
        const refreshed = (await loadCommunityMembers()).find((r) => r.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (e) {
      console.error(e);
      setMsg("Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (m: AdminMemberRow) => {
    if (!window.confirm(`Delete community profile for @${m.userName}? This does not delete Firebase Auth.`)) return;
    await run(`Deleted member ${m.userName}`, () => deleteDoc(doc(db, "membersCollection", m.id)));
    setSelected(null);
  };

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
              <TableHead>Blocked until</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={16} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} className="text-muted-foreground">
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
                  <TableCell>{formatAdminDate(m.spamBlockUntil?.toDate?.())}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(m)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        disabled={busy}
                        onClick={() => handleDelete(m)}
                      >
                        <Trash2 className="h-4 w-4" />
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
        <span>
          {filtered.length} member{filtered.length === 1 ? "" : "s"}
        </span>
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

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>@{selected.userName}</SheetTitle>
                <SheetDescription>{selected.email}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Status:</span> {selected.accountStatus || "active"}
                </p>
                <p>
                  <span className="text-muted-foreground">Verified:</span> {selected.emailVerified ? "Yes" : "No"}
                </p>
                <p>
                  <span className="text-muted-foreground">Posts:</span> {selected.postCount}
                </p>
                <p>
                  <span className="text-muted-foreground">Spam (active / total):</span>{" "}
                  {selected.spamActiveReportCount ?? 0} / {selected.spamTotalReportCount ?? 0}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {!selected.emailVerified && (
                  <>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(`Generated verify link for ${selected.userName}`, () =>
                          adminRefreshVerificationLink(selected.id),
                        )
                      }
                    >
                      Generate verify link
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(`Approved verification ${selected.userName}`, () =>
                          adminApproveMemberVerification(selected.id),
                        )
                      }
                    >
                      Approve email (QA)
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(`Hold ${selected.userName}`, () =>
                      adminSetMemberStatus({ userId: selected.id, status: "admin_hold", reason: "Admin hold" }),
                    )
                  }
                >
                  Hold
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(`Block ${selected.userName}`, () =>
                      adminSetMemberStatus({ userId: selected.id, status: "spam_blocked" }),
                    )
                  }
                >
                  Block 30d
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(`Reactivate ${selected.userName}`, () =>
                      adminSetMemberStatus({
                        userId: selected.id,
                        status: "active",
                        clearSpamCounters: true,
                      }),
                    )
                  }
                >
                  Reactivate
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminApproveMemberVerification,
  adminRefreshVerificationLink,
} from "@/lib/adminCommunityCallables";

type PendingRow = {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  status?: string;
  verifyLink?: string;
  linkError?: string;
  source?: string;
  updatedAt?: { toDate: () => Date };
  createdAt?: { toDate: () => Date };
};

function statusLabel(status?: string) {
  switch (status) {
    case "link_ready":
      return "Link ready";
    case "awaiting_verification":
      return "Awaiting link";
    case "link_unavailable":
      return "Link unavailable";
    case "admin_approved":
      return "Approved (admin)";
    case "verified":
      return "Verified";
    default:
      return status || "Pending";
  }
}

export function VerificationMirrorsPanel() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const q = query(collection(db, "pendingVerifications"), orderBy("updatedAt", "desc"), limit(30));
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PendingRow)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(e);
      setLoadError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleGenerate = async (userId: string) => {
    setBusyId(userId);
    setActionMsg(null);
    try {
      const res = await adminRefreshVerificationLink(userId);
      const data = res.data;
      if (data.hasLink) {
        setActionMsg("Verification link generated — copy or open below.");
      } else {
        setActionMsg(data.message || "Queued but no link yet (rate limit or Auth error).");
      }
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Could not generate link.");
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (userId: string) => {
    if (!window.confirm("Mark this member as email-verified in Firebase Auth? (QA only)")) return;
    setBusyId(userId);
    setActionMsg(null);
    try {
      await adminApproveMemberVerification(userId);
      setActionMsg("Member marked verified.");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Could not approve.");
    } finally {
      setBusyId(null);
    }
  };

  const activeRows = rows.filter((r) => r.status !== "admin_approved" && r.status !== "verified");

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Member email verification (admin)</CardTitle>
          <CardDescription>
            Every community signup is queued here (mimics verification flow). Generate the Firebase link, copy it
            for the member, or approve manually for testing.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {actionMsg && <p className="text-sm text-muted-foreground mb-3">{actionMsg}</p>}
        {loadError ? (
          <p className="text-sm text-destructive">
            Could not load queue: {loadError}. Your Firebase UID must exist in{" "}
            <code className="text-xs">adminCollection</code>.
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : activeRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending verifications. Register a new member account, then refresh — the row appears even before email
            sends.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {activeRows.map((r) => {
              const uid = r.userId || r.id;
              const busy = busyId === uid;
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-foreground/15 dark:bg-muted/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">
                        {r.userName ? `@${r.userName}` : "Member"} · {r.userEmail || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {statusLabel(r.status)} · {r.source || "—"} ·{" "}
                        {r.updatedAt?.toDate ? r.updatedAt.toDate().toLocaleString() : "—"}
                      </p>
                      {r.linkError && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{r.linkError}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={busy}
                        onClick={() => handleGenerate(uid)}
                      >
                        {busy ? "…" : "Generate link"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={busy}
                        onClick={() => handleApprove(uid)}
                      >
                        Approve (QA)
                      </Button>
                    </div>
                  </div>
                  {r.verifyLink && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => navigator.clipboard.writeText(r.verifyLink!)}
                      >
                        Copy link
                      </Button>
                      <a
                        href={r.verifyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline self-center"
                      >
                        Open verify link
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {rows.length > activeRows.length && (
          <p className="text-xs text-muted-foreground mt-3">
            {rows.length - activeRows.length} completed verification(s) hidden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

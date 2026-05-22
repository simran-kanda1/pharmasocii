import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { auth, db } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  adminArchivePost,
  adminRestorePost,
  adminSetMemberStatus,
} from "@/lib/adminCommunityCallables";
import { Link } from "react-router-dom";

type PostRow = {
  id: string;
  title?: string;
  authorUserName?: string;
  authorId?: string;
  archived?: boolean;
  spamReportCount?: number;
  createdAt?: { toDate: () => Date };
};

type MemberRow = {
  id: string;
  userName?: string;
  email?: string;
  accountStatus?: string;
  spamActiveReportCount?: number;
  spamTotalReportCount?: number;
  spamBlockUntil?: { toDate: () => Date };
};

type SpamRow = {
  id: string;
  targetType?: string;
  targetKey?: string;
  reason?: string;
  reporterId?: string;
  createdAt?: { toDate: () => Date };
};

export function AdminCommunityPanel() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [spam, setSpam] = useState<SpamRow[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pSnap, mSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, "postsCollection"), orderBy("createdAt", "desc"), limit(50))),
        getDocs(query(collection(db, "membersCollection"), limit(100))),
        getDocs(query(collection(db, "spamReportsCollection"), orderBy("createdAt", "desc"), limit(40))),
      ]);
      setPosts(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PostRow)));
      setMembers(mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MemberRow)));
      setSpam(sSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SpamRow)));
    } catch (e) {
      console.error(e);
      setMsg("Could not load community data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (m.userName || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  });

  const logAdminAction = async (details: string) => {
    const adminUser = auth.currentUser;
    if (!adminUser) return;
    await logActivity({
      partnerId: adminUser.uid,
      partnerName: adminUser.email || "Admin",
      action: "ADMIN_ACTION",
      details,
      category: "admin",
      metadata: { scope: "community" },
    });
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      await logAdminAction(label);
      setMsg("Done.");
      await load();
    } catch (e) {
      console.error(e);
      setMsg("Action failed. Deploy functions and sign in as admin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <section>
        <h3 className="text-lg font-semibold mb-3">Posts</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2">Title</th>
                  <th className="p-2">Author</th>
                  <th className="p-2">Spam</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2 max-w-[200px] truncate">
                      <Link to={`/community/post/${p.id}`} className="text-primary underline" target="_blank">
                        {p.title || p.id}
                      </Link>
                    </td>
                    <td className="p-2">{p.authorUserName}</td>
                    <td className="p-2">{p.spamReportCount ?? 0}</td>
                    <td className="p-2">
                      {p.archived ? <Badge variant="secondary">Archived</Badge> : <Badge>Live</Badge>}
                    </td>
                    <td className="p-2 flex flex-wrap gap-1">
                      {!p.archived && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => run(`Archived post ${p.id}`, () => adminArchivePost(p.id, "admin"))}
                        >
                          Archive
                        </Button>
                      )}
                      {p.archived && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => run(`Restored post ${p.id}`, () => adminRestorePost(p.id))}
                        >
                          Restore
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">Members</h3>
        <Input
          placeholder="Search username or email…"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          className="max-w-sm mb-3"
        />
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2">User</th>
                <th className="p-2">Status</th>
                <th className="p-2">Active / Total spam</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="p-2">
                    <div>{m.userName}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </td>
                  <td className="p-2">{m.accountStatus || "active"}</td>
                  <td className="p-2">
                    {m.spamActiveReportCount ?? 0} / {m.spamTotalReportCount ?? 0}
                  </td>
                  <td className="p-2 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(`Hold member ${m.userName || m.id}`, () =>
                          adminSetMemberStatus({ userId: m.id, status: "admin_hold", reason: "Admin hold" }),
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
                        run(`Blocked member ${m.userName || m.id} (30d)`, () =>
                          adminSetMemberStatus({ userId: m.id, status: "spam_blocked" }),
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
                        run(`Reactivated member ${m.userName || m.id}`, () =>
                          adminSetMemberStatus({
                            userId: m.id,
                            status: "active",
                            clearSpamCounters: true,
                          }),
                        )
                      }
                    >
                      Reactivate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">Spam reports</h3>
        <ul className="space-y-2 max-h-64 overflow-y-auto text-sm">
          {spam.map((s) => (
            <li key={s.id} className="border rounded p-2">
              <span className="font-medium">{s.targetType}</span> · {s.targetKey}
              <p className="text-muted-foreground text-xs">{s.reason}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

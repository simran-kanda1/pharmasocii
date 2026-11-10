import { useEffect, useState } from "react";
import { collection, doc, getDocs, limit, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApproveMemberVerification, adminListPendingVerifications } from "@/lib/adminCommunityCallables";

type EmailRow = {
  id: string;
  type?: string;
  toEmail?: string;
  subject?: string;
  bodyText?: string;
  link?: string;
  ccTo?: string;
  userId?: string;
  createdAt?: { toDate: () => Date };
};

type ActivationLinkRow = {
  id: string;
  userId?: string;
  userEmail?: string;
  verifyLink?: string;
  source?: string;
  ccTo?: string;
  createdAt?: { toDate: () => Date };
};

export function AdminEmailLogPanel() {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [activationLinks, setActivationLinks] = useState<ActivationLinkRow[]>([]);
  const [unverifiedUserByEmail, setUnverifiedUserByEmail] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Sync Firestore pendingVerifications against Firebase Auth first if callable is deployed
        await adminListPendingVerifications().catch(() => null);

        const [eSnap, mSnap, membersSnap, pendingSnap] = await Promise.all([
          getDocs(query(collection(db, "emailLogCollection"), orderBy("createdAt", "desc"), limit(50))),
          getDocs(query(collection(db, "verificationMirrors"), orderBy("createdAt", "desc"), limit(50))),
          getDocs(collection(db, "membersCollection")),
          getDocs(collection(db, "pendingVerifications")),
        ]);
        if (cancelled) return;

        const activatedEmails = new Set<string>();
        const activatedUserIds = new Set<string>();
        const emailToUserId: Record<string, string> = {};

        membersSnap.docs.forEach((mDoc) => {
          const d = mDoc.data() || {};
          const em = String(d.email || "").trim().toLowerCase();
          if (em) {
            emailToUserId[em] = mDoc.id;
          }
          if (d.emailVerified === true) {
            activatedUserIds.add(mDoc.id);
            if (d.userId) activatedUserIds.add(String(d.userId));
            if (em) activatedEmails.add(em);
          }
        });

        pendingSnap.docs.forEach((pDoc) => {
          const d = pDoc.data() || {};
          const uid = String(d.userId || pDoc.id || "").trim();
          const em = String(d.userEmail || "").trim().toLowerCase();
          if (em && uid && !emailToUserId[em]) {
            emailToUserId[em] = uid;
          }
          if (d.status === "admin_approved" || d.status === "verified") {
            if (uid) activatedUserIds.add(uid);
            if (em) activatedEmails.add(em);
          }
        });

        setUnverifiedUserByEmail(emailToUserId);

        // Only show emails for accounts that are NOT activated
        const filteredEmails = eSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as EmailRow))
          .filter((row) => {
            const em = String(row.toEmail || "").trim().toLowerCase();
            const uid = String(row.userId || (em ? emailToUserId[em] : "") || "").trim();
            if (em && activatedEmails.has(em)) return false;
            if (uid && activatedUserIds.has(uid)) return false;
            return true;
          });

        const filteredLinks = mSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as ActivationLinkRow))
          .filter((row) => {
            const em = String(row.userEmail || "").trim().toLowerCase();
            const uid = String(row.userId || (em ? emailToUserId[em] : "") || "").trim();
            if (em && activatedEmails.has(em)) return false;
            if (uid && activatedUserIds.has(uid)) return false;
            return true;
          });

        setEmails(filteredEmails);
        setActivationLinks(filteredLinks);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleActivateAccount = async (rawEmail?: string, rawUserId?: string) => {
    const normEmail = String(rawEmail || "").trim().toLowerCase();
    const uid = String(rawUserId || (normEmail ? unverifiedUserByEmail[normEmail] : "") || "").trim();
    if (!uid && !normEmail) return;
    if (!window.confirm(`Activate account for ${rawEmail || uid}? Once activated, its emails will be removed from this list.`)) {
      return;
    }
    setBusyEmail(normEmail || uid);
    try {
      if (uid) {
        await adminApproveMemberVerification(uid).catch((err) => {
          console.warn("Callable adminApproveMemberVerification warning:", err);
        });
        await updateDoc(doc(db, "membersCollection", uid), { emailVerified: true }).catch(() => {});
        await updateDoc(doc(db, "pendingVerifications", uid), { status: "admin_approved" }).catch(() => {});
      }
      setEmails((prev) =>
        prev.filter((r) => {
          const em = String(r.toEmail || "").trim().toLowerCase();
          const rUid = String(r.userId || (em ? unverifiedUserByEmail[em] : "") || "").trim();
          if (normEmail && em === normEmail) return false;
          if (uid && rUid === uid) return false;
          return true;
        }),
      );
      setActivationLinks((prev) =>
        prev.filter((r) => {
          const em = String(r.userEmail || "").trim().toLowerCase();
          const rUid = String(r.userId || (em ? unverifiedUserByEmail[em] : "") || "").trim();
          if (normEmail && em === normEmail) return false;
          if (uid && rUid === uid) return false;
          return true;
        }),
      );
    } finally {
      setBusyEmail(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Transactional email log (Unactivated Accounts)</CardTitle>
            <CardDescription>
              Showing only emails for accounts that are not yet activated. Once activated, they disappear automatically.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : emails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending emails for unactivated accounts.</p>
          ) : (
            <ul className="space-y-3 max-h-[420px] overflow-y-auto">
              {emails.map((row) => {
                const normEmail = String(row.toEmail || "").trim().toLowerCase();
                const uid = row.userId || (normEmail ? unverifiedUserByEmail[normEmail] : "");
                const isBusy = busyEmail === (normEmail || uid);
                return (
                  <li key={row.id} className="rounded-lg border border-foreground/10 p-3 text-sm space-y-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-medium">{row.type || "unknown"}</span>
                      <span className="text-muted-foreground">{row.toEmail}</span>
                      <div className="ml-auto flex items-center gap-2">
                        {row.createdAt?.toDate && (
                          <span className="text-xs text-muted-foreground">
                            {row.createdAt.toDate().toLocaleString()}
                          </span>
                        )}
                        {uid && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={isBusy}
                            onClick={() => handleActivateAccount(row.toEmail, uid)}
                          >
                            {isBusy ? "…" : "Activate"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs font-medium">{row.subject}</p>
                    {row.link && (
                      <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary break-all underline">
                        {row.link}
                      </a>
                    )}
                    {row.bodyText && !row.link && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{row.bodyText}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activation links (Unactivated Accounts)</CardTitle>
          <CardDescription>
            Account activation / email verification links for accounts not yet activated. A link drops off this list once the account is activated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activationLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending activation links for unactivated accounts.</p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto">
              {activationLinks.map((row) => {
                const normEmail = String(row.userEmail || "").trim().toLowerCase();
                const uid = row.userId || (normEmail ? unverifiedUserByEmail[normEmail] : "");
                const isBusy = busyEmail === (normEmail || uid);
                return (
                  <li key={row.id} className="rounded-lg border border-foreground/10 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{row.userEmail}</p>
                        <p className="text-xs text-muted-foreground">{row.source}</p>
                        {row.verifyLink && (
                          <a
                            href={row.verifyLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary break-all underline mt-1 inline-block"
                          >
                            Open verification link
                          </a>
                        )}
                      </div>
                      {uid && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          disabled={isBusy}
                          onClick={() => handleActivateAccount(row.userEmail, uid)}
                        >
                          {isBusy ? "…" : "Activate"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

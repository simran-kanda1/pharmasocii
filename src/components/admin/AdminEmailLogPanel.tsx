import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type EmailRow = {
  id: string;
  type?: string;
  toEmail?: string;
  subject?: string;
  bodyText?: string;
  link?: string;
  ccTo?: string;
  createdAt?: { toDate: () => Date };
};

type MirrorRow = {
  id: string;
  userEmail?: string;
  verifyLink?: string;
  source?: string;
  ccTo?: string;
  createdAt?: { toDate: () => Date };
};

export function AdminEmailLogPanel() {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [mirrors, setMirrors] = useState<MirrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [eSnap, mSnap] = await Promise.all([
          getDocs(query(collection(db, "emailLogCollection"), orderBy("createdAt", "desc"), limit(30))),
          getDocs(query(collection(db, "verificationMirrors"), orderBy("createdAt", "desc"), limit(15))),
        ]);
        if (cancelled) return;
        setEmails(eSnap.docs.map((d) => ({ id: d.id, ...d.data() } as EmailRow)));
        setMirrors(mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MirrorRow)));
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Community email log</CardTitle>
            <CardDescription>
              Transactional emails (spam notices, reactivation, admin actions, password reset mirrors). CC
              default: simrankaurkanda42@gmail.com when SMTP + COMMUNITY_EMAIL_CC_ALL=true.
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
            <p className="text-sm text-muted-foreground">No logged emails yet.</p>
          ) : (
            <ul className="space-y-3 max-h-[420px] overflow-y-auto">
              {emails.map((row) => (
                <li key={row.id} className="rounded-lg border border-foreground/10 p-3 text-sm space-y-1">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-medium">{row.type || "unknown"}</span>
                    <span className="text-muted-foreground">{row.toEmail}</span>
                    {row.createdAt?.toDate && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {row.createdAt.toDate().toLocaleString()}
                      </span>
                    )}
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
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification mirrors</CardTitle>
          <CardDescription>Account activation links (member sign-up / resend).</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : mirrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mirrored links yet.</p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto">
              {mirrors.map((row) => (
                <li key={row.id} className="rounded-lg border border-foreground/10 p-3 text-sm">
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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

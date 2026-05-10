import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MirrorRow = {
  id: string;
  userEmail?: string;
  verifyLink?: string;
  source?: string;
  ccTo?: string;
  createdAt?: { toDate: () => Date };
};

export function VerificationMirrorsPanel() {
  const [rows, setRows] = useState<MirrorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = query(collection(db, "verificationMirrors"), orderBy("createdAt", "desc"), limit(15));
        const snap = await getDocs(q);
        if (cancelled) return;
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MirrorRow)));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email verification mirrors (testing)</CardTitle>
        <CardDescription>
          Community sign-up / resend only: same verification links as Firebase Auth for members are mirrored here
          (and optionally emailed when SMTP env vars are set). CC default:{" "}
          <code className="text-xs">simrankaurkanda42@gmail.com</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mirrored links yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-foreground/15 dark:bg-muted/20">
                <p className="font-medium text-foreground">{r.userEmail || "—"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.source} · {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : "—"}
                </p>
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
                      Open
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

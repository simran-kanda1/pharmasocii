import { useMemo } from "react";
import { formatAdminDate } from "@/lib/formatAdminDate";
import type { AdminSpamReportRow } from "@/lib/adminCommunityData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { commentFrontEndUrl } from "@/lib/adminCommunityDisplay";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

type Props = {
  reports: AdminSpamReportRow[];
  loading?: boolean;
  showCommentLink?: boolean;
};

export function AdminSpamReportsBlock({ reports, loading, showCommentLink }: Props) {
  const summary = useMemo(() => {
    const post = reports.filter((r) => r.targetType === "post").length;
    const comment = reports.filter((r) => r.targetType === "comment").length;
    return { post, comment, total: reports.length };
  }, [reports]);

  return (
    <div className="border-t px-4 py-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Reports Summary</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Total Reports</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Post Reports</TableCell>
              <TableCell>{loading ? "…" : summary.post}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Comment Reports</TableCell>
              <TableCell>{loading ? "…" : summary.comment}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="font-medium">{loading ? "…" : summary.total}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">All Reports</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading reports…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username / Real Name</TableHead>
                <TableHead>Reasons</TableHead>
                <TableHead>Date</TableHead>
                {showCommentLink && <TableHead className="text-right">View</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.reporterLabel}</TableCell>
                  <TableCell className="max-w-md">{r.reason}</TableCell>
                  <TableCell>{formatAdminDate(r.createdAt?.toDate?.())}</TableCell>
                  {showCommentLink && r.postId && (
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a
                          href={commentFrontEndUrl(r.postId, r.commentId)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Open
                        </a>
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/** Inline reports row for post attribute table */
export function AdminPostReportsCell({
  reports,
  loading,
}: {
  reports: AdminSpamReportRow[];
  loading?: boolean;
}) {
  if (loading) return <span className="text-muted-foreground">Loading…</span>;
  if (reports.length === 0) return <span className="text-muted-foreground">No reports found.</span>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Username / Real Name</TableHead>
          <TableHead>Reasons</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.reporterLabel}</TableCell>
            <TableCell>{r.reason}</TableCell>
            <TableCell>{formatAdminDate(r.createdAt?.toDate?.())}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

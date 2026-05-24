import { useState } from "react";
import { Link } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildLinkedInShareUrl, copyPostLink } from "@/lib/communityShare";
import {
  Bookmark,
  CheckSquare,
  Copy,
  Linkedin,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PostActionBarProps = {
  postId: string;
  postTitle: string;
  targetAuthorId?: string;
  commentCount?: number;
  helpfulCount?: number;
  canEngage: boolean;
  engageHint?: string;
  saved?: boolean;
  helpful?: boolean;
  onToggleSave?: () => void;
  onToggleHelpful?: () => void;
  className?: string;
};

export function PostActionBar({
  postId,
  postTitle,
  targetAuthorId,
  commentCount = 0,
  helpfulCount = 0,
  canEngage,
  engageHint,
  saved,
  helpful,
  onToggleSave,
  onToggleHelpful,
  className,
}: PostActionBarProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  const submitReport = async () => {
    setReportError("");
    const user = auth.currentUser;
    const reason = reportReason.trim();
    if (!user || !canEngage) return;
    if (!reason || reason.length > 500) {
      setReportError("Add a short reason (max 500 characters).");
      return;
    }
    const reportId = `${user.uid}_post_${postId}`;
    try {
      await setDoc(doc(db, "spamReportsCollection", reportId), {
        reporterId: user.uid,
        targetType: "post",
        targetKey: postId,
        targetAuthorId: targetAuthorId || "",
        postId,
        commentId: null,
        reason,
        status: "open",
        createdAt: serverTimestamp(),
      });
      setReportOpen(false);
      setReportReason("");
    } catch {
      setReportError("Report failed. You may have already reported this post.");
    }
  };

  const linkedInShare = () => {
    const url = buildLinkedInShareUrl(postId, postTitle);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    const ok = await copyPostLink(postId);
    setCopyMsg(ok ? "Link copied" : "Could not copy");
    window.setTimeout(() => setCopyMsg(""), 2000);
  };

  const disabledTitle = engageHint || "Sign in with a verified member profile to use this.";

  return (
    <>
      <div className={cn("flex flex-wrap items-stretch border-t border-slate-200 bg-slate-50/80 dark:border-foreground/10 dark:bg-muted/20", className)}>
        <Link
          to={`/community/post/${postId}#comments`}
          className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium text-muted-foreground hover:bg-white hover:text-foreground transition-colors border-r border-slate-200 dark:border-foreground/10 dark:hover:bg-card"
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="truncate">Comment ({commentCount})</span>
        </Link>
        <ActionBtn
          label={`Helpful (${helpfulCount})`}
          icon={CheckSquare}
          active={helpful}
          disabled={!canEngage}
          title={!canEngage ? disabledTitle : helpful ? "Remove helpful" : "Mark as helpful"}
          onClick={onToggleHelpful}
          className="flex-1 min-w-[100px]"
        />
        <ActionBtn
          label="Save"
          icon={Bookmark}
          active={saved}
          disabled={!canEngage}
          title={!canEngage ? disabledTitle : saved ? "Unsave" : "Save"}
          onClick={onToggleSave}
          className="flex-1 min-w-[90px]"
        />
        <ActionBtn
          label="Spam"
          icon={ShieldAlert}
          disabled={!canEngage}
          title={!canEngage ? disabledTitle : "Report spam"}
          onClick={() => setReportOpen(true)}
          className="flex-1 min-w-[80px]"
        />
        <ActionBtn
          label="LinkedIn"
          icon={Linkedin}
          onClick={linkedInShare}
          className="flex-1 min-w-[90px]"
        />
        <ActionBtn
          label={copyMsg || "Copy link"}
          icon={Copy}
          onClick={copyLink}
          className="flex-1 min-w-[100px]"
        />
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report post</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Textarea
              id="report-reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={4}
              maxLength={500}
            />
            {reportError && <p className="text-sm text-destructive">{reportError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitReport}>
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
  active,
  title,
  className,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium text-muted-foreground hover:bg-white hover:text-foreground transition-colors border-r border-slate-200 last:border-r-0 dark:border-foreground/10 dark:hover:bg-card disabled:opacity-50 disabled:pointer-events-none",
        active && "text-primary bg-white dark:bg-card",
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
      <span className="truncate">{label}</span>
    </button>
  );
}
import { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "@/firebase";
import { CommunityReportDialog } from "@/components/community/CommunityReportDialog";
import { buildLinkedInShareUrl, copyPostLink } from "@/lib/communityShare";
import { submitCommunitySpamReport } from "@/lib/submitCommunityReport";
import {
  Bookmark,
  CheckSquare,
  Copy,
  Linkedin,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveCommunityFeedScroll, communityPostDetailPath } from "@/lib/communityScrollRestore";

type PostActionBarProps = {
  postId: string;
  postTitle: string;
  targetAuthorId?: string;
  commentCount?: number;
  helpfulCount?: number;
  canEngage: boolean;
  canShare?: boolean;
  canReport?: boolean;
  canSave?: boolean;
  engageHint?: string;
  saved?: boolean;
  helpful?: boolean;
  onToggleSave?: () => void;
  onToggleHelpful?: () => void;
  className?: string;
  rememberFeedScroll?: boolean;
};

export function PostActionBar({
  postId,
  postTitle,
  targetAuthorId,
  commentCount = 0,
  helpfulCount = 0,
  canEngage,
  canShare = canEngage,
  canReport = canEngage,
  canSave = canEngage,
  engageHint,
  saved,
  helpful,
  onToggleSave,
  onToggleHelpful,
  className,
  rememberFeedScroll,
}: PostActionBarProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [hintMsg, setHintMsg] = useState("");

  const showHint = (msg: string) => {
    setHintMsg(msg);
    window.setTimeout(() => setHintMsg(""), 3000);
  };

  const requireEngage = (action?: () => void) => {
    if (!canEngage) {
      showHint(engageHint || "Sign in with a verified member profile to use this.");
      return;
    }
    action?.();
  };

  const requireSave = (action?: () => void) => {
    if (!canSave) {
      showHint(engageHint || "Sign in with a verified member profile to save posts.");
      return;
    }
    action?.();
  };

  const requireShare = (action?: () => void) => {
    if (!canShare) {
      showHint(engageHint || "Sign in with a verified member profile to share.");
      return;
    }
    action?.();
  };

  const requireReport = (action?: () => void) => {
    if (!canReport) {
      showHint(engageHint || "Sign in with a verified member profile to report content.");
      return;
    }
    action?.();
  };

  const submitReport = async (reason: string) => {
    const user = auth.currentUser;
    if (!user || !canReport) throw new Error("Not allowed");
    if (targetAuthorId === user.uid) {
      throw new Error("You cannot report your own content.");
    }
    await submitCommunitySpamReport({
      reporterId: user.uid,
      targetType: "post",
      targetKey: postId,
      targetAuthorId: targetAuthorId || "",
      postId,
      commentId: null,
      reason,
    });
  };

  const linkedInShare = () => {
    requireShare(() => {
      const url = buildLinkedInShareUrl(postId, postTitle);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  const copyLink = () => {
    requireShare(async () => {
      const ok = await copyPostLink(postId);
      setCopyMsg(ok ? "Link copied" : "Could not copy");
      window.setTimeout(() => setCopyMsg(""), 2000);
    });
  };

  const currentUserId = auth.currentUser?.uid;
  const isOwnContent = Boolean(currentUserId && targetAuthorId && currentUserId === targetAuthorId);
  const disabledTitle = engageHint || "Sign in with a verified member profile to use this.";
  const shareDisabledTitle = !canShare
    ? engageHint || "Sign in with a verified member profile to share."
    : undefined;
  const ownContentTitle = "You cannot use this on your own post.";

  const hoverWarningTitle = shareDisabledTitle || "May not work if this content is later archived due to spam activity";

  return (
    <>
      <div
        className={cn(
          "relative z-20 flex flex-wrap items-stretch border-t border-slate-200 bg-slate-50/80 dark:border-foreground/10 dark:bg-muted/20",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Link
          to={communityPostDetailPath(postId, rememberFeedScroll, "comments")}
          className="flex shrink-0 items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium text-muted-foreground hover:bg-white hover:text-foreground transition-colors border-r border-slate-200 dark:border-foreground/10 dark:hover:bg-card min-w-[6.5rem]"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            if (rememberFeedScroll) saveCommunityFeedScroll(postId);
          }}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap tabular-nums">
            Comment ({Math.max(0, commentCount)})
          </span>
        </Link>
        <ActionBtn
          label={`Helpful (${Math.max(0, helpfulCount)})`}
          icon={CheckSquare}
          active={helpful}
          disabled={isOwnContent}
          title={isOwnContent ? ownContentTitle : !canEngage ? disabledTitle : helpful ? "Remove helpful" : "Mark as helpful"}
          onClick={() => requireEngage(onToggleHelpful)}
          className="flex-1 min-w-[100px]"
        />
        <ActionBtn
          label="Save"
          icon={Bookmark}
          active={saved}
          title={!canSave ? disabledTitle : saved ? "Unsave" : "Save"}
          onClick={() => requireSave(onToggleSave)}
          className="flex-1 min-w-[90px]"
        />
        <ActionBtn
          label="Spam"
          icon={ShieldAlert}
          disabled={isOwnContent}
          title={isOwnContent ? ownContentTitle : !canReport ? disabledTitle : "Report content"}
          onClick={() => requireReport(() => setReportOpen(true))}
          className="flex-1 min-w-[80px]"
        />
        <ActionBtn
          label="LinkedIn"
          icon={Linkedin}
          title={hoverWarningTitle}
          onClick={linkedInShare}
          className="flex-1 min-w-[90px]"
        />
        <ActionBtn
          label={copyMsg || "Copy link"}
          icon={Copy}
          title={hoverWarningTitle}
          onClick={copyLink}
          className="flex-1 min-w-[100px]"
        />
      </div>
      {hintMsg && (
        <p className="relative z-20 text-xs text-center text-muted-foreground bg-muted/50 py-1.5 px-2 border-t border-slate-100 dark:border-foreground/10">
          {hintMsg}
        </p>
      )}

      <CommunityReportDialog open={reportOpen} onOpenChange={setReportOpen} onSubmit={submitReport} />
    </>
  );
}

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  active,
  disabled,
  title,
  className,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium text-muted-foreground hover:bg-white hover:text-foreground transition-colors border-r border-slate-200 last:border-r-0 dark:border-foreground/10 dark:hover:bg-card",
        active && "text-primary bg-white dark:bg-card",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground",
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      title={title}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCommunityCategories } from "@/hooks/useCommunityCategories";
import { formatCategoryPlain, formatRelativeTime, COMMENT_MAX, REPLY_MAX } from "@/lib/community";
import { ArrowLeft, Bookmark, Flag, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CommentRow = {
  id: string;
  authorId: string;
  userName: string;
  text: string;
  parentCommentId?: string | null;
  createdAt?: { toDate: () => Date };
  archived?: boolean;
};

export default function CommunityPostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const { categoryDoc } = useCommunityCategories();
  const [post, setPost] = useState<Record<string, unknown> | null>(null);
  const [postMissing, setPostMissing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [user, setUser] = useState<import("firebase/auth").User | null>(null);
  const [verified, setVerified] = useState(false);
  const [memberBlocked, setMemberBlocked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportTarget, setReportTarget] = useState<"post" | "comment">("post");
  const [reportComment, setReportComment] = useState<CommentRow | null>(null);
  const [error, setError] = useState("");
  const [hasMemberProfile, setHasMemberProfile] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await u.reload();
        setVerified(u.emailVerified);
        const m = await getDoc(doc(db, "membersCollection", u.uid));
        setHasMemberProfile(m.exists());
        const st = m.data()?.accountStatus;
        setMemberBlocked(st === "spam_blocked");
        if (postId && m.exists()) {
          const sref = doc(db, "membersCollection", u.uid, "savedPostsCollection", postId);
          const ss = await getDoc(sref);
          setSaved(ss.exists());
        } else {
          setSaved(false);
        }
      } else {
        setVerified(false);
        setMemberBlocked(false);
        setSaved(false);
        setHasMemberProfile(false);
      }
    });
    return () => unsub();
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const pref = doc(db, "postsCollection", postId);
    const unsub = onSnapshot(
      pref,
      (snap) => {
        if (!snap.exists()) {
          setPostMissing(true);
          setPost(null);
          return;
        }
        setPostMissing(false);
        setPost({ id: snap.id, ...snap.data() });
      },
      () => {
        setPostMissing(true);
        setPost(null);
      },
    );
    return () => unsub();
  }, [postId]);

  useEffect(() => {
    if (!postId || !post) return;
    const path = post.imageStoragePath as string | undefined;
    if (!path) {
      setImageUrl(null);
      return;
    }
    getDownloadURL(ref(storage, path))
      .then(setImageUrl)
      .catch(() => setImageUrl(null));
  }, [post, postId]);

  useEffect(() => {
    if (!postId) return;
    const q = query(
      collection(db, "postsCollection", postId, "commentsCollection"),
      where("archived", "==", false),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommentRow, "id">) })),
        );
      },
      (e) => console.error(e),
    );
    return () => unsub();
  }, [postId]);

  const canEngage = Boolean(user && verified && !memberBlocked && hasMemberProfile);
  const postAuthorId = post?.authorId as string | undefined;
  const archived = post?.archived === true;

  const engageHint = (() => {
    if (archived) return "This post is archived.";
    if (memberBlocked) return "Your account is temporarily restricted.";
    if (!user) return "Log in with a verified member account to use this.";
    if (!verified) return "Verify your email to use this.";
    if (!hasMemberProfile) return "Create your community profile to use this.";
    return "";
  })();

  const sharePost = async () => {
    if (!postId || archived || !canEngage) return;
    const url = `${window.location.origin}/community/post/${postId}`;
    const title = String(post?.title ?? "Community post");
    setShareFeedback("");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareFeedback("Link copied to clipboard");
        window.setTimeout(() => setShareFeedback(""), 2500);
        return;
      }
      setShareFeedback(url);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "AbortError") return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          setShareFeedback("Link copied to clipboard");
          window.setTimeout(() => setShareFeedback(""), 2500);
        } else {
          setError("Could not share. Copy the address from your browser bar.");
        }
      } catch {
        setError("Could not share. Copy the address from your browser bar.");
      }
    }
  };

  const toggleSave = async () => {
    if (!canEngage || !postId || !user) return;
    const sref = doc(db, "membersCollection", user.uid, "savedPostsCollection", postId);
    try {
      if (saved) await deleteDoc(sref);
      else await setDoc(sref, { savedAt: serverTimestamp() });
      setSaved(!saved);
    } catch (e) {
      console.error(e);
      setError("Could not update saved posts.");
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!canEngage || !postId || !user) {
      setError("Log in with a verified account to comment.");
      return;
    }
    const max = replyTo ? REPLY_MAX : COMMENT_MAX;
    const t = commentText.trim();
    if (!t || t.length > max) {
      setError(`Comment must be 1–${max} characters.`);
      return;
    }
    const member = await getDoc(doc(db, "membersCollection", user.uid));
    const userName = (member.data()?.userName as string) || user.email?.split("@")[0] || "member";

    try {
      await addDoc(collection(db, "postsCollection", postId, "commentsCollection"), {
        authorId: user.uid,
        userName,
        postId,
        text: t,
        parentCommentId: replyTo?.id ?? null,
        createdAt: serverTimestamp(),
        archived: false,
        spamReportCount: 0,
      });
      setCommentText("");
      setReplyTo(null);
    } catch (err) {
      console.error(err);
      setError("Could not post comment.");
    }
  };

  const openReport = (type: "post" | "comment", c?: CommentRow) => {
    setReportTarget(type);
    setReportComment(c ?? null);
    setReportReason("");
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!canEngage || !user || !postId || !postAuthorId) return;
    const reason = reportReason.trim();
    if (!reason || reason.length > 500) {
      setError("Add a short reason (max 500 characters).");
      return;
    }

    let targetAuthorId = postAuthorId;
    let targetKey = postId;
    if (reportTarget === "comment" && reportComment) {
      targetAuthorId = reportComment.authorId;
      targetKey = `${postId}__${reportComment.id}`;
    }
    if (targetAuthorId === user.uid) {
      setError("You cannot report your own content.");
      return;
    }

    const reportId = `${user.uid}_${reportTarget}_${targetKey}`;
    try {
      await setDoc(doc(db, "spamReportsCollection", reportId), {
        reporterId: user.uid,
        targetType: reportTarget,
        targetKey,
        targetAuthorId,
        postId,
        commentId: reportComment?.id ?? null,
        reason,
        status: "open",
        createdAt: serverTimestamp(),
      });
      setReportOpen(false);
    } catch (err) {
      console.error(err);
      setError("Report failed. You may have already reported this item.");
    }
  };

  if (!postId) return null;
  if (postMissing) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <p className="text-muted-foreground">Post not found.</p>
        <Button asChild variant="link" className="mt-4 px-0">
          <Link to="/community">Back to feed</Link>
        </Button>
      </div>
    );
  }
  if (!post) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const segments = formatCategoryPlain(
    categoryDoc,
    (post.mainCategories as string[]) ?? [],
    (post.subCategories as string[]) ?? [],
    (post.subSubCategories as string[]) ?? [],
  ).segments;
  const created = (post.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date();

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Button variant="ghost" asChild className="mb-6 gap-2">
        <Link to="/community">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </Button>

      {archived && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          This post has been archived.
        </div>
      )}

      <article className="space-y-4 border border-foreground/10 rounded-2xl p-6 bg-foreground/[0.02]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {String(post.authorUserName || "U")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{String(post.authorUserName)}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(created)}</p>
            </div>
          </div>
          {!archived && (
            <div className="flex flex-wrap gap-2 shrink-0 justify-end">
              <span title={!canEngage ? engageHint : saved ? "Remove from saved" : "Save post"} className="inline-flex">
                <Button
                  type="button"
                  size="icon"
                  variant={saved ? "secondary" : "outline"}
                  disabled={!canEngage}
                  className={cn(!canEngage && "opacity-50")}
                  onClick={toggleSave}
                  aria-label={saved ? "Unsave" : "Save"}
                >
                  <Bookmark className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
                </Button>
              </span>
              <span title={!canEngage ? engageHint : "Share or copy link"} className="inline-flex">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={!canEngage}
                  className={cn(!canEngage && "opacity-50")}
                  onClick={sharePost}
                  aria-label="Share post"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </span>
              <span title={!canEngage ? engageHint : "Report spam"} className="inline-flex">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={!canEngage}
                  className={cn(!canEngage && "opacity-50")}
                  onClick={() => openReport("post")}
                  aria-label="Report post"
                >
                  <Flag className="w-4 h-4" />
                </Button>
              </span>
            </div>
          )}
        </div>
        {shareFeedback && <p className="text-xs text-muted-foreground">{shareFeedback}</p>}

        <div className="text-sm">
          {segments.map((seg, i) => (
            <span key={i}>
              <span className="font-bold">{seg.main}</span>
              {seg.bracket.length > 0 && <span> [{seg.bracket.join(", ")}]</span>}
              {i < segments.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
        {(post.countries as string[] | undefined)?.length ? (
          <p className="text-xs text-muted-foreground">
            {(post.countries as string[]).join(", ")}
          </p>
        ) : null}

        <h1 className="text-2xl font-bold">{String(post.title)}</h1>
        <p className="whitespace-pre-wrap text-foreground/90">{String(post.text)}</p>

        {imageUrl && (
          <img src={imageUrl} alt="" className="rounded-xl max-h-96 w-full object-cover border border-foreground/10" />
        )}

        {Array.isArray(post.externalLinks) && (post.externalLinks as string[]).length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Links</p>
            <ul className="text-sm text-primary space-y-1">
              {(post.externalLinks as string[]).map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="underline break-all">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold">Comments</h2>
        {memberBlocked && (
          <p className="text-sm text-muted-foreground">
            Your account is temporarily restricted to read-only access.
          </p>
        )}
        {!archived && (
          <form
            onSubmit={submitComment}
            className={cn(
              "space-y-2 border border-foreground/10 rounded-xl p-4",
              !canEngage && "opacity-60",
            )}
          >
            {replyTo && (
              <p className="text-xs text-muted-foreground">
                Replying to <span className="font-medium text-foreground">{replyTo.userName}</span>
                <Button
                  type="button"
                  variant="link"
                  className="text-xs h-auto p-0 ml-2"
                  disabled={!canEngage}
                  onClick={() => setReplyTo(null)}
                >
                  Cancel
                </Button>
              </p>
            )}
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={replyTo ? REPLY_MAX : COMMENT_MAX}
              rows={4}
              disabled={!canEngage}
              placeholder={
                !canEngage
                  ? "Log in to comment…"
                  : replyTo
                    ? `Reply (max ${REPLY_MAX} characters)`
                    : `Comment (max ${COMMENT_MAX} characters)`
              }
              className="bg-foreground/5 border-foreground/10 disabled:cursor-not-allowed"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canEngage}>
                Post
              </Button>
              {!canEngage && (
                <p className="text-xs text-muted-foreground">
                  {user && verified && !hasMemberProfile ? (
                    <>
                      <Link to="/member/setup" className="text-primary underline">
                        Create your community profile
                      </Link>{" "}
                      to comment.
                    </>
                  ) : (
                    <>
                      <Link to="/member/login" className="text-primary underline">
                        Log in
                      </Link>{" "}
                      with a verified member account to comment.
                    </>
                  )}
                </p>
              )}
            </div>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`border border-foreground/10 rounded-xl p-4 bg-background/50 ${c.parentCommentId ? "ml-8" : ""}`}
            >
              <div className="flex justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{c.userName}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.createdAt?.toDate ? formatRelativeTime(c.createdAt.toDate()) : ""}
                  </p>
                </div>
                {!archived && (
                  <div className="flex gap-1">
                    <span title={!canEngage ? engageHint : "Reply"} className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn("h-8 text-xs", !canEngage && "opacity-50")}
                        disabled={!canEngage}
                        onClick={() => setReplyTo(c)}
                      >
                        Reply
                      </Button>
                    </span>
                    <span title={!canEngage ? engageHint : "Report"} className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn("h-8 text-xs", !canEngage && "opacity-50")}
                        disabled={!canEngage}
                        onClick={() => openReport("comment", c)}
                      >
                        Report
                      </Button>
                    </span>
                  </div>
                )}
              </div>
              <p className="text-sm mt-2 whitespace-pre-wrap">{c.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report spam</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Why is this spam?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReport} disabled={!canEngage}>
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

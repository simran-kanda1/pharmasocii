import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { auth, db, storage } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CommunityReportDialog } from "@/components/community/CommunityReportDialog";
import { CommunityIconAction, communityActionIcons } from "@/components/community/CommunityIconAction";
import { submitCommunitySpamReport } from "@/lib/submitCommunityReport";
import { toggleSavedComment, toggleSavedPost } from "@/lib/communityEngagement";
import {
  buildLinkedInShareUrl,
  buildLinkedInCommentShareUrl,
  copyCommentLink,
  copyPostLink,
} from "@/lib/communityShare";
import {
  canAccessCommunity,
  canEngageCommunity,
  canReportCommunitySpam,
  canSaveCommunityContent,
  canShareCommunityContent,
  communityAccessHint,
} from "@/lib/communityAccess";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCommunityCategories } from "@/hooks/useCommunityCategories";
import { formatCategoryPlain, formatRelativeTime, COMMENT_MAX, REPLY_MAX, normalizeExternalLink } from "@/lib/community";
import { ArrowLeft, Link2, MessageSquare, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { goBackToCommunityFeed } from "@/lib/communityScrollRestore";
import { syncPostCommentCount, recordCommentNotification } from "@/lib/communityCallables";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import type { PostCardPost } from "@/components/community/PostCard";

const MAX_COMMENT_IMAGE_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type CommentRow = {
  id: string;
  authorId: string;
  userName: string;
  text: string;
  parentCommentId?: string | null;
  imageStoragePath?: string | null;
  externalLink?: string | null;
  createdAt?: { toDate: () => Date };
  archived?: boolean;
};

export default function CommunityPostDetail() {
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const [searchParams] = useSearchParams();
  const highlightCommentId = searchParams.get("highlight");
  const returnTo = searchParams.get("return");
  const { categoryDoc } = useCommunityCategories();
  const commentRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const syncCommentCountBusy = useRef(false);
  const [post, setPost] = useState<Record<string, unknown> | null>(null);
  const [postMissing, setPostMissing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [user, setUser] = useState<import("firebase/auth").User | null>(null);
  const [verified, setVerified] = useState(false);
  const [memberRestricted, setMemberRestricted] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [commentLink, setCommentLink] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [savedCommentIds, setSavedCommentIds] = useState<Set<string>>(new Set());
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<"post" | "comment">("post");
  const [reportComment, setReportComment] = useState<CommentRow | null>(null);
  const [error, setError] = useState("");
  const [commentsLoadError, setCommentsLoadError] = useState("");
  const [hasMemberProfile, setHasMemberProfile] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [memberUserName, setMemberUserName] = useState<string | null>(null);
  const [memberBio, setMemberBio] = useState("");
  const [memberAboutMe, setMemberAboutMe] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await u.reload();
        setVerified(u.emailVerified);
        const m = await getDoc(doc(db, "membersCollection", u.uid));
        setHasMemberProfile(m.exists());
        setMemberUserName(m.exists() ? String(m.data()?.userName ?? "") : null);
        setMemberBio(m.exists() ? String(m.data()?.userBio ?? "") : "");
        setMemberAboutMe(m.exists() ? String(m.data()?.aboutMe ?? "") : "");
        const st = m.data()?.accountStatus;
        setMemberRestricted(st === "spam_blocked" || st === "admin_hold");
        if (postId && m.exists()) {
          const sref = doc(db, "membersCollection", u.uid, "savedPostsCollection", postId);
          const ss = await getDoc(sref);
          setSaved(ss.exists());
          const savedCommentsSnap = await getDocs(
            collection(db, "membersCollection", u.uid, "savedCommentsCollection"),
          );
          setSavedCommentIds(new Set(savedCommentsSnap.docs.map((d) => d.id)));
        } else {
          setSaved(false);
          setSavedCommentIds(new Set());
        }
      } else {
        setVerified(false);
        setMemberRestricted(false);
        setSaved(false);
        setSavedCommentIds(new Set());
        setHasMemberProfile(false);
        setMemberUserName(null);
        setMemberBio("");
        setMemberAboutMe("");
      }
      setAuthReady(true);
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
    getDownloadURL(storageRef(storage, path))
      .then(setImageUrl)
      .catch(() => setImageUrl(null));
  }, [post, postId]);

  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, "postsCollection", postId, "commentsCollection"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCommentsLoadError("");
        const rows = snap.docs
          .filter((d) => d.data().archived !== true)
          .map((d) => ({ id: d.id, ...(d.data() as Omit<CommentRow, "id">) }));
        rows.sort((a, b) => {
          const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
          const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
          return ta - tb;
        });
        setComments(rows);
      },
      (e) => {
        console.error(e);
        setComments([]);
        setCommentsLoadError("Could not load comments. Try refreshing the page.");
      },
    );
    return () => unsub();
  }, [postId]);

  useEffect(() => {
    syncCommentCountBusy.current = false;
  }, [postId]);

  useEffect(() => {
    if (!postId || !post || !canAccessCommunity(user, verified, hasMemberProfile)) return;
    const stored = Number(post.commentCount ?? 0);
    if (comments.length === stored || syncCommentCountBusy.current) return;
    syncCommentCountBusy.current = true;
    syncPostCommentCount(postId)
      .then(({ count }) => {
        setPost((prev) => (prev ? { ...prev, commentCount: count } : prev));
      })
      .catch(() => {})
      .finally(() => {
        syncCommentCountBusy.current = false;
      });
  }, [comments.length, post, postId, user, verified, hasMemberProfile]);

  useEffect(() => {
    if (!highlightCommentId || comments.length === 0) return;
    const el = commentRefs.current[highlightCommentId];
    if (el) {
      window.setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [highlightCommentId, comments]);

  const { topLevelComments, repliesByParentId } = useMemo(() => {
    const top: CommentRow[] = [];
    const byParent = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parentCommentId) top.push(c);
      else {
        const pid = c.parentCommentId;
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid)!.push(c);
      }
    }
    return { topLevelComments: top, repliesByParentId: byParent };
  }, [comments]);

  useEffect(() => {
    if (!highlightCommentId) return;
    const highlighted = comments.find((c) => c.id === highlightCommentId);
    if (highlighted?.parentCommentId) {
      setExpandedReplies((prev) => {
        const next = new Set(prev);
        next.add(highlighted.parentCommentId!);
        return next;
      });
    }
  }, [highlightCommentId, comments]);

  const canEngage = canEngageCommunity(user, verified, hasMemberProfile, memberRestricted);
  const canShare = canShareCommunityContent();
  const canReport = canReportCommunitySpam(user, verified, hasMemberProfile, memberRestricted);
  const canSave = canSaveCommunityContent(user, verified, hasMemberProfile, memberRestricted);
  const postAuthorId = post?.authorId as string | undefined;
  const archived = post?.archived === true;

  const engageHint = archived
    ? "This post is archived."
    : communityAccessHint(memberRestricted, user, verified, hasMemberProfile);
  const shareHint = "Share on LinkedIn";
  const reportHint = !canReport ? engageHint : "Report content";

  const shareLinkedIn = () => {
    if (!canShare || !postId) return;
    const url = buildLinkedInShareUrl(postId, String(post?.title ?? "Community post"));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyPostLinkAction = async () => {
    if (!canShare || !postId) return;
    const ok = await copyPostLink(postId);
    setCopyFeedback(ok ? "Link copied" : "Could not copy");
    window.setTimeout(() => setCopyFeedback(""), 2500);
  };

  const toggleSave = async () => {
    if (!canSave || !postId || !user) return;
    try {
      const nowSaved = await toggleSavedPost(user.uid, postId, saved);
      setSaved(nowSaved);
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
    if (replyTo?.parentCommentId) {
      setError("You cannot reply to a reply. Only one level of replies is allowed.");
      return;
    }

    let externalLink: string | null = null;
    if (commentLink.trim()) {
      externalLink = normalizeExternalLink(commentLink);
      if (!externalLink) {
        setError("Enter a valid http(s) link or leave the link field empty.");
        return;
      }
    }

    const member = await getDoc(doc(db, "membersCollection", user.uid));
    const userName = (member.data()?.userName as string) || user.email?.split("@")[0] || "member";

    try {
      let imageStoragePath: string | null = null;
      if (commentFile) {
        if (!ALLOWED_IMAGE_TYPES.includes(commentFile.type)) {
          setError("Image must be JPEG, PNG, or WebP.");
          return;
        }
        if (commentFile.size > MAX_COMMENT_IMAGE_BYTES) {
          setError("Image must be 1.5 MB or smaller.");
          return;
        }
        const path = `community/${user.uid}/comments/${crypto.randomUUID()}_${commentFile.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
        await uploadBytes(storageRef(storage, path), commentFile);
        imageStoragePath = path;
      }

      const commentRef = await addDoc(collection(db, "postsCollection", postId, "commentsCollection"), {
        authorId: user.uid,
        userName,
        postId,
        text: t,
        parentCommentId: replyTo?.id ?? null,
        imageStoragePath,
        externalLink,
        createdAt: serverTimestamp(),
        archived: false,
        spamReportCount: 0,
      });
      recordCommentNotification({
        postId,
        commentId: commentRef.id,
        text: t,
        fromUserName: userName,
      }).catch((notifyErr) => console.warn("Comment notification:", notifyErr));
      setCommentText("");
      setCommentFile(null);
      setCommentLink("");
      setReplyTo(null);
      if (replyTo?.id) {
        setExpandedReplies((prev) => new Set(prev).add(replyTo.id));
      }
    } catch (err) {
      console.error(err);
      setError("Could not post comment.");
    }
  };

  const openReport = (type: "post" | "comment", c?: CommentRow) => {
    setReportTarget(type);
    setReportComment(c ?? null);
    setReportOpen(true);
  };

  const submitReport = async (reason: string) => {
    if (!canReport || !user || !postId || !postAuthorId) throw new Error("Not allowed");

    let targetAuthorId = postAuthorId;
    let targetKey = postId;
    if (reportTarget === "comment" && reportComment) {
      targetAuthorId = reportComment.authorId;
      targetKey = `${postId}__${reportComment.id}`;
    }
    if (targetAuthorId === user.uid) {
      throw new Error("You cannot report your own content.");
    }

    await submitCommunitySpamReport({
      reporterId: user.uid,
      targetType: reportTarget,
      targetKey,
      targetAuthorId,
      postId,
      commentId: reportComment?.id ?? null,
      reason,
    });
  };

  const toggleSaveComment = async (commentId: string) => {
    if (!canSave || !user || !postId) return;
    try {
      const nowSaved = await toggleSavedComment(
        user.uid,
        commentId,
        postId,
        savedCommentIds.has(commentId),
      );
      setSavedCommentIds((prev) => {
        const next = new Set(prev);
        if (nowSaved) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
    } catch (e) {
      console.error(e);
      setError("Could not update saved comment.");
    }
  };

  if (!postId) return null;

  if (!authReady) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (postMissing) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <p className="text-muted-foreground">Post not found.</p>
        <Button type="button" variant="link" className="mt-4 px-0" onClick={() => goBackToCommunityFeed(navigate, returnTo)}>
          Back to feed
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

  const welcomeName = memberUserName || user?.displayName || user?.email?.split("@")[0] || "Guest";
  const profileInitials = (welcomeName || "G").slice(0, 2).toUpperCase();

  const isAuthor = postAuthorId && user?.uid && postAuthorId === user.uid;
  const hoursSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  const isEditable = isAuthor && hoursSinceCreation <= 6;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Button
        type="button"
        variant="ghost"
        className="mb-6 gap-2"
        onClick={() => goBackToCommunityFeed(navigate, returnTo)}
      >
        <ArrowLeft className="w-4 h-4" /> Back
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
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-semibold">{String(post.authorUserName)}</p>
                {typeof post.authorTagline === "string" && post.authorTagline && (
                  <span className="text-xs text-muted-foreground font-normal">({post.authorTagline})</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(created)}</p>
            </div>
          </div>
          {!archived && (
            <div className="flex flex-wrap gap-1 shrink-0 justify-end items-center">
              {isEditable && (
                <CommunityIconAction
                  label="Edit"
                  icon={Pencil}
                  title="Edit post (available for 6 hours after posting)"
                  onClick={() => setEditOpen(true)}
                />
              )}
              <CommunityIconAction
                label="Save"
                icon={communityActionIcons.save}
                active={saved}
                disabled={!canSave}
                title={!canSave ? engageHint : saved ? "Unsave" : "Save"}
                onClick={toggleSave}
              />
              <CommunityIconAction
                label="Spam"
                icon={communityActionIcons.report}
                disabled={!canReport || Boolean(isAuthor)}
                title={isAuthor ? "You cannot report your own content." : !canReport ? reportHint : "Report content"}
                onClick={() => openReport("post")}
              />
              <CommunityIconAction
                label="LinkedIn"
                icon={communityActionIcons.linkedIn}
                disabled={!canShare}
                title={shareHint}
                onClick={shareLinkedIn}
              />
              <CommunityIconAction
                label={copyFeedback || "Copy link"}
                icon={communityActionIcons.copyLink}
                disabled={!canShare}
                title={!canShare ? shareHint : "Copy link"}
                onClick={copyPostLinkAction}
              />
            </div>
          )}
        </div>
        {copyFeedback && <p className="text-xs text-muted-foreground">{copyFeedback}</p>}

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

      <section id="comments" className="mt-10 space-y-4 scroll-mt-24">
        <h2 className="text-lg font-semibold">
          Comments
          {(Number(post.commentCount ?? 0) > 0 || comments.length > 0)
            ? ` (${Number(post.commentCount ?? comments.length)})`
            : ""}
        </h2>
        <p className="text-xs text-muted-foreground">
          You can comment on a post and reply once to a comment. Replies to replies are not allowed.
        </p>
        {memberRestricted && (
          <p className="text-sm text-muted-foreground">
            Your account is currently paused. You have view-only access.
          </p>
        )}
        {!archived && !replyTo && (
          <CommentComposer
            canEngage={canEngage}
            user={user}
            verified={verified}
            hasMemberProfile={hasMemberProfile}
            isReply={false}
            commentText={commentText}
            setCommentText={setCommentText}
            commentFile={commentFile}
            setCommentFile={setCommentFile}
            commentLink={commentLink}
            setCommentLink={setCommentLink}
            onSubmit={submitComment}
          />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {commentsLoadError && <p className="text-sm text-destructive">{commentsLoadError}</p>}

        {comments.length === 0 && !commentsLoadError && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}

        <ul className="space-y-4">
          {topLevelComments.map((c) => {
            const replies = repliesByParentId.get(c.id) ?? [];
            const repliesExpanded = expandedReplies.has(c.id);
            return (
              <li key={c.id} className="space-y-2">
                <CommentItem
                  postId={postId}
                  comment={c}
                  archived={archived}
                  canEngage={canEngage}
                  canShare={canShare}
                  canReport={canReport}
                  canSave={canSave}
                  engageHint={engageHint}
                  shareHint={shareHint}
                  reportHint={reportHint}
                  highlight={highlightCommentId === c.id}
                  saved={savedCommentIds.has(c.id)}
                  commentRef={(el) => {
                    commentRefs.current[c.id] = el;
                  }}
                  showReplyButton
                  onReply={() => {
                    setError("");
                    setReplyTo(c);
                  }}
                  onReport={() => openReport("comment", c)}
                  onToggleSave={() => toggleSaveComment(c.id)}
                  isOwnComment={Boolean(user?.uid && c.authorId === user.uid)}
                />
                {replyTo?.id === c.id && (
                  <CommentComposer
                    canEngage={canEngage}
                    user={user}
                    verified={verified}
                    hasMemberProfile={hasMemberProfile}
                    isReply
                    replyToName={c.userName}
                    onCancel={() => {
                      setReplyTo(null);
                      setCommentText("");
                      setCommentFile(null);
                      setCommentLink("");
                    }}
                    commentText={commentText}
                    setCommentText={setCommentText}
                    commentFile={commentFile}
                    setCommentFile={setCommentFile}
                    commentLink={commentLink}
                    setCommentLink={setCommentLink}
                    onSubmit={submitComment}
                  />
                )}
                {replies.length > 0 && (
                  <div
                    className={cn(
                      "relative mt-2",
                      repliesExpanded ? "ml-5 pl-5" : "ml-6 pl-4",
                    )}
                  >
                    {repliesExpanded && (
                      <div
                        className="pointer-events-none absolute left-0 top-0 bottom-3 w-[2px] rounded-full bg-gradient-to-b from-primary/35 via-foreground/12 to-transparent"
                        aria-hidden
                      />
                    )}
                    {!repliesExpanded ? (
                      <div className="border-l-2 border-foreground/10 pl-4">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-sm font-medium"
                          onClick={() =>
                            setExpandedReplies((prev) => {
                              const next = new Set(prev);
                              next.add(c.id);
                              return next;
                            })
                          }
                        >
                          {replies.length} {replies.length === 1 ? "reply" : "replies"} · View replies
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-foreground/8 bg-muted/15 dark:bg-muted/10 py-3 pr-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 pl-0.5">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            <span className="inline-block w-3 h-px align-middle bg-foreground/25 mr-1.5" aria-hidden />
                            Replies to{" "}
                            <span className="font-semibold normal-case text-foreground/80">{c.userName}</span>
                          </p>
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-xs text-muted-foreground"
                            onClick={() =>
                              setExpandedReplies((prev) => {
                                const next = new Set(prev);
                                next.delete(c.id);
                                return next;
                              })
                            }
                          >
                            Hide replies
                          </Button>
                        </div>
                        <ul className="space-y-2 relative">
                          {replies.map((r) => (
                            <CommentItem
                              key={r.id}
                              postId={postId!}
                              comment={r}
                              archived={archived}
                              canEngage={canEngage}
                              canShare={canShare}
                              canReport={canReport}
                              canSave={canSave}
                              engageHint={engageHint}
                              shareHint={shareHint}
                              reportHint={reportHint}
                              highlight={highlightCommentId === r.id}
                              saved={savedCommentIds.has(r.id)}
                              isReply
                              parentUserName={c.userName}
                              commentRef={(el) => {
                                commentRefs.current[r.id] = el;
                              }}
                              onReport={() => openReport("comment", r)}
                              onToggleSave={() => toggleSaveComment(r.id)}
                              isOwnComment={Boolean(user?.uid && r.authorId === user.uid)}
                            />
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <CommunityReportDialog open={reportOpen} onOpenChange={setReportOpen} onSubmit={submitReport} />

      <CreatePostModal
        open={editOpen}
        onOpenChange={setEditOpen}
        displayName={welcomeName}
        profileInitials={profileInitials}
        bio={memberAboutMe || memberBio}
        onPublished={() => {
          setEditOpen(false);
        }}
        postToEdit={post as PostCardPost}
      />
    </div>
  );
}

function CommentComposer({
  canEngage,
  user,
  verified,
  hasMemberProfile,
  isReply,
  replyToName,
  onCancel,
  commentText,
  setCommentText,
  setCommentFile,
  commentLink,
  setCommentLink,
  onSubmit,
}: {
  canEngage: boolean;
  user: import("firebase/auth").User | null;
  verified: boolean;
  hasMemberProfile: boolean;
  isReply: boolean;
  replyToName?: string;
  onCancel?: () => void;
  commentText: string;
  setCommentText: (v: string) => void;
  commentFile: File | null;
  setCommentFile: (f: File | null) => void;
  commentLink: string;
  setCommentLink: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const maxLen = isReply ? REPLY_MAX : COMMENT_MAX;
  const imgId = isReply ? "reply-img" : "comment-img";
  const linkId = isReply ? "reply-link" : "comment-link";

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "space-y-2 border border-foreground/10 rounded-xl p-4",
        isReply && "ml-2 bg-muted/20",
        !canEngage && "opacity-60",
      )}
    >
      {isReply && replyToName && (
        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
          Replying to <span className="font-medium text-foreground">{replyToName}</span>
          {onCancel && (
            <Button type="button" variant="link" className="text-xs h-auto p-0" disabled={!canEngage} onClick={onCancel}>
              Cancel
            </Button>
          )}
        </p>
      )}
      <Textarea
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        maxLength={maxLen}
        rows={isReply ? 3 : 4}
        disabled={!canEngage}
        placeholder={
          !canEngage
            ? "Log in to comment…"
            : isReply
              ? "Replies are limited to one level to keep discussions clear and focused."
              : `Comment (max ${COMMENT_MAX} characters)`
        }
        className="bg-foreground/5 border-foreground/10 disabled:cursor-not-allowed"
      />
      <div className="space-y-1">
        <Label htmlFor={linkId} className="text-xs text-muted-foreground flex items-center gap-1">
          <Link2 className="h-3 w-3" /> Optional link
        </Label>
        <Input
          id={linkId}
          type="url"
          placeholder="https://…"
          value={commentLink}
          disabled={!canEngage}
          onChange={(e) => setCommentLink(e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={imgId} className="text-xs text-muted-foreground">
          Optional image (max 1.5 MB)
        </Label>
        <Input
          id={imgId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!canEngage}
          onChange={(e) => setCommentFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canEngage}>
          {isReply ? "Post reply" : "Post comment"}
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
  );
}

function CommentItem({
  postId,
  comment,
  archived,
  canEngage,
  canShare,
  canReport,
  canSave,
  engageHint,
  shareHint,
  reportHint,
  highlight,
  saved,
  isReply = false,
  parentUserName,
  showReplyButton = false,
  commentRef,
  onReply,
  onReport,
  onToggleSave,
  isOwnComment = false,
}: {
  postId: string;
  comment: CommentRow;
  archived: boolean;
  canEngage: boolean;
  canShare: boolean;
  canReport: boolean;
  canSave: boolean;
  engageHint: string;
  shareHint: string;
  reportHint: string;
  highlight: boolean;
  saved: boolean;
  isReply?: boolean;
  parentUserName?: string;
  showReplyButton?: boolean;
  commentRef: (el: HTMLLIElement | null) => void;
  onReply?: () => void;
  onReport: () => void;
  onToggleSave: () => void;
  isOwnComment?: boolean;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => {
    const path = comment.imageStoragePath;
    if (!path) {
      setImageUrl(null);
      return;
    }
    getDownloadURL(storageRef(storage, path))
      .then(setImageUrl)
      .catch(() => setImageUrl(null));
  }, [comment.imageStoragePath]);

  return (
    <li
      ref={commentRef}
      className={cn(
        "border rounded-xl p-4 list-none",
        isReply
          ? "border-foreground/8 bg-background/80 shadow-none"
          : "border-foreground/10 bg-background/50",
        highlight && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <div className="flex justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isReply && parentUserName && (
            <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <span className="shrink-0 w-5 h-px bg-gradient-to-r from-primary/40 to-foreground/15" aria-hidden />
              <span>
                Reply to <span className="font-medium text-foreground/75">{parentUserName}</span>
              </span>
            </p>
          )}
          <p className="text-sm font-semibold">{comment.userName}</p>
          <p className="text-xs text-muted-foreground">
            {comment.createdAt?.toDate ? formatRelativeTime(comment.createdAt.toDate()) : ""}
          </p>
        </div>
        {!archived && (
          <div className="flex flex-wrap gap-0.5 justify-end max-w-[220px]">
            <CommunityIconAction
              label="Save"
              icon={communityActionIcons.save}
              active={saved}
              disabled={!canSave}
              title={!canSave ? engageHint : saved ? "Unsave" : "Save"}
              onClick={onToggleSave}
            />
            {showReplyButton && onReply && (
              <CommunityIconAction
                label="Reply"
                icon={MessageSquare}
                disabled={!canEngage}
                title={!canEngage ? engageHint : "Reply"}
                onClick={onReply}
              />
            )}
            <CommunityIconAction
              label="Spam"
              icon={communityActionIcons.report}
              disabled={!canReport || isOwnComment}
              title={isOwnComment ? "You cannot report your own content." : !canReport ? reportHint : "Report content"}
              onClick={onReport}
            />
            <CommunityIconAction
              label="LinkedIn"
              icon={communityActionIcons.linkedIn}
              disabled={!canShare}
              title={shareHint}
              onClick={() => {
                if (!canShare) return;
                window.open(
                  buildLinkedInCommentShareUrl(postId, comment.id, comment.text),
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
            />
            <CommunityIconAction
              label={copyMsg || "Copy link"}
              icon={communityActionIcons.copyLink}
              disabled={!canShare}
              title={!canShare ? shareHint : "Copy link"}
              onClick={async () => {
                if (!canShare) return;
                const ok = await copyCommentLink(postId, comment.id);
                setCopyMsg(ok ? "Copied" : "Failed");
                window.setTimeout(() => setCopyMsg(""), 2000);
              }}
            />
          </div>
        )}
      </div>
      <p className="text-sm mt-2 whitespace-pre-wrap">{comment.text}</p>
      {comment.externalLink && (
        <a
          href={comment.externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary font-medium underline break-all mt-2 inline-block"
        >
          {comment.externalLink}
        </a>
      )}
      {imageUrl && (
        <img src={imageUrl} alt="" className="mt-2 rounded-lg max-h-48 border border-foreground/10" />
      )}
    </li>
  );
}

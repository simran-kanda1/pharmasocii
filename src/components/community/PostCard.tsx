import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ref, getDownloadURL } from "firebase/storage";
import { auth, storage } from "@/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { CommunityCategoryDoc } from "@/lib/communityTypes";
import { formatCategoryPlain, formatRelativeTime } from "@/lib/community";
import { Bookmark, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

import { PostActionBar } from "@/components/community/PostActionBar";
import { saveCommunityFeedScroll } from "@/lib/communityScrollRestore";

export type PostCardPost = {
  id: string;
  authorId?: string;
  authorUserName: string;
  authorTagline?: string;
  title: string;
  text: string;
  mainCategories: string[];
  subCategories: string[];
  subSubCategories: string[];
  countries?: string[];
  externalLinks?: string[];
  imageStoragePath?: string | null;
  commentCount?: number;
  likeCount?: number;
  createdAt?: { toDate: () => Date };
};

function ExternalInlineLink({ href }: { href: string }) {
  return (
    <span
      role="link"
      tabIndex={0}
      className="text-primary font-medium underline underline-offset-2 break-all cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(href, "_blank", "noopener,noreferrer");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }}
    >
      {href}
    </span>
  );
}

function linkifyText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(/^https?:\/\//)) {
      return <ExternalInlineLink key={i} href={part} />;
    }
    return <span key={i}>{part}</span>;
  });
}

export function PostCard({
  post,
  categoryDoc,
  showAuthorEmail,
  showActionBar = false,
  canEngage = false,
  canShare,
  canReport,
  canSave,
  engageHint,
  saved,
  helpful,
  onToggleSave,
  onToggleHelpful,
  rememberFeedScroll,
  onEdit,
}: {
  post: PostCardPost;
  categoryDoc: CommunityCategoryDoc | null;
  showAuthorEmail?: string | null;
  showActionBar?: boolean;
  canEngage?: boolean;
  canShare?: boolean;
  canReport?: boolean;
  canSave?: boolean;
  engageHint?: string;
  saved?: boolean;
  helpful?: boolean;
  onToggleSave?: () => void;
  onToggleHelpful?: () => void;
  /** When true, saves scroll position before opening post (community feed). */
  rememberFeedScroll?: boolean;
  onEdit?: () => void;
}) {
  const beforeOpenPost = () => {
    if (rememberFeedScroll) saveCommunityFeedScroll(post.id);
  };
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const created = post.createdAt?.toDate?.() ?? new Date();
  const currentUserId = auth.currentUser?.uid;
  const isAuthor = post.authorId && currentUserId && post.authorId === currentUserId;
  const hoursSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  const isEditable = isAuthor && hoursSinceCreation <= 6;

  const { segments } = formatCategoryPlain(
    categoryDoc,
    post.mainCategories ?? [],
    post.subCategories ?? [],
    post.subSubCategories ?? [],
  );
  const initials = (post.authorUserName || "?").slice(0, 2).toUpperCase();

  useEffect(() => {
    const path = post.imageStoragePath;
    if (!path) {
      setImageUrl(null);
      return;
    }
    let cancelled = false;
    getDownloadURL(ref(storage, path))
      .then((url) => {
        if (!cancelled) setImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [post.imageStoragePath]);

  const categoryLine = segments
    .map((seg) => {
      const bracket = seg.bracket.length ? ` [${seg.bracket.join(", ")}]` : "";
      return `${seg.main}${bracket}`;
    })
    .join(", ");

  const links = Array.isArray(post.externalLinks) ? post.externalLinks : [];

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow dark:border-foreground/15 dark:bg-card">
      <div className="p-4 sm:p-5">
        <div className="flex gap-3">
          <Avatar className="h-11 w-11 shrink-0 rounded-full">
            <AvatarImage src="" alt="" />
            <AvatarFallback className="bg-slate-800 text-white text-sm font-semibold dark:bg-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 w-full">
              <span className="font-semibold text-foreground text-sm">{post.authorUserName}</span>
              {post.authorTagline && (
                <span className="text-xs text-muted-foreground font-normal">({post.authorTagline})</span>
              )}
              {showAuthorEmail ? (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{showAuthorEmail}</span>
              ) : null}
              <span className="text-xs text-muted-foreground">{formatRelativeTime(created)}</span>
              <div className="ml-auto flex items-center gap-1">
                {isEditable && onEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEdit();
                    }}
                    title="Edit post (available for 6 hours after posting)"
                    aria-label="Edit post"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {!showActionBar && canSave && onToggleSave && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.preventDefault();
                      onToggleSave();
                    }}
                    aria-label={saved ? "Unsave" : "Save"}
                  >
                    <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
                  </Button>
                )}
              </div>
            </div>
            {categoryLine ? (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">{categoryLine}</p>
            ) : null}
            {post.countries && post.countries.length > 0 ? (
              <p className="text-xs text-muted-foreground mt-1 font-medium">{post.countries.join(", ")}</p>
            ) : null}
          </div>
        </div>

        <Link to={`/community/post/${post.id}`} className="block group mt-4" target="_blank" rel="noopener noreferrer" onClick={beforeOpenPost}>
          <h2 className="text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          <div className="text-sm text-foreground/85 mt-2 whitespace-pre-wrap break-words line-clamp-6">
            {linkifyText(post.text)}
          </div>
        </Link>

        {links.length > 0 && (
          <ul className="mt-3 space-y-1">
            {links.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary font-medium underline underline-offset-2 break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {imageUrl && (
        <Link
          to={`/community/post/${post.id}`}
          className="block border-t border-slate-100 dark:border-foreground/10"
          target="_blank"
          rel="noopener noreferrer"
          onClick={beforeOpenPost}
        >
          <div className="relative w-full bg-slate-100 dark:bg-muted/40 aspect-[16/10] max-h-[420px]">
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </Link>
      )}

      {showActionBar && (
        <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
          <PostActionBar
            postId={post.id}
            postTitle={post.title}
            targetAuthorId={post.authorId}
            commentCount={post.commentCount ?? 0}
            helpfulCount={post.likeCount ?? 0}
            canEngage={canEngage}
            canShare={canShare ?? canEngage}
            canReport={canReport ?? canEngage}
            canSave={canSave ?? canEngage}
            engageHint={engageHint}
            saved={saved}
            helpful={helpful}
            onToggleSave={onToggleSave}
            onToggleHelpful={onToggleHelpful}
            rememberFeedScroll={rememberFeedScroll}
          />
        </div>
      )}
    </article>
  );
}

import { Link } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/community/PostCard";
import type { CommunityCategoryDoc } from "@/lib/communityTypes";
import type { CommunityView } from "@/components/community/CommunityMemberSidebar";
import type { CommunityPost } from "@/lib/communityTypes";

type Props = {
  view: CommunityView;
  categoryDoc: CommunityCategoryDoc | null;
  userId: string;
  canEngage: boolean;
  engageHint?: string;
  savedPostIds: Set<string>;
  helpfulPostIds: Set<string>;
  onToggleSave: (postId: string) => void;
  onToggleHelpful: (postId: string) => void;
  onUnreadChange?: (count: number) => void;
};

export function CommunityMemberPanels({
  view,
  categoryDoc,
  userId,
  canEngage,
  engageHint,
  savedPostIds,
  helpfulPostIds,
  onToggleSave,
  onToggleHelpful,
  onUnreadChange,
}: Props) {
  const [myPosts, setMyPosts] = useState<Array<{ id: string } & CommunityPost>>([]);
  const [savedPosts, setSavedPosts] = useState<Array<{ id: string } & CommunityPost>>([]);
  const [savedComments, setSavedComments] = useState<
    Array<{ commentId: string; postId: string; preview?: string; unavailable?: boolean }>
  >([]);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; preview?: string; postId?: string; isRead?: boolean }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [picture, setPicture] = useState("");
  const [profileMsg, setProfileMsg] = useState("");

  useEffect(() => {
    if (view === "home" || !userId) return;
    (async () => {
      setLoading(true);
      try {
        const mref = doc(db, "membersCollection", userId);
        const snap = await getDoc(mref);
        if (snap.exists()) {
          const d = snap.data();
          setName(String(d.name ?? ""));
          setUserName(String(d.userName ?? ""));
          setEmail(String(d.email ?? ""));
          setBio(String(d.userBio ?? ""));
          setPicture(String(d.profilePicture ?? ""));
        }

        if (view === "my-space" || view === "notifications") {
          const pq = query(
            collection(db, "postsCollection"),
            where("authorId", "==", userId),
            where("archived", "==", false),
            orderBy("createdAt", "desc"),
          );
          const ps = await getDocs(pq);
          setMyPosts(ps.docs.map((d) => ({ id: d.id, ...(d.data() as CommunityPost) })));

          const savedSnap = await getDocs(collection(db, "membersCollection", userId, "savedPostsCollection"));
          const loaded: Array<{ id: string } & CommunityPost> = [];
          for (const d of savedSnap.docs) {
            const pr = await getDoc(doc(db, "postsCollection", d.id));
            if (pr.exists() && pr.data().archived !== true) {
              loaded.push({ id: pr.id, ...(pr.data() as CommunityPost) });
            }
          }
          setSavedPosts(loaded);

          const savedCommentsSnap = await getDocs(
            collection(db, "membersCollection", userId, "savedCommentsCollection"),
          );
          const rows: typeof savedComments = [];
          for (const d of savedCommentsSnap.docs) {
            const postId = String(d.data().postId || "");
            if (!postId) continue;
            const cref = await getDoc(doc(db, "postsCollection", postId, "commentsCollection", d.id));
            if (!cref.exists() || cref.data()?.archived) {
              rows.push({ commentId: d.id, postId, unavailable: true });
            } else {
              rows.push({ commentId: d.id, postId, preview: String(cref.data()?.text || "").slice(0, 120) });
            }
          }
          setSavedComments(rows);
        }

        if (view === "notifications") {
          const nq = query(
            collection(db, "membersCollection", userId, "notificationsCollection"),
            orderBy("createdAt", "desc"),
            limit(30),
          );
          const ns = await getDocs(nq);
          const list = ns.docs.map((d) => ({ id: d.id, ...d.data() })) as typeof notifications;
          setNotifications(list);
          onUnreadChange?.(list.filter((n) => !n.isRead).length);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [view, userId, onUnreadChange]);

  const postCardProps = (p: { id: string } & CommunityPost) => ({
    post: p as never,
    categoryDoc,
    showActionBar: true,
    canEngage,
    engageHint,
    saved: savedPostIds.has(p.id),
    helpful: helpfulPostIds.has(p.id),
    onToggleSave: () => onToggleSave(p.id),
    onToggleHelpful: () => onToggleHelpful(p.id),
  });

  if (view === "my-space") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-foreground/15 dark:bg-card">
        <Tabs defaultValue="my-posts" className="p-4">
          <TabsList className="mb-4">
            <TabsTrigger value="my-posts">My posts</TabsTrigger>
            <TabsTrigger value="saved-posts">Saved posts</TabsTrigger>
            <TabsTrigger value="saved-comments">Saved comments</TabsTrigger>
          </TabsList>
          {loading ? (
            <p className="text-sm text-muted-foreground px-2">Loading…</p>
          ) : (
            <>
              <TabsContent value="my-posts" className="space-y-4 mt-0">
                <p className="text-sm text-muted-foreground">{myPosts.length} posts</p>
                {myPosts.map((p) => (
                  <PostCard key={p.id} {...postCardProps(p)} />
                ))}
              </TabsContent>
              <TabsContent value="saved-posts" className="space-y-4 mt-0">
                {savedPosts.map((p) => (
                  <PostCard key={p.id} {...postCardProps(p)} />
                ))}
              </TabsContent>
              <TabsContent value="saved-comments" className="space-y-2 mt-0">
                {savedComments.map((c) => (
                  <div key={c.commentId} className="border rounded-lg p-3 text-sm">
                    {c.unavailable ? (
                      <p className="text-muted-foreground">Unavailable</p>
                    ) : (
                      <>
                        <p className="line-clamp-2">{c.preview}</p>
                        <Link
                          to={`/community/post/${c.postId}?highlight=${c.commentId}`}
                          className="text-xs text-primary underline mt-2 inline-block"
                        >
                          Open post
                        </Link>
                      </>
                    )}
                  </div>
                ))}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    );
  }

  if (view === "notifications") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 dark:border-foreground/15 dark:bg-card">
        <h2 className="font-semibold">Notifications</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`border rounded-lg p-3 flex justify-between gap-3 ${n.isRead ? "opacity-70" : ""}`}>
              <div>
                <p className="text-sm font-medium">New comment</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{n.preview}</p>
                {n.postId && (
                  <Link to={`/community/post/${n.postId}`} className="text-xs text-primary underline mt-1 inline-block">
                    View post
                  </Link>
                )}
              </div>
              {!n.isRead && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await updateDoc(doc(db, "membersCollection", userId, "notificationsCollection", n.id), {
                      isRead: true,
                    });
                    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                    onUnreadChange?.(notifications.filter((x) => x.id !== n.id && !x.isRead).length);
                  }}
                >
                  Mark read
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  if (view === "profile") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-foreground/15 dark:bg-card">
        <h2 className="font-semibold mb-4">Update profile</h2>
        <form
          className="space-y-4 max-w-lg"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!auth.currentUser) return;
            try {
              await updateDoc(doc(db, "membersCollection", userId), { userBio: bio, profilePicture: picture });
              setProfileMsg("Profile updated.");
            } catch {
              setProfileMsg("Could not save.");
            }
          }}
        >
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={name} disabled className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={userName} disabled className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">About me</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pic">Profile picture URL</Label>
            <Input id="pic" value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="https://…" />
          </div>
          {profileMsg && <p className="text-sm text-muted-foreground">{profileMsg}</p>}
          <Button type="submit">Save</Button>
        </form>
      </div>
    );
  }

  return null;
}

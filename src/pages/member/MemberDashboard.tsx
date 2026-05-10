import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/community/PostCard";
import { useCommunityCategories } from "@/hooks/useCommunityCategories";
import type { CommunityPost } from "@/lib/communityTypes";

export default function MemberDashboard() {
  const navigate = useNavigate();
  const { categoryDoc } = useCommunityCategories();
  const [user, setUser] = useState<import("firebase/auth").User | null>(null);
  const [ready, setReady] = useState(false);
  const [myPosts, setMyPosts] = useState<Array<{ id: string } & CommunityPost>>([]);
  const [savedPosts, setSavedPosts] = useState<Array<{ id: string } & CommunityPost>>([]);
  const [name, setName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [picture, setPicture] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; preview?: string; postId?: string; isRead?: boolean; createdAt?: { toDate: () => Date } }>
  >([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setReady(true);
        return;
      }
      await u.reload();
      setUser(u);
      const mref = doc(db, "membersCollection", u.uid);
      const snap = await getDoc(mref);
      if (!snap.exists()) {
        navigate("/member/setup", { replace: true });
        return;
      }
      const d = snap.data();
      setName(String(d.name ?? ""));
      setUserName(String(d.userName ?? ""));
      setEmail(String(d.email ?? ""));
      setBio(String(d.userBio ?? ""));
      setPicture(String(d.profilePicture ?? ""));
      setReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setLoadingPosts(false);
      return;
    }
    (async () => {
      try {
        const pq = query(
          collection(db, "postsCollection"),
          where("authorId", "==", user.uid),
          where("archived", "==", false),
          orderBy("createdAt", "desc"),
        );
        const ps = await getDocs(pq);
        setMyPosts(ps.docs.map((d) => ({ id: d.id, ...(d.data() as CommunityPost) })));

        const savedSnap = await getDocs(
          collection(db, "membersCollection", user.uid, "savedPostsCollection"),
        );
        const ids = savedSnap.docs.map((d) => d.id);
        const loaded: Array<{ id: string } & CommunityPost> = [];
        for (const id of ids) {
          const pr = await getDoc(doc(db, "postsCollection", id));
          if (pr.exists() && pr.data().archived !== true) {
            loaded.push({ id: pr.id, ...(pr.data() as CommunityPost) });
          }
        }
        loaded.sort((a, b) => {
          const ta = a.createdAt && "toDate" in a.createdAt ? a.createdAt.toDate().getTime() : 0;
          const tb = b.createdAt && "toDate" in b.createdAt ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });
        setSavedPosts(loaded);

        const nq = query(
          collection(db, "membersCollection", user.uid, "notificationsCollection"),
          orderBy("createdAt", "desc"),
          limit(30),
        );
        const ns = await getDocs(nq);
        setNotifications(ns.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPosts(false);
      }
    })();
  }, [user]);

  const markNotificationRead = async (id: string) => {
    if (!user) return;
    await updateDoc(doc(db, "membersCollection", user.uid, "notificationsCollection", id), {
      isRead: true,
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg("");
    if (!user) return;
    try {
      await updateDoc(doc(db, "membersCollection", user.uid), {
        userBio: bio,
        profilePicture: picture,
      });
      setProfileMsg("Profile updated.");
    } catch (err) {
      console.error(err);
      setProfileMsg("Could not save profile.");
    }
  };

  if (!ready) {
    return (
      <div className="container mx-auto px-4 py-16">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center">
        <p className="text-muted-foreground mb-4">Log in to view your member dashboard.</p>
        <Button asChild>
          <Link to="/member/login">Member login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Member dashboard</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Name and username cannot be changed. Update your bio or profile image URL below.
      </p>

      <Tabs defaultValue="posts">
        <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="posts">My posts</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          {loadingPosts ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : myPosts.length === 0 ? (
            <p className="text-muted-foreground">You have not posted yet.</p>
          ) : (
            myPosts.map((p) => (
              <PostCard key={p.id} post={p as never} categoryDoc={categoryDoc} />
            ))
          )}
          <Button variant="outline" asChild>
            <Link to="/community/new">New post</Link>
          </Button>
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          {loadingPosts ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : savedPosts.length === 0 ? (
            <p className="text-muted-foreground">No saved posts.</p>
          ) : (
            savedPosts.map((p) => (
              <PostCard key={p.id} post={p as never} categoryDoc={categoryDoc} />
            ))
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`border border-foreground/10 rounded-lg p-4 flex justify-between gap-4 ${n.isRead ? "opacity-70" : ""}`}
              >
                <div>
                  <p className="text-sm font-medium">New comment</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{n.preview}</p>
                  {n.postId && (
                    <Link to={`/community/post/${n.postId}`} className="text-xs text-primary mt-2 inline-block">
                      View post
                    </Link>
                  )}
                </div>
                {!n.isRead && (
                  <Button type="button" size="sm" variant="outline" onClick={() => markNotificationRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="profile">
          <form onSubmit={saveProfile} className="space-y-4 max-w-lg border border-foreground/10 rounded-xl p-6">
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
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="bg-foreground/5 border-foreground/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pic">Profile picture URL</Label>
              <Input
                id="pic"
                value={picture}
                onChange={(e) => setPicture(e.target.value)}
                className="bg-foreground/5 border-foreground/10"
                placeholder="https://…"
              />
            </div>
            {profileMsg && <p className="text-sm text-muted-foreground">{profileMsg}</p>}
            <Button type="submit">Save</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

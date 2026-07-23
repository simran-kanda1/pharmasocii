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
import { useEffect, useMemo, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth, db } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { getPasswordPolicyChecks, isPasswordPolicyValid, PASSWORD_POLICY_ERROR_MESSAGE } from "@/lib/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/community/PostCard";
import type { CommunityCategoryDoc } from "@/lib/communityTypes";
import type { CommunityView } from "@/components/community/CommunityMemberSidebar";
import type { CommunityPost } from "@/lib/communityTypes";
import { Search, X } from "lucide-react";
import { saveCommunityFeedScroll } from "@/lib/communityScrollRestore";
import { getAllCommunityCountries } from "@/lib/communityCountries";
import {
  deleteMemberNotification,
  filterNotificationsByAge,
  countUnreadNotificationsFromList,
  notificationTargetUrl,
  purgeExpiredNotifications,
  type MemberNotification,
} from "@/lib/communityNotifications";
import { postMatchesFilterKeys } from "@/lib/communityCategoryDisplay";

type Props = {
  view: CommunityView;
  categoryDoc: CommunityCategoryDoc | null;
  userId: string;
  canEngage: boolean;
  canShare: boolean;
  canReport: boolean;
  canSave: boolean;
  engageHint?: string;
  savedPostIds: Set<string>;
  helpfulPostIds: Set<string>;
  selectedCountries?: string[];
  selectedFilterKeys?: string[];
  onToggleSave: (postId: string) => void;
  onToggleHelpful: (postId: string) => void;
  onUnreadChange?: (count: number) => void;
};

export function CommunityMemberPanels({
  view,
  categoryDoc,
  userId,
  canEngage,
  canShare,
  canReport,
  canSave,
  engageHint,
  savedPostIds,
  helpfulPostIds,
  selectedCountries = [],
  selectedFilterKeys = [],
  onToggleSave,
  onToggleHelpful,
  onUnreadChange,
}: Props) {

  const [myPosts, setMyPosts] = useState<Array<{ id: string } & CommunityPost>>([]);
  const [savedPosts, setSavedPosts] = useState<Array<{ id: string; unavailable?: boolean } & CommunityPost>>([]);
  const [savedComments, setSavedComments] = useState<
    Array<{ commentId: string; postId: string; preview?: string; unavailable?: boolean }>
  >([]);
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [picture, setPicture] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [country, setCountry] = useState("");
  const [institution, setInstitution] = useState("");
  const [industry, setIndustry] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("my-posts");
  const [myPostsSearch, setMyPostsSearch] = useState("");
  const [savedPostsSearch, setSavedPostsSearch] = useState("");
  const [savedCommentsSearch, setSavedCommentsSearch] = useState("");
  const passwordChecks = getPasswordPolicyChecks(newPassword);

  useEffect(() => {
    setMyPostsSearch("");
    setSavedPostsSearch("");
    setSavedCommentsSearch("");
    setActiveTab("my-posts");
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
          setCountry(String(d.country ?? ""));
          setInstitution(String(d.institution ?? ""));
          setIndustry(String(d.industry ?? ""));
          setAboutMe(String(d.aboutMe ?? ""));
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
          const sortedSavedDocs = [...savedSnap.docs].sort((a, b) => {
            const tA = a.data().savedAt?.toDate?.()?.getTime() || a.data().savedAt?.seconds || 0;
            const tB = b.data().savedAt?.toDate?.()?.getTime() || b.data().savedAt?.seconds || 0;
            return tB - tA;
          });
          const loaded: Array<{ id: string; unavailable?: boolean } & CommunityPost> = [];
          for (const d of sortedSavedDocs) {
            try {
              const pr = await getDoc(doc(db, "postsCollection", d.id));
              if (!pr.exists()) {
                loaded.push({ id: d.id, unavailable: true } as { id: string; unavailable?: boolean } & CommunityPost);
                continue;
              }
              const data = pr.data() as CommunityPost;
              loaded.push({
                id: pr.id,
                ...data,
                unavailable: data.archived === true,
              });
            } catch (err) {
              console.warn(`Failed to fetch saved post ${d.id}:`, err);
              loaded.push({ id: d.id, unavailable: true } as { id: string; unavailable?: boolean } & CommunityPost);
            }
          }
          setSavedPosts(loaded);

          const savedCommentsSnap = await getDocs(
            collection(db, "membersCollection", userId, "savedCommentsCollection"),
          );
          const sortedSavedCommentsDocs = [...savedCommentsSnap.docs].sort((a, b) => {
            const tA = a.data().savedAt?.toDate?.()?.getTime() || a.data().savedAt?.seconds || 0;
            const tB = b.data().savedAt?.toDate?.()?.getTime() || b.data().savedAt?.seconds || 0;
            return tB - tA;
          });
          const rows: typeof savedComments = [];
          for (const d of sortedSavedCommentsDocs) {
            const postId = String(d.data().postId || "");
            if (!postId) continue;
            try {
              const cref = await getDoc(doc(db, "postsCollection", postId, "commentsCollection", d.id));
              if (!cref.exists() || cref.data()?.archived === true) {
                rows.push({ commentId: d.id, postId, unavailable: true });
              } else {
                rows.push({ commentId: d.id, postId, preview: String(cref.data()?.text || "").slice(0, 120) });
              }
            } catch (err) {
              console.warn(`Failed to fetch saved comment ${d.id}:`, err);
              rows.push({ commentId: d.id, postId, unavailable: true });
            }
          }
          setSavedComments(rows);
        }

        if (view === "notifications") {
          await purgeExpiredNotifications(userId);
          const nq = query(
            collection(db, "membersCollection", userId, "notificationsCollection"),
            orderBy("createdAt", "desc"),
            limit(50),
          );
          const ns = await getDocs(nq);
          const list = filterNotificationsByAge(
            ns.docs.map((d) => ({ id: d.id, ...d.data() })) as MemberNotification[],
          );
          setNotifications(list);
          onUnreadChange?.(countUnreadNotificationsFromList(list));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [view, userId, onUnreadChange]);

  const filteredMyPosts = useMemo(() => {
    return myPosts.filter((p) => {
      if (selectedCountries.length > 0) {
        const countries = p.countries || [];
        if (!countries.some((c) => selectedCountries.includes(c))) return false;
      }
      if (selectedFilterKeys.length > 0) {
        if (!postMatchesFilterKeys(p.filterKeys, selectedFilterKeys, {
          mainCategories: p.mainCategories,
          subCategories: p.subCategories,
          subSubCategories: p.subSubCategories,
        })) return false;
      }
      if (myPostsSearch.trim()) {
        const s = myPostsSearch.toLowerCase().trim();
        const matchTitle = String(p.title || "").toLowerCase().includes(s);
        const matchText = String(p.text || "").toLowerCase().includes(s);
        const matchMain = (p.mainCategories || []).some((c) => String(c).toLowerCase().includes(s));
        const matchSub = (p.subCategories || []).some((c) => String(c).toLowerCase().includes(s));
        const matchSubSub = (p.subSubCategories || []).some((c) => String(c).toLowerCase().includes(s));
        if (!matchTitle && !matchText && !matchMain && !matchSub && !matchSubSub) return false;
      }
      return true;
    });
  }, [myPosts, selectedCountries, selectedFilterKeys, myPostsSearch]);

  const filteredSavedPosts = useMemo(() => {
    return savedPosts.filter((p) => {
      if (p.unavailable) return true;
      if (selectedCountries.length > 0) {
        const countries = p.countries || [];
        if (!countries.some((c) => selectedCountries.includes(c))) return false;
      }
      if (selectedFilterKeys.length > 0) {
        if (!postMatchesFilterKeys(p.filterKeys, selectedFilterKeys, {
          mainCategories: p.mainCategories,
          subCategories: p.subCategories,
          subSubCategories: p.subSubCategories,
        })) return false;
      }
      if (savedPostsSearch.trim()) {
        const s = savedPostsSearch.toLowerCase().trim();
        const matchTitle = String(p.title || "").toLowerCase().includes(s);
        const matchText = String(p.text || "").toLowerCase().includes(s);
        const matchMain = (p.mainCategories || []).some((c) => String(c).toLowerCase().includes(s));
        const matchSub = (p.subCategories || []).some((c) => String(c).toLowerCase().includes(s));
        const matchSubSub = (p.subSubCategories || []).some((c) => String(c).toLowerCase().includes(s));
        if (!matchTitle && !matchText && !matchMain && !matchSub && !matchSubSub) return false;
      }
      return true;
    });
  }, [savedPosts, selectedCountries, selectedFilterKeys, savedPostsSearch]);

  const filteredSavedComments = useMemo(() => {
    if (!savedCommentsSearch.trim()) return savedComments;
    const s = savedCommentsSearch.toLowerCase().trim();
    return savedComments.filter((c) => {
      if (c.unavailable) return false;
      return String(c.preview || "").toLowerCase().includes(s);
    });
  }, [savedComments, savedCommentsSearch]);

  const hasActiveFilters = selectedCountries.length > 0 || selectedFilterKeys.length > 0;

  const postCardProps = (p: { id: string } & CommunityPost) => ({
    post: p as never,
    categoryDoc,
    showActionBar: true,
    rememberFeedScroll: true,
    canEngage,
    canShare,
    canReport,
    canSave,
    engageHint,
    saved: savedPostIds.has(p.id),
    helpful: helpfulPostIds.has(p.id),
    onToggleSave: () => onToggleSave(p.id),
    onToggleHelpful: () => onToggleHelpful(p.id),
  });

  if (view === "my-space") {
    const currentSearchQuery =
      activeTab === "my-posts"
        ? myPostsSearch
        : activeTab === "saved-posts"
          ? savedPostsSearch
          : savedCommentsSearch;

    const handleSearchChange = (val: string) => {
      if (activeTab === "my-posts") setMyPostsSearch(val);
      else if (activeTab === "saved-posts") setSavedPostsSearch(val);
      else setSavedCommentsSearch(val);
    };

    const handleSearchClear = () => {
      if (activeTab === "my-posts") setMyPostsSearch("");
      else if (activeTab === "saved-posts") setSavedPostsSearch("");
      else setSavedCommentsSearch("");
    };

    const searchPlaceholder =
      activeTab === "my-posts"
        ? "Search my posts..."
        : activeTab === "saved-posts"
          ? "Search saved posts..."
          : "Search saved comments...";

    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-foreground/15 dark:bg-card">
        <div className="p-4 border-b border-slate-100 dark:border-foreground/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={currentSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 pr-10 bg-slate-50 dark:bg-muted/30"
            />
            {currentSearchQuery && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
          <TabsList className="mb-4">
            <TabsTrigger value="my-posts">My Posts</TabsTrigger>
            <TabsTrigger value="saved-posts">Saved Posts</TabsTrigger>
            <TabsTrigger value="saved-comments">Saved Comments</TabsTrigger>
          </TabsList>
          {loading ? (
            <p className="text-sm text-muted-foreground px-2">Loading…</p>
          ) : (
            <>
              <TabsContent value="my-posts" className="space-y-4 mt-0">

                {filteredMyPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2">
                    {myPostsSearch.trim()
                      ? "No posts match your search query."
                      : hasActiveFilters
                        ? "No posts match your filters."
                        : "No posts yet."}
                  </p>
                ) : (
                  filteredMyPosts.map((p) => <PostCard key={p.id} {...postCardProps(p)} />)
                )}
              </TabsContent>
              <TabsContent value="saved-posts" className="space-y-4 mt-0">
                {filteredSavedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2">
                    {savedPostsSearch.trim()
                      ? "No saved posts match your search query."
                      : hasActiveFilters
                        ? "No saved posts match your filters."
                        : "No saved posts yet."}
                  </p>
                ) : (
                  filteredSavedPosts.map((p) =>
                    p.unavailable ? (
                      <div key={p.id} className="border rounded-lg p-3 text-sm text-muted-foreground">
                        Saved post temporarily unavailable
                      </div>
                    ) : (
                      <PostCard key={p.id} {...postCardProps(p)} />
                    ),
                  )
                )}
              </TabsContent>
              <TabsContent value="saved-comments" className="space-y-2 mt-0">
                {filteredSavedComments.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2">
                    {savedCommentsSearch.trim() ? "No saved comments match your search query." : "No saved comments yet."}
                  </p>
                ) : (
                  filteredSavedComments.map((c) => (
                    <div key={c.commentId} className="border rounded-lg p-3 text-sm">
                      {c.unavailable ? (
                        <p className="text-muted-foreground">Saved comment temporarily unavailable</p>
                      ) : (
                        <>
                          <p className="line-clamp-2">{c.preview}</p>
                          <Link
                            to={`/community/post/${c.postId}?highlight=${c.commentId}`}
                            className="text-xs text-primary underline mt-2 inline-block"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => saveCommunityFeedScroll(c.postId)}
                          >
                            See More
                          </Link>
                        </>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    );
  }

  if (view === "notifications") {
    const openNotification = async (n: MemberNotification) => {
      const url = notificationTargetUrl(n);
      if (!url) return;
      if (!n.isRead) {
        try {
          await updateDoc(doc(db, "membersCollection", userId, "notificationsCollection", n.id), {
            isRead: true,
          });
          setNotifications((prev) => {
            const next = prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x));
            onUnreadChange?.(countUnreadNotificationsFromList(next));
            return next;
          });
        } catch (e) {
          console.error(e);
        }
      }
      window.open(url, "_blank");
    };

    const removeNotification = async (n: MemberNotification) => {
      try {
        await deleteMemberNotification(userId, n.id);
        const next = notifications.filter((x) => x.id !== n.id);
        setNotifications(next);
        onUnreadChange?.(countUnreadNotificationsFromList(next));
      } catch (e) {
        console.error(e);
      }
    };

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 dark:border-foreground/15 dark:bg-card">
        <h2 className="font-semibold">Notifications</h2>
        <p className="text-xs text-muted-foreground">Notifications older than 30 days are removed automatically.</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          notifications.map((n) => {
            const href = notificationTargetUrl(n);
            const who = n.fromUserName || "Someone";
            return (
              <div
                key={n.id}
                className={`border rounded-lg flex gap-1 overflow-hidden ${n.isRead ? "opacity-75 bg-muted/10" : "bg-background"}`}
              >
                <button
                  type="button"
                  className="flex-1 text-left p-3 min-w-0 hover:bg-muted/30 transition-colors"
                  disabled={!href}
                  onClick={() => openNotification(n)}
                >
                  <p className="text-sm font-medium">
                    {who} commented on your post
                    {!n.isRead && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
                    )}
                  </p>
                  {n.preview ? (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">&ldquo;{n.preview}&rdquo;</p>
                  ) : null}
                  {href ? (
                    <span className="text-xs text-primary mt-2 inline-block">View comment →</span>
                  ) : null}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-auto rounded-none self-stretch px-2"
                  aria-label="Delete notification"
                  onClick={() => removeNotification(n)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (view === "profile") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-foreground/15 dark:bg-card">
        <h2 className="font-semibold mb-4">Update profile</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Name/username are final at account creation.
        </p>
        <form
          className="space-y-4 max-w-lg"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!auth.currentUser) return;
            try {
              await updateDoc(doc(db, "membersCollection", userId), {
                userBio: bio,
                profilePicture: picture,
                country,
                institution: institution.trim(),
                industry: industry.trim(),
                aboutMe: aboutMe.trim(),
              });
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


          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-background border border-slate-200 dark:border-foreground/10 h-10 px-3 rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              >
                <option value="" disabled>Select Country</option>
                {getAllCommunityCountries().map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Biotech"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="institution">Institution / Company</Label>
            <Input
              id="institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. Pfizer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="aboutMe">Tagline (About me tagline)</Label>
              <span className={`text-[11px] ${aboutMe.length >= 25 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>{aboutMe.length}/25</span>
            </div>
            <Input
              id="aboutMe"
              value={aboutMe}
              onChange={(e) => setAboutMe(e.target.value.slice(0, 25))}
              maxLength={25}
              placeholder="e.g. Biologist"
            />
          </div>



          {profileMsg && <p className="text-sm text-muted-foreground">{profileMsg}</p>}
          <Button type="submit">Save</Button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-200 dark:border-foreground/15 max-w-lg space-y-4">
          <h3 className="font-semibold">Change password</h3>
          <p className="text-xs text-muted-foreground">
            Password updates are recorded in the audit trail.
          </p>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setPasswordMsg("");
              if (newPassword !== confirmPassword) {
                setPasswordMsg("New passwords do not match.");
                return;
              }
              if (!isPasswordPolicyValid(newPassword)) {
                setPasswordMsg(PASSWORD_POLICY_ERROR_MESSAGE);
                return;
              }
              const user = auth.currentUser;
              if (!user?.email) {
                setPasswordMsg("Sign in again to change your password.");
                return;
              }
              setPasswordSaving(true);
              try {
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPassword);
                await logActivity({
                  partnerId: user.uid,
                  partnerName: userName || name || user.email,
                  action: "PASSWORD_UPDATED",
                  details: "Community member password changed.",
                  category: "community",
                });
                setPasswordMsg("Password updated.");
                alert("Password updated successfully.");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              } catch (err: unknown) {
                const code = (err as { code?: string })?.code;
                if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                  setPasswordMsg("Current password is incorrect.");
                } else {
                  setPasswordMsg("Could not update password.");
                }
              } finally {
                setPasswordSaving(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li className={passwordChecks.minLength ? "text-emerald-600" : ""}>At least 8 characters</li>
                <li className={passwordChecks.uppercase ? "text-emerald-600" : ""}>At least 1 uppercase letter</li>
                <li className={passwordChecks.lowercase ? "text-emerald-600" : ""}>At least 1 lowercase letter</li>
                <li className={passwordChecks.special ? "text-emerald-600" : ""}>At least 1 special character</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {passwordMsg && <p className="text-sm text-muted-foreground">{passwordMsg}</p>}
            <Button
              type="submit"
              disabled={
                passwordSaving ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
            >
              {passwordSaving ? "Updating…" : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}

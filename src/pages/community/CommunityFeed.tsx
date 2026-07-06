import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostCard, type PostCardPost } from "@/components/community/PostCard";
import { useCommunityCategories } from "@/hooks/useCommunityCategories";
import { auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Search, Tag, Globe, Link2, ImageIcon, MessageSquarePlus, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CommunityFilterSidebar } from "@/components/community/CommunityFilterSidebar";
import { postMatchesFilterKeys } from "@/lib/communityCategoryDisplay";
import { CommunityMemberSidebar, type CommunityView } from "@/components/community/CommunityMemberSidebar";
import { CommunityMemberPanels } from "@/components/community/CommunityMemberPanels";
import { CreatePostModal, type CreatePostModalAction } from "@/components/community/CreatePostModal";
import { loadUnreadNotificationCount } from "@/lib/communityNotifications";
import {
  loadMemberEngagementIds,
  togglePostHelpful,
  toggleSavedPost,
} from "@/lib/communityEngagement";
import { parseSavedFilters, saveCommunityFilters } from "@/lib/communityFilterPreferences";
import { restoreCommunityFeedScroll } from "@/lib/communityScrollRestore";
import {
  canAccessCommunity,
  canEngageCommunity,
  canReportCommunitySpam,
  canSaveCommunityContent,
  canShareCommunityContent,
  communityAccessHint,
} from "@/lib/communityAccess";
import { CommunityViewHeader } from "@/components/community/CommunityViewHeader";

const FEED_PAGE_SIZE = 20;

export default function CommunityFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categoryDoc, categoriesLoading } = useCommunityCategories();
  const [posts, setPosts] = useState<Array<{ id: string; [k: string]: unknown }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [qInput, setQInput] = useState(() => searchParams.get("search") || "");
  const [user, setUser] = useState<import("firebase/auth").User | null>(null);
  const [verified, setVerified] = useState(false);
  const [hasMemberProfile, setHasMemberProfile] = useState(false);
  const [memberUserName, setMemberUserName] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedFilterKeys, setSelectedFilterKeys] = useState<string[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [helpfulPostIds, setHelpfulPostIds] = useState<Set<string>>(new Set());
  const [memberRestricted, setMemberRestricted] = useState(false);
  const [memberBio, setMemberBio] = useState("");
  const [memberAboutMe, setMemberAboutMe] = useState("");
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createAction, setCreateAction] = useState<CreatePostModalAction>(null);
  const [postToEdit, setPostToEdit] = useState<PostCardPost | null>(null);
  const [refreshPostsKey, setRefreshPostsKey] = useState(0);
  const filtersHydratedRef = useRef(false);
  const skipNextFilterSaveRef = useRef(false);
  const lastVisibleDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const communityView = (searchParams.get("view") as CommunityView) || "home";
  const setCommunityView = useCallback(
    (view: CommunityView) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (view === "home") next.delete("view");
        else next.set("view", view);
        return next;
      });
    },
    [setSearchParams],
  );

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
        if (m.exists()) {
          const saved = parseSavedFilters(m.data() as Record<string, unknown>);
          skipNextFilterSaveRef.current = true;
          filtersHydratedRef.current = true;
          setSelectedCountries(saved.countries);
          setSelectedFilterKeys(saved.filterKeys);
          const engagement = await loadMemberEngagementIds(u.uid);
          setSavedPostIds(engagement.savedPostIds);
          setHelpfulPostIds(engagement.helpfulPostIds);
          setNotificationUnread(await loadUnreadNotificationCount(u.uid));
        } else {
          setSavedPostIds(new Set());
          setHelpfulPostIds(new Set());
          setNotificationUnread(0);
        }
      } else {
        setVerified(false);
        setHasMemberProfile(false);
        setMemberUserName(null);
        setMemberBio("");
        setMemberAboutMe("");
        setMemberRestricted(false);
        setSavedPostIds(new Set());
        setHelpfulPostIds(new Set());
        setNotificationUnread(0);
        filtersHydratedRef.current = false;
        setSelectedCountries([]);
        setSelectedFilterKeys([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid || !hasMemberProfile) return;
    const refreshNotifications = () => {
      loadUnreadNotificationCount(user.uid).then(setNotificationUnread).catch(() => {});
    };
    refreshNotifications();
    window.addEventListener("focus", refreshNotifications);
    return () => window.removeEventListener("focus", refreshNotifications);
  }, [user?.uid, hasMemberProfile]);

  useEffect(() => {
    if (!user?.uid || !hasMemberProfile || !filtersHydratedRef.current) return;
    if (skipNextFilterSaveRef.current) {
      skipNextFilterSaveRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      saveCommunityFilters(user.uid, {
        countries: selectedCountries,
        filterKeys: selectedFilterKeys,
      }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(t);
  }, [user?.uid, hasMemberProfile, selectedCountries, selectedFilterKeys]);

  const removeCountryFilter = useCallback((country: string) => {
    setSelectedCountries((prev) => prev.filter((c) => c !== country));
  }, []);

  const removeFilterKey = useCallback((key: string) => {
    setSelectedFilterKeys((prev) => prev.filter((k) => k !== key));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedCountries([]);
    setSelectedFilterKeys([]);
  }, []);

  useEffect(() => {
    if (!canAccessCommunity(user, verified, hasMemberProfile) && communityView !== "home") {
      setCommunityView("home");
    }
  }, [user, verified, hasMemberProfile, communityView, setCommunityView]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasNextPage || !lastVisibleDocRef.current) return;
    setLoadingMore(true);
    try {
      const base = [
        collection(db, "postsCollection"),
        where("archived", "==", false),
        orderBy("createdAt", "desc"),
      ] as const;

      const q = query(...base, startAfter(lastVisibleDocRef.current), limit(FEED_PAGE_SIZE));
      const snap = await getDocs(q);
      const newPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...newPosts.filter((p) => !ids.has(p.id))];
      });

      setHasNextPage(snap.docs.length === FEED_PAGE_SIZE);
      lastVisibleDocRef.current = snap.docs[snap.docs.length - 1] || null;
    } catch (e) {
      console.error("Error loading more posts:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasNextPage]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const bottomRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage && !loadingMore) {
          loadMore();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [loading, loadingMore, hasNextPage, loadMore]
  );
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const isSearchingOrFiltering = !!(
          search.trim() ||
          selectedCountries.length > 0 ||
          selectedFilterKeys.length > 0
        );

        const base = [
          collection(db, "postsCollection"),
          where("archived", "==", false),
          orderBy("createdAt", "desc"),
        ] as const;

        const limitCount = isSearchingOrFiltering ? 1000 : FEED_PAGE_SIZE;
        const q = query(...base, limit(limitCount));
        const snap = await getDocs(q);
        const newPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPosts(newPosts);
        setHasNextPage(!isSearchingOrFiltering && snap.docs.length === FEED_PAGE_SIZE);
        lastVisibleDocRef.current = snap.docs[snap.docs.length - 1] || null;
      } catch (e) {
        console.error("Error fetching posts:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshPostsKey, search, selectedCountries, selectedFilterKeys]);

  useEffect(() => {
    const q = searchParams.get("search") || "";
    setSearch(q);
    setQInput(q);
  }, [searchParams]);

  const textFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return posts;
    return posts.filter((p) => {
      const matchTitle = String(p.title || "").toLowerCase().includes(s);
      const matchMain = ((p.mainCategories as string[] | undefined) || []).some((c) => String(c).toLowerCase().includes(s));
      const matchSub = ((p.subCategories as string[] | undefined) || []).some((c) => String(c).toLowerCase().includes(s));
      const matchSubSub = ((p.subSubCategories as string[] | undefined) || []).some((c) => String(c).toLowerCase().includes(s));
      const matchCountry = ((p.countries as string[] | undefined) || []).some((c) => String(c).toLowerCase().includes(s));
      return matchTitle || matchMain || matchSub || matchSubSub || matchCountry;
    });
  }, [posts, search]);

  const sidebarFiltered = useMemo(() => {
    let list = textFiltered;
    if (selectedCountries.length > 0) {
      list = list.filter((p) => {
        const c = (p.countries as string[] | undefined) || [];
        return c.some((cc) => selectedCountries.includes(cc));
      });
    }
    if (selectedFilterKeys.length > 0) {
      list = list.filter((p) =>
        postMatchesFilterKeys(
          p.filterKeys as string[] | undefined,
          selectedFilterKeys,
          {
            mainCategories: p.mainCategories as string[] | undefined,
            subCategories: p.subCategories as string[] | undefined,
            subSubCategories: p.subSubCategories as string[] | undefined,
          },
        ),
      );
    }
    return list;
  }, [textFiltered, selectedCountries, selectedFilterKeys]);

  useEffect(() => {
    if (loading || categoriesLoading || communityView !== "home") return;
    restoreCommunityFeedScroll();
  }, [loading, categoriesLoading, communityView, sidebarFiltered.length]);

  const canAccess = canAccessCommunity(user, verified, hasMemberProfile);
  const canEngage = canEngageCommunity(user, verified, hasMemberProfile, memberRestricted);
  const canShare = canShareCommunityContent();
  const canReport = canReportCommunitySpam(user, verified, hasMemberProfile, memberRestricted);
  const canSave = canSaveCommunityContent(user, verified, hasMemberProfile, memberRestricted);
  const canCompose = canEngage;
  const welcomeName = memberUserName || user?.displayName || user?.email?.split("@")[0] || "Guest";
  const profileInitials = (welcomeName || "G").slice(0, 2).toUpperCase();

  const engageHint = communityAccessHint(memberRestricted, user, verified, hasMemberProfile);

  const openCreate = (action: CreatePostModalAction = null) => {
    setCreateAction(action);
    setCreateOpen(true);
  };

  const toggleSavePost = async (postId: string) => {
    if (!canSave || !user) return;
    try {
      const nowSaved = await toggleSavedPost(user.uid, postId, savedPostIds.has(postId));
      setSavedPostIds((prev) => {
        const next = new Set(prev);
        if (nowSaved) next.add(postId);
        else next.delete(postId);
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleHelpfulPost = async (postId: string) => {
    if (!canEngage || !user) return;
    try {
      const nowHelpful = await togglePostHelpful(user.uid, postId, helpfulPostIds.has(postId));
      setHelpfulPostIds((prev) => {
        const next = new Set(prev);
        if (nowHelpful) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likeCount: Math.max(0, Number(p.likeCount ?? 0) + (nowHelpful ? 1 : -1)) }
            : p,
        ),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const reloadPosts = () => {
    lastVisibleDocRef.current = null;
    setPosts([]);
    setRefreshPostsKey((k) => k + 1);
  };

  const handleClearSearch = () => {
    setQInput("");
    setSearch("");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("search");
      return next;
    });
  };

  const applySearchFromInput = (value: string) => {
    const trimmed = value.trim();
    setSearch(trimmed);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (trimmed) {
        next.set("search", trimmed);
      } else {
        next.delete("search");
      }
      return next;
    });
  };
  const showMemberPanels = Boolean(canAccess && communityView !== "home");
  const displayName = memberBio ? `${welcomeName} (${memberBio})` : welcomeName;

  const composerBlock = canCompose ? (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-foreground/15 dark:bg-card">
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-3 dark:bg-slate-900">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-white/15 text-white text-xs font-semibold">{profileInitials}</AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => openCreate()}
          className="flex-1 text-left text-sm text-slate-300 hover:text-white transition-colors py-2"
        >
          Share what&apos;s on your mind
        </button>
      </div>
      <div className="grid grid-cols-4 divide-x divide-slate-200 border-t border-slate-200 dark:divide-foreground/10 dark:border-foreground/10">
        {(
          [
            { action: "category" as const, icon: Tag, label: "Category" },
            { action: "country" as const, icon: Globe, label: "Country" },
            { action: "link" as const, icon: Link2, label: "Link" },
            { action: "photo" as const, icon: ImageIcon, label: "Photo" },
          ] as const
        ).map(({ action, icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => openCreate(action)}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 py-3 text-xs font-medium text-muted-foreground hover:bg-slate-50 hover:text-foreground dark:hover:bg-muted/40 transition-colors"
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-3 dark:border-foreground/15 dark:bg-card">
      <MessageSquarePlus className="h-8 w-8 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-[200px]">
        <p className="font-medium text-sm">Join the conversation</p>
        <p className="text-xs text-muted-foreground">Sign in with a verified member profile to start a post.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!user && (
          <Button size="sm" asChild>
            <Link to="/member/login">Log in</Link>
          </Button>
        )}
        {user && verified && !hasMemberProfile && (
          <Button size="sm" asChild>
            <Link to="/member/setup">Set up profile</Link>
          </Button>
        )}
        {user && !verified && (
          <Button size="sm" variant="outline" asChild>
            <Link to="/member/login">Verify email</Link>
          </Button>
        )}
        {!user && (
          <Button size="sm" variant="outline" asChild>
            <Link to="/member/register">Register</Link>
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100/90 text-foreground dark:bg-background">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6 py-6 lg:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
          <aside className="xl:col-span-3 order-2 xl:order-1">
            <div className="xl:sticky xl:top-20 space-y-4">
              <CommunityMemberSidebar
                welcomeName={welcomeName}
                profileInitials={profileInitials}
                activeView={user ? communityView : "home"}
                onViewChange={setCommunityView}
                notificationUnread={notificationUnread}
                selectedCountries={selectedCountries}
                selectedFilterKeys={selectedFilterKeys}
                categoryDoc={categoryDoc}
                signedIn={Boolean(user)}
                onRemoveCountry={user && hasMemberProfile ? removeCountryFilter : undefined}
                onRemoveFilterKey={user && hasMemberProfile ? removeFilterKey : undefined}
                onClearAllFilters={user && hasMemberProfile ? clearAllFilters : undefined}
              />
              {user && !hasMemberProfile && (
                <Button className="w-full" asChild>
                  <Link to="/member/setup">Create community profile</Link>
                </Button>
              )}
            </div>
          </aside>

          <main className="xl:col-span-6 order-1 xl:order-2 space-y-5">
            {memberRestricted && user && (
              <p className="text-sm text-muted-foreground rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                Your account is currently paused. You have view-only access.
              </p>
            )}

            {(communityView === "home" || communityView === "my-space") && (
              <div className="sticky top-16 z-30 space-y-4 -mx-1 px-1 pb-3 bg-slate-100/95 backdrop-blur-md dark:bg-background/95">
                {composerBlock}
                {communityView === "home" && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-foreground/15 dark:bg-card">
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        applySearchFromInput(qInput);
                      }}
                    >
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={qInput}
                          onChange={(e) => {
                            const value = e.target.value;
                            setQInput(value);
                            if (!value.trim()) {
                              applySearchFromInput("");
                            }
                          }}
                          placeholder="Search here"
                          className="pl-9 pr-10 h-11 bg-slate-50 border-slate-200 dark:bg-muted/30"
                        />
                        {qInput && (
                          <button
                            type="button"
                            onClick={handleClearSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                            aria-label="Clear search"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <Button type="submit" variant="secondary" className="h-11">
                        Search
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {showMemberPanels && communityView !== "home" && (
              <CommunityViewHeader view={communityView} onBack={() => setCommunityView("home")} />
            )}

            {showMemberPanels && user ? (
              <CommunityMemberPanels
                view={communityView}
                categoryDoc={categoryDoc}
                userId={user.uid}
                canEngage={canEngage}
                canSave={canSave}
                canShare={canShare}
                canReport={canReport}
                engageHint={engageHint}
                savedPostIds={savedPostIds}
                helpfulPostIds={helpfulPostIds}
                selectedCountries={selectedCountries}
                selectedFilterKeys={selectedFilterKeys}
                onToggleSave={toggleSavePost}
                onToggleHelpful={toggleHelpfulPost}
                onUnreadChange={setNotificationUnread}
              />
            ) : communityView === "home" ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-2 mb-4 dark:border-foreground/15">
                  <p className="text-sm font-semibold text-foreground">All updates</p>
                  {sidebarFiltered.length > 0 && (
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {sidebarFiltered.length} post{sidebarFiltered.length === 1 ? "" : "s"}
                    </p>
                  )}
                </div>

                {loading || categoriesLoading ? (
                  <p className="text-muted-foreground text-center py-12">Loading…</p>
                ) : sidebarFiltered.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12 rounded-xl border border-dashed border-slate-200 bg-white dark:border-foreground/15 dark:bg-card">
                    No posts match your filters. Try clearing filters or search.
                  </p>
                ) : (
                  <>
                    <ul className="space-y-5">
                      {sidebarFiltered.map((p) => (
                        <li key={p.id}>
                          <PostCard
                            post={p as PostCardPost}
                            rememberFeedScroll
                            categoryDoc={categoryDoc}
                            showAuthorEmail={
                              user && (p as { authorId?: string }).authorId === user.uid ? user.email : null
                            }
                            showActionBar
                            canEngage={canEngage}
                            canShare={canShare}
                            canReport={canReport}
                            canSave={canSave}
                            engageHint={engageHint}
                            saved={savedPostIds.has(p.id)}
                            helpful={helpfulPostIds.has(p.id)}
                            onToggleSave={() => toggleSavePost(p.id)}
                            onToggleHelpful={() => toggleHelpfulPost(p.id)}
                            onEdit={() => {
                              setPostToEdit(p as PostCardPost);
                              setCreateOpen(true);
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                    {hasNextPage && (
                      <div ref={bottomRef} className="py-6 flex items-center justify-center">
                        {loadingMore ? (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            Loading more posts...
                          </div>
                        ) : (
                          <div className="h-2 w-full" />
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : null}
          </main>

          <aside className="xl:col-span-3 order-3">
            <div className="xl:sticky xl:top-20">
              <CommunityFilterSidebar
                categoryDoc={categoryDoc}
                selectedCountries={selectedCountries}
                selectedFilterKeys={selectedFilterKeys}
                onCountriesChange={setSelectedCountries}
                onFilterKeysChange={setSelectedFilterKeys}
              />
            </div>
          </aside>
        </div>
      </div>

      <CreatePostModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setPostToEdit(null);
        }}
        displayName={displayName}
        profileInitials={profileInitials}
        bio={memberAboutMe || memberBio}
        initialAction={createAction}
        onPublished={() => {
          reloadPosts();
          setPostToEdit(null);
        }}
        postToEdit={postToEdit}
      />
    </div>
  );
}

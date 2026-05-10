import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PostCard, type PostCardPost } from "@/components/community/PostCard";
import { useCommunityCategories } from "@/hooks/useCommunityCategories";
import { auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Search, Tag, Globe, Link2, ImageIcon, MessageSquarePlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type TabKey = "all" | "latest";

export default function CommunityFeed() {
  const [searchParams] = useSearchParams();
  const { categoryDoc, categoriesLoading } = useCommunityCategories();
  const [posts, setPosts] = useState<Array<{ id: string; [k: string]: unknown }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [qInput, setQInput] = useState(() => searchParams.get("search") || "");
  const [user, setUser] = useState<import("firebase/auth").User | null>(null);
  const [verified, setVerified] = useState(false);
  const [hasMemberProfile, setHasMemberProfile] = useState(false);
  const [memberUserName, setMemberUserName] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<TabKey>("all");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedMainCategories, setSelectedMainCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await u.reload();
        setVerified(u.emailVerified);
        const m = await getDoc(doc(db, "membersCollection", u.uid));
        setHasMemberProfile(m.exists());
        setMemberUserName(m.exists() ? String(m.data()?.userName ?? "") : null);
      } else {
        setVerified(false);
        setHasMemberProfile(false);
        setMemberUserName(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const q = query(
          collection(db, "postsCollection"),
          where("archived", "==", false),
          orderBy("createdAt", "desc"),
          limit(80),
        );
        const snap = await getDocs(q);
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const q = searchParams.get("search") || "";
    setSearch(q);
    setQInput(q);
  }, [searchParams]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      const c = (p.countries as string[] | undefined) || [];
      c.forEach((x) => set.add(x));
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const textFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return posts;
    return posts.filter(
      (p) =>
        String(p.title).toLowerCase().includes(s) || String(p.text).toLowerCase().includes(s),
    );
  }, [posts, search]);

  const sidebarFiltered = useMemo(() => {
    let list = textFiltered;
    if (selectedCountries.length > 0) {
      list = list.filter((p) => {
        const c = (p.countries as string[] | undefined) || [];
        return c.some((cc) => selectedCountries.includes(cc));
      });
    }
    if (selectedMainCategories.size > 0) {
      list = list.filter((p) => {
        const mains = (p.mainCategories as string[] | undefined) || [];
        return mains.some((m) => selectedMainCategories.has(m));
      });
    }
    if (feedTab === "latest") {
      const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      list = list.filter((p) => {
        const ts = (p.createdAt as { toDate?: () => Date } | undefined)?.toDate?.()?.getTime() ?? 0;
        return ts >= cutoff;
      });
    }
    return list;
  }, [textFiltered, selectedCountries, selectedMainCategories, feedTab]);

  const canCompose = user && verified && hasMemberProfile;
  const welcomeName = memberUserName || user?.displayName || user?.email?.split("@")[0] || "Guest";
  const profileInitials = (welcomeName || "G").slice(0, 2).toUpperCase();

  const toggleCountry = (c: string) => {
    setSelectedCountries((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const toggleMainCategory = (label: string) => {
    setSelectedMainCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-foreground dark:bg-background">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6 py-6 lg:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
          {/* Left — profile summary */}
          <aside className="xl:col-span-3 order-2 xl:order-1">
            <div className="xl:sticky xl:top-20 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-foreground/15 dark:bg-card">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-slate-800 text-lg text-white font-semibold dark:bg-primary">
                      {profileInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Welcome</p>
                    <p className="font-semibold text-lg leading-tight">{welcomeName}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interest(s)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 text-center dark:border-foreground/15 dark:bg-muted/30">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Countries</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        {selectedCountries.length
                          ? selectedCountries.join(", ")
                          : "Use filters to explore by country"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 text-center dark:border-foreground/15 dark:bg-muted/30">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Categories</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        {selectedMainCategories.size > 0
                          ? [...selectedMainCategories].join(", ")
                          : "Filter posts by category →"}
                      </p>
                    </div>
                  </div>
                </div>
                {!user && (
                  <Button variant="outline" className="w-full mt-4" asChild>
                    <Link to="/member/login">Sign in</Link>
                  </Button>
                )}
                {user && !hasMemberProfile && (
                  <Button className="w-full mt-4" asChild>
                    <Link to="/member/setup">Create community profile</Link>
                  </Button>
                )}
              </div>
            </div>
          </aside>

          {/* Center — composer + feed */}
          <main className="xl:col-span-6 order-1 xl:order-2 space-y-5">
            {canCompose ? (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-foreground/15 dark:bg-card">
                <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-3 dark:bg-slate-900">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-white/15 text-white text-xs font-semibold">
                      {profileInitials}
                    </AvatarFallback>
                  </Avatar>
                  <Link
                    to="/community/new"
                    className="flex-1 text-left text-sm text-slate-300 hover:text-white transition-colors py-2"
                  >
                    Share what&apos;s on your mind
                  </Link>
                </div>
                <div className="grid grid-cols-4 divide-x divide-slate-200 border-t border-slate-200 dark:divide-foreground/10 dark:border-foreground/10">
                  {[
                    { to: "/community/new", icon: Tag, label: "Category" },
                    { to: "/community/new", icon: Globe, label: "Country" },
                    { to: "/community/new", icon: Link2, label: "Link" },
                    { to: "/community/new", icon: ImageIcon, label: "Photo" },
                  ].map(({ to, icon: Icon, label }) => (
                    <Link
                      key={label}
                      to={to}
                      className="flex flex-col sm:flex-row items-center justify-center gap-1 py-3 text-xs font-medium text-muted-foreground hover:bg-slate-50 hover:text-foreground dark:hover:bg-muted/40 transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-3 dark:border-foreground/15 dark:bg-card">
                <MessageSquarePlus className="h-8 w-8 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium text-sm">Join the conversation</p>
                  <p className="text-xs text-muted-foreground">
                    Sign in with a verified member profile to start a post.
                  </p>
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
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-foreground/15 dark:bg-card">
              <form
                className="flex gap-2 mb-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(qInput);
                }}
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    placeholder="Search here"
                    className="pl-9 h-11 bg-slate-50 border-slate-200 dark:bg-muted/30"
                  />
                </div>
                <Button type="submit" variant="secondary" className="h-11">
                  Search
                </Button>
              </form>

              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-2 dark:border-foreground/10">
                <div className="flex gap-6">
                  <button
                    type="button"
                    onClick={() => setFeedTab("all")}
                    className={cn(
                      "pb-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      feedTab === "all"
                        ? "border-slate-800 text-foreground dark:border-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    All updates
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedTab("latest")}
                    className={cn(
                      "pb-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      feedTab === "latest"
                        ? "border-slate-800 text-foreground dark:border-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Latest
                  </button>
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {sidebarFiltered.length} post{sidebarFiltered.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {loading || categoriesLoading ? (
              <p className="text-muted-foreground text-center py-12">Loading…</p>
            ) : sidebarFiltered.length === 0 ? (
              <p className="text-muted-foreground text-center py-12 rounded-xl border border-dashed border-slate-200 bg-white dark:border-foreground/15 dark:bg-card">
                No posts match your filters. Try clearing filters or search.
              </p>
            ) : (
              <ul className="space-y-5">
                {sidebarFiltered.map((p) => (
                  <li key={p.id}>
                    <PostCard
                      post={p as PostCardPost}
                      categoryDoc={categoryDoc}
                      showAuthorEmail={
                        user && (p as { authorId?: string }).authorId === user.uid ? user.email : null
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </main>

          {/* Right — filters */}
          <aside className="xl:col-span-3 order-3">
            <div className="xl:sticky xl:top-20 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-foreground/15 dark:bg-card">
                <p className="text-sm font-semibold mb-3">Select country(ies)</p>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {countryOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No countries in posts yet.</p>
                  ) : (
                    countryOptions.map((c) => (
                      <label
                        key={c}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground"
                      >
                        <Checkbox
                          checked={selectedCountries.includes(c)}
                          onCheckedChange={() => toggleCountry(c)}
                        />
                        <span className="leading-tight">{c}</span>
                      </label>
                    ))
                  )}
                </div>
                {selectedCountries.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-8 px-2 text-xs"
                    onClick={() => setSelectedCountries([])}
                  >
                    Clear countries
                  </Button>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-foreground/15 dark:bg-card">
                <p className="text-sm font-semibold mb-3">Categories</p>
                <div className="max-h-[min(60vh,420px)] overflow-y-auto space-y-2 pr-1">
                  {(categoryDoc?.mains ?? []).map((main) => (
                    <label
                      key={main.id}
                      className="flex items-start gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={selectedMainCategories.has(main.label)}
                        onCheckedChange={() => toggleMainCategory(main.label)}
                      />
                      <span className="leading-snug">{main.label}</span>
                    </label>
                  ))}
                </div>
                {selectedMainCategories.size > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 h-8 px-2 text-xs"
                    onClick={() => setSelectedMainCategories(new Set())}
                  >
                    Clear categories
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

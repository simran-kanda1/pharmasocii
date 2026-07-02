import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CategoryPicker,
  emptyCategorySelection,
  selectionToPostFields,
  validateCategorySelection,
  buildFilterKeysFromSelection,
  type CategorySelectionState,
} from "@/components/community/CategoryPicker";
import { useCommunityCategories } from "@/hooks/useCommunityCategories";
import {
  POST_BODY_MAX,
  POST_TITLE_MAX,
  POST_COUNTRIES_MAX,
  validatePostPayload,
  EXTERNAL_LINKS_MAX,
} from "@/lib/community";
import { ArrowLeft } from "lucide-react";
import { CountryMultiSelect } from "@/components/community/CountryMultiSelect";

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function NewCommunityPost() {
  const navigate = useNavigate();
  const { categoryDoc, categoriesLoading } = useCommunityCategories();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [linksRaw, setLinksRaw] = useState("");
  const [catSel, setCatSel] = useState<CategorySelectionState>(emptyCategorySelection());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/member/login", { replace: true });
        return;
      }
      await u.reload();
      if (!u.emailVerified) {
        navigate("/member/login", { replace: true });
        return;
      }
      const memberSnap = await getDoc(doc(db, "membersCollection", u.uid));
      if (!memberSnap.exists()) {
        navigate("/member/setup", { replace: true });
        return;
      }
      const st = memberSnap.data()?.accountStatus;
      if (st === "spam_blocked" || st === "admin_hold") {
        navigate("/community", { replace: true });
        return;
      }
      setReady(true);
    });
    return () => unsub();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const u = auth.currentUser;
    if (!u) return;
    await u.reload();
    if (!u.emailVerified) {
      setError("Verify your email before posting.");
      return;
    }

    const { mainCategories, subCategories, subSubCategories } = selectionToPostFields(categoryDoc, catSel);
    const externalLinks = linksRaw
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, EXTERNAL_LINKS_MAX);

    const catErr = validateCategorySelection(categoryDoc, catSel);
    if (catErr) {
      setError(catErr);
      return;
    }

    const payloadErr = validatePostPayload({
      title,
      text,
      mainCategories,
      subCategories,
      subSubCategories,
      countries,
      externalLinks,
    });
    if (payloadErr) {
      setError(payloadErr);
      return;
    }

    const memberSnap = await getDoc(doc(db, "membersCollection", u.uid));
    const member = memberSnap.exists() ? memberSnap.data() : null;
    const authorUserName = (member?.userName as string) || u.email?.split("@")[0] || "member";
    const authorTagline = (member?.aboutMe as string) || "";

    try {
      setSaving(true);
      let imageStoragePath: string | null = null;
      if (file) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          setError("Image must be JPEG, PNG, or WebP.");
          setSaving(false);
          return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          setError("Image must be 1.5 MB or smaller.");
          setSaving(false);
          return;
        }
        const path = `community/${u.uid}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
        const sref = ref(storage, path);
        await uploadBytes(sref, file);
        await getDownloadURL(sref);
        imageStoragePath = path;
      }

      const filterKeys = buildFilterKeysFromSelection(categoryDoc, catSel);

      await addDoc(collection(db, "postsCollection"), {
        authorId: u.uid,
        authorUserName,
        authorTagline,
        title: title.trim(),
        text,
        mainCategories,
        subCategories,
        subSubCategories,
        countries,
        externalLinks,
        imageStoragePath,
        filterKeys,
        createdAt: serverTimestamp(),
        archived: false,
        spamReportCount: 0,
        commentCount: 0,
        likeCount: 0,
      });
      navigate("/community");
    } catch (err) {
      console.error(err);
      setError("Could not publish. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const { mainCategories: previewMains } = selectionToPostFields(categoryDoc, catSel);
  const canPublish = title.trim().length > 0 && previewMains.length >= 1;

  if (!ready || categoriesLoading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <Button variant="ghost" asChild className="mb-6 gap-2">
        <Link to="/community">
          <ArrowLeft className="w-4 h-4" /> Back to feed
        </Link>
      </Button>
      <h1 className="text-2xl font-bold mb-6">New post</h1>
      <form onSubmit={submit} className="space-y-6">
        <CategoryPicker doc={categoryDoc} value={catSel} onChange={setCatSel} />

        <div className="space-y-2">
          <Label htmlFor="title">Title ({POST_TITLE_MAX} max)</Label>
          <Input
            id="title"
            value={title}
            maxLength={POST_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-foreground/5 border-foreground/10"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="text">Body ({POST_BODY_MAX} max)</Label>
          <Textarea
            id="text"
            value={text}
            maxLength={POST_BODY_MAX}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="bg-foreground/5 border-foreground/10"
            required
          />
          <p className="text-xs text-muted-foreground text-right">{text.length}/{POST_BODY_MAX}</p>
        </div>

        <CountryMultiSelect value={countries} onChange={setCountries} max={POST_COUNTRIES_MAX} />

        <div className="space-y-2">
          <Label htmlFor="links">External links (optional, one per line, max {EXTERNAL_LINKS_MAX})</Label>
          <Textarea
            id="links"
            value={linksRaw}
            onChange={(e) => setLinksRaw(e.target.value)}
            rows={4}
            className="bg-foreground/5 border-foreground/10"
            placeholder="https://…"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="img">Image (optional, max 1.5 MB, JPEG/PNG/WebP)</Label>
          <Input
            id="img"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="bg-foreground/5 border-foreground/10"
          />
        </div>

        {!canPublish && (
          <p className="text-xs text-muted-foreground">Pick at least one category and enter a title to publish.</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving || !canPublish} className="w-full sm:w-auto">
          {saving ? "Publishing…" : "Publish"}
        </Button>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { AdminDetailChrome } from "@/components/admin/community/AdminDetailChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCommunityCategories } from "@/hooks/useCommunityCategories";
import {
  CategoryPicker,
  buildFilterKeysFromSelection,
  postFieldsToCategorySelection,
  selectionToPostFields,
  validateCategorySelection,
  emptyCategorySelection,
  type CategorySelectionState,
} from "@/components/community/CategoryPicker";
import { CountryMultiSelect } from "@/components/community/CountryMultiSelect";
import { POST_COUNTRIES_MAX } from "@/lib/community";
import { loadPostDetail, type AdminPostDetail } from "@/lib/adminCommunityData";

type Props = {
  postId: string;
  onBack: () => void;
  onSaved: () => void;
  backLabel?: string;
};

export function AdminPostEditPage({ postId, onBack, onSaved, backLabel = "Back To Posts" }: Props) {
  const { categoryDoc, categoriesLoading } = useCommunityCategories();
  const [post, setPost] = useState<AdminPostDetail | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [catSel, setCatSel] = useState<CategorySelectionState>(emptyCategorySelection());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const p = await loadPostDetail(postId);
      setPost(p);
      if (p) {
        setTitle(p.title || "");
        setText(p.text || "");
        setCountries(p.countries || []);
      }
    })();
  }, [postId]);

  useEffect(() => {
    if (!categoryDoc || !post) return;
    setCatSel(
      postFieldsToCategorySelection(
        categoryDoc,
        post.mainCategories || [],
        post.subCategories || [],
        post.subSubCategories || [],
      ),
    );
  }, [categoryDoc, post]);

  const submit = async () => {
    if (!categoryDoc || !post) return;
    const catErr = validateCategorySelection(categoryDoc, catSel);
    if (catErr) {
      setMsg(catErr);
      return;
    }
    const { mainCategories, subCategories, subSubCategories } = selectionToPostFields(categoryDoc, catSel);
    const filterKeys = buildFilterKeysFromSelection(categoryDoc, catSel);
    setBusy(true);
    setMsg("");
    try {
      await updateDoc(doc(db, "postsCollection", postId), {
        title: title.trim(),
        text: text.trim(),
        mainCategories,
        subCategories,
        subSubCategories,
        filterKeys,
        countries,
      });
      setMsg("Post updated.");
      onSaved();
    } catch (e) {
      console.error(e);
      setMsg("Could not save post.");
    } finally {
      setBusy(false);
    }
  };

  if (!post) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <AdminDetailChrome title="Edit post" breadcrumb={["Posts", "Edit post"]} onBack={onBack} backLabel={backLabel}>
      <form
        className="p-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3 items-start">
          <Label className="pt-2">Title</Label>
          <div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
            <p className={`text-xs mt-1 ${title.length >= 100 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>{title.length} / 100 characters</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3 items-start">
          <Label className="pt-2">Description</Label>
          <div>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={800} />
            <p className={`text-xs mt-1 ${text.length >= 800 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>{text.length} / 800 characters</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3 items-start">
          <Label className="pt-2">Categories</Label>
          <div className="max-h-[420px] overflow-y-auto rounded-lg border p-3 bg-slate-50/50 dark:bg-muted/20">
            {categoriesLoading || !categoryDoc ? (
              <p className="text-sm text-muted-foreground">Loading categories…</p>
            ) : (
              <CategoryPicker doc={categoryDoc} value={catSel} onChange={setCatSel} />
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3 items-start">
          <Label className="pt-2">Countries</Label>
          <CountryMultiSelect value={countries} onChange={setCountries} max={POST_COUNTRIES_MAX} />
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <Button type="submit" className="w-full md:w-auto" disabled={busy}>
          Update Post
        </Button>
      </form>
    </AdminDetailChrome>
  );
}

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CategoryPicker,
  emptyCategorySelection,
  type CategorySelectionState,
} from "@/components/community/CategoryPicker";
import { CountryMultiSelect } from "@/components/community/CountryMultiSelect";
import { useCommunityCategories } from "@/hooks/useCommunityCategories";
import { POST_BODY_MAX, POST_COUNTRIES_MAX, POST_TITLE_MAX, normalizeExternalLinks } from "@/lib/community";
import { publishCommunityPost, POST_IMAGE_ACCEPT } from "@/lib/publishCommunityPost";
import { Globe, Link2, Send, Tag, ImageIcon, X } from "lucide-react";
import { selectionToPostFields } from "@/components/community/CategoryPicker";

export type CreatePostModalAction = "category" | "country" | "link" | "photo" | null;

type CreatePostModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  profileInitials: string;
  bio?: string;
  initialAction?: CreatePostModalAction;
  onPublished?: () => void;
};

export function CreatePostModal({
  open,
  onOpenChange,
  displayName,
  profileInitials,
  bio,
  initialAction = null,
  onPublished,
}: CreatePostModalProps) {
  const { categoryDoc } = useCommunityCategories();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [showLinkFields, setShowLinkFields] = useState(false);
  const [catSel, setCatSel] = useState<CategorySelectionState>(emptyCategorySelection());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [nested, setNested] = useState<CreatePostModalAction>(null);

  useEffect(() => {
    if (open && initialAction) {
      if (initialAction === "photo") {
        window.setTimeout(() => fileInputRef.current?.click(), 100);
      } else if (initialAction === "link") {
        setShowLinkFields(true);
        setLinks((prev) => (prev.length > 0 ? prev : [""]));
      } else {
        setNested(initialAction);
      }
    }
  }, [open, initialAction]);

  const reset = () => {
    setTitle("");
    setText("");
    setCountries([]);
    setLinks([]);
    setShowLinkFields(false);
    setCatSel(emptyCategorySelection());
    setFile(null);
    setError("");
    setNested(null);
  };

  const closeAll = () => {
    reset();
    onOpenChange(false);
  };

  const { mainCategories: previewMains } = selectionToPostFields(categoryDoc, catSel);
  const canPublish = title.trim().length > 0 && previewMains.length >= 1;

  const submit = async () => {
    setError("");
    const externalLinks = normalizeExternalLinks(links);
    try {
      setSaving(true);
      await publishCommunityPost({
        categoryDoc,
        catSel,
        title,
        text,
        countries,
        externalLinks,
        imageFile: file,
      });
      closeAll();
      onPublished?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : closeAll())}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle>Create a post</DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-slate-800 text-white text-sm">{profileInitials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{displayName}</p>
                {bio ? <p className="text-xs text-muted-foreground line-clamp-1">{bio}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="Title here…"
                value={title}
                maxLength={POST_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-right">
                {title.length}/{POST_TITLE_MAX}
              </p>
            </div>

            <div className="space-y-2">
              <Textarea
                placeholder="Text"
                value={text}
                maxLength={POST_BODY_MAX}
                onChange={(e) => setText(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground text-right">
                {text.length}/{POST_BODY_MAX}
              </p>
            </div>

            {(showLinkFields || links.length > 0) && (
              <div className="space-y-2">
                <Label>Links</Label>
                {links.map((link, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="https://…"
                      value={link}
                      onChange={(e) => {
                        const next = [...links];
                        next[i] = e.target.value;
                        setLinks(next);
                      }}
                    />
                    {links.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLinks((prev) => [...prev, ""])}
                >
                  Add another link
                </Button>
              </div>
            )}

            {file && (
              <p className="text-xs text-muted-foreground">
                Photo: <span className="font-medium text-foreground">{file.name}</span>
                <Button type="button" variant="link" className="h-auto p-0 ml-2 text-xs" onClick={() => setFile(null)}>
                  Remove
                </Button>
              </p>
            )}

            {(previewMains.length > 0 || countries.length > 0) && (
              <div className="text-xs text-muted-foreground space-y-1 rounded-lg border p-3 bg-muted/30">
                {previewMains.length > 0 && <p>Categories: {previewMains.join(", ")}</p>}
                {countries.length > 0 && <p>Countries: {countries.join(", ")}</p>}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={POST_IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={() => setNested("category")}>
                  <Tag className="h-4 w-4" /> Category
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={() => setNested("country")}>
                  <Globe className="h-4 w-4" /> Country
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1"
                  onClick={() => {
                    setShowLinkFields(true);
                    setLinks((prev) => (prev.length > 0 ? prev : [""]));
                  }}
                >
                  <Link2 className="h-4 w-4" /> Link
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4" /> Photo
                </Button>
              </div>
              <Button type="button" size="sm" disabled={!canPublish || saving} onClick={submit} className="gap-1">
                <Send className="h-4 w-4" /> {saving ? "Posting…" : "Post"}
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-[11px] text-muted-foreground leading-snug">
              Main and subcategory selections are limited to keep discussions focused. Max {POST_COUNTRIES_MAX} countries
              per post (optional).
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={nested === "category"} onOpenChange={(v) => !v && setNested(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select categories</DialogTitle>
          </DialogHeader>
          <CategoryPicker doc={categoryDoc} value={catSel} onChange={setCatSel} />
          <Button type="button" onClick={() => setNested(null)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={nested === "country"} onOpenChange={(v) => !v && setNested(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select countries</DialogTitle>
          </DialogHeader>
          <CountryMultiSelect value={countries} onChange={setCountries} max={POST_COUNTRIES_MAX} />
          <Button type="button" onClick={() => setNested(null)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

import React, { useState } from "react";
import { db, storage } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildCategoryDocId } from "@/lib/defaultDirectoryCategories";
import { Loader2, Trash2, X, FolderTree, Info } from "lucide-react";

const PARENT_CATEGORIES = [
  "Business Offerings",
  "Consulting Services",
  "Events",
  "Jobs"
];

export interface CategoryRecord {
  id?: string;
  group: string;
  category: string;
  subcategory: string;
  subSubcategory: string;
  isParent?: boolean;
  status?: string;
  imageUrl?: string;
  metaDescription?: string;
  metaKeywords?: string;
  description?: string;
  subEntries?: any[];
}

export function AdminEditCategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: CategoryRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const isParentCategory = Boolean(
    category.isParent ||
    category.subcategory === "— (Parent Category)" ||
    category.subcategory === "—" ||
    category.subcategory === "-" ||
    !category.subcategory
  );

  const [formData, setFormData] = useState({
    parentCategory: category.group || PARENT_CATEGORIES[0],
    categoryName: category.category || "",
    subcategory: isParentCategory ? "" : (category.subcategory === "-" || category.subcategory === "—" ? "" : category.subcategory || ""),
    subSubcategory: isParentCategory ? "" : (category.subSubcategory === "-" || category.subSubcategory === "—" ? "" : category.subSubcategory || ""),
    status: category.status || "Active",
    metaDescription: category.metaDescription || "",
    metaKeywords: category.metaKeywords || "",
    description: category.description || "",
    imageUrl: category.imageUrl || "",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.categoryName || !formData.parentCategory) {
      setError("Category Name and Parent Category are required.");
      return;
    }

    setLoading(true);

    try {
      const isSub = !isParentCategory && formData.subcategory && formData.subcategory.trim() !== "" && formData.subcategory.trim() !== "-";
      const canonicalDocId = buildCategoryDocId(
        formData.parentCategory,
        formData.categoryName,
        isSub ? formData.subcategory.trim() : undefined
      );
      const docId = category.id || canonicalDocId;
      const docRef = doc(db, "categoriesCollection", docId);

      // If the category was renamed or moved to another parent, tombstone the old entry
      const oldIsSub = !isParentCategory && category.subcategory && category.subcategory.trim() !== "" && category.subcategory.trim() !== "-" && category.subcategory.trim() !== "—";
      const oldCanonicalDocId = buildCategoryDocId(
        category.group,
        category.category,
        oldIsSub ? category.subcategory.trim() : undefined
      );
      const isRenamed = oldCanonicalDocId !== canonicalDocId;

      if (isRenamed) {
        const oldDocId = category.id || oldCanonicalDocId;
        const tombstonePayload = {
          group: category.group,
          parentCategory: category.group,
          category: category.category,
          categoryName: category.category,
          subcategory: isParentCategory ? "" : (category.subcategory === "-" || category.subcategory === "—" ? "" : (category.subcategory || "")),
          subSubcategory: isParentCategory ? "" : (category.subSubcategory === "-" || category.subSubcategory === "—" ? "" : (category.subSubcategory || "")),
          status: "Inactive",
          isDeleted: true,
          deleted: true,
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, "categoriesCollection", oldDocId), tombstonePayload, { merge: true }).catch(() => {});
        if (oldCanonicalDocId !== oldDocId) {
          await setDoc(doc(db, "categoriesCollection", oldCanonicalDocId), tombstonePayload, { merge: true }).catch(() => {});
        }
        await setDoc(doc(db, "categoriesCollection", `${oldCanonicalDocId}_all`), tombstonePayload, { merge: true }).catch(() => {});

        // If a parent category was renamed, also migrate its child subcategories
        if (isParentCategory && Array.isArray(category.subEntries) && category.subEntries.length > 0) {
          for (const sub of category.subEntries) {
            const subLabel = typeof sub === "string" ? sub : sub?.label;
            if (!subLabel) continue;
            const subSubs = typeof sub !== "string" && Array.isArray(sub?.subSubcategories)
              ? sub.subSubcategories.join(", ")
              : "";

            // Tombstone old sub doc
            const oldSubId = buildCategoryDocId(category.group, category.category, subLabel);
            await setDoc(doc(db, "categoriesCollection", oldSubId), {
              ...tombstonePayload,
              subcategory: subLabel,
              subSubcategory: subSubs,
            }, { merge: true }).catch(() => {});

            // Create new sub doc under new category name
            const newSubId = buildCategoryDocId(formData.parentCategory, formData.categoryName, subLabel);
            await setDoc(doc(db, "categoriesCollection", newSubId), {
              group: formData.parentCategory,
              parentCategory: formData.parentCategory,
              category: formData.categoryName,
              categoryName: formData.categoryName,
              subcategory: subLabel,
              subSubcategory: subSubs,
              status: formData.status,
              isDeleted: false,
              deleted: false,
              updatedAt: serverTimestamp(),
            }, { merge: true }).catch(() => {});
          }
        }
      }

      let finalImageUrl = formData.imageUrl;

      if (imageFile) {
        const storageRef = ref(storage, `categories/${docId}/featured.png`);
        await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(storageRef);
      }

      const savePayload = {
        group: formData.parentCategory,
        category: formData.categoryName,
        subcategory: isParentCategory ? "" : (formData.subcategory || "-"),
        subSubcategory: isParentCategory ? "" : (formData.subSubcategory || "-"),
        parentCategory: formData.parentCategory,
        categoryName: formData.categoryName,
        status: formData.status,
        isDeleted: false,
        deleted: false,
        metaDescription: formData.metaDescription,
        metaKeywords: formData.metaKeywords,
        description: formData.description,
        imageUrl: finalImageUrl,
        updatedAt: serverTimestamp(),
      };

      await setDoc(docRef, savePayload, { merge: true });

      if (canonicalDocId !== docId) {
        await setDoc(doc(db, "categoriesCollection", canonicalDocId), savePayload, { merge: true }).catch(() => {});
      }

      // If active, neutralize any stale legacy tombstone with _all suffix
      if (formData.status !== "Inactive") {
        const legacyTombstoneId = `${canonicalDocId}_all`;
        await setDoc(
          doc(db, "categoriesCollection", legacyTombstoneId),
          {
            status: "Active",
            isDeleted: false,
            deleted: false,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }

      onSaved();
    } catch (err: any) {
      console.error("Error saving category:", err);
      setError(err.message || "An error occurred while updating the category.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const isSub = !isParentCategory && formData.subcategory && formData.subcategory !== "-" && formData.subcategory !== "—";
    const displayName = isParentCategory
      ? formData.categoryName
      : isSub
      ? `${formData.categoryName} → ${formData.subcategory}`
      : formData.categoryName;

    const confirmMsg = isParentCategory
      ? `Are you sure you want to delete the entire category "${formData.categoryName}" and all its subcategories from ${formData.parentCategory}? This will permanently remove it from the directory.`
      : `Are you sure you want to delete "${displayName}" from ${formData.parentCategory}?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setDeleting(true);
    try {
      const canonicalDocId = buildCategoryDocId(
        formData.parentCategory,
        formData.categoryName,
        isSub ? formData.subcategory : undefined
      );
      const docId = category.id || canonicalDocId;

      const deletePayload = {
        group: formData.parentCategory,
        parentCategory: formData.parentCategory,
        category: formData.categoryName,
        categoryName: formData.categoryName,
        subcategory: isParentCategory ? "" : (formData.subcategory === "-" || formData.subcategory === "—" ? "" : (formData.subcategory || "")),
        subSubcategory: "",
        status: "Inactive",
        isDeleted: true,
        deleted: true,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "categoriesCollection", docId), deletePayload, { merge: true });
      if (canonicalDocId !== docId) {
        await setDoc(doc(db, "categoriesCollection", canonicalDocId), deletePayload, { merge: true }).catch(() => {});
      }

      if (isParentCategory) {
        await setDoc(doc(db, "categoriesCollection", `${canonicalDocId}_all`), deletePayload, { merge: true }).catch(() => {});
        if (Array.isArray(category.subEntries) && category.subEntries.length > 0) {
          for (const sub of category.subEntries) {
            const subLabel = typeof sub === "string" ? sub : sub?.label;
            if (!subLabel) continue;
            const subCanonicalId = buildCategoryDocId(formData.parentCategory, formData.categoryName, subLabel);
            await setDoc(
              doc(db, "categoriesCollection", subCanonicalId),
              { ...deletePayload, subcategory: subLabel, subSubcategory: "" },
              { merge: true }
            ).catch(() => {});
          }
        }
      }

      onSaved();
    } catch (err: any) {
      console.error("Error deleting category:", err);
      setError(err.message || "Failed to delete category.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 pb-3 border-b">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              {isParentCategory ? "Edit Parent Category" : "Edit Subcategory"}
            </h2>
            {isParentCategory && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Top-Level Category
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isParentCategory
              ? "Update category name, parent group, status, featured image, and SEO properties."
              : "Update subcategory properties, nested terms, and featured image."}
          </p>
        </div>

        {isParentCategory && (
          <div className="mb-4 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs text-emerald-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950">Top-Level Category Controls</p>
              <p className="text-emerald-800 mt-0.5">
                Setting this category to <span className="font-medium">Inactive</span> will hide it and all of its subcategories from the public directory. Deleting it will remove the entire category from the catalog.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Group / Parent:</Label>
            <select
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
              value={formData.parentCategory}
              onChange={(e) => handleChange("parentCategory", e.target.value)}
            >
              {PARENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Category Name:</Label>
            <Input
              required
              value={formData.categoryName}
              onChange={(e) => handleChange("categoryName", e.target.value)}
              className="text-sm font-medium"
            />
          </div>

          {!isParentCategory ? (
            <>
              <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                <Label className="text-slate-700 font-medium">Sub Category:</Label>
                <div>
                  <Input
                    placeholder="e.g. Equipment (or multiple separated by commas)"
                    value={formData.subcategory}
                    onChange={(e) => handleChange("subcategory", e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-0.5">Separate multiple subcategories with commas</p>
                </div>
              </div>

              <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                <Label className="text-slate-700 font-medium">Sub Sub Categories:</Label>
                <div>
                  <Input
                    placeholder="e.g. Analytics, Bioassays (separated by commas)"
                    value={formData.subSubcategory}
                    onChange={(e) => handleChange("subSubcategory", e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-0.5">Nested under subcategory (separate with commas)</p>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-[160px_1fr] items-start gap-3">
              <Label className="text-slate-700 font-medium mt-1 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-slate-500" />
                Subcategories:
              </Label>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 max-h-28 overflow-y-auto leading-relaxed">
                {Array.isArray(category.subEntries) && category.subEntries.length > 0 ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-600 mb-1">
                      {category.subEntries.length} child subcategor{category.subEntries.length === 1 ? "y" : "ies"}:
                    </p>
                    <p className="text-slate-600">
                      {category.subEntries
                        .map((s: any) => (typeof s === "string" ? s : s?.label))
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">No subcategories currently assigned under this category</span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Status:</Label>
            <select
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
              value={formData.status}
              onChange={(e) => handleChange("status", e.target.value)}
            >
              <option value="Active">Active (Visible in Directory)</option>
              <option value="Inactive">Inactive (Hidden from Directory)</option>
            </select>
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Featured Image:</Label>
            <div className="space-y-2">
              {formData.imageUrl && (
                <div className="flex items-center gap-3">
                  <img src={formData.imageUrl} alt="Thumbnail" className="w-12 h-10 object-cover rounded border" />
                  <span className="text-xs text-slate-500 truncate max-w-[250px]">{formData.imageUrl}</span>
                </div>
              )}
              <Input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Meta Description:</Label>
            <Input
              value={formData.metaDescription}
              onChange={(e) => handleChange("metaDescription", e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-[160px_1fr] items-start gap-3 pt-2">
            <Label className="text-slate-700 font-medium mt-2">Description:</Label>
            <textarea
              className="w-full h-24 p-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4 mt-6">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || loading}
              className="bg-rose-600 hover:bg-rose-700 text-white text-sm"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {isParentCategory ? "Delete Entire Category" : "Delete Category"}
            </Button>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

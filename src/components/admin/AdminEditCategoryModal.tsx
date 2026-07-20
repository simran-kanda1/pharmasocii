import React, { useState } from "react";
import { db, storage } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, X } from "lucide-react";

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
  status?: string;
  imageUrl?: string;
  metaDescription?: string;
  metaKeywords?: string;
  description?: string;
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

  const [formData, setFormData] = useState({
    parentCategory: category.group || PARENT_CATEGORIES[0],
    categoryName: category.category || "",
    subcategory: category.subcategory === "-" ? "" : category.subcategory || "",
    subSubcategory: category.subSubcategory === "-" ? "" : category.subSubcategory || "",
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
      const docId = category.id || `${formData.parentCategory}_${formData.categoryName}_${formData.subcategory || "none"}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const docRef = doc(db, "categoriesCollection", docId);

      let finalImageUrl = formData.imageUrl;

      if (imageFile) {
        const storageRef = ref(storage, `categories/${docId}/featured.png`);
        await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(storageRef);
      }

      await setDoc(docRef, {
        group: formData.parentCategory,
        category: formData.categoryName,
        subcategory: formData.subcategory || "-",
        subSubcategory: formData.subSubcategory || "-",
        parentCategory: formData.parentCategory,
        categoryName: formData.categoryName,
        status: formData.status,
        metaDescription: formData.metaDescription,
        metaKeywords: formData.metaKeywords,
        description: formData.description,
        imageUrl: finalImageUrl,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      onSaved();
    } catch (err: any) {
      console.error("Error saving category:", err);
      setError(err.message || "An error occurred while updating the category.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete category "${formData.categoryName}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      if (category.id) {
        await deleteDoc(doc(db, "categoriesCollection", category.id));
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
          <h2 className="text-xl font-bold text-slate-900">Edit Category</h2>
          <p className="text-sm text-slate-500 mt-1">Update category properties and featured image</p>
        </div>

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
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Sub Category:</Label>
            <Input
              placeholder="e.g. Equipment (or - if none)"
              value={formData.subcategory}
              onChange={(e) => handleChange("subcategory", e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Sub Sub Category:</Label>
            <Input
              placeholder="e.g. Analytics (or - if none)"
              value={formData.subSubcategory}
              onChange={(e) => handleChange("subSubcategory", e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Status:</Label>
            <select
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
              value={formData.status}
              onChange={(e) => handleChange("status", e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
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
            {category.id ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || loading}
                className="bg-rose-600 hover:bg-rose-700 text-white text-sm"
              >
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete Category
              </Button>
            ) : <div />}

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

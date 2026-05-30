import React, { useState } from "react";
import { db, storage } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const PARENT_CATEGORIES = [
  "Business Offerings",
  "Consulting Services",
  "Events",
  "Jobs"
];

export function AdminAddCategory({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    metaDescription: "",
    metaKeywords: "",
    categoryName: "",
    parentCategory: PARENT_CATEGORIES[0],
    description: "",
    status: "Active",
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
      // 1. Create the document in Firestore
      const docRef = await addDoc(collection(db, "categoriesCollection"), {
        ...formData,
        imageUrl: "", // We will update this after upload
        createdAt: new Date(),
      });

      // 2. Upload the featured image if selected
      if (imageFile) {
        const storageRef = ref(storage, `categories/${docRef.id}/featured.png`);
        await uploadBytes(storageRef, imageFile);
        const imageUrl = await getDownloadURL(storageRef);
        
        // Update document with the image URL
        // We use dynamic import for updateDoc to avoid having to import it at the top if not needed,
        // but let's just use it properly.
        const { updateDoc, doc } = await import("firebase/firestore");
        await updateDoc(doc(db, "categoriesCollection", docRef.id), { imageUrl });
      }

      onSuccess();
    } catch (err: any) {
      console.error("Error creating category:", err);
      setError(err.message || "An error occurred while saving the category.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-full">
      <div className="bg-white rounded-lg border shadow-sm max-w-5xl mx-auto p-6 my-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">Add New Category</h2>
          <div className="text-sm text-slate-500">
            Home / Categories / Add Category
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-md border border-slate-100 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-800 mb-4 pb-2 border-b">Fill Category Details</h3>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Meta Description :</Label>
              <div>
                <Input 
                  placeholder="Enter Meta Description" 
                  value={formData.metaDescription} 
                  onChange={(e) => handleChange("metaDescription", e.target.value)} 
                  maxLength={160}
                />
                <p className="text-xs text-right text-slate-400 mt-1">({formData.metaDescription.length}/160 characters)</p>
              </div>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Meta Keywords :</Label>
              <Input 
                placeholder="Enter Meta Keywords" 
                value={formData.metaKeywords} 
                onChange={(e) => handleChange("metaKeywords", e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Category Name :</Label>
              <Input 
                required 
                placeholder="Enter Category Name" 
                value={formData.categoryName} 
                onChange={(e) => handleChange("categoryName", e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Parent Category :</Label>
              <select
                className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={formData.parentCategory}
                onChange={(e) => handleChange("parentCategory", e.target.value)}
              >
                <option value="" disabled>Choose Category</option>
                {PARENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Featured Image :</Label>
              <div className="flex items-center gap-4 border border-slate-300 rounded-md p-1 bg-white">
                <label className="flex items-center justify-center px-4 py-1.5 bg-slate-100 border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors shrink-0">
                  <span className="text-sm font-medium text-slate-700">Choose File</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                <span className="text-sm text-slate-500 px-2 truncate">
                  {imageFile ? imageFile.name : "No file chosen"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-start gap-4">
              <Label className="text-slate-600 font-medium mt-3">Description :</Label>
              <textarea 
                className="w-full h-40 p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4 border-t pt-6">
              <Label className="text-slate-600 font-medium">Status :</Label>
              <select
                className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4 pt-4">
              <div></div>
              <div className="flex gap-4">
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit
                </Button>
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}

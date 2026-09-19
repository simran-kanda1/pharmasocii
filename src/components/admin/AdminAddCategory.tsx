import React, { useState, useMemo } from "react";
import { db, storage } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { serverTimestamp, doc, setDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDirectoryCategories } from "@/hooks/useDirectoryCategories";
import {
  Loader2,
  Plus,
  Trash2,
  X,
  FolderPlus,
  FolderTree,
  Tag,
  Layers,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  ChevronRight,
  Info,
  ListPlus
} from "lucide-react";

const STANDARD_GROUPS = [
  "Business Offerings",
  "Consulting Services",
  "Events",
  "Jobs"
];

interface SubcategoryDraft {
  id: string;
  name: string;
  subSubcategories: string[];
  subSubInput: string;
}

export function AdminAddCategory({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const {
    allBusinessCategories,
    allConsultingCategories,
    allEventsCategories,
    allJobsCategories,
    getCategoriesForGroup,
  } = useDirectoryCategories();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Mode: "new" (new category) vs "existing" (add subcats to existing category)
  const [mode, setMode] = useState<"new" | "existing">("new");

  // Group selection
  const [selectedGroup, setSelectedGroup] = useState(STANDARD_GROUPS[0]);
  const [customGroup, setCustomGroup] = useState("");
  const isCustomGroup = selectedGroup === "CUSTOM";
  const activeGroupName = isCustomGroup ? customGroup.trim() : selectedGroup;

  // Existing category selection (when mode === "existing")
  const [selectedExistingCategory, setSelectedExistingCategory] = useState("");

  // Category Details
  const [categoryName, setCategoryName] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Subcategories & Sub-Subcategories Draft Tree
  const [subcategories, setSubcategories] = useState<SubcategoryDraft[]>([
    { id: "sub_1", name: "", subSubcategories: [], subSubInput: "" },
  ]);

  // Bulk add modal/input state
  const [showBulkSubModal, setShowBulkSubModal] = useState(false);
  const [bulkSubText, setBulkSubText] = useState("");

  // Get available existing categories for the selected group
  const existingCategoriesInGroup = useMemo(() => {
    const dict = getCategoriesForGroup(activeGroupName);
    if (!dict) return [];
    return Object.keys(dict).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [activeGroupName, getCategoriesForGroup, allBusinessCategories, allConsultingCategories, allEventsCategories, allJobsCategories]);

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview("");
    }
  };

  // Subcategory manipulation
  const handleAddSubcategory = () => {
    setSubcategories((prev) => [
      ...prev,
      {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: "",
        subSubcategories: [],
        subSubInput: "",
      },
    ]);
  };

  const handleRemoveSubcategory = (id: string) => {
    setSubcategories((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubNameChange = (id: string, name: string) => {
    setSubcategories((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );
  };

  const handleSubSubInputChange = (id: string, subSubInput: string) => {
    setSubcategories((prev) =>
      prev.map((s) => (s.id === id ? { ...s, subSubInput } : s))
    );
  };

  const handleAddSubSubcategory = (id: string) => {
    setSubcategories((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const raw = (s.subSubInput || "").trim();
        if (!raw) return s;

        // Support comma separation
        const newItems = raw
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

        const existingSet = new Set(s.subSubcategories.map((x) => x.toLowerCase()));
        const uniqueToAdd = newItems.filter((item) => !existingSet.has(item.toLowerCase()));

        return {
          ...s,
          subSubcategories: [...s.subSubcategories, ...uniqueToAdd],
          subSubInput: "",
        };
      })
    );
  };

  const handleRemoveSubSubcategory = (subId: string, subSubItem: string) => {
    setSubcategories((prev) =>
      prev.map((s) =>
        s.id === subId
          ? {
              ...s,
              subSubcategories: s.subSubcategories.filter((x) => x !== subSubItem),
            }
          : s
      )
    );
  };

  const handleBulkAddSubcategories = () => {
    if (!bulkSubText.trim()) {
      setShowBulkSubModal(false);
      return;
    }
    const lines = bulkSubText
      .split(/[\n,]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const newDrafts: SubcategoryDraft[] = lines.map((name) => ({
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      subSubcategories: [],
      subSubInput: "",
    }));

    // Filter out initial empty draft if it exists
    setSubcategories((prev) => {
      const filtered = prev.filter((p) => p.name.trim() !== "");
      return [...filtered, ...newDrafts];
    });

    setBulkSubText("");
    setShowBulkSubModal(false);
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const targetGroupName = activeGroupName;
    const finalCategoryName = mode === "new" ? categoryName.trim() : selectedExistingCategory.trim();

    if (!targetGroupName) {
      setError("Please select or enter a valid Group.");
      return;
    }

    if (!finalCategoryName) {
      setError(
        mode === "new"
          ? "Category Name is required."
          : "Please select an existing Category."
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Upload Featured Image if selected
      let uploadedImageUrl = "";
      if (imageFile) {
        const cleanName = finalCategoryName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        const storageRef = ref(storage, `categories/${cleanName}_${Date.now()}/featured.png`);
        await uploadBytes(storageRef, imageFile);
        uploadedImageUrl = await getDownloadURL(storageRef);
      }

      // 2. Prepare Subcategory Entries
      const validSubcategories = subcategories.filter((s) => s.name.trim().length > 0);

      const baseDocData: Record<string, any> = {
        group: targetGroupName,
        parentCategory: targetGroupName,
        category: finalCategoryName,
        categoryName: finalCategoryName,
        status,
        metaDescription: metaDescription.trim(),
        metaKeywords: metaKeywords.trim(),
        description: description.trim(),
        imageUrl: uploadedImageUrl || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (validSubcategories.length === 0) {
        // Create 1 base category document without subcategories
        const safeId = `cat_${targetGroupName}_${finalCategoryName}`
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .toLowerCase();

        await setDoc(
          doc(db, "categoriesCollection", safeId),
          {
            ...baseDocData,
            subcategory: "-",
            subSubcategory: "-",
          },
          { merge: true }
        );
      } else {
        // Save each subcategory with its explicit sub-subcategories list
        const savePromises = validSubcategories.map(async (sub) => {
          const subName = sub.name.trim();
          const subSubStr =
            sub.subSubcategories.length > 0 ? sub.subSubcategories.join(", ") : "-";

          const safeId = `cat_${targetGroupName}_${finalCategoryName}_${subName}`
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .toLowerCase();

          return setDoc(
            doc(db, "categoriesCollection", safeId),
            {
              ...baseDocData,
              subcategory: subName,
              subSubcategory: subSubStr,
            },
            { merge: true }
          );
        });

        await Promise.all(savePromises);
      }

      onSuccess();
    } catch (err: any) {
      console.error("Error creating category hierarchy:", err);
      setError(err.message || "An error occurred while saving the categories.");
    } finally {
      setLoading(false);
    }
  };

  const finalEffectiveCategory = mode === "new" ? categoryName.trim() : selectedExistingCategory.trim();
  const validSubcount = subcategories.filter((s) => s.name.trim().length > 0).length;
  const totalSubSubcount = subcategories.reduce((acc, s) => acc + s.subSubcategories.length, 0);

  return (
    <div className="bg-slate-50 min-h-full py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
              <span>Admin</span>
              <ChevronRight className="w-3 h-3" />
              <span>Categories</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-emerald-700 font-semibold">Hierarchy Builder</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <FolderTree className="w-6 h-6 text-emerald-600" />
              Add Category & Subcategories
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Build your complete category taxonomy: Group &rarr; Category &rarr; Subcategories &rarr; Sub-Subcategories all at once.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button variant="outline" onClick={onCancel} disabled={loading} className="text-slate-600">
              Cancel
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3">
            <Info className="w-5 h-5 text-rose-500 shrink-0" />
            <div className="text-sm">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Hierarchy & Form Builder */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Step 1: Group & Category Target */}
              <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                        1
                      </span>
                      <CardTitle className="text-base text-slate-900">
                        Choose Group & Category
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-slate-600 bg-white border-slate-200">
                      Taxonomy Level 1 & 2
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  {/* Group selection */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium flex items-center justify-between">
                      <span>Target Group (Parent Directory) <span className="text-rose-500">*</span></span>
                      <span className="text-xs text-slate-400">e.g. Business Offerings, Consulting, Events, Jobs</span>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {STANDARD_GROUPS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setSelectedGroup(g);
                            setSelectedExistingCategory("");
                          }}
                          className={`p-2.5 text-xs sm:text-sm font-medium rounded-lg border text-center transition-all ${
                            selectedGroup === g
                              ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-1 ring-emerald-400"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom group input if selected */}
                  {isCustomGroup && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-slate-700 font-medium">
                        Custom Group Name <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        placeholder="Enter custom group name"
                        value={customGroup}
                        onChange={(e) => setCustomGroup(e.target.value)}
                        className="bg-white border-slate-300 focus-visible:ring-emerald-500"
                        required
                      />
                    </div>
                  )}

                  {/* Mode Toggle: New vs Existing Category */}
                  <div className="pt-3 border-t border-slate-100">
                    <Label className="text-slate-700 font-medium mb-2.5 block">
                      Category Action <span className="text-rose-500">*</span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          mode === "new"
                            ? "bg-emerald-50/60 border-emerald-500 ring-1 ring-emerald-400/80"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="categoryMode"
                          checked={mode === "new"}
                          onChange={() => setMode("new")}
                          className="mt-1 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            Create New Main Category
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Define a brand new category and its subcategories
                          </div>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          mode === "existing"
                            ? "bg-emerald-50/60 border-emerald-500 ring-1 ring-emerald-400/80"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="categoryMode"
                          checked={mode === "existing"}
                          onChange={() => setMode("existing")}
                          className="mt-1 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            Add to Existing Category
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Append new subcategories to an existing category
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Category Name Input or Selection */}
                  {mode === "new" ? (
                    <div className="space-y-2 pt-2">
                      <Label className="text-slate-700 font-medium">
                        New Category Name <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        required
                        placeholder="e.g. Automation & Process Technologies, Analytical Laboratories..."
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        className="bg-white border-slate-300 focus-visible:ring-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      <Label className="text-slate-700 font-medium">
                        Select Existing Category in {activeGroupName} <span className="text-rose-500">*</span>
                      </Label>
                      {existingCategoriesInGroup.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                          No existing categories found in this group yet. Switch to "Create New Main Category" above.
                        </div>
                      ) : (
                        <select
                          required
                          value={selectedExistingCategory}
                          onChange={(e) => setSelectedExistingCategory(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                        >
                          <option value="" disabled>
                            -- Choose an existing category --
                          </option>
                          {existingCategoriesInGroup.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 2: Interactive Subcategories & Sub-Subcategories Builder */}
              <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                        2
                      </span>
                      <div>
                        <CardTitle className="text-base text-slate-900">
                          Subcategories & Sub-Subcategories
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Add multiple subcategories and attach specific sub-subcategories to each all in one go.
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBulkSubModal(true)}
                        className="text-xs border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        <ListPlus className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        Bulk Add
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddSubcategory}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Subcategory
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {subcategories.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-medium text-slate-600">No subcategories defined</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        This category will be saved as a top-level category without nested subcategories, or click below to add subcategories.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddSubcategory}
                        className="mt-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Subcategory
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {subcategories.map((sub, index) => (
                        <div
                          key={sub.id}
                          className="bg-slate-50/70 border border-slate-200 rounded-xl p-4.5 space-y-4 relative group/sub transition-all hover:border-emerald-300 hover:bg-slate-50"
                        >
                          {/* Subcategory Header & Name */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 text-xs font-semibold px-2 py-0.5 shrink-0">
                                Subcategory #{index + 1}
                              </Badge>
                              <Input
                                placeholder={`e.g. Equipment, Testing, Consulting...`}
                                value={sub.name}
                                onChange={(e) => handleSubNameChange(sub.id, e.target.value)}
                                className="bg-white border-slate-300 focus-visible:ring-emerald-500 font-medium text-slate-800 text-sm h-9"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSubcategory(sub.id)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 h-8 w-8 rounded-lg shrink-0"
                              title="Delete subcategory"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Nested Sub-Subcategories Section */}
                          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                                Sub-Subcategories for "{sub.name.trim() || `Subcategory #${index + 1}`}"
                              </span>
                              <span className="text-slate-400">
                                {sub.subSubcategories.length} {sub.subSubcategories.length === 1 ? "item" : "items"}
                              </span>
                            </div>

                            {/* Tag Chips for Existing Sub-Subs */}
                            {sub.subSubcategories.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {sub.subSubcategories.map((item) => (
                                  <span
                                    key={item}
                                    className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-1 rounded-md font-medium"
                                  >
                                    {item}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSubSubcategory(sub.id, item)}
                                      className="text-emerald-500 hover:text-rose-600 ml-0.5 rounded-full hover:bg-emerald-100 p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Add Sub-Subcategory Input */}
                            <div className="flex items-center gap-2 pt-1">
                              <Input
                                placeholder="Type sub-subcategory and press Enter or comma (e.g. Analytics, Bioassays)"
                                value={sub.subSubInput}
                                onChange={(e) => handleSubSubInputChange(sub.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === ",") {
                                    e.preventDefault();
                                    handleAddSubSubcategory(sub.id);
                                  }
                                }}
                                className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 text-xs h-8"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddSubSubcategory(sub.id)}
                                disabled={!sub.subSubInput?.trim()}
                                className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add
                              </Button>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Tip: You can paste a comma-separated list into the field above to add multiple at once.
                            </p>
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddSubcategory}
                        className="w-full py-2.5 border-dashed border-slate-300 text-slate-600 hover:text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50/50 text-xs font-medium"
                      >
                        <Plus className="w-4 h-4 mr-1.5 text-emerald-600" />
                        Add Another Subcategory
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 3: SEO, Metadata & Featured Image */}
              <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <CardTitle className="text-base text-slate-900">
                      Metadata, Image & Settings
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {/* Meta Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-700 font-medium text-xs">Meta Description</Label>
                      <span className={`text-[11px] ${metaDescription.length >= 160 ? "text-rose-500 font-bold" : "text-slate-400"}`}>
                        {metaDescription.length}/160 characters
                      </span>
                    </div>
                    <Input
                      placeholder="Brief summary for search engine results..."
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      maxLength={160}
                      className="bg-white border-slate-300 text-xs"
                    />
                  </div>

                  {/* Meta Keywords */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium text-xs">Meta Keywords</Label>
                    <Input
                      placeholder="e.g. pharma, lab equipment, gmp, analytics"
                      value={metaKeywords}
                      onChange={(e) => setMetaKeywords(e.target.value)}
                      className="bg-white border-slate-300 text-xs"
                    />
                  </div>

                  {/* Detailed Description */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium text-xs">Category Description</Label>
                    <textarea
                      placeholder="Detailed overview of this category..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                    />
                  </div>

                  {/* Featured Image Upload */}
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-slate-700 font-medium text-xs">Featured Image</Label>
                    <div className="flex items-center gap-4">
                      {imagePreview ? (
                        <div className="relative group w-20 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={removeImage}
                            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-16 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          id="category-image"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="category-image"
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer shadow-2xs"
                        >
                          {imageFile ? "Change Image" : "Choose Image File"}
                        </label>
                        <p className="text-[11px] text-slate-400 mt-1">
                          PNG, JPG, or WEBP up to 5MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-slate-700 font-medium text-xs">Status</Label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Active">Active (Visible in Directory)</option>
                      <option value="Inactive">Inactive (Hidden)</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Live Hierarchy Preview & Submit Action */}
            <div className="space-y-6">
              {/* Sticky Summary & Preview Card */}
              <div className="sticky top-6 space-y-6">
                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-emerald-800 text-white pb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-300" />
                      <CardTitle className="text-sm font-bold text-white tracking-wide uppercase">
                        Live Hierarchy Preview
                      </CardTitle>
                    </div>
                    <CardDescription className="text-emerald-100/80 text-xs">
                      Visual structure that will be published
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    {/* Visual Tree */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 font-mono text-xs space-y-3">
                      {/* Group */}
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shrink-0"></span>
                        <span className="truncate">{activeGroupName || "Select a group"}</span>
                      </div>

                      {/* Main Category */}
                      <div className="pl-4 border-l-2 border-slate-200 ml-1.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                          <FolderPlus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">{finalEffectiveCategory || "Enter category name"}</span>
                        </div>

                        {/* Subcategories */}
                        {validSubcount === 0 ? (
                          <div className="pl-4 text-[11px] text-slate-400 italic">
                            (No subcategories - root category only)
                          </div>
                        ) : (
                          subcategories
                            .filter((s) => s.name.trim().length > 0)
                            .map((s) => (
                              <div key={s.id} className="pl-4 border-l-2 border-slate-200 ml-1 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                  <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{s.name.trim()}</span>
                                </div>

                                {/* Sub-Subcategories */}
                                {s.subSubcategories.length > 0 && (
                                  <div className="pl-4 border-l-2 border-emerald-200 ml-1 flex flex-wrap gap-1">
                                    {s.subSubcategories.map((ss) => (
                                      <span
                                        key={ss}
                                        className="inline-block bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]"
                                      >
                                        {ss}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-center pt-2">
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="text-base font-bold text-slate-800">{validSubcount}</div>
                        <div className="text-[11px] text-slate-500">Subcategories</div>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="text-base font-bold text-slate-800">{totalSubSubcount}</div>
                        <div className="text-[11px] text-slate-500">Sub-Subcategories</div>
                      </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="pt-3 border-t border-slate-100 space-y-2.5">
                      <Button
                        type="submit"
                        disabled={loading || !activeGroupName || !finalEffectiveCategory}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 h-auto text-sm shadow-sm"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving Category Hierarchy…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Save All to Firestore
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={loading}
                        className="w-full text-xs text-slate-600"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Bulk Add Subcategories Modal */}
      {showBulkSubModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-emerald-600" />
                Bulk Add Subcategories
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkSubModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">
                Paste subcategory names separated by newlines or commas:
              </Label>
              <textarea
                rows={6}
                value={bulkSubText}
                onChange={(e) => setBulkSubText(e.target.value)}
                placeholder={"Equipment\nWarehouse\nManufacturing\nPackaging"}
                className="w-full p-3 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowBulkSubModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleBulkAddSubcategories}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                Add Subcategories
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

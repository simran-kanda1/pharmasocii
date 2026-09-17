import React, { useState, useEffect } from "react";
import { db } from "@/firebase";
import { collection, addDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFeaturedPlansConfig, type FeaturedPlanOption, type FeaturedPlansConfig } from "@/hooks/useFeaturedPlansConfig";

const GROUP_OPTIONS = [
  "Business Offerings & Consulting Services",
  "Events",
  "Jobs"
];

interface AdminAddFeaturedPlanProps {
  initialPlan?: (FeaturedPlanOption & { groupName?: string }) | null;
  initialGroup?: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export function AdminAddFeaturedPlan({ initialPlan, initialGroup, onCancel, onSuccess }: AdminAddFeaturedPlanProps) {
  const { config, saveConfig } = useFeaturedPlansConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = Boolean(initialPlan && initialPlan.id);

  const [formData, setFormData] = useState({
    group: initialGroup || initialPlan?.groupName || GROUP_OPTIONS[0],
    customGroup: "",
    title: initialPlan?.label || "",
    specification: initialPlan?.specification || "",
    amount: initialPlan?.price !== undefined ? String(initialPlan.price) : "",
    days: initialPlan?.durationDays !== undefined ? String(initialPlan.durationDays) : "30",
    numberOfCountry: initialPlan?.countryLimit !== undefined ? String(initialPlan.countryLimit) : "1",
    numberOfCategory: initialPlan?.categoryLimit !== undefined ? String(initialPlan.categoryLimit) : "1",
    status: (initialPlan?.status || "Active") as "Active" | "Inactive",
    description: initialPlan?.description || "",
  });

  useEffect(() => {
    if (initialPlan) {
      setFormData({
        group: initialGroup || initialPlan.groupName || GROUP_OPTIONS[0],
        customGroup: "",
        title: initialPlan.label || "",
        specification: initialPlan.specification || "",
        amount: initialPlan.price !== undefined ? String(initialPlan.price) : "",
        days: initialPlan.durationDays !== undefined ? String(initialPlan.durationDays) : "30",
        numberOfCountry: initialPlan.countryLimit !== undefined ? String(initialPlan.countryLimit) : "1",
        numberOfCategory: initialPlan.categoryLimit !== undefined ? String(initialPlan.categoryLimit) : "1",
        status: (initialPlan.status || "Active") as "Active" | "Inactive",
        description: initialPlan.description || "",
      });
    }
  }, [initialPlan, initialGroup]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const existingGroups = Array.from(
    new Set([
      ...GROUP_OPTIONS,
      ...(config?.groups?.map((g) => g.service) || []),
    ])
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const targetGroup = formData.group === "__custom__"
      ? formData.customGroup.trim()
      : formData.group.trim();

    if (!formData.title.trim() || !targetGroup) {
      setError("Group and Title are required.");
      return;
    }

    setLoading(true);

    try {
      const numericPrice = parseFloat(formData.amount) || 0;
      const numericDays = parseInt(formData.days, 10) || 30;
      const numericCountry = parseInt(formData.numberOfCountry, 10) || 1;
      const numericCategory = parseInt(formData.numberOfCategory, 10) || 1;

      const currentConfig: FeaturedPlansConfig = JSON.parse(
        JSON.stringify(config || { groups: [] })
      );

      if (isEditing && initialPlan) {
        // Remove from current group
        let updatedGroups = currentConfig.groups.map((grp) => ({
          ...grp,
          options: grp.options.filter((opt) => opt.id !== initialPlan.id),
        }));

        // Find or create target group
        let targetGrp = updatedGroups.find((g) => g.service.toLowerCase() === targetGroup.toLowerCase());
        const updatedOption: FeaturedPlanOption = {
          id: initialPlan.id,
          label: formData.title.trim(),
          specification: formData.specification.trim(),
          price: numericPrice,
          durationDays: numericDays,
          countryLimit: numericCountry,
          categoryLimit: numericCategory,
          status: formData.status,
          description: formData.description.trim(),
        };

        if (targetGrp) {
          targetGrp.options.push(updatedOption);
        } else {
          updatedGroups.push({
            service: targetGroup,
            options: [updatedOption],
          });
        }

        // Filter out any empty groups
        updatedGroups = updatedGroups.filter((g) => g.options.length > 0);

        await saveConfig({ groups: updatedGroups });
      } else {
        // Add new plan
        const generatedId =
          formData.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 30) +
          "_" +
          Date.now();

        const newOption: FeaturedPlanOption = {
          id: generatedId,
          label: formData.title.trim(),
          specification: formData.specification.trim(),
          price: numericPrice,
          durationDays: numericDays,
          countryLimit: numericCountry,
          categoryLimit: numericCategory,
          status: formData.status,
          description: formData.description.trim(),
        };

        let targetGrp = currentConfig.groups.find(
          (g) => g.service.toLowerCase() === targetGroup.toLowerCase()
        );

        if (targetGrp) {
          targetGrp.options.push(newOption);
        } else {
          currentConfig.groups.push({
            service: targetGroup,
            options: [newOption],
          });
        }

        await saveConfig({ groups: currentConfig.groups });

        // Also save doc in featuredPlansCollection for tracking
        try {
          await addDoc(collection(db, "featuredPlansCollection"), {
            id: generatedId,
            group: targetGroup,
            title: formData.title.trim(),
            specification: formData.specification.trim(),
            amount: numericPrice,
            days: numericDays,
            numberOfCountry: numericCountry,
            numberOfCategory: numericCategory,
            status: formData.status,
            description: formData.description.trim(),
            createdAt: new Date(),
          });
        } catch (e) {
          console.warn("Notice: optional featuredPlansCollection mirror save skipped:", e);
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error("Error saving featured plan:", err);
      setError(err.message || "An error occurred while saving the featured plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-full">
      <div className="bg-white rounded-lg border shadow-sm max-w-5xl mx-auto p-6 my-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {isEditing ? "Edit Featured Plan" : "Add Featured Plan"}
          </h2>
          <div className="text-sm text-slate-500">
            Home / Featured Plans / {isEditing ? "Edit Featured Plan" : "Add Featured Plan"}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-md border border-slate-100 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-800 mb-4 pb-2 border-b">
              {isEditing ? `Edit Plan: ${initialPlan?.label || ""}` : "Plan Details"}
            </h3>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Group / Service</Label>
              <div className="space-y-2">
                <select
                  className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.group}
                  onChange={(e) => handleChange("group", e.target.value)}
                >
                  {existingGroups.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="__custom__">+ Add Custom Group...</option>
                </select>
                {formData.group === "__custom__" && (
                  <Input
                    placeholder="Enter new group name..."
                    value={formData.customGroup}
                    onChange={(e) => handleChange("customGroup", e.target.value)}
                    required
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Title / Plan Name</Label>
              <Input
                required
                placeholder="e.g. Home Page, Landing Page, Both Page"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Specification</Label>
              <Input
                placeholder="e.g. Home page, This is feature plan, Both plan"
                value={formData.specification}
                onChange={(e) => handleChange("specification", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Amount (in $)</Label>
              <Input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 1000.00"
                value={formData.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Duration (in days)</Label>
              <Input
                type="number"
                required
                placeholder="e.g. 30"
                value={formData.days}
                onChange={(e) => handleChange("days", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Number of Countries</Label>
              <Input
                type="number"
                placeholder="e.g. 1, 5, or -1 for unlimited"
                value={formData.numberOfCountry}
                onChange={(e) => handleChange("numberOfCountry", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Number of Categories</Label>
              <Input
                type="number"
                placeholder="e.g. 2, 5, or -1 for unlimited"
                value={formData.numberOfCategory}
                onChange={(e) => handleChange("numberOfCategory", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4 border-t pt-6">
              <Label className="text-slate-600 font-medium">Status</Label>
              <select
                className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value as "Active" | "Inactive")}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-start gap-4">
              <Label className="text-slate-600 font-medium mt-3">Description</Label>
              <textarea
                className="w-full h-32 p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm"
                placeholder="Describe what is included in this featured placement..."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </div>

            <div className="pt-4 border-t flex items-center gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Featured Plan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="py-6 px-6"
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

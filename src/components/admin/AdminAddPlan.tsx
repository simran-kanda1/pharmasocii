import React, { useState } from "react";
import { db } from "@/firebase";
import { collection, addDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const GROUP_OPTIONS = [
  "Business Offerings",
  "Consulting Services",
  "Events",
  "Jobs"
];

export function AdminAddPlan({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    group: GROUP_OPTIONS[0],
    title: "",
    specification: "",
    amount: "",
    stripePriceId: "",
    days: "",
    numberOfCountry: "",
    numberOfCategory: "",
    status: "Active",
    description: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title || !formData.group) {
      setError("Group and Title are required.");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "plansCollection"), {
        ...formData,
        createdAt: new Date(),
      });
      onSuccess();
    } catch (err: any) {
      console.error("Error creating plan:", err);
      setError(err.message || "An error occurred while saving the plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-full">
      <div className="bg-white rounded-lg border shadow-sm max-w-5xl mx-auto p-6 my-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">Add Plan</h2>
          <div className="text-sm text-slate-500">
            Home / Plans / Add Plan
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-md border border-slate-100 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-800 mb-4 pb-2 border-b">Add Plan</h3>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Group</Label>
              <select
                className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={formData.group}
                onChange={(e) => handleChange("group", e.target.value)}
              >
                {GROUP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Title</Label>
              <Input 
                required 
                value={formData.title} 
                onChange={(e) => handleChange("title", e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Specification</Label>
              <Input 
                value={formData.specification} 
                onChange={(e) => handleChange("specification", e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Amount (in $)</Label>
              <Input 
                type="number"
                step="0.01"
                value={formData.amount} 
                onChange={(e) => handleChange("amount", e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Stripe price id</Label>
              <Input 
                value={formData.stripePriceId} 
                onChange={(e) => handleChange("stripePriceId", e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Days (in days)</Label>
              <Input 
                type="number"
                value={formData.days} 
                onChange={(e) => handleChange("days", e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Number of Country</Label>
              <Input 
                type="number"
                value={formData.numberOfCountry} 
                onChange={(e) => handleChange("numberOfCountry", e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-slate-600 font-medium">Number of Category</Label>
              <Input 
                type="number"
                value={formData.numberOfCategory} 
                onChange={(e) => handleChange("numberOfCategory", e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4 border-t pt-6">
              <Label className="text-slate-600 font-medium">Status</Label>
              <select
                className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-start gap-4">
              <Label className="text-slate-600 font-medium mt-3">Description</Label>
              <textarea 
                className="w-full h-40 p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </div>

            <div className="pt-4 border-t">
              <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
            {/* Using onCancel button strictly to return without saving */}
            <div className="text-center mt-2">
              <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700 underline">
                Cancel
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}

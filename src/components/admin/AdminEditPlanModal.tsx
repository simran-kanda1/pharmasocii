import React, { useState } from "react";
import { db } from "@/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, X } from "lucide-react";

export interface PlanRecord {
  id?: string;
  planId?: string;
  service: string;
  label: string;
  billing: string;
  priceUsd: number;
  maxCategories?: number;
  maxCountries?: number;
  notes?: string;
  status?: string;
  stripePriceId?: string;
}

const SERVICE_OPTIONS = [
  "Business Offerings / Consulting",
  "Events",
  "Jobs"
];

export function AdminEditPlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: PlanRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    service: plan.service || SERVICE_OPTIONS[0],
    label: plan.label || "",
    billing: plan.billing || "Monthly",
    priceUsd: plan.priceUsd !== undefined ? String(plan.priceUsd) : "100",
    maxCategories: plan.maxCategories === -1 ? "Unlimited" : (plan.maxCategories !== undefined ? String(plan.maxCategories) : "3"),
    maxCountries: plan.maxCountries === -1 ? "Unlimited" : (plan.maxCountries !== undefined ? String(plan.maxCountries) : "1"),
    notes: plan.notes || "",
    status: plan.status || "Active",
    stripePriceId: plan.stripePriceId || "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.label || !formData.service) {
      setError("Service and Plan Title/Label are required.");
      return;
    }

    setLoading(true);

    try {
      const docId = plan.id || plan.planId || `${formData.service}_${formData.label}`.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const docRef = doc(db, "plansCollection", docId);

      const parsedPrice = parseFloat(formData.priceUsd) || 0;
      const parsedCat = formData.maxCategories.toLowerCase() === "unlimited" ? -1 : parseInt(formData.maxCategories) || 0;
      const parsedCountry = formData.maxCountries.toLowerCase() === "unlimited" ? -1 : parseInt(formData.maxCountries) || 0;

      await setDoc(docRef, {
        planId: docId,
        service: formData.service,
        group: formData.service,
        label: formData.label,
        title: formData.label,
        billing: formData.billing,
        priceUsd: parsedPrice,
        amount: parsedPrice,
        maxCategories: parsedCat,
        numberOfCategory: parsedCat === -1 ? "Unlimited" : String(parsedCat),
        maxCountries: parsedCountry,
        numberOfCountry: parsedCountry === -1 ? "Unlimited" : String(parsedCountry),
        notes: formData.notes,
        specification: formData.notes,
        status: formData.status,
        stripePriceId: formData.stripePriceId,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      onSaved();
    } catch (err: any) {
      console.error("Error saving plan:", err);
      setError(err.message || "An error occurred while updating the plan.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete plan "${formData.label}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      if (plan.id || plan.planId) {
        const idToDelete = plan.id || plan.planId!;
        await deleteDoc(doc(db, "plansCollection", idToDelete));
      }
      onSaved();
    } catch (err: any) {
      console.error("Error deleting plan:", err);
      setError(err.message || "Failed to delete plan.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 pb-3 border-b">
          <h2 className="text-xl font-bold text-slate-900">Edit Plan</h2>
          <p className="text-sm text-slate-500 mt-1">Update plan pricing, service group, and limits</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Service Group:</Label>
            <select
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
              value={formData.service}
              onChange={(e) => handleChange("service", e.target.value)}
            >
              {SERVICE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Plan Title / Label:</Label>
            <Input
              required
              placeholder="e.g. Basic (Monthly)"
              value={formData.label}
              onChange={(e) => handleChange("label", e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Billing Cycle:</Label>
            <select
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
              value={formData.billing}
              onChange={(e) => handleChange("billing", e.target.value)}
            >
              <option value="Monthly">Monthly</option>
              <option value="Yearly">Yearly</option>
              <option value="One-time">One-time</option>
            </select>
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Price (USD):</Label>
            <Input
              type="number"
              required
              placeholder="e.g. 100"
              value={formData.priceUsd}
              onChange={(e) => handleChange("priceUsd", e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Max Categories:</Label>
            <Input
              placeholder="e.g. 3 or Unlimited"
              value={formData.maxCategories}
              onChange={(e) => handleChange("maxCategories", e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <Label className="text-slate-700 font-medium">Max Countries:</Label>
            <Input
              placeholder="e.g. 1 or Unlimited"
              value={formData.maxCountries}
              onChange={(e) => handleChange("maxCountries", e.target.value)}
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

          <div className="grid grid-cols-[160px_1fr] items-start gap-3 pt-2">
            <Label className="text-slate-700 font-medium mt-2">Notes / Details:</Label>
            <textarea
              className="w-full h-20 p-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="e.g. Standard listing visibility."
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4 mt-6">
            {(plan.id || plan.planId) ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || loading}
                className="bg-rose-600 hover:bg-rose-700 text-white text-sm"
              >
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete Plan
              </Button>
            ) : <div />}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Plan
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

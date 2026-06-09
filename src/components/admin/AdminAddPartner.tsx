import React, { useState } from "react";
import { auth, db, storage } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, UploadCloud } from "lucide-react";
import { API_BASE_URL } from "@/apiConfig";
// import ReactQuill from "react-quill";
// import "react-quill/dist/quill.snow.css";

const PLAN_OPTIONS = [
  { value: "none", label: "No Plan (Free/Pending)" },
  { value: "basic_mo", label: "Basic (Monthly)" },
  { value: "standard_mo", label: "Standard (Monthly)" },
  { value: "premium_mo", label: "Premium (Monthly)" },
  { value: "premium_plus_mo", label: "Premium Plus (Monthly)" },
  { value: "basic_yr", label: "Basic (Annual)" },
  { value: "standard_yr", label: "Standard (Annual)" },
  { value: "premium_yr", label: "Premium (Annual)" },
  { value: "premium_plus_yr", label: "Premium Plus (Annual)" },
];

const FEATURE_OPTIONS = [
  { value: "none", label: "No Feature" },
  { value: "spotlight_addon", label: "Spotlight Addon (Monthly)" },
];

const GROUP_OPTIONS = [
  { value: "Business Offerings", label: "Business Offerings" },
  { value: "Consulting Services", label: "Consulting Services" },
  { value: "Events", label: "Events" },
  { value: "Jobs", label: "Jobs" },
];

const TRIAL_PERIOD_OPTIONS = [
  { value: "none", label: "No Trial (Full Duration)" },
  { value: "7_days", label: "1 Week" },
  { value: "30_days", label: "30 Days" },
  { value: "3_months", label: "3 Months" },
];

export function AdminAddPartner({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    status: "Pending Review",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    altContactName: "",
    altEmail: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    companyWebsite: "",
    businessPhone: "",
    linkedinProfile: "",
    profileHtml: "",
    addressHtml: "",
    selectedGroup: "Business Offerings",
    selectedPlan: "none",
    featuredPlan: "none",
    trialPeriod: "none",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLogoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!formData.email || !formData.password || !formData.firstName || !formData.companyName) {
      setError("Please fill out all required fields.");
      return;
    }

    setLoading(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/api/admin/create-partner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create partner");

      // Handle Logo Upload if any
      if (logoFile && result.uid) {
        const storageRef = ref(storage, `partners/${result.uid}/logo.png`);
        await uploadBytes(storageRef, logoFile);
        const logoUrl = await getDownloadURL(storageRef);
        await updateDoc(doc(db, "partnersCollection", result.uid), { logoUrl });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm max-w-5xl mx-auto p-6 my-6">
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">Add Partner Information</h2>
        <div className="text-sm text-slate-500">
          Home / Partners / Add partner info
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Status */}
        <div className="max-w-md">
          <Label className="text-slate-600 font-medium">Status :</Label>
          <select
            className="w-full mt-1.5 p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.status}
            onChange={(e) => handleChange("status", e.target.value)}
          >
            <option value="Pending Review">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-slate-600 font-medium">First name <span className="text-red-500">*</span></Label>
            <Input required value={formData.firstName} onChange={(e) => handleChange("firstName", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-slate-600 font-medium">Last name <span className="text-red-500">*</span></Label>
            <Input required value={formData.lastName} onChange={(e) => handleChange("lastName", e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label className="text-slate-600 font-medium">Email <span className="text-red-500">*</span></Label>
            <Input required type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-slate-600 font-medium">Phone <span className="text-red-500">*</span></Label>
            <Input required type="tel" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label className="text-slate-600 font-medium">Alternate contact first & last name</Label>
            <Input value={formData.altContactName} onChange={(e) => handleChange("altContactName", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-slate-600 font-medium">Alternate email address</Label>
            <Input type="email" value={formData.altEmail} onChange={(e) => handleChange("altEmail", e.target.value)} className="mt-1.5" />
          </div>

          <div className="relative">
            <Label className="text-slate-600 font-medium">Password <span className="text-red-500">*</span></Label>
            <Input required type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => handleChange("password", e.target.value)} className="mt-1.5 pr-10" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[32px] text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="relative">
            <Label className="text-slate-600 font-medium">Confirm password <span className="text-red-500">*</span></Label>
            <Input required type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)} className="mt-1.5 pr-10" />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-[32px] text-slate-400 hover:text-slate-600">
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Company Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
          <div>
            <Label className="text-slate-600 font-medium">Company name <span className="text-red-500">*</span></Label>
            <Input required value={formData.companyName} onChange={(e) => handleChange("companyName", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-slate-600 font-medium">Company website <span className="text-red-500">*</span></Label>
            <Input required type="url" placeholder="https://" value={formData.companyWebsite} onChange={(e) => handleChange("companyWebsite", e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label className="text-slate-600 font-medium">Business phone <span className="text-red-500">*</span></Label>
            <Input required type="tel" value={formData.businessPhone} onChange={(e) => handleChange("businessPhone", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-slate-600 font-medium">LinkedIn profile</Label>
            <Input type="url" placeholder="https://linkedin.com/..." value={formData.linkedinProfile} onChange={(e) => handleChange("linkedinProfile", e.target.value)} className="mt-1.5" />
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <Label className="text-slate-600 font-medium block mb-2">Company logo</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center justify-center px-4 py-2 bg-slate-100 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-200 transition-colors">
              <UploadCloud className="w-5 h-5 mr-2 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Choose File</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
            <span className="text-sm text-slate-500">
              {logoFile ? logoFile.name : "No file chosen"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Formats: JPG, JPEG, PNG | Max size: 2MB | Dimensions: 200px x 200px</p>
        </div>

        {/* Rich Text Areas (Temporarily disabled ReactQuill for testing) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
          <div>
            <Label className="text-slate-600 font-medium mb-1.5 block">Company profile <span className="text-red-500">*</span></Label>
            <div className="bg-white rounded-md">
              <textarea 
                className="w-full h-48 p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.profileHtml} 
                onChange={(e) => handleChange("profileHtml", e.target.value)} 
              />
            </div>
          </div>
          <div>
            <Label className="text-slate-600 font-medium mb-1.5 block">Business address <span className="text-red-500">*</span></Label>
            <div className="bg-white rounded-md">
              <textarea 
                className="w-full h-48 p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.addressHtml} 
                onChange={(e) => handleChange("addressHtml", e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Billing & Groups */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-12 border-t">
          <div>
            <Label className="text-slate-600 font-medium mb-1.5 block">Select group <span className="text-red-500">*</span></Label>
            <select
              className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.selectedGroup}
              onChange={(e) => handleChange("selectedGroup", e.target.value)}
            >
              {GROUP_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div>
            <Label className="text-slate-600 font-medium mb-1.5 block">Payment plans <span className="text-red-500">*</span></Label>
            <select
              className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.selectedPlan}
              onChange={(e) => handleChange("selectedPlan", e.target.value)}
            >
              {PLAN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div>
            <Label className="text-slate-600 font-medium mb-1.5 block">Trial Period (for selected plan)</Label>
            <select
              className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.trialPeriod}
              onChange={(e) => handleChange("trialPeriod", e.target.value)}
            >
              {TRIAL_PERIOD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-2">Limits the plan duration. The profile expires when the trial ends.</p>
          </div>

          <div>
            <Label className="text-slate-600 font-medium mb-1.5 block">Featured partner plan (monthly)</Label>
            <select
              className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.featuredPlan}
              onChange={(e) => handleChange("featuredPlan", e.target.value)}
            >
              {FEATURE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-2">Assign a featured plan to the partner manually.</p>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t mt-8">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Partner
          </Button>
        </div>
      </form>
    </div>
  );
}

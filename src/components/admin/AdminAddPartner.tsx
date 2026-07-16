import React, { useState, useEffect, useMemo } from "react";
import { auth, db, storage } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  EyeOff,
  Loader2,
  UploadCloud,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Info,
  Building2,
  Globe,
  Building,
  Receipt,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
import { API_BASE_URL } from "@/apiConfig";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { isValidBusinessAddress } from "@/lib/addressValidation";
import { buildDisplayCategoryFields, sanitizeLowestLevelSelections } from "@/lib/categorySelection";
import { uploadJobDescriptionPdf, uploadEventAgendaPdf } from "@/lib/jobDescriptionUpload";

import {
  BUSINESS_CATEGORIES,
  CONSULTING_CATEGORIES,
  EVENTS_CATEGORIES,
  JOBS_CATEGORIES,
  type SubcategoryEntry,
  type CategoriesDict,
} from "../../pages/AllCategories";

// ─── Plan limits ───
interface PlanLimits {
  maxCategories: number;
  maxCountries: number;
}

interface CompanyRepresentative {
  firstName: string;
  lastName: string;
  email: string;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  none: { maxCategories: -1, maxCountries: -1 },
  basic_mo: { maxCategories: 3, maxCountries: 1 },
  standard_mo: { maxCategories: 5, maxCountries: 3 },
  premium_mo: { maxCategories: 15, maxCountries: 15 },
  premium_plus_mo: { maxCategories: -1, maxCountries: -1 },
  basic_yr: { maxCategories: 3, maxCountries: 1 },
  standard_yr: { maxCategories: 5, maxCountries: 3 },
  premium_yr: { maxCategories: 15, maxCountries: 15 },
  premium_plus_yr: { maxCategories: -1, maxCountries: -1 },
  basic_event: { maxCategories: -1, maxCountries: -1 },
  standard_event: { maxCategories: -1, maxCountries: -1 },
  premium_event: { maxCategories: -1, maxCountries: -1 },
  premium_plus_event: { maxCategories: -1, maxCountries: -1 },
  standard_job: { maxCategories: -1, maxCountries: -1 },
  premium_job: { maxCategories: -1, maxCountries: -1 },
  premium_plus_job: { maxCategories: -1, maxCountries: -1 },
};

const EVENT_JOB_PLAN_DETAILS: Record<string, string[]> = {
  basic_event: ["Event profile", "Agenda highlights (500 chars) + full agenda PDF", "Event date (single day)", "Event location", "Select multiple categories for better visibility", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"],
  standard_event: ["Event profile", "Agenda highlights (500 chars) + full agenda PDF", "Multi-day event dates", "Event location", "Select multiple categories for better visibility", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"],
  premium_event: ["Extra Feature: Landing page spotlight for increased visibility", "Event profile", "Agenda highlights (500 chars) + full agenda PDF", "Multi-day event dates", "Event location", "Select multiple categories for better visibility", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"],
  premium_plus_event: ["Extra Feature: Home page spotlight for maximum visibility", "Event profile", "Agenda highlights (500 chars) + full agenda PDF", "Multi-day event dates", "Event location", "Select multiple categories", "Company profile", "Display your logo for branding", "Direct link to your site for easy sign up", "Add representative(s) for direct communication"],
  standard_job: ["Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"],
  premium_job: ["Extra Feature: Landing page spotlight for increased visibility", "Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"],
  premium_plus_job: ["Extra Feature: Home page spotlight for maximum visibility", "Position title for quick search", "Job description outlining key responsibilities", "Company profile to showcase your brand and attract top talent", "Direct link to your site for easy applications", "Display your logo for branding", "Location for filtering and relevance", "Industry classification to improve discoverability", "Add representative(s) for direct communication"],
};

const SERVICE_REGIONS = [
  "North America", "South America", "Europe", "Asia Pacific",
  "Middle East", "Africa", "Australia & Oceania",
];

const SERVICE_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia",
  "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Georgia", "Germany", "Ghana", "Greece", "Guatemala", "Guyana",
  "Haiti", "Honduras", "Hong Kong", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Korea", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Liberia", "Libya", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Mauritius",
  "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Norway",
  "Oman",
  "Pakistan", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saudi Arabia", "Senegal", "Serbia", "Sierra Leone", "Singapore", "Slovak Republic", "Slovenia",
  "Somalia", "South Africa", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tanzania", "Thailand", "Togo", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "UAE", "Uganda", "UK", "Ukraine", "United States", "Uruguay", "Uzbekistan",
  "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe",
];

const BSL_LEVELS = ["1", "2", "3", "4"];
const CERTIFICATIONS = ["GMP", "CE", "ISO 13485", "ISO 9001", "Others"];
const OTHER_CERT_OPTION = "Others";
const COMPANY_PROFILE_MAX_LENGTH = 1000;

const REGION_COUNTRY_MAP: Record<string, string[]> = {
  "North America": ["Barbados", "Belize", "Canada", "Costa Rica", "Cuba", "Dominican Republic", "El Salvador", "Guatemala", "Haiti", "Honduras", "Jamaica", "Mexico", "Nicaragua", "Panama", "Trinidad and Tobago", "United States"],
  "South America": ["Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"],
  "Europe": ["Albania", "Austria", "Belarus", "Belgium", "Bosnia", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Russia", "Serbia", "Slovak Republic", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "UK", "Ukraine"],
  "Asia Pacific": ["Afghanistan", "Armenia", "Azerbaijan", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China", "Georgia", "Hong Kong", "India", "Indonesia", "Japan", "Kazakhstan", "Korea", "Kyrgyzstan", "Laos", "Malaysia", "Maldives", "Mongolia", "Myanmar", "Nepal", "Pakistan", "Philippines", "Singapore", "Sri Lanka", "Taiwan", "Thailand", "Turkmenistan", "Uzbekistan", "Vietnam"],
  "Middle East": ["Bahrain", "Iran", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon", "Oman", "Palestine", "Qatar", "Saudi Arabia", "Syria", "UAE", "Yemen"],
  "Africa": ["Algeria", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Central African Republic", "Chad", "Congo", "Djibouti", "Egypt", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Ghana", "Kenya", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Senegal", "Sierra Leone", "Somalia", "South Africa", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"],
  "Australia & Oceania": ["Australia", "Fiji", "New Zealand", "Papua New Guinea"],
};

const getSubLabel = (entry: SubcategoryEntry): string =>
  typeof entry === "string" ? entry : entry.label;

const hasSubSub = (entry: SubcategoryEntry): entry is { label: string; subSubcategories: string[] } =>
  typeof entry !== "string";

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

const FEATURE_OPTIONS = [
  { value: "none", label: "No Feature" },
  { value: "home_page", label: "Home Page Spotlight (Monthly)" },
  { value: "landing_page", label: "Landing Page Spotlight (Monthly)" },
  { value: "both", label: "Landing + Home Page Spotlight (Monthly)" },
];

export function AdminAddPartner({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Text Form Data
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
    billingEmail: "",
    businessId: "",
    businessCountry: "",
  });

  // Files
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [eventAgendaPdfFile, setEventAgendaPdfFile] = useState<File | null>(null);
  const [jobPdfFile, setJobPdfFile] = useState<File | null>(null);

  // ─── Business Offerings / Consulting metadata ───
  const [selectedBSL, setSelectedBSL] = useState<string[]>([]);
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [otherCertText, setOtherCertText] = useState("");
  const [showOtherCertInput, setShowOtherCertInput] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [companyRepresentatives, setCompanyRepresentatives] = useState<CompanyRepresentative[]>([]);

  // ─── Event details state ───
  const [eventData, setEventData] = useState({
    eventName: "", eventLink: "", startDate: "", endDate: "",
    eventCountry: "", stateRegion: "", city: "", location: "", eventProfile: "", agendaHighlights: "",
  });

  // ─── Job details state ───
  const [jobData, setJobData] = useState({
    jobTitle: "", industry: "", positionType: "", experienceLevel: "",
    positionLink: "", jobCountry: "", stateRegion: "", city: "", location: "", jobSummary: "",
    education: "", workModel: "", applicationDeadline: "",
  });

  // ─── Category tree state ───
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedSubSubcategories, setSelectedSubSubcategories] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);

  // ─── Multiselect UI toggles ───
  const [showBSLDropdown, setShowBSLDropdown] = useState(false);
  const [showCertsDropdown, setShowCertsDropdown] = useState(false);
  const [showRegionsDropdown, setShowRegionsDropdown] = useState(false);
  const [showCountriesDropdown, setShowCountriesDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Convert "Business Offerings" -> "business_offerings"
  const getGroupKey = (groupName: string) => {
    switch (groupName) {
      case "Business Offerings": return "business_offerings";
      case "Consulting Services": return "consulting";
      case "Events": return "events";
      case "Jobs": return "jobs";
      default: return groupName;
    }
  };

  const groupKey = getGroupKey(formData.selectedGroup);
  const currentLimits = PLAN_LIMITS[formData.selectedPlan] || { maxCategories: 0, maxCountries: 0 };
  const canUseRegionHelper = currentLimits.maxCountries === -1;

  const categoryCount = useMemo(() => {
    const selectedUnits = new Set<string>();
    selectedCategories.forEach((cat) => selectedUnits.add(`cat:${cat}`));
    selectedSubcategories.forEach((sub) => selectedUnits.add(`sub:${sub}`));
    selectedSubSubcategories.forEach((subSub) => selectedUnits.add(`subsub:${subSub}`));
    return selectedUnits.size;
  }, [selectedCategories, selectedSubcategories, selectedSubSubcategories]);

  const isCategoryLimitReached = currentLimits.maxCategories !== -1 && categoryCount >= currentLimits.maxCategories;
  const isCountryLimitReached = currentLimits.maxCountries !== -1 && selectedCountries.length >= currentLimits.maxCountries;
  const canSelectAllCategories = currentLimits.maxCategories === -1;

  // Sync Event End Date on Single Day Plans
  useEffect(() => {
    if (formData.selectedPlan !== "basic_event" || !eventData.startDate) return;
    setEventData((prev) => (prev.endDate === prev.startDate ? prev : { ...prev, endDate: prev.startDate }));
  }, [formData.selectedPlan, eventData.startDate]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    if (field === "selectedGroup") {
      setFormData((prev) => ({ ...prev, selectedGroup: value, selectedPlan: "none", featuredPlan: "none", trialPeriod: "none" }));
      setSelectedBSL([]); setSelectedCerts([]); setSelectedRegions([]);
      setOtherCertText(""); setShowOtherCertInput(false);
      setSelectedCountries([]); setSelectedCategories([]);
      setSelectedSubcategories([]); setSelectedSubSubcategories([]);
      setExpandedCategories([]); setExpandedSubcategories([]);
    } else if (field === "selectedPlan") {
      setFormData((prev) => ({ ...prev, selectedPlan: value }));
      setEventAgendaPdfFile(null);
      setJobPdfFile(null);
      setSelectedCategories([]); setSelectedSubcategories([]); setSelectedSubSubcategories([]);
      setSelectedCountries([]); setSelectedRegions([]);
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLogoFile(e.target.files[0]);
    }
  };

  const getPlansForGroup = (groupName: string) => {
    const gk = getGroupKey(groupName);
    switch (gk) {
      case 'business_offerings': case 'consulting':
        return [
          { value: 'none', label: 'No Plan (Free/Pending)' },
          { value: 'basic_mo', label: 'Basic (Monthly) - $100.00' },
          { value: 'standard_mo', label: 'Standard (Monthly) - $200.00' },
          { value: 'premium_mo', label: 'Premium (Monthly) - $400.00' },
          { value: 'premium_plus_mo', label: 'Premium Plus (Monthly) - $1000.00' },
          { value: 'basic_yr', label: 'Basic (Annual) - $1,080.00' },
          { value: 'standard_yr', label: 'Standard (Annual) - $2,184.00' },
          { value: 'premium_yr', label: 'Premium (Annual) - $4,320.00' },
          { value: 'premium_plus_yr', label: 'Premium Plus (Annual) - $10,800.00' },
        ];
      case 'events':
        return [
          { value: 'none', label: 'No Plan (Free/Pending)' },
          { value: 'basic_event', label: 'Basic - $500.00' },
          { value: 'standard_event', label: 'Standard - $850.00' },
          { value: 'premium_event', label: 'Premium - $1,250.00' },
          { value: 'premium_plus_event', label: 'Premium Plus - $1,450.00' },
        ];
      case 'jobs':
        return [
          { value: 'none', label: 'No Plan (Free/Pending)' },
          { value: 'standard_job', label: 'Standard - $400.00/mo' },
          { value: 'premium_job', label: 'Premium - $800.00/mo' },
          { value: 'premium_plus_job', label: 'Premium Plus - $1,000.00/mo' },
        ];
      default: return [{ value: 'none', label: 'No Plan (Free/Pending)' }];
    }
  };

  const getPlanDetailsText = (planId: string): string[] => {
    const gk = getGroupKey(formData.selectedGroup);
    if (gk === "events" || gk === "jobs") {
      return EVENT_JOB_PLAN_DETAILS[planId] || [];
    }
    const limits = PLAN_LIMITS[planId];
    if (!limits) return [];
    const cats = limits.maxCategories === -1 ? "Unlimited" : `up to ${limits.maxCategories}`;
    const countries = limits.maxCountries === -1 ? "Unlimited" : `up to ${limits.maxCountries}`;
    return [
      `Access to specialized categories — ${cats}`,
      `Service countries — ${countries}`,
      "Company profile to highlight your key offerings",
      "Display your logo for branding",
      "Direct website link",
      "Add representative(s) for direct communication",
      ...(gk === "business_offerings" ? ["Certifications (optional)", "Biosafety level (optional) — BSL disclosure"] : []),
    ];
  };

  const getCategoriesForGroup = (groupName: string): CategoriesDict | Record<string, string[]> | null => {
    const gk = getGroupKey(groupName);
    switch (gk) {
      case "business_offerings": return BUSINESS_CATEGORIES;
      case "consulting": return CONSULTING_CATEGORIES;
      case "events": return EVENTS_CATEGORIES;
      case "jobs": return JOBS_CATEGORIES;
      default: return null;
    }
  };

  // ─── Representative Helpers ───
  const addRepresentative = () => {
    setCompanyRepresentatives(prev => [...prev, { firstName: "", lastName: "", email: "" }]);
  };
  const removeRepresentative = (index: number) => {
    setCompanyRepresentatives(prev => prev.filter((_, i) => i !== index));
  };
  const updateRepresentative = (index: number, field: keyof CompanyRepresentative, value: string) => {
    setCompanyRepresentatives(prev => prev.map((rep, i) => (i === index ? { ...rep, [field]: value } : rep)));
  };

  // ─── Classification helpers ───
  const toggleBSL = (bsl: string) => {
    setSelectedBSL(prev => prev.includes(bsl) ? prev.filter(b => b !== bsl) : [...prev, bsl]);
  };

  const toggleCert = (cert: string) => {
    if (cert === OTHER_CERT_OPTION) {
      setShowOtherCertInput(prev => !prev);
      if (selectedCerts.includes(OTHER_CERT_OPTION)) {
        setSelectedCerts(prev => prev.filter(c => c !== OTHER_CERT_OPTION));
        setOtherCertText("");
      } else {
        setSelectedCerts(prev => [...prev, OTHER_CERT_OPTION]);
      }
      return;
    }
    setSelectedCerts(prev => prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]);
  };

  const handleOtherCertTextChange = (text: string) => {
    setOtherCertText(text);
    setSelectedCerts(prev => {
      const filtered = prev.filter(c => !c.toLowerCase().startsWith("other:"));
      if (text.trim()) {
        return [...filtered, `Other: ${text.trim()}`];
      }
      return filtered;
    });
  };

  const toggleRegion = (region: string) => {
    if (!canUseRegionHelper) return;
    const countriesInRegion = REGION_COUNTRY_MAP[region] || [];
    const allSelected = countriesInRegion.every(c => selectedCountries.includes(c));
    if (allSelected) {
      setSelectedRegions(prev => prev.filter(r => r !== region));
      setSelectedCountries(prev => prev.filter(c => !countriesInRegion.includes(c)));
    } else {
      setSelectedRegions(prev => Array.from(new Set([...prev, region])));
      setSelectedCountries(prev => Array.from(new Set([...prev, ...countriesInRegion])));
    }
  };

  const toggleCountry = (country: string) => {
    if (selectedCountries.includes(country)) {
      setSelectedCountries(prev => prev.filter(c => c !== country));
      // Remove region highlights that contain this country
      Object.entries(REGION_COUNTRY_MAP).forEach(([region, countries]) => {
        if (countries.includes(country)) {
          setSelectedRegions(prev => prev.filter(r => r !== region));
        }
      });
    } else {
      if (isCountryLimitReached) return;
      setSelectedCountries(prev => [...prev, country]);
    }
  };

  // ─── Category Selection Tree Helpers ───
  const toggleExpandCategory = (cat: string) => {
    setExpandedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };
  const toggleExpandSubcategory = (sub: string) => {
    setExpandedSubcategories(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]);
  };

  const toggleCategorySelection = (cat: string, hasSubs: boolean) => {
    if (hasSubs) {
      setSelectedCategories(prev => prev.filter(c => c !== cat));
      toggleExpandCategory(cat);
      return;
    }
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(prev => prev.filter(c => c !== cat));
    } else {
      if (isCategoryLimitReached) return;
      setSelectedCategories(prev => [...prev, cat]);
    }
  };

  const toggleSubcategorySelection = (sub: string, hasSubSubs: boolean) => {
    if (hasSubSubs) {
      setSelectedSubcategories(prev => prev.filter(s => s !== sub));
      toggleExpandSubcategory(sub);
      return;
    }
    if (selectedSubcategories.includes(sub)) {
      setSelectedSubcategories(prev => prev.filter(s => s !== sub));
    } else {
      if (isCategoryLimitReached) return;
      setSelectedSubcategories(prev => [...prev, sub]);
    }
  };

  const toggleSubSubcategorySelection = (subSub: string) => {
    if (selectedSubSubcategories.includes(subSub)) {
      setSelectedSubSubcategories(prev => prev.filter(ss => ss !== subSub));
    } else {
      if (isCategoryLimitReached) return;
      setSelectedSubSubcategories(prev => [...prev, subSub]);
    }
  };

  const handleSelectAllCategories = () => {
    const catDict = getCategoriesForGroup(formData.selectedGroup);
    if (!catDict || !canSelectAllCategories) return;

    const allLeafCategories: string[] = [];
    const allLeafSubcategories: string[] = [];
    const allSubSubcategories: string[] = [];
    const allCategoryKeys = Object.keys(catDict);
    const allNestedSubcategoryLabels: string[] = [];
    const isBusinessGroup = groupKey === "business_offerings";

    Object.entries(catDict).forEach(([cat, subs]) => {
      if (!subs.length) {
        allLeafCategories.push(cat);
        return;
      }
      subs.forEach((entry: SubcategoryEntry) => {
        const subLabel = getSubLabel(entry);
        if (isBusinessGroup && hasSubSub(entry)) {
          allNestedSubcategoryLabels.push(subLabel);
          entry.subSubcategories.forEach((ss) => allSubSubcategories.push(ss));
        } else {
          allLeafSubcategories.push(subLabel);
        }
      });
    });

    setSelectedCategories(Array.from(new Set(allLeafCategories)));
    setSelectedSubcategories(Array.from(new Set(allLeafSubcategories)));
    setSelectedSubSubcategories(Array.from(new Set(allSubSubcategories)));
    setExpandedCategories(allCategoryKeys);
    setExpandedSubcategories(Array.from(new Set(allNestedSubcategoryLabels)));
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setShowBSLDropdown(false);
      setShowCertsDropdown(false);
      setShowRegionsDropdown(false);
      setShowCountriesDropdown(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Filtered Countries list
  const filteredCountries = SERVICE_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()));

  // ─── Render category tree ───
  function renderCategoryTree() {
    const catDict = getCategoriesForGroup(formData.selectedGroup);
    if (!catDict) return null;

    const isBusinessGroup = groupKey === "business_offerings";

    return Object.entries(catDict).map(([cat, subs]) => {
      const hasSubs = subs.length > 0;
      const isExpanded = expandedCategories.includes(cat);
      const isParentSelected = selectedCategories.includes(cat);

      return (
        <div key={cat} className="flex flex-col">
          <div className="flex items-start gap-2 py-1">
            {hasSubs ? (
              <button type="button" onClick={() => toggleExpandCategory(cat)} className="mt-0.5 flex-shrink-0 text-slate-500 hover:text-slate-900">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : <span className="w-4 h-4 flex-shrink-0" />}

            <div className="flex items-center gap-2">
              <Checkbox
                id={`cat-${cat}`}
                checked={hasSubs ? isExpanded : isParentSelected}
                onCheckedChange={() => toggleCategorySelection(cat, hasSubs)}
                disabled={!hasSubs && !isParentSelected && isCategoryLimitReached}
                className={hasSubs && isExpanded ? "border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" : ""}
              />
              <label htmlFor={`cat-${cat}`} className={`text-sm leading-none cursor-pointer ${hasSubs ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                {cat}
              </label>
            </div>
          </div>

          {hasSubs && isExpanded && (
            <div className="ml-8 pl-3 border-l-2 border-green-500/30 space-y-1 mb-2">
              {subs.map((entry: SubcategoryEntry) => {
                const subLabel = getSubLabel(entry);
                const isNested = isBusinessGroup && hasSubSub(entry);
                const isSubChecked = selectedSubcategories.includes(subLabel);
                const isSubExpanded = expandedSubcategories.includes(subLabel);

                return (
                  <div key={subLabel} className="flex flex-col">
                    <div className="flex items-center gap-1.5 py-0.5">
                      {isNested ? (
                        <button type="button" onClick={() => toggleExpandSubcategory(subLabel)} className="flex-shrink-0 text-slate-500 hover:text-slate-900">
                          {isSubExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      ) : <span className="w-3.5 h-3.5 flex-shrink-0" />}

                      <Checkbox
                        id={`sub-${cat}-${subLabel}`}
                        checked={isNested ? isSubExpanded : isSubChecked}
                        onCheckedChange={() => toggleSubcategorySelection(subLabel, isNested || false)}
                        disabled={!isNested && !isSubChecked && isCategoryLimitReached}
                        className={`${isSubChecked ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`}
                      />
                      <label htmlFor={`sub-${cat}-${subLabel}`} className="text-sm text-green-700 cursor-pointer">
                        {subLabel}
                      </label>
                    </div>

                    {isNested && isSubExpanded && hasSubSub(entry) && (
                      <div className="ml-6 pl-3 border-l border-blue-500/20 space-y-0.5 mb-1">
                        {entry.subSubcategories.map(ssLabel => {
                          const isSsChecked = selectedSubSubcategories.includes(ssLabel);
                          return (
                            <div key={ssLabel} className="flex items-center gap-2 py-0.5">
                              <Checkbox
                                id={`ssub-${cat}-${subLabel}-${ssLabel}`}
                                checked={isSsChecked}
                                onCheckedChange={() => toggleSubSubcategorySelection(ssLabel)}
                                disabled={!isSsChecked && isCategoryLimitReached}
                                className={`${isSsChecked ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`}
                              />
                              <label htmlFor={`ssub-${cat}-${subLabel}-${ssLabel}`} className="text-xs text-slate-500 cursor-pointer">
                                {ssLabel}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  }

  // ─── Multi-select dropdown ───
  function MultiSelectDropdown({ label, items, selected, onToggle, open, onToggleOpen, disabled, search, setSearch, filteredItems }: {
    label: string; items?: string[]; selected: string[]; onToggle: (v: string) => void; open: boolean; onToggleOpen: () => void; disabled?: (v: string) => boolean;
    search?: string; setSearch?: (v: string) => void; filteredItems?: string[];
  }) {
    const displayItems = filteredItems || items || [];
    return (
      <div className="relative">
        <div
          onClick={onToggleOpen}
          className="flex min-h-[42px] w-full items-center gap-2 flex-wrap rounded-md border border-slate-300 bg-white px-3 py-2 text-sm cursor-pointer hover:border-slate-400 transition-colors"
        >
          {selected.length === 0 ? (
            <span className="text-slate-400">Choose {label.toLowerCase()} (multi-select)</span>
          ) : (
            selected.map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-800 text-xs rounded border border-slate-200">
                <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={(e) => { e.stopPropagation(); onToggle(s); }} />
                {s}
              </span>
            ))
          )}
        </div>
        {open && (
          <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-300 rounded-md shadow-lg">
            {setSearch && (
              <div className="p-2 border-b border-slate-200 sticky top-0 bg-white z-10">
                <Input
                  placeholder="Search..."
                  value={search || ""}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 text-sm bg-slate-50 border-slate-200"
                  onClick={e => e.stopPropagation()}
                />
              </div>
            )}
            {displayItems.map(item => {
              const isSelected = selected.includes(item);
              const isDisabled = disabled ? disabled(item) : false;
              return (
                <div
                  key={item}
                  onClick={(e) => { e.stopPropagation(); if (!isDisabled || isSelected) onToggle(item); }}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors
                                      ${isSelected ? "bg-blue-50 text-blue-700 font-medium" : isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-50 text-slate-700"}`}
                >
                  <span>{item}</span>
                  {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                </div>
              );
            })}
            {displayItems.length === 0 && (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">No results</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Step Validation & Progress ───
  const validateStep = () => {
    setError("");
    if (activeStep === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
        setError("Please fill out all required fields.");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match.");
        return false;
      }
    } else if (activeStep === 2) {
      if (!formData.companyName || !formData.companyWebsite || !formData.businessPhone || !formData.businessCountry || !formData.addressHtml) {
        setError("Please fill out all required company fields.");
        return false;
      }
      if (!isValidBusinessAddress(formData.addressHtml)) {
        setError("Please enter a valid business address (include street number and street name).");
        return false;
      }
    } else if (activeStep === 3) {
      if (!formData.selectedGroup || !formData.selectedPlan) {
        setError("Please select a group and plan.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setError("");
    setActiveStep(prev => prev - 1);
  };

  // ─── Submit Flow ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation for final step (Step 4)
    if (groupKey === "business_offerings" || groupKey === "consulting") {
      if (selectedCountries.length === 0) {
        setError("Please select at least one country.");
        return;
      }
    } else if (groupKey === "events") {
      if (!eventData.eventName || !eventData.eventLink || !eventData.startDate || !eventData.endDate || !eventData.eventCountry || !eventData.location) {
        setError("Please complete all required event details.");
        return;
      }
    } else if (groupKey === "jobs") {
      if (!jobData.jobTitle || !jobData.positionType || !jobData.jobCountry || !jobData.location || !jobData.jobSummary) {
        setError("Please complete all required job details.");
        return;
      }
    }

    setLoading(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const normalizedRepresentatives = companyRepresentatives
        .map(rep => {
          const first = (rep.firstName || "").trim();
          const last = (rep.lastName || "").trim();
          const email = (rep.email || "").trim();
          if (!first || !last || !email) return null;
          return { firstName: first, lastName: last, email };
        })
        .filter(Boolean);

      const sanitizedSelections = sanitizeLowestLevelSelections(
        getCategoriesForGroup(formData.selectedGroup) as any,
        selectedCategories,
        selectedSubcategories,
        selectedSubSubcategories
      );

      const categoryDisplayFields = buildDisplayCategoryFields(
        getCategoriesForGroup(formData.selectedGroup) as any,
        sanitizedSelections.selectedCategories,
        sanitizedSelections.selectedSubcategories,
        sanitizedSelections.selectedSubSubcategories
      );

      // Prepare complete payload
      const payload = {
        ...formData,
        billingEmail: formData.billingEmail || formData.email,
        selectedCategories: sanitizedSelections.selectedCategories,
        selectedSubcategories: sanitizedSelections.selectedSubcategories,
        selectedSubSubcategories: sanitizedSelections.selectedSubSubcategories,
        companyRepresentatives: normalizedRepresentatives,
        ...categoryDisplayFields,

        // Business Offerings / Consulting metadata
        bioSafetyLevel: selectedBSL,
        certifications: selectedCerts
          .map(cert => cert.trim())
          .filter(cert => cert && cert !== OTHER_CERT_OPTION && !cert.toLowerCase().startsWith("other:")),
        serviceRegions: selectedRegions,
        serviceCountries: selectedCountries,

        // Event fields
        ...eventData,
        agendaPdfUrl: "",

        // Job fields
        ...jobData,
        jobDescriptionPdfUrl: "",
      };

      const response = await fetch(`${API_BASE_URL}/api/admin/create-partner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create partner");

      const uid = result.uid;
      const listingId = result.listingId;
      const collectionName = result.collectionName;

      // Handle file uploads (Logo)
      let logoUrl = "";
      if (logoFile && uid) {
        const storageRef = ref(storage, `partners/${uid}/logo.png`);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);

        await updateDoc(doc(db, "partnersCollection", uid), { logoUrl });
        const listingDocRef = collectionName === "businessOfferingsCollection"
          ? doc(db, "partnersCollection", uid, "businessOfferingsCollection", listingId)
          : doc(db, collectionName, listingId);
        await updateDoc(listingDocRef, { logoUrl });
      }

      // Handle file uploads (Event Agenda PDF)
      if (eventAgendaPdfFile && uid && listingId) {
        const agendaPdfUrl = await uploadEventAgendaPdf(uid, eventAgendaPdfFile, listingId);
        await updateDoc(doc(db, "partnersCollection", uid), { agendaPdfUrl, agenda: eventData.agendaHighlights });
        await updateDoc(doc(db, "eventsCollection", listingId), { agendaPdfUrl, agenda: eventData.agendaHighlights });
      }

      // Handle file uploads (Job Description PDF)
      if (jobPdfFile && uid && listingId) {
        const jobDescriptionPdfUrl = await uploadJobDescriptionPdf(uid, jobPdfFile, listingId);
        await updateDoc(doc(db, "partnersCollection", uid), { jobDescriptionPdfUrl });
        await updateDoc(doc(db, "jobsCollection", listingId), { jobDescriptionPdfUrl });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-5xl mx-auto p-8 my-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 pb-6 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">ADD PARTNER INFORMATION</h2>
          <p className="text-sm text-slate-500 mt-1">Configure and publish a new partner listing immediately</p>
        </div>
        <div className="inline-flex items-center gap-2 bg-blue-50/50 border border-blue-100 px-4 py-2 rounded-full text-xs text-blue-700 font-bold uppercase tracking-wider">
          <Building2 className="w-4 h-4 text-blue-600" /> Admin Access Mode
        </div>
      </div>

      {/* Step Indicators */}
      <div className="mb-10">
        <div className="flex justify-between items-center max-w-3xl mx-auto relative">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
          <div className="absolute left-0 top-1/2 h-0.5 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-300" style={{ width: `${((activeStep - 1) / 3) * 100}%` }} />

          {[
            { step: 1, label: "Account Info" },
            { step: 2, label: "Company Details" },
            { step: 3, label: "Plan Setup" },
            { step: 4, label: "Taxonomy & Details" },
          ].map(s => (
            <div key={s.step} className="flex flex-col items-center z-10 relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2
                ${activeStep === s.step ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20" :
                  activeStep > s.step ? "bg-green-600 border-green-600 text-white" : "bg-white border-slate-200 text-slate-400"}`}
              >
                {activeStep > s.step ? <Check className="w-5 h-5" /> : s.step}
              </div>
              <span className={`text-xs font-semibold mt-2 ${activeStep === s.step ? "text-blue-600 font-bold" : "text-slate-400"}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-sm font-medium">
          <Info className="w-4 h-4 text-red-600 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* STEP 1: Account Info */}
        {activeStep === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Building className="w-5 h-5 text-blue-500" /> Primary Account Admin</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-slate-600 font-medium">First name <span className="text-red-500">*</span></Label>
                  <Input value={formData.firstName} onChange={(e) => handleChange("firstName", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
                <div>
                  <Label className="text-slate-600 font-medium">Last name <span className="text-red-500">*</span></Label>
                  <Input value={formData.lastName} onChange={(e) => handleChange("lastName", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
                <div>
                  <Label className="text-slate-600 font-medium">Email <span className="text-red-500">*</span></Label>
                  <Input type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
                <div>
                  <Label className="text-slate-600 font-medium">Phone <span className="text-red-500">*</span></Label>
                  <PhoneInput defaultCountry="US" value={formData.phone}
                    onChange={(value) => handleChange("phone", value || '')}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm mt-1.5" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Receipt className="w-5 h-5 text-blue-500" /> Alternate / Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-slate-600 font-medium">Alternate contact first & last name</Label>
                  <Input value={formData.altContactName} onChange={(e) => handleChange("altContactName", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
                <div>
                  <Label className="text-slate-600 font-medium">Alternate email address</Label>
                  <Input type="email" value={formData.altEmail} onChange={(e) => handleChange("altEmail", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-blue-500" /> Password Credentials</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <Label className="text-slate-600 font-medium">Password <span className="text-red-500">*</span></Label>
                  <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => handleChange("password", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500 pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="relative">
                  <Label className="text-slate-600 font-medium">Confirm password <span className="text-red-500">*</span></Label>
                  <Input type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500 pr-10" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600">
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Company Details */}
        {activeStep === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-500" /> Company Profile Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-slate-600 font-medium">Company name <span className="text-red-500">*</span></Label>
                  <Input value={formData.companyName} onChange={(e) => handleChange("companyName", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
                <div>
                  <Label className="text-slate-600 font-medium">Company website <span className="text-red-500">*</span></Label>
                  <Input type="url" placeholder="https://" value={formData.companyWebsite} onChange={(e) => handleChange("companyWebsite", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
                <div>
                  <Label className="text-slate-600 font-medium">Business phone <span className="text-red-500">*</span></Label>
                  <PhoneInput defaultCountry="US" value={formData.businessPhone}
                    onChange={(value) => handleChange("businessPhone", value || '')}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm mt-1.5" />
                </div>
                <div>
                  <Label className="text-slate-600 font-medium">LinkedIn profile</Label>
                  <Input type="url" placeholder="https://linkedin.com/company/..." value={formData.linkedinProfile} onChange={(e) => handleChange("linkedinProfile", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Receipt className="w-5 h-5 text-blue-500" /> Billing / Finance Metadata</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-slate-600 font-medium">Billing Email</Label>
                  <Input type="email" placeholder="finance@company.com" value={formData.billingEmail} onChange={(e) => handleChange("billingEmail", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
                <div>
                  <Label className="text-slate-600 font-medium">Business / Tax ID (VAT/EIN/ABN)</Label>
                  <Input placeholder="EIN / VAT number" value={formData.businessId} onChange={(e) => handleChange("businessId", e.target.value)} className="mt-1.5 bg-white border-slate-200 focus:border-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" /> Headquarters Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-slate-600 font-medium mb-1.5 block">Headquarters Country <span className="text-red-500">*</span></Label>
                  <Select value={formData.businessCountry} onValueChange={(val) => handleSelectChange("businessCountry", val)}>
                    <SelectTrigger className="w-full bg-white border-slate-200">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {SERVICE_COUNTRIES.map(country => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-600 font-medium">Full business address <span className="text-red-500">*</span></Label>
                  <Textarea value={formData.addressHtml} onChange={(e) => handleChange("addressHtml", e.target.value)} className="mt-1.5 bg-white border-slate-200 resize-none h-[100px] text-sm" placeholder="123 Science Way&#10;Suite 100&#10;San Francisco, CA 94107" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-slate-600 font-medium">Company logo</Label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center justify-center px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
                    <UploadCloud className="w-5 h-5 mr-2 text-slate-600" />
                    <span className="text-sm font-semibold text-slate-700">Choose File</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                  <span className="text-sm text-slate-500">
                    {logoFile ? logoFile.name : "No file chosen"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Formats: JPG, JPEG, PNG | Max size: 2MB | Dimensions: 200px x 200px</p>
              </div>

              <div>
                <Label className="text-slate-600 font-medium">Short Company Profile Text <span className="text-red-500">*</span></Label>
                <Textarea value={formData.profileHtml} onChange={(e) => handleChange("profileHtml", e.target.value)} maxLength={COMPANY_PROFILE_MAX_LENGTH} className="mt-1.5 bg-white border-slate-200 resize-none h-[120px] text-sm" placeholder="Briefly describe your company's mission and offerings..." />
                <p className={`text-[11px] mt-1 ${formData.profileHtml.length >= COMPANY_PROFILE_MAX_LENGTH ? 'text-red-500 font-bold' : 'text-slate-400'}`}>{formData.profileHtml.length}/{COMPANY_PROFILE_MAX_LENGTH} characters</p>
              </div>
            </div>

            {/* Representative lists */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <Label className="text-lg font-bold text-slate-800">Company representative(s)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRepresentative}>Add representative</Button>
              </div>
              {companyRepresentatives.length === 0 && (
                <p className="text-xs text-slate-400">Optional: Add representatives who can be contacted directly by members.</p>
              )}
              <div className="space-y-3">
                {companyRepresentatives.map((rep, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-white p-3 rounded-lg border border-slate-200">
                    <Input
                      value={rep.firstName}
                      onChange={(e) => updateRepresentative(index, "firstName", e.target.value)}
                      placeholder="First name"
                      className="bg-white border-slate-200"
                    />
                    <Input
                      value={rep.lastName}
                      onChange={(e) => updateRepresentative(index, "lastName", e.target.value)}
                      placeholder="Last name"
                      className="bg-white border-slate-200"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={rep.email}
                        onChange={(e) => updateRepresentative(index, "email", e.target.value)}
                        placeholder="Email"
                        className="bg-white border-slate-200 flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRepresentative(index)}
                        className="shrink-0 text-red-500 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Plan Setup */}
        {activeStep === 3 && (
          <div className="space-y-6 animate-fadeIn max-w-xl mx-auto">
            <div className="bg-slate-50/50 p-8 rounded-2xl border border-slate-100 space-y-6">
              <div>
                <Label className="text-slate-600 font-bold mb-1.5 block">Select group <span className="text-red-500">*</span></Label>
                <Select value={formData.selectedGroup} onValueChange={(val) => handleSelectChange("selectedGroup", val)}>
                  <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-600 font-bold mb-1.5 block">Payment plans <span className="text-red-500">*</span></Label>
                <Select value={formData.selectedPlan} onValueChange={(val) => handleSelectChange("selectedPlan", val)} disabled={!formData.selectedGroup}>
                  <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                    <SelectValue placeholder={formData.selectedGroup ? "Select plan" : "Select a group first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getPlansForGroup(formData.selectedGroup).map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-600 font-bold mb-1.5 block">Trial Period (for selected plan)</Label>
                <Select value={formData.trialPeriod} onValueChange={(val) => handleSelectChange("trialPeriod", val)}>
                  <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                    <SelectValue placeholder="No Trial" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIAL_PERIOD_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 mt-2">Limits the plan duration. The profile expires when the trial ends.</p>
              </div>

              <div>
                <Label className="text-slate-600 font-bold mb-1.5 block">Featured partner plan (monthly)</Label>
                <Select value={formData.featuredPlan} onValueChange={(val) => handleSelectChange("featuredPlan", val)}>
                  <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                    <SelectValue placeholder="No Feature" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEATURE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 mt-2">Assign a featured spotlight plan to the partner manually.</p>
              </div>

              <div>
                <Label className="text-slate-600 font-bold mb-1.5 block">Admin Partner Status</Label>
                <Select value={formData.status} onValueChange={(val) => handleChange("status", val)}>
                  <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                    <SelectValue placeholder="Pending Review" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending Review">Pending Review</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.selectedPlan && formData.selectedPlan !== "none" && (
                <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-2.5">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Plan Features Included</h4>
                  {getPlanDetailsText(formData.selectedPlan).map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${f.includes("Extra Feature") ? "text-blue-600" : "text-green-500"}`} />
                      <span className={f.includes("Extra Feature") ? "text-blue-600 font-bold" : ""}>{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Classification & Taxonomy selection */}
        {activeStep === 4 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Dynamic fields based on group */}

            {/* ═══ Business Offerings details ═══ */}
            {groupKey === "business_offerings" && (
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
                <h3 className="text-lg font-bold text-slate-800 border-b pb-3 border-slate-100 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-blue-500" /> Classification & Metadata</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
                    <Label className="text-slate-600 font-semibold">Bio Safety Level</Label>
                    <MultiSelectDropdown
                      label="BSL" items={BSL_LEVELS} selected={selectedBSL}
                      onToggle={toggleBSL} open={showBSLDropdown}
                      onToggleOpen={() => { setShowBSLDropdown(!showBSLDropdown); setShowCertsDropdown(false); setShowRegionsDropdown(false); setShowCountriesDropdown(false); }}
                    />
                  </div>
                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
                    <Label className="text-slate-600 font-semibold">Certifications</Label>
                    <MultiSelectDropdown
                      label="certifications" items={CERTIFICATIONS} selected={selectedCerts}
                      onToggle={toggleCert} open={showCertsDropdown}
                      onToggleOpen={() => { setShowCertsDropdown(!showCertsDropdown); setShowBSLDropdown(false); setShowRegionsDropdown(false); setShowCountriesDropdown(false); }}
                    />
                    {showOtherCertInput && (
                      <div className="space-y-1">
                        <Input
                          autoFocus
                          required={showOtherCertInput}
                          value={otherCertText}
                          onChange={(e) => handleOtherCertTextChange(e.target.value)}
                          placeholder='Enter "other" certification'
                          className="bg-white border-slate-200 mt-2"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
                    <Label className="text-slate-600 font-semibold">Service Region(s)</Label>
                    <MultiSelectDropdown
                      label="service regions" items={SERVICE_REGIONS} selected={selectedRegions}
                      onToggle={toggleRegion} open={showRegionsDropdown}
                      onToggleOpen={() => {
                        if (!canUseRegionHelper) return;
                        setShowRegionsDropdown(!showRegionsDropdown);
                        setShowBSLDropdown(false);
                        setShowCertsDropdown(false);
                        setShowCountriesDropdown(false);
                      }}
                    />
                    {!canUseRegionHelper && (
                      <p className="text-[10px] text-slate-400 mt-1">Region helper is available only on plans with unlimited countries.</p>
                    )}
                  </div>
                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
                    <Label className="text-slate-600 font-semibold">
                      Service Country(ies) <span className="text-red-500">*</span> :
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        Selected {selectedCountries.length} of {currentLimits.maxCountries === -1 ? "Unlimited" : currentLimits.maxCountries}
                      </span>
                    </Label>
                    <MultiSelectDropdown
                      label="countries" selected={selectedCountries}
                      onToggle={toggleCountry} open={showCountriesDropdown}
                      onToggleOpen={() => { setShowCountriesDropdown(!showCountriesDropdown); setShowBSLDropdown(false); setShowCertsDropdown(false); setShowRegionsDropdown(false); }}
                      disabled={(c) => !selectedCountries.includes(c) && isCountryLimitReached}
                      search={countrySearch} setSearch={setCountrySearch} filteredItems={filteredCountries}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Consulting details ═══ */}
            {groupKey === "consulting" && (
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
                <h3 className="text-lg font-bold text-slate-800 border-b pb-3 border-slate-100 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" /> Geographic Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
                    <Label className="text-slate-600 font-semibold">Service Region(s)</Label>
                    <MultiSelectDropdown
                      label="service regions" items={SERVICE_REGIONS} selected={selectedRegions}
                      onToggle={toggleRegion} open={showRegionsDropdown}
                      onToggleOpen={() => {
                        if (!canUseRegionHelper) return;
                        setShowRegionsDropdown(!showRegionsDropdown);
                        setShowCountriesDropdown(false);
                      }}
                    />
                    {!canUseRegionHelper && (
                      <p className="text-[10px] text-slate-400 mt-1">Region helper is available only on plans with unlimited countries.</p>
                    )}
                  </div>
                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
                    <Label className="text-slate-600 font-semibold">
                      Service Country(ies) <span className="text-red-500">*</span> :
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        Selected {selectedCountries.length} of {currentLimits.maxCountries === -1 ? "Unlimited" : currentLimits.maxCountries}
                      </span>
                    </Label>
                    <MultiSelectDropdown
                      label="countries" selected={selectedCountries}
                      onToggle={toggleCountry} open={showCountriesDropdown}
                      onToggleOpen={() => { setShowCountriesDropdown(!showCountriesDropdown); setShowRegionsDropdown(false); }}
                      disabled={(c) => !selectedCountries.includes(c) && isCountryLimitReached}
                      search={countrySearch} setSearch={setCountrySearch} filteredItems={filteredCountries}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Events details ═══ */}
            {groupKey === "events" && (
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
                <h3 className="text-lg font-bold text-slate-800 border-b pb-3 border-slate-100 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-500" /> Event Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Label className="text-slate-600 font-semibold">Event Name <span className="text-red-500">*</span></Label>
                    <Input value={eventData.eventName} onChange={e => setEventData(prev => ({ ...prev, eventName: e.target.value }))} className="mt-1.5 bg-white border-slate-200" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-slate-600 font-semibold">Event Web Link <span className="text-red-500">*</span></Label>
                    <Input type="url" placeholder="https://" value={eventData.eventLink} onChange={e => setEventData(prev => ({ ...prev, eventLink: e.target.value }))} className="mt-1.5 bg-white border-slate-200" />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Start date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={eventData.startDate}
                      onChange={e => {
                        const v = e.target.value;
                        setEventData(prev => {
                          let end = prev.endDate;
                          if (formData.selectedPlan === "basic_event") end = v;
                          else if (end && v && end < v) end = v;
                          return { ...prev, startDate: v, endDate: end };
                        });
                      }}
                      className="mt-1.5 bg-white border-slate-200"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">{formData.selectedPlan === "basic_event" ? "Event date" : "End date"} <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={eventData.endDate}
                      onChange={e => setEventData(prev => ({ ...prev, endDate: e.target.value }))}
                      disabled={formData.selectedPlan === "basic_event"}
                      className="mt-1.5 bg-white border-slate-200"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Event Country <span className="text-red-500">*</span></Label>
                    <Select value={eventData.eventCountry} onValueChange={val => setEventData(prev => ({ ...prev, eventCountry: val }))}>
                      <SelectTrigger className="w-full bg-white border-slate-200 mt-1.5">
                        <SelectValue placeholder="Choose country" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {SERVICE_COUNTRIES.map(country => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">State / Region</Label>
                    <Input value={eventData.stateRegion} onChange={e => setEventData(prev => ({ ...prev, stateRegion: e.target.value }))} className="mt-1.5 bg-white border-slate-200" />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">City</Label>
                    <Input value={eventData.city} onChange={e => setEventData(prev => ({ ...prev, city: e.target.value }))} className="mt-1.5 bg-white border-slate-200" />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Location Venue / Address <span className="text-red-500">*</span></Label>
                    <Input value={eventData.location} onChange={e => setEventData(prev => ({ ...prev, location: e.target.value }))} className="mt-1.5 bg-white border-slate-200" placeholder="e.g. Moscone Center, Hall A" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-slate-600 font-semibold">Event Description / Profile</Label>
                    <Textarea value={eventData.eventProfile} onChange={e => setEventData(prev => ({ ...prev, eventProfile: e.target.value }))} className="mt-1.5 bg-white border-slate-200 resize-none h-[120px] text-sm" placeholder="Provide full description of the event, attendees, scope..." />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-slate-600 font-semibold">Agenda Highlights (Max 500 characters) *</Label>
                    <Textarea value={eventData.agendaHighlights} onChange={e => setEventData(prev => ({ ...prev, agendaHighlights: e.target.value.slice(0, 500) }))} className="mt-1.5 bg-white border-slate-200 resize-none h-[100px] text-sm" placeholder="List key speakers, workshops, topics..." />
                    <p className={`text-[10px] mt-1 ${eventData.agendaHighlights.length >= 500 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>{eventData.agendaHighlights.length}/500 characters</p>
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold block mb-2">Upload Event Agenda PDF</Label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center justify-center px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
                        <UploadCloud className="w-5 h-5 mr-2 text-slate-600" />
                        <span className="text-sm font-semibold text-slate-700">Choose PDF</span>
                        <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files && setEventAgendaPdfFile(e.target.files[0])} />
                      </label>
                      <span className="text-sm text-slate-500">
                        {eventAgendaPdfFile ? eventAgendaPdfFile.name : "No PDF chosen"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Jobs details ═══ */}
            {groupKey === "jobs" && (
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
                <h3 className="text-lg font-bold text-slate-800 border-b pb-3 border-slate-100 flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-500" /> Job Opportunity Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-slate-600 font-semibold">Position / Job Title <span className="text-red-500">*</span></Label>
                    <Input value={jobData.jobTitle} onChange={e => setJobData(prev => ({ ...prev, jobTitle: e.target.value }))} className="mt-1.5 bg-white border-slate-200" />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Industry / Area</Label>
                    <Input value={jobData.industry} onChange={e => setJobData(prev => ({ ...prev, industry: e.target.value }))} className="mt-1.5 bg-white border-slate-200" placeholder="e.g. Biotechnology, Manufacturing" />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Position Type <span className="text-red-500">*</span></Label>
                    <Select value={jobData.positionType} onValueChange={val => setJobData(prev => ({ ...prev, positionType: val }))}>
                      <SelectTrigger className="w-full bg-white border-slate-200 mt-1.5">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full-Time">Full-Time</SelectItem>
                        <SelectItem value="Part-Time">Part-Time</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                        <SelectItem value="Internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Experience Level</Label>
                    <Select value={jobData.experienceLevel} onValueChange={val => setJobData(prev => ({ ...prev, experienceLevel: val }))}>
                      <SelectTrigger className="w-full bg-white border-slate-200 mt-1.5">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Entry-level">Entry-level</SelectItem>
                        <SelectItem value="Mid-level">Mid-level</SelectItem>
                        <SelectItem value="Senior-level">Senior-level</SelectItem>
                        <SelectItem value="Executive">Executive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-slate-600 font-semibold">Application / Information Link</Label>
                    <Input type="url" placeholder="https://" value={jobData.positionLink} onChange={e => setJobData(prev => ({ ...prev, positionLink: e.target.value }))} className="mt-1.5 bg-white border-slate-200" />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Job Location Country <span className="text-red-500">*</span></Label>
                    <Select value={jobData.jobCountry} onValueChange={val => setJobData(prev => ({ ...prev, jobCountry: val }))}>
                      <SelectTrigger className="w-full bg-white border-slate-200 mt-1.5">
                        <SelectValue placeholder="Choose country" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {SERVICE_COUNTRIES.map(country => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">State / Region</Label>
                    <Input value={jobData.stateRegion} onChange={e => setJobData(prev => ({ ...prev, stateRegion: e.target.value }))} className="mt-1.5 bg-white border-slate-200" />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">City</Label>
                    <Input value={jobData.city} onChange={e => setJobData(prev => ({ ...prev, city: e.target.value }))} className="mt-1.5 bg-white border-slate-200" />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Office Venue / Location <span className="text-red-500">*</span></Label>
                    <Input value={jobData.location} onChange={e => setJobData(prev => ({ ...prev, location: e.target.value }))} className="mt-1.5 bg-white border-slate-200" placeholder="e.g. Headquarters, Bldg B" />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Work Model</Label>
                    <Select value={jobData.workModel} onValueChange={val => setJobData(prev => ({ ...prev, workModel: val }))}>
                      <SelectTrigger className="w-full bg-white border-slate-200 mt-1.5">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="On-site">On-site</SelectItem>
                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                        <SelectItem value="Remote">Remote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold">Application Deadline</Label>
                    <Input type="date" value={jobData.applicationDeadline} onChange={e => setJobData(prev => ({ ...prev, applicationDeadline: e.target.value }))} className="mt-1.5 bg-white border-slate-200" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-slate-600 font-semibold">Education Requirement</Label>
                    <Input value={jobData.education} onChange={e => setJobData(prev => ({ ...prev, education: e.target.value }))} className="mt-1.5 bg-white border-slate-200" placeholder="e.g. Ph.D. in Biological Sciences, BS in Chemistry" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-slate-600 font-semibold">Job Summary / Brief Role Description *</Label>
                    <Textarea value={jobData.jobSummary} onChange={e => setJobData(prev => ({ ...prev, jobSummary: e.target.value }))} className="mt-1.5 bg-white border-slate-200 resize-none h-[120px] text-sm" placeholder="Provide a summary of key duties, expectations..." />
                  </div>
                  <div>
                    <Label className="text-slate-600 font-semibold block mb-2">Upload Job Description PDF</Label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center justify-center px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
                        <UploadCloud className="w-5 h-5 mr-2 text-slate-600" />
                        <span className="text-sm font-semibold text-slate-700">Choose PDF</span>
                        <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files && setJobPdfFile(e.target.files[0])} />
                      </label>
                      <span className="text-sm text-slate-500">
                        {jobPdfFile ? jobPdfFile.name : "No PDF chosen"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Categories selection tree (shared by all) ═══ */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 border-slate-100 gap-2">
                <div>
                  <Label className="text-lg font-bold text-slate-800">Categories & Specializations *</Label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Selected {categoryCount} of {currentLimits.maxCategories === -1 ? "Unlimited" : currentLimits.maxCategories} categories
                  </p>
                </div>
                {canSelectAllCategories && (
                  <Button type="button" variant="outline" size="sm" onClick={handleSelectAllCategories}>Select All Categories</Button>
                )}
              </div>

              <div className="max-h-[360px] overflow-y-auto bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                {renderCategoryTree()}
              </div>

              {/* Selected summary badges */}
              {(selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedSubSubcategories.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedCategories.map(c => (
                    <span key={c} onClick={() => toggleCategorySelection(c, false)} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                      {c} <X className="w-3 h-3" />
                    </span>
                  ))}
                  {selectedSubcategories.map(s => (
                    <span key={s} onClick={() => toggleSubcategorySelection(s, false)} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-100 cursor-pointer hover:bg-green-100 transition-colors">
                      {s} <X className="w-3 h-3" />
                    </span>
                  ))}
                  {selectedSubSubcategories.map(ss => (
                    <span key={ss} onClick={() => toggleSubSubcategorySelection(ss)} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-100 cursor-pointer hover:bg-purple-100 transition-colors">
                      {ss} <X className="w-3 h-3" />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Steps navigation footer */}
        <div className="flex justify-between items-center pt-6 border-t border-slate-100 mt-8">
          <div>
            {activeStep > 1 && (
              <Button type="button" variant="outline" onClick={handleBack} disabled={loading} className="rounded-xl px-5">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-4">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="rounded-xl">
              Cancel
            </Button>

            {activeStep < 4 ? (
              <Button type="button" onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 shadow-lg shadow-blue-500/10">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Partner...
                  </>
                ) : (
                  "Create Partner"
                )}
              </Button>
            )}
          </div>
        </div>

      </form>
    </div>
  );
}

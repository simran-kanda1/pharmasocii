import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  MoreVertical,
  Receipt,
  Search,
  SearchX,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { db, auth } from "@/firebase";
import { logActivity } from "@/lib/auditLogger";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AdminTab = "overview" | "partners" | "listings" | "transactions" | "audit";
type ListingFilter = "all" | "pending" | "approved" | "disabled";

type PartnerRecord = {
  id: string;
  businessName?: string;
  primaryName?: string;
  primaryEmail?: string;
  companyWebsite?: string;
  phoneNumber?: string;
  businessAddress?: string;
  partnerStatus?: string;
  [key: string]: any;
};

type ListingRecord = {
  id: string;
  businessName?: string;
  companyWebsite?: string;
  selectedPlan?: string;
  status?: string;
  active?: boolean;
  selectedCategories?: string[];
  serviceCountries?: string[];
  serviceRegions?: string[];
  companyProfileText?: string;
  businessAddress?: string;
  createdAt?: { seconds?: number };
  __col: string;
  __path: string;
  [key: string]: any;
};

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const getCollectionLabel = (collectionName: string) => {
  switch (collectionName) {
    case "businessOfferingsCollection":
      return "Business Offering";
    case "consultingServicesCollection":
      return "Consulting Service";
    case "eventsCollection":
      return "Event";
    case "jobsCollection":
      return "Job";
    default:
      return collectionName;
  }
};

const getStatusBadge = (status?: string) => {
  switch (status) {
    case "Approved":
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Approved</Badge>;
    case "Pending Review":
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>;
    case "Disabled":
      return <Badge className="bg-slate-200 text-slate-700 border-slate-300">Disabled</Badge>;
    case "Rejected":
      return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status || "Unknown"}</Badge>;
  }
};

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [listingSearchTerm, setListingSearchTerm] = useState("");
  const [listingFilter, setListingFilter] = useState<ListingFilter>("all");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState("");

  const [selectedPartner, setSelectedPartner] = useState<PartnerRecord | null>(null);
  const [partnerEditor, setPartnerEditor] = useState<Record<string, string>>({});
  const [partnerEditorOpen, setPartnerEditorOpen] = useState(false);

  const [selectedListing, setSelectedListing] = useState<ListingRecord | null>(null);
  const [listingEditor, setListingEditor] = useState<Record<string, string>>({});
  const [listingEditorOpen, setListingEditorOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/admin");
        return;
      }

      const adminDoc = await getDoc(doc(db, "adminCollection", user.uid));
      if (!adminDoc.exists()) {
        navigate("/admin");
        return;
      }

      const adminData = adminDoc.data();
      setIsAuthorized(true);
      setAdminEmail(user.email || "");
      setAdminName(adminData?.name || "Administrator");
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!isAuthorized) return;

    const qPartners = query(collection(db, "partnersCollection"), orderBy("createdAt", "desc"));
    const unsubPartners = onSnapshot(qPartners, (snap) => {
      setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PartnerRecord)));
    });

    const qTransactions = query(collection(db, "transactionsCollection"), orderBy("createdAt", "desc"), limit(50));
    const unsubTransactions = onSnapshot(qTransactions, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const fetchListings = async () => {
      const collectionNames = [
        "businessOfferingsCollection",
        "consultingServicesCollection",
        "eventsCollection",
        "jobsCollection",
      ];
      const allListings: ListingRecord[] = [];

      for (const colName of collectionNames) {
        try {
          const snap = await getDocs(collectionGroup(db, colName));
          snap.docs.forEach((d) => {
            const data = d.data();
            if (data.status !== "pending_payment") {
              allListings.push({
                id: d.id,
                ...data,
                __col: colName,
                __path: d.ref.path,
              } as ListingRecord);
            }
          });
        } catch (error) {
          console.error(`Failed to fetch ${colName}`, error);
        }
      }

      allListings.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setListings(allListings);
    };

    fetchListings();
    const listingsInterval = setInterval(fetchListings, 30000);

    const qAudit = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(100));
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubPartners();
      unsubTransactions();
      unsubAudit();
      clearInterval(listingsInterval);
    };
  }, [isAuthorized]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/admin");
  };

  const openPartnerEditor = (partner: PartnerRecord) => {
    setSelectedPartner(partner);
    setPartnerEditor({
      businessName: partner.businessName || "",
      primaryName: partner.primaryName || "",
      primaryEmail: partner.primaryEmail || "",
      companyWebsite: partner.companyWebsite || "",
      phoneNumber: partner.phoneNumber || "",
      businessAddress: partner.businessAddress || "",
      partnerStatus: partner.partnerStatus || "Pending",
    });
    setPartnerEditorOpen(true);
  };

  const savePartnerEdits = async () => {
    if (!selectedPartner) return;
    try {
      await updateDoc(doc(db, "partnersCollection", selectedPartner.id), {
        businessName: partnerEditor.businessName || "",
        primaryName: partnerEditor.primaryName || "",
        primaryEmail: partnerEditor.primaryEmail || "",
        companyWebsite: partnerEditor.companyWebsite || "",
        phoneNumber: partnerEditor.phoneNumber || "",
        businessAddress: partnerEditor.businessAddress || "",
        partnerStatus: partnerEditor.partnerStatus || "Pending",
      });
      setPartners((prev) =>
        prev.map((p) => (p.id === selectedPartner.id ? { ...p, ...partnerEditor } : p)),
      );

      // Log to Audit Trail
      await logActivity({
        partnerId: selectedPartner.id,
        partnerName: partnerEditor.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Profile updated: ${partnerEditor.businessName} (Contact: ${partnerEditor.primaryName}). Updated by admin: ${adminEmail}`,
        category: "admin",
        metadata: { adminEmail, updatedFields: partnerEditor }
      });

      setSaveNotice("Partner profile updated.");
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update partner profile.");
    }
  };

  const setPartnerStatus = async (partner: PartnerRecord, status: string) => {
    try {
      await updateDoc(doc(db, "partnersCollection", partner.id), { partnerStatus: status });
      setPartners((prev) => prev.map((p) => (p.id === partner.id ? { ...p, partnerStatus: status } : p)));
      if (selectedPartner?.id === partner.id) {
        setPartnerEditor((prev) => ({ ...prev, partnerStatus: status }));
      }

      // Log to Audit Trail
      await logActivity({
        partnerId: partner.id,
        partnerName: partner.businessName || "Unnamed Business",
        action: "ACCOUNT_UPDATED",
        details: `Partner status changed to "${status}" (Business: ${partner.businessName}). Updated by admin: ${adminEmail}`,
        category: "admin",
        metadata: { adminEmail, newStatus: status }
      });

      setSaveNotice(`Partner status set to ${status}.`);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update partner status.");
    }
  };

  const openListingEditor = (listing: ListingRecord) => {
    setSelectedListing(listing);
    setListingEditor({
      businessName: listing.businessName || "",
      companyWebsite: listing.companyWebsite || "",
      selectedPlan: listing.selectedPlan || "",
      status: listing.status || "Pending Review",
      active: `${listing.active ?? true}`,
      selectedCategoriesCsv: (listing.selectedCategories || []).join(", "),
      serviceCountriesCsv: (listing.serviceCountries || []).join(", "),
      serviceRegionsCsv: (listing.serviceRegions || []).join(", "),
      companyProfileText: listing.companyProfileText || "",
      businessAddress: listing.businessAddress || "",
    });
    setListingEditorOpen(true);
  };

  const setListingStatus = async (listing: ListingRecord, status: string, active: boolean) => {
    try {
      await updateDoc(doc(db, listing.__path), { status, active });
      setListings((prev) =>
        prev.map((l) => (l.__path === listing.__path ? { ...l, status, active } : l)),
      );
      if (selectedListing?.__path === listing.__path) {
        setListingEditor((prev) => ({ ...prev, status, active: `${active}` }));
      }

      // Log to Audit Trail
      // Extract partnerId from path: partnersCollection/{partnerId}/{collectionName}/{listingId}
      const partnerId = listing.__path.split('/')[1];

      await logActivity({
        partnerId,
        partnerName: listing.businessName || "Unnamed Business",
        action: "LISTING_UPDATED",
        details: `Listing status for "${listing.businessName}" set to "${status}" (Active: ${active}). Updated by admin: ${adminEmail}`,
        category: "admin",
        metadata: { adminEmail, status, active, listingId: listing.id }
      });

      setSaveNotice(`Listing updated: ${status}.`);
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not update listing status.");
    }
  };

  const saveListingEdits = async () => {
    if (!selectedListing) return;
    try {
      const payload = {
        businessName: listingEditor.businessName || "",
        companyWebsite: listingEditor.companyWebsite || "",
        selectedPlan: listingEditor.selectedPlan || "",
        status: listingEditor.status || "Pending Review",
        active: listingEditor.active === "true",
        selectedCategories: splitCsv(listingEditor.selectedCategoriesCsv || ""),
        serviceCountries: splitCsv(listingEditor.serviceCountriesCsv || ""),
        serviceRegions: splitCsv(listingEditor.serviceRegionsCsv || ""),
        companyProfileText: listingEditor.companyProfileText || "",
        businessAddress: listingEditor.businessAddress || "",
      };

      await updateDoc(doc(db, selectedListing.__path), payload);

      setListings((prev) =>
        prev.map((l) => (l.__path === selectedListing.__path ? { ...l, ...payload } : l)),
      );

      // Log to Audit Trail
      const partnerId = selectedListing.__path.split('/')[1];
      await logActivity({
        partnerId,
        partnerName: payload.businessName || "Unnamed Business",
        action: "LISTING_UPDATED",
        details: `Listing details for "${payload.businessName}" updated by admin (${adminEmail}).`,
        category: "admin",
        metadata: { adminEmail, listingId: selectedListing.id, updatedFields: payload }
      });

      setSaveNotice("Listing updated.");
    } catch (error) {
      console.error(error);
      setSaveNotice("Could not save listing changes.");
    }
  };

  const filteredPartners = useMemo(
    () =>
      partners.filter(
        (p) =>
          p.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.primaryEmail?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [partners, searchTerm],
  );

  const pendingListings = listings.filter((l) => l.status === "Pending Review");
  const approvedListings = listings.filter((l) => l.status === "Approved");
  const disabledListings = listings.filter((l) => l.status === "Disabled");

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (listingFilter === "pending" && l.status !== "Pending Review") return false;
      if (listingFilter === "approved" && l.status !== "Approved") return false;
      if (listingFilter === "disabled" && l.status !== "Disabled") return false;

      if (!listingSearchTerm) return true;

      const q = listingSearchTerm.toLowerCase();
      return (
        l.businessName?.toLowerCase().includes(q) ||
        l.selectedCategories?.some((c) => c.toLowerCase().includes(q)) ||
        l.selectedPlan?.toLowerCase().includes(q)
      );
    });
  }, [listingFilter, listingSearchTerm, listings]);

  const stats = {
    totalRevenue: transactions.reduce((acc, t) => acc + (t.amount || 0), 0),
    totalPartners: partners.length,
    pendingApprovals: partners.filter((p) => p.partnerStatus === "Pending").length,
    pendingListings: pendingListings.length,
    activeListings: approvedListings.length,
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-slate-500">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="p-7">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <h1 className="font-semibold text-lg">Admin Console</h1>
          </div>

          <nav className="space-y-1.5">
            <SidebarItem label="Overview" icon={LayoutDashboard} active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <SidebarItem label="Partners" icon={Users} active={activeTab === "partners"} onClick={() => setActiveTab("partners")} badge={stats.pendingApprovals > 0 ? stats.pendingApprovals : undefined} />
            <SidebarItem label="Listings" icon={FileText} active={activeTab === "listings"} onClick={() => setActiveTab("listings")} badge={stats.pendingListings > 0 ? stats.pendingListings : undefined} />
            <SidebarItem label="Transactions" icon={Receipt} active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")} />
            <SidebarItem label="Audit Trail" icon={History} active={activeTab === "audit"} onClick={() => setActiveTab("audit")} />
          </nav>
        </div>

        <div className="mt-auto p-5 border-t border-slate-200 space-y-2">
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full justify-start text-slate-600">
            <ExternalLink className="w-4 h-4 mr-2" /> Back to site
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <header className="h-20 border-b border-slate-200 bg-white flex items-center justify-between px-10 sticky top-0 z-40">
          <h2 className="text-xl font-semibold capitalize">{activeTab}</h2>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{adminName}</p>
              <p className="text-xs text-slate-500">{adminEmail}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-600" />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-6">
          {saveNotice && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-800">
              {saveNotice}
            </div>
          )}

          {activeTab === "overview" && (
            <OverviewTab
              stats={stats}
              transactions={transactions}
              pendingListings={pendingListings}
              onApproveListing={(listing: ListingRecord) => setListingStatus(listing, "Approved", true)}
              onViewListing={openListingEditor}
            />
          )}

          {activeTab === "partners" && (
            <div className="space-y-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search partners by business or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white border-slate-200"
                />
              </div>
              <PartnerList
                partners={filteredPartners}
                onView={openPartnerEditor}
                onSetStatus={setPartnerStatus}
              />
            </div>
          )}

          {activeTab === "listings" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search listings by business, category, or plan..."
                    value={listingSearchTerm}
                    onChange={(e) => setListingSearchTerm(e.target.value)}
                    className="pl-10 h-11 bg-white border-slate-200"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button variant={listingFilter === "all" ? "default" : "outline"} onClick={() => setListingFilter("all")}>
                    All ({listings.length})
                  </Button>
                  <Button variant={listingFilter === "pending" ? "default" : "outline"} onClick={() => setListingFilter("pending")}>
                    <Clock className="w-4 h-4 mr-2" /> Pending ({pendingListings.length})
                  </Button>
                  <Button variant={listingFilter === "approved" ? "default" : "outline"} onClick={() => setListingFilter("approved")}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approved ({approvedListings.length})
                  </Button>
                  <Button variant={listingFilter === "disabled" ? "default" : "outline"} onClick={() => setListingFilter("disabled")}>
                    <Ban className="w-4 h-4 mr-2" /> Disabled ({disabledListings.length})
                  </Button>
                </div>
              </div>

              <ListingsList
                listings={filteredListings}
                onView={openListingEditor}
                onSetStatus={setListingStatus}
              />
            </div>
          )}

          {activeTab === "transactions" && <TransactionList transactions={transactions} />}

          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search audit logs by company name..."
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white border-slate-200"
                />
              </div>
              <AuditLogList
                logs={auditLogs.filter(log => {
                  if (!auditSearchTerm) return true;
                  const q = auditSearchTerm.toLowerCase();
                  return (
                    log.partnerName?.toLowerCase().includes(q) ||
                    log.action?.toLowerCase().includes(q) ||
                    log.details?.toLowerCase().includes(q) ||
                    log.partnerId?.toLowerCase().includes(q)
                  );
                })}
              />
            </div>
          )}
        </div>
      </main>

      <Sheet open={partnerEditorOpen} onOpenChange={setPartnerEditorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-slate-100 flex-row items-center justify-between space-y-0">
            <div>
              <SheetTitle>Edit Partner Profile</SheetTitle>
              <SheetDescription>Update partner's information and account status</SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                setActiveTab("audit");
                setAuditSearchTerm(selectedPartner?.id || "");
                setPartnerEditorOpen(false);
              }}
            >
              <History className="w-4 h-4" />
              View History
            </Button>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <Field label="Business Name" value={partnerEditor.businessName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, businessName: v }))} />
            <Field label="Primary Contact Name" value={partnerEditor.primaryName || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, primaryName: v }))} />
            <Field label="Primary Email" value={partnerEditor.primaryEmail || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, primaryEmail: v }))} />
            <Field label="Company Website" value={partnerEditor.companyWebsite || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, companyWebsite: v }))} />
            <Field label="Phone Number" value={partnerEditor.phoneNumber || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, phoneNumber: v }))} />
            <Field label="Account Status (Approved, Pending, Disabled)" value={partnerEditor.partnerStatus || ""} onChange={(v) => setPartnerEditor((prev) => ({ ...prev, partnerStatus: v }))} />
            <div className="space-y-1">
              <p className="text-sm font-medium">Business Address</p>
              <Textarea
                value={partnerEditor.businessAddress || ""}
                onChange={(e) => setPartnerEditor((prev) => ({ ...prev, businessAddress: e.target.value }))}
                className="min-h-24"
              />
            </div>
            <Button onClick={savePartnerEdits} className="w-full">Save Partner Changes</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={listingEditorOpen} onOpenChange={setListingEditorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b border-slate-100 flex-row items-center justify-between space-y-0">
            <div>
              <SheetTitle>Listing Details</SheetTitle>
              <SheetDescription>Inspect and manually edit listing information.</SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                if (selectedListing) {
                  const pId = selectedListing.__path.split('/')[1];
                  setActiveTab("audit");
                  setAuditSearchTerm(pId);
                  setListingEditorOpen(false);
                }
              }}
            >
              <History className="w-4 h-4" />
              View Profile History
            </Button>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <Field label="Business Name" value={listingEditor.businessName || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, businessName: v }))} />
            <Field label="Company Website" value={listingEditor.companyWebsite || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, companyWebsite: v }))} />
            <Field label="Plan" value={listingEditor.selectedPlan || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, selectedPlan: v }))} />
            <Field label="Status (Approved, Pending Review, Disabled)" value={listingEditor.status || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, status: v }))} />
            <Field label="Active (true or false)" value={listingEditor.active || "true"} onChange={(v) => setListingEditor((prev) => ({ ...prev, active: v }))} />
            <Field label="Categories (comma separated)" value={listingEditor.selectedCategoriesCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, selectedCategoriesCsv: v }))} />
            <Field label="Service Countries (comma separated)" value={listingEditor.serviceCountriesCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, serviceCountriesCsv: v }))} />
            <Field label="Service Regions (comma separated)" value={listingEditor.serviceRegionsCsv || ""} onChange={(v) => setListingEditor((prev) => ({ ...prev, serviceRegionsCsv: v }))} />
            <div className="space-y-1">
              <p className="text-sm font-medium">Company Profile</p>
              <Textarea
                value={listingEditor.companyProfileText || ""}
                onChange={(e) => setListingEditor((prev) => ({ ...prev, companyProfileText: e.target.value }))}
                className="min-h-24"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Business Address</p>
              <Textarea
                value={listingEditor.businessAddress || ""}
                onChange={(e) => setListingEditor((prev) => ({ ...prev, businessAddress: e.target.value }))}
                className="min-h-24"
              />
            </div>
            <Button onClick={saveListingEdits} className="w-full">Save Listing Changes</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarItem({
  label,
  icon: Icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: any;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
      {badge ? (
        <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
          {badge}
        </span>
      ) : (
        active && <ChevronRight className="ml-auto w-4 h-4 text-white/80" />
      )}
    </button>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string | number;
  icon: any;
  iconClass: string;
}) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
          <div className={`p-2 rounded-md ${iconClass}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({
  stats,
  transactions,
  pendingListings,
  onApproveListing,
  onViewListing,
}: {
  stats: any;
  transactions: any[];
  pendingListings: ListingRecord[];
  onApproveListing: (listing: ListingRecord) => void;
  onViewListing: (listing: ListingRecord) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} icon={Receipt} iconClass="bg-emerald-100 text-emerald-700" />
        <StatCard label="Partners" value={stats.totalPartners} icon={Users} iconClass="bg-sky-100 text-sky-700" />
        <StatCard label="Pending Partners" value={stats.pendingApprovals} icon={AlertCircle} iconClass="bg-amber-100 text-amber-700" />
        <StatCard label="Pending Listings" value={stats.pendingListings} icon={Clock} iconClass="bg-amber-100 text-amber-700" />
        <StatCard label="Live Listings" value={stats.activeListings} icon={BadgeCheck} iconClass="bg-indigo-100 text-indigo-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest 7 successful platform payments.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Partner</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right pr-6">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 7).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-6">{t.customerEmail || "-"}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">${t.amount?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell className="text-right pr-6 text-slate-500">
                      {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Listings Pending Review</CardTitle>
            <CardDescription>Approve or inspect before publishing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingListings.length === 0 ? (
              <p className="text-sm text-slate-500">No pending listings right now.</p>
            ) : (
              pendingListings.slice(0, 5).map((listing) => (
                <div key={listing.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-medium">{listing.businessName || "Unnamed"}</p>
                  <p className="text-xs text-slate-500 mb-3">{listing.selectedPlan?.replace(/_/g, " ") || "-"}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => onApproveListing(listing)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onViewListing(listing)}>
                      <Eye className="w-4 h-4 mr-1" /> Review
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PartnerList({
  partners,
  onView,
  onSetStatus,
}: {
  partners: PartnerRecord[];
  onView: (partner: PartnerRecord) => void;
  onSetStatus: (partner: PartnerRecord, status: string) => void;
}) {
  if (partners.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <SearchX className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No partners found</h3>
        <p className="text-sm text-slate-500">Try a different business name or email.</p>
      </div>
    );
  }

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Business</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((partner) => (
              <TableRow key={partner.id}>
                <TableCell className="pl-6">
                  <p className="font-medium">{partner.businessName || "Unnamed Business"}</p>
                  <p className="text-xs text-slate-500">{partner.companyWebsite || "-"}</p>
                </TableCell>
                <TableCell>{getStatusBadge(partner.partnerStatus)}</TableCell>
                <TableCell>
                  <p className="text-sm">{partner.primaryName || "-"}</p>
                  <p className="text-xs text-slate-500">{partner.primaryEmail || "-"}</p>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[190px]">
                      <DropdownMenuLabel>Partner Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onView(partner)}>
                        <Eye className="w-4 h-4 mr-2" /> View / Edit profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onSetStatus(partner, "Approved")}>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSetStatus(partner, "Pending")}>
                        <Clock className="w-4 h-4 mr-2 text-amber-600" /> Unapprove (set pending)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSetStatus(partner, "Disabled")}>
                        <Ban className="w-4 h-4 mr-2 text-rose-600" /> Disable account
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ListingsList({
  listings,
  onView,
  onSetStatus,
}: {
  listings: ListingRecord[];
  onView: (listing: ListingRecord) => void;
  onSetStatus: (listing: ListingRecord, status: string, active: boolean) => void;
}) {
  if (listings.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <FileText className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No listings found</h3>
        <p className="text-sm text-slate-500">Listings will appear here once created.</p>
      </div>
    );
  }

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Business</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => (
              <TableRow key={listing.__path}>
                <TableCell className="pl-6">
                  <p className="font-medium">{listing.businessName || "Unnamed"}</p>
                  <p className="text-xs text-slate-500">{listing.companyWebsite || "-"}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getCollectionLabel(listing.__col)}</Badge>
                </TableCell>
                <TableCell>{listing.selectedPlan?.replace(/_/g, " ") || "-"}</TableCell>
                <TableCell>{getStatusBadge(listing.status)}</TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {listing.createdAt?.seconds
                    ? new Date(listing.createdAt.seconds * 1000).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell className="text-right pr-6">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[210px]">
                      <DropdownMenuLabel>Listing Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onView(listing)}>
                        <Eye className="w-4 h-4 mr-2" /> View / Edit listing
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onSetStatus(listing, "Approved", true)}>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Approve listing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSetStatus(listing, "Pending Review", false)}>
                        <Clock className="w-4 h-4 mr-2 text-amber-600" /> Unapprove (pending review)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSetStatus(listing, "Disabled", false)}>
                        <Ban className="w-4 h-4 mr-2 text-rose-600" /> Disable listing
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TransactionList({ transactions }: { transactions: any[] }) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <Receipt className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No transactions recorded</h3>
        <p className="text-sm text-slate-500">Transactions appear here after checkout.</p>
      </div>
    );
  }

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Partner</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Plan ID</TableHead>
              <TableHead>Listing ID</TableHead>
              <TableHead>Partner ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right pr-6">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="pl-6">
                  <div className="space-y-0.5">
                    <p>{t.customerEmail || "-"}</p>
                    <p className="text-xs text-slate-500">{t.collectionName || "-"}</p>
                  </div>
                </TableCell>
                <TableCell>{t.businessName || "-"}</TableCell>
                <TableCell>{t.group?.replace(/_/g, " ") || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{t.planId || t.planName || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{t.listingId || "-"}</TableCell>
                <TableCell className="font-mono text-xs max-w-[220px] truncate">{t.partnerId || "-"}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      t.status === "succeeded"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : t.status === "pending"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                    }
                  >
                    {t.status || "-"}
                  </Badge>
                </TableCell>
                <TableCell className="font-semibold text-emerald-700">
                  {t.currency === "gbp" ? "£" : "$"}
                  {typeof t.amount === "number" ? t.amount.toFixed(2) : "0.00"}
                </TableCell>
                <TableCell className="text-right pr-6 text-slate-500">
                  {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AuditLogList({ logs }: { logs: any[] }) {
  if (logs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <History className="w-10 h-10 text-slate-300 mb-3 mx-auto" />
        <h3 className="font-semibold">No audit logs found</h3>
        <p className="text-sm text-slate-500">Activity will appear here as it happens.</p>
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case "ACCOUNT_CREATED":
        return <Badge className="bg-sky-50 text-sky-700 border-sky-200">Account Created</Badge>;
      case "ACCOUNT_UPDATED":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Account Updated</Badge>;
      case "PAYMENT_SUCCESS":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Payment Success</Badge>;
      case "PAYMENT_FAILED":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Payment Failed</Badge>;
      case "LISTING_UPDATED":
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Listing Updated</Badge>;
      case "FEATURE_ADDED":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Feature Added</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Timestamp</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right pr-6">Partner ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="pl-6 text-sm text-slate-500 whitespace-nowrap">
                  {log.timestamp?.seconds
                    ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                    : "Recently"}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{log.partnerName || "Unknown"}</TableCell>
                <TableCell>{getActionBadge(log.action)}</TableCell>
                <TableCell className="text-sm text-slate-600 max-w-md">{log.details}</TableCell>
                <TableCell className="text-right pr-6 font-mono text-[10px] text-slate-400">
                  {log.partnerId || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

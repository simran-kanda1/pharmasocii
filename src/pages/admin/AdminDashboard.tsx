import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard, Users, Receipt, ShieldCheck,
    Search, Filter, ExternalLink, CheckCircle2,
    User, BadgeCheck, FileText,
    ChevronRight, MoreVertical, Globe, Tag,
    SearchX, AlertCircle, Ban, Eye, Clock, MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { db } from "@/firebase";
import { collection, query, onSnapshot, doc, updateDoc, orderBy, limit, collectionGroup, getDocs } from "firebase/firestore";

type AdminTab = "overview" | "partners" | "listings" | "transactions";

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<AdminTab>("overview");
    const [partners, setPartners] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [listings, setListings] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [listingSearchTerm, setListingSearchTerm] = useState("");
    const [listingFilter, setListingFilter] = useState<"all" | "pending" | "approved">("all");

    useEffect(() => {
        // Restricted to admins - In a real app, you'd check a custom claim or roles doc
        // For now, we assume anyone who gets here is authorized (protected by App.tsx)

        const qPartners = query(collection(db, "partnersCollection"), orderBy("createdAt", "desc"));
        const unsubPartners = onSnapshot(qPartners, (snap) => {
            setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const qTrans = query(collection(db, "transactionsCollection"), orderBy("createdAt", "desc"), limit(50));
        const unsubTrans = onSnapshot(qTrans, (snap) => {
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Fetch all listings from all sub-collections
        const fetchListings = async () => {
            const collectionNames = ["businessOfferingsCollection", "consultingServicesCollection", "eventsCollection", "jobsCollection"];
            const allListings: any[] = [];
            
            for (const colName of collectionNames) {
                try {
                    const snap = await getDocs(collectionGroup(db, colName));
                    snap.docs.forEach(d => {
                        const data = d.data();
                        // Only include listings that have been paid for (not pending_payment)
                        if (data.status !== "pending_payment") {
                            allListings.push({
                                id: d.id,
                                ...data,
                                __col: colName,
                                __path: d.ref.path, // Store full path for updates
                            });
                        }
                    });
                } catch (err) {
                    console.error(`Error fetching ${colName}:`, err);
                }
            }
            
            // Sort by createdAt descending
            allListings.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setListings(allListings);
        };
        
        fetchListings();
        // Refresh listings every 30 seconds
        const listingsInterval = setInterval(fetchListings, 30000);

        return () => { 
            unsubPartners(); 
            unsubTrans(); 
            clearInterval(listingsInterval);
        };
    }, []);

    const handleApprove = async (partnerId: string) => {
        try {
            await updateDoc(doc(db, "partnersCollection", partnerId), {
                partnerStatus: "Approved"
            });
        } catch (err) { console.error(err); }
    };

    const handleCancel = async (partnerId: string) => {
        try {
            await updateDoc(doc(db, "partnersCollection", partnerId), {
                partnerStatus: "Cancelled"
            });
        } catch (err) { console.error(err); }
    };

    const handleApproveListing = async (listing: any) => {
        try {
            // Parse the path to get partnerId and collection
            const pathParts = listing.__path.split('/');
            const partnerId = pathParts[1];
            const colName = pathParts[2];
            const listingId = pathParts[3];
            
            await updateDoc(doc(db, "partnersCollection", partnerId, colName, listingId), {
                status: "Approved"
            });
            
            // Update local state
            setListings(prev => prev.map(l => 
                l.id === listing.id ? { ...l, status: "Approved" } : l
            ));
        } catch (err) { 
            console.error("Error approving listing:", err); 
        }
    };

    const handleRejectListing = async (listing: any) => {
        try {
            const pathParts = listing.__path.split('/');
            const partnerId = pathParts[1];
            const colName = pathParts[2];
            const listingId = pathParts[3];
            
            await updateDoc(doc(db, "partnersCollection", partnerId, colName, listingId), {
                status: "Rejected",
                active: false
            });
            
            setListings(prev => prev.map(l => 
                l.id === listing.id ? { ...l, status: "Rejected", active: false } : l
            ));
        } catch (err) { 
            console.error("Error rejecting listing:", err); 
        }
    };

    const filteredPartners = partners.filter(p =>
        p.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.primaryEmail?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingListings = listings.filter(l => l.status === "Pending Review");
    const approvedListings = listings.filter(l => l.status === "Approved");
    
    const filteredListings = listings.filter(l => {
        // Filter by status
        if (listingFilter === "pending" && l.status !== "Pending Review") return false;
        if (listingFilter === "approved" && l.status !== "Approved") return false;
        
        // Filter by search
        if (listingSearchTerm) {
            const q = listingSearchTerm.toLowerCase();
            return (
                l.businessName?.toLowerCase().includes(q) ||
                l.selectedCategories?.some((c: string) => c.toLowerCase().includes(q)) ||
                l.selectedPlan?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const stats = {
        totalPartners: partners.length,
        pendingApprovals: partners.filter(p => p.partnerStatus === "Pending").length,
        pendingListings: pendingListings.length,
        totalRevenue: transactions.reduce((acc, t) => acc + (t.amount || 0), 0),
        activeListings: approvedListings.length,
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col shrink-0">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <ShieldCheck className="text-white w-6 h-6" />
                        </div>
                        <h1 className="font-bold text-xl tracking-tight">Admin<span className="text-primary italic">.PS</span></h1>
                    </div>

                    <nav className="space-y-1.5">
                        <SidebarItem id="overview" label="Overview" icon={LayoutDashboard} active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
                        <SidebarItem id="partners" label="Partners" icon={Users} active={activeTab === "partners"} onClick={() => setActiveTab("partners")} badge={stats.pendingApprovals > 0 ? stats.pendingApprovals : undefined} />
                        <SidebarItem id="listings" label="Listings" icon={FileText} active={activeTab === "listings"} onClick={() => setActiveTab("listings")} badge={stats.pendingListings > 0 ? stats.pendingListings : undefined} />
                        <SidebarItem id="transactions" label="Transactions" icon={Receipt} active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")} />
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-white/5">
                    <Button variant="ghost" onClick={() => navigate("/")} className="w-full justify-start text-white/60 hover:text-white hover:bg-white/5">
                        <ExternalLink className="w-4 h-4 mr-3" /> Back to site
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar">
                <header className="h-20 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-10 sticky top-0 z-40">
                    <h2 className="text-xl font-semibold capitalize">{activeTab}</h2>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium">Administrator</p>
                            <p className="text-xs text-white/40">Super User</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center border border-white/10 shadow-lg">
                            <User className="w-5 h-5" />
                        </div>
                    </div>
                </header>

                <div className="p-10 max-w-7xl mx-auto space-y-10">
                    {activeTab === "overview" && <OverviewTab stats={stats} transactions={transactions} pendingListings={pendingListings} onApproveListing={handleApproveListing} />}
                    {activeTab === "partners" && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                    <Input placeholder="Search partners by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11 bg-white/5 border-white/10 focus:border-primary/50 transition-all rounded-xl" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" className="border-white/10 bg-white/5 h-11 px-5 rounded-xl"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
                                </div>
                            </div>
                            <PartnerList partners={filteredPartners} onApprove={handleApprove} onCancel={handleCancel} />
                        </div>
                    )}
                    {activeTab === "listings" && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                    <Input placeholder="Search listings by business name or category..." value={listingSearchTerm} onChange={e => setListingSearchTerm(e.target.value)} className="pl-10 h-11 bg-white/5 border-white/10 focus:border-primary/50 transition-all rounded-xl" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant={listingFilter === "all" ? "default" : "outline"} 
                                        onClick={() => setListingFilter("all")}
                                        className={listingFilter === "all" ? "" : "border-white/10 bg-white/5"}
                                    >
                                        All ({listings.length})
                                    </Button>
                                    <Button 
                                        variant={listingFilter === "pending" ? "default" : "outline"} 
                                        onClick={() => setListingFilter("pending")}
                                        className={listingFilter === "pending" ? "bg-orange-500 hover:bg-orange-600" : "border-white/10 bg-white/5"}
                                    >
                                        <Clock className="w-4 h-4 mr-2" /> Pending ({pendingListings.length})
                                    </Button>
                                    <Button 
                                        variant={listingFilter === "approved" ? "default" : "outline"} 
                                        onClick={() => setListingFilter("approved")}
                                        className={listingFilter === "approved" ? "bg-green-500 hover:bg-green-600" : "border-white/10 bg-white/5"}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Approved ({approvedListings.length})
                                    </Button>
                                </div>
                            </div>
                            <ListingsList listings={filteredListings} onApprove={handleApproveListing} onReject={handleRejectListing} />
                        </div>
                    )}
                    {activeTab === "transactions" && <TransactionList transactions={transactions} />}
                </div>
            </main>
        </div>
    );
}

function SidebarItem({ label, icon: Icon, active, onClick, badge }: any) {
    return (
        <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
            {badge && (
                <span className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-orange-500 text-white">{badge}</span>
            )}
            {active && !badge && <ChevronRight className="ml-auto w-4 h-4 text-white/50" />}
        </button>
    );
}

function OverviewTab({ stats, transactions, pendingListings, onApproveListing }: any) {
    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <StatCard label="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} icon={Receipt} color="text-green-500" bg="bg-green-500/10" trend="+12.5%" />
                <StatCard label="Total Partners" value={stats.totalPartners} icon={Users} color="text-blue-500" bg="bg-blue-500/10" />
                <StatCard label="Partner Approvals" value={stats.pendingApprovals} icon={AlertCircle} color="text-orange-500" bg="bg-orange-500/10" />
                <StatCard label="Listing Reviews" value={stats.pendingListings} icon={Clock} color="text-yellow-500" bg="bg-yellow-500/10" />
                <StatCard label="Live Listings" value={stats.activeListings} icon={BadgeCheck} color="text-primary" bg="bg-primary/10" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <Card className="lg:col-span-2 bg-black/40 border-white/10 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold">Recent Transactions</CardTitle>
                            <CardDescription className="text-white/40">Latest payments from across the platform</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View all</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-white/40 pl-8">Partner</TableHead>
                                    <TableHead className="text-white/40">Amount</TableHead>
                                    <TableHead className="text-white/40 text-right pr-8">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.slice(0, 7).map((t: any) => (
                                    <TableRow key={t.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                                        <TableCell className="pl-8 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-bold text-xs text-white/50">{t.customerEmail?.[0].toUpperCase()}</div>
                                                <span className="font-medium group-hover:text-primary transition-colors">{t.customerEmail}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell><span className="font-bold text-green-500">${t.amount?.toFixed(2)}</span></TableCell>
                                        <TableCell className="text-right pr-8 text-white/40 text-xs">
                                            {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : "Pending"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-white/10 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-8 border-b border-white/5">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Clock className="w-5 h-5 text-yellow-500" />
                            Listings Pending Review
                        </CardTitle>
                        <CardDescription className="text-white/40">Approve to make live on site</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        {pendingListings.length === 0 ? (
                            <p className="text-white/40 text-center py-4">No listings pending review</p>
                        ) : (
                            pendingListings.slice(0, 5).map((listing: any) => (
                                <div key={listing.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm leading-none truncate">{listing.businessName || "Unnamed"}</p>
                                            <p className="text-xs text-white/40 mt-1">{listing.selectedPlan?.replace(/_/g, ' ').toUpperCase()}</p>
                                        </div>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        onClick={() => onApproveListing(listing)}
                                        className="bg-green-500 hover:bg-green-600 text-white shrink-0"
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                                    </Button>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color, bg, trend }: any) {
    return (
        <Card className="bg-black/40 border-white/10 shadow-xl rounded-3xl backdrop-blur-xl group hover:border-white/20 transition-all duration-300">
            <CardContent className="p-7">
                <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-2xl ${bg} ${color} group-hover:scale-110 transition-transform`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{trend}</span>
                    )}
                </div>
                <div className="space-y-1">
                    <p className="text-white/40 text-sm font-medium">{label}</p>
                    <p className="text-3xl font-black tracking-tight">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function PartnerList({ partners, onApprove, onCancel }: any) {
    if (partners.length === 0) return (
        <div className="bg-black/40 border border-white/10 rounded-3xl p-20 text-center flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
            <SearchX className="w-16 h-16 text-white/10 mb-6" />
            <h3 className="text-xl font-bold mb-2">No partners found</h3>
            <p className="text-white/40">Try adjusting your search or filters.</p>
        </div>
    );

    return (
        <Card className="bg-black/40 border-white/10 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-xl">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-white/40 pl-8 h-14">Business Name</TableHead>
                            <TableHead className="text-white/40">Status</TableHead>
                            <TableHead className="text-white/40">Contact Person</TableHead>
                            <TableHead className="text-white/40 text-right pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {partners.map((p: any) => (
                            <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.02] transition-colors h-20 group">
                                <TableCell className="pl-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/5 flex items-center justify-center font-bold text-white/30">{p.businessName?.[0] || '?'}</div>
                                        <div>
                                            <p className="font-bold text-white group-hover:text-primary transition-colors">{p.businessName || "Unnamed Business"}</p>
                                            {p.companyWebsite && <p className="text-xs text-white/30 truncate max-w-[200px] mt-0.5">{p.companyWebsite}</p>}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge className={
                                        p.partnerStatus === "Approved" ? "bg-green-500/10 text-green-400 border-green-500/30" :
                                            p.partnerStatus === "Pending" ? "bg-orange-500/10 text-orange-400 border-orange-500/30" :
                                                "bg-red-500/10 text-red-500 border-red-500/30"
                                    }>
                                        {p.partnerStatus || "Unknown"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-medium">{p.primaryName}</p>
                                        <p className="text-xs text-white/40">{p.primaryEmail}</p>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="hover:bg-white/10 rounded-full"><MoreVertical className="w-4 h-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-[#0A0A0A] border-white/10 text-white min-w-[160px] p-2 rounded-xl shadow-2xl">
                                            <DropdownMenuLabel className="text-white/40 text-[10px] uppercase font-bold tracking-widest px-3 py-2">Management</DropdownMenuLabel>
                                            <DropdownMenuItem className="cursor-pointer gap-2 focus:bg-primary/20 rounded-lg h-10" onClick={() => onApprove(p.id)}><CheckCircle2 className="w-4 h-4 text-green-500" /> Approve</DropdownMenuItem>
                                            <DropdownMenuItem className="cursor-pointer gap-2 focus:bg-red-500/20 text-red-400 rounded-lg h-10" onClick={() => onCancel(p.id)}><Ban className="w-4 h-4" /> Cancel Status</DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-white/5 my-1" />
                                            <DropdownMenuItem className="cursor-pointer gap-2 focus:bg-white/10 rounded-lg h-10"><Eye className="w-4 h-4" /> View Details</DropdownMenuItem>
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

function TransactionList({ transactions }: any) {
    if (transactions.length === 0) return (
        <div className="bg-black/40 border border-white/10 rounded-3xl p-20 text-center flex flex-col items-center justify-center">
            <Receipt className="w-16 h-16 text-white/10 mb-6" />
            <h3 className="text-xl font-bold mb-2">No transactions recorded</h3>
            <p className="text-white/40">Transactions appear here once partners complete checkout.</p>
        </div>
    );

    return (
        <Card className="bg-black/40 border-white/10 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-xl">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/5 hover:bg-transparent h-14">
                            <TableHead className="text-white/40 pl-8">Partner</TableHead>
                            <TableHead className="text-white/40">Business</TableHead>
                            <TableHead className="text-white/40">Plan</TableHead>
                            <TableHead className="text-white/40">Categories</TableHead>
                            <TableHead className="text-white/40">Countries</TableHead>
                            <TableHead className="text-white/40">Amount</TableHead>
                            <TableHead className="text-white/40 text-right pr-8">Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((t: any) => (
                            <TableRow key={t.id} className="border-white/5 hover:bg-white/[0.02] transition-colors h-20 group">
                                <TableCell className="pl-8">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-bold text-xs text-white/50">
                                            {t.customerEmail?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <span className="text-sm truncate max-w-[150px]">{t.customerEmail}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium text-sm">{t.businessName || '-'}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize border-white/10 text-white/60">
                                        {t.planName?.replace(/_/g, ' ') || t.type || '-'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                                        {t.selectedCategories?.slice(0, 2).map((cat: string, i: number) => (
                                            <Badge key={i} className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                                {cat}
                                            </Badge>
                                        ))}
                                        {(t.selectedCategories?.length || 0) > 2 && (
                                            <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px]">
                                                +{t.selectedCategories.length - 2}
                                            </Badge>
                                        )}
                                        {!t.selectedCategories?.length && <span className="text-white/30">-</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1 max-w-[120px]">
                                        {t.serviceCountries?.slice(0, 2).map((country: string, i: number) => (
                                            <Badge key={i} className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">
                                                {country}
                                            </Badge>
                                        ))}
                                        {(t.serviceCountries?.length || 0) > 2 && (
                                            <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px]">
                                                +{t.serviceCountries.length - 2}
                                            </Badge>
                                        )}
                                        {!t.serviceCountries?.length && <span className="text-white/30">-</span>}
                                    </div>
                                </TableCell>
                                <TableCell className="font-bold text-green-500 text-lg">
                                    {t.currency === 'gbp' ? '£' : '$'}{t.amount?.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right pr-8 text-white/40 font-medium">
                                    {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : "Processing"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function ListingsList({ listings, onApprove, onReject }: any) {
    const getCollectionLabel = (col: string) => {
        switch (col) {
            case "businessOfferingsCollection": return "Business Offering";
            case "consultingServicesCollection": return "Consulting Service";
            case "eventsCollection": return "Event";
            case "jobsCollection": return "Job";
            default: return col;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Approved":
                return <Badge className="bg-green-500/10 text-green-400 border-green-500/30">Approved</Badge>;
            case "Pending Review":
                return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Pending Review</Badge>;
            case "Rejected":
                return <Badge className="bg-red-500/10 text-red-400 border-red-500/30">Rejected</Badge>;
            default:
                return <Badge className="bg-white/10 text-white/60 border-white/20">{status || "Unknown"}</Badge>;
        }
    };

    if (listings.length === 0) return (
        <div className="bg-black/40 border border-white/10 rounded-3xl p-20 text-center flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
            <FileText className="w-16 h-16 text-white/10 mb-6" />
            <h3 className="text-xl font-bold mb-2">No listings found</h3>
            <p className="text-white/40">Listings will appear here once partners create them.</p>
        </div>
    );

    return (
        <Card className="bg-black/40 border-white/10 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-xl">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/5 hover:bg-transparent h-14">
                            <TableHead className="text-white/40 pl-8">Business</TableHead>
                            <TableHead className="text-white/40">Type</TableHead>
                            <TableHead className="text-white/40">Plan</TableHead>
                            <TableHead className="text-white/40">Categories</TableHead>
                            <TableHead className="text-white/40">Countries</TableHead>
                            <TableHead className="text-white/40">Status</TableHead>
                            <TableHead className="text-white/40">Created</TableHead>
                            <TableHead className="text-white/40 text-right pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {listings.map((listing: any) => (
                            <TableRow key={listing.id} className="border-white/5 hover:bg-white/[0.02] transition-colors h-24 group">
                                <TableCell className="pl-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/5 flex items-center justify-center font-bold text-white/30">
                                            {listing.businessName?.[0] || '?'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white group-hover:text-primary transition-colors">
                                                {listing.businessName || "Unnamed"}
                                            </p>
                                            {listing.companyWebsite && (
                                                <p className="text-xs text-white/30 truncate max-w-[180px]">{listing.companyWebsite}</p>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="border-white/10 text-white/60">
                                        {getCollectionLabel(listing.__col)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm font-medium capitalize">
                                        {listing.selectedPlan?.replace(/_/g, ' ') || '-'}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                                        {listing.selectedCategories?.slice(0, 2).map((cat: string, i: number) => (
                                            <Badge key={i} className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                                <Tag className="w-3 h-3 mr-1" />{cat}
                                            </Badge>
                                        ))}
                                        {(listing.selectedCategories?.length || 0) > 2 && (
                                            <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px]">
                                                +{listing.selectedCategories.length - 2} more
                                            </Badge>
                                        )}
                                        {!listing.selectedCategories?.length && <span className="text-white/30">-</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                                        {listing.serviceCountries?.slice(0, 2).map((country: string, i: number) => (
                                            <Badge key={i} className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">
                                                <Globe className="w-3 h-3 mr-1" />{country}
                                            </Badge>
                                        ))}
                                        {(listing.serviceCountries?.length || 0) > 2 && (
                                            <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px]">
                                                +{listing.serviceCountries.length - 2}
                                            </Badge>
                                        )}
                                        {listing.serviceRegions?.length > 0 && !listing.serviceCountries?.length && (
                                            listing.serviceRegions.slice(0, 2).map((region: string, i: number) => (
                                                <Badge key={i} className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                                                    <MapPin className="w-3 h-3 mr-1" />{region}
                                                </Badge>
                                            ))
                                        )}
                                        {!listing.serviceCountries?.length && !listing.serviceRegions?.length && (
                                            <span className="text-white/30">-</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {getStatusBadge(listing.status)}
                                </TableCell>
                                <TableCell className="text-white/40 text-sm">
                                    {listing.createdAt?.seconds 
                                        ? new Date(listing.createdAt.seconds * 1000).toLocaleDateString() 
                                        : '-'}
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    {listing.status === "Pending Review" ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <Button 
                                                size="sm" 
                                                onClick={() => onApprove(listing)}
                                                className="bg-green-500 hover:bg-green-600 text-white"
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                onClick={() => onReject(listing)}
                                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                            >
                                                <Ban className="w-4 h-4 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    ) : (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="hover:bg-white/10 rounded-full">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-[#0A0A0A] border-white/10 text-white min-w-[160px] p-2 rounded-xl shadow-2xl">
                                                <DropdownMenuLabel className="text-white/40 text-[10px] uppercase font-bold tracking-widest px-3 py-2">
                                                    Actions
                                                </DropdownMenuLabel>
                                                <DropdownMenuItem className="cursor-pointer gap-2 focus:bg-white/10 rounded-lg h-10">
                                                    <Eye className="w-4 h-4" /> View Details
                                                </DropdownMenuItem>
                                                {listing.status === "Approved" && (
                                                    <DropdownMenuItem 
                                                        className="cursor-pointer gap-2 focus:bg-red-500/20 text-red-400 rounded-lg h-10"
                                                        onClick={() => onReject(listing)}
                                                    >
                                                        <Ban className="w-4 h-4" /> Revoke Approval
                                                    </DropdownMenuItem>
                                                )}
                                                {listing.status === "Rejected" && (
                                                    <DropdownMenuItem 
                                                        className="cursor-pointer gap-2 focus:bg-green-500/20 text-green-400 rounded-lg h-10"
                                                        onClick={() => onApprove(listing)}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" /> Approve
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

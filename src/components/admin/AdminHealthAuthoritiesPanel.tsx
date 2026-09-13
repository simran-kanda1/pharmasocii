import { useState, useMemo } from "react";
import { useHealthAuthorities } from "@/hooks/useHealthAuthorities";
import { type HealthAuthorityItem } from "@/lib/defaultHealthAuthorities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";
import {
    Globe,
    Plus,
    Pencil,
    Trash2,
    Search,
    ExternalLink,
    RotateCcw,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Check,
    X,
} from "lucide-react";

const ITEMS_PER_PAGE = 15;

export function AdminHealthAuthoritiesPanel() {
    const {
        allHealthAuthorities,
        loading,
        addHealthAuthority,
        updateHealthAuthority,
        deleteHealthAuthority,
        resetToDefaults,
    } = useHealthAuthorities();

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
    const [currentPage, setCurrentPage] = useState(0);

    // Modal & Action states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<HealthAuthorityItem | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Form inputs for Add / Edit
    const [formCountry, setFormCountry] = useState("");
    const [formUrl, setFormUrl] = useState("");
    const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");
    const [formError, setFormError] = useState("");

    const showNotice = (type: "success" | "error", text: string) => {
        setNotice({ type, text });
        setTimeout(() => setNotice(null), 4000);
    };

    // Filtered and paginated list
    const filteredItems = useMemo(() => {
        return allHealthAuthorities.filter((item) => {
            if (statusFilter !== "all" && (item.status || "Active") !== statusFilter) {
                return false;
            }
            if (!searchTerm.trim()) return true;
            const q = searchTerm.toLowerCase();
            return (
                item.country.toLowerCase().includes(q) ||
                item.url.toLowerCase().includes(q)
            );
        });
    }, [allHealthAuthorities, statusFilter, searchTerm]);

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
    const paginatedItems = useMemo(() => {
        const start = currentPage * ITEMS_PER_PAGE;
        return filteredItems.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredItems, currentPage]);

    const activeCount = useMemo(() => {
        return allHealthAuthorities.filter((i) => i.status !== "Inactive").length;
    }, [allHealthAuthorities]);

    const inactiveCount = useMemo(() => {
        return allHealthAuthorities.filter((i) => i.status === "Inactive").length;
    }, [allHealthAuthorities]);

    // Handle Open Add
    const openAddModal = () => {
        setFormCountry("");
        setFormUrl("");
        setFormStatus("Active");
        setFormError("");
        setIsAddModalOpen(true);
    };

    // Handle Open Edit
    const openEditModal = (item: HealthAuthorityItem) => {
        setEditingItem(item);
        setFormCountry(item.country);
        setFormUrl(item.url);
        setFormStatus(item.status || "Active");
        setFormError("");
    };

    // Validate URL format
    const isValidUrl = (str: string) => {
        try {
            const url = new URL(str);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    };

    // Handle Submit Add
    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        if (!formCountry.trim()) {
            setFormError("Country or region name is required.");
            return;
        }
        if (!formUrl.trim()) {
            setFormError("Website URL is required.");
            return;
        }
        let url = formUrl.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }
        if (!isValidUrl(url)) {
            setFormError("Please enter a valid URL (e.g. https://www.fda.gov).");
            return;
        }

        setIsSaving(true);
        try {
            await addHealthAuthority({
                country: formCountry.trim(),
                url,
                status: formStatus,
            });
            setIsAddModalOpen(false);
            showNotice("success", `Added health authority site for "${formCountry.trim()}".`);
        } catch (err: any) {
            console.error("Failed to add health authority:", err);
            setFormError(err.message || "Failed to add health authority site.");
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Submit Edit
    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;
        setFormError("");
        if (!formCountry.trim()) {
            setFormError("Country or region name is required.");
            return;
        }
        if (!formUrl.trim()) {
            setFormError("Website URL is required.");
            return;
        }
        let url = formUrl.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }
        if (!isValidUrl(url)) {
            setFormError("Please enter a valid URL (e.g. https://www.fda.gov).");
            return;
        }

        setIsSaving(true);
        try {
            await updateHealthAuthority(editingItem.id, {
                country: formCountry.trim(),
                url,
                status: formStatus,
            });
            setEditingItem(null);
            showNotice("success", `Updated health authority site for "${formCountry.trim()}".`);
        } catch (err: any) {
            console.error("Failed to update health authority:", err);
            setFormError(err.message || "Failed to update health authority site.");
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Toggle Status
    const handleToggleStatus = async (item: HealthAuthorityItem) => {
        const nextStatus = item.status === "Inactive" ? "Active" : "Inactive";
        try {
            await updateHealthAuthority(item.id, { status: nextStatus });
            showNotice("success", `Set "${item.country}" to ${nextStatus}.`);
        } catch (err) {
            console.error("Failed to toggle status:", err);
            showNotice("error", "Failed to update status.");
        }
    };

    // Handle Delete
    const handleDelete = async (item: HealthAuthorityItem) => {
        if (!window.confirm(`Are you sure you want to delete the health authority site for "${item.country}"?\n\nThis will immediately remove it from the frontend compliance page.`)) {
            return;
        }
        setDeletingId(item.id);
        try {
            await deleteHealthAuthority(item.id);
            showNotice("success", `Deleted "${item.country}".`);
        } catch (err) {
            console.error("Failed to delete health authority:", err);
            showNotice("error", "Failed to delete item.");
        } finally {
            setDeletingId(null);
        }
    };

    // Handle Reset to Defaults
    const handleResetDefaults = async () => {
        if (!window.confirm("Are you sure you want to seed/reset all health authority sites to the default list of 110+ global authorities?\n\nAny custom changes or additions will be overwritten.")) {
            return;
        }
        setIsSaving(true);
        try {
            await resetToDefaults();
            showNotice("success", "Successfully reset health authority sites to default global directory.");
        } catch (err) {
            console.error("Failed to reset defaults:", err);
            showNotice("error", "Failed to reset to default sites.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Sites</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{allHealthAuthorities.length}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Live on Site</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inactive / Hidden</p>
                    <p className="text-2xl font-bold text-slate-600 mt-1">{inactiveCount}</p>
                </div>
            </div>

            {/* Notification Banner */}
            {notice && (
                <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm animate-in fade-in duration-200 ${
                        notice.type === "success"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                >
                    {notice.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    )}
                    <span>{notice.text}</span>
                </div>
            )}

            {/* Main Panel Card */}
            <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                        <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-primary" />
                            Health Authority Sites
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Manage official global health authority and regulatory websites. Changes synchronize live to the frontend Compliance page.
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetDefaults}
                            disabled={isSaving}
                            className="text-slate-600 border-slate-200 hover:bg-slate-50 gap-1.5"
                            title="Reset all health authority sites to the default 110+ list"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset / Seed Defaults
                        </Button>
                        <Button
                            onClick={openAddModal}
                            disabled={isSaving}
                            className="bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Authority Site
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-4">
                    {/* Search & Filter bar */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search by country, region, or URL..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(0);
                                }}
                                className="pl-9 pr-8 bg-slate-50/70 border-slate-200 h-10 text-sm focus:bg-white"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => {
                                        setSearchTerm("");
                                        setCurrentPage(0);
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500">Status:</span>
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
                                <button
                                    onClick={() => {
                                        setStatusFilter("all");
                                        setCurrentPage(0);
                                    }}
                                    className={`px-3 py-1.5 rounded-md transition-colors ${
                                        statusFilter === "all"
                                            ? "bg-white text-slate-800 shadow-xs font-semibold"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    All ({allHealthAuthorities.length})
                                </button>
                                <button
                                    onClick={() => {
                                        setStatusFilter("Active");
                                        setCurrentPage(0);
                                    }}
                                    className={`px-3 py-1.5 rounded-md transition-colors ${
                                        statusFilter === "Active"
                                            ? "bg-white text-emerald-700 shadow-xs font-semibold"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    Active ({activeCount})
                                </button>
                                <button
                                    onClick={() => {
                                        setStatusFilter("Inactive");
                                        setCurrentPage(0);
                                    }}
                                    className={`px-3 py-1.5 rounded-md transition-colors ${
                                        statusFilter === "Inactive"
                                            ? "bg-white text-slate-700 shadow-xs font-semibold"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    Inactive ({inactiveCount})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600">
                                    <th className="py-3.5 px-5">Country / Region</th>
                                    <th className="py-3.5 px-5">Website URL</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {paginatedItems.length > 0 ? (
                                    paginatedItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                                            <td className="py-3.5 px-5 font-semibold text-slate-800">
                                                {item.country}
                                            </td>
                                            <td className="py-3.5 px-5 max-w-md">
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline text-xs truncate max-w-sm"
                                                    title={item.url}
                                                >
                                                    <span className="truncate">{item.url}</span>
                                                    <ExternalLink className="w-3 h-3 shrink-0 opacity-70 group-hover:opacity-100" />
                                                </a>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    onClick={() => handleToggleStatus(item)}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                                        item.status !== "Inactive"
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                                            : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                                                    }`}
                                                    title="Click to toggle status"
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${
                                                            item.status !== "Inactive" ? "bg-emerald-500" : "bg-slate-400"
                                                        }`}
                                                    />
                                                    {item.status !== "Inactive" ? "Active" : "Inactive"}
                                                </button>
                                            </td>
                                            <td className="py-3.5 px-5 text-right space-x-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditModal(item)}
                                                    className="h-8 px-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                                    title="Edit health authority site"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(item)}
                                                    disabled={deletingId === item.id}
                                                    className="h-8 px-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                                                    title="Delete site"
                                                >
                                                    {deletingId === item.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                                    ) : (
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-500">
                                            <Globe className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                            <p className="font-medium text-slate-700">No health authority sites found</p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {searchTerm
                                                    ? `No results matching "${searchTerm}"`
                                                    : "Click 'Add Authority Site' or 'Reset / Seed Defaults' to populate the directory."}
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pt-2">
                            <AdminTablePagination
                                page={currentPage}
                                pageCount={totalPages}
                                onPageChange={setCurrentPage}
                                totalLabel={
                                    <span>
                                        Showing <strong>{filteredItems.length > 0 ? currentPage * ITEMS_PER_PAGE + 1 : 0}</strong> to{" "}
                                        <strong>{Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredItems.length)}</strong> of{" "}
                                        <strong>{filteredItems.length}</strong> authority sites
                                    </span>
                                }
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                    <Plus className="w-4 h-4" />
                                </div>
                                <h3 className="font-semibold text-slate-800 text-lg">Add Health Authority Site</h3>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                    Country or Organization Name *
                                </label>
                                <Input
                                    placeholder="e.g. United States (FDA) or European Medicines Agency"
                                    value={formCountry}
                                    onChange={(e) => setFormCountry(e.target.value)}
                                    className="bg-slate-50/50 focus:bg-white"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                    Official Website URL *
                                </label>
                                <Input
                                    placeholder="e.g. https://www.fda.gov"
                                    value={formUrl}
                                    onChange={(e) => setFormUrl(e.target.value)}
                                    className="bg-slate-50/50 focus:bg-white"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                    Display Status
                                </label>
                                <select
                                    value={formStatus}
                                    onChange={(e) => setFormStatus(e.target.value as "Active" | "Inactive")}
                                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50/50 text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="Active">Active (Visible on public compliance page)</option>
                                    <option value="Inactive">Inactive (Hidden from public site)</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsAddModalOpen(false)}
                                    disabled={isSaving}
                                    className="border-slate-200"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-primary hover:bg-primary/90 text-white min-w-24 gap-1.5"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    <span>Create Site</span>
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Pencil className="w-4 h-4" />
                                </div>
                                <h3 className="font-semibold text-slate-800 text-lg">Edit Health Authority Site</h3>
                            </div>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                    Country or Organization Name *
                                </label>
                                <Input
                                    placeholder="e.g. United States"
                                    value={formCountry}
                                    onChange={(e) => setFormCountry(e.target.value)}
                                    className="bg-slate-50/50 focus:bg-white"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                    Official Website URL *
                                </label>
                                <Input
                                    placeholder="e.g. https://www.fda.gov"
                                    value={formUrl}
                                    onChange={(e) => setFormUrl(e.target.value)}
                                    className="bg-slate-50/50 focus:bg-white"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                    Display Status
                                </label>
                                <select
                                    value={formStatus}
                                    onChange={(e) => setFormStatus(e.target.value as "Active" | "Inactive")}
                                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50/50 text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="Active">Active (Visible on public compliance page)</option>
                                    <option value="Inactive">Inactive (Hidden from public site)</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingItem(null)}
                                    disabled={isSaving}
                                    className="border-slate-200"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-primary hover:bg-primary/90 text-white min-w-24 gap-1.5"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    <span>Save Changes</span>
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

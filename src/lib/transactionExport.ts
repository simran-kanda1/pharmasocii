import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PartnerTransactionRow } from "@/lib/partnerTransactions";

function fileStamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function escapeCsvCell(value: string): string {
    if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
}

function repsToString(row: PartnerTransactionRow): string {
    if (!row.companyRepresentatives.length) return "";
    return row.companyRepresentatives
        .map((r) => {
            const name = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
            return r.email ? `${name} <${r.email}>`.trim() : name;
        })
        .filter(Boolean)
        .join("; ");
}

/** Flat row for spreadsheet / CSV (human-readable joined lists). */
export function transactionRowToExportRecord(row: PartnerTransactionRow): Record<string, string | number> {
    return {
        Date: row.dateDisplay,
        "ISO date": row.createdAtIso,
        Type: row.typeLabel,
        Description: row.description,
        "Plan ID": row.planId || "",
        "Feature ID": row.featureId || "",
        Group: row.group || "",
        "Business name": row.businessName || "",
        Amount: row.amountNumeric,
        "Amount (display)": row.amountDisplay,
        Currency: row.currency,
        Status: row.statusLabel,
        "Payment method": row.paymentMethod,
        "Session ID": row.sessionId || "",
        "Invoice ID": row.invoiceId || "",
        "Subscription ID": row.stripeSubscriptionId || "",
        "Listing ID": row.listingId || "",
        Collection: row.collectionName || "",
        "Customer email": row.customerEmail || "",
        Categories: row.selectedCategories.join("; "),
        Subcategories: row.selectedSubcategories.join("; "),
        "Sub-subcategories": row.selectedSubSubcategories.join("; "),
        Countries: row.serviceCountries.join("; "),
        Regions: row.serviceRegions.join("; "),
        Representatives: repsToString(row),
    };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function downloadPartnerTransactionsCsv(rows: PartnerTransactionRow[]): void {
    if (rows.length === 0) return;
    const records = rows.map(transactionRowToExportRecord);
    const headers = Object.keys(records[0]);
    const lines = [headers.map(escapeCsvCell).join(",")];
    for (const rec of records) {
        lines.push(headers.map((h) => escapeCsvCell(String(rec[h] ?? ""))).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    triggerBlobDownload(blob, `pharmasocii-transactions-${fileStamp()}.csv`);
}

export function downloadPartnerTransactionsExcel(rows: PartnerTransactionRow[]): void {
    if (rows.length === 0) return;
    const records = rows.map(transactionRowToExportRecord);
    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `pharmasocii-transactions-${fileStamp()}.xlsx`);
}

export function downloadPartnerTransactionsPdf(rows: PartnerTransactionRow[]): void {
    if (rows.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(11);
    doc.text("Pharmasocii — transactions", 14, 12);
    doc.setFontSize(8);

    const head = [["Date", "Type", "Description", "Group", "Amount", "Currency", "Status"]];
    const body = rows.map((r) => [
        r.dateDisplay,
        r.typeLabel,
        r.description,
        r.group || "—",
        r.amountDisplay,
        r.currency,
        r.statusLabel,
    ]);

    autoTable(doc, {
        startY: 16,
        head,
        body,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        margin: { left: 10, right: 10 },
    });

    doc.save(`pharmasocii-transactions-${fileStamp()}.pdf`);
}

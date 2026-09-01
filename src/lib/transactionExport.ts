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
        Group: row.group || "",
        Plan: row.planDisplay || row.description || "",
        Event: row.eventDisplay || "Initial",
        Amount: row.amountNumeric,
        "Amount (display)": row.amountDisplay,
        Currency: row.currency,
        Status: row.statusLabel,
        "Plan ID": row.planId || "",
        "Feature ID": row.featureId || "",
        "Business name": row.businessName || "",
        "Partner ID": row.partnerId || "",
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
    doc.text("Pharma SocII — transactions", 14, 12);
    doc.setFontSize(8);

    const head = [["Date", "Type", "Group", "Plan", "Event", "Amount", "Status"]];
    const body = rows.map((r) => [
        r.dateDisplay,
        r.typeLabel,
        r.group || "—",
        r.planDisplay || r.description || "—",
        r.eventDisplay || "Initial",
        r.amountDisplay,
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

export function downloadSingleTransactionInvoicePdf(
    row: PartnerTransactionRow,
    partnerData?: {
        companyName?: string;
        email?: string;
        businessId?: string;
        VAT_ABN_EIN_businessId?: string;
    }
): void {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Brand Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PHARMA SOCII", 14, 13);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text("Official Payment Receipt / Tax Invoice", 14, 19);
    doc.text("Pharma SocII Platform · www.pharmasocii.com · support@pharmasocii.com", 14, 25);

    // Invoice Metadata (Top Right)
    const invoiceNum = row.invoiceId
        ? `INV-${row.invoiceId.slice(-8).toUpperCase()}`
        : row.sessionId
            ? `INV-${row.sessionId.slice(-8).toUpperCase()}`
            : `INV-${row.id.slice(0, 8).toUpperCase()}`;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(invoiceNum, pageWidth - 14, 13, { align: "right" });

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    doc.text(`Invoice Date: ${row.dateDisplay}`, pageWidth - 14, 19, { align: "right" });
    doc.text(`Currency: ${row.currency}`, pageWidth - 14, 25, { align: "right" });

    // Status Banner
    const isPaid = row.statusRaw === "succeeded" || row.statusLabel.toLowerCase() === "completed";
    doc.setFillColor(isPaid ? 240 : 254, isPaid ? 253 : 243, isPaid ? 244 : 199);
    doc.roundedRect(14, 38, pageWidth - 28, 12, 2, 2, "F");
    doc.setTextColor(isPaid ? 22 : 146, isPaid ? 101 : 64, isPaid ? 52 : 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`PAYMENT STATUS: ${row.statusLabel.toUpperCase()}`, 20, 45.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Payment Method: ${row.paymentMethod}`, pageWidth - 20, 45.5, { align: "right" });

    // Details Grid (Billed To on Left, Transaction / Group / Plan on Right)
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("BILLED TO (CUSTOMER):", 14, 58);
    doc.text("TRANSACTION & SERVICE DETAILS:", pageWidth / 2 + 5, 58);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const clientName = partnerData?.companyName || row.businessName || "Valued Partner";
    const clientEmail = partnerData?.email || row.customerEmail || "";
    const taxIdVal = row.taxId || partnerData?.VAT_ABN_EIN_businessId || partnerData?.businessId || "";

    let leftY = 64;
    doc.setFont("helvetica", "bold");
    doc.text(clientName, 14, leftY);
    leftY += 5;

    doc.setFont("helvetica", "normal");
    if (clientEmail) {
        doc.text(`Email: ${clientEmail}`, 14, leftY);
        leftY += 5;
    }
    if (taxIdVal) {
        doc.text(`VAT / Business / Tax ID: ${taxIdVal}`, 14, leftY);
        leftY += 5;
    } else {
        doc.text("VAT / Business / Tax ID: N/A", 14, leftY);
        leftY += 5;
    }
    if (row.partnerId) {
        doc.text(`Partner ID: ${row.partnerId}`, 14, leftY);
        leftY += 5;
    }

    let rightY = 64;
    doc.text(`Group: ${row.group || "Business Offerings"}`, pageWidth / 2 + 5, rightY);
    rightY += 5;
    doc.text(`Plan / Service: ${row.description}`, pageWidth / 2 + 5, rightY);
    rightY += 5;
    if (row.upgradeFor || row.targetTitle) {
        doc.text(`Upgrade / Item For: ${row.upgradeFor || row.targetTitle}`, pageWidth / 2 + 5, rightY);
        rightY += 5;
    }
    if (row.sessionId) {
        doc.text(`Session Ref: ${row.sessionId.slice(0, 22)}...`, pageWidth / 2 + 5, rightY);
        rightY += 5;
    }
    if (row.invoiceId) {
        doc.text(`Stripe Invoice: ${row.invoiceId}`, pageWidth / 2 + 5, rightY);
        rightY += 5;
    }
    if (row.stripeSubscriptionId) {
        doc.text(`Subscription Ref: ${row.stripeSubscriptionId}`, pageWidth / 2 + 5, rightY);
        rightY += 5;
    }

    // Line Item Table
    const startTableY = Math.max(leftY, rightY) + 6;
    const tableBody = [
        [
            row.description,
            row.group || "—",
            row.upgradeFor || row.targetTitle || "Primary Listing",
            row.typeLabel,
            row.amountDisplay,
        ]
    ];

    autoTable(doc, {
        startY: startTableY,
        head: [["Plan Description / Item", "Group", "Upgrade / Item For", "Type", "Amount"]],
        body: tableBody,
        styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 35 },
            2: { cellWidth: 45 },
            3: { cellWidth: 25 },
            4: { cellWidth: 25, halign: "right" },
        },
        margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 125;

    // Financial Breakdown Box (Subtotal, Taxes, Total)
    const boxWidth = 85;
    const boxX = pageWidth - boxWidth - 14;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(boxX, finalY + 8, boxWidth, 32, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, finalY + 8, boxWidth, 32, 2, 2, "D");

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");

    // Subtotal
    doc.text("Subtotal:", boxX + 5, finalY + 16);
    doc.text(`${row.subtotalDisplay} ${row.currency}`, boxX + boxWidth - 5, finalY + 16, { align: "right" });

    // Taxes
    doc.text("Taxes (if applicable):", boxX + 5, finalY + 23);
    doc.text(`${row.taxAmountDisplay} ${row.currency}`, boxX + boxWidth - 5, finalY + 23, { align: "right" });

    // Total Paid
    doc.setDrawColor(226, 232, 240);
    doc.line(boxX + 5, finalY + 26, boxX + boxWidth - 5, finalY + 26);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Total Paid:", boxX + 5, finalY + 34);
    doc.text(`${row.amountDisplay} ${row.currency}`, boxX + boxWidth - 5, finalY + 34, { align: "right" });

    // Seller / Platform Footer
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Pharma SocII · Global Life Sciences & Pharmaceutical Marketplace", 14, 272);
    doc.text("Thank you for your business. For billing or tax inquiries, contact support@pharmasocii.com", 14, 277);

    const safeFileTitle = `Invoice-${invoiceNum}-${fileStamp()}.pdf`;
    doc.save(safeFileTitle);
}



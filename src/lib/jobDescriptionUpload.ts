import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateJobDescriptionPdf(file: File): string | null {
    if (!file || file.size === 0) return "Please choose a PDF file.";
    const type = (file.type || "").toLowerCase();
    if (type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        return "File must be a PDF (.pdf).";
    }
    if (file.size > MAX_BYTES) return "PDF must be 10 MB or smaller.";
    return null;
}

/**
 * Uploads a job description PDF to Storage and returns a download URL.
 * Path is scoped per partner with a unique filename to avoid overwrites.
 */
export async function uploadJobDescriptionPdf(partnerId: string, file: File, listingId?: string | null): Promise<string> {
    const err = validateJobDescriptionPdf(file);
    if (err) throw new Error(err);
    const unique =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const folder = listingId && String(listingId).trim() ? String(listingId).trim() : "draft";
    const path = `partners/${partnerId}/jobDescriptions/${folder}/${unique}.pdf`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: "application/pdf" });
    return getDownloadURL(storageRef);
}

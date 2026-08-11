import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export function validateCompanyLogo(file: File): string | null {
    if (!file || file.size === 0) return "Please choose an image file.";
    const type = (file.type || "").toLowerCase();
    if (type !== "image/jpeg" && type !== "image/png" && type !== "image/jpg") {
        return "Logo must be a JPG, JPEG, or PNG.";
    }
    if (file.size > MAX_BYTES) return "Logo must be 2 MB or smaller.";
    return null;
}

export async function uploadCompanyLogo(partnerId: string, file: File): Promise<string> {
    const err = validateCompanyLogo(file);
    if (err) throw new Error(err);
    const unique =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    // Determine extension based on file type
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `partners/${partnerId}/companyLogo/${unique}.${ext}`;
    
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
}

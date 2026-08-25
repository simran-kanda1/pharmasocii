import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase";

const MAX_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_DIMENSION = 800; // max width / height in px

export function validateCompanyLogo(file: File): string | null {
    if (!file || file.size === 0) return "Please choose an image file.";
    const type = (file.type || "").toLowerCase();
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!validTypes.includes(type)) {
        return "Logo must be a JPG, JPEG, PNG, or WebP file.";
    }
    if (file.size > MAX_BYTES) return "Logo must be 1 MB or smaller.";
    return null;
}

/**
 * Checks if a canvas contains pixels with transparency (alpha < 250).
 */
function checkTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
    try {
        const imgData = ctx.getImageData(0, 0, width, height).data;
        for (let i = 3; i < imgData.length; i += 16) {
            if (imgData[i] < 250) {
                return true;
            }
        }
    } catch {
        // If security or context fails, fallback gracefully
    }
    return false;
}

/**
 * Auto-optimizes an image down to ~50–200 KB, serving WebP (or PNG for transparency).
 */
export async function optimizeCompanyLogo(file: File): Promise<{ blob: Blob; contentType: string; ext: string }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let { width, height } = img;
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                if (width > height) {
                    height = Math.round((height * MAX_DIMENSION) / width);
                    width = MAX_DIMENSION;
                } else {
                    width = Math.round((width * MAX_DIMENSION) / height);
                    height = MAX_DIMENSION;
                }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) {
                resolve({
                    blob: file,
                    contentType: file.type || "image/jpeg",
                    ext: file.type === "image/png" ? "png" : "jpg",
                });
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const hasAlpha = checkTransparency(ctx, width, height);

            // Serve WebP or PNG depending on transparency
            const targetFormat = hasAlpha ? "image/png" : "image/webp";
            const quality = hasAlpha ? undefined : 0.85;

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve({
                            blob,
                            contentType: targetFormat,
                            ext: hasAlpha ? "png" : "webp",
                        });
                    } else {
                        resolve({
                            blob: file,
                            contentType: file.type || "image/jpeg",
                            ext: file.type === "image/png" ? "png" : "jpg",
                        });
                    }
                },
                targetFormat,
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Unable to read or decode image file."));
        };

        img.src = objectUrl;
    });
}

export async function uploadCompanyLogo(partnerId: string, file: File): Promise<string> {
    const err = validateCompanyLogo(file);
    if (err) throw new Error(err);

    // Auto-optimize to ~50-200 KB WebP/PNG
    const { blob, contentType, ext } = await optimizeCompanyLogo(file);

    const unique =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const path = `partners/${partnerId}/companyLogo/${unique}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType });
    return getDownloadURL(storageRef);
}

const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export const API_BASE_URL: string =
    configuredApiUrl || "https://pharmasocii.onrender.com";

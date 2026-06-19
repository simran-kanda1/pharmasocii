const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export const API_BASE_URL: string =
  configuredApiUrl ||
  (import.meta.env.DEV ? "http://localhost:3001" : "https://pharmasocii.onrender.com");

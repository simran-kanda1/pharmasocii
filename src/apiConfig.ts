/**
 * API Base URL configuration.
 *
 * In development, Vite's proxy forwards /api requests to localhost:3001,
 * so the base URL is empty (relative paths work).
 *
 * In production, the backend is hosted separately, so we need the full URL.
 * Update VITE_API_URL in your .env.production file or replace the fallback below.
 */
export const API_BASE_URL: string =
    import.meta.env.VITE_API_URL as string || "";

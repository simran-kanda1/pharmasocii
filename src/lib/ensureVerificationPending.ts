import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

export type EnsureVerificationResult =
  | { ok: true; skipped?: string; hasLink?: boolean; status?: string }
  | { ok: false; message: string };

/** Registers member in admin verification queue and tries to attach a verify link. */
export async function ensureVerificationPending(): Promise<EnsureVerificationResult> {
  const fn = httpsCallable<
    Record<string, never>,
    { ok: boolean; skipped?: string; hasLink?: boolean; status?: string }
  >(functions, "ensureVerificationPending");
  try {
    const res = await fn({});
    const data = res.data;
    if (data.ok) return { ok: true, skipped: data.skipped, hasLink: data.hasLink, status: data.status };
    return { ok: false, message: "Request failed." };
  } catch (e: unknown) {
    const fe = e as { message?: string };
    return { ok: false, message: fe?.message ? String(fe.message) : String(e) };
  }
}

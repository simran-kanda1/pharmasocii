import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

export type VerificationMirrorResult = { ok: true } | { ok: false; message: string };

/**
 * Callable mirror for “resend verification” (signup mirror uses Firestore trigger).
 */
export async function requestVerificationMirrorCopy(): Promise<VerificationMirrorResult> {
  const fn = httpsCallable(functions, "requestVerificationEmailCc");
  try {
    await fn();
    return { ok: true };
  } catch (e: unknown) {
    const fe = e as { code?: string; message?: string };
    const code = fe?.code != null ? String(fe.code) : "";
    const message = fe?.message != null ? String(fe.message) : String(e);
    const full = code && !message.includes(code) ? `${code}: ${message}` : message;
    console.warn("requestVerificationEmailCc:", full, e);
    return { ok: false, message: full };
  }
}

import { requestVerificationEmail } from "@/lib/adminCommunityCallables";

export type VerificationEmailResult = { ok: true } | { ok: false; message: string };

/** Resend branded account activation / verification email (members). */
export async function requestVerificationEmailResend(): Promise<VerificationEmailResult> {
  try {
    await requestVerificationEmail();
    return { ok: true };
  } catch (e: unknown) {
    const fe = e as { code?: string; message?: string };
    const code = fe?.code != null ? String(fe.code) : "";
    const message = fe?.message != null ? String(fe.message) : String(e);
    const full = code && !message.includes(code) ? `${code}: ${message}` : message;
    console.warn("requestVerificationEmail:", full, e);
    return { ok: false, message: full };
  }
}

/** @deprecated Use requestVerificationEmailResend */
export const requestVerificationMirrorCopy = requestVerificationEmailResend;

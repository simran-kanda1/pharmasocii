import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

export type ChangePartnerPrimaryEmailResult = {
  ok: boolean;
  email?: string;
  unchanged?: boolean;
  verificationSent?: boolean;
  message?: string | null;
};

/**
 * Replaces partner Auth + Firestore primary email via Admin SDK, then sends verification.
 * Client updateEmail is blocked when Firebase email enumeration protection is enabled.
 */
export async function changePartnerPrimaryEmail(newEmail: string): Promise<ChangePartnerPrimaryEmailResult> {
  const fn = httpsCallable<{ newEmail: string }, ChangePartnerPrimaryEmailResult>(
    functions,
    "changePartnerPrimaryEmail"
  );
  const res = await fn({ newEmail: newEmail.trim().toLowerCase() });
  return res.data;
}

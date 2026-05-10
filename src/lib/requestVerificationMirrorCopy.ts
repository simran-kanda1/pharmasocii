import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

/**
 * Asks the backend to send a testing copy of the email verification link to the
 * configured CC address and to store it in Firestore for admins.
 * Safe to ignore failures (Firebase still sent the real verification email).
 */
export async function requestVerificationMirrorCopy(): Promise<void> {
  const fn = httpsCallable(functions, "requestVerificationEmailCc");
  try {
    await fn();
  } catch (e) {
    console.warn("requestVerificationEmailCc:", e);
  }
}

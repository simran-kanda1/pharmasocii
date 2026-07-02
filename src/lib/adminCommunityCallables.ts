import { httpsCallable } from "firebase/functions";
import { functions as fns } from "@/firebase";

export async function adminArchivePost(postId: string, reason?: string) {
  const fn = httpsCallable<{ postId: string; reason?: string }, { ok: boolean }>(
    fns,
    "adminArchivePost",
  );
  return fn({ postId, reason });
}

export async function adminRestorePost(postId: string) {
  const fn = httpsCallable<{ postId: string }, { ok: boolean }>(fns, "adminRestorePost");
  return fn({ postId });
}

export async function adminRestoreComment(postId: string, commentId: string) {
  const fn = httpsCallable<{ postId: string; commentId: string }, { ok: boolean }>(
    fns,
    "adminRestoreComment",
  );
  return fn({ postId, commentId });
}

export async function adminArchiveComment(postId: string, commentId: string, reason?: string) {
  const fn = httpsCallable<{ postId: string; commentId: string; reason?: string }, { ok: boolean }>(
    fns,
    "adminArchiveComment",
  );
  return fn({ postId, commentId, reason });
}

export async function adminSetMemberStatus(params: {
  userId: string;
  status: "active" | "spam_blocked" | "admin_hold";
  reason?: string;
  clearSpamCounters?: boolean;
}) {
  const fn = httpsCallable<typeof params, { ok: boolean }>(fns, "adminSetMemberStatus");
  return fn(params);
}

export async function mirrorPasswordResetEmail(email: string) {
  const fn = httpsCallable<{ email: string }, { ok: boolean }>(fns, "mirrorPasswordResetEmail");
  return fn({ email });
}

export async function adminRefreshVerificationLink(userId: string) {
  const fn = httpsCallable<
    { userId: string },
    { ok: boolean; hasLink?: boolean; status?: string; message?: string | null }
  >(fns, "adminRefreshVerificationLink");
  return fn({ userId });
}

export async function adminApproveMemberVerification(userId: string) {
  const fn = httpsCallable<{ userId: string }, { ok: boolean }>(
    fns,
    "adminApproveMemberVerification",
  );
  return fn({ userId });
}

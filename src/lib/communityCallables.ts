import { httpsCallable } from "firebase/functions";
import { functions as fns } from "@/firebase";

export async function syncPostCommentCount(postId: string) {
  const fn = httpsCallable<{ postId: string }, { count: number }>(fns, "syncPostCommentCount");
  const res = await fn({ postId });
  return res.data;
}

export async function recordCommentNotification(params: {
  postId: string;
  commentId: string;
  text?: string;
  fromUserName?: string;
}) {
  const fn = httpsCallable<
    { postId: string; commentId: string; text?: string; fromUserName?: string },
    { ok: boolean; created?: boolean; skipped?: boolean }
  >(fns, "recordCommentNotification");
  const res = await fn(params);
  return res.data;
}

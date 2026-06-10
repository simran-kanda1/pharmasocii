import { httpsCallable } from "firebase/functions";
import { functions as fns } from "@/firebase";

export async function syncPostCommentCount(postId: string) {
  const fn = httpsCallable<{ postId: string }, { count: number }>(fns, "syncPostCommentCount");
  const res = await fn({ postId });
  return res.data;
}

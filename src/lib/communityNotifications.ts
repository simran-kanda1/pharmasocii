import { collection, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/firebase";

export const NOTIFICATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type MemberNotification = {
  id: string;
  type?: string;
  isRead?: boolean;
  createdAt?: { toDate: () => Date };
  postId?: string;
  commentId?: string;
  fromUserId?: string;
  fromUserName?: string;
  preview?: string;
};

export function notificationTargetUrl(n: MemberNotification): string | null {
  if (!n.postId) return null;
  const base = `/community/post/${n.postId}`;
  if (n.commentId) return `${base}?highlight=${n.commentId}#comments`;
  return `${base}#comments`;
}

/** Remove notifications older than 30 days for this member. */
export async function purgeExpiredNotifications(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - NOTIFICATION_MAX_AGE_MS);
  const snap = await getDocs(collection(db, "membersCollection", userId, "notificationsCollection"));
  const stale = snap.docs.filter((d) => {
    const created = d.data().createdAt?.toDate?.();
    return created && created < cutoff;
  });
  if (stale.length === 0) return 0;
  const batch = writeBatch(db);
  for (const d of stale) {
    batch.delete(d.ref);
  }
  await batch.commit();
  return stale.length;
}

export async function deleteMemberNotification(userId: string, notificationId: string) {
  await deleteDoc(doc(db, "membersCollection", userId, "notificationsCollection", notificationId));
}

export function filterNotificationsByAge(list: MemberNotification[]): MemberNotification[] {
  const cutoff = Date.now() - NOTIFICATION_MAX_AGE_MS;
  return list.filter((n) => {
    const ts = n.createdAt?.toDate?.()?.getTime() ?? Date.now();
    return ts >= cutoff;
  });
}

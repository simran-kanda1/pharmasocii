import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/firebase";

export async function loadMemberEngagementIds(userId: string) {
  const [savedPosts, helpfulPosts, savedComments] = await Promise.all([
    getDocs(collection(db, "membersCollection", userId, "savedPostsCollection")),
    getDocs(collection(db, "membersCollection", userId, "helpfulPostsCollection")),
    getDocs(collection(db, "membersCollection", userId, "savedCommentsCollection")),
  ]);
  return {
    savedPostIds: new Set(savedPosts.docs.map((d) => d.id)),
    helpfulPostIds: new Set(helpfulPosts.docs.map((d) => d.id)),
    savedCommentIds: new Set(savedComments.docs.map((d) => d.id)),
  };
}

export async function toggleSavedPost(userId: string, postId: string, saved: boolean) {
  const ref = doc(db, "membersCollection", userId, "savedPostsCollection", postId);
  if (saved) {
    await deleteDoc(ref);
    return false;
  }
  await setDoc(ref, { savedAt: serverTimestamp() });
  return true;
}

export async function toggleSavedComment(
  userId: string,
  commentId: string,
  postId: string,
  saved: boolean,
) {
  const ref = doc(db, "membersCollection", userId, "savedCommentsCollection", commentId);
  if (saved) {
    await deleteDoc(ref);
    return false;
  }
  await setDoc(ref, { postId, savedAt: serverTimestamp() });
  return true;
}

export async function togglePostHelpful(userId: string, postId: string, helpful: boolean) {
  const postRef = doc(db, "postsCollection", postId);
  const helpfulRef = doc(db, "membersCollection", userId, "helpfulPostsCollection", postId);
  await runTransaction(db, async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists()) throw new Error("Post not found.");
    if (postSnap.data().authorId === userId) {
      throw new Error("You cannot mark your own post as helpful.");
    }
    const likeCount = Number(postSnap.data().likeCount ?? 0);
    if (helpful) {
      tx.delete(helpfulRef);
      tx.update(postRef, { likeCount: Math.max(0, likeCount - 1) });
    } else {
      tx.set(helpfulRef, { markedAt: serverTimestamp() });
      tx.update(postRef, { likeCount: likeCount + 1 });
    }
  });
  return !helpful;
}

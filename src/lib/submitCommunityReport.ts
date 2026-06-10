import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

export class AlreadyReportedError extends Error {
  constructor() {
    super("You have already reported this content.");
    this.name = "AlreadyReportedError";
  }
}

export async function submitCommunitySpamReport(params: {
  reporterId: string;
  targetType: "post" | "comment";
  targetKey: string;
  targetAuthorId: string;
  postId: string;
  commentId?: string | null;
  reason: string;
}) {
  const reportId = `${params.reporterId}_${params.targetType}_${params.targetKey}`;
  const reportRef = doc(db, "spamReportsCollection", reportId);
  const existing = await getDoc(reportRef);
  if (existing.exists()) {
    throw new AlreadyReportedError();
  }

  await setDoc(reportRef, {
    reporterId: params.reporterId,
    targetType: params.targetType,
    targetKey: params.targetKey,
    targetAuthorId: params.targetAuthorId,
    postId: params.postId,
    commentId: params.commentId ?? null,
    reason: params.reason,
    status: "open",
    createdAt: serverTimestamp(),
  });
}

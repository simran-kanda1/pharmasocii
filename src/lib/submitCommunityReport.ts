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
  const targetKey = String(params.targetKey || "").trim();
  const targetAuthorId = String(params.targetAuthorId || "").trim();
  if (!targetKey || !targetAuthorId) {
    throw new Error("This content cannot be reported right now.");
  }
  if (targetAuthorId === params.reporterId) {
    throw new Error("You cannot report your own content.");
  }

  const reportId = `${params.reporterId}_${params.targetType}_${targetKey}`;
  const reportRef = doc(db, "spamReportsCollection", reportId);
  const existing = await getDoc(reportRef);
  if (existing.exists()) {
    throw new AlreadyReportedError();
  }

  try {
    await setDoc(reportRef, {
      reporterId: params.reporterId,
      targetType: params.targetType,
      targetKey,
      targetAuthorId,
      postId: params.postId,
      commentId: params.commentId ?? null,
      reason: params.reason,
      status: "open",
      createdAt: serverTimestamp(),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "permission-denied") {
      const retry = await getDoc(reportRef);
      if (retry.exists()) {
        throw new AlreadyReportedError();
      }
    }
    throw err;
  }
}

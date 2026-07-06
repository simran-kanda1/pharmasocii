import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";

export type AdminMemberRow = {
  id: string;
  userId: string;
  name?: string;
  userName?: string;
  email?: string;
  phone?: string;
  country?: string;
  institution?: string;
  industry?: string;
  accountStatus?: string;
  emailVerified?: boolean;
  spamActiveReportCount?: number;
  spamTotalReportCount?: number;
  spamBlockStartedAt?: { toDate: () => Date };
  spamBlockUntil?: { toDate: () => Date };
  createdAt?: { toDate: () => Date };
  lastLoginAt?: { toDate: () => Date };
  postCount: number;
};

export type AdminPostRow = {
  id: string;
  title?: string;
  text?: string;
  authorId?: string;
  authorUserName?: string;
  authorEmail?: string;
  authorAccountStatus?: string;
  imageStoragePath?: string | null;
  likeCount?: number;
  commentCount?: number;
  spamReportCount?: number;
  archived?: boolean;
  archivedAt?: { toDate: () => Date };
  createdAt?: { toDate: () => Date };
};

export type AdminSpamReportRow = {
  id: string;
  targetType: "post" | "comment";
  reporterLabel: string;
  reporterUserName?: string;
  reporterName?: string;
  reason: string;
  createdAt?: { toDate: () => Date };
  postId?: string;
  commentId?: string;
};

export type AdminMemberDetail = AdminMemberRow & {
  userBio?: string;
};

export type AdminPostDetail = AdminPostRow & {
  mainCategories?: string[];
  subCategories?: string[];
  subSubCategories?: string[];
  countries?: string[];
  archivedReason?: string;
  totalCommentCount?: number;
  activeCommentCount?: number;
};

export type AdminReportedCommentRow = {
  id: string;
  reporterId?: string;
  reporterLabel?: string;
  commentOwnerId?: string;
  commentOwnerLabel?: string;
  commentOwnerStatus?: string;
  commentPreview?: string;
  commentText?: string;
  postId?: string;
  postTitle?: string;
  commentId?: string;
  reason?: string;
  commentArchived?: boolean;
  createdAt?: { toDate: () => Date };
  archivedAt?: { toDate: () => Date };
};

/** True when the user completed community profile setup (not partner-only Auth). */
export function isCommunityMemberDoc(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const userName = typeof data.userName === "string" ? data.userName.trim() : "";
  const userId = typeof data.userId === "string" ? data.userId.trim() : "";
  return userName.length >= 2 && userId.length > 0;
}

async function buildPostCountByAuthor(): Promise<Map<string, number>> {
  const snap = await getDocs(query(collection(db, "postsCollection"), limit(500)));
  const counts = new Map<string, number>();
  for (const d of snap.docs) {
    const authorId = d.data().authorId as string | undefined;
    if (!authorId) continue;
    counts.set(authorId, (counts.get(authorId) || 0) + 1);
  }
  return counts;
}

function memberLabel(data: Record<string, unknown> | undefined, fallbackId?: string) {
  if (!data) return fallbackId || "—";
  const userName = data.userName as string | undefined;
  const name = data.name as string | undefined;
  if (userName && name) return `${userName} / ${name}`;
  return userName || name || (data.email as string) || fallbackId || "—";
}

export async function loadCommunityMembers(): Promise<AdminMemberRow[]> {
  const [memberSnap, postCounts] = await Promise.all([
    getDocs(query(collection(db, "membersCollection"), orderBy("createdAt", "desc"), limit(300))),
    buildPostCountByAuthor(),
  ]);

  return memberSnap.docs
    .filter((d) => isCommunityMemberDoc(d.data() as Record<string, unknown>))
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: (data.userId as string) || d.id,
        name: data.name as string | undefined,
        userName: data.userName as string | undefined,
        email: data.email as string | undefined,
        phone: (data.phone as string | undefined) || (data.phoneNumber as string | undefined),
        country: data.country as string | undefined,
        institution: (data.institution as string | undefined) || (data.instit as string | undefined),
        industry: data.industry as string | undefined,
        accountStatus: (data.accountStatus as string | undefined) || "active",
        emailVerified: Boolean(data.emailVerified),
        spamActiveReportCount: data.spamActiveReportCount as number | undefined,
        spamTotalReportCount: data.spamTotalReportCount as number | undefined,
        spamBlockStartedAt: data.spamBlockStartedAt as { toDate: () => Date } | undefined,
        spamBlockUntil: data.spamBlockUntil as { toDate: () => Date } | undefined,
        createdAt: data.createdAt as { toDate: () => Date } | undefined,
        lastLoginAt: (data.lastLoginAt as { toDate: () => Date } | undefined) ||
          (data.lastLogin as { toDate: () => Date } | undefined),
        postCount: postCounts.get(d.id) || 0,
      };
    });
}

async function enrichPostsWithMemberEmail(
  rows: AdminPostRow[],
  memberById: Map<string, Record<string, unknown>>,
): Promise<AdminPostRow[]> {
  return rows.map((p) => {
    const member = p.authorId ? memberById.get(p.authorId) : undefined;
    return {
      ...p,
      authorEmail: (member?.email as string | undefined) || undefined,
      authorAccountStatus: (member?.accountStatus as string | undefined) || "active",
    };
  });
}

export async function loadCommunityPosts(archived: boolean): Promise<AdminPostRow[]> {
  const [postSnap, memberSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "postsCollection"),
        where("archived", "==", archived),
        orderBy("createdAt", "desc"),
        limit(200),
      ),
    ),
    getDocs(collection(db, "membersCollection")),
  ]);

  const memberById = new Map<string, Record<string, unknown>>();
  for (const d of memberSnap.docs) {
    if (isCommunityMemberDoc(d.data() as Record<string, unknown>)) {
      memberById.set(d.id, d.data());
    }
  }

  const rows: AdminPostRow[] = postSnap.docs
    .filter((d) => {
      const authorId = d.data().authorId as string | undefined;
      return authorId && memberById.has(authorId);
    })
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title as string | undefined,
        text: data.text as string | undefined,
        authorId: data.authorId as string | undefined,
        authorUserName: data.authorUserName as string | undefined,
        imageStoragePath: data.imageStoragePath as string | null | undefined,
        likeCount: data.likeCount as number | undefined,
        commentCount: data.commentCount as number | undefined,
        spamReportCount: data.spamReportCount as number | undefined,
        archived: data.archived as boolean | undefined,
        archivedAt: data.archivedAt as { toDate: () => Date } | undefined,
        createdAt: data.createdAt as { toDate: () => Date } | undefined,
      };
    });

  return enrichPostsWithMemberEmail(rows, memberById);
}

export async function loadReportedComments(): Promise<AdminReportedCommentRow[]> {
  const reportSnap = await getDocs(
    query(collection(db, "spamReportsCollection"), orderBy("createdAt", "desc"), limit(150)),
  );
  const commentReports = reportSnap.docs.filter((d) => d.data().targetType === "comment");
  if (commentReports.length === 0) return [];

  const memberSnap = await getDocs(collection(db, "membersCollection"));
  const memberById = new Map<string, Record<string, unknown>>();
  for (const d of memberSnap.docs) {
    memberById.set(d.id, d.data());
  }

  const rows: AdminReportedCommentRow[] = [];
  for (const r of commentReports) {
    const data = r.data();
    const postId = data.postId as string | undefined;
    const commentId = data.commentId as string | undefined;
    if (!postId || !commentId) continue;

    const [postSnap, commentSnap] = await Promise.all([
      getDoc(doc(db, "postsCollection", postId)),
      getDoc(doc(db, "postsCollection", postId, "commentsCollection", commentId)),
    ]);

    const commentData = commentSnap.exists() ? commentSnap.data() : null;
    const postData = postSnap.exists() ? postSnap.data() : null;
    const ownerId = (data.targetAuthorId as string | undefined) || (commentData?.authorId as string | undefined);
    const reporterId = data.reporterId as string | undefined;

    rows.push({
      id: r.id,
      reporterId,
      reporterLabel: memberLabel(reporterId ? memberById.get(reporterId) : undefined, reporterId),
      commentOwnerId: ownerId,
      commentOwnerLabel: memberLabel(ownerId ? memberById.get(ownerId) : undefined, ownerId),
      commentOwnerStatus: ownerId
        ? ((memberById.get(ownerId)?.accountStatus as string | undefined) || "active")
        : "—",
      commentPreview: (commentData?.text as string | undefined)?.slice(0, 120) || "—",
      commentText: (commentData?.text as string | undefined) || "",
      postId,
      postTitle: (postData?.title as string | undefined) || postId,
      commentId,
      reason: data.reason as string | undefined,
      commentArchived: commentData?.archived === true,
      createdAt: data.createdAt as { toDate: () => Date } | undefined,
      archivedAt: commentData?.archivedAt as { toDate: () => Date } | undefined,
    });
  }
  return rows;
}

function reporterDisplay(
  reporterId: string | undefined,
  memberById: Map<string, Record<string, unknown>>,
): { label: string; userName?: string; name?: string } {
  const data = reporterId ? memberById.get(reporterId) : undefined;
  const userName = (data?.userName as string | undefined) || "";
  const name = (data?.name as string | undefined) || "";
  if (userName && name) return { label: `${userName} (${name})`, userName, name };
  return { label: userName || name || reporterId || "Unknown", userName, name };
}

async function loadMemberMap() {
  const memberSnap = await getDocs(collection(db, "membersCollection"));
  const memberById = new Map<string, Record<string, unknown>>();
  for (const d of memberSnap.docs) {
    memberById.set(d.id, d.data());
  }
  return memberById;
}

export async function loadSpamReportsForAuthor(authorId: string): Promise<AdminSpamReportRow[]> {
  const [reportSnap, memberById] = await Promise.all([
    getDocs(query(collection(db, "spamReportsCollection"), where("targetAuthorId", "==", authorId), limit(200))),
    loadMemberMap(),
  ]);
  return reportSnap.docs.map((d) => {
    const data = d.data();
    const rep = reporterDisplay(data.reporterId as string | undefined, memberById);
    return {
      id: d.id,
      targetType: (data.targetType as "post" | "comment") || "post",
      reporterLabel: rep.label,
      reporterUserName: rep.userName,
      reporterName: rep.name,
      reason: String(data.reason || "—"),
      createdAt: data.createdAt as { toDate: () => Date } | undefined,
      postId: data.postId as string | undefined,
      commentId: data.commentId as string | undefined,
    };
  });
}

export async function loadSpamReportsForPost(postId: string): Promise<AdminSpamReportRow[]> {
  const [reportSnap, memberById] = await Promise.all([
    getDocs(query(collection(db, "spamReportsCollection"), where("postId", "==", postId), limit(100))),
    loadMemberMap(),
  ]);
  return reportSnap.docs
    .sort((a, b) => {
      const ta = a.data().createdAt?.toMillis?.() ?? 0;
      const tb = b.data().createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    })
    .map((d) => {
      const data = d.data();
      const rep = reporterDisplay(data.reporterId as string | undefined, memberById);
      return {
        id: d.id,
        targetType: (data.targetType as "post" | "comment") || "post",
        reporterLabel: rep.label,
        reporterUserName: rep.userName,
        reporterName: rep.name,
        reason: String(data.reason || "—"),
        createdAt: data.createdAt as { toDate: () => Date } | undefined,
        postId: data.postId as string | undefined,
        commentId: data.commentId as string | undefined,
      };
    });
}

export async function loadMemberDetail(memberId: string): Promise<AdminMemberDetail | null> {
  const snap = await getDoc(doc(db, "membersCollection", memberId));
  if (!snap.exists() || !isCommunityMemberDoc(snap.data() as Record<string, unknown>)) return null;
  const data = snap.data();
  const postCounts = await buildPostCountByAuthor();
  return {
    id: snap.id,
    userId: (data.userId as string) || snap.id,
    name: data.name as string | undefined,
    userName: data.userName as string | undefined,
    email: data.email as string | undefined,
    phone: (data.phone as string | undefined) || (data.phoneNumber as string | undefined),
    country: data.country as string | undefined,
    institution: (data.institution as string | undefined) || (data.instit as string | undefined),
    industry: data.industry as string | undefined,
    userBio: data.userBio as string | undefined,
    accountStatus: (data.accountStatus as string | undefined) || "active",
    emailVerified: Boolean(data.emailVerified),
    spamActiveReportCount: data.spamActiveReportCount as number | undefined,
    spamTotalReportCount: data.spamTotalReportCount as number | undefined,
    spamBlockStartedAt: data.spamBlockStartedAt as { toDate: () => Date } | undefined,
    spamBlockUntil: data.spamBlockUntil as { toDate: () => Date } | undefined,
    createdAt: data.createdAt as { toDate: () => Date } | undefined,
    lastLoginAt: (data.lastLoginAt as { toDate: () => Date } | undefined) ||
      (data.lastLogin as { toDate: () => Date } | undefined),
    postCount: postCounts.get(snap.id) || 0,
  };
}

export async function loadPostDetail(postId: string): Promise<AdminPostDetail | null> {
  const [snap, commentsSnap] = await Promise.all([
    getDoc(doc(db, "postsCollection", postId)),
    getDocs(collection(db, "postsCollection", postId, "commentsCollection")),
  ]);
  if (!snap.exists()) return null;
  const data = snap.data();
  const totalCommentCount = commentsSnap.size;
  const activeCommentCount = commentsSnap.docs.filter((d) => d.data().archived !== true).length;
  const authorId = data.authorId as string | undefined;
  let authorEmail: string | undefined;
  let authorAccountStatus = "active";
  if (authorId) {
    const m = await getDoc(doc(db, "membersCollection", authorId));
    if (m.exists()) {
      authorEmail = m.data().email as string | undefined;
      authorAccountStatus = (m.data().accountStatus as string | undefined) || "active";
    }
  }
  return {
    id: snap.id,
    title: data.title as string | undefined,
    text: data.text as string | undefined,
    authorId,
    authorUserName: data.authorUserName as string | undefined,
    authorEmail,
    authorAccountStatus,
    imageStoragePath: data.imageStoragePath as string | null | undefined,
    likeCount: data.likeCount as number | undefined,
    commentCount: data.commentCount as number | undefined,
    spamReportCount: data.spamReportCount as number | undefined,
    archived: data.archived as boolean | undefined,
    archivedAt: data.archivedAt as { toDate: () => Date } | undefined,
    archivedReason: data.archivedReason as string | undefined,
    createdAt: data.createdAt as { toDate: () => Date } | undefined,
    mainCategories: (data.mainCategories as string[] | undefined) || [],
    subCategories: (data.subCategories as string[] | undefined) || [],
    subSubCategories: (data.subSubCategories as string[] | undefined) || [],
    countries: (data.countries as string[] | undefined) || [],
    totalCommentCount,
    activeCommentCount,
  };
}

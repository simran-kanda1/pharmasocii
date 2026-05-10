import type { Timestamp } from "firebase/firestore";

export type CommunitySubSub = { id: string; label: string };
export type CommunitySub = { id: string; label: string; subSubs?: CommunitySubSub[] };
export type CommunityMain = { id: string; label: string; subs: CommunitySub[] };

export type CommunityCategoryDoc = {
  mains: CommunityMain[];
  updatedAt?: Timestamp;
};

export type SelectedCategoryBranch = {
  mainLabel: string;
  subLabels: string[];
  subSubLabels: string[];
};

export type CommunityPost = {
  authorId: string;
  authorUserName: string;
  title: string;
  text: string;
  mainCategories: string[];
  subCategories: string[];
  subSubCategories: string[];
  countries?: string[];
  externalLinks?: string[];
  imageStoragePath?: string | null;
  filterKeys?: string[];
  createdAt?: Timestamp;
  archived?: boolean;
  spamReportCount?: number;
  commentCount?: number;
  likeCount?: number;
};

export type CommunityComment = {
  authorId: string;
  userName: string;
  postId: string;
  text: string;
  parentCommentId?: string | null;
  createdAt?: Timestamp;
  archived?: boolean;
  spamReportCount?: number;
};

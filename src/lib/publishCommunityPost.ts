import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/firebase";
import type { CommunityCategoryDoc } from "@/lib/communityTypes";
import {
  buildFilterKeysFromSelection,
  selectionToPostFields,
  validateCategorySelection,
  type CategorySelectionState,
} from "@/components/community/CategoryPicker";
import { validatePostPayload, EXTERNAL_LINKS_MAX } from "@/lib/community";

export const POST_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;
export const POST_IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

function isAllowedPostImage(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith("image/")) return true;
  return name.endsWith(".heic") || name.endsWith(".heif") || name.endsWith(".jpg") || name.endsWith(".jpeg");
}

export async function publishCommunityPost(params: {
  categoryDoc: CommunityCategoryDoc | null;
  catSel: CategorySelectionState;
  title: string;
  text: string;
  countries: string[];
  externalLinks: string[];
  imageFile: File | null;
}) {
  const u = auth.currentUser;
  if (!u) throw new Error("Sign in required.");
  await u.reload();
  if (!u.emailVerified) throw new Error("Verify your email before posting.");
  if (!params.categoryDoc) throw new Error("Categories are still loading. Try again in a moment.");

  const { mainCategories, subCategories, subSubCategories } = selectionToPostFields(
    params.categoryDoc,
    params.catSel,
  );
  const catErr = validateCategorySelection(params.categoryDoc, params.catSel);
  if (catErr) throw new Error(catErr);

  const payloadErr = validatePostPayload({
    title: params.title,
    text: params.text,
    mainCategories,
    subCategories,
    subSubCategories,
    countries: params.countries,
    externalLinks: params.externalLinks.slice(0, EXTERNAL_LINKS_MAX),
  });
  if (payloadErr) throw new Error(payloadErr);

  const memberSnap = await getDoc(doc(db, "membersCollection", u.uid));
  if (!memberSnap.exists()) throw new Error("Community profile required.");
  const member = memberSnap.data();
  const authorUserName = (member?.userName as string) || u.email?.split("@")[0] || "member";
  const authorTagline = (member?.aboutMe as string) || "";

  let imageStoragePath: string | null = null;
  if (params.imageFile) {
    const file = params.imageFile;
    if (!isAllowedPostImage(file)) {
      throw new Error("Image must be JPEG, JPG, PNG, WebP, or HEIC.");
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
      throw new Error("Image must be 1.5 MB or smaller.");
    }
    const path = `community/${u.uid}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
    await uploadBytes(ref(storage, path), file);
    await getDownloadURL(ref(storage, path));
    imageStoragePath = path;
  }

  const filterKeys = buildFilterKeysFromSelection(params.categoryDoc, params.catSel);

  const docRef = await addDoc(collection(db, "postsCollection"), {
    authorId: u.uid,
    authorUserName,
    authorTagline,
    title: params.title.trim(),
    text: params.text,
    mainCategories,
    subCategories,
    subSubCategories,
    countries: params.countries,
    externalLinks: params.externalLinks.slice(0, EXTERNAL_LINKS_MAX),
    imageStoragePath,
    filterKeys,
    createdAt: serverTimestamp(),
    archived: false,
    spamReportCount: 0,
    commentCount: 0,
    likeCount: 0,
  });

  return docRef.id;
}

export async function updateCommunityPost(params: {
  postId: string;
  categoryDoc: CommunityCategoryDoc | null;
  catSel: CategorySelectionState;
  title: string;
  text: string;
  countries: string[];
  externalLinks: string[];
  imageFile: File | null;
  keepExistingImage?: boolean;
}) {
  const u = auth.currentUser;
  if (!u) throw new Error("Sign in required.");
  await u.reload();
  if (!u.emailVerified) throw new Error("Verify your email before updating.");
  if (!params.categoryDoc) throw new Error("Categories are still loading. Try again in a moment.");

  const postRef = doc(db, "postsCollection", params.postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error("Post not found.");
  const postData = postSnap.data();
  if (postData.authorId !== u.uid) throw new Error("You do not have permission to edit this post.");

  const memberSnap = await getDoc(doc(db, "membersCollection", u.uid));
  const member = memberSnap.exists() ? memberSnap.data() : null;
  const authorTagline = (member?.aboutMe as string) || "";

  const createdTime = postData.createdAt?.toDate?.() || new Date();
  const diffHours = (Date.now() - createdTime.getTime()) / (1000 * 60 * 60);
  if (diffHours > 6) throw new Error("Posts can only be edited for up to 6 hours after posting.");

  const { mainCategories, subCategories, subSubCategories } = selectionToPostFields(
    params.categoryDoc,
    params.catSel,
  );
  const catErr = validateCategorySelection(params.categoryDoc, params.catSel);
  if (catErr) throw new Error(catErr);

  const payloadErr = validatePostPayload({
    title: params.title,
    text: params.text,
    mainCategories,
    subCategories,
    subSubCategories,
    countries: params.countries,
    externalLinks: params.externalLinks.slice(0, EXTERNAL_LINKS_MAX),
  });
  if (payloadErr) throw new Error(payloadErr);

  let imageStoragePath: string | null | undefined = undefined;
  if (params.imageFile) {
    const file = params.imageFile;
    if (!isAllowedPostImage(file)) {
      throw new Error("Image must be JPEG, JPG, PNG, WebP, or HEIC.");
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
      throw new Error("Image must be 1.5 MB or smaller.");
    }
    const path = `community/${u.uid}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
    await uploadBytes(ref(storage, path), file);
    await getDownloadURL(ref(storage, path));
    imageStoragePath = path;
  } else if (!params.keepExistingImage) {
    imageStoragePath = null;
  }

  const filterKeys = buildFilterKeysFromSelection(params.categoryDoc, params.catSel);

  const updateData: Record<string, any> = {
    title: params.title.trim(),
    text: params.text,
    mainCategories,
    subCategories,
    subSubCategories,
    countries: params.countries,
    externalLinks: params.externalLinks.slice(0, EXTERNAL_LINKS_MAX),
    filterKeys,
    authorTagline,
    updatedAt: serverTimestamp(),
  };

  if (imageStoragePath !== undefined) {
    updateData.imageStoragePath = imageStoragePath;
  }

  await updateDoc(postRef, updateData);
}

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";
import { DEFAULT_COMMUNITY_CATEGORIES } from "./defaultCommunityCategories";
import { normalizeForFirestore } from "./communityCategoryEditorUtils";

const CONFIG_REF = doc(db, "config", "communityCategories");

/** Write default main categories only if config doc is missing (admin edits preserved). */
export async function seedCommunityCategoriesIfMissing(): Promise<"skipped" | "seeded"> {
  const snap = await getDoc(CONFIG_REF);
  if (snap.exists() && (snap.data()?.mains as unknown[])?.length) {
    return "skipped";
  }
  const normalized = normalizeForFirestore(DEFAULT_COMMUNITY_CATEGORIES);
  await setDoc(CONFIG_REF, { ...normalized, updatedAt: serverTimestamp() });
  return "seeded";
}

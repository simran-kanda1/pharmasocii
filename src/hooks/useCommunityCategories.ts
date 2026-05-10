import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import type { CommunityCategoryDoc } from "@/lib/communityTypes";
import { DEFAULT_COMMUNITY_CATEGORIES } from "@/lib/defaultCommunityCategories";
import { ensureCommunityCategoryDoc } from "@/lib/communityCategoryEditorUtils";

const CONFIG_REF = doc(db, "config", "communityCategories");

export function useCommunityCategories() {
  const [data, setData] = useState<CommunityCategoryDoc>(DEFAULT_COMMUNITY_CATEGORIES);
  const [fromServer, setFromServer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      CONFIG_REF,
      (snap) => {
        if (snap.exists()) {
          const normalized = ensureCommunityCategoryDoc(snap.data());
          setFromServer(true);
          setData(normalized.mains.length ? normalized : DEFAULT_COMMUNITY_CATEGORIES);
        } else {
          setData(DEFAULT_COMMUNITY_CATEGORIES);
          setFromServer(false);
        }
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return { categoryDoc: data, categoriesLoading: loading, categoriesFromServer: fromServer };
}

export { CONFIG_REF };

import { useEffect, useState } from "react";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase";

export function AdminPostImageThumb({ path }: { path?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getDownloadURL(ref(storage, path))
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) return <span className="text-xs text-muted-foreground">No image</span>;
  if (!url) return <span className="text-xs text-muted-foreground">…</span>;
  return (
    <img src={url} alt="" className="h-10 w-14 rounded border object-cover bg-muted" loading="lazy" />
  );
}

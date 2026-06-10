import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CommunityView } from "@/components/community/CommunityMemberSidebar";

const VIEW_LABELS: Record<Exclude<CommunityView, "home">, string> = {
  "my-space": "My Space",
  profile: "Edit Profile",
  notifications: "Notifications",
};

type Props = {
  view: Exclude<CommunityView, "home">;
  onBack: () => void;
};

export function CommunityViewHeader({ view, onBack }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="ghost" size="sm" className="gap-2 -ml-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Button>
      <span className="text-sm text-muted-foreground">· {VIEW_LABELS[view]}</span>
    </div>
  );
}

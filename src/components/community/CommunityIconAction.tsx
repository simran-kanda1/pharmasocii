import { Bookmark, Copy, Linkedin, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
};

export function CommunityIconAction({
  label,
  icon: Icon,
  onClick,
  active,
  disabled,
  title,
  className,
}: ActionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50 disabled:opacity-50 disabled:pointer-events-none",
        active && "text-primary",
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      title={title}
      aria-label={label}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary fill-current")} />
      <span className="hidden sm:inline truncate">{label}</span>
    </button>
  );
}

export const communityActionIcons = {
  save: Bookmark,
  report: ShieldAlert,
  linkedIn: Linkedin,
  copyLink: Copy,
} as const;

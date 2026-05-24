import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "@/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, Home, LogOut, Monitor, User } from "lucide-react";

export type CommunityView = "home" | "my-space" | "profile" | "notifications";

type CommunityMemberSidebarProps = {
  welcomeName: string;
  profileInitials: string;
  activeView: CommunityView;
  onViewChange: (view: CommunityView) => void;
  notificationUnread: number;
  selectedCountries: string[];
  selectedFilterKeysCount: number;
  signedIn: boolean;
};

export function CommunityMemberSidebar({
  welcomeName,
  profileInitials,
  activeView,
  onViewChange,
  notificationUnread,
  selectedCountries,
  selectedFilterKeysCount,
  signedIn,
}: CommunityMemberSidebarProps) {
  const navigate = useNavigate();

  const navItem = (view: CommunityView, label: string, icon: React.ComponentType<{ className?: string }>, badge?: number) => {
    const Icon = icon;
    const active = activeView === view;
    return (
      <button
        type="button"
        onClick={() => onViewChange(view)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
          active ? "bg-slate-100 text-foreground dark:bg-muted" : "text-muted-foreground hover:bg-slate-50 hover:text-foreground dark:hover:bg-muted/50",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-foreground/15 dark:bg-card space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-foreground/10">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-slate-800 text-white font-semibold dark:bg-primary">{profileInitials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Welcome</p>
          <p className="font-semibold leading-tight">{welcomeName}</p>
        </div>
      </div>

      {signedIn ? (
        <nav className="space-y-1">
          {navItem("home", "Home", Home)}
          {navItem("my-space", "My Space", Monitor)}
          {navItem("profile", "Edit Profile", User)}
          {navItem("notifications", "Notifications", Bell, notificationUnread)}
          <button
            type="button"
            onClick={async () => {
              await signOut(auth);
              navigate("/");
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-slate-50 hover:text-foreground dark:hover:bg-muted/50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => navigate("/member/login")}>
          Sign in
        </Button>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Interest(s)</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-2.5 text-center dark:border-foreground/15 dark:bg-muted/30">
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Countries</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-3">
              {selectedCountries.length ? selectedCountries.join(", ") : "No countries selected"}
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-2.5 text-center dark:border-foreground/15 dark:bg-muted/30">
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Categories</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {selectedFilterKeysCount > 0 ? `${selectedFilterKeysCount} filter(s) active` : "No categories selected"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
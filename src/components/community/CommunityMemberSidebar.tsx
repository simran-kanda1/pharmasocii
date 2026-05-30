import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "@/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, Home, LogOut, Monitor, User, X } from "lucide-react";
import type { CommunityCategoryDoc } from "@/lib/communityTypes";
import { filterKeyToLabel } from "@/lib/communityFilterPreferences";

export type CommunityView = "home" | "my-space" | "profile" | "notifications";

type CommunityMemberSidebarProps = {
  welcomeName: string;
  profileInitials: string;
  activeView: CommunityView;
  onViewChange: (view: CommunityView) => void;
  notificationUnread: number;
  selectedCountries: string[];
  selectedFilterKeys: string[];
  categoryDoc: CommunityCategoryDoc | null;
  signedIn: boolean;
  onRemoveCountry?: (country: string) => void;
  onRemoveFilterKey?: (key: string) => void;
  onClearAllFilters?: () => void;
};

export function CommunityMemberSidebar({
  welcomeName,
  profileInitials,
  activeView,
  onViewChange,
  notificationUnread,
  selectedCountries,
  selectedFilterKeys,
  categoryDoc,
  signedIn,
  onRemoveCountry,
  onRemoveFilterKey,
  onClearAllFilters,
}: CommunityMemberSidebarProps) {
  const navigate = useNavigate();
  const hasFilters = selectedCountries.length > 0 || selectedFilterKeys.length > 0;

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
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interest(s)</p>
          {hasFilters && onClearAllFilters && signedIn && (
            <button
              type="button"
              className="text-[10px] font-medium text-primary hover:underline"
              onClick={onClearAllFilters}
            >
              Clear all
            </button>
          )}
        </div>
        {!hasFilters ? (
          <p className="text-xs text-muted-foreground">
            Use the filters on the right to choose countries and categories. Your selections are saved for next visit.
          </p>
        ) : (
          <div className="space-y-3">
            {selectedCountries.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">Countries</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCountries.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 max-w-full rounded-md bg-slate-100 dark:bg-muted px-2 py-0.5 text-[11px]"
                    >
                      <span className="truncate">{c}</span>
                      {onRemoveCountry && (
                        <button
                          type="button"
                          className="shrink-0 rounded hover:bg-slate-200 dark:hover:bg-muted-foreground/20 p-0.5"
                          aria-label={`Remove ${c}`}
                          onClick={() => onRemoveCountry(c)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedFilterKeys.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFilterKeys.map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 max-w-full rounded-md bg-slate-100 dark:bg-muted px-2 py-0.5 text-[11px]"
                    >
                      <span className="truncate" title={filterKeyToLabel(key, categoryDoc)}>
                        {filterKeyToLabel(key, categoryDoc)}
                      </span>
                      {onRemoveFilterKey && (
                        <button
                          type="button"
                          className="shrink-0 rounded hover:bg-slate-200 dark:hover:bg-muted-foreground/20 p-0.5"
                          aria-label="Remove category filter"
                          onClick={() => onRemoveFilterKey(key)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

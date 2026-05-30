import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  breadcrumb?: string[];
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
};

export function AdminDetailChrome({ title, breadcrumb, onBack, backLabel = "Back", children }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight uppercase">{title}</h2>
        {breadcrumb && breadcrumb.length > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Home className="h-3.5 w-3.5" />
            {breadcrumb.map((part, i) => (
              <span key={part}>
                {i > 0 && " / "}
                {part}
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-white shadow-sm dark:border-foreground/15 dark:bg-card">{children}</div>

      <Button type="button" className="w-full h-11 bg-foreground text-background hover:bg-foreground/90" onClick={onBack}>
        {backLabel}
      </Button>
    </div>
  );
}

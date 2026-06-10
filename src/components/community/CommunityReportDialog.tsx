import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { COMMUNITY_REPORT_REASONS } from "@/lib/communityReportReasons";
import { AlreadyReportedError } from "@/lib/submitCommunityReport";
import { cn } from "@/lib/utils";

type CommunityReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  onSubmit: (reason: string) => Promise<void>;
};

export function CommunityReportDialog({
  open,
  onOpenChange,
  title = "Thank you for your feedback",
  onSubmit,
}: CommunityReportDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setSelected(null);
    setError("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!selected) {
      setError("Select one option before submitting.");
      return;
    }
    setError("");
    try {
      setSubmitting(true);
      await onSubmit(selected);
      close();
    } catch (err) {
      if (err instanceof AlreadyReportedError) {
        setError("You have already reported this content.");
      } else {
        setError("Report failed. You may have already reported this item.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">{title}</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2 py-2">
          {COMMUNITY_REPORT_REASONS.map((reason) => (
            <li key={reason}>
              <label
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                  selected === reason
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 hover:bg-muted/40 dark:border-foreground/15",
                )}
              >
                <Checkbox
                  checked={selected === reason}
                  onCheckedChange={() => setSelected(reason)}
                />
                <span className="text-sm">{reason}</span>
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <DialogFooter className="sm:justify-center">
          <Button type="button" className="min-w-[140px]" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

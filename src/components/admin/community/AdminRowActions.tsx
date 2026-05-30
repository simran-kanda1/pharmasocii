import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2 } from "lucide-react";

type Props = {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  disabled?: boolean;
  viewOnly?: boolean;
};

export function AdminRowActions({
  onView,
  onEdit,
  onDelete,
  disabled,
  viewOnly,
}: Props) {
  return (
    <div className="flex justify-end gap-1">
      {onView && (
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled} onClick={onView}>
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {!viewOnly && onEdit && (
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {!viewOnly && onDelete && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive"
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

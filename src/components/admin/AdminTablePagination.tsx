import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Build 0-based page indices with ellipsis markers for compact pagination. */
export function buildAdminPageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 0) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }

  const pages = new Set<number>([0, total - 1, current]);
  if (current > 0) pages.add(current - 1);
  if (current < total - 1) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(sorted[i]);
  }
  return result;
}

type Props = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalLabel?: React.ReactNode;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
};

export function AdminTablePagination({
  page,
  pageCount,
  onPageChange,
  totalLabel,
  onRefresh,
  refreshDisabled,
}: Props) {
  const pageItems = buildAdminPageList(page, pageCount);
  const canPrev = page > 0;
  const canNext = page + 1 < pageCount;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
      {totalLabel ? <span>{totalLabel}</span> : <span />}

      <div className="flex flex-wrap items-center gap-1 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline ml-0.5">Prev</span>
        </Button>

        <div className="flex items-center gap-0.5 mx-1">
          {pageItems.map((item, idx) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 text-muted-foreground select-none">
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={item === page ? "default" : "outline"}
                className={cn("h-8 min-w-8 px-2", item === page && "pointer-events-none")}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item + 1}`}
                aria-current={item === page ? "page" : undefined}
              >
                {item + 1}
              </Button>
            ),
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <span className="hidden sm:inline mr-0.5">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {pageCount > 0 && (
          <span className="ml-2 text-xs whitespace-nowrap hidden md:inline">
            Page {page + 1} of {pageCount}
          </span>
        )}

        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 ml-1"
            onClick={onRefresh}
            disabled={refreshDisabled}
          >
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CommunityCategoryDoc, CommunityMain, CommunitySub, CommunitySubSub } from "@/lib/communityTypes";
import {
  createEmptyMain,
  createEmptySub,
  createEmptySubSub,
  slugifyCategoryId,
} from "@/lib/communityCategoryEditorUtils";
import { cn } from "@/lib/utils";

function SubSubRow({
  ss,
  onChange,
  onRemove,
  disabled,
}: {
  ss: CommunitySubSub;
  onChange: (patch: Partial<CommunitySubSub>) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-100 bg-slate-50/80 p-3 dark:border-foreground/10 dark:bg-muted/20">
      <div className="min-w-[140px] flex-1 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Sub-sub label
        </label>
        <Input
          value={ss.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Gene therapy"
          disabled={disabled}
          className="h-9 text-sm"
        />
      </div>
      <div className="w-full min-w-[120px] sm:w-40 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Id</label>
        <Input
          value={ss.id}
          onChange={(e) => onChange({ id: e.target.value })}
          placeholder="internal_key"
          disabled={disabled}
          className="h-9 font-mono text-xs"
        />
      </div>
      <div className="flex gap-1 pb-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground"
          title="Generate id from label"
          disabled={disabled}
          onClick={() => onChange({ id: slugifyCategoryId(ss.label) })}
        >
          <Wand2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
          title="Remove"
          disabled={disabled}
          onClick={() => {
            if (window.confirm("Remove this sub-sub category?")) onRemove();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SubBlock({
  sub,
  onChangeSub,
  onRemoveSub,
  disabled,
}: {
  sub: CommunitySub;
  onChangeSub: (patch: Partial<CommunitySub>) => void;
  onRemoveSub: () => void;
  disabled?: boolean;
}) {
  const updateSubSubs = (next: CommunitySubSub[]) => onChangeSub({ subSubs: next });

  const setSubSub = (ssi: number, patch: Partial<CommunitySubSub>) => {
    const subSubs = [...(sub.subSubs ?? [])];
    subSubs[ssi] = { ...subSubs[ssi], ...patch };
    updateSubSubs(subSubs);
  };

  const removeSubSub = (ssi: number) => {
    updateSubSubs((sub.subSubs ?? []).filter((_, i) => i !== ssi));
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-foreground/15 dark:bg-card">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1 space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Sub-category label
          </label>
          <Input
            value={sub.label}
            onChange={(e) => onChangeSub({ label: e.target.value })}
            placeholder="e.g. Drug substance manufacturing"
            disabled={disabled}
            className="h-9 text-sm"
          />
        </div>
        <div className="w-full min-w-[120px] sm:w-44 space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Id</label>
          <Input
            value={sub.id}
            onChange={(e) => onChangeSub({ id: e.target.value })}
            disabled={disabled}
            className="h-9 font-mono text-xs"
          />
        </div>
        <div className="flex gap-1 pb-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Generate id from label"
            disabled={disabled}
            onClick={() => onChangeSub({ id: slugifyCategoryId(sub.label) })}
          >
            <Wand2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
            title="Remove sub-category"
            disabled={disabled}
            onClick={() => {
              if (window.confirm("Remove this sub-category and all its sub-sub categories?")) onRemoveSub();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 border-l-2 border-slate-200 pl-3 ml-1 space-y-2 dark:border-foreground/20">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Sub-sub categories</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={disabled}
            onClick={() => updateSubSubs([...(sub.subSubs ?? []), createEmptySubSub()])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add sub-sub
          </Button>
        </div>
        {(sub.subSubs ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">None — optional third level.</p>
        ) : (
          <div className="space-y-2">
            {(sub.subSubs ?? []).map((ss, ssi) => (
              <SubSubRow
                key={`${sub.id}-${ss.id}-${ssi}`}
                ss={ss}
                disabled={disabled}
                onChange={(patch) => setSubSub(ssi, patch)}
                onRemove={() => removeSubSub(ssi)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MainBlock({
  mainIndex,
  main,
  onChangeMain,
  onRemoveMain,
  disabled,
}: {
  mainIndex: number;
  main: CommunityMain;
  onChangeMain: (patch: Partial<CommunityMain>) => void;
  onRemoveMain: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const subCount = main.subs?.length ?? 0;

  const updateSubs = (next: CommunitySub[]) => onChangeMain({ subs: next });

  const setSub = (si: number, patch: Partial<CommunitySub>) => {
    const subs = [...(main.subs ?? [])];
    subs[si] = { ...subs[si], ...patch };
    updateSubs(subs);
  };

  const removeSub = (si: number) => {
    updateSubs((main.subs ?? []).filter((_, i) => i !== si));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:border-foreground/15 dark:bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-foreground/10 dark:bg-muted/30">
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-semibold text-foreground min-w-0"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="truncate">
            Main {mainIndex + 1}
            {main.label ? `: ${main.label}` : ""}
          </span>
          <span className="text-xs font-normal text-muted-foreground">({subCount} sub)</span>
        </button>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1 space-y-1">
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Main label
              </label>
              <Input
                value={main.label}
                onChange={(e) => onChangeMain({ label: e.target.value })}
                placeholder="e.g. Manufacturing"
                disabled={disabled}
                className="h-9"
              />
            </div>
            <div className="w-full min-w-[120px] sm:w-48 space-y-1">
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Id</label>
              <Input
                value={main.id}
                onChange={(e) => onChangeMain({ id: e.target.value })}
                disabled={disabled}
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1 pb-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                title="Generate id from label"
                disabled={disabled}
                onClick={() => onChangeMain({ id: slugifyCategoryId(main.label) })}
              >
                <Wand2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={disabled}
                onClick={() => updateSubs([...(main.subs ?? []), createEmptySub()])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add sub-category
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                title="Remove main category"
                disabled={disabled}
                onClick={() => {
                  if (
                    window.confirm(
                      "Remove this main category and everything under it? Posts already using these labels will still show old text until edited.",
                    )
                  )
                    onRemoveMain();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-l-2 border-primary/25 pl-3 ml-1">
            {(main.subs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sub-categories yet. Add at least one so members can classify posts under this main topic.
              </p>
            ) : (
              (main.subs ?? []).map((sub, si) => (
                <SubBlock
                  key={`${main.id}-${sub.id}-${si}`}
                  sub={sub}
                  disabled={disabled}
                  onChangeSub={(patch) => setSub(si, patch)}
                  onRemoveSub={() => removeSub(si)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CommunityCategoryTreeEditor({
  value,
  onChange,
  disabled,
}: {
  value: CommunityCategoryDoc;
  onChange: (next: CommunityCategoryDoc) => void;
  disabled?: boolean;
}) {
  const mains = value.mains ?? [];

  const setMain = (mi: number, patch: Partial<CommunityMain>) => {
    const nextMains = [...mains];
    nextMains[mi] = { ...nextMains[mi], ...patch };
    onChange({ ...value, mains: nextMains });
  };

  const removeMain = (mi: number) => {
    onChange({ ...value, mains: mains.filter((_, i) => i !== mi) });
  };

  const summary = useMemo(() => {
    let subs = 0;
    let subSubs = 0;
    for (const m of mains) {
      subs += m.subs?.length ?? 0;
      for (const s of m.subs ?? []) {
        subSubs += s.subSubs?.length ?? 0;
      }
    }
    return { mains: mains.length, subs, subSubs };
  }, [mains]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{summary.mains}</span> main ·{" "}
          <span className="font-medium text-foreground">{summary.subs}</span> sub ·{" "}
          <span className="font-medium text-foreground">{summary.subSubs}</span> sub-sub
        </p>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => onChange({ ...value, mains: [...mains, createEmptyMain()] })}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add main category
        </Button>
      </div>

      {mains.length === 0 ? (
        <div
          className={cn(
            "rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm text-muted-foreground",
            "dark:border-foreground/20 dark:bg-muted/20",
          )}
        >
          No categories yet. Click &quot;Add main category&quot; to start. The same tree is used on{" "}
          <strong className="text-foreground">Community</strong> posts and filters.
        </div>
      ) : (
        <div className="space-y-4">
          {mains.map((main, mi) => (
            <MainBlock
              key={`${main.id}-${mi}`}
              mainIndex={mi}
              main={main}
              disabled={disabled}
              onChangeMain={(patch) => setMain(mi, patch)}
              onRemoveMain={() => removeMain(mi)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Labels</strong> are what members see and what is saved on posts.{" "}
        <strong className="text-foreground">Ids</strong> are stable keys (changing an id later does not update old
        posts). Use the wand to derive an id from the label when adding rows.
      </p>
    </div>
  );
}

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CommunityCategoryDoc } from "@/lib/communityTypes";
import {
  POST_MAIN_CAT_MAX,
  POST_MAIN_CAT_MIN,
  POST_SUB_PER_MAIN_MAX,
  POST_SUBSUB_PER_SUB_MAX,
  buildFilterKeys,
} from "@/lib/community";
import type { SelectedCategoryBranch } from "@/lib/communityTypes";
import {
  canActivateMainInPicker,
  canAddSubInPicker,
  canAddSubSubInPicker,
  categoryLimitHelpText,
  countActiveMainsInPicker,
  summarizePickerSelection,
} from "@/lib/communityCategoryLimits";

export type CategorySelectionState = {
  /** main label -> Set of sub labels (or "__main_only__" when only main selected) */
  subsByMain: Map<string, Set<string>>;
  /** "main|subLabel" -> Set of sub-sub labels */
  subSubsByMainSub: Map<string, Set<string>>;
};

function keyMainSub(main: string, sub: string) {
  return `${main}|||${sub}`;
}

export function emptyCategorySelection(): CategorySelectionState {
  return { subsByMain: new Map(), subSubsByMainSub: new Map() };
}

/** Rebuild picker state from stored post category arrays (admin edit). */
export function postFieldsToCategorySelection(
  doc: CommunityCategoryDoc,
  mainCategories: string[],
  subCategories: string[],
  subSubCategories: string[],
): CategorySelectionState {
  const sel = emptyCategorySelection();
  for (const main of doc.mains) {
    if (!mainCategories.includes(main.label)) continue;
    const subsSet = new Set<string>();
    let hasSpecific = false;
    for (const sub of main.subs ?? []) {
      if (subCategories.includes(sub.label)) {
        subsSet.add(sub.label);
        hasSpecific = true;
        const msKey = keyMainSub(main.label, sub.label);
        const ssSet = new Set<string>();
        for (const ss of sub.subSubs ?? []) {
          if (subSubCategories.includes(ss.label)) ssSet.add(ss.label);
        }
        if (ssSet.size > 0) sel.subSubsByMainSub.set(msKey, ssSet);
      }
    }
    if (!hasSpecific) subsSet.add("__main_only__");
    if (subsSet.size > 0) sel.subsByMain.set(main.label, subsSet);
  }
  return sel;
}

export function selectionToPostFields(
  doc: CommunityCategoryDoc,
  sel: CategorySelectionState,
): {
  mainCategories: string[];
  subCategories: string[];
  subSubCategories: string[];
} {
  const mainCategories: string[] = [];
  const subCategories: string[] = [];
  const subSubCategories: string[] = [];

  for (const main of doc.mains) {
    const subs = sel.subsByMain.get(main.label);
    if (!subs || subs.size === 0) continue;
    mainCategories.push(main.label);

    if (subs.has("__main_only__") && subs.size === 1) {
      continue;
    }

    for (const sub of main.subs ?? []) {
      if (!subs.has(sub.label)) continue;
      const hasSubSubs = (sub.subSubs?.length ?? 0) > 0;
      const msKey = keyMainSub(main.label, sub.label);
      const pickedSubSubs = sel.subSubsByMainSub.get(msKey);

      if (hasSubSubs && pickedSubSubs && pickedSubSubs.size > 0) {
        for (const ss of sub.subSubs ?? []) {
          if (pickedSubSubs.has(ss.label)) subSubCategories.push(ss.label);
        }
      } else {
        subCategories.push(sub.label);
      }
    }
  }

  return { mainCategories, subCategories, subSubCategories };
}

export function buildFilterKeysFromSelection(
  doc: CommunityCategoryDoc,
  sel: CategorySelectionState,
): string[] {
  const branches: SelectedCategoryBranch[] = [];
  for (const main of doc.mains) {
    const subs = sel.subsByMain.get(main.label);
    if (!subs?.size) continue;
    if (subs.has("__main_only__") && subs.size === 1) {
      branches.push({ mainLabel: main.label, subLabels: [], subSubLabels: [] });
      continue;
    }
    const subLabels: string[] = [];
    const subSubLabels: string[] = [];
    for (const sub of main.subs ?? []) {
      if (!subs.has(sub.label)) continue;
      const msKey = keyMainSub(main.label, sub.label);
      const picked = sel.subSubsByMainSub.get(msKey);
      if ((sub.subSubs?.length ?? 0) > 0 && picked?.size) {
        for (const ss of sub.subSubs ?? []) {
          if (picked.has(ss.label)) subSubLabels.push(ss.label);
        }
      } else {
        subLabels.push(sub.label);
      }
    }
    branches.push({ mainLabel: main.label, subLabels, subSubLabels });
  }
  return buildFilterKeys(branches);
}

export function validateCategorySelection(
  doc: CommunityCategoryDoc,
  sel: CategorySelectionState,
): string | null {
  const mains = doc.mains.filter((m) => {
    const s = sel.subsByMain.get(m.label);
    return s && s.size > 0;
  });
  if (mains.length < POST_MAIN_CAT_MIN) return `Select at least ${POST_MAIN_CAT_MIN} main category.`;
  if (mains.length > POST_MAIN_CAT_MAX) return `At most ${POST_MAIN_CAT_MAX} main categories.`;

  for (const main of mains) {
    const subs = sel.subsByMain.get(main.label)!;
    if (subs.has("__main_only__") && subs.size === 1) continue;

    const realSubs = [...subs].filter((x) => x !== "__main_only__");
    if (realSubs.length > POST_SUB_PER_MAIN_MAX) {
      return `At most ${POST_SUB_PER_MAIN_MAX} sub-categories per main (${main.label}).`;
    }

    for (const subLabel of realSubs) {
      const sub = (main.subs ?? []).find((s) => s.label === subLabel);
      if (!sub) continue;
      const msKey = keyMainSub(main.label, sub.label);
      const ss = sel.subSubsByMainSub.get(msKey);
      if ((sub.subSubs?.length ?? 0) > 0 && ss && ss.size > POST_SUBSUB_PER_SUB_MAX) {
        return `At most ${POST_SUBSUB_PER_SUB_MAX} sub-sub-categories for ${sub.label}.`;
      }
    }
  }
  return null;
}

type Props = {
  doc: CommunityCategoryDoc;
  value: CategorySelectionState;
  onChange: (next: CategorySelectionState) => void;
};

export function CategoryPicker({ doc, value, onChange }: Props) {
  const toggleMainOnly = (mainLabel: string, checked: boolean) => {
    const next = {
      subsByMain: new Map(value.subsByMain),
      subSubsByMainSub: new Map(value.subSubsByMainSub),
    };
    if (checked) {
      if (!canActivateMainInPicker(next.subsByMain, mainLabel)) {
        return;
      }
      next.subsByMain.set(mainLabel, new Set(["__main_only__"]));
    } else {
      next.subsByMain.delete(mainLabel);
      for (const k of [...next.subSubsByMainSub.keys()]) {
        if (k.startsWith(`${mainLabel}|||`)) next.subSubsByMainSub.delete(k);
      }
    }
    onChange(next);
  };

  const toggleSub = (mainLabel: string, subLabel: string, checked: boolean) => {
    const next = {
      subsByMain: new Map(value.subsByMain),
      subSubsByMainSub: new Map(value.subSubsByMainSub),
    };
    let set = next.subsByMain.get(mainLabel) ?? new Set<string>();
    set = new Set(set);
    set.delete("__main_only__");

    const subNode = doc.mains.find((m) => m.label === mainLabel)?.subs?.find((s) => s.label === subLabel);
    const hasSubSubs = (subNode?.subSubs?.length ?? 0) > 0;

    if (checked) {
      if (!canAddSubInPicker(next.subsByMain, mainLabel, subLabel)) return;

      set.add(subLabel);
      next.subsByMain.set(mainLabel, set);
      if (!hasSubSubs) {
        const msKey = keyMainSub(mainLabel, subLabel);
        next.subSubsByMainSub.delete(msKey);
      }
    } else {
      set.delete(subLabel);
      if (set.size === 0) next.subsByMain.delete(mainLabel);
      else next.subsByMain.set(mainLabel, set);
      next.subSubsByMainSub.delete(keyMainSub(mainLabel, subLabel));
    }
    onChange(next);
  };

  const toggleSubSub = (mainLabel: string, subLabel: string, subSubLabel: string, checked: boolean) => {
    const msKey = keyMainSub(mainLabel, subLabel);
    const next = {
      subsByMain: new Map(value.subsByMain),
      subSubsByMainSub: new Map(value.subSubsByMainSub),
    };
    let ss = next.subSubsByMainSub.get(msKey) ?? new Set<string>();
    ss = new Set(ss);
    if (checked) {
      if (
        !canAddSubSubInPicker(
          next.subsByMain,
          next.subSubsByMainSub,
          mainLabel,
          subLabel,
          subSubLabel,
        )
      ) {
        return;
      }
      ss.add(subSubLabel);
    } else {
      ss.delete(subSubLabel);
    }
    if (ss.size === 0) next.subSubsByMainSub.delete(msKey);
    else next.subSubsByMainSub.set(msKey, ss);

    let subs = next.subsByMain.get(mainLabel) ?? new Set();
    subs = new Set(subs);
    subs.delete("__main_only__");
    subs.add(subLabel);
    next.subsByMain.set(mainLabel, subs);

    onChange(next);
  };

  return (
    <div className="space-y-6 border border-foreground/10 rounded-xl p-4 bg-foreground/[0.02]">
      <div>
        <p className="text-sm font-medium">Categories</p>
        <p className="text-xs text-muted-foreground">{categoryLimitHelpText()}</p>
        <p className="text-xs font-medium text-foreground/80 mt-1">
          {summarizePickerSelection(doc, value.subsByMain)}
        </p>
      </div>
      {doc.mains.map((main) => {
        const active = value.subsByMain.get(main.label);
        const mainChecked = !!(active && active.size > 0);
        const onlyMain = mainChecked && active?.has("__main_only__") && active.size === 1;
        const hasSubs = (main.subs?.length ?? 0) > 0;
        const canActivateMain = canActivateMainInPicker(value.subsByMain, main.label);
        return (
          <div key={main.id} className="space-y-3 border-t border-foreground/10 pt-4 first:border-t-0 first:pt-0">
            {!hasSubs ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`main-${main.id}`}
                  checked={mainChecked}
                  onCheckedChange={(c) => toggleMainOnly(main.label, c === true)}
                  disabled={!mainChecked && !canActivateMain}
                />
                <Label htmlFor={`main-${main.id}`} className="font-semibold cursor-pointer">
                  {main.label}
                </Label>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-semibold text-sm text-foreground">{main.label}</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`main-only-${main.id}`}
                    checked={onlyMain}
                    onCheckedChange={(c) => toggleMainOnly(main.label, c === true)}
                    disabled={!onlyMain && !canActivateMain}
                  />
                  <Label htmlFor={`main-only-${main.id}`} className="text-xs text-muted-foreground cursor-pointer">
                    Entire category (no specific sub-categories)
                  </Label>
                </div>
              </div>
            )}
            <div className="pl-6 space-y-2">
              {(main.subs ?? []).map((sub) => {
                const subs = value.subsByMain.get(main.label);
                const subOn = subs?.has(sub.label) ?? false;
                const canPickSub = canAddSubInPicker(value.subsByMain, main.label, sub.label);
                return (
                  <div key={sub.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`sub-${main.id}-${sub.id}`}
                        checked={subOn}
                        onCheckedChange={(c) => toggleSub(main.label, sub.label, c === true)}
                        disabled={!subOn && (!canPickSub || onlyMain)}
                      />
                      <Label htmlFor={`sub-${main.id}-${sub.id}`} className="cursor-pointer">
                        {sub.label}
                      </Label>
                    </div>
                    {subOn && (sub.subSubs?.length ?? 0) > 0 && (
                      <div className="pl-6 space-y-2 border-l border-foreground/10 ml-2">
                        {(sub.subSubs ?? []).map((ss) => {
                          const picked = value.subSubsByMainSub.get(keyMainSub(main.label, sub.label))?.has(ss.label) ?? false;
                          const canPickSubSub = canAddSubSubInPicker(
                            value.subsByMain,
                            value.subSubsByMainSub,
                            main.label,
                            sub.label,
                            ss.label,
                          );
                          return (
                            <div key={ss.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`ss-${main.id}-${sub.id}-${ss.id}`}
                                checked={picked}
                                onCheckedChange={(c) =>
                                  toggleSubSub(main.label, sub.label, ss.label, c === true)
                                }
                                disabled={!picked && !canPickSubSub}
                              />
                              <Label htmlFor={`ss-${main.id}-${sub.id}-${ss.id}`} className="cursor-pointer text-sm">
                                {ss.label}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

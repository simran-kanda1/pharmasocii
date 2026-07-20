import { useEffect, useState } from "react";
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
  pickerLimitBlockReason,
  summarizePickerSelection,
} from "@/lib/communityCategoryLimits";

export type CategorySelectionState = {
  /** main label -> Set of sub labels (or "__main_only__" when main selected with no specific subs) */
  subsByMain: Map<string, Set<string>>;
  /** "main|||subLabel" -> Set of sub-sub labels */
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
      // Also restore subs that only have sub-subs selected (stored as sub-subs without sub label).
      const msKey = keyMainSub(main.label, sub.label);
      const ssSet = new Set<string>();
      for (const ss of sub.subSubs ?? []) {
        if (subSubCategories.includes(ss.label)) ssSet.add(ss.label);
      }
      if (ssSet.size > 0) {
        subsSet.add(sub.label);
        hasSpecific = true;
        sel.subSubsByMainSub.set(msKey, ssSet);
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
      // Always keep the sub label so restore/counting stay tied to this main.
      subCategories.push(sub.label);
      const msKey = keyMainSub(main.label, sub.label);
      const pickedSubSubs = sel.subSubsByMainSub.get(msKey);
      if (!pickedSubSubs?.size) continue;
      for (const ss of sub.subSubs ?? []) {
        if (pickedSubSubs.has(ss.label)) subSubCategories.push(ss.label);
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
      subLabels.push(sub.label);
      const msKey = keyMainSub(main.label, sub.label);
      const picked = sel.subSubsByMainSub.get(msKey);
      if (!picked?.size) continue;
      for (const ss of sub.subSubs ?? []) {
        if (picked.has(ss.label)) subSubLabels.push(ss.label);
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
  const [limitError, setLimitError] = useState<string | null>(null);

  useEffect(() => {
    if (!limitError) return;
    const t = window.setTimeout(() => setLimitError(null), 6000);
    return () => window.clearTimeout(t);
  }, [limitError]);

  const softValidation = (() => {
    const mains = countActiveMainsInPicker(value.subsByMain, doc);
    if (mains === 0) return null;
    return validateCategorySelection(doc, value);
  })();

  const clearMain = (
    next: CategorySelectionState,
    mainLabel: string,
  ) => {
    next.subsByMain.delete(mainLabel);
    for (const k of [...next.subSubsByMainSub.keys()]) {
      if (k.startsWith(`${mainLabel}|||`)) next.subSubsByMainSub.delete(k);
    }
  };

  const toggleMain = (mainLabel: string, checked: boolean) => {
    const next = {
      subsByMain: new Map(value.subsByMain),
      subSubsByMainSub: new Map(value.subSubsByMainSub),
    };
    if (checked) {
      const reason = pickerLimitBlockReason("main", next.subsByMain, next.subSubsByMainSub, mainLabel, {
        doc,
      });
      if (reason) {
        setLimitError(reason);
        return;
      }
      // Main selected with no specific subs yet = whole main.
      next.subsByMain.set(mainLabel, new Set(["__main_only__"]));
    } else {
      clearMain(next, mainLabel);
    }
    setLimitError(null);
    onChange(next);
  };

  const toggleSub = (mainLabel: string, subLabel: string, checked: boolean) => {
    const next = {
      subsByMain: new Map(value.subsByMain),
      subSubsByMainSub: new Map(value.subSubsByMainSub),
    };
    const mainActive = (next.subsByMain.get(mainLabel)?.size ?? 0) > 0;

    if (checked) {
      // Auto-select the main if needed (counts toward the 3-main limit).
      if (!mainActive) {
        const mainReason = pickerLimitBlockReason("main", next.subsByMain, next.subSubsByMainSub, mainLabel, {
          doc,
        });
        if (mainReason) {
          setLimitError(mainReason);
          return;
        }
        next.subsByMain.set(mainLabel, new Set());
      }

      const reason = pickerLimitBlockReason("sub", next.subsByMain, next.subSubsByMainSub, mainLabel, {
        subLabel,
        doc,
      });
      if (reason) {
        setLimitError(reason);
        return;
      }

      let set = new Set(next.subsByMain.get(mainLabel) ?? []);
      set.delete("__main_only__");
      set.add(subLabel);
      next.subsByMain.set(mainLabel, set);
    } else {
      let set = new Set(next.subsByMain.get(mainLabel) ?? []);
      set.delete(subLabel);
      next.subSubsByMainSub.delete(keyMainSub(mainLabel, subLabel));
      const realSubs = [...set].filter((x) => x !== "__main_only__");
      if (realSubs.length === 0 && set.size === 0) {
        // Keep the main selected as "whole main" if it was selected.
        if (mainActive) next.subsByMain.set(mainLabel, new Set(["__main_only__"]));
        else next.subsByMain.delete(mainLabel);
      } else if (realSubs.length === 0) {
        next.subsByMain.set(mainLabel, new Set(["__main_only__"]));
      } else {
        next.subsByMain.set(mainLabel, new Set(realSubs));
      }
    }
    setLimitError(null);
    onChange(next);
  };

  const toggleSubSub = (mainLabel: string, subLabel: string, subSubLabel: string, checked: boolean) => {
    const msKey = keyMainSub(mainLabel, subLabel);
    const next = {
      subsByMain: new Map(value.subsByMain),
      subSubsByMainSub: new Map(value.subSubsByMainSub),
    };

    if (checked) {
      // Ensure main + sub are selected first.
      const mainActive = (next.subsByMain.get(mainLabel)?.size ?? 0) > 0;
      if (!mainActive) {
        const mainReason = pickerLimitBlockReason("main", next.subsByMain, next.subSubsByMainSub, mainLabel, {
          doc,
        });
        if (mainReason) {
          setLimitError(mainReason);
          return;
        }
        next.subsByMain.set(mainLabel, new Set());
      }

      let subs = new Set(next.subsByMain.get(mainLabel) ?? []);
      if (!subs.has(subLabel)) {
        const subReason = pickerLimitBlockReason("sub", next.subsByMain, next.subSubsByMainSub, mainLabel, {
          subLabel,
          doc,
        });
        if (subReason) {
          setLimitError(subReason);
          return;
        }
        subs.delete("__main_only__");
        subs.add(subLabel);
        next.subsByMain.set(mainLabel, subs);
      }

      const reason = pickerLimitBlockReason(
        "subsub",
        next.subsByMain,
        next.subSubsByMainSub,
        mainLabel,
        { subLabel, subSubLabel, doc },
      );
      if (reason) {
        setLimitError(reason);
        return;
      }

      let ss = new Set(next.subSubsByMainSub.get(msKey) ?? []);
      ss.add(subSubLabel);
      next.subSubsByMainSub.set(msKey, ss);
    } else {
      let ss = new Set(next.subSubsByMainSub.get(msKey) ?? []);
      ss.delete(subSubLabel);
      if (ss.size === 0) next.subSubsByMainSub.delete(msKey);
      else next.subSubsByMainSub.set(msKey, ss);
    }

    setLimitError(null);
    onChange(next);
  };

  const displayError = limitError || softValidation;

  return (
    <div className="space-y-6 border border-foreground/10 rounded-xl p-4 bg-foreground/[0.02]">
      <div>
        <p className="text-sm font-medium">Categories</p>
        <p className="text-xs text-muted-foreground">
          Select up to {POST_MAIN_CAT_MAX} main categories. For each selected main, you can add up to{" "}
          {POST_SUB_PER_MAIN_MAX} sub-categories and up to {POST_SUBSUB_PER_SUB_MAX} sub-sub-categories per
          sub when available.
        </p>
        <p className="text-xs text-muted-foreground mt-1">{categoryLimitHelpText()}</p>
        <p className="text-xs font-medium text-foreground/80 mt-1 sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1">
          {summarizePickerSelection(doc, value.subsByMain, value.subSubsByMainSub)}
        </p>
        {displayError && (
          <p
            role="alert"
            className="mt-2 text-sm text-red-600 dark:text-red-400 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2"
          >
            {displayError}
          </p>
        )}
      </div>
      {doc.mains.map((main) => {
        const active = value.subsByMain.get(main.label);
        const mainChecked = !!(active && active.size > 0);
        const hasSubs = (main.subs?.length ?? 0) > 0;
        const canActivateMain = canActivateMainInPicker(value.subsByMain, main.label, doc);
        return (
          <div key={main.id} className="space-y-3 border-t border-foreground/10 pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`main-${main.id}`}
                checked={mainChecked}
                onCheckedChange={(c) => toggleMain(main.label, c === true)}
              />
              <Label
                htmlFor={`main-${main.id}`}
                className={`font-semibold cursor-pointer ${!mainChecked && !canActivateMain ? "opacity-60" : ""}`}
              >
                {main.label}
              </Label>
            </div>
            {hasSubs && (
              <div className={`pl-6 space-y-2 ${!mainChecked ? "opacity-50" : ""}`}>
                {(main.subs ?? []).map((sub) => {
                  const subs = value.subsByMain.get(main.label);
                  const subOn = subs?.has(sub.label) ?? false;
                  const canPickSub =
                    mainChecked && canAddSubInPicker(value.subsByMain, main.label, sub.label, doc);
                  return (
                    <div key={sub.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`sub-${main.id}-${sub.id}`}
                          checked={subOn}
                          onCheckedChange={(c) => {
                            if (c === true && !mainChecked) {
                              setLimitError(`Select the main category “${main.label}” first.`);
                              return;
                            }
                            toggleSub(main.label, sub.label, c === true);
                          }}
                        />
                        <Label
                          htmlFor={`sub-${main.id}-${sub.id}`}
                          className={`cursor-pointer ${!subOn && !canPickSub ? "opacity-60" : ""}`}
                        >
                          {sub.label}
                        </Label>
                      </div>
                      {(sub.subSubs?.length ?? 0) > 0 && (
                        <div
                          className={`pl-6 space-y-2 border-l border-foreground/10 ml-2 ${!subOn ? "opacity-50" : ""}`}
                        >
                          {(sub.subSubs ?? []).map((ss) => {
                            const picked =
                              value.subSubsByMainSub.get(keyMainSub(main.label, sub.label))?.has(ss.label) ??
                              false;
                            const canPickSubSub =
                              subOn &&
                              canAddSubSubInPicker(
                                value.subsByMain,
                                value.subSubsByMainSub,
                                main.label,
                                sub.label,
                                ss.label,
                                doc,
                              );
                            return (
                              <div key={ss.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`ss-${main.id}-${sub.id}-${ss.id}`}
                                  checked={picked}
                                  onCheckedChange={(c) => {
                                    if (c === true && !subOn) {
                                      setLimitError(`Select the sub-category “${sub.label}” first.`);
                                      return;
                                    }
                                    toggleSubSub(main.label, sub.label, ss.label, c === true);
                                  }}
                                />
                                <Label
                                  htmlFor={`ss-${main.id}-${sub.id}-${ss.id}`}
                                  className={`cursor-pointer text-sm ${!picked && !canPickSubSub ? "opacity-60" : ""}`}
                                >
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
            )}
          </div>
        );
      })}
    </div>
  );
}
